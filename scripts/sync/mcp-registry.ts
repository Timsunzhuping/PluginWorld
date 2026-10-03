/**
 * Official MCP Registry sync (spec §6).
 * API: GET /v0/servers?limit=100&cursor=… (server.json + namespace ownership verification)
 * Output: server list deduped by name (latest version kept),
 * merged with GitHub topic results in run-all (registryListed trust flag).
 */
import { MCP_REGISTRY, fetchJson, sleep } from "./lib";

export interface RegistryServer {
  name: string; // reverse-DNS namespace, e.g. io.github.owner/name
  title?: string;
  description?: string;
  version?: string;
  websiteUrl?: string;
  repository?: { url?: string; source?: string };
  packages?: {
    registryType?: string;
    registry_type?: string;
    identifier?: string;
    name?: string;
    version?: string;
  }[];
  remotes?: { type?: string; url?: string }[];
}

interface RegistryEntry {
  server: RegistryServer;
  _meta?: {
    "io.modelcontextprotocol.registry/official"?: {
      status?: string;
      isLatest?: boolean;
      publishedAt?: string;
      updatedAt?: string;
    };
  };
}

interface RegistryResponse {
  servers: RegistryEntry[];
  metadata?: { nextCursor?: string; count?: number };
}

export async function fetchRegistryServers(
  maxPages = 100,
  updatedSince?: string,
): Promise<{ servers: Map<string, RegistryServer>; totalSeen: number; inactiveNames: string[] }> {
  const byName = new Map<string, { server: RegistryServer; publishedAt: string }>();
  let cursor: string | undefined;
  let totalSeen = 0;
  const inactiveNames = new Set<string>();

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`${MCP_REGISTRY}/v0.1/servers`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("version", "latest");
    if (updatedSince) url.searchParams.set("updated_since", updatedSince);
    if (cursor) url.searchParams.set("cursor", cursor);
    const data = await fetchJson<RegistryResponse>(url.toString());
    if (!data) throw new Error("Official MCP Registry page unavailable; stop publication");
    if (!data.servers?.length) break;

    for (const entry of data.servers) {
      totalSeen++;
      const meta = entry._meta?.["io.modelcontextprotocol.registry/official"];
      if (meta?.status && meta.status !== "active") {
        if (entry.server?.name) inactiveNames.add(entry.server.name);
        continue;
      }
      if (meta?.isLatest === false) continue;
      const name = entry.server?.name;
      if (!name) continue;
      const publishedAt = meta?.publishedAt ?? "";
      const existing = byName.get(name);
      if (!existing || publishedAt > existing.publishedAt) {
        byName.set(name, { server: entry.server, publishedAt });
      }
    }

    cursor = data.metadata?.nextCursor;
    if (!cursor) break;
    if (page === maxPages - 1) throw new Error("MCP registry pagination budget exhausted before completion");
    await sleep(300);
  }

  const servers = new Map<string, RegistryServer>();
  for (const [name, { server }] of byName) servers.set(name, server);
  console.log(
    `[mcp-registry] ${servers.size} latest servers (${totalSeen} versions seen)`,
  );
  return { servers, totalSeen, inactiveNames: [...inactiveNames] };
}

/** registry name → GitHub repo full_name (when derivable) */
export function registryRepoFullName(server: RegistryServer): string | null {
  const url = server.repository?.url;
  if (url) {
    const m = /github\.com\/([^/]+)\/([^/#?]+)/.exec(url);
    if (m) return `${m[1]}/${m[2].replace(/\.git$/, "")}`;
  }
  // io.github.{owner}/{name} namespace
  const m = /^io\.github\.([^/]+)\/(.+)$/.exec(server.name);
  if (m) return `${m[1]}/${m[2]}`;
  return null;
}
