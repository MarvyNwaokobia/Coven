import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import {
  createCircleUser,
  getCircleUserToken,
  initializeUserWallet,
  listUserWalletsWithRetry,
} from "@/lib/circle/wallets";

/**
 * POST /api/circle/init
 * Starts (or discovers) Circle wallet setup for the authed user.
 * - First time: returns { userToken, encryptionKey, challengeId } for the
 *   client to run through the Web SDK's PIN-setup widget.
 * - Already done: persists the wallet and returns { alreadyInitialized, walletAddress }.
 */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.wallet_address) {
    return NextResponse.json({ alreadyInitialized: true, walletAddress: user.wallet_address });
  }

  try {
    await createCircleUser(user.id);
    const { userToken, encryptionKey } = await getCircleUserToken(user.id);
    const result = await initializeUserWallet(userToken);

    if ("alreadyInitialized" in result) {
      const wallets = await listUserWalletsWithRetry(userToken);
      const wallet = wallets[0];
      if (wallet) {
        const admin = getSupabaseAdmin();
        await admin
          .from("users")
          .update({ circle_wallet_id: wallet.id, wallet_address: wallet.address })
          .eq("id", user.id);
      }
      return NextResponse.json({ alreadyInitialized: true, walletAddress: wallet?.address ?? null });
    }

    return NextResponse.json({
      alreadyInitialized: false,
      userToken,
      encryptionKey,
      challengeId: result.challengeId,
    });
  } catch (e) {
    console.error("Circle wallet init failed:", e);
    return NextResponse.json({ error: "Could not start wallet setup" }, { status: 502 });
  }
}
