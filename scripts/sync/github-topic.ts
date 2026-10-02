/**
 * GitHub topic crawler (spec §6):
 *   topic:dsh-plugin → dsh ecosystem
 *   topic:claude-code-plugin → Claude Code ecosystem
 *   topic:mcp-server → MCP ecosystem (merged/deduped with the official Registry)
 * Search API fetches the first N pages sorted by stars desc; incremental sync filters by pushed_at.
 */
import { GITHUB_API, fetchJson, githubHeaders, sleep } from "./lib";
import type { Ecosystem } from "../../src/lib/types";

/** Ecosystems backed by a GitHub topic ("skills" syncs from skills.sh instead) */
export type TopicEcosystem = Exclude<Ecosystem, "skills">;

export interface GithubRepo {
  full_name: string;
  name: string;
  owner: { login: string };
  description: string | null;
  html_url: string;
  homepage: string | null;
  stargazers_count: number;
  forks_count: number;
  license: { spdx_id: string | null } | null;
  topics: string[];
  pushed_at: string;
  created_at: string;
  fork: boolean;
  archived: boolean;
}

interface SearchResponse {
  total_count: number;
  items: GithubRepo[];
}

export const TOPIC_BY_ECOSYSTEM: Record<TopicEcosystem, string> = {
  dsh: "dsh-plugin",
  "claude-code": "claude-code-plugin",
  mcp: "mcp-server",
};

export async function fetchTopicRepos(
  ecosystem: TopicEcosystem,
  pages = 2,
  perPage = 100,
): Promise<{ repos: GithubRepo[]; totalCount: number }> {
  const topic = TOPIC_BY_ECOSYSTEM[ecosystem];
  const repos: GithubRepo[] = [];
  let totalCount = 0;

  for (let page = 1; page <= pages; page++) {
    const url = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(
      `topic:${topic}`,
    )}&sort=stars&order=desc&per_page=${perPage}&page=${page}`;
    const data = await fetchJson<SearchResponse>(url, { headers: githubHeaders() });
    if (!data?.items) break;
    totalCount = data.total_count;
    repos.push(...data.items.filter((r) => !r.fork && !r.archived));
    if (data.items.length < perPage) break;
    // Unauthenticated Search API is limited to 10 req/min
    await sleep(process.env.GITHUB_TOKEN ? 800 : 6_500);
  }

  console.log(`[github-topic] ${topic}: ${repos.length} repos (universe: ${totalCount})`);
  return { repos, totalCount };
}

/** Manifest fetch paths (tried in priority order per ecosystem) */
export function manifestPaths(ecosystem: Ecosystem): string[] {
  switch (ecosystem) {
    case "dsh":
      return ["package.json"];
    case "claude-code":
      return [
        ".claude-plugin/plugin.json",
        ".claude-plugin/marketplace.json",
        "plugin.json",
      ];
    case "mcp":
      return ["server.json", "package.json"];
    case "skills":
      return []; // SKILL.md is resolved by the skills.sh source (scripts/sync/skills-sh.ts)
  }
}
