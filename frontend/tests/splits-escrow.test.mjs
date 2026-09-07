// Bill splits held in SplitEscrow, through the real routes: creation is validated and recorded from
// the chain, members pay bound to the split's recipient and their own share, the escrow releases to
// the creator when the last share lands, and cancel / expire / refund work without anyone trusting
// the request body. Every challenge is executed on a local chain as Circle would.
import { after, test } from "node:test";
import { callRoute, installFakes, load, makeChecker } from "./helpers/fakes.mjs";
import { ethers, foundryAvailable, SKIP_REASON, startChain } from "./helpers/chain.mjs";

const skip = foundryAvailable() ? false : SKIP_REASON;
const { db, world, reset } = installFakes();

let chain, ESCROW, USDC;
if (!skip) {
  chain = await startChain();
  after(() => chain.stop());
  USDC = await chain.deploy("MockUSDC.sol", "MockUSDC");
  ESCROW = await chain.deploy("SplitEscrow.sol", "SplitEscrow", USDC);
}
Object.assign(process.env, {
  ARC_RPC_URL: chain?.rpc ?? "http://127.0.0.1:1",
  NEXT_PUBLIC_SPLIT_ESCROW_CONTRACT: ESCROW ?? "0x00000000000000000000000000000000000000e5",
  ARC_USDC_ADDRESS: USDC ?? "0x00000000000000000000000000000000000000d5",
});
const { SPLIT_ESCROW_ABI } = await load("lib/contracts/index.ts");
const R = {
  createChallenge: await load("app/api/splits/create-challenge/route.ts"),
  createConfirm: await load("app/api/splits/create-confirm/route.ts"),
  payChallenge: await load("app/api/splits/[splitId]/pay-challenge/route.ts"),
  payConfirm: await load("app/api/splits/[splitId]/pay-confirm/route.ts"),
  actChallenge: await load("app/api/splits/[splitId]/action-challenge/route.ts"),
  actConfirm: await load("app/api/splits/[splitId]/action-confirm/route.ts"),
  legacyPay: await load("app/api/splits/[splitId]/pay/route.ts"),
  transferChallenge: await load("app/api/circle/transfer-challenge/route.ts"),
};

const names = ["alice", "bob", "carol", "eve"]; // eve is not in the circle
const wallets = () => Object.fromEntries(names.map((n, i) => [n, chain?.addresses[i] ?? "0x" + (i + 1).toString(16).repeat(40)]));
function seedUsers() {
  reset();
  const A = wallets();
  db.users = names.map((n) => ({ id: n, username: n, circle_wallet_id: "w-" + n, wallet_address: A[n] }));
  db.circle_members = ["alice", "bob", "carol"].map((u) => ({ circle_id: "c1", user_id: u }));
  return A;
}
const body = { circleId: "c1", memberUsernames: ["bob", "carol"], amounts: [20, 20], description: "Dinner at Nkoyo" };

test("split creation validates its input and issues a createSplit challenge", async (t) => {
  const { check, report } = makeChecker();
  const A = seedUsers();
  const last = () => world.challenges[world.challenges.length - 1];
  try {
    let r = await callRoute(R.createChallenge, "alice", body);
    const c = last();
    check("a valid request -> a createSplit challenge with the members, shares, the creator as recipient, the description and the deadline",
      r.status === 200 && c.abiFunctionSignature === "createSplit(address[],uint256[],address,string,uint256)"
      && JSON.stringify(c.abiParameters[0].map((a) => a.toLowerCase())) === JSON.stringify([A.bob, A.carol].map((a) => a.toLowerCase()))
      && JSON.stringify(c.abiParameters[1]) === JSON.stringify(["20000000", "20000000"])
      && c.abiParameters[2].toLowerCase() === A.alice.toLowerCase() && c.abiParameters[3] === "Dinner at Nkoyo" && c.abiParameters[4] === "72", { r, c });

    const rejected = async (name, over, status, message) => {
      const issued = world.challenges.length;
      const x = await callRoute(R.createChallenge, over.who ?? "alice", { ...body, ...over.body });
      check(`${name} -> ${status} and no challenge`, x.status === status && world.challenges.length === issued && (!message || message.test(x.body.error)), x);
    };
    await rejected("a member outside the circle", { body: { memberUsernames: ["bob", "eve"] } }, 400, /Not circle members/);
    await rejected("the creator listed as a debtor", { body: { memberUsernames: ["bob", "alice"] } }, 400, /recipient/);
    await rejected("the same member twice", { body: { memberUsernames: ["bob", "bob"] } }, 400, /once/);
    await rejected("a zero share", { body: { amounts: [20, 0] } }, 400);
    await rejected("an absurd share", { body: { amounts: [20, 5_000_000] } }, 400);
    await rejected("amounts that do not match the members", { body: { amounts: [20] } }, 400);
    await rejected("a deadline of 0 hours", { body: { deadlineHours: 0 } }, 400);
    await rejected("a deadline over 30 days", { body: { deadlineHours: 24 * 31 } }, 400);
    await rejected("a description over 120 characters", { body: { description: "x".repeat(121) } }, 400);
    await rejected("50 members", { body: { memberUsernames: Array.from({ length: 50 }, (_, i) => "u" + i), amounts: Array(50).fill(1) } }, 400);
    await rejected("a creator who is not in the circle", { who: "eve" }, 403);
    await rejected("an unknown username", { body: { memberUsernames: ["bob", "nobody"] } }, 404);
  } finally {
    await report(t);
  }
});

test("split escrow lifecycle: create, pay, complete, cancel, expire, refund", { skip }, async (t) => {
  const { check, report } = makeChecker();
  const A = seedUsers();
  const S = Object.fromEntries(names.map((n, i) => [n, chain.signers[i]]));
  const iface = new ethers.Interface(SPLIT_ESCROW_ABI);
  const escrow = new ethers.Contract(ESCROW, SPLIT_ESCROW_ABI, chain.provider);
  const usdc = new ethers.Contract(USDC, ["function mint(address,uint256)", "function approve(address,uint256)", "function balanceOf(address) view returns (uint256)"], chain.provider);
  for (const n of names) await (await usdc.connect(S[n]).mint(A[n], 1_000_000_000n)).wait();

  const last = () => world.challenges[world.challenges.length - 1];
  const execChallenge = async (who) => {
    const c = last();
    const contract = new ethers.Contract(c.contractAddress, ["function " + c.abiFunctionSignature], S[who]);
    return (await contract[c.abiFunctionSignature.split("(")[0]](...c.abiParameters)).wait();
  };
  const at = (id, to, hash) => ({ id, contractAddress: to, txHash: hash, createDate: new Date().toISOString() });
  const recordSplit = async (receipt, exec) => {
    world.execTxs = [at(exec, ESCROW, receipt.hash)];
    await callRoute(R.createConfirm, "alice", { circleId: "c1" });
    const id = iface.parseLog(receipt.logs[0]).args.splitId;
    return { onChain: id, dbId: db.splits.find((s) => s.contract_split_id === id)?.id };
  };

  try {
    // ============================================================ create-confirm
    await callRoute(R.createChallenge, "alice", body);
    const created = await execChallenge("alice");
    const splitId = iface.parseLog(created.logs[0]).args.splitId;
    check("the challenge is a valid on-chain call (executing it creates the split)", (await escrow.getSplit(splitId))[5] === 1n);

    world.execTxs = [at("e1", ESCROW, created.hash)];
    let r = await callRoute(R.createConfirm, "alice", { circleId: "c1", memberUsernames: ["eve"], amounts: [999], description: "FAKE" });
    const split = db.splits[0];
    check("create-confirm records the split", r.status === 200 && db.splits.length === 1, r);
    check("the total, description and deadline come from the chain, not the request", split?.total_amount_usdc === 40 && split?.description === "Dinner at Nkoyo" && new Date(split.deadline).getTime() / 1000 === Number((await escrow.getSplit(splitId))[4]), split);
    check("the members and shares come from the chain (bob 20, carol 20), not the request (eve)", JSON.stringify(db.split_members.map((m) => [m.user_id, m.amount_owed_usdc]).sort()) === JSON.stringify([["bob", 20], ["carol", 20]]), db.split_members);
    check("the members are notified with their share", db.activity.length === 2 && db.activity.every((a) => a.type === "split_created" && a.amount_usdc === 20), db.activity);
    r = await callRoute(R.createConfirm, "alice", { circleId: "c1" });
    check("replaying the confirm is refused and leaves one split", r.status !== 200 && db.splits.length === 1, r);

    let receipt = await (await escrow.connect(S.alice).createSplit([A.bob, A.eve], [5_000_000n, 5_000_000n], A.alice, "includes an outsider", 24)).wait();
    world.execTxs = [at("e2", ESCROW, receipt.hash)];
    r = await callRoute(R.createConfirm, "alice", { circleId: "c1" });
    check("an on-chain split that includes a wallet outside the circle -> 409 and not recorded", r.status === 409 && db.splits.length === 1, r);
    receipt = await (await escrow.connect(S.alice).createSplit([A.bob], [5_000_000n], A.alice, "alice made this", 24)).wait();
    world.execTxs = [at("e3", ESCROW, receipt.hash)];
    r = await callRoute(R.createConfirm, "bob", { circleId: "c1" });
    check("bob cannot claim alice's split -> 409", r.status === 409 && db.splits.length === 1, r);
    receipt = await (await escrow.connect(S.alice).createSplit([A.bob], [5_000_000n], A.eve, "pays someone else", 24)).wait();
    world.execTxs = [at("e4", ESCROW, receipt.hash)];
    r = await callRoute(R.createConfirm, "alice", { circleId: "c1" });
    check("a split whose recipient is not its creator -> 409 (the app only creates splits paid to the creator)", r.status === 409 && db.splits.length === 1, r);

    // ============================================================ pay
    const sid = db.splits[0].id;
    r = await callRoute(R.payChallenge, "eve", {}, { splitId: sid });
    check("someone who owes no share -> 404", r.status === 404, r);
    r = await callRoute(R.payChallenge, "bob", {}, { splitId: sid });
    check("with no allowance yet -> an approve for exactly his share, not an unlimited one", r.status === 200 && r.body.step === "approve" && last().abiFunctionSignature === "approve(address,uint256)" && last().abiParameters[0].toLowerCase() === ESCROW.toLowerCase() && last().abiParameters[1] === "20000000", { r, c: last() });
    const approveReceipt = await execChallenge("bob");
    world.execTxs = [at("a1", USDC, approveReceipt.hash)];
    r = await callRoute(R.payConfirm, "bob", { step: "approve" }, { splitId: sid });
    check("pay-confirm for the approve step -> approved", r.status === 200 && r.body.approved === true, r);
    r = await callRoute(R.payChallenge, "bob", {}, { splitId: sid });
    check("then the pay step, bound to the split's recipient (alice) and his exact share", r.status === 200 && r.body.step === "pay" && last().abiFunctionSignature === "pay(bytes32,address,uint256)" && last().abiParameters[0] === splitId && last().abiParameters[1].toLowerCase() === A.alice.toLowerCase() && last().abiParameters[2] === "20000000", { r, c: last() });
    const payReceipt = await execChallenge("bob");
    world.execTxs = [at("p1", ESCROW, payReceipt.hash)];
    r = await callRoute(R.payConfirm, "bob", { step: "pay", amountUsdc: 999999 }, { splitId: sid });
    const first = db.payments[0];
    check("pay-confirm records the payment", r.status === 200 && r.body.complete === false && db.payments.length === 1, r);
    check("the amount is the on-chain 20, it is PENDING while escrowed, and it is from bob to alice", first?.amount_usdc === 20 && first?.status === "pending" && first?.from_user_id === "bob" && first?.to_user_id === "alice" && first?.tx_hash === payReceipt.hash, first);
    check("bob's share is paid, and the collected total is the chain's 20 while the split stays open", db.split_members.find((m) => m.user_id === "bob").paid === true && db.splits[0].collected_usdc === 20 && db.splits[0].status === "open", db.splits[0]);
    check("the creator gets a split_paid notice", db.activity.some((a) => a.type === "split_paid" && a.user_id === "alice"));
    r = await callRoute(R.payConfirm, "bob", { step: "pay" }, { splitId: sid });
    check("replaying pay-confirm is refused and leaves one payment", r.status !== 200 && db.payments.length === 1, r);
    r = await callRoute(R.payChallenge, "bob", {}, { splitId: sid });
    check("bob has already paid -> 409", r.status === 409, r);

    const aliceBefore = await usdc.balanceOf(A.alice);
    await callRoute(R.payChallenge, "carol", {}, { splitId: sid });
    world.execTxs = [at("a2", USDC, (await execChallenge("carol")).hash)];
    await callRoute(R.payConfirm, "carol", { step: "approve" }, { splitId: sid });
    await callRoute(R.payChallenge, "carol", {}, { splitId: sid });
    world.execTxs = [at("p2", ESCROW, (await execChallenge("carol")).hash)];
    r = await callRoute(R.payConfirm, "carol", { step: "pay" }, { splitId: sid });
    check("the last share completes the split", r.status === 200 && r.body.complete === true && db.splits[0].status === "complete" && db.splits[0].collected_usdc === 40, r);
    check("the escrow paid alice the full 40", (await usdc.balanceOf(A.alice)) - aliceBefore === 40_000_000n);
    check("both members' payments are now completed", db.payments.length === 2 && db.payments.every((p) => p.status === "completed"), db.payments.map((p) => p.status));
    check("the creator gets split_complete", db.activity.some((a) => a.type === "split_complete" && a.user_id === "alice"));
    r = await callRoute(R.payChallenge, "bob", {}, { splitId: sid });
    check("paying after completion -> 409 no longer open", r.status === 409 && /no longer open/.test(r.body.error), r);

    // ============================================================ cancel and refund
    receipt = await (await escrow.connect(S.alice).createSplit([A.bob, A.carol], [10_000_000n, 10_000_000n], A.alice, "Second", 72)).wait();
    const second = await recordSplit(receipt, "e5");
    await (await usdc.connect(S.bob).approve(ESCROW, 10_000_000n)).wait();
    world.execTxs = [at("p3", ESCROW, (await (await escrow.connect(S.bob).pay(second.onChain, A.alice, 10_000_000n)).wait()).hash)];
    await callRoute(R.payConfirm, "bob", { step: "pay" }, { splitId: second.dbId });

    r = await callRoute(R.actChallenge, "carol", { action: "cancel" }, { splitId: second.dbId });
    check("only the creator can cancel -> 409 for carol", r.status === 409 && /created this split/.test(r.body.error), r);
    r = await callRoute(R.actChallenge, "alice", { action: "expire" }, { splitId: second.dbId });
    check("expire before the deadline -> 409", r.status === 409 && /deadline/.test(r.body.error), r);
    r = await callRoute(R.actConfirm, "alice", { action: "cancel" }, { splitId: second.dbId });
    check("a forged confirm (cancel) before it happened on-chain -> 409 and the DB is untouched", r.status === 409 && db.splits.find((s) => s.id === second.dbId).status === "open", r);
    r = await callRoute(R.actChallenge, "alice", { action: "cancel" }, { splitId: second.dbId });
    check("the creator cancels -> a cancel(bytes32) challenge", r.status === 200 && last().abiFunctionSignature === "cancel(bytes32)" && last().abiParameters[0] === second.onChain, r);
    world.execTxs = [at("c1", ESCROW, (await execChallenge("alice")).hash)];
    r = await callRoute(R.actConfirm, "alice", { action: "cancel" }, { splitId: second.dbId });
    const bobsEscrowed = db.payments.find((p) => p.amount_usdc === 10);
    check("confirming the cancel marks the split cancelled and bob's escrowed payment failed", r.status === 200 && db.splits.find((s) => s.id === second.dbId).status === "cancelled" && bobsEscrowed?.status === "failed", { r, p: bobsEscrowed });
    r = await callRoute(R.actChallenge, "carol", { action: "claim-refund" }, { splitId: second.dbId });
    check("a member who never paid cannot claim -> 409", r.status === 409 && /did not pay/.test(r.body.error), r);
    const bobBefore = await usdc.balanceOf(A.bob);
    r = await callRoute(R.actChallenge, "bob", { action: "claim-refund" }, { splitId: second.dbId });
    check("bob gets a claimRefund(bytes32) challenge", r.status === 200 && last().abiFunctionSignature === "claimRefund(bytes32)", r);
    world.execTxs = [at("r1", ESCROW, (await execChallenge("bob")).hash)];
    check("executing it returns exactly his 10 USDC", (await usdc.balanceOf(A.bob)) - bobBefore === 10_000_000n);
    r = await callRoute(R.actConfirm, "bob", { action: "claim-refund" }, { splitId: second.dbId });
    check("confirming marks his refund as claimed", r.status === 200 && !!db.split_members.find((m) => m.split_id === second.dbId && m.user_id === "bob").refunded_at, db.split_members);
    r = await callRoute(R.actChallenge, "bob", { action: "claim-refund" }, { splitId: second.dbId });
    check("claiming twice -> 409", r.status === 409 && /already claimed/.test(r.body.error), r);

    // ============================================================ expiry, and the old direct-transfer path
    receipt = await (await escrow.connect(S.alice).createSplit([A.bob], [7_000_000n], A.alice, "Third", 24)).wait();
    const third = await recordSplit(receipt, "e6");
    r = await callRoute(R.legacyPay, "bob", {}, { splitId: third.dbId });
    check("the old direct-pay route refuses an escrow split (it must not pay the creator directly)", r.status === 409 && /escrow/.test(r.body.error), r);
    r = await callRoute(R.transferChallenge, "bob", { kind: "split", splitId: third.dbId });
    check("the transfer challenge for a split refuses an escrow split, so no direct-transfer challenge is issued", r.status === 409 && /escrow/.test(r.body.error), r);
    await chain.increaseTime(25 * 3600);
    r = await callRoute(R.actChallenge, "bob", { action: "expire" }, { splitId: third.dbId });
    check("after the deadline any participant can expire it -> an expire(bytes32) challenge", r.status === 200 && last().abiFunctionSignature === "expire(bytes32)", r);
    world.execTxs = [at("x1", ESCROW, (await execChallenge("bob")).hash)];
    r = await callRoute(R.actConfirm, "bob", { action: "expire" }, { splitId: third.dbId });
    check("confirming the expiry marks it cancelled", r.status === 200 && db.splits.find((s) => s.id === third.dbId).status === "cancelled", r);
  } finally {
    await report(t);
  }
});
