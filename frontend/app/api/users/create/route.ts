import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { validateUsername } from "@/lib/format";

/**
 * POST /api/users/create — body: { username, displayName? }
 * Claims a @username for the authenticated user (onboarding step).
 */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { username, displayName } = await req.json();
  const clean = String(username ?? "").replace(/^@/, "").toLowerCase();

  const invalid = validateUsername(clean);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const admin = getSupabaseAdmin();

  const { data: taken } = await admin
    .from("users")
    .select("id")
    .eq("username", clean)
    .neq("id", user.id)
    .maybeSingle();
  if (taken) return NextResponse.json({ error: "Username is taken" }, { status: 409 });

  // Wallet setup is a separate PIN-challenge step (see /api/circle/init) —
  // not something we can provision inline here.
  const { data: updated, error } = await admin
    .from("users")
    .update({ username: clean, display_name: displayName ?? null })
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    // 23505 = unique_violation — the pre-check above missed a same-instant
    // race between two people claiming the same username; the DB constraint
    // is the real guarantee, this just keeps the error message clean.
    if (error.code === "23505") {
      return NextResponse.json({ error: "Username is taken" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ user: updated });
}
