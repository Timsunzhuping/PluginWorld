import Link from "next/link";
import type { Metadata } from "next";
import { SearchBar } from "@/components/search-bar";
import { PluginCard } from "@/components/plugin-card";
import { getStats, listPlugins } from "@/lib/data";
import { CATEGORY_LABELS } from "@/lib/categories";
import { ECOSYSTEMS, ECOSYSTEM_META, type Ecosystem, type SortKey } from "@/lib/types";
import { cn, formatCount } from "@/lib/utils";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Explore — Browse All Plugins",
  description:
    "Filter dsh / Claude Code / MCP plugins by ecosystem, category and quality score. Full-text search, unified scoring.",
  alternates: { canonical: "/browse" },
};

const SORTS: { key: SortKey; label: string }[] = [
  { key: "score", label: "Quality" },
  { key: "stars", label: "Stars" },
  { key: "trending", label: "Trending" },
  { key: "updated", label: "Updated" },
];

type Search = {
  q?: string;
  ecosystem?: string;
  category?: string;
  sort?: string;
  page?: string;
  view?: string;
};

function buildQuery(params: Search, overrides: Record<string, string | null>): string {
  const merged: Record<string, string> = {};
  for (const k of ["q", "ecosystem", "category", "sort"] as const) {
    if (params[k]) merged[k] = params[k]!;
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null) delete merged[k];
    else merged[k] = v;
  }
  const sp = new URLSearchParams(merged);
  return sp.size ? `/browse?${sp}` : "/browse";
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  // Take the first value when a query param repeats
  const params: Search = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  const ecosystem = ECOSYSTEMS.includes(params.ecosystem as Ecosystem)
    ? (params.ecosystem as Ecosystem)
    : undefined;
  const sort = SORTS.some((s) => s.key === params.sort)
    ? (params.sort as SortKey)
    : "score";
  const category =
    params.category && params.category in CATEGORY_LABELS ? params.category : undefined;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const q = params.q?.slice(0, 200);

  const [result, stats] = await Promise.all([
    listPlugins({ q, ecosystem, category, sort, page, perPage: 24 }),
    getStats(),
  ]);
  const totalPages = Math.max(1, Math.ceil(result.total / result.perPage));

  if (params.view === "categories") {
    return (
      <div className="mx-auto max-w-6xl px-5 py-12">
        <p className="label text-muted">CATEGORIES</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.01em] text-ink">
          Browse by category
        </h1>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.categories.map((cat) => (
            <Link
              key={cat.name}
              href={`/browse?category=${cat.name}`}
              className="flex items-center justify-between rounded-[12px] border border-line bg-white px-5 py-4 transition-colors hover:border-ink"
            >
              <span className="text-[15px] font-medium text-ink">
                {CATEGORY_LABELS[cat.name] ?? cat.name}
              </span>
              <span className="font-mono text-[12px] text-muted">{cat.count}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="max-w-2xl">
        <SearchBar defaultValue={q ?? ""} size="md" />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
        {/* Filters */}
        <aside>
          <h2 className="label text-muted">ECOSYSTEM</h2>
          <ul className="mt-3 space-y-1">
            <li>
              <Link
                href={buildQuery(params, { ecosystem: null, page: null })}
                className={cn(
                  "flex items-center justify-between rounded-[8px] px-3 py-1.5 text-[14px]",
                  !ecosystem
                    ? "bg-ink text-paper"
                    : "text-charcoal hover:bg-line/50",
                )}
              >
                All
                <span className="font-mono text-[11px] opacity-70">
                  {formatCount(stats.totalIndexed)}
                </span>
              </Link>
            </li>
            {ECOSYSTEMS.map((eco) => (
              <li key={eco}>
                <Link
                  href={buildQuery(params, { ecosystem: eco, page: null })}
                  className={cn(
                    "flex items-center justify-between rounded-[8px] px-3 py-1.5 text-[14px]",
                    ecosystem === eco
                      ? "bg-ink text-paper"
                      : "text-charcoal hover:bg-line/50",
                  )}
                >
                  {ECOSYSTEM_META[eco].label}
                  <span className="font-mono text-[11px] opacity-70">
                    {formatCount(stats.byEcosystem[eco])}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <h2 className="label mt-8 text-muted">CATEGORY</h2>
          <ul className="mt-3 space-y-0.5">
            {category && (
              <li>
                <Link
                  href={buildQuery(params, { category: null, page: null })}
                  className="block rounded-[8px] px-3 py-1 text-[13px] text-signal hover:bg-line/50"
                >
                  × Clear filter
                </Link>
              </li>
            )}
            {stats.categories.slice(0, 16).map((cat) => (
              <li key={cat.name}>
                <Link
                  href={buildQuery(params, { category: cat.name, page: null })}
                  className={cn(
                    "flex items-center justify-between rounded-[8px] px-3 py-1 text-[13px]",
                    category === cat.name
                      ? "bg-volt-tint text-volt-deep font-medium"
                      : "text-charcoal hover:bg-line/50",
                  )}
                >
                  {CATEGORY_LABELS[cat.name] ?? cat.name}
                  <span className="font-mono text-[11px] text-faint">{cat.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        {/* Results */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[12px] tracking-wide text-muted">
              {formatCount(result.total)} RESULTS
              {q ? (
                <>
                  {" · “"}
                  <span className="text-ink">{q}</span>
                  {"”"}
                </>
              ) : null}
            </p>
            <div className="flex gap-1 rounded-[8px] border border-line bg-white p-1">
              {SORTS.map((s) => (
                <Link
                  key={s.key}
                  href={buildQuery(params, { sort: s.key, page: null })}
                  className={cn(
                    "rounded-[6px] px-3 py-1 text-[12.5px]",
                    sort === s.key
                      ? "bg-ink text-paper"
                      : "text-charcoal hover:bg-line/50",
                  )}
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </div>

          {result.items.length === 0 ? (
            <div className="mt-16 text-center">
              <p className="text-lg font-medium text-ink">No plugins matched</p>
              <p className="mt-2 text-[14px] text-muted">
                Try another keyword, or{" "}
                <Link href="/submit" className="text-volt-dark underline underline-offset-2">
                  submit your plugin
                </Link>
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.items.map((p) => (
                <PluginCard key={p.slug} plugin={p} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-2">
              {page > 1 && (
                <Link
                  href={buildQuery(params, { page: String(page - 1) })}
                  className="rounded-[8px] border border-line bg-white px-4 py-2 text-[13px] text-charcoal hover:border-ink"
                >
                  ← Prev
                </Link>
              )}
              <span className="px-3 font-mono text-[12px] text-muted">
                {page} / {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={buildQuery(params, { page: String(page + 1) })}
                  className="rounded-[8px] border border-line bg-white px-4 py-2 text-[13px] text-charcoal hover:border-ink"
                >
                  Next →
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
