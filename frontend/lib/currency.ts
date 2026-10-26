/**
 * Display currencies for the dashboard. Shared by client and server (no imports, no I/O).
 * Balances stay in USDC; these only drive the "≈ local" estimate.
 */

export interface DisplayCurrency {
  code: string;
  symbol: string;
  name: string;
  /** ISO country codes that default to this currency. */
  countries: string[];
}

export const DISPLAY_CURRENCIES: DisplayCurrency[] = [
  { code: "NGN", symbol: "₦", name: "Nigerian Naira", countries: ["NG"] },
  { code: "GHS", symbol: "₵", name: "Ghanaian Cedi", countries: ["GH"] },
  { code: "KES", symbol: "KSh ", name: "Kenyan Shilling", countries: ["KE"] },
  { code: "ZAR", symbol: "R", name: "South African Rand", countries: ["ZA"] },
  { code: "USD", symbol: "$", name: "US Dollar", countries: ["US"] },
];

export const DEFAULT_CURRENCY = "NGN";

export function getCurrency(code: string | null | undefined): DisplayCurrency | null {
  if (!code) return null;
  return DISPLAY_CURRENCIES.find((c) => c.code === code.toUpperCase()) ?? null;
}

const TIMEZONE_COUNTRY: Record<string, string> = {
  "Africa/Lagos": "NG",
  "Africa/Accra": "GH",
  "Africa/Nairobi": "KE",
  "Africa/Johannesburg": "ZA",
};

function currencyForCountry(country: string | null | undefined): string | null {
  if (!country) return null;
  const c = country.toUpperCase();
  return DISPLAY_CURRENCIES.find((d) => d.countries.includes(c))?.code ?? null;
}

/**
 * Best guess at the viewer's local currency without asking for GPS: the device time zone follows
 * the person as they travel, the browser locale region (en-GH) is the fallback.
 */
export function detectCurrency(
  timeZone: string | undefined = safeTimeZone(),
  locales: readonly string[] = safeLocales()
): string {
  const byZone = currencyForCountry(timeZone ? TIMEZONE_COUNTRY[timeZone] : null);
  if (byZone) return byZone;
  for (const l of locales) {
    const region = l.split("-")[1];
    const byLocale = currencyForCountry(region);
    if (byLocale) return byLocale;
  }
  return DEFAULT_CURRENCY;
}

function safeTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

function safeLocales(): readonly string[] {
  return typeof navigator !== "undefined" ? (navigator.languages ?? [navigator.language]) : [];
}
