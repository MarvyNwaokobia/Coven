/** Formatting helpers shared across the UI. */

export function formatUSDC(amount: number | string): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(n)) return "$0.00";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatLocal(amount: number, symbol = "₦"): string {
  return `${symbol}${Math.round(amount).toLocaleString("en-US")}`;
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const USERNAME_RULES = {
  minLength: 3,
  maxLength: 20,
  pattern: /^[a-zA-Z0-9_]+$/,
  reservedWords: ["coven", "admin", "support", "help", "official"],
};

export function validateUsername(username: string): string | null {
  const u = username.replace(/^@/, "").toLowerCase();
  if (u.length < USERNAME_RULES.minLength) return "At least 3 characters";
  if (u.length > USERNAME_RULES.maxLength) return "At most 20 characters";
  if (!USERNAME_RULES.pattern.test(u)) return "Letters, numbers and _ only";
  if (USERNAME_RULES.reservedWords.includes(u)) return "That username is reserved";
  return null;
}
