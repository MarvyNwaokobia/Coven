import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";

/** GET /api/splits/[splitId] — split detail + member payment status. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ splitId: string }> }
) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { splitId } = await params;
  const admin = getSupabaseAdmin();

  const { data: split, error } = await admin
    .from("splits")
    .select(
      "*, members:split_members(*, user:users(id, username, display_name, avatar_url)), creator:users!splits_creator_id_fkey(id, username, display_name, avatar_url)"
    )
    .eq("id", splitId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!split) return NextResponse.json({ error: "Split not found" }, { status: 404 });

  return NextResponse.json({ split });
}
