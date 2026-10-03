#!/usr/bin/env bash
# Installed outside the repository and used as a forced command for a dedicated deploy key.
set -Eeuo pipefail
umask 077
ROOT=/opt/pluginworld
mkdir -p "$ROOT/releases" "$ROOT/state"
exec 9>"$ROOT/state/deploy.lock"
flock -w 1200 9
command_text=${SSH_ORIGINAL_COMMAND:-${1:-}}
if [[ ! "$command_text" =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
  echo 'Only deploy <40-char Git SHA> is allowed' >&2; exit 2
fi
sha=${BASH_REMATCH[1]}
release="$ROOT/releases/$sha"
archive=$(mktemp "$ROOT/state/release.XXXXXX.tar.gz")
old_config="$ROOT/state/previous-pm2.json"
switched=0
write_state() {
  python3 - "$ROOT/state/deployment.json" "$1" "$sha" <<'PY'
import sys,json,datetime,os
p,state,sha=sys.argv[1:]
with open(p+'.tmp','w') as f: json.dump({'state':state,'commit':sha,'updatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()},f)
os.replace(p+'.tmp',p)
PY
}
rollback() {
  code=$?
  trap - ERR
  echo "[deploy] failed for $sha; preserving/restoring previous release" >&2
  if [ "$switched" = 1 ] && [ -f "$old_config" ]; then
    pm2 startOrReload "$old_config" --update-env || true
    pm2 save || true
  fi
  write_state failed
  rm -f "$archive"
  exit "$code"
}
trap rollback ERR
write_state receiving
cat > "$archive"
# Reject traversal and links before extraction; the input is a Git archive.
python3 - "$archive" "$release" <<'PY'
import tarfile,sys,pathlib,os
archive,dest=sys.argv[1:]
with tarfile.open(archive,'r:gz') as t:
 members=t.getmembers()
 if len(members)>20000 or sum(m.size for m in members)>768*1024*1024: raise ValueError('archive exceeds release size limit')
 for m in members:
  p=pathlib.PurePosixPath(m.name)
  if p.is_absolute() or '..' in p.parts or not (m.isfile() or m.isdir()): raise ValueError('unsafe archive member')
 os.makedirs(dest,exist_ok=True)
 t.extractall(dest,members=members)
PY
rm -f "$archive"
write_state building
cd "$release"
npm ci --no-audit --no-fund
npm run typecheck
npm run lint
npm test
npm run build
# Preserve the exact current process configuration for rollback (single app only).
pm2 jlist | node -e 'let t="";process.stdin.on("data",s=>t+=s);process.stdin.on("end",()=>{const p=JSON.parse(t).find(p=>p.name==="pluginworld");if(!p)process.exit(1);const e=p.pm2_env;console.log(JSON.stringify({apps:[{name:"pluginworld",script:e.pm_exec_path,args:e.args,cwd:e.pm_cwd,interpreter:e.exec_interpreter,env:{...(e.env||{})}}]}))})' > "$old_config"
python3 - "$ROOT/state/next-pm2.json" "$release" "$ROOT/state/deployment.json" "$sha" <<'PY'
import json,sys
p,cwd,state,sha=sys.argv[1:]
json.dump({'apps':[{'name':'pluginworld','script':'npm','args':'start -- -H 0.0.0.0 -p 3000','cwd':cwd,'env':{'NODE_ENV':'production','PLUGINWORLD_DEPLOY_STATUS_FILE':state,'PLUGINWORLD_RELEASE_SHA':sha}}]},open(p,'w'))
PY
write_state switching
switched=1
pm2 startOrReload "$ROOT/state/next-pm2.json" --update-env
healthy=0
for n in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/v1/sync-status > "$ROOT/state/health.json" && \
    node -e 'const s=require(process.argv[1]);if(s.deployment?.commit!==process.argv[2] || s.report?.reviewedSkills!==1000)process.exit(1)' "$ROOT/state/health.json" "$sha"; then
    healthy=1; break
  fi
  sleep 1
done
[ "$healthy" = 1 ]
ln -sfn "$release" "$ROOT/current"
printf '%s\n' "$sha" > "$ROOT/state/current-sha"
write_state deployed
pm2 save
trap - ERR
echo "[deploy] deployed $sha"
