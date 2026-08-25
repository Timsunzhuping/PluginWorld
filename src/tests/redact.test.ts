import { describe, expect, it } from "vitest";
import { redactSecrets } from "../../scripts/sync/lib";

describe("redactSecrets 第三方 README 密钥脱敏", () => {
  it("脱敏 Slack webhook", () => {
    // 运行时拼接假 URL，避免测试夹具本身触发 secret 扫描
    const fakeHook =
      "https://hooks.slack.com/" + ["services", "T00000000", "B00000000", "X".repeat(24)].join("/");
    expect(redactSecrets(`post to ${fakeHook} now`)).toBe(
      "post to https://hooks.slack.com/services/REDACTED now",
    );
  });
  it("脱敏 GitHub token / OpenAI key / AWS key", () => {
    expect(redactSecrets("ghp_abcdefghijklmnopqrstuvwxyz012345")).toBe("gh?_REDACTED");
    expect(redactSecrets("sk-abcdefghijklmnopqrstuvwxyz")).toBe("sk-REDACTED");
    expect(redactSecrets("AKIAIOSFODNN7EXAMPLE")).toBe("AKIA_REDACTED");
  });
  it("正常文本不受影响", () => {
    const text = "Install with npm install sk-plugin and enjoy ghost mode";
    expect(redactSecrets(text)).toBe(text);
  });
});
