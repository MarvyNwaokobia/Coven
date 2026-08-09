import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";

/** GET /api/circles/[id] - circle detail: members, active splits, recent payments. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = getSupabaseAdmin();

  const { data: circle } = await admin
    .from("circles")
    .select("*, members:circle_members(user:users(id, username, display_name, avatar_url))")
    .eq("id", id)
    .maybeSingle();

  if (!circle) return NextResponse.json({ error: "Circle not found" }, { status: 404 });

  const isMember = (circle.members ?? []).some(
    (m: { user: { id: string } }) => m.user?.id === user.id
  );
  if (!isMember) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const [{ data: splits }, { data: payments }, { data: goals }] = await Promise.all([
    admin
      .from("splits")
      .select("*, members:split_members(*, user:users(id, username, avatar_url))")
      .eq("circle_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("payments")
      .select(
        "*, from_user:users!payments_from_user_id_fkey(username, avatar_url), to_user:users!payments_to_user_id_fkey(username, avatar_url)"
      )
      .eq("circle_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("circle_goals")
      .select(
        "*, members:goal_members(user:users(id, username, display_name, avatar_url)), withdrawal:goal_withdrawal_requests(*, approvals:goal_withdrawal_approvals(user_id))"
      )
      .eq("circle_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return NextResponse.json({
    circle: {
      ...circle,
      members: (circle.members ?? []).map((m: { user: unknown }) => m.user),
    },
    splits: splits ?? [],
    payments: payments ?? [],
    goals: goals ?? [],
  });
}
