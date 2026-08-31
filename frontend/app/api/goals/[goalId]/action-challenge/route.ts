import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { createContractExecutionChallenge, getCircleUserToken } from "@/lib/circle/wallets";
import { getGoalForMember, goalPoolAddress, readGoalState, readWithdrawal } from "@/lib/server/goals";
import { ACTION_SIGNATURE, actionBlockedReason, isGoalAction } from "@/lib/server/goal-actions";

/**
 * POST /api/goals/[goalId]/action-challenge - body: { action }
 * action: "start-exit" | "cancel-exit" | "dissolve" | "claim-refund" | "cancel-withdrawal"
 *
 * Starts a PIN challenge for one of the goal actions that is neither a
 * contribution nor an approval. The contract's own state decides whether the
 * action is allowed; nothing in the request body is trusted beyond which
 * action was asked for.
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
  const { action } = await req.json();
  if (!isGoalAction(action)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const found = await getGoalForMember(goalId, user.id);
  if (!found) return NextResponse.json({ error: "Goal not found or not a member" }, { status: 404 });
  if (!found.goal.contract_goal_id) {
    return NextResponse.json({ error: "Goal is not yet confirmed on-chain" }, { status: 409 });
  }

  try {
    const chain = await readGoalState(found.goal.contract_goal_id, user.wallet_address);

    let contractWithdrawalId: string | null = null;
    let onChainWithdrawal = null;
    if (action === "cancel-withdrawal") {
      const { data: pending } = await getSupabaseAdmin()
        .from("goal_withdrawal_requests")
        .select("contract_withdrawal_id")
        .eq("goal_id", goalId)
        .eq("status", "pending")
        .maybeSingle();
      contractWithdrawalId = pending?.contract_withdrawal_id ?? null;
      if (contractWithdrawalId) onChainWithdrawal = await readWithdrawal(contractWithdrawalId);
    }

    const blocked = actionBlockedReason(action, chain, user.wallet_address, onChainWithdrawal);
    if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });

    const { userToken, encryptionKey } = await getCircleUserToken(user.id);
    const { challengeId } = await createContractExecutionChallenge({
      userToken,
      walletId: user.circle_wallet_id,
      contractAddress: goalPoolAddress(),
      abiFunctionSignature: ACTION_SIGNATURE[action],
      abiParameters: [action === "cancel-withdrawal" ? (contractWithdrawalId as string) : found.goal.contract_goal_id],
    });
    return NextResponse.json({ userToken, encryptionKey, challengeId });
  } catch (e) {
    console.error("Goal action challenge failed:", e);
    return NextResponse.json({ error: "Could not start this action" }, { status: 502 });
  }
}
