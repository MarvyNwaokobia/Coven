import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";

/** GET /api/circles — circles the authed user belongs to. */
export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: memberships, error } = await admin
    .from("circle_members")
    .select("circle:circles(*, members:circle_members(count))")
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const circles = (memberships ?? []).map((m) => {
    const c = m.circle as unknown as {
      id: string;
      name: string;
      emoji: string;
      creator_id: string;
      created_at: string;
      members: { count: number }[];
    };
    return { ...c, member_count: c.members?.[0]?.count ?? 0, members: undefined };
  });

  return NextResponse.json({ circles });
}
