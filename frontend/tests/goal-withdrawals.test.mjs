// A member must not be able to get the others to approve a payout they were not shown (audit
// finding A-1). The approval screen renders what the DB stores, and approveWithdrawal (before v2)
// carried no recipient or amount, so the withdrawal routes have to record what the CHAIN says and
// refuse anything else. These run the real routes against a local GoalPool.
import { after, test } from "node:test";
import { callRoute, installFakes, load, makeChecker } from "./helpers/fakes.mjs";
import { ethers, foundryAvailable, SKIP_REASON, startChain } from "./helpers/chain.mjs";

const skip = foundryAvailable() ? false : SKIP_REASON;
const { db, world, reset } = installFakes();

let chain, POOL, USDC;
if (!skip) {
  chain = await startChain();
  after(() => chain.stop());
  USDC = await chain.deploy("MockUSDC.sol", "MockUSDC");
  POOL = await chain.deploy("GoalPool.sol", "GoalPool", USDC, 30 * 86400);
  Object.assign(process.env, { ARC_RPC_URL: chain.rpc, NEXT_PUBLIC_GOAL_POOL_CONTRACT: POOL, ARC_USDC_ADDRESS: USDC });
}
const { GOAL_POOL_ABI } = await load("lib/contracts/index.ts");
const requestConfirm = await load("app/api/goals/[goalId]/withdraw-request-confirm/route.ts");
const approveConfirm = await load("app/api/goals/[goalId]/withdraw-approve-confirm/route.ts");

test("withdrawal confirms record what the chain says", { skip }, async (t) => {
  const { check, report } = makeChecker();
  const names = ["alice", "bob", "carol", "dave"]; // carol is the malicious member; dave is her accomplice
  const S = Object.fromEntries(names.map((n, i) => [n, chain.signers[i]]));
  const A = Object.fromEntries(names.map((n, i) => [n, chain.addresses[i]]));
  const iface = new ethers.Interface(GOAL_POOL_ABI);
  const pool = new ethers.Contract(POOL, GOAL_POOL_ABI, chain.provider);
  const usdc = new ethers.Contract(USDC, ["function mint(address,uint256)", "function approve(address,uint256)", "function balanceOf(address) view returns (uint256)"], chain.provider);
  for (const n of ["alice", "bob", "carol"]) {
    await (await usdc.connect(S[n]).mint(A[n], 1_000_000_000n)).wait();
    await (await usdc.connect(S[n]).approve(POOL, ethers.MaxUint256)).wait();
  }
  const created = await (await pool.connect(S.alice).createGoal([A.alice, A.bob, A.carol], 1_000_000_000n, "Trip")).wait();
  const goalId = iface.parseLog(created.logs[0]).args.goalId;
  await (await pool.connect(S.alice).contribute(goalId, 300_000_000n)).wait();
  await (await pool.connect(S.bob).contribute(goalId, 100_000_000n)).wait();

  reset();
  db.users = names.map((n) => ({ id: n, username: n, circle_wallet_id: "w-" + n, wallet_address: A[n] }));
  // The DB's running total has drifted far from the chain's 400; the recorded amount must still be the chain's.
  db.circle_goals = [{ id: "g1", circle_id: "c1", contract_goal_id: goalId, creator_id: "alice", status: "open", collected_usdc: 999999, target_amount_usdc: 1000, description: "Trip" }];
  db.goal_members = ["alice", "bob", "carol"].map((u) => ({ goal_id: "g1", user_id: u }));
  const P = { goalId: "g1" };
  const exec = (id, hash) => ({ id, contractAddress: POOL, txHash: hash, createDate: new Date().toISOString() });
  const requestOnChain = async (who, recipient) => {
    const receipt = await (await pool.connect(S[who]).requestWithdrawal(goalId, recipient)).wait();
    world.execTxs = [exec("req-" + who, receipt.hash)];
    return String(iface.parseLog(receipt.logs.find((l) => l.topics[0] === iface.getEvent("WithdrawalRequested").topicHash)).args.withdrawalId);
  };

  try {
    // ---- a request is recorded only if the chain agrees with it
    const first = await requestOnChain("alice", A.alice);
    let r = await callRoute(requestConfirm, "bob", { recipientUsername: "alice" }, P);
    check("bob cannot confirm a request that alice made -> 409 and nothing recorded", r.status === 409 && (db.goal_withdrawal_requests ?? []).length === 0, r);
    await (await pool.connect(S.alice).cancelWithdrawalRequest(first)).wait();

    const wid = await requestOnChain("carol", A.dave); // on-chain the payout goes to dave
    r = await callRoute(requestConfirm, "carol", { recipientUsername: "bob" }, P); // carol tells the DB it goes to bob
    check("a request whose on-chain recipient differs from the one claimed -> 409 and nothing recorded (the original exploit)", r.status === 409 && db.goal_withdrawal_requests.length === 0, r);

    r = await callRoute(requestConfirm, "carol", { recipientUsername: "dave" }, P);
    const row = db.goal_withdrawal_requests[0];
    check("the honest confirm is recorded", r.status === 200 && db.goal_withdrawal_requests.length === 1 && row.contract_withdrawal_id === wid && row.recipient_user_id === "dave" && row.status === "pending", { r, row });
    check("and the amount recorded is the chain's 400, not the DB's drifted 999999", row?.amount_usdc === 400, row);

    // ---- an approval is recorded only if it exists on-chain
    world.execTxs = [exec("appr-bob", "0x" + "00".repeat(32))];
    r = await callRoute(approveConfirm, "bob", {}, P);
    check("a confirm for an approval that never happened on-chain -> 409 and no approval row for that member", r.status === 409 && /not found on-chain/.test(r.body.error) && !db.goal_withdrawal_approvals.some((a) => a.user_id === "bob"), { r, approvals: db.goal_withdrawal_approvals });

    await (await pool.connect(S.bob).approveWithdrawal(wid, A.dave, 400_000_000n)).wait();
    r = await callRoute(approveConfirm, "bob", {}, P);
    check("after bob approves on-chain, his confirm is recorded and the withdrawal is not yet executed", r.status === 200 && r.body.executed === false && db.goal_withdrawal_approvals.some((a) => a.user_id === "bob"), r);
    check("the request is still pending", db.goal_withdrawal_requests[0].status === "pending");

    // ---- the last approval executes it, and the record comes from the chain
    const daveBefore = await usdc.balanceOf(A.dave);
    await (await pool.connect(S.alice).approveWithdrawal(wid, A.dave, 400_000_000n)).wait();
    r = await callRoute(approveConfirm, "alice", {}, P);
    check("the final approval is recorded as executed", r.status === 200 && r.body.executed === true, r);
    check("the pool paid dave the 400", (await usdc.balanceOf(A.dave)) - daveBefore === 400_000_000n);
    check("the request is marked executed and the goal withdrawn", db.goal_withdrawal_requests[0].status === "executed" && db.circle_goals[0].status === "withdrawn", { w: db.goal_withdrawal_requests[0], g: db.circle_goals[0] });
    const payout = db.payments.find((p) => p.from_user_id === null);
    check("a payment record is written for the payout, with no sender and the chain's amount", payout?.to_user_id === "dave" && payout?.amount_usdc === 400 && payout?.status === "completed", payout);
    check("dave is told he received a payment", db.activity.some((a) => a.user_id === "dave" && a.type === "payment_received"), db.activity);
  } finally {
    await report(t);
  }
});
