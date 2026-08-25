export const ECOSYSTEMS = ["dsh", "claude-code", "mcp"] as const;
export type Ecosystem = (typeof ECOSYSTEMS)[number];

export const ECOSYSTEM_META: Record<
  Ecosystem,
  { label: string; full: string; tagline: string; color: string }
> = {
  dsh: {
    label: "dsh",
    full: "DeepSeek Harness",
    tagline: "Everything is a plugin. Cordis 架构的开源 agent harness。",
    color: "#c6ff00",
  },
  "claude-code": {
    label: "Claude Code",
    full: "Claude Code",
    tagline: "Anthropic 官方 agentic 编程工具的插件与技能生态。",
    color: "#d9541e",
  },
  mcp: {
    label: "MCP",
    full: "Model Context Protocol",
    tagline: "连接 AI 与外部世界的开放协议，服务器即插件。",
    color: "#7da300",
  },
};

export interface ScoreBreakdown {
  /** 维护度 0-30 */
  maintenance: number;
  /** 流行度 0-25 */
  popularity: number;
  /** 规范合规 0-20 */
  compliance: number;
  /** 安全 0-15 */
  security: number;
  /** 文档 0-10 */
  docs: number;
}

export interface TrustFlags {
  verifiedOwner?: boolean;
  officialOwner?: boolean;
  registryListed?: boolean;
  hasLicense?: boolean;
  hasTests?: boolean;
  specValid?: boolean;
}

export interface Plugin {
  id: string;
  ecosystem: Ecosystem;
  /** {ecosystem}/{owner}/{name} */
  slug: string;
  name: string;
  description: string | null;
  repoUrl: string | null;
  homepage: string | null;
  ownerGithub: string | null;
  license: string | null;
  manifest: Record<string, unknown> | null;
  categories: string[];
  keywords: string[];
  stars: number;
  downloads: number;
  forks: number;
  versionLatest: string | null;
  lastCommitAt: string | null;
  specValid: boolean;
  qualityScore: number;
  scoreBreakdown: ScoreBreakdown;
  trustFlags: TrustFlags;
  /** npm 包名（dsh / 部分 mcp），用于生成安装命令 */
  npmPackage: string | null;
  createdAt: string;
  updatedAt: string;
  syncedAt: string;
}

export interface MarketStats {
  totalIndexed: number;
  /** 各生态源头总量（GitHub topic total_count / registry 总数） */
  sourceTotals: Record<Ecosystem, number>;
  byEcosystem: Record<Ecosystem, number>;
  categories: { name: string; count: number }[];
  lastSyncedAt: string;
}

export type SortKey = "score" | "stars" | "trending" | "updated";

export interface PluginQuery {
  q?: string;
  ecosystem?: Ecosystem;
  category?: string;
  sort?: SortKey;
  page?: number;
  perPage?: number;
}

export interface PluginQueryResult {
  items: Plugin[];
  total: number;
  page: number;
  perPage: number;
}
