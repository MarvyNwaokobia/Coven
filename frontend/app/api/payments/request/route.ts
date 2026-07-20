import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { recordActivity } from "@/lib/server/activity";

/**
 * POST /api/payments/request — body: { toUsername, amountUsdc, note? }
 * Creates a payment request (requester = authed user, payer = toUsername).
 */
export async function POST(req: Request) {
  const requester = await getAuthedUser(req);
  if (!requester) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { toUsername, amountUsdc, note } = await req.json();
  const amount = Number(amountUsdc);
  if (!toUsername || !amount || amount <= 0) {
    return NextResponse.json({ error: "toUsername and positive amountUsdc required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: payer } = await admin
    .from("users")
    .select("id")
    .eq("username", String(toUsername).replace(/^@/, "").toLowerCase())
    .maybeSingle();

  if (!payer) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (payer.id === requester.id) {
    return NextResponse.json({ error: "You can't request from yourself" }, { status: 400 });
  }

  const { data: request, error } = await admin
    .from("payment_requests")
    .insert({
      from_user_id: requester.id,
      to_user_id: payer.id,
      amount_usdc: amount,
      note: note ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await recordActivity([
    {
      user_id: payer.id,
      type: "request_received",
      reference_id: request.id,
      actor_id: requester.id,
      amount_usdc: amount,
      note: note ?? null,
    },
  ]);

  return NextResponse.json({ request });
}

/** GET /api/payments/request — pending requests addressed to the authed user. */
export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("payment_requests")
    .select("*, from_user:users!payment_requests_from_user_id_fkey(id, username, display_name, avatar_url)")
    .eq("to_user_id", user.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ requests: data });
}
