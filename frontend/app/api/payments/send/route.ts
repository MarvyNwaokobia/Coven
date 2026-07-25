import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { resolveAndVerifyRecentTransfer } from "@/lib/circle/wallets";
import { recordActivity } from "@/lib/server/activity";

/**
 * POST /api/payments/send
 * body: { toUsername, amountUsdc, note?, sourceChain? }
 *
 * On Arc: the client must have already run a PIN challenge via
 * /api/circle/transfer-challenge ({ kind: "send" }) before calling this —
 * we verify the resulting Circle transaction actually settled before
 * recording anything.
 * Cross-chain: the client burns via CCTP first, then calls /api/cctp/relay;
 * this route records the pending payment row for it.
 */
export async function POST(req: Request) {
  const sender = await getAuthedUser(req);
  if (!sender) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { toUsername, amountUsdc, note, sourceChain, txHash } = await req.json();
  const amount = Number(amountUsdc);
  if (!toUsername || !amount || amount <= 0) {
    return NextResponse.json({ error: "toUsername and positive amountUsdc required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: recipient } = await admin
    .from("users")
    .select("id, username, wallet_address")
    .eq("username", String(toUsername).replace(/^@/, "").toLowerCase())
    .maybeSingle();

  if (!recipient) return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
  if (recipient.id === sender.id) {
    return NextResponse.json({ error: "You can't pay yourself" }, { status: 400 });
  }
  if (!recipient.wallet_address) {
    return NextResponse.json({ error: "Recipient has no wallet yet" }, { status: 400 });
  }

  const chain = (sourceChain ?? "ARC").toUpperCase();
  const isCrossChain = chain !== "ARC";
  const fee = isCrossChain ? Math.round(amount * 0.005 * 1e6) / 1e6 : 0;

  let status: "pending" | "completed" = "completed";
  let recordedTxHash: string | null = txHash ?? null;

  if (!isCrossChain) {
    if (!sender.circle_wallet_id) {
      return NextResponse.json({ error: "Your wallet is not provisioned yet" }, { status: 400 });
    }
    try {
      const { txHash: verifiedHash } = await resolveAndVerifyRecentTransfer({
        userId: sender.id,
        walletId: sender.circle_wallet_id,
        destinationAddress: recipient.wallet_address,
        amountUsdc: amount,
      });
      recordedTxHash = verifiedHash;
    } catch (e) {
      console.error("Transfer verification failed:", e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Transfer could not be verified" },
        { status: 502 }
      );
    }
  } else {
    status = "pending"; // completed by /api/cctp/relay
  }

  const { data: payment, error } = await admin
    .from("payments")
    .insert({
      from_user_id: sender.id,
      to_user_id: recipient.id,
      amount_usdc: amount,
      fee_usdc: fee,
      note: note ?? null,
      source_chain: chain,
      tx_hash: recordedTxHash,
      status,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await Promise.all([
    admin.rpc("increment_user_totals", {
      sender_id: sender.id,
      recipient_id: recipient.id,
      amount,
    }),
    recordActivity([
      {
        user_id: sender.id,
        type: "payment_sent",
        reference_id: payment.id,
        actor_id: sender.id,
        amount_usdc: amount,
        note: note ?? null,
      },
      {
        user_id: recipient.id,
        type: "payment_received",
        reference_id: payment.id,
        actor_id: sender.id,
        amount_usdc: amount,
        note: note ?? null,
      },
    ]),
  ]);

  return NextResponse.json({ payment });
}
