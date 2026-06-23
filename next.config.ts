import type { NextConfig } from "next";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

// A unique build version, baked into the client bundle (NEXT_PUBLIC_APP_VERSION)
// and written to /public/version.json. A stale, bookmarked PWA will see its
// baked version differ from the live version.json and prompt the user to update.
const APP_VERSION =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
  process.env.APP_VERSION ||
  String(Date.now());

try {
  writeFileSync(
    join(process.cwd(), "public", "version.json"),
    JSON.stringify({ version: APP_VERSION }) + "\n",
  );
} catch {
  // best-effort: a read-only FS just means the banner won't false-trigger
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
  },
};

export default nextConfig;
