import type { Ecosystem } from "../types";
import { validateDshManifest } from "./dsh";
import { validateClaudeCodeManifest } from "./claude-code";
import { validateMcpManifest } from "./mcp";
import { validateSkillManifest } from "./skill";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  /** Normalized fields extracted from the manifest */
  extracted: {
    name?: string;
    version?: string;
    description?: string;
    npmPackage?: string;
    keywords?: string[];
  };
}

export function validateManifest(
  ecosystem: Ecosystem,
  manifest: unknown,
): ValidationResult {
  switch (ecosystem) {
    case "dsh":
      return validateDshManifest(manifest);
    case "claude-code":
      return validateClaudeCodeManifest(manifest);
    case "mcp":
      return validateMcpManifest(manifest);
    case "skills":
      return validateSkillManifest(manifest);
  }
}

export {
  validateDshManifest,
  validateClaudeCodeManifest,
  validateMcpManifest,
  validateSkillManifest,
};
