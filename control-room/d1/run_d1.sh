#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python3 -m venv .venv && . .venv/bin/activate
pip install -q -U pip
pip install -q -U "transformers>=5.15" torch torchvision pillow soundfile accelerate
python -c "import transformers, torch; print('transformers', transformers.__version__, 'torch', torch.__version__, 'cuda', torch.cuda.is_available())"
if [ -f data/train.jsonl ]; then python train_d1.py data/train.jsonl out/d1-ft || echo "TRAIN FAILED"; fi
python predict_d1.py
