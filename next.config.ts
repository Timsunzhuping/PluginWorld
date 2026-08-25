import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 快照模式：README HTML 与 seed 数据随 serverless bundle 一起分发
  outputFileTracingIncludes: {
    "/plugins/**": ["./src/data/seed/**"],
    "/api/v1/**": ["./src/data/seed/**"],
    "/browse": ["./src/data/seed/plugins.json", "./src/data/seed/stats.json"],
    "/": ["./src/data/seed/plugins.json", "./src/data/seed/stats.json"],
    "/sitemap.xml": ["./src/data/seed/plugins.json"],
  },
};

export default nextConfig;
