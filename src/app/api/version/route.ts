import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns the version baked into the CURRENTLY deployed server bundle. A stale
// (bookmarked / home-screen) client carries an older baked value in its own
// bundle; comparing the two is how the UpdateBanner detects a real new deploy.
// Using the baked constant (not a static file) avoids false positives from a
// committed version.json that doesn't match the build.
export function GET() {
  return NextResponse.json(
    { version: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev" },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
