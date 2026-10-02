/**
 * skills.sh source — the Agent Skills leaderboard (skills.sh by Vercel).
 *
 * The official API requires Vercel OIDC auth, but the leaderboard page is
 * public and server-rendered: fetching it with the `RSC: 1` header returns
 * the React flight payload containing `initialSkills` — the full all-time
 * leaderboard as JSON ({source, skillId, name, installs, weeklyInstalls,
 * isOfficial}).
 *
 * For each top skill we then resolve its SKILL.md inside the GitHub repo
 * (one Git Trees call per unique repo, cached) and parse its frontmatter as
 * the manifest; the markdown body becomes the plugin page content.
 */
import { fetchJson, fetchText, pooled } from "./lib";
import { parseFrontmatter } from "../../src/lib/validators/skill";

export interface SkillsShSkill {
  /** GitHub owner/repo */
  source: string;
  skillId: string;
  name: string;
  installs: number;
  weeklyInstalls: number[];
  isOfficial?: boolean;
}

export interface ResolvedSkill extends SkillsShSkill {
  owner: string;
  repo: string;
  /** Path of SKILL.md within the repo, when found */
  skillMdPath: string | null;
  frontmatter: Record<string, unknown> | null;
  /** Markdown body of SKILL.md (frontmatter stripped) */
  body: string | null;
}

const SKILLS_SH = "https://www.skills.sh";

/** Extract the `initialSkills` JSON array from the RSC flight payload */
export function parseInitialSkills(flight: string): SkillsShSkill[] {
  const marker = '"initialSkills":';
  const i = flight.indexOf(marker);
  if (i < 0) return [];
  const start = i + marker.length;
  let depth = 0;
  for (let j = start; j < flight.length; j++) {
    const ch = flight[j];
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        try {
          const arr = JSON.parse(flight.slice(start, j + 1)) as SkillsShSkill[];
          return arr.filter(
            (s) =>
              typeof s?.source === "string" &&
              s.source.includes("/") &&
              typeof s?.skillId === "string" &&
              typeof s?.installs === "number",
          );
        } catch {
          return [];
        }
      }
    }
  }
  return [];
}

async function fetchLeaderboard(): Promise<SkillsShSkill[]> {
  const headerSets: Record<string, string>[] = [
    { RSC: "1", "User-Agent": "pluginworld-sync (www.pluginworld.ai)" },
    { "User-Agent": "pluginworld-sync (www.pluginworld.ai)" },
  ];
  for (const headers of headerSets) {
    const text = await fetchText2(`${SKILLS_SH}/`, headers);
    if (!text) continue;
    const skills = parseInitialSkills(text);
    if (skills.length > 0) return skills;
  }
  return [];
}

async function fetchText2(
  url: string,
  headers: Record<string, string>,
): Promise<string | null> {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Count catalog size from the sitemaps (universe metric) */
async function fetchUniverseCount(): Promise<number> {
  let total = 0;
  for (const part of ["sitemap-skills-1.xml", "sitemap-skills-2.xml"]) {
    const xml = await fetchText(`${SKILLS_SH}/${part}`);
    if (xml) total += (xml.match(/<loc>/g) ?? []).length;
  }
  return total;
}

interface GitTree {
  tree?: { path: string; type: string }[];
  truncated?: boolean;
}

/** owner/repo → map of skill dir name → SKILL.md path */
async function fetchSkillPaths(repo: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!process.env.GITHUB_TOKEN) return out;
  const tree = await fetchJson<GitTree>(
    `https://api.github.com/repos/${repo}/git/trees/HEAD?recursive=1`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
      },
    },
    1,
  );
  for (const node of tree?.tree ?? []) {
    if (node.type !== "blob" || !node.path.endsWith("/SKILL.md")) continue;
    const parts = node.path.split("/");
    const dir = parts[parts.length - 2];
    if (dir && !out.has(dir)) out.set(dir, node.path);
  }
  return out;
}

export async function fetchSkillsShTop(
  limit = 500,
): Promise<{ skills: ResolvedSkill[]; totalCount: number }> {
  const [leaderboard, universe] = await Promise.all([
    fetchLeaderboard(),
    fetchUniverseCount(),
  ]);
  const top = [...leaderboard]
    .sort((a, b) => b.installs - a.installs)
    .slice(0, limit);
  console.log(
    `[skills.sh] leaderboard: ${leaderboard.length} skills, taking top ${top.length} (universe: ${universe})`,
  );

  // Resolve SKILL.md paths: one Trees call per unique repo (cached)
  const repos = [...new Set(top.map((s) => s.source))];
  const pathsByRepo = new Map<string, Map<string, string>>();
  await pooled(repos, 8, async (repo) => {
    pathsByRepo.set(repo, await fetchSkillPaths(repo));
  });

  // Fetch + parse each SKILL.md (with common-path fallbacks when trees missed)
  const resolved = await pooled(top, 12, async (s): Promise<ResolvedSkill> => {
    const [owner, repo] = s.source.split("/");
    const candidates: string[] = [];
    const fromTree = pathsByRepo.get(s.source)?.get(s.skillId);
    if (fromTree) candidates.push(fromTree);
    candidates.push(
      `skills/${s.skillId}/SKILL.md`,
      `${s.skillId}/SKILL.md`,
      `.claude/skills/${s.skillId}/SKILL.md`,
    );
    for (const path of [...new Set(candidates)]) {
      const md = await fetchText(
        `https://raw.githubusercontent.com/${s.source}/HEAD/${path}`,
      );
      if (!md || md.trim().length === 0) continue;
      const { frontmatter, body } = parseFrontmatter(md);
      return { ...s, owner, repo, skillMdPath: path, frontmatter, body };
    }
    return { ...s, owner, repo, skillMdPath: null, frontmatter: null, body: null };
  });

  const withMd = resolved.filter((s) => s.skillMdPath).length;
  console.log(`[skills.sh] SKILL.md resolved for ${withMd}/${resolved.length}`);
  return { skills: resolved, totalCount: universe || leaderboard.length };
}
