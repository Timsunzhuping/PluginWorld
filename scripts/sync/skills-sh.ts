/** Public skills.sh leaderboard pagination + GitHub / well-known SKILL.md resolution. */
import { fetchJson, fetchText, pooled, githubHeaders } from "./lib";
import { parseFrontmatter } from "../../src/lib/validators/skill";

export interface SkillsShSkill {
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
  rank: number;
  sourceUrl: string;
  skillMdPath: string | null;
  frontmatter: Record<string, unknown> | null;
  body: string | null;
}
const SKILLS_SH = "https://www.skills.sh";
const DOMAIN_SOURCES = new Set([
  "open.feishu.cn", "uizze.sh", "agent.qq.com", "docs.stripe.com",
  "skills.volces.com", "code.deepline.com", "proseify.xyz", "mintlify.com",
]);
export function isGithubSource(source: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9_.-]+$/.test(source);
}
function isSkill(s: unknown): s is SkillsShSkill {
  if (!s || typeof s !== "object") return false;
  const v = s as SkillsShSkill;
  return typeof v.source === "string" && (isGithubSource(v.source) || /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(v.source)) &&
    typeof v.skillId === "string" && /^[a-zA-Z0-9_.:-]+$/.test(v.skillId) &&
    typeof v.installs === "number" && Number.isFinite(v.installs) && v.installs >= 0;
}
/** Read the public SKILL.md rendering when its publisher has moved the source file. */
export function parseRenderedSkill(flight: string): string | null {
  const bytes = Buffer.from(flight);
  const parts: string[] = [];
  for (const key of ["previewHtml", "restHtml"]) {
    const match = new RegExp(`"${key}":("(?:\\\\.|[^"\\\\])*")`).exec(flight);
    if (!match) continue;
    const value = JSON.parse(match[1]) as string;
    if (value.startsWith("<")) { parts.push(value); continue; }
    if (!/^\$[0-9a-f]+$/i.test(value)) continue;
    const marker = Buffer.from(`${value.slice(1)}:T`);
    const at = bytes.indexOf(marker);
    if (at < 0) continue;
    const comma = bytes.indexOf(44, at + marker.length);
    const length = parseInt(bytes.subarray(at + marker.length, comma).toString(), 16);
    if (comma < 0 || !Number.isFinite(length) || length < 1 || length > 1000000) continue;
    if (comma + 1 + length > bytes.length) continue;
    parts.push(bytes.subarray(comma + 1, comma + 1 + length).toString());
  }
  const html = parts.join("\n");
  return html.length > 30 && /<(h[1-6]|p|pre|ul)\b/i.test(html) ? html : null;
}
/** A 200 response containing an API error or HTML shell is not a skill document. */
export function parseSkillDocument(markdown: string) {
  if (!markdown.trim() || /^\s*<(?:!doctype|html|head|body)\b/i.test(markdown)) return null;
  if (/^\s*[\[{]/.test(markdown)) {
    try { JSON.parse(markdown); return null; } catch { /* Ordinary markdown may start with a bracket. */ }
  }
  return parseFrontmatter(markdown);
}
/** JSON decoder tracks strings: brackets inside descriptions do not corrupt parsing. */
export function parseInitialSkills(flight: string): SkillsShSkill[] {
  const marker = '"initialSkills":';
  const i = flight.indexOf(marker);
  if (i < 0) return [];
  const start = flight.indexOf("[", i + marker.length);
  let depth = 0, quoted = false, escaped = false;
  for (let j = start; j < flight.length; j++) {
    const c = flight[j];
    if (quoted) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === '"') quoted = false; continue; }
    if (c === '"') quoted = true;
    else if (c === "[") depth++;
    else if (c === "]" && --depth === 0) {
      try { return (JSON.parse(flight.slice(start, j + 1)) as unknown[]).filter(isSkill); } catch { return []; }
    }
  }
  return [];
}
export async function fetchLeaderboard(limit: number): Promise<{ skills: SkillsShSkill[]; total: number }> {
  const res = await fetch(`${SKILLS_SH}/`, {
    headers: { RSC: "1", "User-Agent": "pluginworld-sync (www.pluginworld.ai)" }, signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`skills.sh leaderboard HTTP ${res.status}`);
  const initial = parseInitialSkills(await res.text());
  if (!initial.length) throw new Error("skills.sh initialSkills missing: preserve last published snapshot");
  const byId = new Map(initial.map(s => [`${s.source}/${s.skillId}`, s]));
  // Public web UI uses 200 entries per page; initial payload currently covers 3 pages.
  let page = Math.ceil(initial.length / 200), total = initial.length;
  while (byId.size < limit) {
    const data = await fetchJson<{ skills: unknown[]; total: number; hasMore: boolean }>(`${SKILLS_SH}/api/skills/all-time/${page++}`);
    if (!data || !Array.isArray(data.skills)) throw new Error("skills.sh pagination unavailable");
    total = Math.max(total, data.total);
    const before = byId.size;
    for (const skill of data.skills.filter(isSkill)) byId.set(`${skill.source}/${skill.skillId}`, skill);
    if (!data.hasMore || byId.size === before) break;
  }
  const skills = [...byId.values()].sort((a,b) => b.installs-a.installs).slice(0,limit);
  if (skills.length < limit) throw new Error(`skills.sh returned ${skills.length}/${limit} requested entries`);
  return { skills, total };
}
interface GitTree { tree?: { path: string; type: string }[]; truncated?: boolean }
async function fetchSkillPaths(repo: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const tree = await fetchJson<GitTree>(`https://api.github.com/repos/${repo}/git/trees/HEAD?recursive=1`, { headers: githubHeaders() }, 1);
  for (const node of tree?.tree ?? []) {
    if (node.type !== "blob") continue;
    if (node.path === "SKILL.md") { out.set("$root", node.path); continue; }
    if (!node.path.endsWith("/SKILL.md")) {
      if (node.path.startsWith("docs/") && node.path.endsWith(".md")) {
        const name=node.path.split("/").pop()!.slice(0,-3);
        if (!out.has(`docs:${name}`)) out.set(`docs:${name}`,node.path);
      }
      continue;
    }
    const parts = node.path.split("/");
    const dir = parts[parts.length-2];
    if (dir && !out.has(dir)) out.set(dir, node.path);
  }
  if (tree?.truncated) console.warn(`[skills.sh] truncated tree: ${repo}`);
  return out;
}
export async function fetchSkillsShTop(limit = 1000): Promise<{ skills: ResolvedSkill[]; totalCount: number }> {
  const { skills:top, total } = await fetchLeaderboard(limit);
  console.log(`[skills.sh] taking top ${top.length}; reported catalog ${total}`);
  const skills=await resolveSkills(top);
  console.log(`[skills.sh] SKILL.md resolved: ${skills.filter(s=>s.skillMdPath).length}/${skills.length}`);
  return {skills,totalCount:total};
}
export async function resolveSkills(top: SkillsShSkill[]): Promise<ResolvedSkill[]> {
  const repos = [...new Set(top.filter(s => isGithubSource(s.source)).map(s => s.source))];
  const pathsByRepo = new Map<string, Map<string,string>>();
  await pooled(repos, 6, async repo => { pathsByRepo.set(repo, await fetchSkillPaths(repo)); });
  return await pooled(top, 10, async (s, i): Promise<ResolvedSkill> => {
    const rank = "rank" in s && typeof s.rank === "number" ? s.rank : i+1;
    const github = isGithubSource(s.source);
    const [owner, repo = ""] = s.source.split("/");
    const sourceUrl = github ? `https://github.com/${s.source}` : `https://${s.source}`;
    const paths = pathsByRepo.get(s.source);
    const aliases = paths ? [...paths].filter(([dir])=>dir!=="$root" &&
      (s.skillId.endsWith(`-${dir}`) || s.skillId===`${dir}-skill` || s.skillId.replace(/[:_]/g,"-")===dir)).map(([,p])=>p) : [];
    const candidates = github
      ? [paths?.get(s.skillId), `skills/${s.skillId}/SKILL.md`, `${s.skillId}/SKILL.md`, `.claude/skills/${s.skillId}/SKILL.md`, ...aliases, paths?.get(`docs:${s.skillId}`), paths?.get("$root")]
      : DOMAIN_SOURCES.has(s.source) ? [`.well-known/skills/${s.skillId}/SKILL.md`] : [];
    for (const p of [...new Set(candidates)].filter((v): v is string => !!v)) {
      const md = await fetchText(github ? `https://raw.githubusercontent.com/${s.source}/HEAD/${p}` : `${sourceUrl}/${p}`);
      if (!md) continue;
      const document = parseSkillDocument(md);
      if (!document) continue;
      const { frontmatter, body } = document;
      // Root-only repos may contain a different skill: never attach the wrong document.
      if ((p === "SKILL.md" || aliases.includes(p)) && frontmatter?.name !== s.skillId && s.name !== frontmatter?.name) continue;
      return { ...s, owner, repo, rank, sourceUrl, skillMdPath:p, frontmatter, body };
    }
    const rendered = await fetch(`${SKILLS_SH}/${s.source}/${encodeURIComponent(s.skillId)}`, {
      headers: { RSC: "1", "User-Agent": "pluginworld-sync (www.pluginworld.ai)" },
      signal: AbortSignal.timeout(20000),
    }).then(async r => r.ok ? parseRenderedSkill(await r.text()) : null).catch(() => null);
    if (rendered) return { ...s, owner, repo, rank, sourceUrl,
      skillMdPath:`skills.sh-rendered:${s.source}/${s.skillId}`, frontmatter:null, body:rendered };
    return { ...s, owner, repo, rank, sourceUrl, skillMdPath:null, frontmatter:null, body:null };
  });

}
