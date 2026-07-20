import QRCode from "qrcode";

/**
 * Payment URI format:
 *   paycircle://pay?to=@username&amount=50&currency=USDC&note=for+coffee
 * Static QR (any amount):  paycircle://pay?to=@godbrand
 */
export interface PaymentURIParams {
  username: string;
  amount?: number;
  currency?: string;
  note?: string;
}

export function buildPaymentURI(params: PaymentURIParams): string {
  const q = new URLSearchParams();
  q.set("to", `@${params.username.replace(/^@/, "")}`);
  if (params.amount) q.set("amount", String(params.amount));
  if (params.currency) q.set("currency", params.currency);
  if (params.note) q.set("note", params.note);
  return `paycircle://pay?${q.toString()}`;
}

export function parsePaymentURI(uri: string): PaymentURIParams | null {
  try {
    const url = new URL(uri.replace(/^paycircle:\/\//, "https://paycircle.app/"));
    const to = url.searchParams.get("to");
    if (!to) return null;
    return {
      username: to.replace(/^@/, ""),
      amount: url.searchParams.get("amount")
        ? Number(url.searchParams.get("amount"))
        : undefined,
      currency: url.searchParams.get("currency") ?? undefined,
      note: url.searchParams.get("note") ?? undefined,
    };
  } catch {
    return null;
  }
}

export async function generatePaymentQR(params: PaymentURIParams): Promise<string> {
  const uri = buildPaymentURI(params);
  return QRCode.toDataURL(uri, {
    width: 300,
    margin: 2,
    color: { dark: "#0F172A", light: "#FFFFFF" },
  });
}
