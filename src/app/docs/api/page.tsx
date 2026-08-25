import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API — 公开接口文档",
  description:
    "PluginWorld 公开 REST API v1：跨生态插件搜索、详情、统计。为 AI agent 设计。",
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
        公开 API
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">
        只读 REST API，对齐官方 MCP Registry 风格。为 AI agent 设计——让
        harness、CLI 与 agent 直接搜索并接入插件。无需鉴权，限流 60 req/min/IP，
        跨域开放（CORS *）。
      </p>

      <h2 id="search" className="mt-12 text-xl font-bold text-ink">
        搜索插件
      </h2>
      <div className="mt-3">
        <CodeBlock>{`GET https://www.pluginworld.ai/api/v1/plugins`}</CodeBlock>
      </div>
      <div className="mt-4">
        <Param name="q" type="string" desc="全文搜索：名称、描述、关键词、owner" />
        <Param name="ecosystem" type="dsh | claude-code | mcp" desc="按生态筛选" />
        <Param name="category" type="string" desc="按分类筛选，如 ai-agents" />
        <Param
          name="sort"
          type="score | stars | trending | updated"
          desc="排序，默认 score（统一质量评分）"
        />
        <Param name="page" type="int" desc="页码，从 1 开始" />
        <Param name="per_page" type="int ≤ 100" desc="每页条数，默认 24" />
      </div>
      <p className="mt-5 text-[14px] text-muted">示例：找一个 AI code review 插件</p>
      <div className="mt-2">
        <CodeBlock>{`curl "https://www.pluginworld.ai/api/v1/plugins?q=code+review&ecosystem=claude-code&sort=score"`}</CodeBlock>
      </div>

      <h2 className="mt-12 text-xl font-bold text-ink">插件详情</h2>
      <div className="mt-3">
        <CodeBlock>{`GET /api/v1/plugins/{ecosystem}/{owner}/{name}
GET /api/v1/plugins/{ecosystem}/{owner}/{name}?include=readme`}</CodeBlock>
      </div>
      <p className="mt-4 text-[14px] leading-relaxed text-muted">
        返回完整元数据、原始 manifest、按生态生成的安装命令（
        <code className="font-mono text-[12.5px] text-ink">install[]</code>
        ）与分项质量评分。
      </p>
      <div className="mt-3">
        <CodeBlock>{`curl "https://www.pluginworld.ai/api/v1/plugins/mcp/modelcontextprotocol/servers"`}</CodeBlock>
      </div>

      <h2 className="mt-12 text-xl font-bold text-ink">市场统计</h2>
      <div className="mt-3">
        <CodeBlock>{`GET /api/v1/stats

{
  "total_indexed": 347,
  "by_ecosystem": { "dsh": 112, "claude-code": 98, "mcp": 137 },
  "source_totals": { "dsh": 11347, "claude-code": 5564, "mcp": 25565 },
  "categories": [{ "name": "ai-agents", "count": 84 }],
  "last_synced_at": "2026-08-25T00:00:00Z"
}`}</CodeBlock>
      </div>

      <h2 id="quality-score" className="mt-12 text-xl font-bold text-ink">
        统一质量评分
      </h2>
      <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
        每个插件 0–100 分，五个维度加权，跨生态可比：
      </p>
      <div className="mt-4">
        <Param name="maintenance" type="0–30" desc="最近 commit 时间衰减（30 天内满分，半衰期 180 天）" />
        <Param name="popularity" type="0–25" desc="stars/downloads 的生态内百分位" />
        <Param name="compliance" type="0–20" desc="manifest 通过生态官方 schema 校验" />
        <Param name="security" type="0–15" desc="license + install script 静态扫描 + owner 验证" />
        <Param name="docs" type="0–10" desc="README 长度、结构、代码示例" />
      </div>

      <h2 className="mt-12 text-xl font-bold text-ink">给 AI Agent 的提示</h2>
      <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
        推荐流程：先用 <code className="font-mono text-[13px] text-ink">q + ecosystem</code>{" "}
        搜索，按 <code className="font-mono text-[13px] text-ink">quality_score</code>{" "}
        取前几名，再取详情中的{" "}
        <code className="font-mono text-[13px] text-ink">install[]</code>{" "}
        字段直接执行接入命令。MCP server 封装（market_search / market_get 工具）在
        roadmap P2。
      </p>

      <div className="mt-12 rounded-[12px] border border-line bg-white p-6">
        <p className="label text-muted">FAIR USE</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          数据来源为公开元数据（GitHub API、官方 MCP
          Registry），我们只索引并链接回源仓库。API 数据可自由使用，注明来源
          pluginworld.ai 即可。
        </p>
      </div>
    </div>
  );
}
