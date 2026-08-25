import "server-only";
import fs from "node:fs";
import path from "node:path";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { getDb, hasDatabase, schema } from "./db";
import { queryPlugins, sortPlugins, trendingScore } from "./search";
import type {
  Ecosystem,
  MarketStats,
  Plugin,
  PluginQuery,
  PluginQueryResult,
} from "./types";
import { ECOSYSTEMS } from "./types";
import { CATEGORY_LABELS } from "./categories";

/**
 * Data access layer — dual mode:
 *  - DATABASE_URL set → Postgres (Drizzle + FTS, production mode)
 *  - unset → data/seed snapshot (demo/static mode, deployable out of the box)
 */

const SEED_DIR = path.join(process.cwd(), "src", "data", "seed");

let _snapshot: { plugins: Plugin[]; stats: MarketStats } | null = null;

function loadSnapshot(): { plugins: Plugin[]; stats: MarketStats } {
  if (_snapshot) return _snapshot;
  const pluginsPath = path.join(SEED_DIR, "plugins.json");
  const statsPath = path.join(SEED_DIR, "stats.json");
  const plugins: Plugin[] = fs.existsSync(pluginsPath)
    ? JSON.parse(fs.readFileSync(pluginsPath, "utf-8"))
    : [];
  const stats: MarketStats = fs.existsSync(statsPath)
    ? JSON.parse(fs.readFileSync(statsPath, "utf-8"))
    : {
        totalIndexed: plugins.length,
        sourceTotals: { dsh: 0, "claude-code": 0, mcp: 0 },
        byEcosystem: countByEcosystem(plugins),
        categories: [],
        lastSyncedAt: new Date(0).toISOString(),
      };
  _snapshot = { plugins, stats };
  return _snapshot;
}

function countByEcosystem(plugins: Plugin[]): Record<Ecosystem, number> {
  const out = { dsh: 0, "claude-code": 0, mcp: 0 } as Record<Ecosystem, number>;
  for (const p of plugins) out[p.ecosystem]++;
  return out;
}

// ---------- Row mapping (DB mode) ----------

type PluginRow = typeof schema.plugins.$inferSelect;

function rowToPlugin(row: PluginRow): Plugin {
  return {
    id: row.id,
    ecosystem: row.ecosystem as Ecosystem,
    slug: row.slug,
    name: row.name,
    description: row.description,
    repoUrl: row.repoUrl,
    homepage: row.homepage,
    ownerGithub: row.ownerGithub,
    license: row.license,
    manifest: (row.manifest as Record<string, unknown> | null) ?? null,
    categories: row.categories ?? [],
    keywords: row.keywords ?? [],
    stars: row.stars,
    downloads: row.downloads,
    forks: row.forks,
    versionLatest: row.versionLatest,
    lastCommitAt: row.lastCommitAt?.toISOString() ?? null,
    specValid: row.specValid,
    qualityScore: num(row.qualityScore),
    scoreBreakdown: {
      maintenance: num(row.scoreMaintenance),
      popularity: num(row.scorePopularity),
      compliance: num(row.scoreCompliance),
      security: num(row.scoreSecurity),
      docs: num(row.scoreDocs),
    },
    trustFlags: (row.trustFlags as Plugin["trustFlags"]) ?? {},
    securityGrade: (row.securityGrade as Plugin["securityGrade"]) ?? "B",
    securityFindings:
      (row.securityFindings as Plugin["securityFindings"]) ?? [],
    npmPackage: row.npmPackage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    syncedAt: row.syncedAt.toISOString(),
  };
}

function num(v: string | null): number {
  return v == null ? 0 : Number(v);
}

// ---------- Public API ----------

export async function listPlugins(query: PluginQuery): Promise<PluginQueryResult> {
  if (!hasDatabase()) {
    return queryPlugins(loadSnapshot().plugins, query);
  }
  const db = getDb();
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(100, Math.max(1, query.perPage ?? 24));
  const p = schema.plugins;

  const conds: SQL[] = [];
  if (query.ecosystem) conds.push(eq(p.ecosystem, query.ecosystem));
  if (query.category) conds.push(sql`${query.category} = ANY(${p.categories})`);
  if (query.q?.trim()) {
    const q = query.q.trim();
    // FTS (name+description, uses the gin index) + keywords array overlap
    conds.push(
      sql`(to_tsvector('simple', coalesce(${p.name},'') || ' ' || coalesce(${p.description},'')) @@ websearch_to_tsquery('simple', ${q}) OR ${p.keywords} && string_to_array(lower(${q}), ' '))`,
    );
  }
  const where = conds.length ? and(...conds) : undefined;

  const orderBy = (() => {
    if (query.q?.trim()) {
      return sql`ts_rank(to_tsvector('simple', coalesce(${p.name},'') || ' ' || coalesce(${p.description},'')), websearch_to_tsquery('simple', ${query.q!.trim()})) DESC, ${p.qualityScore} DESC NULLS LAST`;
    }
    switch (query.sort ?? "score") {
      case "stars":
        return sql`${p.stars} DESC`;
      case "updated":
        return sql`${p.lastCommitAt} DESC NULLS LAST`;
      case "trending":
        return sql`(ln(1 + ${p.stars} + ${p.downloads} / 50.0) / ln(10)) * (0.35 + 0.65 * power(0.5, greatest(0, extract(epoch from (now() - coalesce(${p.lastCommitAt}, 'epoch'::timestamptz))) / 86400.0 / 30.0))) DESC`;
      case "score":
      default:
        return sql`${p.qualityScore} DESC NULLS LAST`;
    }
  })();

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(p)
      .where(where)
      .orderBy(orderBy)
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ count: sql<number>`count(*)::int` }).from(p).where(where),
  ]);

  return {
    items: rows.map(rowToPlugin),
    total: countRows[0]?.count ?? 0,
    page,
    perPage,
  };
}

export async function getPlugin(slug: string): Promise<Plugin | null> {
  if (!hasDatabase()) {
    return loadSnapshot().plugins.find((p) => p.slug === slug) ?? null;
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.plugins)
    .where(eq(schema.plugins.slug, slug))
    .limit(1);
  return rows[0] ? rowToPlugin(rows[0]) : null;
}

export async function getReadmeHtml(slug: string): Promise<string | null> {
  if (hasDatabase()) {
    const db = getDb();
    const rows = await db
      .select({ readmeHtml: schema.plugins.readmeHtml })
      .from(schema.plugins)
      .where(eq(schema.plugins.slug, slug))
      .limit(1);
    return rows[0]?.readmeHtml ?? null;
  }
  const file = path.join(SEED_DIR, "readmes", slug.replaceAll("/", "__") + ".html");
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf-8");
}

export async function getTrending(limit = 8): Promise<Plugin[]> {
  const { items } = await listPlugins({ sort: "trending", perPage: limit });
  return items;
}

export async function getTopByEcosystem(limit = 6): Promise<Record<Ecosystem, Plugin[]>> {
  const out = {} as Record<Ecosystem, Plugin[]>;
  for (const eco of ECOSYSTEMS) {
    const { items } = await listPlugins({ ecosystem: eco, sort: "score", perPage: limit });
    out[eco] = items;
  }
  return out;
}

export async function getSimilar(plugin: Plugin, limit = 4): Promise<Plugin[]> {
  const cat = plugin.categories[0];
  const { items } = await listPlugins({
    ecosystem: plugin.ecosystem,
    category: cat,
    sort: "score",
    perPage: limit + 1,
  });
  return items.filter((p) => p.slug !== plugin.slug).slice(0, limit);
}

export async function getAllSlugs(): Promise<string[]> {
  if (!hasDatabase()) {
    return loadSnapshot().plugins.map((p) => p.slug);
  }
  const db = getDb();
  const rows = await db.select({ slug: schema.plugins.slug }).from(schema.plugins);
  return rows.map((r) => r.slug);
}

export async function getStats(): Promise<MarketStats> {
  if (!hasDatabase()) {
    const { stats, plugins } = loadSnapshot();
    return { ...stats, totalIndexed: plugins.length, byEcosystem: countByEcosystem(plugins) };
  }
  const db = getDb();
  const p = schema.plugins;
  const rows = await db
    .select({ ecosystem: p.ecosystem, count: sql<number>`count(*)::int` })
    .from(p)
    .groupBy(p.ecosystem);
  const byEcosystem = { dsh: 0, "claude-code": 0, mcp: 0 } as Record<Ecosystem, number>;
  for (const r of rows) byEcosystem[r.ecosystem as Ecosystem] = r.count;
  const catRows = await db.execute(
    sql`SELECT unnest(categories) AS name, count(*)::int AS count FROM plugins GROUP BY 1 ORDER BY 2 DESC LIMIT 30`,
  );
  const sourceRows = await db
    .select({ status: schema.syncSources.status, lastRunAt: schema.syncSources.lastRunAt })
    .from(schema.syncSources);
  const sourceTotals = { dsh: 0, "claude-code": 0, mcp: 0 } as Record<Ecosystem, number>;
  let lastSyncedAt = new Date(0);
  for (const s of sourceRows) {
    const st = s.status as { ecosystem?: Ecosystem; sourceTotal?: number } | null;
    if (st?.ecosystem && typeof st.sourceTotal === "number") {
      sourceTotals[st.ecosystem] += st.sourceTotal;
    }
    if (s.lastRunAt && s.lastRunAt > lastSyncedAt) lastSyncedAt = s.lastRunAt;
  }
  return {
    totalIndexed: byEcosystem.dsh + byEcosystem["claude-code"] + byEcosystem.mcp,
    sourceTotals,
    byEcosystem,
    categories: (catRows as unknown as { name: string; count: number }[]).filter(
      (c) => c.name in CATEGORY_LABELS,
    ),
    lastSyncedAt: lastSyncedAt.toISOString(),
  };
}

export { sortPlugins, trendingScore };
