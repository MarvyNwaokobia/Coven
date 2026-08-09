import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { resolveAndVerifyRecentContractExecution } from "@/lib/circle/wallets";
import { goalPoolAddress, parseEventFromTx } from "@/lib/server/goals";
import { recordActivity } from "@/lib/server/activity";

/**
 * POST /api/goals/create-confirm
 * body: { circleId, memberUsernames: string[], targetAmountUsdc, description }
 * Call after the client approves the PIN challenge from create-challenge -
 * verifies the createGoal transaction settled, reads the real on-chain
 * goalId out of the GoalCreated event, and persists the goal.
 */
export async function POST(req: Request) {
  const creator = await getAuthedUser(req);
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!creator.circle_wallet_id) {
    return NextResponse.json({ error: "Wallet not set up yet" }, { status: 400 });
  }

  const { circleId, memberUsernames, targetAmountUsdc, description } = await req.json();
  const target = Number(targetAmountUsdc);
  if (!circleId || !description?.trim() || !target) {
    return NextResponse.json({ error: "circleId, description, targetAmountUsdc required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const cleaned: string[] = Array.isArray(memberUsernames)
    ? memberUsernames.map((u: string) => u.replace(/^@/, "").toLowerCase())
    : [];
  const { data: resolvedMembers } = await admin.from("users").select("id, username").in("username", cleaned);
  const memberIds = Array.from(new Set([creator.id, ...(resolvedMembers ?? []).map((m) => m.id)]));

  try {
    const { txHash } = await resolveAndVerifyRecentContractExecution({
      userId: creator.id,
      walletId: creator.circle_wallet_id,
      contractAddress: goalPoolAddress(),
    });
    if (!txHash) {
      return NextResponse.json({ error: "Transaction has no hash yet - try again shortly" }, { status: 502 });
    }

    const event = await parseEventFromTx<{ goalId: string }>(
      txHash,
      "event GoalCreated(bytes32 indexed goalId, address indexed creator, uint256 targetAmount, string description)",
      "GoalCreated"
    );
    if (!event) {
      return NextResponse.json({ error: "Could not read the created goal from-chain" }, { status: 502 });
    }

    const { data: goal, error } = await admin
      .from("circle_goals")
      .insert({
        circle_id: circleId,
        contract_goal_id: event.goalId,
        creator_id: creator.id,
        target_amount_usdc: target,
        description,
        status: "open",
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await admin.from("goal_members").insert(memberIds.map((user_id) => ({ goal_id: goal.id, user_id })));

    await recordActivity(
      memberIds
        .filter((id) => id !== creator.id)
        .map((user_id) => ({
          user_id,
          type: "goal_created" as const,
          reference_id: goal.id,
          actor_id: creator.id,
          amount_usdc: target,
          note: description,
        }))
    );

    return NextResponse.json({ goal });
  } catch (e) {
    console.error("Goal creation confirmation failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not confirm goal creation" },
      { status: 502 }
    );
  }
}
