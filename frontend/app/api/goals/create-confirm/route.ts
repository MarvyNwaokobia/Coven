import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { resolveAndVerifyRecentContractExecution } from "@/lib/circle/wallets";
import { fromUsdcUnits, getGoalPoolContract } from "@/lib/contracts";
import { goalPoolAddress, parseEventFromTx, sameAddress } from "@/lib/server/goals";
import { recordActivity } from "@/lib/server/activity";
import { isUniqueViolation } from "@/lib/server/payments";

const GOAL_CREATED_EVENT =
  "event GoalCreated(bytes32 indexed goalId, address indexed creator, uint256 targetAmount, string description)";

type GoalCreatedArgs = { goalId: string; creator: string; targetAmount: bigint; description: string };

/**
 * POST /api/goals/create-confirm
 * body: { circleId }
 * Call after the client approves the PIN challenge from create-challenge -
 * verifies the createGoal transaction settled, then records the goal from
 * what the contract says: its id, creator, target, description and member
 * list. Only the circle is taken from the request, and every on-chain member
 * must belong to it, so a client cannot attach members, a target or a circle
 * that the chain does not back (or notify people who are not in the circle).
 */
export async function POST(req: Request) {
  const creator = await getAuthedUser(req);
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!creator.circle_wallet_id || !creator.wallet_address) {
    return NextResponse.json({ error: "Wallet not set up yet" }, { status: 400 });
  }

  const { circleId } = await req.json();
  if (!circleId) return NextResponse.json({ error: "circleId required" }, { status: 400 });

  const admin = getSupabaseAdmin();

  const { data: circleMembers } = await admin.from("circle_members").select("user_id").eq("circle_id", circleId);
  const circleMemberIds = (circleMembers ?? []).map((m) => m.user_id as string);
  if (!circleMemberIds.includes(creator.id)) {
    return NextResponse.json({ error: "Not a member of this circle" }, { status: 403 });
  }

  try {
    const { txHash } = await resolveAndVerifyRecentContractExecution({
      userId: creator.id,
      walletId: creator.circle_wallet_id,
      contractAddress: goalPoolAddress(),
      requireHash: true,
    });

    const event = await parseEventFromTx<GoalCreatedArgs>(txHash as string, GOAL_CREATED_EVENT, "GoalCreated");
    if (!event) {
      return NextResponse.json({ error: "Could not read the created goal from-chain" }, { status: 502 });
    }
    if (!sameAddress(event.creator, creator.wallet_address)) {
      return NextResponse.json({ error: "That goal was not created by your wallet" }, { status: 409 });
    }

    // Members come from the contract: each wallet must be a member of this circle.
    const onChainMembers: string[] = await getGoalPoolContract().getMembers(event.goalId);
    const { data: circleUsers } = await admin.from("users").select("id, wallet_address").in("id", circleMemberIds);
    const byWallet = new Map(
      (circleUsers ?? [])
        .filter((u) => u.wallet_address)
        .map((u) => [String(u.wallet_address).toLowerCase(), u.id as string])
    );
    const memberIds: string[] = [];
    for (const wallet of onChainMembers) {
      const id = byWallet.get(wallet.toLowerCase());
      if (!id) {
        return NextResponse.json(
          { error: "The on-chain goal includes a wallet that is not a member of this circle" },
          { status: 409 }
        );
      }
      memberIds.push(id);
    }
    if (!memberIds.includes(creator.id)) {
      return NextResponse.json({ error: "The goal does not include you as a member" }, { status: 409 });
    }

    const target = fromUsdcUnits(event.targetAmount);
    const { data: goal, error } = await admin
      .from("circle_goals")
      .insert({
        circle_id: circleId,
        contract_goal_id: event.goalId,
        creator_id: creator.id,
        target_amount_usdc: target,
        description: event.description,
        status: "open",
      })
      .select()
      .single();
    if (error) {
      if (isUniqueViolation(error)) {
        return NextResponse.json({ error: "This goal has already been recorded" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

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
          note: event.description,
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
