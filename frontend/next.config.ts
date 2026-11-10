import type { NextConfig } from "next";

// One id per deploy, baked into both the browser bundle and the server, so an already-open app can
// tell when a newer deploy exists (see components/UpdatePrompt.tsx and /api/version).
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA ?? `local-${Date.now()}`;

const nextConfig: NextConfig = {
  generateBuildId: async () => BUILD_ID,
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  // Short link to the testnet whitepaper (public/coven-testnet-whitepaper.pdf). Temporary, so a new
  // version can take over the same URL.
  async redirects() {
    return [{ source: "/whitepaper", destination: "/coven-testnet-whitepaper.pdf", permanent: false }];
  },
};

export default nextConfig;
