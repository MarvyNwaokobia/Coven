import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/** GET /api/users/[username] - public profile + stats. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const clean = username.replace(/^@/, "").toLowerCase();

  const admin = getSupabaseAdmin();
  const { data: user, error } = await admin
    .from("users")
    .select(
      "id, username, display_name, avatar_url, bio, wallet_address, total_sent, total_received, created_at"
    )
    .eq("username", clean)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({ user });
}
