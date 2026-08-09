import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";

/** GET /api/users/search?q=alice - search by @username, display name, or phone. */
export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim().replace(/^@/, "") ?? "";
  if (q.length < 2) return NextResponse.json({ users: [] });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("users")
    .select("id, username, display_name, avatar_url, wallet_address")
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%,phone.ilike.%${q}%`)
    .neq("id", user.id)
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ users: data });
}
