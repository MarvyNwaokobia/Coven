import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { recordActivity } from "@/lib/server/activity";

/** POST /api/circles/create - body: { name, emoji?, memberUsernames?: string[] } */
export async function POST(req: Request) {
  const creator = await getAuthedUser(req);
  if (!creator) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, emoji, memberUsernames } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const admin = getSupabaseAdmin();

  const { data: circle, error } = await admin
    .from("circles")
    .insert({ name: name.trim(), emoji: emoji ?? "👥", creator_id: creator.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const memberIds = [creator.id];
  if (Array.isArray(memberUsernames) && memberUsernames.length > 0) {
    const cleaned = memberUsernames.map((u: string) => u.replace(/^@/, "").toLowerCase());
    const { data: members } = await admin
      .from("users")
      .select("id")
      .in("username", cleaned);
    for (const m of members ?? []) {
      if (!memberIds.includes(m.id)) memberIds.push(m.id);
    }
  }

  await admin
    .from("circle_members")
    .insert(memberIds.map((user_id) => ({ circle_id: circle.id, user_id })));

  await recordActivity(
    memberIds
      .filter((id) => id !== creator.id)
      .map((user_id) => ({
        user_id,
        type: "circle_joined" as const,
        reference_id: circle.id,
        actor_id: creator.id,
        note: circle.name,
      }))
  );

  return NextResponse.json({ circle });
}

/** GET /api/circles/create is not a thing - list lives at /api/circles */
