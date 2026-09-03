import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { resolveAndVerifyRecentContractExecution } from "@/lib/circle/wallets";
import { fromUsdcUnits } from "@/lib/contracts";
import { parseEventFromTx, sameAddress } from "@/lib/server/goals";
import { getSplitForParticipant, readSplitState, SPLIT_STATUS, splitEscrowAddress } from "@/lib/server/splits";
import { recordActivity } from "@/lib/server/activity";
import { isUniqueViolation, paymentHashRecorded } from "@/lib/server/payments";

const MEMBER_PAID_EVENT = "event MemberPaid(bytes32 indexed splitId, address indexed member, uint256 amount)";

type MemberPaidArgs = { splitId: string; member: string; amount: bigint };

/**
 * POST /api/splits/[splitId]/pay-confirm - body: { step: "approve" | "pay" }
 * An "approve" step just confirms the allowance transaction settled. A "pay" step records the
 * payment from the MemberPaid event (goal, member and amount all come from the chain) and reads
 * the split's collected total and status back from the contract. The payment stays `pending`
 * while the money sits in escrow and becomes `completed` when the contract releases it to the
 * creator, or `failed` if the split is cancelled or expires.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ splitId: string }> }
) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.circle_wallet_id || !user.wallet_address) {
    return NextResponse.json({ error: "Wallet not set up yet" }, { status: 400 });
  }

  const { splitId } = await params;
  const { step } = await req.json();
  if (step !== "approve" && step !== "pay") {
    return NextResponse.json({ error: "step must be approve or pay" }, { status: 400 });
  }

  const found = await getSplitForParticipant(splitId, user.id);
  if (!found || !found.isMember) {
    return NextResponse.json({ error: "Split not found or you do not owe a share" }, { status: 404 });
  }
  if (!found.split.contract_split_id) {
    return NextResponse.json({ error: "This split is not held in escrow" }, { status: 409 });
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
      contractAddress: splitEscrowAddress(),
      requireHash: true,
      isRecorded: paymentHashRecorded,
    });

    const event = await parseEventFromTx<MemberPaidArgs>(
      txHash as string,
      MEMBER_PAID_EVENT,
      "MemberPaid",
      splitEscrowAddress()
    );
    if (
      !event ||
      event.splitId.toLowerCase() !== found.split.contract_split_id.toLowerCase() ||
      !sameAddress(event.member, user.wallet_address)
    ) {
      return NextResponse.json({ error: "Your payment was not found on-chain" }, { status: 409 });
    }
    const amount = fromUsdcUnits(event.amount);

    const admin = getSupabaseAdmin();
    const { data: payment, error } = await admin
      .from("payments")
      .insert({
        from_user_id: user.id,
        to_user_id: found.split.creator_id,
        amount_usdc: amount,
        note: found.split.description,
        source_chain: "ARC",
        tx_hash: txHash,
        status: "pending", // held in escrow until the contract releases it
        circle_id: found.split.circle_id,
      })
      .select()
      .single();
    if (error || !payment) {
      if (isUniqueViolation(error)) {
        return NextResponse.json({ error: "This payment has already been recorded" }, { status: 409 });
      }
      return NextResponse.json({ error: error?.message ?? "Could not record the payment" }, { status: 500 });
    }

    await admin
      .from("split_members")
      .update({ paid: true, payment_id: payment.id, paid_at: new Date().toISOString() })
      .eq("split_id", splitId)
      .eq("user_id", user.id);

    const chain = await readSplitState(found.split.contract_split_id);
    const complete = chain.status === SPLIT_STATUS.Complete;
    await admin
      .from("splits")
      .update({ collected_usdc: fromUsdcUnits(chain.collected), status: complete ? "complete" : "open" })
      .eq("id", splitId);

    const activities: Parameters<typeof recordActivity>[0] = [
      {
        user_id: found.split.creator_id,
        type: "split_paid",
        reference_id: splitId,
        actor_id: user.id,
        amount_usdc: amount,
        note: found.split.description,
      },
    ];
    if (complete) {
      // The contract has released the collected total to the creator: every member's payment is now settled.
      const { data: shares } = await admin.from("split_members").select("payment_id").eq("split_id", splitId);
      const paymentIds = (shares ?? []).map((s) => s.payment_id).filter(Boolean) as string[];
      if (paymentIds.length > 0) {
        await admin.from("payments").update({ status: "completed" }).in("id", paymentIds).eq("status", "pending");
      }
      activities.push({
        user_id: found.split.creator_id,
        type: "split_complete",
        reference_id: splitId,
        actor_id: found.split.creator_id,
        amount_usdc: found.split.total_amount_usdc,
        note: found.split.description,
      });
    }
    await recordActivity(activities);

    return NextResponse.json({ payment, complete });
  } catch (e) {
    console.error("Split payment confirmation failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not confirm payment" },
      { status: 502 }
    );
  }
}
