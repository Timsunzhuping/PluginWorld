# PluginWorld — 开发守则

跨生态 AI 插件聚合市场（dsh / Claude Code / MCP）。上游需求文档：
`../plugin-marketplace-开发方案.md`，品牌规范：`../PluginWorld 视觉体系.html`。

## 铁律

- 严格使用方案 §3 技术选型：Next.js App Router + TS + Tailwind + Drizzle + Postgres。不引入方案外依赖。
- 数据模型以方案 §4 为准，`src/lib/db/schema.ts` 中字段命名不得偏离（snake_case 列名）。
- 每完成一个任务运行 `npm run typecheck && npm run lint && npm test` 后再继续。
- 评分逻辑（`src/lib/scoring.ts`）必须保持纯函数，任何改动都要有对应测试。
- 三套校验器各维持 ≥3 通过 / ≥3 失败测试用例。

## 品牌视觉（V1.0）

- 60% Ink `#16161A` / 30% Paper `#F7F6F3` + White / 5% Volt `#C6FF00`
- Volt 只用于 CTA、接通状态、关键数据、hover；Volt 上文字只允许 Ink；不做大面积正文背景
- 字体：Outfit（标题/UI）+ IBM Plex Mono（代码/版本/数据/标签）+ Noto Sans SC 回退
- 圆角 8/12px，边框 1px `#E4E2DC`，**无阴影**
- 文案：克制、精准、有电流感；短句优先，动词开头；说「接入」不说「下载安装」；数据用 mono 字体

## 双模式数据层

`lib/data.ts`：`DATABASE_URL` 缺省时读 `src/data/seed/` 快照（勿手改，由
`npm run sync` 生成）；存在时走 Drizzle + Postgres FTS。两侧行为需保持一致。
