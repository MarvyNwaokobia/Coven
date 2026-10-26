import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase";
import { getCircleUserToken, getUSDCBalance } from "@/lib/circle/wallets";
import { DEFAULT_CURRENCY, getCurrency } from "@/lib/currency";
import { getExchangeRate } from "@/lib/yellowcard/offramp";

/** GET /api/balance?currency=GHS - Circle wallet USDC balance + estimate in the chosen currency. */
export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currency =
    getCurrency(new URL(req.url).searchParams.get("currency"))?.code ?? DEFAULT_CURRENCY;

  const [balance, { rate }] = await Promise.all([
    user.circle_wallet_id
      ? getCircleUserToken(user.id).then(({ userToken }) =>
          getUSDCBalance(user.circle_wallet_id!, userToken)
        )
      : Promise.resolve("0"),
    currency === "USD" ? Promise.resolve({ rate: 1 }) : getExchangeRate(currency),
  ]);

  return NextResponse.json({
    usdc: balance,
    localEstimate: parseFloat(balance) * rate,
    localCurrency: currency,
    rate,
    walletAddress: user.wallet_address,
  });
}
