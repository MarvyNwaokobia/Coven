import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { relayToArc } from "@/lib/cctp/crossChainPay";

/**
 * POST /api/cctp/relay — body: { messageHash, paymentId }
 * Internal: after a client-side CCTP burn, relays the attested message to
 * Arc and marks the pending payment completed.
 */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messageHash, paymentId } = await req.json();
  if (!messageHash) {
    return NextResponse.json({ error: "messageHash required" }, { status: 400 });
  }

  try {
    const txHash = await relayToArc(messageHash);

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
