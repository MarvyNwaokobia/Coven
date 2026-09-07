// The cash-out transfer challenge sends the full amount to the collection wallet, and is refused
// before any PIN is requested when a payout could not be made afterwards.
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { callRoute, installFakes, load } from "./helpers/fakes.mjs";

const COLLECTION = "0x1111111111111111111111111111111111111111";
const { db, world, reset } = installFakes();
const route = await load("app/api/circle/transfer-challenge/route.ts");
const cashout = (amountUsdc = 100) => callRoute(route, "u1", { kind: "cashout", amountUsdc });

beforeEach(() => {
  reset();
  Object.assign(process.env, { OFFRAMP_COLLECTION_ADDRESS: COLLECTION, YELLOW_CARD_API_KEY: "k", YELLOW_CARD_API_SECRET: "s" });
  db.users = [{ id: "u1", circle_wallet_id: "w1", wallet_address: "0x2222222222222222222222222222222222222222" }];
});

for (const [label, key, secret] of [["neither", undefined, undefined], ["only the key", "k", undefined], ["only the secret", undefined, "s"]]) {
  test(`creates no challenge when Yellow Card credentials are missing (${label})`, async () => {
    for (const [name, value] of [["YELLOW_CARD_API_KEY", key], ["YELLOW_CARD_API_SECRET", secret]]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    const r = await cashout();
    assert.equal(r.status, 503);
    assert.equal(world.transferChallenges.length, 0);
  });
}

test("creates no challenge when the collection wallet is not configured", async () => {
  delete process.env.OFFRAMP_COLLECTION_ADDRESS;
  const r = await cashout();
  assert.equal(r.status, 503);
  assert.equal(world.transferChallenges.length, 0);
});

test("sends the full amount to the collection wallet from the caller's own wallet", async () => {
  const r = await cashout(100);
  assert.equal(r.status, 200);
  const [challenge] = world.transferChallenges;
  assert.equal(challenge.destinationAddress, COLLECTION);
  assert.deepEqual(challenge.amounts, ["100"]);
  assert.equal(challenge.walletId, "w1");
});

test("rejects a negative amount", async () => {
  assert.equal((await cashout(-5)).status, 400);
  assert.equal(world.transferChallenges.length, 0);
});
