/**
 * GitHub topic 抓取（方案 §6）：
 *   topic:dsh-plugin → dsh 生态
 *   topic:claude-code-plugin → Claude Code 生态
 *   topic:mcp-server → MCP 生态（与官方 Registry 合并去重）
 * Search API 按 star 降序取前 N 页；增量同步用 pushed_at 过滤。
 */
import { GITHUB_API, fetchJson, githubHeaders, sleep } from "./lib";
import type { Ecosystem } from "../../src/lib/types";

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

export const TOPIC_BY_ECOSYSTEM: Record<Ecosystem, string> = {
  dsh: "dsh-plugin",
  "claude-code": "claude-code-plugin",
  mcp: "mcp-server",
};

export async function fetchTopicRepos(
  ecosystem: Ecosystem,
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
    // 未认证 Search API 限 10 req/min
    await sleep(process.env.GITHUB_TOKEN ? 800 : 6_500);
  }

  console.log(`[github-topic] ${topic}: ${repos.length} repos (universe: ${totalCount})`);
  return { repos, totalCount };
}

/** manifest 抓取路径（按生态优先级尝试） */
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
  }
}
