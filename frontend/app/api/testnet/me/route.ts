import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase";
import { TRACKER_ENABLED } from "@/lib/testnet";
import { cachedTracker } from "@/lib/server/testnet-tracker";

/**
 * GET /api/testnet/me - the signed-in tester's own progress through the eligibility stages, for
 * Settings. Returns only the caller's row, so testers never see anyone else's address or payments
 * (the full tracker is core team only). `progress` is null when they are not on the tracker yet.
 */
export async function GET(req: Request) {
  if (!TRACKER_ENABLED) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await cachedTracker();
    const progress = data.participants.find((p) => p.username === user.username) ?? null;
    return NextResponse.json({ progress }, { headers: { "cache-control": "private, no-store" } });
  } catch (e) {
    console.error("testnet progress failed", e);
    return NextResponse.json({ error: "Progress is unavailable right now" }, { status: 503 });
  }
}
