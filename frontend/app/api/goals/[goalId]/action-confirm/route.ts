import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { resolveAndVerifyRecentContractExecution } from "@/lib/circle/wallets";
import {
  getGoalForMember,
  goalPoolAddress,
  GOAL_STATUS,
  readGoalState,
  readWithdrawal,
  sameAddress,
  WITHDRAWAL_STATUS,
} from "@/lib/server/goals";
import { isGoalAction } from "@/lib/server/goal-actions";

/**
 * POST /api/goals/[goalId]/action-confirm - body: { action }
 * Call after the client completes the PIN challenge from action-challenge.
 * What happened is read back from GoalPool and the DB is updated from that,
 * never from the request, so replaying or forging a confirm cannot change
 * anything the chain does not already say.
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
    await resolveAndVerifyRecentContractExecution({
      userId: user.id,
      walletId: user.circle_wallet_id,
      contractAddress: goalPoolAddress(),
    });

    const admin = getSupabaseAdmin();
    const chain = await readGoalState(found.goal.contract_goal_id, user.wallet_address);
    const notOnChain = (what: string) =>
      NextResponse.json({ error: `${what} was not found on-chain` }, { status: 409 });

    switch (action) {
      case "start-exit": {
        if (chain.exitAt === 0 || !sameAddress(chain.exitInitiator, user.wallet_address)) {
          return notOnChain("Your exit request");
        }
        await admin
          .from("circle_goals")
          .update({ dissolve_at: new Date(chain.exitAt * 1000).toISOString(), dissolve_initiator_id: user.id })
          .eq("id", goalId);
        break;
      }

      case "cancel-exit": {
        if (chain.exitAt !== 0) return notOnChain("The cancellation");
        await admin.from("circle_goals").update({ dissolve_at: null, dissolve_initiator_id: null }).eq("id", goalId);
        break;
      }

      case "dissolve": {
        if (chain.status !== GOAL_STATUS.Cancelled) return notOnChain("The dissolution");
        await admin
          .from("circle_goals")
          .update({ status: "cancelled", dissolve_at: null, dissolve_initiator_id: null })
          .eq("id", goalId);
        // The contract cancels a pending withdrawal when it dissolves a goal.
        await admin
          .from("goal_withdrawal_requests")
          .update({ status: "cancelled" })
          .eq("goal_id", goalId)
          .eq("status", "pending");
        break;
      }

      case "claim-refund": {
        // Nothing to record: the refund is the chain's to track. Just confirm it landed.
        if (chain.status !== GOAL_STATUS.Cancelled || chain.contributionOfWallet !== BigInt(0)) {
          return notOnChain("Your refund");
        }
        break;
      }

      case "cancel-withdrawal": {
        const { data: pending } = await admin
          .from("goal_withdrawal_requests")
          .select("id, contract_withdrawal_id")
          .eq("goal_id", goalId)
          .eq("status", "pending")
          .maybeSingle();
        if (!pending?.contract_withdrawal_id) {
          return NextResponse.json({ error: "No pending withdrawal request" }, { status: 404 });
        }
        const onChain = await readWithdrawal(pending.contract_withdrawal_id);
        if (onChain.status !== WITHDRAWAL_STATUS.Cancelled) return notOnChain("The cancellation");
        await admin.from("goal_withdrawal_requests").update({ status: "cancelled" }).eq("id", pending.id);
        break;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Goal action confirmation failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not confirm this action" },
      { status: 502 }
    );
  }
}
