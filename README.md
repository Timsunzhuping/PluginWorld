# PluginWorld

> **跨生态 AI 插件聚合市场** — 一个搜索框找到 DeepSeek Harness (dsh)、Claude Code、MCP 三大生态的所有插件，附统一的质量与安全评分。
>
> Plug in. The world is ready. · www.pluginworld.ai

![ecosystems](https://img.shields.io/badge/ecosystems-dsh%20·%20claude--code%20·%20mcp-c6ff00?labelColor=16161a)

## 架构一览

- **Next.js 16 (App Router) + TypeScript + Tailwind v4** — SSG/ISR，SEO 优先
- **双模式数据层**
  - 无 `DATABASE_URL` → **快照模式**：直接读 `src/data/seed/`，零配置即可部署上线
  - 有 `DATABASE_URL` → **Postgres 模式**（Supabase/Neon + Drizzle）：FTS 搜索、认领、埋点、trending
- **收录管道**（`scripts/sync/`）：GitHub topic 抓取（`dsh-plugin` / `claude-code-plugin` / `mcp-server`）+ 官方 MCP Registry 同步 → 三套生态规范校验 → install script 静态扫描 → 统一质量评分 → 快照 / DB upsert
- **GitHub Actions cron**（每 6 小时）自动同步 + ISR revalidate
- **公开 REST API**（`/api/v1/*`）：为 AI agent 设计，CORS 开放，限流 60 req/min

## 快速开始

```sh
npm install
npm run dev        # 快照模式直接可用（仓库已含真实种子数据）
```

刷新插件数据（抓取真实生态数据，约 3-5 分钟）：

```sh
npm run sync                 # 只写快照
GITHUB_TOKEN=xxx npm run sync   # 带 token 限额更高，registry-only 条目可补全 star 数
```

## 部署上线（Vercel）

1. 推到 GitHub，Vercel 导入仓库 → 直接部署即可（快照模式，无需任何环境变量）
2. 绑定域名 `www.pluginworld.ai`
3. （推荐）接入 Postgres：
   ```sh
   export DATABASE_URL=postgres://…   # Supabase / Neon
   npm run db:generate && npm run db:migrate   # 建表（方案 §4）
   npm run db:seed                             # 灌入快照数据
   ```
   在 Vercel 中配置 `DATABASE_URL` 后重新部署，站点自动切到 DB 模式
4. （推荐）在 GitHub 仓库 Secrets 配置 `DATABASE_URL`、`REVALIDATE_SECRET`，
   Variables 配置 `SITE_URL`——`.github/workflows/sync.yml` 每 6 小时自动同步
5. （可选）GitHub OAuth 认领：创建 [OAuth App](https://github.com/settings/applications/new)
   （回调 `https://www.pluginworld.ai/api/auth/callback`），配置
   `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `AUTH_SECRET`

## 统一质量评分（0–100）

| 维度 | 权重 | 依据 |
|---|---|---|
| 维护度 | 30 | 最近 commit 时间衰减（30 天内满分，半衰期 180 天） |
| 流行度 | 25 | stars/downloads 的生态内百分位（跨生态可比） |
| 规范合规 | 20 | manifest 通过生态官方 schema 校验 |
| 安全 | 15 | license + install script 静态扫描 + owner 验证 |
| 文档 | 10 | README 长度、结构、代码示例 |

实现见 [`src/lib/scoring.ts`](src/lib/scoring.ts)（纯函数 + 单元测试），
三套校验器见 [`src/lib/validators/`](src/lib/validators)。

## 公开 API

```
GET /api/v1/plugins?q=&ecosystem=&category=&sort=score|stars|trending|updated&page=
GET /api/v1/plugins/{ecosystem}/{owner}/{name}?include=readme
GET /api/v1/stats
```

文档：https://www.pluginworld.ai/docs/api

## 命令

```sh
npm run dev          # 开发
npm run build        # 生产构建（SSG 全部详情页）
npm test             # vitest 单元测试（评分 + 三套校验器 + 搜索）
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run sync         # 收录管道 → 快照
npm run sync:db      # 收录管道 → 快照 + Postgres upsert
npm run db:generate  # drizzle 迁移文件生成
npm run db:migrate   # 执行迁移
npm run db:seed      # 快照灌库
```

## 合规与安全（方案 §9）

- 只索引**公开元数据**并链接回源仓库，不转存代码
- 每次收录执行 install script 静态扫描（curl|sh、rm -rf、encoded powershell 等模式）
- 举报通道：report@pluginworld.ai，恶意插件立即下架
