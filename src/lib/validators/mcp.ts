import { z } from "zod";
import type { ValidationResult } from "./index";

/**
 * MCP server spec validation, aligned with the official Registry's server.json schema
 * (static.modelcontextprotocol.io/schemas).
 * Requires name (reverse-DNS namespace, e.g. io.github.owner/repo), description, version;
 * plus at least one access method: packages[] (local run) or remotes[] (remote endpoint).
 * Compatibility: servers crawled from GitHub with only a package.json may fall back to
 * npm-package-shaped validation.
 */

const namespacedNameRe = /^[a-z0-9][a-z0-9._-]*(\.[a-z0-9][a-z0-9._-]*)+\/[A-Za-z0-9._-]+$/;

const packageSchema = z
  .object({
    registryType: z.string().optional(),
    registry_type: z.string().optional(),
    identifier: z.string().optional(),
    name: z.string().optional(),
    version: z.string().optional(),
    transport: z.unknown().optional(),
  })
  .loose();

const remoteSchema = z
  .object({
    type: z.string().min(1),
    url: z.string().min(1),
  })
  .loose();

const serverJsonSchema = z.object({
  name: z.string().regex(namespacedNameRe, "name must be namespaced like io.github.owner/name"),
  description: z.string().min(1),
  version: z.string().min(1),
  title: z.string().optional(),
  websiteUrl: z.string().optional(),
  repository: z
    .object({ url: z.string().optional(), source: z.string().optional() })
    .loose()
    .optional(),
  packages: z.array(packageSchema).optional(),
  remotes: z.array(remoteSchema).optional(),
});

export function validateMcpManifest(manifest: unknown): ValidationResult {
  if (manifest == null || typeof manifest !== "object") {
    return { valid: false, errors: ["manifest missing or not an object"], extracted: {} };
  }
  const parsed = serverJsonSchema.safeParse(manifest);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      extracted: extractLoose(manifest),
    };
  }
  const s = parsed.data;
  const hasEntry = (s.packages?.length ?? 0) > 0 || (s.remotes?.length ?? 0) > 0;
  if (!hasEntry) {
    return {
      valid: false,
      errors: ["server.json must declare at least one of packages[] or remotes[]"],
      extracted: extractLoose(manifest),
    };
  }
  const npmPkg = s.packages?.find(
    (p) => (p.registryType ?? p.registry_type) === "npm",
  );
  return {
    valid: true,
    errors: [],
    extracted: {
      name: s.title ?? s.name,
      version: s.version,
      description: s.description,
      npmPackage: npmPkg?.identifier ?? npmPkg?.name,
    },
  };
}

function extractLoose(m: object): ValidationResult["extracted"] {
  const anyM = m as Record<string, unknown>;
  return {
    name:
      typeof anyM.title === "string"
        ? anyM.title
        : typeof anyM.name === "string"
          ? anyM.name
          : undefined,
    version: typeof anyM.version === "string" ? anyM.version : undefined,
    description:
      typeof anyM.description === "string" ? anyM.description : undefined,
  };
}
