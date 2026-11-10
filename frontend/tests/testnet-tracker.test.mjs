// The testnet tracker classifies each recorded transaction by what it did and which contract it went
// through, and marks a tester eligible only when every required stage is done.
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { installFakes, load } from "./helpers/fakes.mjs";

const { db, reset } = installFakes();
const { buildTracker, classify } = await load("lib/server/testnet-tracker.ts");
const route = await load("app/api/testnet/route.ts");
const mine = await load("app/api/testnet/me/route.ts");

const at = (minute) => `2026-11-09T10:${String(minute).padStart(2, "0")}:00.000Z`;

function fixture() {
  return {
    users: [
      { id: "alice", username: "alice", wallet_address: "0xa11ce", created_at: at(0), referred_by: null },
      { id: "bob", username: "bob", wallet_address: "0xb0b", created_at: at(1), referred_by: "alice" },
      { id: "carol", username: "carol", wallet_address: null, created_at: at(2), referred_by: "alice" },
    ],
    circles: [{ id: "c1", creator_id: "alice", created_at: at(3) }],
    payments: [
      // Faucet deposit: no Coven sender, no circle.
      { id: "p0", from_user_id: null, to_user_id: "alice", amount_usdc: "20", tx_hash: "0xdep", status: "completed", circle_id: null, created_at: at(4) },
      { id: "p1", from_user_id: "alice", to_user_id: "bob", amount_usdc: "5", tx_hash: "0xsend", status: "completed", circle_id: null, created_at: at(5) },
      { id: "p2", from_user_id: "bob", to_user_id: "alice", amount_usdc: "1", tx_hash: "0xgroup", status: "completed", circle_id: "c1", created_at: at(6) },
      // Alice's split share: recorded as a payment, reported as a split payment only.
      { id: "p3", from_user_id: "alice", to_user_id: "bob", amount_usdc: "2", tx_hash: "0xsplitpay", status: "pending", circle_id: "c1", created_at: at(8) },
      // An unverified cross-chain send is not settled and must not count.
      { id: "p4", from_user_id: "bob", to_user_id: "alice", amount_usdc: "9", tx_hash: null, status: "pending", circle_id: null, created_at: at(9) },
      // A goal paying out: no sender, inside a circle.
      { id: "p5", from_user_id: null, to_user_id: "bob", amount_usdc: "3", tx_hash: "0xpayout", status: "completed", circle_id: "c1", created_at: at(12) },
    ],
    splits: [
      { id: "s1", creator_id: "bob", contract_split_id: "0xs1", total_amount_usdc: "4", created_at: at(7) },
      { id: "s0", creator_id: "bob", contract_split_id: null, total_amount_usdc: "4", created_at: at(7) },
    ],
    split_members: [
      { split_id: "s1", user_id: "alice", amount_owed_usdc: "2", paid: true, payment_id: "p3", paid_at: at(8) },
      { split_id: "s1", user_id: "bob", amount_owed_usdc: "2", paid: false, payment_id: null, paid_at: null },
    ],
    circle_goals: [{ id: "g1", creator_id: "alice", contract_goal_id: "0xg1", target_amount_usdc: "100", created_at: at(10) }],
    goal_contributions: [{ id: "gc1", goal_id: "g1", user_id: "alice", amount_usdc: "3", tx_hash: "0xcontrib", created_at: at(11) }],
  };
}

beforeEach(reset);

test("each transaction is classified once, by what it did", () => {
  const kinds = classify(fixture()).map((e) => `${e.kind}:${e.userId}`);
  assert.deepEqual(kinds.sort(), [
    "deposit:alice",
    "goal_contribute:alice",
    "goal_create:alice",
    "goal_payout:bob",
    "group_send:bob",
    "send:alice",
    "split_create:bob",
    "split_pay:alice",
  ]);
});

test("a split payment carries its on-chain hash and is not also counted as a send", () => {
  const events = classify(fixture());
  const splitPay = events.find((e) => e.kind === "split_pay");
  assert.equal(splitPay.txHash, "0xsplitpay");
  assert.equal(events.filter((e) => e.txHash === "0xsplitpay").length, 1);
});

test("a tester is eligible only when every required stage is done", () => {
  const data = buildTracker(fixture());
  const alice = data.participants.find((p) => p.username === "alice");
  const bob = data.participants.find((p) => p.username === "bob");

  assert.deepEqual(alice.stages, { wallet: true, funded: true, circle: true, send: true, split: true, goal: true, invite: true });
  assert.equal(alice.eligible, true);
  assert.equal(alice.referrals, 2);
  assert.equal(alice.txCount, 4); // send, split pay, goal create, goal contribute (not the deposit)
  assert.equal(alice.volume, 10); // 5 sent + 2 split + 3 goal

  assert.equal(bob.stages.circle, false);
  assert.equal(bob.stages.goal, false);
  assert.equal(bob.stages.invite, false);
  assert.equal(bob.eligible, false);

  assert.equal(data.totals.eligible, 1);
  assert.equal(data.participants[0].username, "alice"); // eligible testers first
  assert.equal(data.stages.find((s) => s.id === "wallet").users, 2);
});

test("an invite counts only once the invited friend has set up a wallet", () => {
  const input = fixture();
  input.users[1].referred_by = null; // bob joined on his own; only carol (no wallet yet) was invited
  let alice = buildTracker(input).participants.find((p) => p.username === "alice");
  assert.equal(alice.referrals, 1);
  assert.equal(alice.stages.invite, false);
  assert.equal(alice.eligible, false);

  input.users[2].wallet_address = "0xca401";
  alice = buildTracker(input).participants.find((p) => p.username === "alice");
  assert.equal(alice.stages.invite, true);
  assert.equal(alice.eligible, true);
});

test("the feed names the tester, their address and who they paid, newest first", () => {
  const { recent } = buildTracker(fixture());
  assert.equal(recent[0].kind, "goal_payout");
  const send = recent.find((e) => e.kind === "send");
  assert.equal(send.username, "alice");
  assert.equal(send.address, "0xa11ce");
  assert.equal(send.counterparty, "bob");
});

const asUser = (id, code) =>
  new Request("http://localhost/api/testnet", {
    headers: { ...(id ? { authorization: `Bearer tok-${id}` } : {}), ...(code ? { "x-access-code": code } : {}) },
  });

test("GET /api/testnet is closed to anyone not on the team", async () => {
  Object.assign(db, fixture());
  db.users[0].email = "alice@example.com";
  db.users[1].email = "bob@example.com";
  process.env.TESTNET_TEAM_EMAILS = "Alice@Example.com";
  process.env.TESTNET_ACCESS_CODE = "open-sesame-2026";

  assert.equal((await route.GET(asUser(null))).status, 401);
  assert.equal((await route.GET(asUser("bob"))).status, 401); // signed in, not on the team, no code
  const wrong = await route.GET(asUser(null, "open-sesame"));
  assert.equal(wrong.status, 403);
  assert.ok(!JSON.stringify(await wrong.json()).includes("0xa11ce"));

  process.env.TESTNET_TEAM_EMAILS = "";
  process.env.TESTNET_ACCESS_CODE = "";
  assert.equal((await route.GET(asUser("alice"))).status, 401);
  assert.equal((await route.GET(asUser(null, "anything"))).status, 403); // no code set: nothing matches
});

test("a team email that was never confirmed does not open the tracker", async () => {
  Object.assign(db, fixture());
  db.users[0].email = "alice@example.com";
  db.users[0].email_unconfirmed = true; // signed up with an address they have not proved they own
  process.env.TESTNET_TEAM_EMAILS = "alice@example.com";
  process.env.TESTNET_ACCESS_CODE = "";
  assert.equal((await route.GET(asUser("alice"))).status, 401);
  db.users[0].email_unconfirmed = false;
  assert.equal((await route.GET(asUser("alice"))).status, 200);
});

test("an access code shorter than 16 characters is ignored, even when it matches", async () => {
  Object.assign(db, fixture());
  process.env.TESTNET_TEAM_EMAILS = "";
  process.env.TESTNET_ACCESS_CODE = "CPTTCODE"; // 8 characters: guessable, and there is no attempt limit
  assert.equal((await route.GET(asUser(null, "CPTTCODE"))).status, 403);
  process.env.TESTNET_ACCESS_CODE = "a-long-random-code-9";
  assert.equal((await route.GET(asUser(null, "a-long-random-code-9"))).status, 200);
});

test("the access code opens the tracker without a sign-in", async () => {
  Object.assign(db, fixture());
  process.env.TESTNET_TEAM_EMAILS = "";
  process.env.TESTNET_ACCESS_CODE = "open-sesame-2026";
  const res = await route.GET(asUser(null, " open-sesame-2026 "));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).totals.users, 3);
});

test("GET /api/testnet serves the tracker to the team without private fields", async () => {
  Object.assign(db, fixture());
  db.users[0].email = "alice@example.com";
  process.env.TESTNET_TEAM_EMAILS = "alice@example.com, someone@else.com";
  process.env.TESTNET_ACCESS_CODE = "";
  const res = await route.GET(asUser("alice"));
  assert.equal(res.headers.get("cache-control"), "private, no-store");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.totals.users, 3);
  assert.equal(body.totals.eligible, 1);
  assert.ok(!JSON.stringify(body).includes("alice@example.com"));
});

test("GET /api/testnet/me gives a tester only their own progress", async () => {
  Object.assign(db, fixture());
  const res = await mine.GET(asUser("bob"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.progress.username, "bob");
  assert.equal(body.progress.stages.invite, false);
  assert.ok(!JSON.stringify(body).includes("0xa11ce")); // nobody else's address
  assert.equal((await mine.GET(asUser(null))).status, 401);
});
