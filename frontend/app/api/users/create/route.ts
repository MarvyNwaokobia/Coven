import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { createUserWallet } from "@/lib/circle/wallets";
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

  // Retry wallet provisioning if signup-time creation failed
  let walletPatch = {};
  if (!user.circle_wallet_id) {
    try {
      const wallet = await createUserWallet(user.id);
      walletPatch = {
        circle_wallet_id: wallet.walletId,
        wallet_address: wallet.walletAddress,
      };
    } catch (e) {
      console.error("Wallet retry failed:", e);
    }
  }

  const { data: updated, error } = await admin
    .from("users")
    .update({ username: clean, display_name: displayName ?? null, ...walletPatch })
    .eq("id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ user: updated });
}
