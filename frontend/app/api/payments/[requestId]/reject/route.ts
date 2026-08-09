import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { recordActivity } from "@/lib/server/activity";

/** POST /api/payments/[requestId]/reject - decline a pending request. */
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

  const { error: updateError } = await admin
    .from("payment_requests")
    .update({ status: "rejected" })
    .eq("id", requestId);

  if (updateError) {
    console.error("Reject request failed:", updateError);
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  await recordActivity([
    {
      // Notifies the original requester that their request was declined.
      user_id: request.from_user_id,
      type: "request_rejected",
      reference_id: requestId,
      actor_id: payer.id,
      amount_usdc: request.amount_usdc,
      note: request.note,
    },
    {
      // Confirms the decline in the rejecter's own feed - actor is the
      // requester here, so the label reads "You declined @requester's request".
      user_id: payer.id,
      type: "request_declined",
      reference_id: requestId,
      actor_id: request.from_user_id,
      amount_usdc: request.amount_usdc,
      note: request.note,
    },
  ]);

  return NextResponse.json({ ok: true });
}
