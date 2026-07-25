import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { getCircleUserToken, listUserWalletsWithRetry } from "@/lib/circle/wallets";

/**
 * POST /api/circle/complete — called after the client's PIN-setup challenge
 * (from /api/circle/init) succeeds. Fetches the now-provisioned wallet and
 * persists it on the user's profile.
 */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { userToken } = await getCircleUserToken(user.id);
    const wallets = await listUserWalletsWithRetry(userToken);
    const wallet = wallets[0];

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet not indexed yet — try again in a few seconds" },
        { status: 502 }
      );
    }

    const admin = getSupabaseAdmin();
    await admin
      .from("users")
      .update({ circle_wallet_id: wallet.id, wallet_address: wallet.address })
      .eq("id", user.id);

    return NextResponse.json({ walletAddress: wallet.address });
  } catch (e) {
    console.error("Circle wallet completion failed:", e);
    return NextResponse.json({ error: "Could not finish wallet setup" }, { status: 502 });
  }
}
