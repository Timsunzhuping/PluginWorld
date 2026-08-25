/**
 * Glama source — one of the largest public MCP directories (metaregistry).
 * Public API: GET https://glama.ai/api/mcp/v1/servers?first=100&after=<cursor>
 */
import { fetchJson, sleep } from "./lib";

export interface GlamaServer {
  name: string;
  namespace: string | null;
  description: string | null;
  repoFullName: string | null;
  license: string | null;
  url: string | null;
}

interface GlamaResponse {
  pageInfo?: { endCursor?: string; hasNextPage?: boolean };
  servers?: {
    name?: string;
    namespace?: string;
    slug?: string;
    description?: string;
    repository?: { url?: string };
    spdxLicense?: { name?: string };
    url?: string;
  }[];
}

function repoFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const m = /github\.com\/([^/]+)\/([^/#?]+)/.exec(url);
  return m ? `${m[1]}/${m[2].replace(/\.git$/, "")}` : null;
}

export async function fetchGlamaServers(
  maxPages = 5,
): Promise<{ servers: GlamaServer[]; totalSeen: number }> {
  const servers: GlamaServer[] = [];
  let cursor: string | undefined;
  let totalSeen = 0;

  for (let page = 0; page < maxPages; page++) {
    const url = new URL("https://glama.ai/api/mcp/v1/servers");
    url.searchParams.set("first", "100");
    if (cursor) url.searchParams.set("after", cursor);
    const data = await fetchJson<GlamaResponse>(url.toString());
    if (!data?.servers?.length) break;
    for (const s of data.servers) {
      totalSeen++;
      if (!s.name) continue;
      servers.push({
        name: s.name,
        namespace: s.namespace ?? null,
        description: s.description ?? null,
        repoFullName: repoFromUrl(s.repository?.url),
        license: s.spdxLicense?.name ?? null,
        url: s.url ?? null,
      });
    }
    if (!data.pageInfo?.hasNextPage || !data.pageInfo.endCursor) break;
    cursor = data.pageInfo.endCursor;
    await sleep(400);
  }

  console.log(`[glama] ${servers.length} servers fetched`);
  return { servers, totalSeen };
}
