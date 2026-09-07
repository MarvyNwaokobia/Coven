// One on-chain transfer is recorded once (audit finding A-3). The database stub enforces the unique
// tx_hash from migration 006, so these tests also prove the routes handle the constraint firing:
// before the fix, request-pay, circle-send and split-pay ignored a failed insert and carried on.
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { callRoute, installFakes, load } from "./helpers/fakes.mjs";

const WALLET = { alice: "0x" + "a1".repeat(20), bob: "0x" + "b2".repeat(20), carol: "0x" + "c3".repeat(20) };
const { db, world, reset } = installFakes();
const routes = {
  send: await load("app/api/payments/send/route.ts"),
  request: await load("app/api/payments/[requestId]/pay/route.ts"),
  circle: await load("app/api/circles/[id]/send/route.ts"),
  split: await load("app/api/splits/[splitId]/pay/route.ts"),
};

let counter = 0;
/** A settled 10 USDC transfer from alice's wallet. */
const transfer = (over = {}) => {
  counter++;
  return {
    id: "transfer-" + counter,
    state: "COMPLETE",
    walletId: "w-alice",
    destinationAddress: WALLET.bob,
    amounts: ["10"],
    txHash: "0x" + counter.toString(16).padStart(64, "0"),
    createDate: new Date().toISOString(),
    ...over,
  };
};
const credits = () => db.rpc.filter((r) => r.fn === "increment_user_totals").length;

beforeEach(() => {
  reset();
  db.users = ["alice", "bob", "carol"].map((n) => ({ id: n, username: n, circle_wallet_id: "w-" + n, wallet_address: WALLET[n] }));
  db.circle_members = [{ circle_id: "c1", user_id: "alice" }, { circle_id: "c1", user_id: "bob" }];
  db.rpc = [];
});

test("send: a real transfer is recorded and credited once", async () => {
  world.transfers = [transfer()];
  const r = await callRoute(routes.send, "alice", { toUsername: "bob", amountUsdc: 10 });
  assert.equal(r.status, 200);
  assert.equal(db.payments.length, 1);
  assert.equal(credits(), 1);
});

test("send: replaying the same transfer is refused and changes nothing", async () => {
  world.transfers = [transfer()];
  await callRoute(routes.send, "alice", { toUsername: "bob", amountUsdc: 10 });
  for (let i = 0; i < 5; i++) {
    const replay = await callRoute(routes.send, "alice", { toUsername: "bob", amountUsdc: 10 });
    assert.equal(replay.status, 409);
    assert.match(replay.body.error, /already been recorded/);
  }
  assert.equal(db.payments.length, 1);
  assert.equal(credits(), 1);
  assert.equal(db.activity.length, 2); // one sent + one received notice, not one pair per replay
});

test("send: two identical payments in a row are each recorded once, a third call is refused", async () => {
  world.transfers = [
    transfer({ txHash: "0x" + "aa".repeat(32), createDate: new Date().toISOString() }),
    transfer({ txHash: "0x" + "bb".repeat(32), createDate: new Date(Date.now() - 60_000).toISOString() }),
  ];
  await callRoute(routes.send, "alice", { toUsername: "bob", amountUsdc: 10 });
  await callRoute(routes.send, "alice", { toUsername: "bob", amountUsdc: 10 });
  const third = await callRoute(routes.send, "alice", { toUsername: "bob", amountUsdc: 10 });
  assert.equal(db.payments.length, 2);
  assert.equal(new Set(db.payments.map((p) => p.tx_hash)).size, 2);
  assert.notEqual(third.status, 200);
  assert.equal(credits(), 2);
});

test("send: a settled transfer with no tx hash is refused", async () => {
  world.transfers = [transfer({ txHash: undefined })];
  const r = await callRoute(routes.send, "alice", { toUsername: "bob", amountUsdc: 10 });
  assert.equal(r.status, 502);
  assert.match(r.body.error, /no hash/i);
  assert.equal(db.payments.length, 0);
});

test("send: when the pre-check misses (a race) the unique constraint still stops the duplicate", async () => {
  world.transfers = [transfer()];
  world.hidePaymentSelect = true;
  await callRoute(routes.send, "alice", { toUsername: "bob", amountUsdc: 10 });
  const r = await callRoute(routes.send, "alice", { toUsername: "bob", amountUsdc: 10 });
  assert.equal(r.status, 409);
  assert.equal(db.payments.length, 1);
  assert.equal(credits(), 1);
});

const twoRequests = () => {
  db.payment_requests = [
    { id: "R1", from_user_id: "bob", to_user_id: "alice", amount_usdc: 10, status: "pending", note: "lunch" },
    { id: "R2", from_user_id: "bob", to_user_id: "alice", amount_usdc: 10, status: "pending", note: "taxi" },
  ];
};

test("request-pay: one transfer cannot settle two identical requests", async () => {
  twoRequests();
  world.transfers = [transfer()];
  assert.equal((await callRoute(routes.request, "alice", {}, { requestId: "R1" })).status, 200);
  assert.equal(db.payment_requests[0].status, "paid");
  const notices = db.activity.length;
  const second = await callRoute(routes.request, "alice", {}, { requestId: "R2" });
  assert.notEqual(second.status, 200);
  assert.equal(db.payment_requests[1].status, "pending");
  assert.equal(db.activity.length, notices);
});

test("request-pay: on the race path the second request is not marked paid", async () => {
  twoRequests();
  world.transfers = [transfer()];
  world.hidePaymentSelect = true;
  await callRoute(routes.request, "alice", {}, { requestId: "R1" });
  const second = await callRoute(routes.request, "alice", {}, { requestId: "R2" });
  assert.equal(second.status, 409);
  assert.equal(db.payment_requests[1].status, "pending");
});

test("circle-send: a replay creates no second payment and no second notice", async () => {
  world.transfers = [transfer()];
  await callRoute(routes.circle, "alice", { toUsername: "bob", amountUsdc: 10 }, { id: "c1" });
  const replay = await callRoute(routes.circle, "alice", { toUsername: "bob", amountUsdc: 10 }, { id: "c1" });
  assert.notEqual(replay.status, 200);
  assert.equal(db.payments.length, 1);
  assert.equal(db.activity.length, 1);
});

test("circle-send: on the race path there is no second notice", async () => {
  world.transfers = [transfer()];
  world.hidePaymentSelect = true;
  await callRoute(routes.circle, "alice", { toUsername: "bob", amountUsdc: 10 }, { id: "c1" });
  const replay = await callRoute(routes.circle, "alice", { toUsername: "bob", amountUsdc: 10 }, { id: "c1" });
  assert.equal(replay.status, 409);
  assert.equal(db.activity.length, 1);
});

const twoSplits = () => {
  db.splits = [
    { id: "S1", creator_id: "carol", status: "open", total_amount_usdc: 10, collected_usdc: 0, description: "dinner" },
    { id: "S2", creator_id: "carol", status: "open", total_amount_usdc: 10, collected_usdc: 0, description: "trip" },
  ];
  db.split_members = [
    { split_id: "S1", user_id: "alice", amount_owed_usdc: 10, paid: false },
    { split_id: "S2", user_id: "alice", amount_owed_usdc: 10, paid: false },
  ];
};

test("split-pay: one transfer cannot pay two splits' identical shares", async () => {
  twoSplits();
  world.transfers = [transfer({ destinationAddress: WALLET.carol })];
  const first = await callRoute(routes.split, "alice", {}, { splitId: "S1" });
  assert.equal(first.status, 200);
  assert.equal(db.split_members[0].paid, true);
  assert.equal(db.splits[0].status, "complete");
  const second = await callRoute(routes.split, "alice", {}, { splitId: "S2" });
  assert.notEqual(second.status, 200);
  assert.equal(db.split_members[1].paid, false);
  assert.equal(db.splits[1].status, "open");
  assert.equal(Number(db.splits[1].collected_usdc), 0);
});

test("split-pay: on the race path the second share is not marked paid", async () => {
  twoSplits();
  world.transfers = [transfer({ destinationAddress: WALLET.carol })];
  world.hidePaymentSelect = true;
  await callRoute(routes.split, "alice", {}, { splitId: "S1" });
  const second = await callRoute(routes.split, "alice", {}, { splitId: "S2" });
  assert.equal(second.status, 409);
  assert.equal(db.split_members[1].paid, false);
});
