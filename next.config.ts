import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Snapshot mode: README HTML and seed data ship with the serverless bundle
  outputFileTracingIncludes: {
    "/plugins/**": ["./src/data/seed/**"],
    "/api/v1/**": ["./src/data/seed/**"],
    "/browse": ["./src/data/seed/plugins.json", "./src/data/seed/stats.json"],
    "/": ["./src/data/seed/plugins.json", "./src/data/seed/stats.json"],
    "/sitemap.xml": ["./src/data/seed/plugins.json"],
  },
};

export default nextConfig;
