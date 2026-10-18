#!/usr/bin/env bash
# One-time production bootstrap for PluginWorld continuous deployment.
# Run AS ROOT on the production server. Idempotent — safe to re-run.
#
#   curl -fsSLO https://raw.githubusercontent.com/ApollaAI/PluginWorld/main/deploy/setup-server.sh
#   less setup-server.sh        # review before running
#   bash setup-server.sh
#
# What it does (matches deploy/AUTOMATION.md):
#   1. Creates the dedicated non-root, non-sudo `pwdeploy` account
#   2. Clones the public repo and installs the root-owned SSH forced-command
#      receiver at /usr/local/bin/pluginworld-deploy-receiver
#   3. Generates a dedicated deploy keypair; authorized_keys gets
#      restrict,command="<receiver>" so the key can ONLY trigger deployments
#   4. Builds a bootstrap release and migrates the site from the legacy
#      root pm2 process to pwdeploy's pm2 (legacy process is stopped,
#      not deleted — root can restart it as a fallback)
#   5. Prints the exact values for the three GitHub Actions secrets
set -Eeuo pipefail

REPO_URL=https://github.com/ApollaAI/PluginWorld.git
ROOT=/opt/pluginworld
DEPLOY_USER=pwdeploy
RECEIVER=/usr/local/bin/pluginworld-deploy-receiver
BOOTSTRAP="$ROOT/releases/bootstrap"

[ "$(id -u)" = 0 ] || { echo "Run as root." >&2; exit 1; }
for bin in git node npm python3 curl flock; do
  command -v "$bin" >/dev/null || { echo "Missing dependency: $bin" >&2; exit 1; }
done
command -v pm2 >/dev/null || npm install -g pm2

echo "== 1/5 dedicated account =="
id "$DEPLOY_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$DEPLOY_USER"
mkdir -p "$ROOT/releases" "$ROOT/state"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$ROOT"

echo "== 2/5 clone + root-owned receiver =="
if [ -d "$BOOTSTRAP/.git" ]; then
  runuser -u "$DEPLOY_USER" -- git -C "$BOOTSTRAP" pull --ff-only
else
  runuser -u "$DEPLOY_USER" -- git clone --depth 1 "$REPO_URL" "$BOOTSTRAP"
fi
install -m 755 -o root -g root "$BOOTSTRAP/deploy/receive-release.sh" "$RECEIVER"

echo "== 3/5 restricted deploy key =="
KEY_TMP=$(mktemp -d)
ssh-keygen -t ed25519 -N "" -C "pluginworld-deploy" -f "$KEY_TMP/key" -q
SSH_DIR="/home/$DEPLOY_USER/.ssh"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$SSH_DIR"
touch "$SSH_DIR/authorized_keys"
# Replace any previous pluginworld-deploy entry; keep unrelated keys.
grep -v "pluginworld-deploy" "$SSH_DIR/authorized_keys" > "$SSH_DIR/authorized_keys.tmp" || true
printf 'restrict,command="%s" %s\n' "$RECEIVER" "$(cat "$KEY_TMP/key.pub")" >> "$SSH_DIR/authorized_keys.tmp"
mv "$SSH_DIR/authorized_keys.tmp" "$SSH_DIR/authorized_keys"
chmod 600 "$SSH_DIR/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "$SSH_DIR/authorized_keys"

echo "== 4/5 bootstrap release under pwdeploy pm2 =="
if ! runuser -u "$DEPLOY_USER" -- pm2 describe pluginworld >/dev/null 2>&1; then
  echo "   building bootstrap release (one-time on-server build)…"
  runuser -u "$DEPLOY_USER" -- bash -c "cd '$BOOTSTRAP' && npm ci --no-audit --no-fund && npm run build"
  # Free port 3000: stop (don't delete) the legacy root-run process.
  if pm2 describe pluginworld >/dev/null 2>&1; then
    pm2 stop pluginworld || true
    pm2 save || true
    echo "   legacy root pm2 process stopped (kept for manual fallback)"
  fi
  runuser -u "$DEPLOY_USER" -- bash -c \
    "cd '$BOOTSTRAP' && pm2 start npm --name pluginworld -- start -- -H 0.0.0.0 -p 3000 && pm2 save"
  env PATH="$PATH" pm2 startup systemd -u "$DEPLOY_USER" --hp "/home/$DEPLOY_USER" >/dev/null
  runuser -u "$DEPLOY_USER" -- pm2 save
else
  echo "   pwdeploy pm2 app already exists — skipping migration"
fi

echo "   waiting for health…"
ok=0
for _ in $(seq 1 60); do
  curl -fsS http://127.0.0.1:3000/api/v1/stats >/dev/null 2>&1 && { ok=1; break; }
  sleep 2
done
[ "$ok" = 1 ] || { echo "Site did not become healthy on :3000 — check 'runuser -u $DEPLOY_USER -- pm2 logs pluginworld'" >&2; exit 1; }

echo "== 5/5 GitHub secrets — paste these into ApollaAI/PluginWorld → Settings → Secrets → Actions =="
HOST_IP=$(curl -fsS -4 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
echo
echo "────────────────────── DEPLOY_HOST ──────────────────────"
echo "$DEPLOY_USER@$HOST_IP"
echo
echo "─────────────────── DEPLOY_KNOWN_HOSTS ──────────────────"
for f in /etc/ssh/ssh_host_*_key.pub; do
  awk -v ip="$HOST_IP" '{print ip" "$1" "$2}' "$f"
done
echo
echo "───────────────────── DEPLOY_SSH_KEY ────────────────────"
cat "$KEY_TMP/key"
echo "──────────────────────────────────────────────────────────"
echo
echo "IMPORTANT: the private key above is shown ONCE and now erased from disk."
echo "Paste it into the DEPLOY_SSH_KEY secret immediately. Re-run this script"
echo "any time to rotate the key."
shred -u "$KEY_TMP/key" "$KEY_TMP/key.pub" 2>/dev/null || rm -f "$KEY_TMP/key" "$KEY_TMP/key.pub"
rmdir "$KEY_TMP"
echo
echo "Done. After saving the 3 secrets, run the 'deploy' workflow in GitHub"
echo "Actions (or push any commit) — it builds in CI, ships the release and"
echo "health-checks with automatic rollback."
