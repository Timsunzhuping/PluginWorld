# Production discovery and deployment

## Daily discovery

The `daily-community-scan` workflow runs every day at 02:00 UTC (10:00 Singapore), and can be started manually in GitHub Actions. It reads popular GitHub topic repositories, npm keyword search results, the official MCP Registry and the actual skills.sh all-time top 1000 via public pagination. Glama is optional and requires a separately configured API key; it is reported as unavailable when not configured.

Every candidate passes the existing schema and automated security scanner. Critical findings are quarantined. Skills without a readable document are metadata-only profiles, never content-approved, and installation commands are withheld; when a publisher moves a file, skills.sh’s public rendered copy can be listed with a provenance note and unverified frontmatter, never a fabricated schema pass; publisher schema failures and noncritical warnings remain visible. Neither crawler nor reviewer executes third-party skills. `skills-audit.json` records every top-1000 decision with source, rank, install count, document location, schema errors and findings. Last-known entries outside the current discovery window are retained, with their original sync time. Explicitly blocked entries are removed. Required source failures stop publication rather than replacing the catalog with an empty snapshot.

Discovery is bounded: five GitHub search pages per ecosystem, two npm search pages per keyword, latest-version registry updates since the previous successful snapshot with a 48-hour overlap (100-page safety budget; unavailable pages stop publication) and skills.sh top 1000. It covers mainstream public sources, not every website on the Internet. npm monthly-download backfill is bounded to 20 new packages per run; prior measured counts are retained when the optional download API is rate limited.

The monitor at `/admin/sync` and `/api/v1/sync-status` shows last successful discovery, source candidate counts, decisions, newly indexed entries, stale-data warning and deployed commit. It is read-only public catalog health; privileged manual controls remain in the private GitHub repository's Actions page. Failed runs are visible in Actions; GitHub's workflow notifications follow the account's notification settings.

## Continuous deployment

`deploy` runs for main pushes and after successful daily scans. The workflow-run trigger is essential because commits made with `GITHUB_TOKEN` do not trigger another push workflow. Deployment checks out current main, avoiding the scan workflow's old head SHA.

A dedicated **non-root**, non-sudo `pwdeploy` account owns only `/opt/pluginworld` and its own PM2 processes. Its authorized key must use:

```
restrict,command="/usr/local/bin/pluginworld-deploy-receiver" <dedicated public key>
```

The root-owned receiver is installed from `deploy/receive-release.sh` with mode 755. This account cannot run arbitrary SSH commands, forward ports, open a PTY or modify the root-owned receiver. It receives a Git source archive over stdin, rejects unsafe archive paths/links, serializes releases, installs locked dependencies, typechecks, lints, tests and builds as the non-root account. Release directories are keyed by commit under `/opt/pluginworld/releases`. PM2 switches only after building; a failed health check restores the previous application configuration. `/opt/pluginworld/state/deployment.json` is written atomically. Old releases are retained for recovery.

Secrets in ApollaAI/PluginWorld:

- `DEPLOY_SSH_KEY`: the dedicated restricted key, never the administrator's root key.
- `DEPLOY_HOST`: `pwdeploy@47.237.130.239`.
- `DEPLOY_KNOWN_HOSTS`: verified host public keys; strict verification is mandatory.

One-time setup requires explicit authorization to create the account and persist the deployment credential. Migrate the current website into the account and enable its PM2 system service before enabling CD. Preserve the root-run legacy release until the non-root process is verified. The account has no GitHub read credentials: Actions streams the repository archive, so private repository access is not required on the server.

## Logs and recovery

GitHub Actions retains scan, validation, deployment and public acceptance logs. On the server, use `runuser -u pwdeploy -- pm2 logs pluginworld` as administrator. Current deployment SHA is `/opt/pluginworld/state/current-sha`; the previous process configuration is `/opt/pluginworld/state/previous-pm2.json`. To recover the previous release as that account, run `pm2 startOrReload /opt/pluginworld/state/previous-pm2.json --update-env` followed by `pm2 save`, then verify the API and update the recorded deployment state to reflect the actual restored version. A failed attempt intentionally leaves `state=failed` even when the previous site is restored.

For a manual full registry reconciliation, pass `--registry-full` (1000-page safety budget). Daily jobs use the incremental window to discover changed/new records without re-downloading tens of thousands of unchanged records; inactive registry records are removed when reported by the upstream API. `--resume` can reuse local source caches up to 15 minutes old after a transient failure; scheduled scans never use it.
