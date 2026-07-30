import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { resolveAndVerifyRecentContractExecution } from "@/lib/circle/wallets";
import { getGoalForMember, goalPoolAddress, parseEventFromTx } from "@/lib/server/goals";
import { recordActivity } from "@/lib/server/activity";

const WITHDRAWAL_REQUESTED_EVENT =
  "event WithdrawalRequested(uint256 indexed withdrawalId, bytes32 indexed goalId, address indexed requester, address recipient, uint256 amount)";
const WITHDRAWAL_EXECUTED_EVENT =
  "event WithdrawalExecuted(uint256 indexed withdrawalId, bytes32 indexed goalId, address recipient, uint256 amount)";

/**
 * POST /api/goals/[goalId]/withdraw-request-confirm — body: { recipientUsername }
 * A single-member goal (or any goal where the requester is the only
 * member) auto-executes on-chain in the same transaction — this checks
 * for both WithdrawalRequested and WithdrawalExecuted in the receipt.
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
  const { recipientUsername } = await req.json();

  const found = await getGoalForMember(goalId, user.id);
  if (!found) return NextResponse.json({ error: "Goal not found or not a member" }, { status: 404 });

  const admin = getSupabaseAdmin();
  const { data: recipient } = await admin
    .from("users")
    .select("id")
    .eq("username", String(recipientUsername).replace(/^@/, "").toLowerCase())
    .maybeSingle();
  if (!recipient) return NextResponse.json({ error: "Recipient not found" }, { status: 404 });

  try {
    const { txHash } = await resolveAndVerifyRecentContractExecution({
      userId: user.id,
      walletId: user.circle_wallet_id,
      contractAddress: goalPoolAddress(),
    });
    if (!txHash) {
      return NextResponse.json({ error: "Transaction has no hash yet — try again shortly" }, { status: 502 });
    }

    const requested = await parseEventFromTx<{ withdrawalId: bigint }>(
      txHash,
      WITHDRAWAL_REQUESTED_EVENT,
      "WithdrawalRequested"
    );
    if (!requested) {
      return NextResponse.json({ error: "Could not read the withdrawal request from-chain" }, { status: 502 });
    }
    const executed = await parseEventFromTx<{ withdrawalId: bigint }>(
      txHash,
      WITHDRAWAL_EXECUTED_EVENT,
      "WithdrawalExecuted"
    );

    const { data: withdrawal, error } = await admin
      .from("goal_withdrawal_requests")
      .insert({
        goal_id: goalId,
        contract_withdrawal_id: requested.withdrawalId.toString(),
        requested_by: user.id,
        recipient_user_id: recipient.id,
        amount_usdc: found.goal.collected_usdc,
        status: executed ? "executed" : "pending",
        tx_hash: executed ? txHash : null,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await admin
      .from("goal_withdrawal_approvals")
      .insert({ withdrawal_id: withdrawal.id, user_id: user.id });

    if (executed) {
      await admin
        .from("circle_goals")
        .update({ status: "withdrawn" })
        .eq("id", goalId);
      await admin.from("payments").insert({
        from_user_id: null,
        to_user_id: recipient.id,
        amount_usdc: found.goal.collected_usdc,
        note: found.goal.description,
        source_chain: "ARC",
        tx_hash: txHash,
        status: "completed",
        circle_id: found.goal.circle_id,
      });
      await recordActivity([
        ...found.memberIds
          .filter((id) => id !== recipient.id)
          .map((memberId) => ({
            user_id: memberId,
            type: "goal_withdrawn" as const,
            reference_id: goalId,
            actor_id: user.id,
            amount_usdc: found.goal.collected_usdc,
            note: found.goal.description,
          })),
        {
          // The recipient sees this as a real incoming payment, same as
          // any other transfer, rather than the group-wide notice.
          user_id: recipient.id,
          type: "payment_received" as const,
          reference_id: goalId,
          actor_id: null,
          amount_usdc: found.goal.collected_usdc,
          note: found.goal.description,
        },
      ]);
    } else {
      await recordActivity(
        found.memberIds
          .filter((id) => id !== user.id)
          .map((memberId) => ({
            user_id: memberId,
            type: "goal_withdrawal_requested" as const,
            reference_id: goalId,
            actor_id: user.id,
            amount_usdc: found.goal.collected_usdc,
            note: found.goal.description,
          }))
      );
    }

    return NextResponse.json({ withdrawal });
  } catch (e) {
    console.error("Withdrawal request confirmation failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not confirm withdrawal request" },
      { status: 502 }
    );
  }
}
