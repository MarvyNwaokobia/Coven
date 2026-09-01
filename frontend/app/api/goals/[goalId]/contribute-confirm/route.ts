import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { resolveAndVerifyRecentContractExecution } from "@/lib/circle/wallets";
import { fromUsdcUnits } from "@/lib/contracts";
import { getGoalForMember, goalPoolAddress, parseEventFromTx, readGoalState, sameAddress } from "@/lib/server/goals";
import { recordActivity } from "@/lib/server/activity";
import { isUniqueViolation } from "@/lib/server/payments";

const CONTRIBUTED_EVENT =
  "event Contributed(bytes32 indexed goalId, address indexed member, uint256 amount, uint256 totalCollected)";

type ContributedArgs = { goalId: string; member: string; amount: bigint; totalCollected: bigint };

async function contributionHashRecorded(txHash: string): Promise<boolean> {
  const { data } = await getSupabaseAdmin().from("goal_contributions").select("id").eq("tx_hash", txHash).maybeSingle();
  return Boolean(data);
}

/**
 * POST /api/goals/[goalId]/contribute-confirm
 * body: { step: "approve" | "contribute" }
 * Call after the client approves the PIN challenge from contribute-challenge.
 * An "approve" step just confirms the allowance transaction settled - the
 * client should immediately call contribute-challenge again to get the
 * real contribute() challenge. A "contribute" step records the contribution.
 *
 * The amount recorded is the one in the Contributed event, and the goal's
 * running total is read from the contract, so nothing in the request body
 * can inflate either. Each transaction is recorded once (unique tx_hash).
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
  const { step } = await req.json();
  if (step !== "approve" && step !== "contribute") {
    return NextResponse.json({ error: "step must be approve or contribute" }, { status: 400 });
  }

  const found = await getGoalForMember(goalId, user.id);
  if (!found) return NextResponse.json({ error: "Goal not found or not a member" }, { status: 404 });
  if (!found.goal.contract_goal_id) {
    return NextResponse.json({ error: "Goal is not yet confirmed on-chain" }, { status: 409 });
  }

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
      requireHash: true,
      isRecorded: contributionHashRecorded,
    });

    const event = await parseEventFromTx<ContributedArgs>(txHash as string, CONTRIBUTED_EVENT, "Contributed");
    if (
      !event ||
      event.goalId.toLowerCase() !== found.goal.contract_goal_id.toLowerCase() ||
      !sameAddress(event.member, user.wallet_address)
    ) {
      return NextResponse.json({ error: "Your contribution was not found on-chain" }, { status: 409 });
    }
    const amount = fromUsdcUnits(event.amount);

    const admin = getSupabaseAdmin();
    const { data: contribution, error } = await admin
      .from("goal_contributions")
      .insert({ goal_id: goalId, user_id: user.id, amount_usdc: amount, tx_hash: txHash })
      .select()
      .single();
    if (error) {
      if (isUniqueViolation(error)) {
        return NextResponse.json({ error: "This contribution has already been recorded" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Absolute value from the contract, so it also self-heals if an earlier confirm never arrived.
    const chain = await readGoalState(found.goal.contract_goal_id);
    const newCollected = fromUsdcUnits(chain.collected);

    const wasBelow = Number(found.goal.collected_usdc) < Number(found.goal.target_amount_usdc);
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
