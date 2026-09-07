// GoalPool v2 through the real routes: contributions pause while a withdrawal is pending (GP-1),
// approvals carry the recipient and amount (GP-3), and a time-locked exit means one absent member
// cannot freeze a pool (GP-2). Every challenge a route issues is executed on a local chain exactly
// as Circle would, so the calls are proven valid, and the DB is checked against what the chain did.
import { after, test } from "node:test";
import { callRoute, installFakes, load, makeChecker } from "./helpers/fakes.mjs";
import { ethers, foundryAvailable, SKIP_REASON, startChain } from "./helpers/chain.mjs";

const skip = foundryAvailable() ? false : SKIP_REASON;
const { db, world, reset } = installFakes();
const DAY = 86400;

let chain, POOL, USDC;
if (!skip) {
  chain = await startChain();
  after(() => chain.stop());
  USDC = await chain.deploy("MockUSDC.sol", "MockUSDC");
  POOL = await chain.deploy("GoalPool.sol", "GoalPool", USDC, 30 * DAY);
  Object.assign(process.env, { ARC_RPC_URL: chain.rpc, NEXT_PUBLIC_GOAL_POOL_CONTRACT: POOL, ARC_USDC_ADDRESS: USDC });
}
const { GOAL_POOL_ABI } = await load("lib/contracts/index.ts");
const routes = {
  contribute: await load("app/api/goals/[goalId]/contribute-challenge/route.ts"),
  approve: await load("app/api/goals/[goalId]/withdraw-approve-challenge/route.ts"),
  challenge: await load("app/api/goals/[goalId]/action-challenge/route.ts"),
  confirm: await load("app/api/goals/[goalId]/action-confirm/route.ts"),
};

test("goal actions", { skip }, async (t) => {
  const { check, report } = makeChecker();
  const names = ["alice", "bob", "carol"];
  const S = Object.fromEntries(names.map((n, i) => [n, chain.signers[i]]));
  const A = Object.fromEntries(names.map((n, i) => [n, chain.addresses[i]]));
  const pool = new ethers.Contract(POOL, GOAL_POOL_ABI, chain.provider);
  const usdc = new ethers.Contract(USDC, ["function mint(address,uint256)", "function approve(address,uint256)", "function balanceOf(address) view returns (uint256)"], chain.provider);

  for (const n of names) {
    await (await usdc.connect(S[n]).mint(A[n], 1_000_000_000n)).wait();
    await (await usdc.connect(S[n]).approve(POOL, ethers.MaxUint256)).wait();
  }
  const created = await (await pool.connect(S.alice).createGoal(Object.values(A), 1_000_000_000n, "Trip")).wait();
  const goalId = new ethers.Interface(GOAL_POOL_ABI).parseLog(created.logs[0]).args.goalId;
  await (await pool.connect(S.alice).contribute(goalId, 300_000_000n)).wait();
  await (await pool.connect(S.bob).contribute(goalId, 100_000_000n)).wait();

  reset();
  db.users = names.map((n) => ({ id: n, username: n, circle_wallet_id: "w-" + n, wallet_address: A[n] }));
  db.circle_goals = [{ id: "g1", circle_id: "c1", contract_goal_id: goalId, creator_id: "alice", status: "open", collected_usdc: 400, target_amount_usdc: 1000, description: "Trip", dissolve_at: null, dissolve_initiator_id: null }];
  db.goal_members = names.map((n) => ({ goal_id: "g1", user_id: n }));

  // The confirm routes look for the member's recent GoalPool transaction, then read the outcome from the chain.
  world.execTxs = [{ id: "exec-1", contractAddress: POOL, createDate: new Date().toISOString() }];

  const P = { goalId: "g1" };
  const last = () => world.challenges[world.challenges.length - 1];
  /** What Circle does after the PIN: run the challenge's exact call from the member's wallet. */
  const execChallenge = async (who) => {
    const c = last();
    const contract = new ethers.Contract(c.contractAddress, ["function " + c.abiFunctionSignature], S[who]);
    return (await contract[c.abiFunctionSignature.split("(")[0]](...c.abiParameters)).wait();
  };
  const goalRow = () => db.circle_goals[0];

  try {
    // ---- contributions pause while a withdrawal is pending (GP-1)
    let r = await callRoute(routes.contribute, "bob", { amountUsdc: 10 }, P);
    check("contribute-challenge with nothing pending -> the contribute step", r.status === 200 && r.body.step === "contribute" && last().abiFunctionSignature === "contribute(bytes32,uint256)", r);

    const requested = await (await pool.connect(S.alice).requestWithdrawal(goalId, A.alice)).wait();
    const wid = String(new ethers.Interface(GOAL_POOL_ABI).parseLog(requested.logs[0]).args.withdrawalId);
    let issued = world.challenges.length;
    r = await callRoute(routes.contribute, "bob", { amountUsdc: 10 }, P);
    check("contribute-challenge while a withdrawal is pending -> 409 and no challenge", r.status === 409 && /pending/.test(r.body.error) && world.challenges.length === issued, r);

    // ---- an approval names the recipient and amount (GP-3)
    const request = (recipientWallet) => ({ id: "w1", goal_id: "g1", contract_withdrawal_id: wid, amount_usdc: 400, status: "pending", requested_by: "alice", recipient: { wallet_address: recipientWallet } });
    db.goal_withdrawal_requests = [request(A.alice)];
    r = await callRoute(routes.approve, "bob", {}, P);
    check("approve-challenge -> approveWithdrawal(id, recipient, amount) with the request's own recipient and amount",
      r.status === 200 && last().abiFunctionSignature === "approveWithdrawal(uint256,address,uint256)" && last().abiParameters[0] === wid && last().abiParameters[1].toLowerCase() === A.alice.toLowerCase() && last().abiParameters[2] === "400000000", last());
    await execChallenge("bob");
    check("executing that challenge on-chain succeeds (2 of 3 approvals)", (await pool.getWithdrawal(wid)).approvalCount === 2n);

    db.goal_withdrawal_requests = [request(A.carol)]; // the DB claims a different recipient than the chain
    issued = world.challenges.length;
    r = await callRoute(routes.approve, "carol", {}, P);
    check("approve-challenge when the DB recipient differs from the chain -> 409 and no challenge", r.status === 409 && world.challenges.length === issued, r);
    let reverted = false;
    try { await pool.connect(S.carol).approveWithdrawal(wid, A.carol, 400_000_000n); } catch { reverted = true; }
    check("and the contract itself rejects an approval that names the wrong recipient", reverted);
    db.goal_withdrawal_requests = [request(A.alice)];

    // ---- cancelling your own request
    r = await callRoute(routes.challenge, "bob", { action: "cancel-withdrawal" }, P);
    check("cancel-withdrawal by someone other than the requester -> 409", r.status === 409, r);
    r = await callRoute(routes.confirm, "alice", { action: "cancel-withdrawal" }, P);
    check("forged confirm (cancel-withdrawal) before it happened on-chain -> 409, DB untouched", r.status === 409 && db.goal_withdrawal_requests[0].status === "pending", r);
    r = await callRoute(routes.challenge, "alice", { action: "cancel-withdrawal" }, P);
    check("the requester gets a cancelWithdrawalRequest(uint256) challenge for the request id", r.status === 200 && last().abiFunctionSignature === "cancelWithdrawalRequest(uint256)" && last().abiParameters[0] === wid, r);
    await execChallenge("alice");
    r = await callRoute(routes.confirm, "alice", { action: "cancel-withdrawal" }, P);
    check("once cancelled on-chain, confirm -> 200 and the DB request is cancelled", r.status === 200 && db.goal_withdrawal_requests[0].status === "cancelled", r);
    r = await callRoute(routes.contribute, "bob", { amountUsdc: 10 }, P);
    check("contributions resume once the request is cancelled", r.status === 200 && r.body.step === "contribute", r);

    // ---- time-locked exit (GP-2)
    r = await callRoute(routes.confirm, "carol", { action: "start-exit" }, P);
    check("forged confirm (start-exit) with no countdown on-chain -> 409, DB untouched", r.status === 409 && goalRow().dissolve_at === null, r);
    r = await callRoute(routes.challenge, "carol", { action: "start-exit" }, P);
    check("start-exit -> a startExit(bytes32) challenge for the goal id", r.status === 200 && last().abiFunctionSignature === "startExit(bytes32)" && last().abiParameters[0] === goalId, r);
    await execChallenge("carol");
    r = await callRoute(routes.confirm, "carol", { action: "start-exit" }, P);
    const [exitAt] = await pool.exitOf(goalId);
    check("confirm records the chain's exit time and the initiator in the DB",
      r.status === 200 && goalRow().dissolve_at === new Date(Number(exitAt) * 1000).toISOString() && goalRow().dissolve_initiator_id === "carol", goalRow());
    issued = world.challenges.length;
    r = await callRoute(routes.challenge, "bob", { action: "start-exit" }, P);
    check("a second start-exit -> 409 and no challenge", r.status === 409 && /already running/.test(r.body.error) && world.challenges.length === issued, r);
    r = await callRoute(routes.challenge, "bob", { action: "cancel-exit" }, P);
    check("cancel-exit by a member who did not start it -> 409", r.status === 409 && /started the countdown/.test(r.body.error), r);
    r = await callRoute(routes.challenge, "alice", { action: "dissolve" }, P);
    check("dissolve before the countdown ends -> 409", r.status === 409 && /not finished/.test(r.body.error), r);

    await chain.increaseTime(30 * DAY + 5);

    r = await callRoute(routes.challenge, "alice", { action: "dissolve" }, P);
    check("after 30 days, dissolve -> a dissolve(bytes32) challenge", r.status === 200 && last().abiFunctionSignature === "dissolve(bytes32)", r);
    db.goal_withdrawal_requests.push({ ...request(A.alice), id: "w2" }); // a request still pending in the DB when the goal is dissolved
    await execChallenge("alice");
    r = await callRoute(routes.confirm, "alice", { action: "dissolve" }, P);
    check("confirm marks the goal cancelled and cancels the request that was pending", r.status === 200 && goalRow().status === "cancelled" && db.goal_withdrawal_requests.find((w) => w.id === "w2").status === "cancelled", { goal: goalRow(), w: db.goal_withdrawal_requests });
    r = await callRoute(routes.contribute, "bob", { amountUsdc: 10 }, P);
    check("contributing to a dissolved goal is refused (409)", r.status === 409 && /cancelled|no longer open/.test(r.body.error), r);

    // ---- refunds
    r = await callRoute(routes.challenge, "carol", { action: "claim-refund" }, P);
    check("a member who contributed nothing has nothing to claim -> 409", r.status === 409 && /nothing to claim/.test(r.body.error), r);
    const aliceBefore = await usdc.balanceOf(A.alice);
    r = await callRoute(routes.challenge, "alice", { action: "claim-refund" }, P);
    check("alice gets a claimRefund(bytes32) challenge", r.status === 200 && last().abiFunctionSignature === "claimRefund(bytes32)", r);
    await execChallenge("alice");
    check("executing it returns exactly her 300 USDC", (await usdc.balanceOf(A.alice)) - aliceBefore === 300_000_000n);
    r = await callRoute(routes.confirm, "alice", { action: "claim-refund" }, P);
    check("claim-refund confirm -> 200", r.status === 200, r);
    r = await callRoute(routes.challenge, "alice", { action: "claim-refund" }, P);
    check("claiming twice -> 409", r.status === 409, r);
    r = await callRoute(routes.challenge, "bob", { action: "claim-refund" }, P);
    await execChallenge("bob");
    check("bob claims his share and the pool ends empty", r.status === 200 && (await usdc.balanceOf(POOL)) === 0n, r);

    r = await callRoute(routes.challenge, "alice", { action: "drain-everything" }, P);
    check("an unknown action -> 400", r.status === 400, r);
  } finally {
    await report(t);
  }
});
