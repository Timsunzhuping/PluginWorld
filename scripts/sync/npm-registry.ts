/**
 * npm registry source — one of the largest plugin distribution communities.
 * Search API: https://registry.npmjs.org/-/v1/search?text=keywords:<kw>
 * Returns package metadata incl. monthly downloads, license and repository link.
 *
 * Keyword mapping:
 *   dsh         → keywords:dsh-plugin, keywords:cordis-plugin
 *   claude-code → keywords:claude-code
 *   mcp         → keywords:mcp-server
 */
import { fetchJson, sleep } from "./lib";
import type { Ecosystem } from "../../src/lib/types";

export interface NpmPackage {
  name: string;
  version: string;
  description: string | null;
  license: string | null;
  repoFullName: string | null;
  npmUrl: string;
  homepage: string | null;
  keywords: string[];
  monthlyDownloads: number;
  publishedAt: string | null;
}

interface NpmSearchResult {
  total: number;
  objects: {
    downloads?: { monthly?: number };
    package: {
      name: string;
      version: string;
      description?: string;
      license?: string;
      keywords?: string[];
      date?: string;
      links?: { npm?: string; homepage?: string; repository?: string };
    };
  }[];
}

const KEYWORDS_BY_ECOSYSTEM: Record<Ecosystem, string[]> = {
  dsh: ["dsh-plugin", "cordis-plugin"],
  "claude-code": ["claude-code"],
  mcp: ["mcp-server"],
};

function repoFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const m = /github\.com\/([^/]+)\/([^/#?]+)/.exec(url);
  return m ? `${m[1]}/${m[2].replace(/\.git$/, "")}` : null;
}

/**
 * Fetch top npm packages per ecosystem, ranked by npm's relevance score,
 * then filtered by a minimum monthly-download bar (quality gate) and
 * re-ranked by monthly downloads.
 */
export async function fetchNpmPackages(
  ecosystem: Ecosystem,
  pagesPerKeyword = 2,
  minMonthlyDownloads = 200,
): Promise<{ packages: NpmPackage[]; totalCount: number }> {
  const byName = new Map<string, NpmPackage>();
  let totalCount = 0;

  for (const keyword of KEYWORDS_BY_ECOSYSTEM[ecosystem]) {
    for (let page = 0; page < pagesPerKeyword; page++) {
      const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(
        `keywords:${keyword}`,
      )}&size=250&from=${page * 250}`;
      const data = await fetchJson<NpmSearchResult>(url);
      if (!data?.objects?.length) break;
      totalCount = Math.max(totalCount, data.total);
      for (const obj of data.objects) {
        const p = obj.package;
        if (byName.has(p.name)) continue;
        byName.set(p.name, {
          name: p.name,
          version: p.version,
          description: p.description ?? null,
          license: p.license ?? null,
          repoFullName: repoFromUrl(p.links?.repository),
          npmUrl: p.links?.npm ?? `https://www.npmjs.com/package/${p.name}`,
          homepage: p.links?.homepage ?? null,
          keywords: p.keywords ?? [],
          monthlyDownloads: obj.downloads?.monthly ?? 0,
          publishedAt: p.date ?? null,
        });
      }
      if (data.objects.length < 250) break;
      await sleep(400);
    }
  }

  const packages = [...byName.values()]
    .filter((p) => p.monthlyDownloads >= minMonthlyDownloads)
    .sort((a, b) => b.monthlyDownloads - a.monthlyDownloads);

  console.log(
    `[npm] ${ecosystem}: ${packages.length} packages ≥${minMonthlyDownloads} dl/mo (universe: ${totalCount})`,
  );
  return { packages, totalCount };
}
