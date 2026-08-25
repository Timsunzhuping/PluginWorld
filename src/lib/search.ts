import type { Plugin, PluginQuery, PluginQueryResult, SortKey } from "./types";

/**
 * 快照模式的内存搜索/筛选/排序。
 * DB 模式下等价逻辑由 Postgres FTS + SQL 完成（见 lib/data.ts）。
 */

const DAY = 24 * 60 * 60 * 1000;

export function trendingScore(p: Plugin, now = Date.now()): number {
  const pushed = p.lastCommitAt ? new Date(p.lastCommitAt).getTime() : 0;
  const daysSincePush = Math.max(0, (now - pushed) / DAY);
  // 活跃度衰减 × 流行度：近期有更新且流行的排前面
  const recency = Math.pow(0.5, daysSincePush / 30);
  return Math.log10(1 + p.stars + p.downloads / 50) * (0.35 + 0.65 * recency);
}

export function matchScore(p: Plugin, q: string): number {
  const query = q.trim().toLowerCase();
  if (!query) return 1;
  const terms = query.split(/\s+/).filter(Boolean);
  const name = p.name.toLowerCase();
  const desc = (p.description ?? "").toLowerCase();
  const owner = (p.ownerGithub ?? "").toLowerCase();
  const keywords = p.keywords.join(" ").toLowerCase();
  const categories = p.categories.join(" ").toLowerCase();

  let score = 0;
  for (const term of terms) {
    let t = 0;
    if (name === term) t += 12;
    else if (name.startsWith(term)) t += 8;
    else if (name.includes(term)) t += 5;
    if (owner === term) t += 6;
    else if (owner.includes(term)) t += 2;
    if (keywords.includes(term)) t += 3;
    if (categories.includes(term)) t += 3;
    if (desc.includes(term)) t += 2;
    if (t === 0) return 0; // 所有词都必须命中（AND 语义）
    score += t;
  }
  return score;
}

export function sortPlugins(items: Plugin[], sort: SortKey): Plugin[] {
  const arr = [...items];
  switch (sort) {
    case "stars":
      return arr.sort((a, b) => b.stars - a.stars);
    case "trending": {
      const now = Date.now();
      return arr.sort((a, b) => trendingScore(b, now) - trendingScore(a, now));
    }
    case "updated":
      return arr.sort(
        (a, b) =>
          new Date(b.lastCommitAt ?? 0).getTime() -
          new Date(a.lastCommitAt ?? 0).getTime(),
      );
    case "score":
    default:
      return arr.sort((a, b) => b.qualityScore - a.qualityScore);
  }
}

export function queryPlugins(
  all: Plugin[],
  query: PluginQuery,
): PluginQueryResult {
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(100, Math.max(1, query.perPage ?? 24));

  let items = all;
  if (query.ecosystem) items = items.filter((p) => p.ecosystem === query.ecosystem);
  if (query.category)
    items = items.filter((p) => p.categories.includes(query.category!));

  if (query.q?.trim()) {
    const scored = items
      .map((p) => ({ p, s: matchScore(p, query.q!) }))
      .filter((x) => x.s > 0);
    // 相关度优先，其次按所选排序意图加权
    const sorted = sortPlugins(scored.map((x) => x.p), query.sort ?? "score");
    const rank = new Map(sorted.map((p, i) => [p.slug, i]));
    scored.sort((a, b) => b.s - a.s || rank.get(a.p.slug)! - rank.get(b.p.slug)!);
    items = scored.map((x) => x.p);
  } else {
    items = sortPlugins(items, query.sort ?? "score");
  }

  const total = items.length;
  const start = (page - 1) * perPage;
  return { items: items.slice(start, start + perPage), total, page, perPage };
}
