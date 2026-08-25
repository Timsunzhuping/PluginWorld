import type { Plugin } from "./types";

export interface InstallOption {
  label: string;
  command: string;
  note?: string;
}

/** Generate install commands per ecosystem (brand voice: "plug in") */
export function installOptions(plugin: Plugin): InstallOption[] {
  const repo = plugin.repoUrl?.replace(/^https:\/\/github\.com\//, "") ?? null;
  switch (plugin.ecosystem) {
    case "dsh": {
      const opts: InstallOption[] = [];
      if (plugin.npmPackage) {
        opts.push({
          label: "dsh Web UI",
          command: `npx @deepseek-ai/dsh web`,
          note: `Launch, then search "${plugin.name}" in the built-in market to plug it in`,
        });
        opts.push({
          label: "npm",
          command: `npm install ${plugin.npmPackage}`,
        });
      } else if (repo) {
        opts.push({
          label: "git",
          command: `git clone https://github.com/${repo}.git`,
          note: "No npm package published — plug in from source",
        });
      }
      return opts;
    }
    case "claude-code": {
      const opts: InstallOption[] = [];
      if (repo) {
        const isMarketplace =
          plugin.manifest != null &&
          Array.isArray((plugin.manifest as { plugins?: unknown[] }).plugins);
        if (isMarketplace) {
          opts.push({
            label: "Claude Code",
            command: `/plugin marketplace add ${repo}`,
            note: "Then run /plugin install <name> for any plugin it lists",
          });
        } else {
          opts.push({
            label: "Claude Code",
            command: `/plugin marketplace add ${repo}\n/plugin install ${plugin.name}`,
          });
        }
        opts.push({
          label: "git",
          command: `git clone https://github.com/${repo}.git`,
        });
      }
      return opts;
    }
    case "mcp": {
      const opts: InstallOption[] = [];
      const remotes = extractRemotes(plugin.manifest);
      if (plugin.npmPackage) {
        opts.push({
          label: "Claude Code",
          command: `claude mcp add ${safeName(plugin.name)} -- npx -y ${plugin.npmPackage}`,
        });
        opts.push({
          label: "JSON config",
          command: JSON.stringify(
            {
              mcpServers: {
                [safeName(plugin.name)]: {
                  command: "npx",
                  args: ["-y", plugin.npmPackage],
                },
              },
            },
            null,
            2,
          ),
          note: "For Claude Desktop, Cursor and other MCP clients",
        });
      } else if (remotes.length > 0) {
        opts.push({
          label: "Claude Code",
          command: `claude mcp add --transport http ${safeName(plugin.name)} ${remotes[0]}`,
        });
      } else if (repo) {
        opts.push({
          label: "git",
          command: `git clone https://github.com/${repo}.git`,
          note: "See the README to configure this MCP server",
        });
      }
      return opts;
    }
  }
}

function extractRemotes(manifest: Plugin["manifest"]): string[] {
  if (!manifest) return [];
  const remotes = (manifest as { remotes?: { url?: string }[] }).remotes;
  if (!Array.isArray(remotes)) return [];
  return remotes.map((r) => r?.url).filter((u): u is string => typeof u === "string");
}

function safeName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "server"
  );
}
