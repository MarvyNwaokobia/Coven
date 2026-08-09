import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { resolveAndVerifyRecentTransfer } from "@/lib/circle/wallets";
import { recordActivity } from "@/lib/server/activity";

/**
 * POST /api/circles/[id]/send
 * body: { toUsername, amountUsdc, note? }
 * Sends USDC to one circle member. Each transfer needs its own PIN
 * challenge, so "send to all" is a client-side loop calling
 * /api/circle/transfer-challenge ({ kind: "circle-member" }) then this
 * route once per member - this route only verifies and records a single
 * already-approved transfer.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sender = await getAuthedUser(req);
  if (!sender) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sender.circle_wallet_id) {
    return NextResponse.json({ error: "Wallet not provisioned" }, { status: 400 });
  }

  const { id } = await params;
  const { toUsername, amountUsdc, note } = await req.json();
  const amount = Number(amountUsdc);
  if (!toUsername || !amount || amount <= 0) {
    return NextResponse.json({ error: "toUsername and positive amountUsdc required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: membership } = await admin
    .from("circle_members")
    .select("circle_id")
    .eq("circle_id", id)
    .eq("user_id", sender.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const { data: recipient } = await admin
    .from("users")
    .select("id, username, wallet_address")
    .eq("username", String(toUsername).replace(/^@/, "").toLowerCase())
    .maybeSingle();

  if (!recipient?.wallet_address || recipient.id === sender.id) {
    return NextResponse.json({ error: "Invalid recipient" }, { status: 404 });
  }

  let txHash: string | null;
  try {
    const result = await resolveAndVerifyRecentTransfer({
      userId: sender.id,
      walletId: sender.circle_wallet_id,
      destinationAddress: recipient.wallet_address,
      amountUsdc: amount,
    });
    txHash = result.txHash;
  } catch (e) {
    console.error(`Circle send to ${recipient.username} verification failed:`, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Transfer could not be verified" },
      { status: 502 }
    );
  }

  const { data: payment } = await admin
    .from("payments")
    .insert({
      from_user_id: sender.id,
      to_user_id: recipient.id,
      amount_usdc: amount,
      note: note ?? null,
      source_chain: "ARC",
      tx_hash: txHash,
      status: "completed",
      circle_id: id,
    })
    .select()
    .single();

  await recordActivity([
    {
      user_id: recipient.id,
      type: "payment_received",
      reference_id: payment?.id,
      actor_id: sender.id,
      amount_usdc: amount,
      note: note ?? null,
    },
  ]);

  return NextResponse.json({ payment });
}
