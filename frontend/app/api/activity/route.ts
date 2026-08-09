import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { syncInboundTransfers } from "@/lib/server/inbound-sync";

/** GET /api/activity?page=1 - paginated personal activity feed. */
export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const page = Math.max(1, Number(new URL(req.url).searchParams.get("page") ?? 1));
  const pageSize = 25;

  if (user.circle_wallet_id) {
    await syncInboundTransfers(user.id, user.circle_wallet_id).catch((e) =>
      console.error("Inbound transfer sync failed:", e)
    );
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("activity")
    .select("*, actor:users!activity_actor_id_fkey(id, username, display_name, avatar_url)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ activity: data, page });
}
