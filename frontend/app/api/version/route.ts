import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** GET /api/version - the id of the deploy currently being served. Never cached. */
export async function GET() {
  return NextResponse.json(
    { build: process.env.NEXT_PUBLIC_BUILD_ID ?? null },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
