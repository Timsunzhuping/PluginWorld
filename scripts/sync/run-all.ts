/**
 * Ingestion pipeline orchestration (spec §6) — daily full-community scan:
 *
 *   Sources (the world's mainstream plugin communities):
 *     1. GitHub topics: dsh-plugin / claude-code-plugin / mcp-server (top by stars)
 *     2. Official MCP Registry (registry.modelcontextprotocol.io)
 *     3. npm registry search: dsh-plugin, cordis-plugin, claude-code, mcp-server keywords
 *     4. Glama MCP directory (glama.ai metaregistry)
 *
 *   For each candidate:
 *     fetch manifest + README → ecosystem schema validation → SECURITY SCAN
 *     (install-script patterns, obfuscation, typosquatting, suspicious URLs,
 *     leaked secrets, star-velocity anomalies) → security grade A+/A/B/C/D
 *     → grade D is BLOCKED: quarantined, never indexed
 *     → quality scoring → snapshot / DB upsert
 *
 * Usage: npx tsx scripts/sync/run-all.ts [--pages 5] [--limit N] [--db]
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  fetchTopicRepos,
  manifestPaths,
  type GithubRepo,
  type TopicEcosystem,
} from "./github-topic";
import { fetchRegistryServers, registryRepoFullName, type RegistryServer } from "./mcp-registry";
import { fetchNpmPackages, type NpmPackage } from "./npm-registry";
import { fetchGlamaServers } from "./glama";
import { fetchSkillsShTop, type ResolvedSkill } from "./skills-sh";
import {
  RAW_BASE,
  OFFICIAL_OWNERS,
  fetchJson,
  fetchText,
  pooled,
  redactSecrets,
  renderReadme,
} from "./lib";
import { validateManifest } from "../../src/lib/validators";
import { computeScore, percentile, scanInstallScripts } from "../../src/lib/scoring";
import { isBlocked, runSecurityScan } from "../../src/lib/security";
import { deriveCategories } from "../../src/lib/categories";
import type { Ecosystem, Plugin } from "../../src/lib/types";

const SEED_DIR = path.join(process.cwd(), "src", "data", "seed");
const README_DIR = path.join(SEED_DIR, "readmes");

/** Caps for entries that exist ONLY in a secondary source (registry/npm/glama) */
const REGISTRY_ONLY_CAP = 300;
const NPM_ONLY_CAP = 150;
const GLAMA_ONLY_CAP = 100;

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
  /** npm search enrichment */
  npmName: string | null;
  npmDownloads: number;
  npmListed: boolean;
  glamaListed: boolean;
  /** skills.sh enrichment (ecosystem "skills") */
  skillsShListed: boolean;
  skillsShOfficial: boolean;
  skillFrontmatter: Record<string, unknown> | null;
  skillBody: string | null;
}

function slugFor(e: RawEntry): string {
  return `${e.ecosystem}/${e.owner.toLowerCase()}/${e.name.toLowerCase()}`;
}

/** slug → deterministic UUID (stable across repeated syncs) */
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

const RAW_DEFAULTS = {
  registryServer: null as RegistryServer | null,
  npmName: null as string | null,
  npmDownloads: 0,
  npmListed: false,
  glamaListed: false,
  skillsShListed: false,
  skillsShOfficial: false,
  skillFrontmatter: null as Record<string, unknown> | null,
  skillBody: null as string | null,
};

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
    ...RAW_DEFAULTS,
  };
}

function registryToRaw(server: RegistryServer): RawEntry {
  const [namespace, ...rest] = server.name.split("/");
  const repoFull = registryRepoFullName(server);
  return {
    ecosystem: "mcp",
    owner: repoFull ? repoFull.split("/")[0] : namespace,
    // slug is three-part {ecosystem}/{owner}/{name}; slashes inside name must be collapsed
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
    ...RAW_DEFAULTS,
    registryServer: server,
  };
}

function npmToRaw(pkg: NpmPackage, ecosystem: Ecosystem): RawEntry {
  const scoped = /^@([^/]+)\//.exec(pkg.name);
  const owner = pkg.repoFullName ? pkg.repoFullName.split("/")[0] : (scoped?.[1] ?? "npm");
  const bareName = pkg.repoFullName
    ? pkg.repoFullName.split("/")[1]
    : pkg.name.replace(/^@[^/]+\//, "");
  return {
    ecosystem,
    owner,
    name: bareName,
    repoFullName: pkg.repoFullName,
    description: pkg.description,
    repoUrl: pkg.repoFullName ? `https://github.com/${pkg.repoFullName}` : pkg.npmUrl,
    homepage: pkg.homepage,
    license: pkg.license,
    topics: pkg.keywords.slice(0, 12),
    stars: 0,
    forks: 0,
    pushedAt: pkg.publishedAt,
    createdAt: null,
    ...RAW_DEFAULTS,
    npmName: pkg.name,
    npmDownloads: pkg.monthlyDownloads,
    npmListed: true,
  };
}

function skillToRaw(s: ResolvedSkill): RawEntry {
  const description =
    typeof s.frontmatter?.description === "string"
      ? (s.frontmatter.description as string).slice(0, 300)
      : null;
  return {
    ecosystem: "skills",
    owner: s.owner,
    name: s.skillId,
    repoFullName: s.source,
    description,
    repoUrl: `https://github.com/${s.source}`,
    homepage: `https://www.skills.sh/${s.source}/${s.skillId}`,
    license: typeof s.frontmatter?.license === "string" ? (s.frontmatter.license as string) : null,
    topics: [],
    stars: 0,
    forks: 0,
    pushedAt: null,
    createdAt: null,
    ...RAW_DEFAULTS,
    npmDownloads: s.installs, // real install counts from skills.sh
    skillsShListed: true,
    skillsShOfficial: Boolean(s.isOfficial),
    skillFrontmatter: s.frontmatter,
    skillBody: s.body,
  };
}

function entryKey(e: RawEntry): string {
  return e.repoFullName?.toLowerCase() ?? `pkg:${(e.npmName ?? e.name).toLowerCase()}`;
}

async function fetchManifest(entry: RawEntry): Promise<Record<string, unknown> | null> {
  // Registry entries already carry a server.json-shaped manifest
  if (entry.registryServer) return entry.registryServer as unknown as Record<string, unknown>;
  if (entry.repoFullName) {
    for (const p of manifestPaths(entry.ecosystem)) {
      const text = await fetchText(`${RAW_BASE}/${entry.repoFullName}/HEAD/${p}`);
      if (!text) continue;
      try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        if (parsed && typeof parsed === "object") return parsed;
      } catch {
        /* invalid JSON → try the next path */
      }
    }
  }
  // npm-sourced entries: fall back to the published package.json
  if (entry.npmName) {
    const manifest = await fetchJson<Record<string, unknown>>(
      `https://registry.npmjs.org/${entry.npmName.replace("/", "%2F")}/latest`,
      undefined,
      1,
    );
    if (manifest && typeof manifest === "object") return manifest;
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
  const pages = parseInt(getFlag("pages") ?? "5", 10);
  const limit = parseInt(getFlag("limit") ?? "0", 10);
  const writeDb = args.includes("--db") && Boolean(process.env.DATABASE_URL);

  console.log(`[sync] start pages=${pages} limit=${limit || "∞"} db=${writeDb}`);
  const startedAt = new Date();

  // 1. Fetch all community sources in parallel
  const [dsh, claudeCode, mcpTopic, registry, npmDsh, npmClaude, npmMcp, glama, skillsSh] =
    await Promise.all([
      fetchTopicRepos("dsh", pages),
      fetchTopicRepos("claude-code", pages),
      fetchTopicRepos("mcp", pages),
      fetchRegistryServers(),
      fetchNpmPackages("dsh"),
      fetchNpmPackages("claude-code"),
      fetchNpmPackages("mcp"),
      fetchGlamaServers(),
      fetchSkillsShTop(500),
    ]);
  const npmByEco: Record<TopicEcosystem, NpmPackage[]> = {
    dsh: npmDsh.packages,
    "claude-code": npmClaude.packages,
    mcp: npmMcp.packages,
  };

  // 2. Normalize + merge/dedupe across sources (keyed by repo, per ecosystem)
  const cap = <T,>(arr: T[]) => (limit > 0 ? arr.slice(0, limit) : arr);
  const ecoMaps: Record<TopicEcosystem, Map<string, RawEntry>> = {
    dsh: new Map(),
    "claude-code": new Map(),
    mcp: new Map(),
  };
  for (const repo of cap(dsh.repos)) {
    ecoMaps.dsh.set(repo.full_name.toLowerCase(), repoToRaw(repo, "dsh"));
  }
  for (const repo of cap(claudeCode.repos)) {
    ecoMaps["claude-code"].set(repo.full_name.toLowerCase(), repoToRaw(repo, "claude-code"));
  }
  for (const repo of cap(mcpTopic.repos)) {
    ecoMaps.mcp.set(repo.full_name.toLowerCase(), repoToRaw(repo, "mcp"));
  }

  // 2a. Official MCP Registry → merge into MCP
  let registryMerged = 0;
  let registryOnly = 0;
  for (const server of registry.servers.values()) {
    const repoFull = registryRepoFullName(server)?.toLowerCase();
    const existing = repoFull ? ecoMaps.mcp.get(repoFull) : undefined;
    if (existing) {
      existing.registryServer = server;
      registryMerged++;
    } else if (
      registryOnly < REGISTRY_ONLY_CAP &&
      (server.repository?.url || server.remotes?.length)
    ) {
      const raw = registryToRaw(server);
      const key = entryKey(raw);
      if (!ecoMaps.mcp.has(key)) {
        ecoMaps.mcp.set(key, raw);
        registryOnly++;
      }
    }
  }

  // 2b. npm registry → enrich matches, add capped npm-only entries
  let npmMerged = 0;
  let npmOnly = 0;
  for (const eco of ["dsh", "claude-code", "mcp"] as const) {
    let added = 0;
    for (const pkg of npmByEco[eco]) {
      const key = pkg.repoFullName?.toLowerCase();
      const existing = key ? ecoMaps[eco].get(key) : undefined;
      if (existing) {
        existing.npmName = pkg.name;
        existing.npmDownloads = Math.max(existing.npmDownloads, pkg.monthlyDownloads);
        existing.npmListed = true;
        existing.license ??= pkg.license;
        npmMerged++;
      } else if (added < NPM_ONLY_CAP) {
        const raw = npmToRaw(pkg, eco);
        const k = entryKey(raw);
        if (!ecoMaps[eco].has(k)) {
          ecoMaps[eco].set(k, raw);
          added++;
          npmOnly++;
        }
      }
    }
  }

  // 2c. Glama directory → enrich MCP matches, add capped glama-only entries
  let glamaMerged = 0;
  let glamaOnly = 0;
  for (const server of glama.servers) {
    const key = server.repoFullName?.toLowerCase();
    if (!key) continue;
    const existing = ecoMaps.mcp.get(key);
    if (existing) {
      existing.glamaListed = true;
      existing.license ??= server.license;
      glamaMerged++;
    } else if (glamaOnly < GLAMA_ONLY_CAP && server.description) {
      const [owner, name] = server.repoFullName!.split("/");
      ecoMaps.mcp.set(key, {
        ecosystem: "mcp",
        owner,
        name,
        repoFullName: server.repoFullName,
        description: server.description,
        repoUrl: `https://github.com/${server.repoFullName}`,
        homepage: server.url,
        license: server.license,
        topics: [],
        stars: 0,
        forks: 0,
        pushedAt: null,
        createdAt: null,
        ...RAW_DEFAULTS,
        glamaListed: true,
      });
      glamaOnly++;
    }
  }

  const skillEntries: RawEntry[] = [];
  const seenSkillKeys = new Set<string>();
  for (const s of skillsSh.skills) {
    const key = `${s.owner.toLowerCase()}/${s.skillId.toLowerCase()}`;
    if (seenSkillKeys.has(key)) continue; // leaderboard is installs-desc: first wins
    seenSkillKeys.add(key);
    skillEntries.push(skillToRaw(s));
  }

  const entries: RawEntry[] = [
    ...ecoMaps.dsh.values(),
    ...ecoMaps["claude-code"].values(),
    ...ecoMaps.mcp.values(),
    ...cap(skillEntries),
  ];
  console.log(
    `[sync] normalized ${entries.length} candidates ` +
      `(registry: +${registryOnly}/~${registryMerged}, npm: +${npmOnly}/~${npmMerged}, glama: +${glamaOnly}/~${glamaMerged}, skills: +${skillEntries.length})`,
  );

  type RepoInfo = {
    stars: number; forks: number; pushedAt: string | null; license: string | null;
    createdAt: string | null;
  } | null;
  const repoInfoCache = new Map<string, Promise<RepoInfo>>();

  // 3. Manifest + README + validation (concurrency pool)
  fs.mkdirSync(README_DIR, { recursive: true });
  const now = new Date();
  const enriched = await pooled(entries, 12, async (entry, i) => {
    if (i > 0 && i % 200 === 0) console.log(`  …${i}/${entries.length}`);
    const [manifest, readmeMd] =
      entry.ecosystem === "skills"
        ? [entry.skillFrontmatter, entry.skillBody ?? (await fetchReadme(entry))]
        : await Promise.all([fetchManifest(entry), fetchReadme(entry)]);
    const validation = validateManifest(entry.ecosystem, manifest);
    const readme = readmeMd ? renderReadme(readmeMd, entry.repoFullName) : null;
    const secretsRedacted = readmeMd != null && redactSecrets(readmeMd) !== readmeMd;
    const suspicious = scanInstallScripts(manifest);
    // package.json with private: true (monorepo root) cannot be npm-installed
    const isPrivatePkg =
      manifest != null && (manifest as { private?: unknown }).private === true;
    const npmPackage = isPrivatePkg
      ? null
      : (entry.npmName ?? validation.extracted.npmPackage ?? null);
    const registryStars =
      entry.registryServer || entry.glamaListed || entry.npmListed || entry.skillsShListed
        ? await fetchGithubStarsIfMissing(entry)
        : null;
    return {
      entry,
      manifest,
      validation,
      readme,
      readmeMd,
      secretsRedacted,
      suspicious,
      npmPackage,
      isPrivatePkg,
      registryStars,
    };
  });

  // Backfill stars for secondary-source entries (only with a token, to respect core rate limits)
  async function fetchGithubStarsIfMissing(entry: RawEntry): Promise<RepoInfo> {
    if (entry.stars > 0 || !entry.repoFullName || !process.env.GITHUB_TOKEN) return null;
    const key = entry.repoFullName.toLowerCase();
    const cached = repoInfoCache.get(key);
    if (cached) return cached;
    const promise = fetchRepoInfo(entry.repoFullName);
    repoInfoCache.set(key, promise);
    return promise;
  }
  async function fetchRepoInfo(repoFullName: string): Promise<RepoInfo> {
    const repo = await fetchJson<GithubRepo>(
      `https://api.github.com/repos/${repoFullName}`,
      { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } },
      1,
    );
    if (!repo) return null;
    return {
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      pushedAt: repo.pushed_at,
      license: repo.license?.spdx_id === "NOASSERTION" ? null : (repo.license?.spdx_id ?? null),
      createdAt: repo.created_at ?? null,
    };
  }

  // 4. npm download counts for packages the search results didn't already cover
  const needDownloads = enriched.filter(
    (e) => e.npmPackage && e.entry.npmDownloads === 0,
  );
  console.log(`[sync] fetching npm downloads for ${needDownloads.length} packages`);
  const downloadsMap = new Map<string, number>();
  // npm API rate limits are tight: low concurrency + gentle throttling
  await pooled(needDownloads, 3, async (e) => {
    downloadsMap.set(e.npmPackage!, await fetchNpmDownloads(e.npmPackage!));
    await new Promise((r) => setTimeout(r, 150));
  });
  const downloadsFor = (e: (typeof enriched)[number]): number =>
    e.entry.npmDownloads > 0
      ? e.entry.npmDownloads
      : e.npmPackage
        ? (downloadsMap.get(e.npmPackage) ?? 0)
        : 0;

  // 5. Popularity context: percentiles + popular names (typosquat detection)
  const starsByEco = new Map<Ecosystem, number[]>();
  const dlByEco = new Map<Ecosystem, number[]>();
  const popularByEco = new Map<Ecosystem, { name: string; owner: string | null; stars: number }[]>();
  for (const e of enriched) {
    const stars = e.registryStars?.stars ?? e.entry.stars;
    push(starsByEco, e.entry.ecosystem, stars);
    const dl = downloadsFor(e);
    if (dl > 0) push(dlByEco, e.entry.ecosystem, dl);
    if (stars >= 1000) {
      const arr = popularByEco.get(e.entry.ecosystem) ?? [];
      arr.push({ name: e.entry.name, owner: e.entry.repoFullName ? e.entry.owner : null, stars });
      popularByEco.set(e.entry.ecosystem, arr);
    }
  }
  for (const arr of starsByEco.values()) arr.sort((a, b) => a - b);
  for (const arr of dlByEco.values()) arr.sort((a, b) => a - b);
  for (const [eco, arr] of popularByEco) {
    popularByEco.set(eco, arr.sort((a, b) => b.stars - a.stars).slice(0, 50));
  }

  // 6. SECURITY SCAN (gate) + quality scoring
  const plugins: Plugin[] = [];
  const quarantine: {
    slug: string;
    name: string;
    repoUrl: string | null;
    grade: string;
    findings: { id: string; severity: string; message: string }[];
  }[] = [];
  const seenSlugs = new Set<string>();

  for (const e of enriched) {
    const { entry, manifest, validation, readme, npmPackage, isPrivatePkg } = e;
    const slug = slugFor(entry);
    if (seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);

    const stars = e.registryStars?.stars ?? entry.stars;
    const forks = e.registryStars?.forks ?? entry.forks;
    const pushedAt = e.registryStars?.pushedAt ?? entry.pushedAt;
    const createdAt = entry.createdAt ?? e.registryStars?.createdAt ?? null;
    const license = entry.license ?? e.registryStars?.license ?? null;
    const downloads = downloadsFor(e);
    const officialOwner =
      OFFICIAL_OWNERS.has(entry.owner.toLowerCase()) || entry.skillsShOfficial;
    const registryListed = Boolean(entry.registryServer);

    // —— Security scan: runs BEFORE indexing; grade D is quarantined ——
    const security = runSecurityScan({
      ecosystem: entry.ecosystem,
      name: entry.name,
      ownerGithub: entry.repoFullName ? entry.owner : null,
      manifest,
      readmeMarkdown: e.readmeMd,
      license,
      stars,
      createdAt,
      specValid: validation.valid,
      officialOwner,
      verifiedOwner: officialOwner,
      registryListed,
      secretsRedacted: e.secretsRedacted,
      popularNames: popularByEco.get(entry.ecosystem) ?? [],
      now,
    });
    if (isBlocked(security)) {
      quarantine.push({
        slug,
        name: entry.name,
        repoUrl: entry.repoUrl,
        grade: security.grade,
        findings: security.findings,
      });
      continue;
    }

    const dlArr = dlByEco.get(entry.ecosystem) ?? [];
    const { total, breakdown } = computeScore({
      lastCommitAt: pushedAt ? new Date(pushedAt) : null,
      starsPercentile: percentile(stars, starsByEco.get(entry.ecosystem) ?? []),
      downloadsPercentile:
        downloads > 0 && dlArr.length > 0 ? percentile(downloads, dlArr) : null,
      specValid: validation.valid,
      hasManifest: manifest != null,
      hasLicense: license != null,
      suspiciousInstallScript: e.suspicious,
      verifiedOwner: officialOwner, // claim-based verifiedOwner is layered on top in DB mode
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
        npmListed: entry.npmListed || undefined,
        glamaListed: entry.glamaListed || undefined,
        skillsShListed: entry.skillsShListed || undefined,
      },
      securityGrade: security.grade,
      securityFindings: security.findings,
      npmPackage,
      createdAt: createdAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
      syncedAt: now.toISOString(),
    });
  }

  plugins.sort((a, b) => b.qualityScore - a.qualityScore);

  // 7. Write snapshot + quarantine report
  fs.mkdirSync(SEED_DIR, { recursive: true });
  fs.writeFileSync(path.join(SEED_DIR, "plugins.json"), JSON.stringify(plugins, null, 1));
  fs.writeFileSync(
    path.join(SEED_DIR, "quarantine.json"),
    JSON.stringify({ generatedAt: now.toISOString(), blocked: quarantine }, null, 2),
  );
  const categoryCounts = new Map<string, number>();
  for (const p of plugins) {
    for (const c of p.categories) categoryCounts.set(c, (categoryCounts.get(c) ?? 0) + 1);
  }
  const gradeDist: Record<string, number> = {};
  for (const p of plugins) gradeDist[p.securityGrade] = (gradeDist[p.securityGrade] ?? 0) + 1;

  const stats = {
    totalIndexed: plugins.length,
    sourceTotals: {
      dsh: dsh.totalCount + npmDsh.totalCount,
      "claude-code": claudeCode.totalCount + npmClaude.totalCount,
      mcp: mcpTopic.totalCount + registry.servers.size + npmMcp.totalCount,
      skills: skillsSh.totalCount,
    },
    byEcosystem: {
      dsh: plugins.filter((p) => p.ecosystem === "dsh").length,
      "claude-code": plugins.filter((p) => p.ecosystem === "claude-code").length,
      mcp: plugins.filter((p) => p.ecosystem === "mcp").length,
      skills: plugins.filter((p) => p.ecosystem === "skills").length,
    },
    securityGrades: gradeDist,
    quarantined: quarantine.length,
    categories: [...categoryCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    lastSyncedAt: now.toISOString(),
  };
  fs.writeFileSync(path.join(SEED_DIR, "stats.json"), JSON.stringify(stats, null, 2));
  console.log(
    `[sync] snapshot written: ${plugins.length} plugins`,
    stats.byEcosystem,
    `| grades:`, gradeDist,
    `| quarantined: ${quarantine.length}`,
  );
  if (quarantine.length > 0) {
    console.log(`[security] blocked:`, quarantine.map((q) => q.slug).join(", "));
  }

  // 8. DB upsert (optional)
  if (writeDb) {
    const { upsertPlugins } = await import("../db/upsert");
    await upsertPlugins(plugins, stats, startedAt);
  }

  console.log(`[sync] done in ${((Date.now() - startedAt.getTime()) / 1000).toFixed(0)}s`);
}

/** Filter out CI placeholder versions (e.g. ${VERSION}) and overly long strings */
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
