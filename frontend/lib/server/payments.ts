import { getSupabaseAdmin } from "@/lib/supabase";
import { recordActivity } from "@/lib/server/activity";

/**
 * Credit a payment that has actually settled: bump both users' lifetime
 * totals and push the sent/received pair onto the activity feed.
 *
 * Call this only once a payment is `completed`. On-Arc sends are verified
 * against Circle before this runs; cross-chain sends stay `pending` until
 * /api/cctp/relay confirms the mint landed. Crediting earlier inflates
 * totals for money that may never arrive, and there is no compensating
 * decrement when a bridge fails.
 */
export async function creditPayment(params: {
  paymentId: string;
  senderId: string;
  recipientId: string;
  amount: number;
  note?: string | null;
}) {
  const { paymentId, senderId, recipientId, amount, note = null } = params;
  const admin = getSupabaseAdmin();

  await Promise.all([
    admin.rpc("increment_user_totals", {
      sender_id: senderId,
      recipient_id: recipientId,
      amount,
    }),
    recordActivity([
      {
        user_id: senderId,
        type: "payment_sent",
        reference_id: paymentId,
        actor_id: senderId,
        amount_usdc: amount,
        note,
      },
      {
        user_id: recipientId,
        type: "payment_received",
        reference_id: paymentId,
        actor_id: senderId,
        amount_usdc: amount,
        note,
      },
    ]),
  ]);
}
