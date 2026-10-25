#!/usr/bin/env bash
# Run a GPU job on Verda and bring the results back. Always deletes the machine,
# its disk and the temporary SSH key on exit, even when a step fails.
#
# Usage (from control-room/):
#   scripts/verda/run.sh laya   # fine-tune Laya + predict all test sets -> laya/predictions/
#   scripts/verda/run.sh d1     # LoRA fine-tune d1-3B, then run it and d1-3B / d1-omni-600M as released -> d1/predictions/
#
# Needs VERDA_CLIENT_ID and VERDA_CLIENT_SECRET in .env, and the data exported first:
#   npm run export-laya   (laya)   and   npx tsx scripts/export-d1.ts   (d1)
set -uo pipefail
JOB=${1:?usage: scripts/verda/run.sh laya|d1}
REPO=$(cd "$(dirname "$0")/../.." && pwd)
WORK=${WORK:-$REPO/.data/verda}
mkdir -p "$WORK"
set -a; . "$REPO/.env"; set +a
API=https://api.verda.com/v1
TYPE=${GPU_TYPE:-1RTX6000ADA.10V}
IMAGE=24.04.cuda12.9

tok() {
  curl -s -X POST $API/oauth2/token -H "Content-Type: application/json" \
    -d "{\"grant_type\":\"client_credentials\",\"client_id\":\"$VERDA_CLIENT_ID\",\"client_secret\":\"$VERDA_CLIENT_SECRET\"}" |
    python3 -c "import json,sys;print(json.load(sys.stdin)['access_token'])"
}

case $JOB in
  laya) FILES="laya/train_laya.py laya/predict_laya.py laya/run_on_verda.sh laya/data"; RUN="cd laya && ./run_on_verda.sh"; OUT=laya ;;
  d1) FILES="d1/train_d1.py d1/predict_d1.py d1/run_d1.sh d1/data"; RUN="cd d1 && ./run_d1.sh"; OUT=d1 ;;
  *) echo "unknown job $JOB"; exit 2 ;;
esac

# A fresh SSH key for this run only.
KEY=$WORK/key-$JOB
rm -f "$KEY" "$KEY.pub"
ssh-keygen -q -t ed25519 -N "" -C "bahn-$JOB" -f "$KEY"
KID=$(curl -s -X POST $API/sshkeys -H "Authorization: Bearer $(tok)" -H "Content-Type: application/json" -d "{\"name\":\"bahn-$JOB-$(date +%s)\",\"key\":\"$(cat "$KEY.pub")\"}")
ID=""
cleanup() {
  if [ -n "$ID" ]; then
    T=$(tok)
    VOL=$(curl -s $API/instances/$ID -H "Authorization: Bearer $T" | python3 -c "import json,sys;d=json.load(sys.stdin);print(json.dumps([d['os_volume_id']] if d.get('os_volume_id') else []))")
    curl -s -o /dev/null -w "delete instance: %{http_code}\n" -X PUT $API/instances -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
      -d "{\"action\":\"delete\",\"id\":\"$ID\",\"volume_ids\":$VOL,\"delete_permanently\":true}"
  fi
  curl -s -o /dev/null -w "delete ssh key: %{http_code}\n" -X DELETE $API/sshkeys/$KID -H "Authorization: Bearer $(tok)"
}
trap cleanup EXIT

# The availability list is not always right, so try each location.
for LOC in FIN-02 FIN-03 FIN-01; do
  R=$(curl -s -X POST $API/instances -H "Authorization: Bearer $(tok)" -H "Content-Type: application/json" \
    -d "{\"instance_type\":\"$TYPE\",\"image\":\"$IMAGE\",\"ssh_key_ids\":[\"$KID\"],\"location_code\":\"$LOC\",\"hostname\":\"bahn-$JOB\",\"description\":\"Bahn $JOB run; deleted after the run\",\"os_volume\":{\"name\":\"bahn-$JOB-os\",\"size\":100},\"is_spot\":false}")
  echo "$LOC: $R"
  if [[ "$R" =~ ^[0-9a-f-]{36}$ ]]; then ID=$R; break; fi
done
[ -z "$ID" ] && { echo "No GPU available"; exit 1; }

IP=""
for i in $(seq 1 60); do
  R=$(curl -s $API/instances/$ID -H "Authorization: Bearer $(tok)" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('status'),d.get('ip'))")
  case "$R" in running*) IP=$(echo "$R" | awk '{print $2}'); break ;; esac
  sleep 10
done
[ -z "$IP" ] && { echo "Machine did not start"; exit 1; }
echo "running at $IP"
CFG=$WORK/ssh-$JOB
cat > "$CFG" <<EOF
Host verda
  HostName $IP
  User root
  IdentityFile $KEY
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
  UserKnownHostsFile $WORK/known_hosts-$JOB
  ConnectTimeout 10
  ServerAliveInterval 30
  ServerAliveCountMax 4
EOF
for i in $(seq 1 30); do ssh -F "$CFG" verda true 2>/dev/null && break; sleep 10; done

cd "$REPO" && COPYFILE_DISABLE=1 tar czf "$WORK/$JOB.tgz" $FILES
scp -F "$CFG" -q "$WORK/$JOB.tgz" verda:/root/ || exit 1
# A fresh machine may still hold the package lock; wait for it, then check venv works.
ssh -F "$CFG" verda "cd /root && tar xzf $JOB.tgz 2>/dev/null; apt-get -o DPkg::Lock::Timeout=600 -qq update >/dev/null 2>&1; \
  apt-get -o DPkg::Lock::Timeout=600 -qq install -y python3-venv python3-pip >/dev/null 2>&1; \
  python3 -m venv /tmp/venvcheck || { echo 'venv broken'; exit 1; }; $RUN > run.log 2>&1; tail -6 run.log" || echo "REMOTE STEP FAILED"

mkdir -p "$REPO/$OUT/predictions"
scp -F "$CFG" -q "verda:/root/$OUT/predictions/*.json" "$REPO/$OUT/predictions/"
scp -F "$CFG" -q "verda:/root/$OUT/run.log" "$REPO/$OUT/run.log"
if [ "$JOB" = laya ]; then
  ssh -F "$CFG" verda "cd /root/laya/out && tar czf /root/laya-ft.tgz laya-ft" && scp -F "$CFG" -q verda:/root/laya-ft.tgz "$WORK/laya-ft.tgz" && echo "checkpoint: $WORK/laya-ft.tgz"
fi
if [ "$JOB" = d1 ]; then
  scp -F "$CFG" -q verda:/root/d1/out/d1-ft/lora.pt "$WORK/d1-lora.pt" && echo "adapters: $WORK/d1-lora.pt"
fi
echo RUN_COMPLETE
