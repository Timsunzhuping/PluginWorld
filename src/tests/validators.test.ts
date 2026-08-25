import { describe, expect, it } from "vitest";
import { validateDshManifest } from "@/lib/validators/dsh";
import { validateClaudeCodeManifest } from "@/lib/validators/claude-code";
import { validateMcpManifest } from "@/lib/validators/mcp";

/** 方案要求：每个生态 3 个通过 + 3 个失败用例 */

describe("dsh 插件规范校验", () => {
  // ---- 通过 ----
  it("✓ dsh-plugin-* 命名的 npm 包", () => {
    const r = validateDshManifest({
      name: "dsh-plugin-weather",
      version: "1.0.0",
      description: "Weather plugin for dsh",
    });
    expect(r.valid).toBe(true);
    expect(r.extracted.npmPackage).toBe("dsh-plugin-weather");
  });
  it("✓ scoped 包 + peerDependencies 里的 dsh 信号", () => {
    const r = validateDshManifest({
      name: "@acme/harness-tools",
      version: "2.3.1",
      peerDependencies: { "@deepseek-ai/dsh-core": "^0.1.0" },
    });
    expect(r.valid).toBe(true);
  });
  it("✓ cordis 字段 / keywords 信号", () => {
    expect(
      validateDshManifest({ name: "my-tool", version: "0.1.0", cordis: {} }).valid,
    ).toBe(true);
    expect(
      validateDshManifest({ name: "my-tool", version: "0.1.0", keywords: ["dsh-plugin"] })
        .valid,
    ).toBe(true);
  });
  // ---- 失败 ----
  it("✗ 缺 version", () => {
    expect(validateDshManifest({ name: "dsh-plugin-x" }).valid).toBe(false);
  });
  it("✗ 非法 npm 包名", () => {
    expect(
      validateDshManifest({ name: "Not A Package!", version: "1.0.0" }).valid,
    ).toBe(false);
  });
  it("✗ 无任何 dsh 信号的普通包 / 空 manifest", () => {
    expect(
      validateDshManifest({ name: "left-pad", version: "1.3.0" }).valid,
    ).toBe(false);
    expect(validateDshManifest(null).valid).toBe(false);
  });
});

describe("Claude Code 插件规范校验", () => {
  // ---- 通过 ----
  it("✓ 最小 plugin.json", () => {
    const r = validateClaudeCodeManifest({ name: "code-review" });
    expect(r.valid).toBe(true);
    expect(r.extracted.name).toBe("code-review");
  });
  it("✓ 完整 plugin.json（commands/agents/hooks）", () => {
    const r = validateClaudeCodeManifest({
      name: "deploy-helper",
      version: "1.2.0",
      description: "Deployment workflows",
      author: { name: "Acme" },
      commands: ["./commands/deploy.md"],
      agents: "./agents/",
      hooks: "./hooks/hooks.json",
    });
    expect(r.valid).toBe(true);
    expect(r.extracted.version).toBe("1.2.0");
  });
  it("✓ marketplace.json（市场索引仓库）", () => {
    const r = validateClaudeCodeManifest({
      name: "acme-marketplace",
      owner: { name: "Acme" },
      plugins: [{ name: "plugin-a", source: "./plugins/a" }],
    });
    expect(r.valid).toBe(true);
  });
  // ---- 失败 ----
  it("✗ 缺 name", () => {
    expect(validateClaudeCodeManifest({ version: "1.0.0" }).valid).toBe(false);
  });
  it("✗ name 非 kebab-case", () => {
    expect(validateClaudeCodeManifest({ name: "My Plugin!!" }).valid).toBe(false);
  });
  it("✗ 空 marketplace（plugins 为空数组）/ 非对象", () => {
    expect(
      validateClaudeCodeManifest({ name: "empty market", plugins: [] }).valid,
    ).toBe(false);
    expect(validateClaudeCodeManifest("not an object").valid).toBe(false);
  });
});

describe("MCP server.json 规范校验", () => {
  // ---- 通过 ----
  it("✓ npm 包形态的 server.json", () => {
    const r = validateMcpManifest({
      name: "io.github.acme/files",
      description: "Filesystem MCP server",
      version: "1.0.2",
      packages: [{ registryType: "npm", identifier: "@acme/mcp-files" }],
    });
    expect(r.valid).toBe(true);
    expect(r.extracted.npmPackage).toBe("@acme/mcp-files");
  });
  it("✓ remote 形态（streamable-http）", () => {
    const r = validateMcpManifest({
      name: "com.example/api",
      description: "Hosted MCP endpoint",
      version: "2.0.0",
      remotes: [{ type: "streamable-http", url: "https://api.example.com/mcp" }],
    });
    expect(r.valid).toBe(true);
  });
  it("✓ title 优先作为展示名", () => {
    const r = validateMcpManifest({
      name: "io.github.acme/gmail",
      title: "Gmail",
      description: "Gmail via MCP",
      version: "0.3.0",
      packages: [{ registryType: "pypi", identifier: "mcp-gmail" }],
    });
    expect(r.valid).toBe(true);
    expect(r.extracted.name).toBe("Gmail");
  });
  // ---- 失败 ----
  it("✗ name 缺命名空间", () => {
    expect(
      validateMcpManifest({
        name: "just-a-name",
        description: "x",
        version: "1.0.0",
        packages: [{ registryType: "npm", identifier: "x" }],
      }).valid,
    ).toBe(false);
  });
  it("✗ 缺 description / version", () => {
    expect(
      validateMcpManifest({ name: "io.github.a/b", version: "1.0.0" }).valid,
    ).toBe(false);
    expect(
      validateMcpManifest({ name: "io.github.a/b", description: "x" }).valid,
    ).toBe(false);
  });
  it("✗ packages 与 remotes 都缺失", () => {
    expect(
      validateMcpManifest({
        name: "io.github.a/b",
        description: "x",
        version: "1.0.0",
      }).valid,
    ).toBe(false);
  });
});
