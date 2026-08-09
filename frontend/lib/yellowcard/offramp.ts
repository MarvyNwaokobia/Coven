/**
 * Yellow Card offramp - USDC → local currency bank transfers across Africa.
 * Server-side only.
 */

const YELLOW_CARD_API =
  process.env.YELLOW_CARD_SANDBOX === "false"
    ? "https://api.yellowcard.io/v1"
    : "https://sandbox.api.yellowcard.io/v1";

export interface BankDetails {
  accountNumber: string;
  bankCode: string;
  accountName: string;
  country: "NG" | "GH" | "KE" | "ZA" | "UG" | "TZ" | "RW" | "CM";
  currency: "NGN" | "GHS" | "KES" | "ZAR" | "UGX" | "TZS" | "RWF" | "XAF";
}

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.YELLOW_CARD_API_KEY}`,
  };
}

/** Fallback rates used when the Yellow Card API is unreachable (demo mode). */
const FALLBACK_RATES: Record<string, number> = {
  NGN: 1560,
  GHS: 15.2,
  KES: 129,
  ZAR: 18.1,
};

/** Exchange rate for USDC → local currency. */
export async function getExchangeRate(
  currency: string
): Promise<{ rate: number; fee: number }> {
  try {
    const res = await fetch(`${YELLOW_CARD_API}/rates?currency=${currency}`, {
      headers: headers(),
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`rates ${res.status}`);
    const data = await res.json();
    return { rate: data.rate, fee: data.fee ?? 0 };
  } catch {
    return { rate: FALLBACK_RATES[currency] ?? 1, fee: 0 };
  }
}

/** Initiate a USDC → local currency bank payout. */
export async function initiateOfframp(
  amountUsdc: number,
  bankDetails: BankDetails,
  reference: string
): Promise<{ payoutId: string; expectedAmount: number; estimatedArrival: string }> {
  const res = await fetch(`${YELLOW_CARD_API}/payouts`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      amount: amountUsdc,
      currency: "USDC",
      destination: {
        accountNumber: bankDetails.accountNumber,
        bankCode: bankDetails.bankCode,
        accountName: bankDetails.accountName,
        country: bankDetails.country,
        currency: bankDetails.currency,
      },
      reference,
    }),
  });

  if (!res.ok) {
    throw new Error(`Yellow Card payout failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return {
    payoutId: data.id,
    expectedAmount: data.destinationAmount,
    estimatedArrival: data.estimatedArrival,
  };
}

export async function getPayoutStatus(payoutId: string): Promise<{
  status: "pending" | "processing" | "completed" | "failed";
  trackingRef?: string;
}> {
  const res = await fetch(`${YELLOW_CARD_API}/payouts/${payoutId}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Yellow Card status failed: ${res.status}`);
  const data = await res.json();
  return { status: data.status, trackingRef: data.trackingReference };
}

export const NIGERIAN_BANKS = [
  { code: "firstbank", name: "First Bank Nigeria" },
  { code: "gtbank", name: "Guaranty Trust Bank" },
  { code: "zenith", name: "Zenith Bank" },
  { code: "access", name: "Access Bank" },
  { code: "uba", name: "United Bank for Africa" },
  { code: "stanbic", name: "Stanbic IBTC Bank" },
  { code: "fidelity", name: "Fidelity Bank" },
  { code: "union", name: "Union Bank" },
  { code: "sterling", name: "Sterling Bank" },
  { code: "wema", name: "Wema Bank" },
  { code: "kuda", name: "Kuda Bank" },
  { code: "opay", name: "OPay" },
  { code: "moniepoint", name: "Moniepoint" },
];

export const SUPPORTED_CURRENCIES = [
  { code: "NGN", symbol: "₦", country: "NG", name: "Nigerian Naira" },
  { code: "GHS", symbol: "₵", country: "GH", name: "Ghanaian Cedi" },
  { code: "KES", symbol: "KSh", country: "KE", name: "Kenyan Shilling" },
  { code: "ZAR", symbol: "R", country: "ZA", name: "South African Rand" },
];
