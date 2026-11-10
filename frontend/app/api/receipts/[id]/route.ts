import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { buildStatement, type StatementInput } from "@/lib/server/statement";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PAYMENT_COLUMNS =
  "id, from_user_id, to_user_id, amount_usdc, fee_usdc, note, tx_hash, status, circle_id, created_at, from_user:users!payments_from_user_id_fkey(username), to_user:users!payments_to_user_id_fkey(username)";

/**
 * GET /api/receipts/[id] - full details of one of the signed-in user's transactions, in the same
 * shape as a History row. The id may be a payment, a cash out, a goal contribution, or a payment
 * request (resolved to the payment that settled it). Anything that is not theirs is a 404.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = getSupabaseAdmin();
  const input: StatementInput = { userId: user.id, payments: [], splitPaymentIds: [], contributions: [], payouts: [] };

  async function loadPayment(paymentId: string) {
    const { data } = await admin
      .from("payments")
      .select(PAYMENT_COLUMNS)
      .eq("id", paymentId)
      .or(`from_user_id.eq.${user!.id},to_user_id.eq.${user!.id}`)
      .maybeSingle();
    if (!data) return false;
    input.payments = [data as unknown as StatementInput["payments"][number]];
    const { data: split } = await admin
      .from("split_members")
      .select("payment_id")
      .eq("user_id", user!.id)
      .eq("payment_id", paymentId)
      .maybeSingle();
    input.splitPaymentIds = split ? [paymentId] : [];
    return true;
  }

  let found = await loadPayment(id);

  if (!found) {
    const { data: payout } = await admin
      .from("offramp_payouts")
      .select("id, user_id, amount_usdc, fee_usdc, target_currency, deposit_tx_hash, status, created_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (payout) {
      input.payouts = [payout as unknown as StatementInput["payouts"][number]];
      found = true;
    }
  }

  if (!found) {
    const { data: contribution } = await admin
      .from("goal_contributions")
      .select("id, user_id, amount_usdc, tx_hash, created_at, goal:circle_goals(description)")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (contribution) {
      input.contributions = [contribution as unknown as StatementInput["contributions"][number]];
      found = true;
    }
  }

  if (!found) {
    // A request that was paid points at the payment that settled it.
    const { data: request } = await admin
      .from("payment_requests")
      .select("payment_id")
      .eq("id", id)
      .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
      .maybeSingle();
    if (request?.payment_id) found = await loadPayment(request.payment_id);
  }

  const [row] = found ? buildStatement(input) : [];
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ row });
}
