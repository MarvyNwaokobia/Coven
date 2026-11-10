import { NextResponse } from "next/server";
import { TRACKER_ENABLED } from "@/lib/testnet";
import { cachedTracker } from "@/lib/server/testnet-tracker";
import { teamAccess } from "@/lib/server/team";

/**
 * GET /api/testnet - the testnet tracker data: totals, each tester's progress through the eligibility
 * stages, and the latest transactions. Testnet only (404 on mainnet), and core team only: the request
 * needs the access code (TESTNET_ACCESS_CODE) or a team sign-in (TESTNET_TEAM_EMAILS). No credentials
 * gets 401, a wrong code gets 403. Never includes emails or phone numbers. A tester's own progress
 * comes from /api/testnet/me instead.
 */
const PRIVATE = { "cache-control": "private, no-store" };

export async function GET(req: Request) {
  if (!TRACKER_ENABLED) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await teamAccess(req);
  if (access === "locked") return NextResponse.json({ error: "Enter the access code to view the tracker" }, { status: 401, headers: PRIVATE });
  if (access === "forbidden") return NextResponse.json({ error: "That access code is not right" }, { status: 403, headers: PRIVATE });

  try {
    return NextResponse.json(await cachedTracker(), { headers: PRIVATE });
  } catch (e) {
    console.error("testnet tracker failed", e);
    return NextResponse.json({ error: "Tracker is unavailable right now" }, { status: 503, headers: PRIVATE });
  }
}
