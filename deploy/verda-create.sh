#!/usr/bin/env bash
# One-time: create the Verda CPU VM, copy the local .env files and control-room state to it,
# and store its address and a deploy key as GitHub secrets so pushes to main deploy.
# Usage (from the repo root): deploy/verda-create.sh owner/repo
# Needs VERDA_CLIENT_ID and VERDA_CLIENT_SECRET in control-room/.env.
set -euo pipefail
REPO=${1:?usage: deploy/verda-create.sh owner/repo}
WORK=control-room/.data/verda
mkdir -p "$WORK"
set -a; . control-room/.env; set +a
API=https://api.verda.com/v1
tok() {
  curl -s -X POST $API/oauth2/token -H "Content-Type: application/json" \
    -d "{\"grant_type\":\"client_credentials\",\"client_id\":\"$VERDA_CLIENT_ID\",\"client_secret\":\"$VERDA_CLIENT_SECRET\"}" |
    python3 -c "import json,sys;print(json.load(sys.stdin)['access_token'])"
}

KEY=$WORK/key-web
[ -f "$KEY" ] || ssh-keygen -q -t ed25519 -N "" -C bahn-web -f "$KEY"
KID=$(curl -s -X POST $API/sshkeys -H "Authorization: Bearer $(tok)" -H "Content-Type: application/json" \
  -d "{\"name\":\"bahn-web-$(date +%s)\",\"key\":\"$(cat "$KEY.pub")\"}")

ID=""
for LOC in FIN-01 FIN-02 FIN-03; do
  R=$(curl -s -X POST $API/instances -H "Authorization: Bearer $(tok)" -H "Content-Type: application/json" \
    -d "{\"instance_type\":\"CPU.4V.16G\",\"image\":\"24.04.cuda13.4.docker\",\"ssh_key_ids\":[\"$KID\"],\"location_code\":\"$LOC\",\"hostname\":\"bahn-web\",\"description\":\"Bahn control room web app, deployed by GitHub Actions ($REPO)\",\"os_volume\":{\"name\":\"bahn-web-os\",\"size\":50},\"is_spot\":false}")
  echo "$LOC: $R"
  if [[ "$R" =~ ^[0-9a-f-]{36}$ ]]; then ID=$R; break; fi
done
[ -n "$ID" ] || { echo "No CPU instance available"; exit 1; }
echo "$ID" > "$WORK/web-id"

IP=""
for i in $(seq 1 60); do
  R=$(curl -s $API/instances/$ID -H "Authorization: Bearer $(tok)" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('status'),d.get('ip'))")
  case "$R" in running*) IP=${R#running }; break ;; esac
  sleep 10
done
[ -n "$IP" ] || { echo "Instance did not start"; exit 1; }
echo "running at $IP"

SSH="ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=$WORK/known_hosts-web root@$IP"
for i in $(seq 1 30); do $SSH true 2>/dev/null && break; sleep 10; done
$SSH "while pgrep -x apt-get >/dev/null; do sleep 5; done; apt-get -qq update &&apt-get -o DPkg::Lock::Timeout=600 -qq install -y rsync >/dev/null; mkdir -p /opt/app/starter /opt/app/control-room/.data"
SCP="scp -i $KEY -o IdentitiesOnly=yes -o UserKnownHostsFile=$WORK/known_hosts-web"
$SCP starter/.env root@$IP:/opt/app/starter/.env
$SCP control-room/.env root@$IP:/opt/app/control-room/.env
$SCP control-room/.data/state.json root@$IP:/opt/app/control-room/.data/state.json

gh secret set VERDA_HOST -R "$REPO" -b "$IP"
gh secret set VERDA_SSH_KEY -R "$REPO" < "$KEY"
gh secret set VERDA_KNOWN_HOSTS -R "$REPO" < "$WORK/known_hosts-web"
echo "Ready. Push to main, then open http://$IP"
