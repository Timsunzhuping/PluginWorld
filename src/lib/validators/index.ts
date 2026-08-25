import type { Ecosystem } from "../types";
import { validateDshManifest } from "./dsh";
import { validateClaudeCodeManifest } from "./claude-code";
import { validateMcpManifest } from "./mcp";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  /** 从 manifest 提取的规范化字段 */
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
  }
}

export { validateDshManifest, validateClaudeCodeManifest, validateMcpManifest };
