import { z } from "zod";
import type { ValidationResult } from "./index";

/**
 * Claude Code plugin spec validation.
 * Official spec: .claude-plugin/plugin.json in the repo (single plugin)
 * or .claude-plugin/marketplace.json (plugin marketplace index).
 * plugin.json requires name; optional version / description / author /
 * commands / agents / skills / hooks / mcpServers, etc.
 */

const pluginNameRe = /^[a-z0-9]+(-[a-z0-9]+)*$/i;

const authorSchema = z.union([
  z.string(),
  z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    url: z.string().optional(),
  }),
]);

const pluginJsonSchema = z.object({
  name: z.string().min(1).regex(pluginNameRe, "name must be kebab-case"),
  version: z.string().optional(),
  description: z.string().optional(),
  author: authorSchema.optional(),
  homepage: z.string().optional(),
  repository: z.union([z.string(), z.object({}).loose()]).optional(),
  license: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  commands: z.union([z.string(), z.array(z.string())]).optional(),
  agents: z.union([z.string(), z.array(z.string())]).optional(),
  skills: z.union([z.string(), z.array(z.string())]).optional(),
  hooks: z.union([z.string(), z.object({}).loose()]).optional(),
  mcpServers: z.union([z.string(), z.object({}).loose()]).optional(),
});

const marketplaceJsonSchema = z.object({
  name: z.string().min(1),
  owner: z.union([z.string(), z.object({}).loose()]).optional(),
  metadata: z.object({}).loose().optional(),
  plugins: z.array(z.object({ name: z.string().min(1) }).loose()).min(1),
});

export function validateClaudeCodeManifest(manifest: unknown): ValidationResult {
  if (manifest == null || typeof manifest !== "object") {
    return { valid: false, errors: ["manifest missing or not an object"], extracted: {} };
  }

  // marketplace.json (marketplace index repo) also counts as compliant
  const asMarketplace = marketplaceJsonSchema.safeParse(manifest);
  if (asMarketplace.success && Array.isArray((manifest as { plugins?: unknown[] }).plugins)) {
    const m = asMarketplace.data;
    return {
      valid: true,
      errors: [],
      extracted: {
        name: m.name,
        description: `Marketplace · ${m.plugins.length} plugins`,
      },
    };
  }

  const parsed = pluginJsonSchema.safeParse(manifest);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      extracted: {
        name: typeof (manifest as Record<string, unknown>).name === "string"
          ? String((manifest as Record<string, unknown>).name)
          : undefined,
        version:
          typeof (manifest as Record<string, unknown>).version === "string"
            ? String((manifest as Record<string, unknown>).version)
            : undefined,
      },
    };
  }
  const p = parsed.data;
  return {
    valid: true,
    errors: [],
    extracted: {
      name: p.name,
      version: p.version,
      description: p.description,
      keywords: p.keywords,
    },
  };
}
