import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase";
import { createContractExecutionChallenge, getCircleUserToken, getUsdcAllowance } from "@/lib/circle/wallets";
import { getGoalForMember, goalPoolAddress, GOAL_STATUS, readGoalState, usdcBaseUnits } from "@/lib/server/goals";

/**
 * POST /api/goals/[goalId]/contribute-challenge - body: { amountUsdc }
 * Contributions call the GoalPool contract directly (funds must sit in
 * escrow, not a wallet anyone can unilaterally drain), so this is a
 * two-step contract-execution flow: an approve() for exactly this
 * contribution first if the allowance is short, then contribute() once it
 * is. Approving only the amount needed, rather than an unlimited amount,
 * means a bigger contribution later may ask for another approval, which is
 * the tradeoff for never leaving a standing allowance GoalPool could draw
 * on beyond what was actually approved for. The client re-calls this route
 * after each step; `step` in the response tells it which challenge it just
 * got.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ goalId: string }> }
) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.circle_wallet_id || !user.wallet_address) {
    return NextResponse.json({ error: "Wallet not set up yet" }, { status: 400 });
  }

  const { goalId } = await params;
  const { amountUsdc } = await req.json();
  const amount = Number(amountUsdc);
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "positive amountUsdc required" }, { status: 400 });
  }

  const found = await getGoalForMember(goalId, user.id);
  if (!found) return NextResponse.json({ error: "Goal not found or not a member" }, { status: 404 });
  if (found.goal.status !== "open") {
    return NextResponse.json({ error: `Goal is ${found.goal.status}` }, { status: 409 });
  }
  if (!found.goal.contract_goal_id) {
    return NextResponse.json({ error: "Goal is not yet confirmed on-chain" }, { status: 409 });
  }

  try {
    // GoalPool refuses contributions while a withdrawal is pending (they would be left behind
    // when the goal pays out), so say so here instead of after the member approves a PIN.
    const chain = await readGoalState(found.goal.contract_goal_id);
    if (chain.status !== GOAL_STATUS.Open) {
      return NextResponse.json({ error: "This goal is no longer open" }, { status: 409 });
    }
    if (chain.activeWithdrawalId !== BigInt(0)) {
      return NextResponse.json(
        { error: "A withdrawal is pending - contributions resume once it is paid out or cancelled" },
        { status: 409 }
      );
    }

    const { userToken, encryptionKey } = await getCircleUserToken(user.id);
    const amountBase = usdcBaseUnits(amount);

    const allowance = await getUsdcAllowance(user.wallet_address, goalPoolAddress());
    if (allowance < BigInt(amountBase)) {
      const { challengeId } = await createContractExecutionChallenge({
        userToken,
        walletId: user.circle_wallet_id,
        contractAddress: process.env.ARC_USDC_ADDRESS!,
        abiFunctionSignature: "approve(address,uint256)",
        abiParameters: [goalPoolAddress(), amountBase],
      });
      return NextResponse.json({ step: "approve", userToken, encryptionKey, challengeId });
    }

    const { challengeId } = await createContractExecutionChallenge({
      userToken,
      walletId: user.circle_wallet_id,
      contractAddress: goalPoolAddress(),
      abiFunctionSignature: "contribute(bytes32,uint256)",
      abiParameters: [found.goal.contract_goal_id, amountBase],
    });
    return NextResponse.json({ step: "contribute", userToken, encryptionKey, challengeId });
  } catch (e) {
    console.error("Contribution challenge failed:", e);
    return NextResponse.json({ error: "Could not start contribution" }, { status: 502 });
  }
}
