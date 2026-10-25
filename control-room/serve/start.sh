#!/usr/bin/env bash
# Runs on the GPU machine: install once, then start the model server in the background.
# Logs to server.log. scripts/verda/serve.sh copies this folder and calls it.
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -d .venv ]; then
  python3 -m venv .venv
  . .venv/bin/activate
  pip install -q -U pip
  pip install -q -U "transformers>=5.15" torch torchvision pillow accelerate laya safetensors huggingface_hub
else
  . .venv/bin/activate
fi
python -c "import transformers, torch; print('transformers', transformers.__version__, 'torch', torch.__version__, 'cuda', torch.cuda.is_available())"
[ -d laya-ft ] || tar xzf laya-ft.tgz
pkill -f "python server.py" || true
nohup python server.py --d1-lora d1-lora.pt --laya laya-ft --port 8800 > server.log 2>&1 &
for i in $(seq 1 120); do
  grep -q READY server.log && { grep -E "loaded|READY|failed" server.log; exit 0; }
  if ! pgrep -f "python server.py" > /dev/null; then tail -30 server.log; exit 1; fi
  sleep 5
done
echo "server did not start in 10 minutes"; tail -30 server.log; exit 1
