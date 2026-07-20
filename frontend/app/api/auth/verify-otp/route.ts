import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createUserWallet } from "@/lib/circle/wallets";

/**
 * POST /api/auth/verify-otp — body: { phone?, email?, otp }
 * Verifies the OTP. On first login, provisions a Circle wallet.
 * Returns the session plus whether onboarding (username) is still needed.
 */
export async function POST(req: Request) {
  const { phone, email, otp } = await req.json();
  if ((!phone && !email) || !otp) {
    return NextResponse.json({ error: "phone/email and otp required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = phone
    ? await admin.auth.verifyOtp({ phone, token: otp, type: "sms" })
    : await admin.auth.verifyOtp({ email, token: otp, type: "email" });

  if (error || !data.user || !data.session) {
    return NextResponse.json({ error: error?.message ?? "Invalid code" }, { status: 401 });
  }

  const userId = data.user.id;

  // Does a profile row exist yet?
  const { data: existing } = await admin
    .from("users")
    .select("id, username, circle_wallet_id")
    .eq("id", userId)
    .maybeSingle();

  let needsOnboarding = !existing?.username;

  if (!existing) {
    // Provision Circle wallet — non-fatal if it fails (retried at onboarding)
    let walletId: string | null = null;
    let walletAddress: string | null = null;
    try {
      const wallet = await createUserWallet(userId);
      walletId = wallet.walletId;
      walletAddress = wallet.walletAddress;
    } catch (e) {
      console.error("Circle wallet creation failed:", e);
    }

    await admin.from("users").insert({
      id: userId,
      username: `user_${userId.slice(0, 8)}`, // placeholder until onboarding
      phone: phone ?? null,
      email: email ?? null,
      circle_wallet_id: walletId,
      wallet_address: walletAddress,
    });
    needsOnboarding = true;
  }

  return NextResponse.json({
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
    userId,
    needsOnboarding,
  });
}
