/**
 * 收录管道编排（方案 §6）：
 *   1. GitHub topic 抓取（dsh-plugin / claude-code-plugin / mcp-server）
 *   2. 官方 MCP Registry 同步并与 GitHub 结果合并（registryListed）
 *   3. 对每个 repo：fetch manifest + README → schema 校验 → install script 扫描 → 打分
 *   4. 写快照 src/data/seed/（站点 demo 模式直接消费）
 *   5. DATABASE_URL 存在时 upsert Postgres 并记录 sync_sources
 *
 * 用法：npx tsx scripts/sync/run-all.ts [--pages 2] [--limit N] [--db]
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fetchTopicRepos, manifestPaths, type GithubRepo } from "./github-topic";
import { fetchRegistryServers, registryRepoFullName, type RegistryServer } from "./mcp-registry";
import { RAW_BASE, OFFICIAL_OWNERS, fetchJson, fetchText, pooled, renderReadme } from "./lib";
import { validateManifest } from "../../src/lib/validators";
import { computeScore, percentile, scanInstallScripts } from "../../src/lib/scoring";
import { deriveCategories } from "../../src/lib/categories";
import type { Ecosystem, Plugin } from "../../src/lib/types";

const SEED_DIR = path.join(process.cwd(), "src", "data", "seed");
const README_DIR = path.join(SEED_DIR, "readmes");

interface RawEntry {
  ecosystem: Ecosystem;
  owner: string;
  name: string;
  repoFullName: string | null;
  description: string | null;
  repoUrl: string | null;
  homepage: string | null;
  license: string | null;
  topics: string[];
  stars: number;
  forks: number;
  pushedAt: string | null;
  createdAt: string | null;
  registryServer: RegistryServer | null;
}

function slugFor(e: RawEntry): string {
  return `${e.ecosystem}/${e.owner.toLowerCase()}/${e.name.toLowerCase()}`;
}

/** slug → 确定性 UUID（重复 sync 保持稳定） */
function stableId(slug: string): string {
  const h = createHash("sha256").update(`pluginworld:${slug}`).digest("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    "5" + h.slice(13, 16),
    ((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20),
    h.slice(20, 32),
  ].join("-");
}

function repoToRaw(repo: GithubRepo, ecosystem: Ecosystem): RawEntry {
  return {
    ecosystem,
    owner: repo.owner.login,
    name: repo.name,
    repoFullName: repo.full_name,
    description: repo.description,
    repoUrl: repo.html_url,
    homepage: repo.homepage || null,
    license: repo.license?.spdx_id === "NOASSERTION" ? null : (repo.license?.spdx_id ?? null),
    topics: repo.topics ?? [],
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    pushedAt: repo.pushed_at,
    createdAt: repo.created_at,
    registryServer: null,
  };
}

function registryToRaw(server: RegistryServer): RawEntry {
  const [namespace, ...rest] = server.name.split("/");
  const repoFull = registryRepoFullName(server);
  return {
    ecosystem: "mcp",
    owner: repoFull ? repoFull.split("/")[0] : namespace,
    // slug 为三段式 {ecosystem}/{owner}/{name}，name 中的斜杠需折叠
    name: repoFull ? repoFull.split("/")[1] : rest.join("-") || namespace,
    repoFullName: repoFull,
    description: server.description ?? null,
    repoUrl: repoFull ? `https://github.com/${repoFull}` : (server.repository?.url ?? null),
    homepage: server.websiteUrl ?? null,
    license: null,
    topics: [],
    stars: 0,
    forks: 0,
    pushedAt: null,
    createdAt: null,
    registryServer: server,
  };
}

async function fetchManifest(
  entry: RawEntry,
): Promise<Record<string, unknown> | null> {
  // registry 条目自带 server.json 形态的 manifest
  if (entry.registryServer) return entry.registryServer as unknown as Record<string, unknown>;
  if (!entry.repoFullName) return null;
  for (const p of manifestPaths(entry.ecosystem)) {
    const text = await fetchText(`${RAW_BASE}/${entry.repoFullName}/HEAD/${p}`);
    if (!text) continue;
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      /* 无效 JSON → 尝试下一个路径 */
    }
  }
  return null;
}

async function fetchReadme(entry: RawEntry): Promise<string | null> {
  if (!entry.repoFullName) return null;
  for (const name of ["README.md", "readme.md", "Readme.md", "README.MD"]) {
    const text = await fetchText(`${RAW_BASE}/${entry.repoFullName}/HEAD/${name}`);
    if (text && text.trim().length > 0) return text;
  }
  return null;
}

async function fetchNpmDownloads(pkg: string): Promise<number> {
  const encoded = pkg.startsWith("@") ? pkg.replace("/", "%2F") : pkg;
  const data = await fetchJson<{ downloads?: number }>(
    `https://api.npmjs.org/downloads/point/last-month/${encoded}`,
    undefined,
    1,
  );
  return data?.downloads ?? 0;
}

async function main() {
  const args = process.argv.slice(2);
  const getFlag = (name: string): string | undefined => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const pages = parseInt(getFlag("pages") ?? "2", 10);
  const limit = parseInt(getFlag("limit") ?? "0", 10);
  const writeDb = args.includes("--db") && Boolean(process.env.DATABASE_URL);

  console.log(`[sync] start pages=${pages} limit=${limit || "∞"} db=${writeDb}`);
  const startedAt = new Date();

  // 1. 三大 topic + registry 并行抓取
  const [dsh, claudeCode, mcpTopic, registry] = await Promise.all([
    fetchTopicRepos("dsh", pages),
    fetchTopicRepos("claude-code", pages),
    fetchTopicRepos("mcp", pages),
    fetchRegistryServers(),
  ]);

  // 2. 归一化 + MCP 合并去重
  const entries: RawEntry[] = [];
  const cap = <T,>(arr: T[]) => (limit > 0 ? arr.slice(0, limit) : arr);
  for (const repo of cap(dsh.repos)) entries.push(repoToRaw(repo, "dsh"));
  for (const repo of cap(claudeCode.repos)) entries.push(repoToRaw(repo, "claude-code"));

  const mcpByRepo = new Map<string, RawEntry>();
  for (const repo of cap(mcpTopic.repos)) {
    const raw = repoToRaw(repo, "mcp");
    mcpByRepo.set(repo.full_name.toLowerCase(), raw);
  }
  let registryMerged = 0;
  let registryOnly = 0;
  for (const server of registry.servers.values()) {
    const repoFull = registryRepoFullName(server)?.toLowerCase();
    const existing = repoFull ? mcpByRepo.get(repoFull) : undefined;
    if (existing) {
      existing.registryServer = server;
      registryMerged++;
    } else if (registryOnly < 150 && (server.repository?.url || server.remotes?.length)) {
      const raw = registryToRaw(server);
      const key = raw.repoFullName?.toLowerCase() ?? `registry:${server.name}`;
      if (!mcpByRepo.has(key)) {
        mcpByRepo.set(key, raw);
        registryOnly++;
      }
    }
  }
  entries.push(...cap([...mcpByRepo.values()]));
  console.log(
    `[sync] normalized ${entries.length} entries (registry merged: ${registryMerged}, registry-only: ${registryOnly})`,
  );

  // 3. manifest + README + 校验 + 扫描（并发池）
  fs.mkdirSync(README_DIR, { recursive: true });
  const now = new Date();
  const enriched = await pooled(entries, 12, async (entry, i) => {
    if (i > 0 && i % 100 === 0) console.log(`  …${i}/${entries.length}`);
    const [manifest, readmeMd] = await Promise.all([
      fetchManifest(entry),
      fetchReadme(entry),
    ]);
    const validation = validateManifest(entry.ecosystem, manifest);
    const readme = readmeMd ? renderReadme(readmeMd, entry.repoFullName) : null;
    const suspicious = scanInstallScripts(manifest);
    // private: true 的 package.json（monorepo 根）不可 npm install
    const isPrivatePkg =
      manifest != null && (manifest as { private?: unknown }).private === true;
    const npmPackage = isPrivatePkg ? null : (validation.extracted.npmPackage ?? null);
    const registryStars = entry.registryServer
      ? await fetchGithubStarsIfMissing(entry)
      : null;
    return { entry, manifest, validation, readme, suspicious, npmPackage, isPrivatePkg, registryStars };
  });

  // registry-only 条目补 stars（避免 60/hr core 限额：仅在有 token 时做）
  async function fetchGithubStarsIfMissing(entry: RawEntry): Promise<{
    stars: number; forks: number; pushedAt: string | null; license: string | null;
  } | null> {
    if (entry.stars > 0 || !entry.repoFullName || !process.env.GITHUB_TOKEN) return null;
    const repo = await fetchJson<GithubRepo>(
      `https://api.github.com/repos/${entry.repoFullName}`,
      { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } },
      1,
    );
    if (!repo) return null;
    return {
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      pushedAt: repo.pushed_at,
      license: repo.license?.spdx_id === "NOASSERTION" ? null : (repo.license?.spdx_id ?? null),
    };
  }

  // 4. npm 下载量（dsh / 有 npm 包的 mcp）
  const withNpm = enriched.filter((e) => e.npmPackage);
  console.log(`[sync] fetching npm downloads for ${withNpm.length} packages`);
  const downloadsMap = new Map<string, number>();
  // npm API 限流较紧：低并发 + 温和节流
  await pooled(withNpm, 3, async (e) => {
    downloadsMap.set(e.npmPackage!, await fetchNpmDownloads(e.npmPackage!));
    await new Promise((r) => setTimeout(r, 150));
  });

  // 5. 生态内百分位 + 评分
  const starsByEco = new Map<Ecosystem, number[]>();
  const dlByEco = new Map<Ecosystem, number[]>();
  for (const e of enriched) {
    const stars = e.registryStars?.stars ?? e.entry.stars;
    push(starsByEco, e.entry.ecosystem, stars);
    const dl = e.npmPackage ? (downloadsMap.get(e.npmPackage) ?? 0) : 0;
    if (dl > 0) push(dlByEco, e.entry.ecosystem, dl);
  }
  for (const arr of starsByEco.values()) arr.sort((a, b) => a - b);
  for (const arr of dlByEco.values()) arr.sort((a, b) => a - b);

  const plugins: Plugin[] = [];
  const seenSlugs = new Set<string>();
  for (const e of enriched) {
    const { entry, manifest, validation, readme, suspicious, npmPackage, isPrivatePkg } = e;
    const slug = slugFor(entry);
    if (seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);

    const stars = e.registryStars?.stars ?? entry.stars;
    const forks = e.registryStars?.forks ?? entry.forks;
    const pushedAt = e.registryStars?.pushedAt ?? entry.pushedAt;
    const license = entry.license ?? e.registryStars?.license ?? null;
    const downloads = npmPackage ? (downloadsMap.get(npmPackage) ?? 0) : 0;
    const officialOwner = OFFICIAL_OWNERS.has(entry.owner.toLowerCase());
    const registryListed = Boolean(entry.registryServer);

    const dlArr = dlByEco.get(entry.ecosystem) ?? [];
    const { total, breakdown } = computeScore({
      lastCommitAt: pushedAt ? new Date(pushedAt) : null,
      starsPercentile: percentile(stars, starsByEco.get(entry.ecosystem) ?? []),
      downloadsPercentile:
        downloads > 0 && dlArr.length > 0 ? percentile(downloads, dlArr) : null,
      specValid: validation.valid,
      hasManifest: manifest != null,
      hasLicense: license != null,
      suspiciousInstallScript: suspicious,
      verifiedOwner: officialOwner, // 认领后的 verifiedOwner 在 DB 模式下叠加
      readmeLength: readme?.textLength ?? 0,
      readmeHasCodeExample: readme?.hasCodeExample ?? false,
      readmeHasStructure: readme?.hasStructure ?? false,
      now,
    });

    const keywords = [
      ...new Set(
        [...entry.topics, ...(validation.extracted.keywords ?? [])]
          .map((k) => k.toLowerCase())
          .filter((k) => k.length <= 40),
      ),
    ].slice(0, 20);

    if (readme) {
      fs.writeFileSync(
        path.join(README_DIR, slug.replaceAll("/", "__") + ".html"),
        readme.html,
        "utf-8",
      );
    }

    plugins.push({
      id: stableId(slug),
      ecosystem: entry.ecosystem,
      slug,
      name: isPrivatePkg
        ? entry.name
        : (validation.extracted.name?.replace(/^@[^/]+\//, "") ?? entry.name),
      description: entry.description ?? validation.extracted.description ?? null,
      repoUrl: entry.repoUrl,
      homepage: entry.homepage,
      ownerGithub: entry.repoFullName ? entry.owner : null,
      license,
      manifest,
      categories: deriveCategories(keywords, entry.description, entry.name),
      keywords,
      stars,
      downloads,
      forks,
      versionLatest: cleanVersion(validation.extracted.version),
      lastCommitAt: pushedAt,
      specValid: validation.valid,
      qualityScore: total,
      scoreBreakdown: breakdown,
      trustFlags: {
        specValid: validation.valid,
        hasLicense: license != null,
        officialOwner,
        registryListed,
        verifiedOwner: officialOwner,
      },
      npmPackage,
      createdAt: entry.createdAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
      syncedAt: now.toISOString(),
    });
  }

  plugins.sort((a, b) => b.qualityScore - a.qualityScore);

  // 6. 写快照
  fs.mkdirSync(SEED_DIR, { recursive: true });
  fs.writeFileSync(path.join(SEED_DIR, "plugins.json"), JSON.stringify(plugins, null, 1));
  const categoryCounts = new Map<string, number>();
  for (const p of plugins) {
    for (const c of p.categories) categoryCounts.set(c, (categoryCounts.get(c) ?? 0) + 1);
  }
  const stats = {
    totalIndexed: plugins.length,
    sourceTotals: {
      dsh: dsh.totalCount,
      "claude-code": claudeCode.totalCount,
      mcp: mcpTopic.totalCount + registry.servers.size,
    },
    byEcosystem: {
      dsh: plugins.filter((p) => p.ecosystem === "dsh").length,
      "claude-code": plugins.filter((p) => p.ecosystem === "claude-code").length,
      mcp: plugins.filter((p) => p.ecosystem === "mcp").length,
    },
    categories: [...categoryCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    lastSyncedAt: now.toISOString(),
  };
  fs.writeFileSync(path.join(SEED_DIR, "stats.json"), JSON.stringify(stats, null, 2));
  console.log(
    `[sync] snapshot written: ${plugins.length} plugins`,
    stats.byEcosystem,
    `spec_valid: ${plugins.filter((p) => p.specValid).length}`,
  );

  // 7. DB upsert（可选）
  if (writeDb) {
    const { upsertPlugins } = await import("../db/upsert");
    await upsertPlugins(plugins, stats, startedAt);
  }

  console.log(`[sync] done in ${((Date.now() - startedAt.getTime()) / 1000).toFixed(0)}s`);
}

/** 过滤 CI 占位符版本（如 ${VERSION}）与超长串 */
function cleanVersion(v: string | undefined): string | null {
  if (!v) return null;
  if (v.includes("$") || v.includes("{") || v.length > 32) return null;
  return v;
}

function push<K>(map: Map<K, number[]>, key: K, value: number) {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
