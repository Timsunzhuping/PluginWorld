import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EcosystemBadge } from "@/components/ecosystem-badge";
import { ScoreBadge, ScoreBars } from "@/components/score-badge";
import { SecurityGradeBadge, SecurityPanel } from "@/components/security-grade";
import { InstallCommand } from "@/components/install-command";
import { PluginCard } from "@/components/plugin-card";
import { ClaimButton } from "./claim-button";
import { getAllSlugs, getPlugin, getReadmeHtml, getSimilar } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { installOptions } from "@/lib/install";
import { ECOSYSTEM_META, ECOSYSTEMS, type Ecosystem } from "@/lib/types";
import { avatarText, formatCount, formatDate, timeAgo } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/lib/categories";

// ISR: detail pages regenerate hourly
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await getAllSlugs();
  return slugs.map((slug) => {
    const [ecosystem, owner, name] = slug.split("/");
    return { ecosystem, owner, name };
  });
}

type Params = { ecosystem: string; owner: string; name: string };

async function load(params: Params) {
  const { ecosystem, owner, name } = params;
  if (!ECOSYSTEMS.includes(ecosystem as Ecosystem)) return null;
  return getPlugin(`${ecosystem}/${owner}/${name}`);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const plugin = await load(await params);
  if (!plugin) return { title: "Not found" };
  const title = `${plugin.name} — ${ECOSYSTEM_META[plugin.ecosystem].full} plugin`;
  const description =
    plugin.description ??
    `${plugin.name} · a ${ECOSYSTEM_META[plugin.ecosystem].full} plugin with a quality score of ${plugin.qualityScore}/100`;
  return {
    title,
    description,
    alternates: { canonical: `/plugins/${plugin.slug}` },
    openGraph: { title, description, type: "website" },
  };
}

export default async function PluginPage({ params }: { params: Promise<Params> }) {
  const plugin = await load(await params);
  if (!plugin) notFound();

  const [readmeHtml, similar, session] = await Promise.all([
    getReadmeHtml(plugin.slug),
    getSimilar(plugin, 4),
    getSession(),
  ]);
  const options = installOptions(plugin);
  const repoPath = plugin.repoUrl?.replace(/^https:\/\/github\.com\//, "");

  // SEO: SoftwareApplication structured data (schema.org)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: plugin.name,
    description: plugin.description ?? undefined,
    url: `https://www.pluginworld.ai/plugins/${plugin.slug}`,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Cross-platform",
    softwareVersion: plugin.versionLatest ?? undefined,
    license: plugin.license ?? undefined,
    author: plugin.ownerGithub
      ? { "@type": "Person", name: plugin.ownerGithub }
      : undefined,
    aggregateRating:
      plugin.qualityScore > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: plugin.qualityScore,
            bestRating: 100,
            worstRating: 0,
            ratingCount: 1,
          }
        : undefined,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb */}
      <nav className="font-mono text-[12px] text-muted">
        <Link href="/browse" className="hover:text-ink">
          explore
        </Link>
        {" / "}
        <Link href={`/browse?ecosystem=${plugin.ecosystem}`} className="hover:text-ink">
          {plugin.ecosystem}
        </Link>
        {" / "}
        <span className="text-ink">{plugin.name}</span>
      </nav>

      {/* Header */}
      <header className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4 min-w-0">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[12px] bg-ink font-mono text-[24px] text-volt">
            {avatarText(plugin.name)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-[-0.01em] text-ink sm:text-3xl">
                {plugin.name}
              </h1>
              <EcosystemBadge ecosystem={plugin.ecosystem} />
              {plugin.specValid && (
                <span className="font-mono text-[11px] tracking-wide text-volt-dark">
                  ✓ SPEC VERIFIED
                </span>
              )}
              {plugin.trustFlags.registryListed && (
                <span className="font-mono text-[11px] tracking-wide text-volt-dark">
                  ✓ REGISTRY
                </span>
              )}
              {plugin.trustFlags.verifiedOwner && (
                <span className="font-mono text-[11px] tracking-wide text-volt-dark">
                  ✓ OWNER
                </span>
              )}
            </div>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-charcoal">
              {plugin.description ?? "No description yet."}
            </p>
            <p className="mt-2 font-mono text-[12px] text-muted">
              {plugin.ownerGithub && <>@{plugin.ownerGithub} · </>}
              {plugin.versionLatest && `v${plugin.versionLatest.replace(/^v/, "")} · `}
              {plugin.license ?? "no license"} · updated {timeAgo(plugin.lastCommitAt)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <div className="text-right">
            <p className="label text-muted">SECURITY</p>
            <SecurityGradeBadge
              grade={plugin.securityGrade}
              className="mt-1 h-10 min-w-12 justify-center text-[18px]"
            />
          </div>
          <div className="text-right">
            <p className="label text-muted">SCORE</p>
            <ScoreBadge
              score={plugin.qualityScore}
              className="mt-1 h-10 min-w-12 text-[18px]"
            />
          </div>
          <div className="text-right">
            <p className="label text-muted">
              {plugin.downloads > 0 ? "INSTALLS" : "STARS"}
            </p>
            <p className="mt-1 font-mono text-[24px] font-medium text-ink">
              <span className="text-volt-dark">▲</span>{" "}
              {formatCount(plugin.downloads > 0 ? plugin.downloads : plugin.stars)}
            </p>
          </div>
        </div>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="min-w-0">
          {options.length > 0 && (
            <>
              <h2 className="label text-muted">PLUG IN</h2>
              <div className="mt-3">
                <InstallCommand options={options} slug={plugin.slug} />
              </div>
            </>
          )}

          <h2 className="label mt-10 text-muted">README</h2>
          {readmeHtml ? (
            <article
              className="readme mt-3 rounded-[12px] border border-line bg-white p-6 sm:p-8"
              dangerouslySetInnerHTML={{ __html: readmeHtml }}
            />
          ) : (
            <div className="mt-3 rounded-[12px] border border-line bg-white p-8 text-center">
              <p className="text-[14px] text-muted">
                README not indexed yet — view it in the{" "}
                {plugin.repoUrl ? (
                  <a
                    href={plugin.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-volt-dark underline underline-offset-2"
                  >
                    source repository
                  </a>
                ) : (
                  "source repository"
                )}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-8">
          <SecurityPanel plugin={plugin} />

          <div className="rounded-[12px] border border-line bg-white p-5">
            <h2 className="label text-muted">QUALITY BREAKDOWN</h2>
            <div className="mt-4">
              <ScoreBars plugin={plugin} />
            </div>
          </div>

          <div className="rounded-[12px] border border-line bg-white p-5">
            <h2 className="label text-muted">METADATA</h2>
            <dl className="mt-4 space-y-3 text-[13.5px]">
              {repoPath && (
                <MetaRow label="Repository">
                  <a
                    href={plugin.repoUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-volt-dark hover:underline underline-offset-2"
                  >
                    {repoPath}
                  </a>
                </MetaRow>
              )}
              {plugin.homepage && (
                <MetaRow label="Homepage">
                  <a
                    href={plugin.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-volt-dark hover:underline underline-offset-2"
                  >
                    {plugin.homepage.replace(/^https?:\/\//, "").slice(0, 40)}
                  </a>
                </MetaRow>
              )}
              {plugin.npmPackage && (
                <MetaRow label="Package">
                  <span className="break-all font-mono text-[12.5px]">
                    {plugin.npmPackage}
                  </span>
                </MetaRow>
              )}
              <MetaRow label="Stars">
                <span className="font-mono">{plugin.stars.toLocaleString()}</span>
              </MetaRow>
              <MetaRow label="Forks">
                <span className="font-mono">{plugin.forks.toLocaleString()}</span>
              </MetaRow>
              {plugin.downloads > 0 && (
                <MetaRow label="Downloads/mo">
                  <span className="font-mono">{plugin.downloads.toLocaleString()}</span>
                </MetaRow>
              )}
              <MetaRow label="Last commit">
                <span className="font-mono">{formatDate(plugin.lastCommitAt)}</span>
              </MetaRow>
              <MetaRow label="Synced">
                <span className="font-mono">{formatDate(plugin.syncedAt)}</span>
              </MetaRow>
            </dl>
          </div>

          {plugin.categories.length > 0 && (
            <div>
              <h2 className="label text-muted">CATEGORIES</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {plugin.categories.map((cat) => (
                  <Link
                    key={cat}
                    href={`/browse?category=${cat}`}
                    className="rounded-full border border-line bg-white px-3 py-1 font-mono text-[11px] text-charcoal hover:border-ink"
                  >
                    {CATEGORY_LABELS[cat] ?? cat}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {plugin.keywords.length > 0 && (
            <div>
              <h2 className="label text-muted">KEYWORDS</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {plugin.keywords.slice(0, 12).map((kw) => (
                  <Link
                    key={kw}
                    href={`/browse?q=${encodeURIComponent(kw)}`}
                    className="rounded-full bg-line/60 px-3 py-1 font-mono text-[11px] text-muted hover:bg-line"
                  >
                    {kw}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <ClaimButton
            slug={plugin.slug}
            ownerGithub={plugin.ownerGithub}
            sessionLogin={session?.login ?? null}
            claimed={Boolean(plugin.trustFlags.verifiedOwner)}
          />

          <div className="rounded-[12px] border border-line bg-paper p-4">
            <p className="text-[12px] leading-relaxed text-muted">
              PluginWorld indexes public metadata only and links back to the source repo. Found a malicious plugin?
              <a
                href={`mailto:report@pluginworld.ai?subject=${encodeURIComponent(
                  `Report: ${plugin.slug}`,
                )}`}
                className="text-signal underline underline-offset-2"
              >
                Report it
              </a>
            </p>
          </div>
        </aside>
      </div>

      {/* Similar plugins */}
      {similar.length > 0 && (
        <section className="mt-16">
          <h2 className="label text-muted">SIMILAR PLUGINS</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((p) => (
              <PluginCard key={p.slug} plugin={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </div>
  );
}
