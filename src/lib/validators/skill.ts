import { z } from "zod";
import type { ValidationResult } from "./index";

/**
 * Agent Skill spec validation (agentskills.io / skills.sh convention).
 * A skill is a directory containing SKILL.md with YAML frontmatter.
 * Required frontmatter: name (kebab-case, ≤64 chars) and description (non-empty).
 * Optional: license, version, allowed-tools, metadata.
 * The manifest we validate is the parsed frontmatter object.
 */

const skillNameRe = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const skillFrontmatterSchema = z.object({
  name: z.string().min(1).max(64).regex(skillNameRe, "name must be kebab-case"),
  description: z.string().min(10, "description must be at least 10 characters"),
  license: z.string().optional(),
  version: z.string().optional(),
});

export function validateSkillManifest(manifest: unknown): ValidationResult {
  if (manifest == null || typeof manifest !== "object") {
    return {
      valid: false,
      errors: ["SKILL.md frontmatter missing or unparseable"],
      extracted: {},
    };
  }
  const parsed = skillFrontmatterSchema.safeParse(manifest);
  if (!parsed.success) {
    const anyM = manifest as Record<string, unknown>;
    return {
      valid: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      extracted: {
        name: typeof anyM.name === "string" ? anyM.name : undefined,
        description:
          typeof anyM.description === "string" ? anyM.description : undefined,
      },
    };
  }
  const fm = parsed.data;
  return {
    valid: true,
    errors: [],
    extracted: {
      name: fm.name,
      version: fm.version,
      description: fm.description,
    },
  };
}

/**
 * Minimal YAML frontmatter parser for SKILL.md (flat key: value pairs,
 * quoted strings, and folded multi-line values indented under a key).
 * Returns null when no frontmatter block is present.
 */
export function parseFrontmatter(markdown: string): {
  frontmatter: Record<string, unknown> | null;
  body: string;
} {
  const m = /^(?:﻿)?---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(markdown);
  if (!m) return { frontmatter: null, body: markdown };
  const body = markdown.slice(m[0].length);
  const fm: Record<string, unknown> = {};
  let currentKey: string | null = null;
  for (const rawLine of m[1].split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trim().startsWith("#")) continue;
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(rawLine);
    if (kv && !rawLine.startsWith(" ") && !rawLine.startsWith("\t")) {
      const [, key, rawValue] = kv;
      currentKey = key;
      let value = rawValue.trim();
      // folded/literal block scalars (>- , |) collect from indented lines
      if (value === "" || value === ">" || value === ">-" || value === "|" || value === "|-") {
        fm[key] = "";
        continue;
      }
      if (
        (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
        (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
      ) {
        value = value.slice(1, -1);
      }
      fm[key] = value;
    } else if (currentKey && (rawLine.startsWith("  ") || rawLine.startsWith("\t"))) {
      // continuation line of a block scalar
      const prev = fm[currentKey];
      if (typeof prev === "string") {
        fm[currentKey] = (prev ? prev + " " : "") + rawLine.trim();
      }
    }
  }
  return { frontmatter: Object.keys(fm).length ? fm : null, body };
}
