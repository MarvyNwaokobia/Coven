// The deposit sync must not race the sender's own confirm (audit finding A-3): a transfer younger
// than the confirm window is left for that confirm to record with the sender attached, and the
// backfill inserts with ignore-duplicates so a race can never make it fail.
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { installFakes, load } from "./helpers/fakes.mjs";

const { db, world, reset } = installFakes();
const { syncInboundTransfers } = await load("lib/server/inbound-sync.ts");
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const hash = (byte) => "0x" + byte.repeat(32);

beforeEach(() => {
  reset();
  db.payments = [{ id: "recorded", tx_hash: hash("55"), to_user_id: "bob" }];
  world.inbound = [
    { id: "i1", state: "COMPLETE", amounts: ["7"], txHash: hash("11"), createDate: ago(60_000) }, // a minute old: the sender's confirm may still record it
    { id: "i2", state: "COMPLETE", amounts: ["8"], txHash: hash("22"), createDate: ago(10 * 60_000) }, // genuinely external
    { id: "i3", state: "COMPLETE", amounts: ["9"], txHash: hash("55"), createDate: ago(10 * 60_000) }, // already recorded
  ];
});

test("a transfer younger than six minutes is not backfilled as an anonymous external deposit", async () => {
  await syncInboundTransfers("bob", "w-bob");
  assert.ok(!db.payments.some((p) => p.tx_hash === hash("11")));
});

test("an old unrecorded transfer is backfilled, and an already recorded one is not duplicated", async () => {
  await syncInboundTransfers("bob", "w-bob");
  const hashes = db.payments.map((p) => p.tx_hash);
  assert.ok(hashes.includes(hash("22")));
  assert.equal(hashes.filter((h) => h === hash("55")).length, 1);
});

test("the backfill upserts on tx_hash and ignores duplicates, so it survives a race with a confirm", async () => {
  await syncInboundTransfers("bob", "w-bob");
  assert.ok(world.upserts.some((u) => u.onConflict === "tx_hash" && /ignore-duplicates/.test(u.prefer)));
});

test("a backfilled deposit gets a payment_received notice with no sender", async () => {
  await syncInboundTransfers("bob", "w-bob");
  const notice = db.activity.find((a) => a.type === "payment_received");
  assert.ok(notice);
  assert.equal(notice.actor_id, null);
});
