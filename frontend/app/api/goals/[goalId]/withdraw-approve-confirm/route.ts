import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { resolveAndVerifyRecentContractExecution } from "@/lib/circle/wallets";
import { getGoalForMember, goalPoolAddress, readWithdrawal, WITHDRAWAL_STATUS } from "@/lib/server/goals";
import { getGoalPoolContract } from "@/lib/contracts";
import { recordActivity } from "@/lib/server/activity";

/**
 * POST /api/goals/[goalId]/withdraw-approve-confirm
 * If this was the final approval needed, the contract auto-executes the
 * withdrawal in the same transaction. Both facts are read from the contract
 * (this member's approval, and whether the withdrawal executed) rather than
 * inferred from whichever recent transaction Circle happens to return.
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
    .select("*")
    .eq("goal_id", goalId)
    .eq("status", "pending")
    .maybeSingle();
  if (!withdrawal) return NextResponse.json({ error: "No pending withdrawal request" }, { status: 404 });

  try {
    if (!user.wallet_address || !withdrawal.contract_withdrawal_id) {
      return NextResponse.json({ error: "Wallet or withdrawal is not confirmed on-chain" }, { status: 409 });
    }

    const { txHash } = await resolveAndVerifyRecentContractExecution({
      userId: user.id,
      walletId: user.circle_wallet_id,
      contractAddress: goalPoolAddress(),
    });

    const goalPool = getGoalPoolContract();
    const approvedOnChain: boolean = await goalPool.hasApprovedWithdrawal(
      withdrawal.contract_withdrawal_id,
      user.wallet_address
    );
    if (!approvedOnChain) {
      return NextResponse.json({ error: "Your approval was not found on-chain" }, { status: 409 });
    }

    await admin
      .from("goal_withdrawal_approvals")
      .insert({ withdrawal_id: withdrawal.id, user_id: user.id });

    const onChain = await readWithdrawal(withdrawal.contract_withdrawal_id);
    const executed = onChain.status === WITHDRAWAL_STATUS.Executed;

    if (executed) {
      await admin
        .from("goal_withdrawal_requests")
        .update({ status: "executed", tx_hash: txHash })
        .eq("id", withdrawal.id);
      await admin.from("circle_goals").update({ status: "withdrawn" }).eq("id", goalId);
      await admin.from("payments").insert({
        from_user_id: null,
        to_user_id: withdrawal.recipient_user_id,
        amount_usdc: withdrawal.amount_usdc,
        note: found.goal.description,
        source_chain: "ARC",
        tx_hash: txHash,
        status: "completed",
        circle_id: found.goal.circle_id,
      });
      await recordActivity([
        ...found.memberIds
          .filter((id) => id !== withdrawal.recipient_user_id)
          .map((memberId) => ({
            user_id: memberId,
            type: "goal_withdrawn" as const,
            reference_id: goalId,
            actor_id: user.id,
            amount_usdc: withdrawal.amount_usdc,
            note: found.goal.description,
          })),
        {
          user_id: withdrawal.recipient_user_id,
          type: "payment_received" as const,
          reference_id: goalId,
          actor_id: null,
          amount_usdc: withdrawal.amount_usdc,
          note: found.goal.description,
        },
      ]);
    }

    return NextResponse.json({ executed });
  } catch (e) {
    console.error("Withdrawal approval confirmation failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not confirm approval" },
      { status: 502 }
    );
  }
}
