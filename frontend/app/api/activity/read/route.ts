import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";

/**
 * POST /api/activity/read — body: { ids?: string[] } or { all: true }
 * Marks activity items as read for the authed user.
 */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids, all } = await req.json();
  const admin = getSupabaseAdmin();

  let query = admin.from("activity").update({ read: true }).eq("user_id", user.id);

  if (all) {
    query = query.eq("read", false);
  } else if (Array.isArray(ids) && ids.length > 0) {
    query = query.in("id", ids);
  } else {
    return NextResponse.json({ error: "ids or all required" }, { status: 400 });
  }

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
