import { scanInstallScripts } from "./scoring";

/**
 * Security scan & rating system.
 * Every plugin is scanned BEFORE indexing; the result is a letter grade:
 *
 *   A+  Trusted  — zero findings AND a verified publisher (official org /
 *                  claimed owner / official-registry listed)
 *   A   Safe     — zero findings (license present, spec-valid, clean scan)
 *   B   Low risk — minor findings only: missing license/manifest, or at most
 *                  moderate warnings (score stays ≥ 70)
 *   C   Caution  — accumulated warnings (suspicious URLs, leaked secrets
 *                  redacted, star-velocity anomalies…), score < 70
 *   D   Blocked  — critical findings (malicious install-script patterns,
 *                  obfuscation, typosquat suspicion). NEVER indexed;
 *                  quarantined instead.
 *
 * Score: starts at 100; critical −60, warning −15, info −5 (floor 0).
 * Grade: any critical → D; zero findings → A+ (trusted) or A;
 * otherwise score ≥ 70 → B, else C.
 */

import type { SecurityFinding, SecurityGrade } from "./types";

export type { SecurityFinding, SecurityGrade };
export type Severity = SecurityFinding["severity"];

export interface SecurityReport {
  grade: SecurityGrade;
  score: number;
  findings: SecurityFinding[];
}

export interface SecurityScanInput {
  ecosystem: string;
  name: string;
  ownerGithub: string | null;
  manifest: Record<string, unknown> | null;
  /** Raw README markdown (pre-redaction), null if none */
  readmeMarkdown: string | null;
  license: string | null;
  stars: number;
  createdAt: string | null;
  specValid: boolean;
  officialOwner: boolean;
  verifiedOwner: boolean;
  registryListed: boolean;
  /** Leaked secrets were found (and redacted) in the README */
  secretsRedacted: boolean;
  /** Popular plugins in the same ecosystem: for typosquat detection */
  popularNames: { name: string; owner: string | null; stars: number }[];
  /** Injectable clock for tests */
  now?: Date;
}

const DAY = 24 * 60 * 60 * 1000;

const URL_SHORTENERS =
  /https?:\/\/(bit\.ly|tinyurl\.com|goo\.gl|t\.cn|is\.gd|cutt\.ly|rb\.gy|shorturl\.at)\//i;
const RAW_IP_URL = /https?:\/\/(\d{1,3}(?:\.\d{1,3}){3})(?=[:/\s"'<>)]|$)/g;

/** Loopback/private/link-local IPs are legitimate in docs (local dev servers) */
function isPrivateIp(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n > 255)) return true;
  const [a, b] = parts;
  return (
    a === 127 ||
    a === 10 ||
    a === 0 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 169 && b === 254)
  );
}

function hasPublicIpUrl(text: string): boolean {
  for (const m of text.matchAll(RAW_IP_URL)) {
    if (!isPrivateIp(m[1])) return true;
  }
  return false;
}
const PUNYCODE_URL = /https?:\/\/[^\s"'<>]*xn--/i;
const OBFUSCATION = /(new\s+Function\s*\(|eval\s*\(\s*(atob|Buffer\.from)|\\x[0-9a-f]{2}\\x[0-9a-f]{2}\\x[0-9a-f]{2})/i;

export function runSecurityScan(input: SecurityScanInput): SecurityReport {
  const findings: SecurityFinding[] = [];
  const now = input.now ?? new Date();

  // ---- critical ----
  if (scanInstallScripts(input.manifest)) {
    findings.push({
      id: "malicious-install-script",
      severity: "critical",
      message:
        "Install/lifecycle script matches known malicious patterns (piped shell, encoded payloads, destructive commands).",
    });
  }

  const manifestStr = input.manifest ? JSON.stringify(input.manifest) : "";
  if (OBFUSCATION.test(manifestStr)) {
    findings.push({
      id: "obfuscated-code-signal",
      severity: "critical",
      message: "Manifest contains obfuscation signals (dynamic eval / hex-packed strings).",
    });
  }

  const squatted = findTyposquatTarget(input);
  if (squatted) {
    findings.push({
      id: "typosquat-suspect",
      severity: "critical",
      message: `Name is one edit away from the popular plugin "${squatted}" with a fraction of its adoption — possible typosquatting.`,
    });
  }

  // ---- warning ----
  const hooks = lifecycleHooks(input.manifest);
  if (hooks.length > 0) {
    findings.push({
      id: "install-hooks-present",
      severity: "warning",
      message: `Package declares lifecycle install hooks (${hooks.join(", ")}) — code runs on install.`,
    });
  }

  const textToScan = `${input.readmeMarkdown ?? ""}\n${manifestStr}`;
  if (URL_SHORTENERS.test(textToScan)) {
    findings.push({
      id: "url-shortener",
      severity: "warning",
      message: "Docs or manifest link through a URL shortener — destination cannot be audited.",
    });
  }
  if (hasPublicIpUrl(textToScan)) {
    findings.push({
      id: "raw-ip-url",
      severity: "warning",
      message: "Docs or manifest reference a raw public IP address URL.",
    });
  }
  if (PUNYCODE_URL.test(textToScan)) {
    findings.push({
      id: "punycode-url",
      severity: "warning",
      message: "Docs or manifest contain a punycode (xn--) domain — possible homograph attack.",
    });
  }

  if (input.secretsRedacted) {
    findings.push({
      id: "leaked-secrets-redacted",
      severity: "warning",
      message: "Leaked credentials were found in the README (redacted in our copy) — signals weak security hygiene.",
    });
  }

  if (hasInsecureRemote(input.manifest)) {
    findings.push({
      id: "insecure-remote",
      severity: "warning",
      message: "Declares a remote MCP endpoint over plain http:// — traffic is unencrypted.",
    });
  }

  if (input.createdAt) {
    const ageDays = (now.getTime() - new Date(input.createdAt).getTime()) / DAY;
    if (ageDays >= 0 && ageDays < 30 && input.stars > 2000 && !input.officialOwner) {
      findings.push({
        id: "star-velocity-anomaly",
        severity: "warning",
        message: `Repo is ${Math.max(1, Math.round(ageDays))} days old with ${input.stars.toLocaleString()} stars — unusual velocity, possible star farming.`,
      });
    }
  }

  // ---- info ----
  if (!input.license) {
    findings.push({
      id: "no-license",
      severity: "info",
      message: "No license declared — usage terms are undefined.",
    });
  }
  if (!input.specValid) {
    findings.push({
      id: "unverified-manifest",
      severity: "info",
      message: "Manifest missing or failing the official ecosystem schema.",
    });
  }

  // ---- score & grade ----
  let score = 100;
  for (const f of findings) {
    score -= f.severity === "critical" ? 60 : f.severity === "warning" ? 15 : 5;
  }
  score = Math.max(0, score);

  const hasCritical = findings.some((f) => f.severity === "critical");
  const trusted =
    input.officialOwner || input.verifiedOwner || input.registryListed;

  let grade: SecurityGrade;
  if (hasCritical) grade = "D";
  else if (findings.length === 0) grade = trusted ? "A+" : "A";
  else if (score >= 70) grade = "B";
  else grade = "C";

  return { grade, score, findings };
}

/** true when the plugin must not be listed */
export function isBlocked(report: SecurityReport): boolean {
  return report.grade === "D";
}

function lifecycleHooks(manifest: Record<string, unknown> | null): string[] {
  if (!manifest || typeof manifest !== "object") return [];
  const scripts = (manifest as { scripts?: Record<string, unknown> }).scripts;
  if (!scripts || typeof scripts !== "object") return [];
  return ["preinstall", "install", "postinstall"].filter(
    (h) => typeof scripts[h] === "string",
  );
}

function hasInsecureRemote(manifest: Record<string, unknown> | null): boolean {
  if (!manifest) return false;
  const remotes = (manifest as { remotes?: { url?: string }[] }).remotes;
  if (!Array.isArray(remotes)) return false;
  return remotes.some(
    (r) => typeof r?.url === "string" && r.url.startsWith("http://"),
  );
}

/** Levenshtein distance capped at 2 (early exit for performance) */
export function editDistanceAtMost2(a: string, b: string): number | null {
  if (Math.abs(a.length - b.length) > 2) return null;
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i, ...new Array<number>(n).fill(0)];
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > 2) return null;
    prev = cur;
  }
  return prev[n] <= 2 ? prev[n] : null;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/^@[^/]+\//, "");
}

function findTyposquatTarget(input: SecurityScanInput): string | null {
  const own = normalizeName(input.name);
  if (own.length < 4) return null;
  for (const popular of input.popularNames) {
    const target = normalizeName(popular.name);
    if (target === own) continue; // same name → forks/mirrors, not typosquats
    if (popular.stars < 1000) continue;
    // must be dramatically less adopted than the target
    if (input.stars * 20 > popular.stars) continue;
    // same owner publishing variants is legitimate
    if (
      input.ownerGithub &&
      popular.owner &&
      input.ownerGithub.toLowerCase() === popular.owner.toLowerCase()
    ) {
      continue;
    }
    const maxDist = target.length >= 8 ? 2 : 1;
    const dist = editDistanceAtMost2(own, target);
    if (dist !== null && dist > 0 && dist <= maxDist) return popular.name;
  }
  return null;
}
