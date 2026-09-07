import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack doesn't walk up to the stray
  // package-lock.json in ~/Developer/rizq, outside this repo.
  turbopack: { root: path.resolve(__dirname) },
  experimental: {
    // Keep visited routes in the client Router Cache. Next defaults dynamic
    // routes to 0s, so re-opening an opportunity you'd already viewed (or
    // hitting Back to the noticeboard) refetched and re-rendered from
    // scratch every time. 3 minutes is long enough that browsing feels
    // instant, short enough that a drive's status stays fresh.
    staleTimes: { dynamic: 180, static: 300 },
  },
};

export default nextConfig;
