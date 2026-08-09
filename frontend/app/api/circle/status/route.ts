import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase";

/** GET /api/circle/status - whether the authed user's wallet is set up. */
export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ walletAddress: user.wallet_address ?? null });
}
