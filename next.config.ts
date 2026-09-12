import type { NextConfig } from "next";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

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
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
  },
};

export default nextConfig;
