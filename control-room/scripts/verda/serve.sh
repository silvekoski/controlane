#!/usr/bin/env bash
# The model server on a Verda GPU: d1-3B fine-tuned (text and photos) and Laya v6 (text).
# Unlike run.sh, the machine stays on, and it costs money until you run "down".
#
# Usage (from control-room/):
#   scripts/verda/serve.sh up       # start the cheapest free GPU, install, start the server, open the tunnel
#   scripts/verda/serve.sh status   # machine, price, hours on, and the server's health
#   scripts/verda/serve.sh tunnel   # open the SSH tunnel again (for example after the Mac slept)
#   scripts/verda/serve.sh down     # delete the machine, its disk and its SSH key
#
# The server listens on 127.0.0.1 of the GPU machine. The app reaches it at
# http://127.0.0.1:8800 through the SSH tunnel: set MODEL_SERVER_URL=http://127.0.0.1:8800 in .env.
# Needs VERDA_CLIENT_ID and VERDA_CLIENT_SECRET in .env, and the checkpoints in .data/checkpoints/.
set -uo pipefail
CMD=${1:?usage: scripts/verda/serve.sh up|status|tunnel|down}
REPO=$(cd "$(dirname "$0")/../.." && pwd)
WORK=$REPO/.data/verda
STATE=$WORK/serve.json
KEY=$WORK/key-serve
CFG=$WORK/ssh-serve
PORT=8800
D1_LORA=${D1_LORA:-$REPO/.data/checkpoints/d1-lora-v1.pt}
LAYA_CKPT=${LAYA_CKPT:-$REPO/.data/checkpoints/laya-ft-v6.tgz}
mkdir -p "$WORK"
set -a; . "$REPO/.env"; set +a
API=https://api.verda.com/v1
# Cheapest first. Each type with an OS image it accepts. The V100 is cheaper, but CUDA 13 and the
# current torch builds do not support it, and it has no bf16.
CANDIDATES=${GPU_TYPES:-"1A6000.10V:26.04.cuda12.9 1RTX6000ADA.10V:24.04.cuda12.9 1A100.40S.22V:24.04.cuda12.9 1L40S.20V:24.04.cuda12.9 1A100.22V:24.04.cuda12.9"}

tok() {
  curl -s -X POST $API/oauth2/token -H "Content-Type: application/json" \
    -d "{\"grant_type\":\"client_credentials\",\"client_id\":\"$VERDA_CLIENT_ID\",\"client_secret\":\"$VERDA_CLIENT_SECRET\"}" |
    python3 -c "import json,sys;print(json.load(sys.stdin)['access_token'])"
}
field() { python3 -c "import json,sys;print(json.load(open('$STATE')).get('$1',''))" 2>/dev/null; }

tunnel() {
  pkill -f "ssh -F $CFG .*-L 127.0.0.1:$PORT" 2>/dev/null
  ssh -F "$CFG" -f -N -o ExitOnForwardFailure=yes -L 127.0.0.1:$PORT:127.0.0.1:$PORT verda &&
    echo "tunnel: http://127.0.0.1:$PORT"
}

delete_all() {
  local id kid T vol
  id=$(field id); kid=$(field ssh_key_id); T=$(tok)
  pkill -f "ssh -F $CFG .*-L 127.0.0.1:$PORT" 2>/dev/null
  if [ -n "$id" ]; then
    vol=$(curl -s $API/instances/$id -H "Authorization: Bearer $T" | python3 -c "import json,sys;d=json.load(sys.stdin);print(json.dumps([d['os_volume_id']] if d.get('os_volume_id') else []))")
    curl -s -o /dev/null -w "delete instance: %{http_code}\n" -X PUT $API/instances -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
      -d "{\"action\":\"delete\",\"id\":\"$id\",\"volume_ids\":$vol,\"delete_permanently\":true}"
  fi
  [ -n "$kid" ] && curl -s -o /dev/null -w "delete ssh key: %{http_code}\n" -X DELETE $API/sshkeys/$kid -H "Authorization: Bearer $T"
  rm -f "$STATE"
}

case $CMD in
  status)
    [ -f "$STATE" ] || { echo "No model server. Start one with: scripts/verda/serve.sh up"; exit 0; }
    python3 - "$STATE" <<'EOF'
import json, sys, time
s = json.load(open(sys.argv[1]))
h = (time.time() - s["started"]) / 3600
print(f"{s['type']} in {s['location']} at {s['ip']}, ${s['price']}/h, on for {h:.1f} h (about ${h * s['price']:.2f})")
EOF
    curl -s -m 5 http://127.0.0.1:$PORT/health && echo || echo "No answer on 127.0.0.1:$PORT. Open the tunnel: scripts/verda/serve.sh tunnel"
    ;;
  tunnel)
    [ -f "$STATE" ] || { echo "No model server"; exit 1; }
    tunnel
    ;;
  down)
    [ -f "$STATE" ] || { echo "No model server"; exit 0; }
    delete_all
    ;;
  up)
    [ -f "$STATE" ] && { echo "A model server is already on. See: scripts/verda/serve.sh status"; exit 1; }
    for f in "$D1_LORA" "$LAYA_CKPT"; do [ -f "$f" ] || { echo "Missing $f"; exit 1; }; done
    rm -f "$KEY" "$KEY.pub"
    ssh-keygen -q -t ed25519 -N "" -C "bahn-serve" -f "$KEY"
    KID=$(curl -s -X POST $API/sshkeys -H "Authorization: Bearer $(tok)" -H "Content-Type: application/json" -d "{\"name\":\"bahn-serve-$(date +%s)\",\"key\":\"$(cat "$KEY.pub")\"}")
    echo "{\"ssh_key_id\":\"$KID\"}" > "$STATE"
    # Any failure from here deletes what was made.
    trap 'echo "Start failed. Deleting the machine."; delete_all; exit 1' ERR
    set -E
    ID=""
    for C in $CANDIDATES; do
      TYPE=${C%%:*}; IMAGE=${C#*:}
      for LOC in FIN-02 FIN-03 FIN-01; do
        R=$(curl -s -X POST $API/instances -H "Authorization: Bearer $(tok)" -H "Content-Type: application/json" \
          -d "{\"instance_type\":\"$TYPE\",\"image\":\"$IMAGE\",\"ssh_key_ids\":[\"$KID\"],\"location_code\":\"$LOC\",\"hostname\":\"bahn-models\",\"description\":\"Bahn model server; stop with scripts/verda/serve.sh down\",\"os_volume\":{\"name\":\"bahn-models-os\",\"size\":100},\"is_spot\":false}")
        if [[ "$R" =~ ^[0-9a-f-]{36}$ ]]; then ID=$R; break 2; fi
        echo "$TYPE $LOC: $(echo "$R" | cut -c1-120)"
      done
    done
    [ -z "$ID" ] && { echo "No GPU available"; false; }
    PRICE=$(curl -s $API/instance-types -H "Authorization: Bearer $(tok)" | python3 -c "import json,sys;print(next(x['price_per_hour'] for x in json.load(sys.stdin) if x['instance_type']=='$TYPE'))")
    echo "started $TYPE in $LOC ($ID), \$$PRICE/h"
    python3 -c "import json,time;json.dump({'id':'$ID','ssh_key_id':'$KID','type':'$TYPE','location':'$LOC','price':float('$PRICE'),'ip':'','started':time.time()},open('$STATE','w'))"
    IP=""
    for i in $(seq 1 60); do
      R=$(curl -s $API/instances/$ID -H "Authorization: Bearer $(tok)" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('status'),d.get('ip'))")
      case "$R" in running*) IP=$(echo "$R" | awk '{print $2}'); break ;; esac
      sleep 10
    done
    [ -z "$IP" ] && { echo "Machine did not start"; false; }
    python3 -c "import json;s=json.load(open('$STATE'));s['ip']='$IP';json.dump(s,open('$STATE','w'))"
    cat > "$CFG" <<EOF
Host verda
  HostName $IP
  User root
  IdentityFile $KEY
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
  UserKnownHostsFile $WORK/known_hosts-serve
  ConnectTimeout 10
  ServerAliveInterval 30
  ServerAliveCountMax 4
EOF
    for i in $(seq 1 30); do ssh -F "$CFG" verda true 2>/dev/null && break; sleep 10; done
    echo "copying the server and the checkpoints"
    ssh -F "$CFG" verda "mkdir -p /root/serve"
    scp -F "$CFG" -q "$REPO/serve/server.py" "$REPO/serve/start.sh" "$REPO/d1/train_d1.py" verda:/root/serve/
    scp -F "$CFG" -q "$D1_LORA" verda:/root/serve/d1-lora.pt
    scp -F "$CFG" -q "$LAYA_CKPT" verda:/root/serve/laya-ft.tgz
    echo "installing and loading the models (about 10 minutes)"
    ssh -F "$CFG" verda "apt-get -o DPkg::Lock::Timeout=600 -qq update >/dev/null 2>&1; \
      apt-get -o DPkg::Lock::Timeout=600 -qq install -y python3-venv python3-pip >/dev/null 2>&1; \
      chmod +x /root/serve/start.sh && /root/serve/start.sh"
    trap - ERR
    tunnel
    curl -s -m 10 http://127.0.0.1:$PORT/health && echo
    echo "Model server is on. It costs \$$PRICE per hour until: scripts/verda/serve.sh down"
    ;;
  *) echo "usage: scripts/verda/serve.sh up|status|tunnel|down"; exit 2 ;;
esac
