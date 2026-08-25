/**
 * 官方 MCP Registry 同步（方案 §6）。
 * API: GET /v0/servers?limit=100&cursor=…（server.json + 命名空间所有权验证）
 * 输出：按 name 去重（保留最新版本）的 server 列表，
 * 供 run-all 与 GitHub topic 结果合并（registryListed trust flag）。
 */
import { MCP_REGISTRY, fetchJson, sleep } from "./lib";

export interface RegistryServer {
  name: string; // 反向 DNS 命名空间，如 io.github.owner/name
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
  maxPages = 30,
): Promise<{ servers: Map<string, RegistryServer>; totalSeen: number }> {
  const byName = new Map<string, { server: RegistryServer; publishedAt: string }>();
  let cursor: string | undefined;
  let totalSeen = 0;

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`${MCP_REGISTRY}/v0/servers`);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);
    const data = await fetchJson<RegistryResponse>(url.toString());
    if (!data?.servers?.length) break;

    for (const entry of data.servers) {
      totalSeen++;
      const meta = entry._meta?.["io.modelcontextprotocol.registry/official"];
      if (meta?.status && meta.status !== "active") continue;
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
    await sleep(300);
  }

  const servers = new Map<string, RegistryServer>();
  for (const [name, { server }] of byName) servers.set(name, server);
  console.log(
    `[mcp-registry] ${servers.size} latest servers (${totalSeen} versions seen)`,
  );
  return { servers, totalSeen };
}

/** registry name → GitHub repo full_name（若可推导） */
export function registryRepoFullName(server: RegistryServer): string | null {
  const url = server.repository?.url;
  if (url) {
    const m = /github\.com\/([^/]+)\/([^/#?]+)/.exec(url);
    if (m) return `${m[1]}/${m[2].replace(/\.git$/, "")}`;
  }
  // io.github.{owner}/{name} 命名空间
  const m = /^io\.github\.([^/]+)\/(.+)$/.exec(server.name);
  if (m) return `${m[1]}/${m[2]}`;
  return null;
}
