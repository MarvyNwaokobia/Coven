import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { resolveAndVerifyRecentContractExecution } from "@/lib/circle/wallets";
import { getGoalForMember, goalPoolAddress } from "@/lib/server/goals";
import { recordActivity } from "@/lib/server/activity";

/**
 * POST /api/goals/[goalId]/contribute-confirm
 * body: { amountUsdc, step: "approve" | "contribute" }
 * Call after the client approves the PIN challenge from contribute-challenge.
 * An "approve" step just confirms the allowance transaction settled — the
 * client should immediately call contribute-challenge again to get the
 * real contribute() challenge. A "contribute" step records the contribution.
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
  const { amountUsdc, step } = await req.json();
  const amount = Number(amountUsdc);
  if (!amount || amount <= 0 || (step !== "approve" && step !== "contribute")) {
    return NextResponse.json({ error: "positive amountUsdc and step required" }, { status: 400 });
  }

  const found = await getGoalForMember(goalId, user.id);
  if (!found) return NextResponse.json({ error: "Goal not found or not a member" }, { status: 404 });

  try {
    if (step === "approve") {
      await resolveAndVerifyRecentContractExecution({
        userId: user.id,
        walletId: user.circle_wallet_id,
        contractAddress: process.env.ARC_USDC_ADDRESS!,
      });
      return NextResponse.json({ approved: true });
    }

    const { txHash } = await resolveAndVerifyRecentContractExecution({
      userId: user.id,
      walletId: user.circle_wallet_id,
      contractAddress: goalPoolAddress(),
    });

    const admin = getSupabaseAdmin();
    const { data: contribution, error } = await admin
      .from("goal_contributions")
      .insert({ goal_id: goalId, user_id: user.id, amount_usdc: amount, tx_hash: txHash })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const wasBelow = Number(found.goal.collected_usdc) < Number(found.goal.target_amount_usdc);
    const newCollected = Number(found.goal.collected_usdc) + amount;
    const nowAtOrAbove = newCollected >= Number(found.goal.target_amount_usdc);

    await admin.from("circle_goals").update({ collected_usdc: newCollected }).eq("id", goalId);

    if (wasBelow && nowAtOrAbove) {
      await recordActivity(
        found.memberIds.map((memberId) => ({
          user_id: memberId,
          type: "goal_target_reached" as const,
          reference_id: goalId,
          actor_id: user.id,
          amount_usdc: newCollected,
          note: found.goal.description,
        }))
      );
    }

    return NextResponse.json({ contribution, collected: newCollected });
  } catch (e) {
    console.error("Contribution confirmation failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not confirm contribution" },
      { status: 502 }
    );
  }
}
