import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase";
import { createContractExecutionChallenge, getCircleUserToken, getUsdcAllowance } from "@/lib/circle/wallets";
import { getGoalForMember, goalPoolAddress, usdcBaseUnits } from "@/lib/server/goals";

const MAX_UINT256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935";

/**
 * POST /api/goals/[goalId]/contribute-challenge - body: { amountUsdc }
 * Contributions call the GoalPool contract directly (funds must sit in
 * escrow, not a wallet anyone can unilaterally drain), so this is a
 * two-step contract-execution flow: an approve() first if allowance is
 * insufficient, then contribute() once it is. The client re-calls this
 * route after each step; `step` in the response tells it which challenge
 * it just got.
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
    const { userToken, encryptionKey } = await getCircleUserToken(user.id);
    const amountBase = usdcBaseUnits(amount);

    const allowance = await getUsdcAllowance(user.wallet_address, goalPoolAddress());
    if (allowance < BigInt(amountBase)) {
      const { challengeId } = await createContractExecutionChallenge({
        userToken,
        walletId: user.circle_wallet_id,
        contractAddress: process.env.ARC_USDC_ADDRESS!,
        abiFunctionSignature: "approve(address,uint256)",
        abiParameters: [goalPoolAddress(), MAX_UINT256],
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
