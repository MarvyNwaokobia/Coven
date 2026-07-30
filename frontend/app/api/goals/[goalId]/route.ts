import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { getGoalForMember } from "@/lib/server/goals";

/** GET /api/goals/[goalId] — goal detail: members, contributions, active withdrawal + approvals. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ goalId: string }> }
) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { goalId } = await params;
  const found = await getGoalForMember(goalId, user.id);
  if (!found) return NextResponse.json({ error: "Goal not found or not a member" }, { status: 404 });

  const admin = getSupabaseAdmin();
  const [{ data: members }, { data: contributions }, { data: withdrawals }] = await Promise.all([
    admin
      .from("goal_members")
      .select("user:users(id, username, display_name, avatar_url)")
      .eq("goal_id", goalId),
    admin
      .from("goal_contributions")
      .select("*, user:users(id, username, avatar_url)")
      .eq("goal_id", goalId)
      .order("created_at", { ascending: false }),
    admin
      .from("goal_withdrawal_requests")
      .select(
        "*, requester:users!goal_withdrawal_requests_requested_by_fkey(id, username), recipient:users!goal_withdrawal_requests_recipient_user_id_fkey(id, username), approvals:goal_withdrawal_approvals(user_id)"
      )
      .eq("goal_id", goalId)
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    goal: {
      ...found.goal,
      members: (members ?? []).map((m: { user: unknown }) => m.user),
    },
    contributions: contributions ?? [],
    withdrawals: withdrawals ?? [],
  });
}
