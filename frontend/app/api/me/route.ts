import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase";

/** GET /api/me - the authenticated user's own profile row. */
export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ user });
}
