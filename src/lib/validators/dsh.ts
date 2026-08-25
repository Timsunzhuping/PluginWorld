import { z } from "zod";
import type { ValidationResult } from "./index";

/**
 * dsh (DeepSeek Harness) plugin spec validation.
 * dsh is built on Cordis ("everything is a plugin"); plugins ship as npm packages,
 * so the manifest is package.json.
 * Acceptance rules:
 *  1. Valid package.json (name + version required, name follows npm naming rules)
 *  2. Has at least one dsh plugin signal:
 *     - package name matches dsh-plugin-* / @scope/dsh-* / *-dsh-plugin
 *     - declares a `dsh` / `cordis` field
 *     - peerDependencies / dependencies include @deepseek-ai/dsh* or cordis
 *     - keywords include dsh-plugin / dsh / cordis-plugin
 */

const npmNameRe =
  /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

const packageJsonSchema = z.object({
  name: z.string().regex(npmNameRe, "invalid npm package name"),
  version: z.string().min(1, "version is required"),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  dsh: z.unknown().optional(),
  cordis: z.unknown().optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
});

const DSH_NAME_RE = /(^|\/)(dsh-plugin-|dsh-)|-dsh-plugin$|^dsh$/;
const DSH_DEP_RE = /^(@deepseek-ai\/dsh|cordis$|@cordisjs\/)/;
const DSH_KEYWORDS = new Set(["dsh-plugin", "dsh", "cordis-plugin", "deepseek-harness"]);

export function validateDshManifest(manifest: unknown): ValidationResult {
  if (manifest == null || typeof manifest !== "object") {
    return { valid: false, errors: ["manifest missing or not an object"], extracted: {} };
  }
  const parsed = packageJsonSchema.safeParse(manifest);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      extracted: extractLoose(manifest),
    };
  }
  const pkg = parsed.data;
  const deps = { ...pkg.dependencies, ...pkg.peerDependencies };
  const hasSignal =
    DSH_NAME_RE.test(pkg.name) ||
    pkg.dsh !== undefined ||
    pkg.cordis !== undefined ||
    Object.keys(deps).some((d) => DSH_DEP_RE.test(d)) ||
    (pkg.keywords ?? []).some((k) => DSH_KEYWORDS.has(k.toLowerCase()));

  const errors = hasSignal
    ? []
    : ["no dsh plugin signal (name pattern, dsh/cordis field, dsh dependency, or keyword)"];

  return {
    valid: hasSignal,
    errors,
    extracted: {
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      npmPackage: pkg.name,
      keywords: pkg.keywords,
    },
  };
}

function extractLoose(m: object): ValidationResult["extracted"] {
  const anyM = m as Record<string, unknown>;
  return {
    name: typeof anyM.name === "string" ? anyM.name : undefined,
    version: typeof anyM.version === "string" ? anyM.version : undefined,
    description: typeof anyM.description === "string" ? anyM.description : undefined,
  };
}
