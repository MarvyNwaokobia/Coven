import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { resolveAndVerifyRecentTransfer } from "@/lib/circle/wallets";
import { recordActivity } from "@/lib/server/activity";
import {
  isUniqueViolation,
  paymentHashRecorded,
  TRANSFER_ALREADY_RECORDED,
  verificationFailureStatus,
} from "@/lib/server/payments";

/**
 * POST /api/splits/[splitId]/pay - member pays their share to the creator.
 * The client must have already run a PIN challenge via
 * /api/circle/transfer-challenge ({ kind: "split", splitId }) before
 * calling this - we verify the resulting transaction settled first.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ splitId: string }> }
) {
  const member = await getAuthedUser(req);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { splitId } = await params;
  const admin = getSupabaseAdmin();

  const { data: split } = await admin
    .from("splits")
    .select("*, creator:users!splits_creator_id_fkey(id, username, wallet_address)")
    .eq("id", splitId)
    .maybeSingle();

  if (!split) return NextResponse.json({ error: "Split not found" }, { status: 404 });
  if (split.status !== "open") {
    return NextResponse.json({ error: `Split is ${split.status}` }, { status: 409 });
  }
  // A split held in escrow is paid into the contract, never straight to the creator.
  if (split.contract_split_id) {
    return NextResponse.json({ error: "This split is paid through escrow" }, { status: 409 });
  }

  const { data: share } = await admin
    .from("split_members")
    .select("*")
    .eq("split_id", splitId)
    .eq("user_id", member.id)
    .maybeSingle();

  if (!share) return NextResponse.json({ error: "You're not part of this split" }, { status: 403 });
  if (share.paid) return NextResponse.json({ error: "Already paid" }, { status: 409 });

  if (!member.circle_wallet_id || !split.creator?.wallet_address) {
    return NextResponse.json({ error: "Wallet not provisioned" }, { status: 400 });
  }

  let txHash: string | null;
  try {
    const result = await resolveAndVerifyRecentTransfer({
      userId: member.id,
      walletId: member.circle_wallet_id,
      destinationAddress: split.creator.wallet_address,
      amountUsdc: Number(share.amount_owed_usdc),
      isRecorded: paymentHashRecorded,
    });
    txHash = result.txHash;
  } catch (e) {
    console.error("Split payment verification failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Transfer could not be verified" },
      { status: verificationFailureStatus(e) }
    );
  }

  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .insert({
      from_user_id: member.id,
      to_user_id: split.creator_id,
      amount_usdc: share.amount_owed_usdc,
      note: split.description,
      source_chain: "ARC",
      tx_hash: txHash,
      status: "completed",
      circle_id: split.circle_id,
    })
    .select()
    .single();

  // One transfer pays one share. If this hash is already recorded, the share stays unpaid
  // instead of being marked paid against someone else's payment.
  if (paymentError || !payment) {
    if (isUniqueViolation(paymentError)) {
      return NextResponse.json({ error: TRANSFER_ALREADY_RECORDED }, { status: 409 });
    }
    return NextResponse.json({ error: paymentError?.message ?? "Could not record the payment" }, { status: 500 });
  }

  await admin
    .from("split_members")
    .update({ paid: true, payment_id: payment.id, paid_at: new Date().toISOString() })
    .eq("split_id", splitId)
    .eq("user_id", member.id);

  const newCollected = Number(split.collected_usdc) + Number(share.amount_owed_usdc);
  const complete = newCollected >= Number(split.total_amount_usdc);

  await admin
    .from("splits")
    .update({ collected_usdc: newCollected, status: complete ? "complete" : "open" })
    .eq("id", splitId);

  const activities: Parameters<typeof recordActivity>[0] = [
    {
      user_id: split.creator_id,
      type: "split_paid",
      reference_id: splitId,
      actor_id: member.id,
      amount_usdc: share.amount_owed_usdc,
      note: split.description,
    },
  ];
  if (complete) {
    activities.push({
      user_id: split.creator_id,
      type: "split_complete",
      reference_id: splitId,
      actor_id: split.creator_id,
      amount_usdc: split.total_amount_usdc,
      note: split.description,
    });
  }
  await recordActivity(activities);

  return NextResponse.json({ payment, complete });
}
