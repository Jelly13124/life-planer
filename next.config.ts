import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compile the workspace domain package (@lifeplanner/core ships raw TS).
  // The web app imports the domain via the "@/domain/*" alias (repointed to
  // ./packages/core/src in tsconfig); transpilePackages ensures Next/Turbopack
  // also transpiles it when reached as the symlinked workspace package.
  transpilePackages: ["@lifeplanner/core"],
  async headers() {
    return [
      {
        // service worker：用正确的 MIME 提供，且不缓存（确保拿到最新）。
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        // 基础安全响应头（克制、不影响功能）。
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
