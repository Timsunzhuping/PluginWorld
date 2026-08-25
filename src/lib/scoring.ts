import type { ScoreBreakdown } from "./types";

/**
 * Unified quality scoring (spec §5)
 * quality_score = maintenance 30 + popularity 25 + spec compliance 20 + security 15 + docs 10
 * All pure functions, for easy unit testing and cross-ecosystem comparability.
 */

const DAY = 24 * 60 * 60 * 1000;

export interface ScoringInput {
  /** Time of the most recent commit */
  lastCommitAt: Date | null;
  /** Star percentile within the ecosystem, 0-1 (computed by the caller over the full dataset) */
  starsPercentile: number;
  /** Download percentile within the ecosystem, 0-1; pass null when no data */
  downloadsPercentile: number | null;
  /** Whether the manifest passes the ecosystem's official schema validation */
  specValid: boolean;
  /** Whether a manifest was provided (a manifest that fails validation ≠ no manifest at all) */
  hasManifest: boolean;
  /** Whether a license exists */
  hasLicense: boolean;
  /** Whether the install-script static scan found suspicious patterns */
  suspiciousInstallScript: boolean;
  /** Whether the owner is verified (claimed / official organization) */
  verifiedOwner: boolean;
  /** README plain-text length */
  readmeLength: number;
  /** Whether the README contains code examples */
  readmeHasCodeExample: boolean;
  /** Whether the README has structure (≥2 headings) */
  readmeHasStructure: boolean;
  /** Reference time for scoring (defaults to now; injectable for tests and replayability) */
  now?: Date;
}

/** Maintenance 0-30: decays with time since the last commit */
export function scoreMaintenance(
  lastCommitAt: Date | null,
  now: Date = new Date(),
): number {
  if (!lastCommitAt) return 0;
  const days = Math.max(0, (now.getTime() - lastCommitAt.getTime()) / DAY);
  // Full score within 30 days, then exponential decay with a ~180-day half-life
  if (days <= 30) return 30;
  const decayed = 30 * Math.pow(0.5, (days - 30) / 180);
  return round1(Math.max(0, decayed));
}

/** Popularity 0-25: per-ecosystem percentile of stars/downloads (comparable across ecosystems) */
export function scorePopularity(
  starsPercentile: number,
  downloadsPercentile: number | null,
): number {
  const s = clamp01(starsPercentile);
  if (downloadsPercentile == null) return round1(25 * s);
  const d = clamp01(downloadsPercentile);
  return round1(25 * (0.6 * s + 0.4 * d));
}

/** Spec compliance 0-20: manifest passes official schema validation */
export function scoreCompliance(specValid: boolean, hasManifest: boolean): number {
  if (specValid) return 20;
  if (hasManifest) return 8; // has a manifest but failed validation
  return 0;
}

/** Security 0-15: license + install-script scan + owner verification */
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

/** Docs 0-10: README length/structure and presence of examples */
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

/** Install-script static scan: known malicious/suspicious patterns (P0 minimal version, spec §9) */
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

/** Compute a percentile (0-1) over a set of values, used for per-ecosystem star/download ranking */
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
