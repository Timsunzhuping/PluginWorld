# PluginWorld

> **The cross-ecosystem AI plugin marketplace** — one search box for every plugin and skill across DeepSeek Harness (dsh), Claude Code, MCP and Agent Skills, with unified quality and security scores.
>
> Plug in. The world is ready. · www.pluginworld.ai

![ecosystems](https://img.shields.io/badge/ecosystems-dsh%20·%20claude--code%20·%20mcp-c6ff00?labelColor=16161a)

## Architecture

- **Next.js (App Router) + TypeScript + Tailwind v4** — SSG/ISR, SEO-first
- **Dual-mode data layer**
  - No `DATABASE_URL` → **snapshot mode**: reads `src/data/seed/`, deployable with zero config
  - With `DATABASE_URL` → **Postgres mode** (Supabase/Neon + Drizzle): FTS search, claims, events, trending
- **Daily community scan** (`scripts/sync/`, GitHub Actions cron at 02:00 UTC) over the
  world's mainstream plugin communities:
  - GitHub topics (`dsh-plugin` / `claude-code-plugin` / `mcp-server`, top 500 by stars each)
  - Official MCP Registry (registry.modelcontextprotocol.io)
  - npm registry (keywords `dsh-plugin`, `cordis-plugin`, `claude-code`, `mcp-server`, ranked by monthly downloads)
  - Glama MCP directory (metaregistry)
  - skills.sh leaderboard (top 500 Agent Skills by installs, SKILL.md validated)
- **Pre-index security scan → rating**: every candidate is scanned BEFORE listing;
  grade D is quarantined, never indexed (see below)
- **Public REST API** (`/api/v1/*`): built for AI agents, CORS open, 60 req/min rate limit

## Security rating (assigned before indexing, re-checked daily)

The scanner (`src/lib/security.ts`) checks: malicious install-script patterns,
code-obfuscation signals, typosquatting against popular names (edit-distance +
adoption-gap heuristic), suspicious URLs (shorteners / raw IPs / punycode),
leaked credentials in docs (also auto-redacted), insecure http:// MCP remotes,
and star-velocity anomalies (star farming).

| Grade | Meaning | Rule |
|---|---|---|
| **A+** | Trusted | Zero findings + verified publisher (official org / claimed owner / registry-listed) |
| **A** | Safe | Zero findings |
| **B** | Low risk | Minor findings only (missing license/manifest, isolated warnings; score ≥ 70) |
| **C** | Caution | Accumulated warnings (score < 70) |
| **D** | Blocked | Critical findings — **never listed**, written to `src/data/seed/quarantine.json` |

Scoring: 100 − (critical 60 / warning 15 / info 5). Grades surface on every
plugin card, detail page and in the API (`security_grade`, `security_findings`).

## Quick start

```sh
npm install
npm run dev        # snapshot mode works out of the box (real seed data included)
```

Refresh plugin data (crawls live ecosystem data, ~5 minutes):

```sh
npm run sync                    # snapshot only
GITHUB_TOKEN=xxx npm run sync   # higher API limits; also enriches registry-only entries
```

## Deploy (Vercel)

1. Push to GitHub, import the repo in Vercel → deploy as-is (snapshot mode, no env vars needed)
2. Point the `www.pluginworld.ai` domain at it
3. (Recommended) Wire up Postgres:
   ```sh
   export DATABASE_URL=postgres://…   # Supabase / Neon
   npm run db:generate && npm run db:migrate   # create tables (spec §4)
   npm run db:seed                             # load the snapshot
   ```
   Set `DATABASE_URL` in Vercel and redeploy — the site switches to DB mode automatically
4. (Recommended) Add `DATABASE_URL` and `REVALIDATE_SECRET` to the repo's Actions secrets
   and `SITE_URL` to its variables — `.github/workflows/sync.yml` runs the full
   community scan daily at 02:00 UTC.
   Also set Settings → Actions → Workflow permissions to **Read and write** so the
   cron job can commit refreshed snapshots
5. (Optional) GitHub OAuth for plugin claims: create an
   [OAuth App](https://github.com/settings/applications/new)
   (callback `https://www.pluginworld.ai/api/auth/callback`), then set
   `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `AUTH_SECRET`

## Unified quality score (0–100)

| Dimension | Weight | Basis |
|---|---|---|
| Maintenance | 30 | Commit recency decay (full within 30 days, 180-day half-life) |
| Popularity | 25 | Star/download percentile within the ecosystem (cross-ecosystem comparable) |
| Compliance | 20 | Manifest passes the official ecosystem schema |
| Security | 15 | License + install-script static scan + owner verification |
| Docs | 10 | README length, structure, code examples |

Implementation: [`src/lib/scoring.ts`](src/lib/scoring.ts) (pure functions + unit tests);
the three ecosystem validators live in [`src/lib/validators/`](src/lib/validators).

## Public API

```
GET /api/v1/plugins?q=&ecosystem=&category=&sort=score|stars|trending|updated&page=
GET /api/v1/plugins/{ecosystem}/{owner}/{name}?include=readme
GET /api/v1/stats
```

Docs: https://www.pluginworld.ai/docs/api

## Commands

```sh
npm run dev          # development
npm run build        # production build (SSG for all detail pages)
npm test             # vitest unit tests (scoring + validators + search + redaction)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run sync         # indexing pipeline → snapshot
npm run sync:db      # indexing pipeline → snapshot + Postgres upsert
npm run db:generate  # generate drizzle migrations
npm run db:migrate   # run migrations
npm run db:seed      # load snapshot into DB
```

## Compliance & safety (spec §9)

- Indexes **public metadata only** and links back to source repos — no code mirroring
- Every sync runs an install-script static scan (curl|sh, rm -rf, encoded powershell, …)
- Leaked secrets in third-party READMEs are automatically redacted before publishing
- Report channel: report@pluginworld.ai — malicious plugins are delisted immediately
