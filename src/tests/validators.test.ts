import { describe, expect, it } from "vitest";
import { validateDshManifest } from "@/lib/validators/dsh";
import { validateClaudeCodeManifest } from "@/lib/validators/claude-code";
import { validateMcpManifest } from "@/lib/validators/mcp";

/** Spec requirement: 3 passing + 3 failing cases per ecosystem */

describe("dsh plugin spec validation", () => {
  // ---- pass ----
  it("✓ npm package named dsh-plugin-*", () => {
    const r = validateDshManifest({
      name: "dsh-plugin-weather",
      version: "1.0.0",
      description: "Weather plugin for dsh",
    });
    expect(r.valid).toBe(true);
    expect(r.extracted.npmPackage).toBe("dsh-plugin-weather");
  });
  it("✓ scoped package + dsh signal in peerDependencies", () => {
    const r = validateDshManifest({
      name: "@acme/harness-tools",
      version: "2.3.1",
      peerDependencies: { "@deepseek-ai/dsh-core": "^0.1.0" },
    });
    expect(r.valid).toBe(true);
  });
  it("✓ cordis field / keywords signal", () => {
    expect(
      validateDshManifest({ name: "my-tool", version: "0.1.0", cordis: {} }).valid,
    ).toBe(true);
    expect(
      validateDshManifest({ name: "my-tool", version: "0.1.0", keywords: ["dsh-plugin"] })
        .valid,
    ).toBe(true);
  });
  // ---- fail ----
  it("✗ missing version", () => {
    expect(validateDshManifest({ name: "dsh-plugin-x" }).valid).toBe(false);
  });
  it("✗ invalid npm package name", () => {
    expect(
      validateDshManifest({ name: "Not A Package!", version: "1.0.0" }).valid,
    ).toBe(false);
  });
  it("✗ ordinary package with no dsh signal / null manifest", () => {
    expect(
      validateDshManifest({ name: "left-pad", version: "1.3.0" }).valid,
    ).toBe(false);
    expect(validateDshManifest(null).valid).toBe(false);
  });
});

describe("Claude Code plugin spec validation", () => {
  // ---- pass ----
  it("✓ minimal plugin.json", () => {
    const r = validateClaudeCodeManifest({ name: "code-review" });
    expect(r.valid).toBe(true);
    expect(r.extracted.name).toBe("code-review");
  });
  it("✓ full plugin.json (commands/agents/hooks)", () => {
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
  it("✓ marketplace.json (marketplace index repo)", () => {
    const r = validateClaudeCodeManifest({
      name: "acme-marketplace",
      owner: { name: "Acme" },
      plugins: [{ name: "plugin-a", source: "./plugins/a" }],
    });
    expect(r.valid).toBe(true);
  });
  // ---- fail ----
  it("✗ missing name", () => {
    expect(validateClaudeCodeManifest({ version: "1.0.0" }).valid).toBe(false);
  });
  it("✗ name not kebab-case", () => {
    expect(validateClaudeCodeManifest({ name: "My Plugin!!" }).valid).toBe(false);
  });
  it("✗ empty marketplace (plugins is an empty array) / not an object", () => {
    expect(
      validateClaudeCodeManifest({ name: "empty market", plugins: [] }).valid,
    ).toBe(false);
    expect(validateClaudeCodeManifest("not an object").valid).toBe(false);
  });
});

describe("MCP server.json spec validation", () => {
  // ---- pass ----
  it("✓ npm-package-shaped server.json", () => {
    const r = validateMcpManifest({
      name: "io.github.acme/files",
      description: "Filesystem MCP server",
      version: "1.0.2",
      packages: [{ registryType: "npm", identifier: "@acme/mcp-files" }],
    });
    expect(r.valid).toBe(true);
    expect(r.extracted.npmPackage).toBe("@acme/mcp-files");
  });
  it("✓ remote shape (streamable-http)", () => {
    const r = validateMcpManifest({
      name: "com.example/api",
      description: "Hosted MCP endpoint",
      version: "2.0.0",
      remotes: [{ type: "streamable-http", url: "https://api.example.com/mcp" }],
    });
    expect(r.valid).toBe(true);
  });
  it("✓ title takes precedence as the display name", () => {
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
  // ---- fail ----
  it("✗ name missing namespace", () => {
    expect(
      validateMcpManifest({
        name: "just-a-name",
        description: "x",
        version: "1.0.0",
        packages: [{ registryType: "npm", identifier: "x" }],
      }).valid,
    ).toBe(false);
  });
  it("✗ missing description / version", () => {
    expect(
      validateMcpManifest({ name: "io.github.a/b", version: "1.0.0" }).valid,
    ).toBe(false);
    expect(
      validateMcpManifest({ name: "io.github.a/b", description: "x" }).valid,
    ).toBe(false);
  });
  it("✗ both packages and remotes missing", () => {
    expect(
      validateMcpManifest({
        name: "io.github.a/b",
        description: "x",
        version: "1.0.0",
      }).valid,
    ).toBe(false);
  });
});
