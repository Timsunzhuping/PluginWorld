import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API — Public API Reference",
  description:
    "PluginWorld public REST API v1: cross-ecosystem plugin search, details and stats. Built for AI agents.",
  alternates: { canonical: "/docs/api" },
};

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-[8px] bg-ink px-5 py-4 font-mono text-[13px] leading-relaxed text-paper">
      <code>{children}</code>
    </pre>
  );
}

function Param({
  name,
  type,
  desc,
}: {
  name: string;
  type: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-line py-3 sm:flex-row sm:items-baseline sm:gap-4">
      <code className="w-32 shrink-0 font-mono text-[13px] text-ink">{name}</code>
      <span className="w-40 shrink-0 font-mono text-[11px] tracking-wide text-faint">
        {type}
      </span>
      <span className="text-[13.5px] text-muted">{desc}</span>
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <p className="label text-muted">DEVELOPERS · API V1</p>
      <h1 className="mt-2 text-3xl font-bold tracking-[-0.01em] text-ink sm:text-4xl">
        Public API
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">
        A read-only REST API, aligned with the official MCP Registry style and
        built for AI agents — so harnesses, CLIs and agents can search and plug
        in directly. No auth required. Rate limit: 60 req/min per IP. CORS
        open (*).
      </p>

      <h2 id="search" className="mt-12 text-xl font-bold text-ink">
        Search plugins
      </h2>
      <div className="mt-3">
        <CodeBlock>{`GET https://www.pluginworld.ai/api/v1/plugins`}</CodeBlock>
      </div>
      <div className="mt-4">
        <Param name="q" type="string" desc="Full-text search: name, description, keywords, owner" />
        <Param name="ecosystem" type="dsh | claude-code | mcp" desc="Filter by ecosystem" />
        <Param name="category" type="string" desc="Filter by category, e.g. ai-agents" />
        <Param
          name="sort"
          type="score | stars | trending | updated"
          desc="Sort order — defaults to score (unified quality score)"
        />
        <Param name="page" type="int" desc="Page number, starting at 1" />
        <Param name="per_page" type="int ≤ 100" desc="Items per page, default 24" />
      </div>
      <p className="mt-5 text-[14px] text-muted">
        Example: find an AI code review plugin
      </p>
      <div className="mt-2">
        <CodeBlock>{`curl "https://www.pluginworld.ai/api/v1/plugins?q=code+review&ecosystem=claude-code&sort=score"`}</CodeBlock>
      </div>

      <h2 className="mt-12 text-xl font-bold text-ink">Plugin details</h2>
      <div className="mt-3">
        <CodeBlock>{`GET /api/v1/plugins/{ecosystem}/{owner}/{name}
GET /api/v1/plugins/{ecosystem}/{owner}/{name}?include=readme`}</CodeBlock>
      </div>
      <p className="mt-4 text-[14px] leading-relaxed text-muted">
        Returns full metadata, the raw manifest, per-ecosystem install commands
        (<code className="font-mono text-[12.5px] text-ink">install[]</code>)
        and the score breakdown.
      </p>
      <div className="mt-3">
        <CodeBlock>{`curl "https://www.pluginworld.ai/api/v1/plugins/mcp/upstash/context7"`}</CodeBlock>
      </div>

      <h2 className="mt-12 text-xl font-bold text-ink">Market stats</h2>
      <div className="mt-3">
        <CodeBlock>{`GET /api/v1/stats

{
  "total_indexed": 1787,
  "by_ecosystem": { "dsh": 498, "claude-code": 496, "mcp": 793 },
  "source_totals": { "dsh": 11389, "claude-code": 5572, "mcp": 26612 },
  "categories": [{ "name": "ai-agents", "count": 1010 }],
  "last_synced_at": "2026-08-25T00:00:00Z"
}`}</CodeBlock>
      </div>

      <h2 id="quality-score" className="mt-12 text-xl font-bold text-ink">
        Unified quality score
      </h2>
      <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
        Every plugin gets a 0–100 score from five weighted dimensions,
        comparable across ecosystems:
      </p>
      <div className="mt-4">
        <Param name="maintenance" type="0–30" desc="Commit recency decay (full within 30 days, 180-day half-life)" />
        <Param name="popularity" type="0–25" desc="Star/download percentile within the ecosystem" />
        <Param name="compliance" type="0–20" desc="Manifest passes the official ecosystem schema" />
        <Param name="security" type="0–15" desc="License + install script static scan + owner verification" />
        <Param name="docs" type="0–10" desc="README length, structure, code examples" />
      </div>

      <h2 id="security-rating" className="mt-12 text-xl font-bold text-ink">
        Security rating
      </h2>
      <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
        Every plugin passes a security scan <em>before</em> it is indexed, on
        every daily sync: install-script pattern matching, obfuscation signals,
        typosquat detection against popular names, suspicious URL checks
        (shorteners, raw IPs, punycode), leaked-secret detection and
        star-velocity anomaly analysis. The result is a letter grade, returned
        as <code className="font-mono text-[13px] text-ink">security_grade</code>:
      </p>
      <div className="mt-4">
        <Param name="A+" type="Trusted" desc="Zero findings and a verified publisher (official org, claimed owner, or official-registry listed)" />
        <Param name="A" type="Safe" desc="Zero findings: license present, spec-valid manifest, clean scan" />
        <Param name="B" type="Low risk" desc="Minor findings only — e.g. missing license or manifest, isolated warnings" />
        <Param name="C" type="Caution" desc="Accumulated warnings: suspicious URLs, leaked secrets (redacted), star-velocity anomalies" />
        <Param name="D" type="Blocked" desc="Critical findings (malicious install scripts, typosquatting) — never listed; quarantined" />
      </div>
      <p className="mt-4 text-[14px] leading-relaxed text-muted">
        Detail responses also include{" "}
        <code className="font-mono text-[13px] text-ink">security_findings[]</code>{" "}
        with each finding&apos;s id, severity and message.
      </p>

      <h2 className="mt-12 text-xl font-bold text-ink">Tips for AI agents</h2>
      <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
        Recommended flow: search with{" "}
        <code className="font-mono text-[13px] text-ink">q + ecosystem</code>,
        take the top results by{" "}
        <code className="font-mono text-[13px] text-ink">quality_score</code>,
        then execute the{" "}
        <code className="font-mono text-[13px] text-ink">install[]</code>{" "}
        commands from the detail response. An MCP server wrapper
        (market_search / market_get tools) is on the roadmap (P2).
      </p>

      <div className="mt-12 rounded-[12px] border border-line bg-white p-6">
        <p className="label text-muted">FAIR USE</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          All data comes from public metadata (GitHub API, the official MCP
          Registry); we index and link back to source repositories. API data is
          free to use — just credit pluginworld.ai.
        </p>
      </div>
    </div>
  );
}
