import { describe, expect, it } from "vitest";
import { matchScore, queryPlugins, sortPlugins } from "@/lib/search";
import type { Plugin } from "@/lib/types";

function fixture(overrides: Partial<Plugin>): Plugin {
  return {
    id: "00000000-0000-5000-8000-000000000000",
    ecosystem: "mcp",
    slug: "mcp/acme/test",
    name: "test",
    description: null,
    repoUrl: null,
    homepage: null,
    ownerGithub: "acme",
    license: "MIT",
    manifest: null,
    categories: [],
    keywords: [],
    stars: 0,
    downloads: 0,
    forks: 0,
    versionLatest: null,
    lastCommitAt: null,
    specValid: false,
    qualityScore: 0,
    scoreBreakdown: { maintenance: 0, popularity: 0, compliance: 0, security: 0, docs: 0 },
    trustFlags: {},
    npmPackage: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    syncedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const corpus: Plugin[] = [
  fixture({
    slug: "mcp/anthropic/code-review",
    name: "code-review",
    description: "AI code review for pull requests",
    keywords: ["review", "ai"],
    categories: ["code-review"],
    stars: 500,
    qualityScore: 90,
  }),
  fixture({
    slug: "dsh/acme/reviewer",
    ecosystem: "dsh",
    name: "reviewer",
    description: "review dashboards",
    stars: 50,
    qualityScore: 60,
  }),
  fixture({
    slug: "claude-code/x/formatter",
    ecosystem: "claude-code",
    name: "formatter",
    description: "code formatting",
    stars: 5000,
    qualityScore: 70,
    lastCommitAt: "2026-08-20T00:00:00Z",
  }),
];

describe("matchScore", () => {
  it("exact name match scores highest", () => {
    const exact = matchScore(corpus[0], "code-review");
    const partial = matchScore(corpus[0], "review");
    expect(exact).toBeGreaterThan(partial);
    expect(partial).toBeGreaterThan(0);
  });
  it("AND semantics: any unmatched term yields 0", () => {
    expect(matchScore(corpus[0], "code banana")).toBe(0);
  });
  it("empty query returns 1 (no filtering)", () => {
    expect(matchScore(corpus[0], "")).toBe(1);
  });
});

describe("queryPlugins", () => {
  it("keyword search + ecosystem filter", () => {
    const all = queryPlugins(corpus, { q: "review" });
    expect(all.total).toBe(2);
    const dshOnly = queryPlugins(corpus, { q: "review", ecosystem: "dsh" });
    expect(dshOnly.total).toBe(1);
    expect(dshOnly.items[0].slug).toBe("dsh/acme/reviewer");
  });
  it("category filter", () => {
    const r = queryPlugins(corpus, { category: "code-review" });
    expect(r.total).toBe(1);
  });
  it("pagination", () => {
    const r = queryPlugins(corpus, { perPage: 2, page: 2 });
    expect(r.items.length).toBe(1);
    expect(r.total).toBe(3);
  });
});

describe("sortPlugins", () => {
  it("score sort is the default", () => {
    const sorted = sortPlugins(corpus, "score");
    expect(sorted[0].qualityScore).toBe(90);
  });
  it("stars sort", () => {
    const sorted = sortPlugins(corpus, "stars");
    expect(sorted[0].stars).toBe(5000);
  });
  it("trending ranks recently active projects first", () => {
    const sorted = sortPlugins(corpus, "trending");
    expect(sorted[0].slug).toBe("claude-code/x/formatter");
  });
});
