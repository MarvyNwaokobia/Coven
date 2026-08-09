import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase";
import { getCircleUserToken, getUSDCBalance } from "@/lib/circle/wallets";
import { getExchangeRate } from "@/lib/yellowcard/offramp";

/** GET /api/balance - Circle wallet USDC balance + NGN estimate. */
export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [balance, { rate }] = await Promise.all([
    user.circle_wallet_id
      ? getCircleUserToken(user.id).then(({ userToken }) =>
          getUSDCBalance(user.circle_wallet_id!, userToken)
        )
      : Promise.resolve("0"),
    getExchangeRate("NGN"),
  ]);

  return NextResponse.json({
    usdc: balance,
    localEstimate: parseFloat(balance) * rate,
    localCurrency: "NGN",
    rate,
    walletAddress: user.wallet_address,
  });
}
