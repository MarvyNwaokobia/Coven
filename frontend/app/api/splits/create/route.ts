import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { recordActivity } from "@/lib/server/activity";

/**
 * POST /api/splits/create
 * body: { memberUsernames: string[], amounts: number[], description, deadlineHours?, circleId? }
 *
 * Creates a bill split. Shares are collected off-chain via Circle wallet
 * transfers to the creator; the SplitEscrow contract path can be attached
 * later by setting contract_split_id.
 */
export async function POST(req: Request) {
  const creator = await getAuthedUser(req);
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { memberUsernames, amounts, description, deadlineHours, circleId } = await req.json();

  if (!Array.isArray(memberUsernames) || memberUsernames.length === 0 || !description) {
    return NextResponse.json({ error: "memberUsernames and description required" }, { status: 400 });
  }
  if (!Array.isArray(amounts) || amounts.length !== memberUsernames.length) {
    return NextResponse.json({ error: "amounts must match memberUsernames" }, { status: 400 });
  }
  if (amounts.some((a: number) => !a || a <= 0)) {
    return NextResponse.json({ error: "All amounts must be positive" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const cleaned = memberUsernames.map((u: string) => u.replace(/^@/, "").toLowerCase());

  const { data: members } = await admin
    .from("users")
    .select("id, username")
    .in("username", cleaned);

  if (!members || members.length !== cleaned.length) {
    const found = new Set((members ?? []).map((m) => m.username));
    const missing = cleaned.filter((u: string) => !found.has(u));
    return NextResponse.json({ error: `Users not found: ${missing.join(", ")}` }, { status: 404 });
  }

  const total = amounts.reduce((s: number, a: number) => s + a, 0);
  const deadline = new Date(Date.now() + (deadlineHours ?? 72) * 3600_000).toISOString();

  const { data: split, error } = await admin
    .from("splits")
    .insert({
      creator_id: creator.id,
      circle_id: circleId ?? null,
      total_amount_usdc: total,
      description,
      deadline,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const memberRows = members.map((m) => ({
    split_id: split.id,
    user_id: m.id,
    amount_owed_usdc: amounts[cleaned.indexOf(m.username)],
  }));
  await admin.from("split_members").insert(memberRows);

  await recordActivity(
    members.map((m) => ({
      user_id: m.id,
      type: "split_created" as const,
      reference_id: split.id,
      actor_id: creator.id,
      amount_usdc: amounts[cleaned.indexOf(m.username)],
      note: description,
    }))
  );

  return NextResponse.json({ split });
}
