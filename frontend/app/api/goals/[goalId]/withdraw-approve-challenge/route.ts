import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { createContractExecutionChallenge, getCircleUserToken } from "@/lib/circle/wallets";
import { getGoalForMember, goalPoolAddress, readWithdrawal, withdrawalMismatch } from "@/lib/server/goals";

/**
 * POST /api/goals/[goalId]/withdraw-approve-challenge - approve the goal's current pending withdrawal.
 *
 * approveWithdrawal(id) has no recipient or amount argument, so before
 * handing out a challenge we read the withdrawal from the contract and
 * refuse unless its recipient and amount are exactly what this member is
 * being shown. A mismatch means the DB record was not derived from the chain.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ goalId: string }> }
) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.circle_wallet_id) {
    return NextResponse.json({ error: "Wallet not set up yet" }, { status: 400 });
  }

  const { goalId } = await params;
  const found = await getGoalForMember(goalId, user.id);
  if (!found) return NextResponse.json({ error: "Goal not found or not a member" }, { status: 404 });

  const admin = getSupabaseAdmin();
  const { data: withdrawal } = await admin
    .from("goal_withdrawal_requests")
    .select(
      "id, contract_withdrawal_id, amount_usdc, recipient:users!goal_withdrawal_requests_recipient_user_id_fkey(wallet_address)"
    )
    .eq("goal_id", goalId)
    .eq("status", "pending")
    .maybeSingle();
  if (!withdrawal) return NextResponse.json({ error: "No pending withdrawal request" }, { status: 404 });

  const { data: already } = await admin
    .from("goal_withdrawal_approvals")
    .select("user_id")
    .eq("withdrawal_id", withdrawal.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (already) return NextResponse.json({ error: "You already approved this" }, { status: 409 });

  const recipientAddress = (withdrawal.recipient as unknown as { wallet_address: string | null } | null)
    ?.wallet_address;
  if (!recipientAddress || !found.goal.contract_goal_id || !withdrawal.contract_withdrawal_id) {
    return NextResponse.json({ error: "This request is not confirmed on-chain" }, { status: 409 });
  }

  try {
    const onChain = await readWithdrawal(withdrawal.contract_withdrawal_id as string);
    const mismatch = withdrawalMismatch(onChain, {
      contractGoalId: found.goal.contract_goal_id,
      recipientAddress,
      amountUsdc: withdrawal.amount_usdc,
    });
    if (mismatch) {
      console.error("Refusing withdrawal approval:", mismatch, { goalId, withdrawalId: withdrawal.id });
      return NextResponse.json({ error: mismatch }, { status: 409 });
    }

    const { userToken, encryptionKey } = await getCircleUserToken(user.id);
    const { challengeId } = await createContractExecutionChallenge({
      userToken,
      walletId: user.circle_wallet_id,
      contractAddress: goalPoolAddress(),
      abiFunctionSignature: "approveWithdrawal(uint256)",
      abiParameters: [withdrawal.contract_withdrawal_id as string],
    });
    return NextResponse.json({ userToken, encryptionKey, challengeId });
  } catch (e) {
    console.error("Withdrawal approval challenge failed:", e);
    return NextResponse.json({ error: "Could not start approval" }, { status: 502 });
  }
}
