/** Upsert snapshot data into Postgres (shared by the sync pipeline and the seed script) */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "../../src/lib/db/schema";
import type { MarketStats, Plugin } from "../../src/lib/types";

export async function upsertPlugins(
  plugins: Plugin[],
  stats: MarketStats,
  startedAt: Date,
): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 4 });
  const db = drizzle(client, { schema });

  console.log(`[db] upserting ${plugins.length} plugins…`);
  const chunkSize = 50;
  for (let i = 0; i < plugins.length; i += chunkSize) {
    const chunk = plugins.slice(i, i + chunkSize);
    await db
      .insert(schema.plugins)
      .values(
        chunk.map((p) => ({
          id: p.id,
          ecosystem: p.ecosystem,
          slug: p.slug,
          name: p.name,
          description: p.description,
          repoUrl: p.repoUrl,
          homepage: p.homepage,
          ownerGithub: p.ownerGithub,
          license: p.license,
          manifest: p.manifest,
          categories: p.categories,
          keywords: p.keywords,
          stars: p.stars,
          downloads: p.downloads,
          forks: p.forks,
          versionLatest: p.versionLatest,
          lastCommitAt: p.lastCommitAt ? new Date(p.lastCommitAt) : null,
          specValid: p.specValid,
          qualityScore: String(p.qualityScore),
          scoreMaintenance: String(p.scoreBreakdown.maintenance),
          scorePopularity: String(p.scoreBreakdown.popularity),
          scoreCompliance: String(p.scoreBreakdown.compliance),
          scoreSecurity: String(p.scoreBreakdown.security),
          scoreDocs: String(p.scoreBreakdown.docs),
          trustFlags: p.trustFlags,
          securityGrade: p.securityGrade,
          securityFindings: p.securityFindings,
          npmPackage: p.npmPackage,
          syncedAt: new Date(p.syncedAt),
        })),
      )
      .onConflictDoUpdate({
        target: schema.plugins.slug,
        set: {
          description: sql`excluded.description`,
          homepage: sql`excluded.homepage`,
          license: sql`excluded.license`,
          manifest: sql`excluded.manifest`,
          categories: sql`excluded.categories`,
          keywords: sql`excluded.keywords`,
          stars: sql`excluded.stars`,
          downloads: sql`excluded.downloads`,
          forks: sql`excluded.forks`,
          versionLatest: sql`excluded.version_latest`,
          lastCommitAt: sql`excluded.last_commit_at`,
          specValid: sql`excluded.spec_valid`,
          qualityScore: sql`excluded.quality_score`,
          scoreMaintenance: sql`excluded.score_maintenance`,
          scorePopularity: sql`excluded.score_popularity`,
          scoreCompliance: sql`excluded.score_compliance`,
          scoreSecurity: sql`excluded.score_security`,
          scoreDocs: sql`excluded.score_docs`,
          // Preserve existing verifiedOwner claim flags
          trustFlags: sql`coalesce(plugins.trust_flags, '{}'::jsonb) || excluded.trust_flags`,
          securityGrade: sql`excluded.security_grade`,
          securityFindings: sql`excluded.security_findings`,
          npmPackage: sql`excluded.npm_package`,
          updatedAt: sql`now()`,
          syncedAt: sql`excluded.synced_at`,
        },
      });
  }

  // Update READMEs in a separate pass (large column; avoids building one huge SQL statement)
  const fs = await import("node:fs");
  const path = await import("node:path");
  const readmeDir = path.join(process.cwd(), "src", "data", "seed", "readmes");
  let readmeCount = 0;
  for (const p of plugins) {
    const file = path.join(readmeDir, p.slug.replaceAll("/", "__") + ".html");
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, "utf-8");
    await client`UPDATE plugins SET readme_html = ${html} WHERE slug = ${p.slug}`;
    readmeCount++;
  }
  console.log(`[db] readme_html updated for ${readmeCount} plugins`);

  // sync_sources records
  for (const eco of ["dsh", "claude-code", "mcp"] as const) {
    await client`
      INSERT INTO sync_sources (type, config, last_run_at, status)
      VALUES (
        ${eco === "mcp" ? "mcp_registry" : "github_topic"},
        ${JSON.stringify({ ecosystem: eco })}::jsonb,
        now(),
        ${JSON.stringify({
          ecosystem: eco,
          ok: true,
          indexed: stats.byEcosystem[eco],
          sourceTotal: stats.sourceTotals[eco],
          startedAt: startedAt.toISOString(),
        })}::jsonb
      )
    `;
  }

  await client.end();
  console.log("[db] upsert complete");
}
