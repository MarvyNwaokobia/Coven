import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { relayToArc, type SourceChain } from "@/lib/cctp/crossChainPay";
import { creditPayment } from "@/lib/server/payments";

const SOURCE_CHAINS: SourceChain[] = ["ethereum", "base", "polygon", "arbitrum"];
const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

/**
 * POST /api/cctp/relay — body: { sourceTxHash, sourceChain, paymentId }
 * Internal: after a client-side CCTP burn, polls Circle's attestation
 * service and relays the signed message to Arc, then marks the pending
 * payment completed.
 */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sourceTxHash, sourceChain, paymentId } = await req.json();
  if (!TX_HASH.test(String(sourceTxHash ?? "")) || !SOURCE_CHAINS.includes(sourceChain)) {
    return NextResponse.json(
      {
        error: `a 32-byte hex sourceTxHash and sourceChain (one of ${SOURCE_CHAINS.join(", ")}) are required`,
      },
      { status: 400 }
    );
  }

  try {
    const txHash = await relayToArc({ sourceTxHash, sourceChain });

    if (paymentId) {
      const admin = getSupabaseAdmin();
      // Filtering on status = pending makes this idempotent: a retried or
      // duplicated relay call updates zero rows, so totals and activity are
      // never applied twice for the same payment.
      const { data: payment } = await admin
        .from("payments")
        .update({ status: "completed", tx_hash: txHash })
        .eq("id", paymentId)
        .eq("from_user_id", user.id)
        .eq("status", "pending")
        .select("id, to_user_id, amount_usdc, note")
        .maybeSingle();

      if (payment) {
        await creditPayment({
          paymentId: payment.id,
          senderId: user.id,
          recipientId: payment.to_user_id,
          amount: Number(payment.amount_usdc),
          note: payment.note,
        });
      }
    }

    return NextResponse.json({ txHash });
  } catch (e) {
    console.error("CCTP relay failed:", e);
    if (paymentId) {
      const admin = getSupabaseAdmin();
      await admin
        .from("payments")
        .update({ status: "failed" })
        .eq("id", paymentId)
        .eq("from_user_id", user.id)
        .eq("status", "pending"); // never demote a payment that already landed
    }
    return NextResponse.json({ error: "Relay failed" }, { status: 502 });
  }
}
