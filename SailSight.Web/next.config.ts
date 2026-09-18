import type { NextConfig } from "next";

// Every external host the app loads map tiles from, used to build img-src below.
// A host the app requests but does not list here is refused by the browser with no
// visible error, which is how the OpenSeaMap overlay silently failed (issue #26).
// Keep in sync with the stub list in e2e/support/fixtures.ts.
const TILE_HOSTS = ["https://*.basemaps.cartocdn.com", "https://tiles.openseamap.org"];

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${TILE_HOSTS.join(" ")}`,
  "connect-src 'self'",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

// API proxying is handled at runtime by src/app/api/[...path]/route.ts,
// which reads process.env.API_BASE_URL when each request arrives.
// This avoids the build-time evaluation trap of next.config.ts rewrites.
const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: csp },
    ] }];
  },
};

export default nextConfig;
