import { NextResponse } from "next/server";
import { listPlugins } from "@/lib/data";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { ECOSYSTEMS, type Ecosystem, type SortKey } from "@/lib/types";

/**
 * GET /api/v1/plugins?q=&ecosystem=&category=&sort=score|stars|trending&page=&per_page=
 * Public read-only API (spec §7), styled after the official MCP Registry, for AI agents to consume.
 */
export async function GET(req: Request) {
  const { ok, remaining } = rateLimit(clientIp(req));
  if (!ok) {
    return NextResponse.json(
      { error: "rate_limited", message: "Max 60 requests per minute." },
      { status: 429 },
    );
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.slice(0, 200) ?? undefined;
  const ecosystemRaw = url.searchParams.get("ecosystem") ?? undefined;
  const ecosystem = ECOSYSTEMS.includes(ecosystemRaw as Ecosystem)
    ? (ecosystemRaw as Ecosystem)
    : undefined;
  if (ecosystemRaw && !ecosystem) {
    return NextResponse.json(
      { error: "invalid_ecosystem", allowed: ECOSYSTEMS },
      { status: 400 },
    );
  }
  const category = url.searchParams.get("category") ?? undefined;
  const sortRaw = url.searchParams.get("sort") ?? "score";
  const sort: SortKey = (["score", "stars", "trending", "updated"] as const).includes(
    sortRaw as SortKey,
  )
    ? (sortRaw as SortKey)
    : "score";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("per_page") ?? "24", 10) || 24),
  );

  const result = await listPlugins({ q, ecosystem, category, sort, page, perPage });

  return NextResponse.json(
    {
      total: result.total,
      page: result.page,
      per_page: result.perPage,
      items: result.items.map((p) => ({
        slug: p.slug,
        ecosystem: p.ecosystem,
        name: p.name,
        description: p.description,
        repo_url: p.repoUrl,
        homepage: p.homepage,
        owner_github: p.ownerGithub,
        license: p.license,
        categories: p.categories,
        keywords: p.keywords,
        stars: p.stars,
        downloads: p.downloads,
        forks: p.forks,
        version_latest: p.versionLatest,
        last_commit_at: p.lastCommitAt,
        spec_valid: p.specValid,
        quality_score: p.qualityScore,
        score_breakdown: p.scoreBreakdown,
        trust_flags: p.trustFlags,
        npm_package: p.npmPackage,
        url: `https://www.pluginworld.ai/plugins/${p.slug}`,
      })),
    },
    {
      headers: {
        "X-RateLimit-Remaining": String(remaining),
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
