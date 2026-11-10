/**
 * Core-team access for internal pages such as the testnet tracker. Two ways in:
 *
 * - The shared access code in TESTNET_ACCESS_CODE, sent as the `x-access-code` header. There is no
 *   limit on attempts, so a code shorter than MIN_CODE_LENGTH is ignored rather than trusted.
 * - Signing in with a Google email listed in TESTNET_TEAM_EMAILS (comma separated). The email is
 *   read from the verified Supabase session, not from anything the client sends, and only counts
 *   once the account has confirmed it, so signing up with someone else's address gets nobody in.
 *
 * With both variables empty, nobody gets in.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase";

export const ACCESS_CODE_HEADER = "x-access-code";

/** Short enough to guess, so not accepted. `openssl rand -base64 18` makes 24 characters. */
export const MIN_CODE_LENGTH = 16;

let warnedShortCode = false;

export function teamEmails(): Set<string> {
  return new Set(
    (process.env.TESTNET_TEAM_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

/** Constant-time comparison, so response timing does not reveal how much of a guess was right. */
function codeMatches(given: string): boolean {
  const expected = process.env.TESTNET_ACCESS_CODE?.trim();
  if (!expected || !given) return false;
  if (expected.length < MIN_CODE_LENGTH) {
    if (!warnedShortCode) {
      warnedShortCode = true;
      console.warn(`TESTNET_ACCESS_CODE is shorter than ${MIN_CODE_LENGTH} characters, so it is ignored. Use a long random one.`);
    }
    return false;
  }
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(given.trim()), hash(expected));
}

/**
 * "team" when the request carries the access code or a core-team sign-in; "locked" when it carries
 * neither; "forbidden" when it tried (a wrong code, or an email not on the list).
 */
export async function teamAccess(req: Request): Promise<"team" | "locked" | "forbidden"> {
  const code = req.headers.get(ACCESS_CODE_HEADER);
  if (code && codeMatches(code)) return "team";

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (token) {
    const { data, error } = await getSupabaseAdmin().auth.getUser(token);
    const confirmed = !error && Boolean(data.user?.email_confirmed_at);
    const email = confirmed ? data.user?.email?.toLowerCase() : undefined;
    if (email && teamEmails().has(email)) return "team";
  }

  return code ? "forbidden" : "locked";
}
