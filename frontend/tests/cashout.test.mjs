// Cash out must never request a payout for USDC it has not received (audit finding A-2), and must
// not start at all when a payout cannot be made.
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { callRoute, installFakes, load } from "./helpers/fakes.mjs";

const COLLECTION = "0x1111111111111111111111111111111111111111";
const OTHER = "0x3333333333333333333333333333333333333333";
const { db, world, reset } = installFakes();
const { encrypt } = await load("lib/crypto.ts");
const route = await load("app/api/cashout/initiate/route.ts");

const deposit = (over = {}) => ({
  id: "tx1",
  state: "COMPLETE",
  walletId: "w1",
  destinationAddress: COLLECTION,
  amounts: ["100"],
  txHash: "0x" + "aa".repeat(32),
  createDate: new Date().toISOString(),
  ...over,
});
const cashOut = (amount = 100) => callRoute(route, "u1", { amountUsdc: amount, bankAccountId: "b1" });
const payoutsRequested = () => world.yellowCard.length;

beforeEach(() => {
  reset();
  Object.assign(process.env, { OFFRAMP_COLLECTION_ADDRESS: COLLECTION, YELLOW_CARD_API_KEY: "k", YELLOW_CARD_API_SECRET: "s" });
  db.users = [{ id: "u1", circle_wallet_id: "w1", wallet_address: "0x2222222222222222222222222222222222222222" }];
  db.bank_accounts = [
    { id: "b1", user_id: "u1", account_number_encrypted: encrypt("0123456789"), bank_code: "gtbank", account_name: "A B", country: "NG", currency: "NGN" },
  ];
});

test("refuses when the collection wallet is not configured", async () => {
  delete process.env.OFFRAMP_COLLECTION_ADDRESS;
  world.transfers = [deposit()];
  const r = await cashOut();
  assert.equal(r.status, 503);
  assert.equal(payoutsRequested(), 0);
  assert.equal(world.inserts.offramp_payouts ?? 0, 0);
});

for (const [label, key, secret] of [["neither", undefined, undefined], ["only the key", "k", undefined], ["only the secret", undefined, "s"]]) {
  test(`refuses before doing anything when Yellow Card credentials are missing (${label})`, async () => {
    for (const [name, value] of [["YELLOW_CARD_API_KEY", key], ["YELLOW_CARD_API_SECRET", secret]]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    world.transfers = [deposit()];
    const r = await cashOut();
    assert.equal(r.status, 503);
    assert.equal(world.inserts.offramp_payouts ?? 0, 0);
    assert.equal(payoutsRequested(), 0);
  });
}

test("no deposit at all: no payout (the original bug paid out anyway)", async () => {
  const r = await cashOut(1000);
  assert.equal(r.status, 502);
  assert.equal(payoutsRequested(), 0);
  assert.equal(world.inserts.offramp_payouts ?? 0, 0);
});

test("a deposit smaller than the amount requested is refused", async () => {
  world.transfers = [deposit({ amounts: ["1"] })];
  const r = await cashOut(1000);
  assert.equal(r.status, 502);
  assert.equal(payoutsRequested(), 0);
});

test("a transfer to any other address is refused", async () => {
  world.transfers = [deposit({ destinationAddress: OTHER })];
  const r = await cashOut();
  assert.equal(r.status, 502);
  assert.equal(payoutsRequested(), 0);
});

test("a failed transfer is refused", async () => {
  world.transfers = [deposit({ state: "FAILED" })];
  const r = await cashOut();
  assert.equal(r.status, 502);
  assert.equal(payoutsRequested(), 0);
});

test("a settled transfer with no tx hash is refused, since it could not be de-duplicated", async () => {
  world.transfers = [deposit({ txHash: undefined })];
  const r = await cashOut();
  assert.equal(r.status, 502);
  assert.equal(payoutsRequested(), 0);
});

test("a valid deposit pays out the net amount, takes the 1% fee and stores the deposit hash", async () => {
  world.transfers = [deposit()];
  const r = await cashOut();
  assert.equal(r.status, 200);
  assert.equal(payoutsRequested(), 1);
  assert.equal(world.yellowCard[0].amount, 99);
  const row = db.offramp_payouts[0];
  assert.equal(row.fee_usdc, 1);
  assert.equal(row.net_usdc, 99);
  assert.equal(row.deposit_tx_hash, "0x" + "aa".repeat(32));
});

test("the same deposit cannot fund a second payout", async () => {
  world.transfers = [deposit()];
  assert.equal((await cashOut()).status, 200);
  const replay = await cashOut();
  assert.equal(replay.status, 409);
  assert.equal(payoutsRequested(), 1);
});

test("a second, different deposit is accepted", async () => {
  world.transfers = [deposit()];
  await cashOut();
  world.transfers = [deposit({ id: "tx2", txHash: "0x" + "bb".repeat(32) })];
  assert.equal((await cashOut()).status, 200);
  assert.equal(payoutsRequested(), 2);
});

test("if Yellow Card fails after a real deposit, the user is told to contact support, not to try again", async () => {
  world.transfers = [deposit()];
  world.yellowCardFails = true;
  const r = await cashOut();
  assert.equal(r.status, 502);
  assert.match(r.body.error, /contact support/i);
  assert.doesNotMatch(r.body.error, /try again/i); // retrying would take the USDC twice
  assert.equal(db.offramp_payouts[0].status, "failed");
});
