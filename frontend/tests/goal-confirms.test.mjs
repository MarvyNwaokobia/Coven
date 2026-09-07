// The goal confirm routes record what the chain says, not what the request says (audit finding A-3):
// create-confirm takes the target, description and members from the contract and refuses outsiders;
// contribute-confirm takes the amount and running total from the contract and cannot be replayed or
// used to claim someone else's contribution.
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
const createConfirm = await load("app/api/goals/create-confirm/route.ts");
const contributeConfirm = await load("app/api/goals/[goalId]/contribute-confirm/route.ts");

test("goal confirms record only what the chain says", { skip }, async (t) => {
  const { check, report } = makeChecker();
  const names = ["alice", "bob", "carol", "eve"]; // eve is not in the circle
  const S = Object.fromEntries(names.map((n, i) => [n, chain.signers[i]]));
  const A = Object.fromEntries(names.map((n, i) => [n, chain.addresses[i]]));
  const iface = new ethers.Interface(GOAL_POOL_ABI);
  const pool = new ethers.Contract(POOL, GOAL_POOL_ABI, chain.provider);
  const usdc = new ethers.Contract(USDC, ["function mint(address,uint256)", "function approve(address,uint256)"], chain.provider);
  for (const n of names) {
    await (await usdc.connect(S[n]).mint(A[n], 10_000_000_000n)).wait();
    await (await usdc.connect(S[n]).approve(POOL, ethers.MaxUint256)).wait();
  }

  reset();
  db.users = names.map((n) => ({ id: n, username: n, circle_wallet_id: "w-" + n, wallet_address: A[n] }));
  db.circle_members = ["alice", "bob", "carol"].map((u) => ({ circle_id: "c1", user_id: u }));
  const exec = (id, hash) => ({ id, contractAddress: POOL, txHash: hash, createDate: new Date().toISOString() });
  const goalIdOf = (receipt) => iface.parseLog(receipt.logs[0]).args.goalId;

  try {
    // ============================================================ create-confirm
    let receipt = await (await pool.connect(S.alice).createGoal([A.alice, A.bob, A.carol], 1_000_000_000n, "Trip")).wait();
    const G1 = goalIdOf(receipt);
    world.execTxs = [exec("e1", receipt.hash)];
    let r = await callRoute(createConfirm, "alice", { circleId: "c1", memberUsernames: ["eve"], targetAmountUsdc: 999999, description: "FAKE" });
    const goal = db.circle_goals[0];
    check("create-confirm records the goal", r.status === 200 && db.circle_goals.length === 1, r);
    check("the target and description come from the chain (1000, Trip), not the request (999999, FAKE)", goal?.target_amount_usdc === 1000 && goal?.description === "Trip" && goal?.contract_goal_id === G1, goal);
    check("the members come from the chain (alice, bob, carol), not the request (eve)", JSON.stringify(db.goal_members.map((m) => m.user_id).sort()) === JSON.stringify(["alice", "bob", "carol"]), db.goal_members);
    check("only the other members are notified, with the chain's target", db.activity.length === 2 && db.activity.every((a) => a.user_id !== "alice" && a.user_id !== "eve" && a.amount_usdc === 1000), db.activity);
    r = await callRoute(createConfirm, "alice", { circleId: "c1" });
    check("replaying the same creation is refused and leaves one goal", r.status !== 200 && db.circle_goals.length === 1, r);

    receipt = await (await pool.connect(S.alice).createGoal([A.alice, A.eve], 5_000_000n, "With an outsider")).wait();
    world.execTxs = [exec("e2", receipt.hash)];
    r = await callRoute(createConfirm, "alice", { circleId: "c1" });
    check("an on-chain goal that includes a wallet outside the circle -> 409 and not recorded", r.status === 409 && /not a member of this circle/.test(r.body.error) && db.circle_goals.length === 1, r);

    receipt = await (await pool.connect(S.alice).createGoal([A.alice, A.bob], 5_000_000n, "Alice made this")).wait();
    world.execTxs = [exec("e3", receipt.hash)];
    r = await callRoute(createConfirm, "bob", { circleId: "c1" });
    check("bob cannot claim a goal that alice created -> 409", r.status === 409 && /not created by your wallet/.test(r.body.error) && db.circle_goals.length === 1, r);
    r = await callRoute(createConfirm, "eve", { circleId: "c1" });
    check("someone outside the circle cannot record a goal into it -> 403", r.status === 403, r);

    // ============================================================ contribute-confirm
    db.circle_goals = [{ id: "g1", circle_id: "c1", contract_goal_id: G1, creator_id: "alice", target_amount_usdc: 1000, collected_usdc: 0, description: "Trip", status: "open" }];
    db.goal_members = ["alice", "bob", "carol"].map((u) => ({ goal_id: "g1", user_id: u }));
    db.goal_contributions = [];
    db.activity = [];
    const P = { goalId: "g1" };

    const c1 = await (await pool.connect(S.alice).contribute(G1, 300_000_000n)).wait();
    world.execTxs = [exec("x1", c1.hash)];
    r = await callRoute(contributeConfirm, "alice", { step: "contribute", amountUsdc: 999999 }, P);
    check("contribute-confirm records the contribution", r.status === 200 && db.goal_contributions.length === 1, r);
    check("the amount is the on-chain 300, not the requested 999999", db.goal_contributions[0]?.amount_usdc === 300, db.goal_contributions);
    check("the goal total is read from the contract (300)", db.circle_goals[0].collected_usdc === 300, db.circle_goals[0]);
    r = await callRoute(contributeConfirm, "alice", { step: "contribute", amountUsdc: 999999 }, P);
    check("replaying it is refused; still one row and a total of 300 (it used to add the claimed amount every time)", r.status !== 200 && db.goal_contributions.length === 1 && db.circle_goals[0].collected_usdc === 300, r);

    const c2 = await (await pool.connect(S.alice).contribute(G1, 50_000_000n)).wait();
    world.execTxs = [exec("x2", c2.hash)];
    const before = db.goal_contributions.length;
    r = await callRoute(contributeConfirm, "bob", { step: "contribute", amountUsdc: 50 }, P);
    check("bob cannot claim alice's contribution as his own -> 409 and nothing recorded", r.status === 409 && /not found on-chain/.test(r.body.error) && db.goal_contributions.length === before, r);

    const c3 = await (await pool.connect(S.alice).contribute(G1, 100_000_000n)).wait();
    world.execTxs = [exec("x3", c3.hash), exec("x2", c2.hash)]; // newest first: two contributions made before either was confirmed
    const first = await callRoute(contributeConfirm, "alice", { step: "contribute" }, P);
    const second = await callRoute(contributeConfirm, "alice", { step: "contribute" }, P);
    const amounts = db.goal_contributions.map((c) => c.amount_usdc).sort((a, b) => a - b);
    check("two contributions made before either was confirmed are both recorded, once each", first.status === 200 && second.status === 200 && JSON.stringify(amounts) === JSON.stringify([50, 100, 300]), { amounts });
    check("and the DB total matches the chain (450)", db.circle_goals[0].collected_usdc === 450 && (await pool.getGoal(G1))[2] === 450_000_000n, db.circle_goals[0]);
    r = await callRoute(contributeConfirm, "alice", { step: "contribute" }, P);
    check("a third confirm is refused", r.status !== 200 && db.goal_contributions.length === 3, r);
  } finally {
    await report(t);
  }
});
