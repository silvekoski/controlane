"""Fine-tune Laya on the synthetic train split, on one GPU.

Adapted from the official 2xT4 notebook (laya_finetune_typed_decisions_2xT4_kaggle.ipynb):
same primitives from laya.train / laya.common / laya.calibrate, same RLCD objective,
sigma schedule, calibration holdout and temperature fit. Changes: one GPU instead of
DDP, bf16 instead of fp16, and gradient accumulation 8 to keep the effective batch at 64.

Usage: python train_laya.py data/train.jsonl out/laya-ft
"""
import json, math, os, random, sys, time

import torch
from huggingface_hub import snapshot_download
from safetensors.torch import load_file
from transformers import AutoTokenizer

from laya.agent import _fix_tokenizer_config
from laya.calibrate import fit_temperature_map
from laya.common import build_model, collate_items
from laya.train import calibration_records, encode_item, items_from_rows, rlcd_loss, save_checkpoint, sigma_at, split_calibration

EPOCHS = int(os.environ.get("EPOCHS", 10))
MICRO_BATCH = 8
GRAD_ACCUM = 8
GROUP_SIZE = 4
LR_ENCODER = 2.5e-5
LR_HEAD = 1.0e-4
SIGMA_START, SIGMA_END = 0.4, 0.1


def main():
    train_file, output_dir = sys.argv[1], sys.argv[2]
    device = torch.device("cuda")
    model_dir = snapshot_download("convaiinnovations/laya")
    _fix_tokenizer_config(model_dir)
    with open(os.path.join(model_dir, "rl_agent_config.json")) as f:
        cfg = json.load(f)
    cfg.update(gradient_checkpointing=True, max_tokens_per_batch=4096, max_len=1024, head_max_len=256)
    max_len, head_max_len = cfg["max_len"], cfg["head_max_len"]

    tok = AutoTokenizer.from_pretrained(os.path.join(model_dir, "tokenizer"))
    rows = [json.loads(l) for l in open(train_file) if l.strip()]
    items, skipped = items_from_rows(tok, rows, max_len, head_max_len)
    print(f"{len(rows)} rows -> {len(items)} training items ({skipped} skipped)", flush=True)

    model = build_model(cfg, encoder_dir=os.path.join(model_dir, "encoder"))
    model.load_state_dict(load_file(os.path.join(model_dir, "model.safetensors")), strict=True)
    model.encoder.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
    model.head_checkpointing = True
    model.to(device).train()

    train_items, calib_items = split_calibration(items, calib_max=400, calib_frac=0.1, seed=20260922)
    enc = [p for n, p in model.named_parameters() if "encoder." in n]
    head = [p for n, p in model.named_parameters() if "encoder." not in n]
    opt = torch.optim.AdamW([{"params": enc, "lr": LR_ENCODER}, {"params": head, "lr": LR_HEAD}], weight_decay=0.01)
    total_updates = max(1, (len(train_items) // (MICRO_BATCH * GRAD_ACCUM)) * EPOCHS)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=total_updates, eta_min=1e-6)
    print(f"Training on {len(train_items)} items, {len(calib_items)} held out for calibration, {EPOCHS} epochs", flush=True)

    t0 = time.time()
    for epoch in range(EPOCHS):
        random.seed(42 + epoch)
        random.shuffle(train_items)
        sigma = sigma_at(epoch, EPOCHS, SIGMA_START, SIGMA_END)
        total, n, step = 0.0, 0, 0
        opt.zero_grad(set_to_none=True)
        for b in range(0, len(train_items), MICRO_BATCH):
            chunk = train_items[b:b + MICRO_BATCH]
            batch = collate_items([[encode_item(tok, it, max_len, head_max_len) for it in chunk]], tok.pad_token_id)
            with torch.autocast("cuda", dtype=torch.bfloat16):
                logits, _act = model(batch["input_ids"].to(device), batch["attention_mask"].to(device), batch["marker_pos"].to(device),
                                     batch["marker_mask"].to(device), batch["qtype"].to(device))
            loss = rlcd_loss(logits.float(), batch["target"].to(device), batch["marker_mask"].to(device), batch["qtype"].to(device),
                             sigma, samples=GROUP_SIZE, w_sph=0.75, w_rps=1.0)
            (loss / GRAD_ACCUM).backward()
            step += 1
            if step % GRAD_ACCUM == 0 or b + MICRO_BATCH >= len(train_items):
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                opt.step(); sched.step(); opt.zero_grad(set_to_none=True)
            total += loss.item(); n += 1
            if n % 50 == 0:
                print(f"  epoch {epoch + 1}/{EPOCHS} step {n} loss {loss.item():.4f}", flush=True)
        print(f"=== epoch {epoch + 1}/{EPOCHS} done in {time.time() - t0:.0f}s, avg loss {total / max(1, n):.4f}", flush=True)

    model.eval()
    out_cfg = dict(cfg, fine_tuned=True, model_name="laya-bahn-on-the-road")
    try:
        fitted = fit_temperature_map(calibration_records(model, tok, calib_items, device, max_len, head_max_len, batch_size=16))
        out_cfg["temperature"] = fitted["temperature"]
        out_cfg.pop("temperature_by_options", None)
        if fitted.get("temperature_by_options"):
            out_cfg["temperature_by_options"] = fitted["temperature_by_options"]
        print("Calibration temperatures:", [round(t, 3) for t in fitted["temperature"]], flush=True)
    except Exception as e:  # keep the trained weights even if calibration fails
        print("Calibration failed, saving without new temperatures:", e, flush=True)
    save_checkpoint(model, tok, out_cfg, output_dir)
    print(f"Saved to {output_dir} after {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
