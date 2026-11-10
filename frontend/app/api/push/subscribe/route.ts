import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";

/** POST /api/push/subscribe - body: PushSubscriptionJSON. Registers this device for the authed user. */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sub = await req.json().catch(() => null);
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  // Upsert on endpoint: if this browser was last used by someone else, it now belongs to this user.
  const { error } = await getSupabaseAdmin()
    .from("push_subscriptions")
    .upsert(
      { user_id: user.id, endpoint, p256dh, auth, user_agent: req.headers.get("user-agent") },
      { onConflict: "endpoint" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/push/subscribe - body: { endpoint }. Removes this device. */
export async function DELETE(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { endpoint } = await req.json().catch(() => ({}));
  if (typeof endpoint !== "string") return NextResponse.json({ error: "endpoint required" }, { status: 400 });

  const { error } = await getSupabaseAdmin()
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
