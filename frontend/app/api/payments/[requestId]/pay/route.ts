import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { transferUSDC } from "@/lib/circle/wallets";
import { recordActivity } from "@/lib/server/activity";

/** POST /api/payments/[requestId]/pay — one-tap pay on a pending request. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const payer = await getAuthedUser(req);
  if (!payer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requestId } = await params;
  const admin = getSupabaseAdmin();

  const { data: request } = await admin
    .from("payment_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (request.to_user_id !== payer.id) {
    return NextResponse.json({ error: "This request is not addressed to you" }, { status: 403 });
  }
  if (request.status !== "pending") {
    return NextResponse.json({ error: `Request is ${request.status}` }, { status: 409 });
  }

  const { data: requester } = await admin
    .from("users")
    .select("id, username, wallet_address")
    .eq("id", request.from_user_id)
    .single();

  if (!requester?.wallet_address || !payer.circle_wallet_id) {
    return NextResponse.json({ error: "Wallet not provisioned" }, { status: 400 });
  }

  let txRef: string;
  try {
    const { transactionId } = await transferUSDC({
      fromWalletId: payer.circle_wallet_id,
      toAddress: requester.wallet_address,
      amountUsdc: String(request.amount_usdc),
      userId: payer.id,
    });
    txRef = transactionId;
  } catch (e) {
    console.error("Request payment transfer failed:", e);
    return NextResponse.json({ error: "Transfer failed — check your balance" }, { status: 502 });
  }

  const { data: payment } = await admin
    .from("payments")
    .insert({
      from_user_id: payer.id,
      to_user_id: requester.id,
      amount_usdc: request.amount_usdc,
      note: request.note,
      source_chain: "ARC",
      tx_hash: txRef,
      status: "completed",
    })
    .select()
    .single();

  await admin
    .from("payment_requests")
    .update({ status: "paid", payment_id: payment?.id })
    .eq("id", requestId);

  await recordActivity([
    {
      user_id: requester.id,
      type: "request_paid",
      reference_id: requestId,
      actor_id: payer.id,
      amount_usdc: request.amount_usdc,
      note: request.note,
    },
    {
      user_id: payer.id,
      type: "payment_sent",
      reference_id: payment?.id,
      actor_id: payer.id,
      amount_usdc: request.amount_usdc,
      note: request.note,
    },
  ]);

  return NextResponse.json({ payment });
}
