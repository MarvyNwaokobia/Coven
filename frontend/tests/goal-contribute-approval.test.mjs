// Goal contributions approve only what the contribution actually needs, not an unlimited amount
// (so GoalPool is never left able to draw more than was approved for a given contribution). The
// tradeoff is that a later, larger contribution may need its own approval; this proves both halves
// against a real GoalPool: the exact-amount approve challenge, and the two-step flow completing.
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
const contributeChallenge = await load("app/api/goals/[goalId]/contribute-challenge/route.ts");
const contributeConfirm = await load("app/api/goals/[goalId]/contribute-confirm/route.ts");

test("contributions approve exactly what is needed, not an unlimited amount", { skip }, async (t) => {
  const { check, report } = makeChecker();
  const iface = new ethers.Interface(GOAL_POOL_ABI);
  const pool = new ethers.Contract(POOL, GOAL_POOL_ABI, chain.provider);
  const usdc = new ethers.Contract(USDC, ["function mint(address,uint256)", "function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)"], chain.provider);
  const alice = chain.signers[0], aliceAddress = chain.addresses[0];
  await (await usdc.connect(alice).mint(aliceAddress, 1_000_000_000n)).wait();

  const created = await (await pool.connect(alice).createGoal([aliceAddress], 1_000_000_000n, "Trip")).wait();
  const goalId = iface.parseLog(created.logs[0]).args.goalId;

  reset();
  db.users = [{ id: "alice", username: "alice", circle_wallet_id: "w-alice", wallet_address: aliceAddress }];
  db.circle_goals = [{ id: "g1", circle_id: "c1", contract_goal_id: goalId, creator_id: "alice", status: "open", collected_usdc: 0, target_amount_usdc: 1000, description: "Trip" }];
  db.goal_members = [{ goal_id: "g1", user_id: "alice" }];
  const P = { goalId: "g1" };
  const last = () => world.challenges[world.challenges.length - 1];
  const execChallenge = async () => {
    const c = last();
    const contract = new ethers.Contract(c.contractAddress, ["function " + c.abiFunctionSignature], alice);
    return (await contract[c.abiFunctionSignature.split("(")[0]](...c.abiParameters)).wait();
  };
  const execAt = (id, to, hash) => ({ id, contractAddress: to, txHash: hash, createDate: new Date().toISOString() });

  try {
    // ---- first contribution: no allowance yet, so an approve for exactly 100, not unlimited
    let r = await callRoute(contributeChallenge, "alice", { amountUsdc: 100 }, P);
    check("no allowance yet -> the approve step, for exactly 100 USDC (not MaxUint256)",
      r.status === 200 && r.body.step === "approve" && last().abiFunctionSignature === "approve(address,uint256)"
      && last().abiParameters[0].toLowerCase() === POOL.toLowerCase() && last().abiParameters[1] === "100000000", { r, c: last() });
    let receipt = await execChallenge();
    check("the allowance granted is exactly 100 USDC, nothing more", (await usdc.allowance(aliceAddress, POOL)) === 100_000_000n);
    world.execTxs = [execAt("a1", USDC, receipt.hash)];
    r = await callRoute(contributeConfirm, "alice", { step: "approve" }, P);
    check("confirming the approve step -> approved", r.status === 200 && r.body.approved === true, r);

    r = await callRoute(contributeChallenge, "alice", { amountUsdc: 100 }, P);
    check("now the allowance covers it -> straight to the contribute step", r.status === 200 && r.body.step === "contribute" && last().abiFunctionSignature === "contribute(bytes32,uint256)" && last().abiParameters[1] === "100000000", r);
    receipt = await execChallenge();
    world.execTxs = [execAt("c1", POOL, receipt.hash)];
    r = await callRoute(contributeConfirm, "alice", { step: "contribute" }, P);
    check("the contribution is recorded (100)", r.status === 200 && db.goal_contributions[0]?.amount_usdc === 100, r);
    check("the allowance is now spent, back to 0", (await usdc.allowance(aliceAddress, POOL)) === 0n);

    // ---- a second, larger contribution needs its own approval: no leftover unlimited allowance to draw on
    r = await callRoute(contributeChallenge, "alice", { amountUsdc: 250 }, P);
    check("a second, larger contribution needs its own approve step again (no standing unlimited allowance)",
      r.status === 200 && r.body.step === "approve" && last().abiParameters[1] === "250000000", r);
    receipt = await execChallenge();
    world.execTxs = [execAt("a2", USDC, receipt.hash)];
    await callRoute(contributeConfirm, "alice", { step: "approve" }, P);
    r = await callRoute(contributeChallenge, "alice", { amountUsdc: 250 }, P);
    receipt = await execChallenge();
    world.execTxs = [execAt("c2", POOL, receipt.hash)];
    r = await callRoute(contributeConfirm, "alice", { step: "contribute" }, P);
    check("the second contribution is recorded and the goal total reflects both (350)", r.status === 200 && r.body.collected === 350 && db.goal_contributions.length === 2, r);
  } finally {
    await report(t);
  }
});
