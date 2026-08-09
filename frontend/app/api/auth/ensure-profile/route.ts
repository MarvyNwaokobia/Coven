import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const PLACEHOLDER_USERNAME_PREFIX = "user_";

/**
 * POST /api/auth/ensure-profile - called client-side right after Google
 * sign-in completes. Supabase Auth already created the auth.users row; this
 * creates our public.users profile row on first login (username claim and
 * Circle wallet setup are separate onboarding steps - see /api/users/create
 * and /api/circle/init). Idempotent - safe to call on every sign-in.
 */
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = authData.user.id;
  const email = authData.user.email ?? null;

  const { data: existing } = await admin
    .from("users")
    .select("id, username")
    .eq("id", userId)
    .maybeSingle();

  if (existing) {
    // The placeholder username is only ever replaced by a real claim in
    // /api/users/create, so its presence means onboarding never finished.
    return NextResponse.json({
      needsOnboarding: existing.username.startsWith(PLACEHOLDER_USERNAME_PREFIX),
    });
  }

  await admin.from("users").insert({
    id: userId,
    username: `${PLACEHOLDER_USERNAME_PREFIX}${userId.slice(0, 8)}`,
    email,
  });

  return NextResponse.json({ needsOnboarding: true });
}
