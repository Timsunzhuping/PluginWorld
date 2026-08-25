import { NextResponse } from "next/server";
import { getPlugin, getReadmeHtml } from "@/lib/data";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { installOptions } from "@/lib/install";

/** GET /api/v1/plugins/{ecosystem}/{owner}/{name}?include=readme */
export async function GET(
  req: Request,
  {
    params,
  }: {
    params: Promise<{ ecosystem: string; owner: string; name: string }>;
  },
) {
  const { ok } = rateLimit(clientIp(req));
  if (!ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const { ecosystem, owner, name } = await params;
  const slug = `${ecosystem}/${owner}/${name}`;
  const plugin = await getPlugin(slug);
  if (!plugin) {
    return NextResponse.json({ error: "not_found", slug }, { status: 404 });
  }
  const url = new URL(req.url);
  const includeReadme = url.searchParams.get("include") === "readme";

  return NextResponse.json(
    {
      slug: plugin.slug,
      ecosystem: plugin.ecosystem,
      name: plugin.name,
      description: plugin.description,
      repo_url: plugin.repoUrl,
      homepage: plugin.homepage,
      owner_github: plugin.ownerGithub,
      license: plugin.license,
      manifest: plugin.manifest,
      categories: plugin.categories,
      keywords: plugin.keywords,
      stars: plugin.stars,
      downloads: plugin.downloads,
      forks: plugin.forks,
      version_latest: plugin.versionLatest,
      last_commit_at: plugin.lastCommitAt,
      spec_valid: plugin.specValid,
      quality_score: plugin.qualityScore,
      score_breakdown: plugin.scoreBreakdown,
      security_grade: plugin.securityGrade,
      security_findings: plugin.securityFindings,
      trust_flags: plugin.trustFlags,
      npm_package: plugin.npmPackage,
      install: installOptions(plugin),
      readme_html: includeReadme ? await getReadmeHtml(slug) : undefined,
      synced_at: plugin.syncedAt,
      url: `https://www.pluginworld.ai/plugins/${plugin.slug}`,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
