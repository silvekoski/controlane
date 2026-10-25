#!/usr/bin/env bash
# Runs on the GPU machine: install, fine-tune, predict. Logs to run.log.
set -euo pipefail
cd "$(dirname "$0")"
python3 -m venv .venv && . .venv/bin/activate
pip install -q -U pip
pip install -q -U laya "transformers>=4.48.0" safetensors huggingface_hub accelerate scipy
python -c "import laya, torch; print('laya', laya.__version__, 'torch', torch.__version__, 'cuda', torch.cuda.is_available())"
python train_laya.py data/train.jsonl out/laya-ft
python predict_laya.py out/laya-ft
echo DONE
