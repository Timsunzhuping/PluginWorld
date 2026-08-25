import Link from "next/link";
import { SearchBar } from "@/components/search-bar";
import { PluginCard } from "@/components/plugin-card";
import { EcosystemBadge } from "@/components/ecosystem-badge";
import { getStats, getTrending, listPlugins } from "@/lib/data";
import { ECOSYSTEMS, ECOSYSTEM_META } from "@/lib/types";
import { formatCount } from "@/lib/utils";

export const revalidate = 3600;

const QUICK_TAGS = ["ai code review", "browser", "memory", "database", "slack", "design"];

export default async function HomePage() {
  const [stats, trending, top] = await Promise.all([
    getStats(),
    getTrending(4),
    listPlugins({ sort: "score", perPage: 8 }),
  ]);
  const sourceTotal =
    stats.sourceTotals.dsh + stats.sourceTotals["claude-code"] + stats.sourceTotals.mcp;
  const universeLabel =
    sourceTotal > 0
      ? `${formatCount(Math.floor(sourceTotal / 1000) * 1000)}+`
      : formatCount(stats.totalIndexed);

  return (
    <div>
      {/* HERO */}
      <section className="border-b border-line bg-paper">
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-20 sm:pt-28">
          <p className="label text-muted">
            {universeLabel} PLUGINS TRACKED · 3 ECOSYSTEMS · ONE PORT
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-ink sm:text-6xl">
            全球最好的插件，
            <br />
            一个接口全部接入。
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-muted">
            一个搜索框找到 DeepSeek Harness、Claude Code、MCP
            三大生态的所有插件，附统一的质量与安全评分。
          </p>
          <div className="mt-8 max-w-2xl">
            <SearchBar />
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] tracking-wide text-faint">TRY</span>
              {QUICK_TAGS.map((tag) => (
                <Link
                  key={tag}
                  href={`/browse?q=${encodeURIComponent(tag)}`}
                  className="rounded-full border border-line bg-white px-3 py-1 font-mono text-[11px] text-charcoal transition-colors hover:border-ink"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ECOSYSTEMS */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold tracking-[-0.01em] text-ink sm:text-3xl">
            三大生态，一个端口
          </h2>
          <Link
            href="/browse"
            className="font-mono text-[12px] tracking-wide text-volt-dark hover:text-ink"
          >
            EXPLORE ALL →
          </Link>
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          {ECOSYSTEMS.map((eco) => (
            <Link
              key={eco}
              href={`/browse?ecosystem=${eco}`}
              className="group rounded-[12px] border border-line bg-white p-6 transition-colors hover:border-ink"
            >
              <div className="flex items-center justify-between">
                <EcosystemBadge ecosystem={eco} />
                <span className="font-mono text-[22px] font-medium text-ink">
                  {formatCount(stats.byEcosystem[eco])}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-ink group-hover:underline underline-offset-2">
                {ECOSYSTEM_META[eco].full}
              </h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
                {ECOSYSTEM_META[eco].tagline}
              </p>
              <p className="mt-4 font-mono text-[11px] tracking-wide text-faint">
                {stats.sourceTotals[eco] > 0
                  ? `${formatCount(stats.sourceTotals[eco])} IN THE WILD · TOP INDEXED`
                  : "CURATED INDEX"}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* TRENDING + TOP */}
      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="grid gap-10 lg:grid-cols-[280px_1fr]">
          <div>
            <h2 className="label text-muted">TRENDING THIS WEEK</h2>
            <ol className="mt-5 space-y-4">
              {trending.map((p, i) => (
                <li key={p.slug}>
                  <Link
                    href={`/plugins/${p.slug}`}
                    className="group flex items-baseline gap-3"
                  >
                    <span className="font-mono text-[13px] text-faint">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate text-[15px] font-medium text-ink group-hover:underline underline-offset-2">
                      {p.name}
                    </span>
                    <span className="ml-auto shrink-0 font-mono text-[12px] text-volt-dark">
                      ▲ {formatCount(p.stars)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            <div className="mt-8 rounded-[12px] bg-ink p-5">
              <p className="label text-faint">FOR AI AGENTS</p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-paper">
                公开 REST API，让你的 agent 直接搜索与接入插件。
              </p>
              <Link
                href="/docs/api"
                className="mt-3 inline-block font-mono text-[12px] tracking-wide text-volt hover:underline underline-offset-2"
              >
                GET /api/v1/plugins →
              </Link>
            </div>
          </div>
          <div>
            <div className="flex items-end justify-between">
              <h2 className="label text-muted">HIGHEST QUALITY SCORE</h2>
              <Link
                href="/browse?sort=score"
                className="font-mono text-[12px] tracking-wide text-volt-dark hover:text-ink"
              >
                MORE →
              </Link>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {top.items.map((p) => (
                <PluginCard key={p.slug} plugin={p} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* QUALITY SCORE 说明 */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="rounded-[12px] border border-line bg-white p-8 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <p className="label text-muted">UNIFIED QUALITY SCORE</p>
              <h2 className="mt-3 text-2xl font-bold tracking-[-0.01em] text-ink sm:text-3xl">
                跨生态统一质量评分
              </h2>
              <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-muted">
                每个插件在收录时自动完成官方规范校验、install script
                静态扫描与维护度分析，五个维度合成一个 0–100 分，跨生态可比。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(
                [
                  ["30", "维护度", "commit 衰减 · release 频率"],
                  ["25", "流行度", "生态内 star/下载百分位"],
                  ["20", "规范合规", "官方 schema 校验"],
                  ["15", "安全", "license · 脚本扫描 · owner"],
                  ["10", "文档", "README 结构与示例"],
                ] as const
              ).map(([weight, name, desc]) => (
                <div key={name} className="rounded-[8px] border border-line p-4">
                  <p className="font-mono text-[20px] font-medium text-volt-dark">
                    {weight}
                  </p>
                  <p className="mt-1 text-[13.5px] font-semibold text-ink">{name}</p>
                  <p className="mt-1 text-[11.5px] leading-snug text-faint">{desc}</p>
                </div>
              ))}
              <div className="flex items-center justify-center rounded-[8px] bg-volt p-4">
                <p className="text-center font-mono text-[13px] font-medium leading-tight text-ink">
                  = 100
                  <br />
                  <span className="text-[10px] tracking-wide">ONE SCORE</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-4 pt-4">
        <div className="rounded-[12px] bg-ink px-8 py-12 sm:px-12">
          <p className="label text-faint">FOR PLUGIN AUTHORS</p>
          <h2 className="mt-3 max-w-lg text-2xl font-bold tracking-[-0.01em] text-paper sm:text-3xl">
            Plug in. The world is ready.
          </h2>
          <p className="mt-3 max-w-lg text-[14.5px] leading-relaxed text-faint">
            给仓库加上生态 topic，PluginWorld 每 6 小时自动收录、校验、评分。
            无需注册，无需提交表单。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/submit"
              className="rounded-[8px] bg-volt px-6 py-3 text-[14.5px] font-semibold text-ink transition-colors hover:bg-[#b3e600]"
            >
              收录我的插件
            </Link>
            <Link
              href="/docs/api"
              className="rounded-[8px] border border-line-dark px-6 py-3 text-[14.5px] text-paper transition-colors hover:border-paper"
            >
              API 文档
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
