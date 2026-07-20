import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { getPayoutStatus } from "@/lib/yellowcard/offramp";
import { recordActivity } from "@/lib/server/activity";

/** GET /api/cashout/[payoutId]/status — poll Yellow Card and sync our record. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ payoutId: string }> }
) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { payoutId } = await params;
  const admin = getSupabaseAdmin();

  const { data: payout } = await admin
    .from("offramp_payouts")
    .select("*")
    .eq("id", payoutId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!payout) return NextResponse.json({ error: "Payout not found" }, { status: 404 });

  // Terminal states — nothing to poll
  if (payout.status === "completed" || payout.status === "failed" || !payout.yellow_card_payout_id) {
    return NextResponse.json({ payout });
  }

  try {
    const { status, trackingRef } = await getPayoutStatus(payout.yellow_card_payout_id);
    if (status !== payout.status) {
      await admin
        .from("offramp_payouts")
        .update({
          status,
          tracking_ref: trackingRef ?? payout.tracking_ref,
          completed_at: status === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", payoutId);

      if (status === "completed" || status === "failed") {
        await recordActivity([
          {
            user_id: user.id,
            type: status === "completed" ? "offramp_completed" : "offramp_failed",
            reference_id: payoutId,
            amount_usdc: payout.amount_usdc,
          },
        ]);
      }
    }
    return NextResponse.json({ payout: { ...payout, status, tracking_ref: trackingRef } });
  } catch {
    return NextResponse.json({ payout }); // Yellow Card unreachable — return last known
  }
}
