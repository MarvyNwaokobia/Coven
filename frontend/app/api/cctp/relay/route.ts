import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { relayToArc, type SourceChain } from "@/lib/cctp/crossChainPay";

const SOURCE_CHAINS: SourceChain[] = ["ethereum", "base", "polygon", "arbitrum"];

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
  if (!sourceTxHash || !SOURCE_CHAINS.includes(sourceChain)) {
    return NextResponse.json(
      { error: `sourceTxHash and sourceChain (one of ${SOURCE_CHAINS.join(", ")}) required` },
      { status: 400 }
    );
  }

  try {
    const txHash = await relayToArc({ sourceTxHash, sourceChain });

    if (paymentId) {
      const admin = getSupabaseAdmin();
      await admin
        .from("payments")
        .update({ status: "completed", tx_hash: txHash })
        .eq("id", paymentId)
        .eq("from_user_id", user.id);
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
        .eq("from_user_id", user.id);
    }
    return NextResponse.json({ error: "Relay failed" }, { status: 502 });
  }
}
