import type { Plugin } from "./types";

export interface InstallOption {
  label: string;
  command: string;
  note?: string;
}

/** 按生态生成安装/接入命令（品牌语言：说「接入」不说「下载安装」） */
export function installOptions(plugin: Plugin): InstallOption[] {
  const repo = plugin.repoUrl?.replace(/^https:\/\/github\.com\//, "") ?? null;
  switch (plugin.ecosystem) {
    case "dsh": {
      const opts: InstallOption[] = [];
      if (plugin.npmPackage) {
        opts.push({
          label: "dsh Web UI",
          command: `npx @deepseek-ai/dsh web`,
          note: `启动后在内置插件市场搜索 “${plugin.name}” 一键接入`,
        });
        opts.push({
          label: "npm",
          command: `npm install ${plugin.npmPackage}`,
        });
      } else if (repo) {
        opts.push({
          label: "git",
          command: `git clone https://github.com/${repo}.git`,
          note: "该插件未发布 npm 包，从源码接入",
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
            note: "添加后用 /plugin install <name> 接入其中的插件",
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
          note: "适用于 Claude Desktop / Cursor 等 MCP 客户端",
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
          note: "参考 README 配置该 MCP server",
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
