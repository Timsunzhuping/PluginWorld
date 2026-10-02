#!/usr/bin/env bash
# PluginWorld server update: pull latest code + data, rebuild, restart.
# Usage (on the server, from the repo directory):  bash deploy/update.sh
# Recommended cron (daily, after the 02:00 UTC scan):
#   30 2 * * * cd /path/to/PluginWorld && bash deploy/update.sh >> /var/log/pluginworld-deploy.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."

BEFORE=$(git rev-parse HEAD)
git pull --ff-only
AFTER=$(git rev-parse HEAD)

if [ "$BEFORE" = "$AFTER" ] && [ "${FORCE:-0}" != "1" ]; then
  echo "[deploy] already up to date ($AFTER) — nothing to do"
  exit 0
fi

echo "[deploy] $BEFORE → $AFTER"
npm ci
npm run build

# Restart: pm2 if available, else systemd unit named pluginworld
if command -v pm2 >/dev/null 2>&1 && pm2 describe pluginworld >/dev/null 2>&1; then
  pm2 restart pluginworld --update-env
elif systemctl list-units --type=service 2>/dev/null | grep -q pluginworld; then
  sudo systemctl restart pluginworld
else
  echo "[deploy] WARNING: no pm2 process or systemd unit named 'pluginworld' found — restart the app manually"
fi

echo "[deploy] done: $(git log -1 --oneline)"
