"""Run Liquid d1-3B and d1-omni-600M (as released), and d1-3B with the LoRA from train_d1.py
(when out/d1-ft/lora.pt exists), on the test sets.

Same rows as Laya (state + typed questions); the vision rows also carry an image.
Writes predictions/<model>-<set>.json: { case id: { answer, confidence, ms } }.
Usage: python predict_d1.py
"""
import json, os, time

import torch
from PIL import Image
from transformers import AutoModel

from train_d1 import add_lora, merge_lora

LORA = "out/d1-ft/lora.pt"
MODELS = {"d1": ("LiquidAI/d1-3B", torch.bfloat16), "d1_omni": ("LiquidAI/d1-omni-600M", torch.float16),
          "d1_ft": ("LiquidAI/d1-3B", torch.bfloat16)}


def load(name, repo, dtype):
    model = AutoModel.from_pretrained(repo, trust_remote_code=True, dtype=dtype).to("cuda")
    if name == "d1_ft":
        saved = torch.load(LORA)
        lm = model.model.language_model
        for layer_name, lora in add_lora(lm, saved["rank"], saved["alpha"]).items():
            lora.A.data.copy_(saved["weights"][layer_name]["A"])
            lora.B.data.copy_(saved["weights"][layer_name]["B"])
        merge_lora(lm)
    return model.eval()


SETS ={"hand": "data/test-hand.jsonl", "synthetic": "data/test-synthetic.jsonl", "synthetic_ood": "data/test-synthetic_ood.jsonl", "vision": "data/test-vision.jsonl"}


def read_answer(qtype, a):
    if qtype == "noul":
        p = float(a["noul"])
        return ("yes" if p >= 0.5 else "no"), max(p, 1 - p)
    probs = a.get("probabilities") or {a["choice"]: a.get("confidence", 0.5)}
    return a["choice"], float(max(probs.values()))


for name, (repo, dtype) in MODELS.items():
    if name == "d1_ft" and not os.path.exists(LORA):
        continue
    model = load(name, repo, dtype)
    for set_name, path in SETS.items():
        if not os.path.exists(path):
            continue
        rows = [json.loads(l) for l in open(path) if l.strip()]
        out = {}
        for i, r in enumerate(rows):
            qid = r["question_id"]
            images = [Image.open(r["image"]).convert("RGB")] if r.get("image") else None
            t0 = time.perf_counter()
            res = model.system_one(r["state"], r["questions"], images=images)
            torch.cuda.synchronize()
            ms = (time.perf_counter() - t0) * 1000
            answer, conf = read_answer(r["questions"][qid]["type"], res["answers"][qid])
            if i > 0:  # the first call warms up and is not timed fairly
                out[r["id"]] = {"answer": answer, "confidence": round(conf, 4), "ms": round(ms, 2)}
            else:
                out[r["id"]] = {"answer": answer, "confidence": round(conf, 4), "ms": None}
        os.makedirs("predictions", exist_ok=True)
        json.dump(out, open(f"predictions/{name}-{set_name}.json", "w"))
        print(f"{name} {set_name}: {len(out)} predictions", flush=True)
    del model
    torch.cuda.empty_cache()
print("DONE", flush=True)
