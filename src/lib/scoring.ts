import type { ScoreBreakdown } from "./types";

/**
 * 统一质量评分（开发方案 §5）
 * quality_score = 维护度30 + 流行度25 + 规范合规20 + 安全15 + 文档10
 * 全部为纯函数，便于单元测试与跨生态可比。
 */

const DAY = 24 * 60 * 60 * 1000;

export interface ScoringInput {
  /** 最近一次 commit 时间 */
  lastCommitAt: Date | null;
  /** 生态内 star 百分位 0-1（由调用方在全量数据上计算） */
  starsPercentile: number;
  /** 生态内下载量百分位 0-1，无数据传 null */
  downloadsPercentile: number | null;
  /** manifest 是否通过该生态官方 schema 校验 */
  specValid: boolean;
  /** 是否提供了 manifest（有 manifest 但校验失败 ≠ 完全没有） */
  hasManifest: boolean;
  /** license 是否存在 */
  hasLicense: boolean;
  /** install script 静态扫描是否发现可疑模式 */
  suspiciousInstallScript: boolean;
  /** owner 是否已验证（认领 / 官方组织） */
  verifiedOwner: boolean;
  /** README 纯文本长度 */
  readmeLength: number;
  /** README 是否包含代码示例 */
  readmeHasCodeExample: boolean;
  /** README 是否有结构（≥2 个标题） */
  readmeHasStructure: boolean;
  /** 评分基准时间（默认当前时间，注入以便测试与可重放） */
  now?: Date;
}

/** 维护度 0-30：最近 commit 时间衰减 */
export function scoreMaintenance(
  lastCommitAt: Date | null,
  now: Date = new Date(),
): number {
  if (!lastCommitAt) return 0;
  const days = Math.max(0, (now.getTime() - lastCommitAt.getTime()) / DAY);
  // 30 天内满分，之后按半衰期 ~180 天指数衰减
  if (days <= 30) return 30;
  const decayed = 30 * Math.pow(0.5, (days - 30) / 180);
  return round1(Math.max(0, decayed));
}

/** 流行度 0-25：stars/downloads 的生态内百分位（跨生态可比） */
export function scorePopularity(
  starsPercentile: number,
  downloadsPercentile: number | null,
): number {
  const s = clamp01(starsPercentile);
  if (downloadsPercentile == null) return round1(25 * s);
  const d = clamp01(downloadsPercentile);
  return round1(25 * (0.6 * s + 0.4 * d));
}

/** 规范合规 0-20：manifest 通过官方 schema 校验 */
export function scoreCompliance(specValid: boolean, hasManifest: boolean): number {
  if (specValid) return 20;
  if (hasManifest) return 8; // 有 manifest 但未通过校验
  return 0;
}

/** 安全 0-15：license + install script 扫描 + owner 验证 */
export function scoreSecurity(input: {
  hasLicense: boolean;
  suspiciousInstallScript: boolean;
  verifiedOwner: boolean;
}): number {
  let score = 0;
  if (input.hasLicense) score += 6;
  if (!input.suspiciousInstallScript) score += 5;
  if (input.verifiedOwner) score += 4;
  return score;
}

/** 文档 0-10：README 长度/结构、有无示例 */
export function scoreDocs(input: {
  readmeLength: number;
  readmeHasCodeExample: boolean;
  readmeHasStructure: boolean;
}): number {
  let score = 0;
  if (input.readmeLength >= 300) score += 2;
  if (input.readmeLength >= 1500) score += 2;
  if (input.readmeHasStructure) score += 3;
  if (input.readmeHasCodeExample) score += 3;
  return score;
}

export function computeScore(input: ScoringInput): {
  total: number;
  breakdown: ScoreBreakdown;
} {
  const breakdown: ScoreBreakdown = {
    maintenance: scoreMaintenance(input.lastCommitAt, input.now ?? new Date()),
    popularity: scorePopularity(input.starsPercentile, input.downloadsPercentile),
    compliance: scoreCompliance(input.specValid, input.hasManifest),
    security: scoreSecurity(input),
    docs: scoreDocs(input),
  };
  const total = round1(
    breakdown.maintenance +
      breakdown.popularity +
      breakdown.compliance +
      breakdown.security +
      breakdown.docs,
  );
  return { total, breakdown };
}

/** install script 静态扫描：已知恶意/可疑模式（P0 最小版本，方案 §9） */
const SUSPICIOUS_PATTERNS: RegExp[] = [
  /curl[^\n|;&]*\|\s*(ba)?sh/i, // curl | sh
  /wget[^\n|;&]*\|\s*(ba)?sh/i,
  /rm\s+-rf\s+[~/]/,
  /eval\s*\(\s*atob/i,
  /child_process[^\n]*base64/i,
  /\bnc\s+-e\b/,
  /powershell[^\n]*-enc(odedcommand)?\b/i,
];

export function scanInstallScripts(manifest: unknown): boolean {
  if (!manifest || typeof manifest !== "object") return false;
  const scripts = (manifest as { scripts?: Record<string, unknown> }).scripts;
  if (!scripts || typeof scripts !== "object") return false;
  const hooks = [
    "preinstall",
    "install",
    "postinstall",
    "prepare",
    "prepublish",
  ];
  for (const hook of hooks) {
    const cmd = scripts[hook];
    if (typeof cmd !== "string") continue;
    if (SUSPICIOUS_PATTERNS.some((re) => re.test(cmd))) return true;
  }
  return false;
}

/** 在一组数值上计算百分位（0-1），用于生态内 star/下载排名 */
export function percentile(value: number, sortedAscending: number[]): number {
  if (sortedAscending.length === 0) return 0;
  let lo = 0;
  let hi = sortedAscending.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedAscending[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo / sortedAscending.length;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
