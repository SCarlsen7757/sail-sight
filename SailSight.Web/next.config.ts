import type { NextConfig } from "next";

// API proxying is handled at runtime by src/app/api/[...path]/route.ts,
// which reads process.env.API_BASE_URL when each request arrives.
// This avoids the build-time evaluation trap of next.config.ts rewrites.
const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;
