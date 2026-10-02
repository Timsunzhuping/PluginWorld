export const ECOSYSTEMS = ["dsh", "claude-code", "mcp", "skills"] as const;
export type Ecosystem = (typeof ECOSYSTEMS)[number];

export const ECOSYSTEM_META: Record<
  Ecosystem,
  { label: string; full: string; tagline: string; color: string }
> = {
  dsh: {
    label: "dsh",
    full: "DeepSeek Harness",
    tagline: "Everything is a plugin. The open-source agent harness built on Cordis.",
    color: "#c6ff00",
  },
  "claude-code": {
    label: "Claude Code",
    full: "Claude Code",
    tagline: "Plugins and skills for Anthropic's agentic coding tool.",
    color: "#d9541e",
  },
  mcp: {
    label: "MCP",
    full: "Model Context Protocol",
    tagline: "The open protocol connecting AI to the world — servers as plugins.",
    color: "#7da300",
  },
  skills: {
    label: "Skills",
    full: "Agent Skills",
    tagline: "Reusable procedural knowledge for AI agents — one install, any agent.",
    color: "#16161a",
  },
};

export interface ScoreBreakdown {
  /** Maintenance 0-30 */
  maintenance: number;
  /** Popularity 0-25 */
  popularity: number;
  /** Spec compliance 0-20 */
  compliance: number;
  /** Security 0-15 */
  security: number;
  /** Docs 0-10 */
  docs: number;
}

export interface TrustFlags {
  verifiedOwner?: boolean;
  officialOwner?: boolean;
  registryListed?: boolean;
  hasLicense?: boolean;
  hasTests?: boolean;
  specValid?: boolean;
  /** Additional community sources this plugin was found in */
  npmListed?: boolean;
  glamaListed?: boolean;
  skillsShListed?: boolean;
}

export type SecurityGrade = "A+" | "A" | "B" | "C" | "D";

export interface SecurityFinding {
  id: string;
  severity: "critical" | "warning" | "info";
  message: string;
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
  /** Security rating (assigned by the pre-index security scan; D is never listed) */
  securityGrade: SecurityGrade;
  securityFindings: SecurityFinding[];
  /** npm package name (dsh / some mcp), used to generate install commands */
  npmPackage: string | null;
  createdAt: string;
  updatedAt: string;
  syncedAt: string;
}

export interface MarketStats {
  totalIndexed: number;
  /** Upstream totals per ecosystem (GitHub topic total_count / registry total) */
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
