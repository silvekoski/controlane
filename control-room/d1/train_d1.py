"""Fine-tune Liquid d1-3B with LoRA on the same train rows as Laya, on one GPU.

Liquid ships no training recipe. A d1 decision is one forward pass: the prompt is rendered by the
model's own `prompt.render`, and the answer is a softmax over the option tokens' log-probabilities at
the last position (`prompt.readout`). Training uses that exact readout: soft cross-entropy between the
option distribution and the gold probabilities. LoRA adapters sit on every linear layer of the
language model (attention, short convolution, MLP); the vision tower and projector stay frozen.

Writes <out>/lora.pt (the adapter weights and their settings). predict_d1.py merges them.
Usage: python train_d1.py data/train.jsonl out/d1-ft
"""
import importlib, json, math, os, random, sys, time

import torch
import torch.nn as nn
from transformers import AutoModel

REPO = "LiquidAI/d1-3B"
EPOCHS = int(os.environ.get("EPOCHS", 3))
RANK, ALPHA = 16, 32
TARGETS = ("q_proj", "k_proj", "v_proj", "out_proj", "in_proj", "w1", "w2", "w3")
MICRO_BATCH = 8
GRAD_ACCUM = 4
LR = 2e-4
HOLDOUT = 300


class LoRALinear(nn.Module):
    """`base(x) + scale * B(A(x))`, the base frozen, A and B in fp32."""

    def __init__(self, base: nn.Linear, rank: int, alpha: int):
        super().__init__()
        self.base = base
        self.scale = alpha / rank
        self.A = nn.Parameter(torch.empty(rank, base.in_features, device=base.weight.device))
        self.B = nn.Parameter(torch.zeros(base.out_features, rank, device=base.weight.device))
        nn.init.kaiming_uniform_(self.A, a=math.sqrt(5))

    def forward(self, x):
        return self.base(x) + ((x.float() @ self.A.T) @ self.B.T * self.scale).to(x.dtype)

    def merged(self) -> nn.Linear:
        self.base.weight.data += (self.B @ self.A * self.scale).to(self.base.weight.dtype)
        return self.base


def add_lora(lm: nn.Module, rank: int = RANK, alpha: int = ALPHA) -> dict:
    """Wrap every target linear in `lm`; returns {qualified name: LoRALinear}."""
    wrapped = {}
    for name, module in list(lm.named_modules()):
        for child_name, child in list(module.named_children()):
            if isinstance(child, nn.Linear) and child_name in TARGETS:
                lora = LoRALinear(child, rank, alpha)
                setattr(module, child_name, lora)
                wrapped[f"{name}.{child_name}" if name else child_name] = lora
    return wrapped


def merge_lora(lm: nn.Module) -> None:
    for module in list(lm.modules()):
        for child_name, child in list(module.named_children()):
            if isinstance(child, LoRALinear):
                setattr(module, child_name, child.merged())


def prompt_module(model):
    """The model's own `prompt.py`, loaded with its remote code."""
    return importlib.import_module(type(model).__module__.rsplit(".", 1)[0] + ".prompt")


def encode(engine, P, row):
    """Token ids of the rendered prompt, the option token groups, and the gold distribution."""
    qid = row["question_id"]
    q = P.as_question(row["questions"][qid])
    ids = engine.tokenizer.encode(engine.render(row["state"], q), add_special_tokens=False)
    groups = P.readout_ids(engine.tokenizer, q)
    probs = row["gold"][qid]["probabilities"]
    gold = [probs["true"], probs["false"]] if isinstance(q, P.Noul) else [probs[k] for k in q.criteria]
    total = sum(gold)
    return ids, groups, [g / total for g in gold]


def option_logprobs(logits, groups):
    """Log-softmax over the options, each option scoring its best token form, as `prompt.readout`."""
    logz = torch.log_softmax(logits.float(), dim=-1)
    scores = torch.stack([logz[g].max() for g in groups])
    return torch.log_softmax(scores, dim=-1)


def forward_last(model, batch_ids, device, pad_id):
    """Hidden state at each row's last token, rows right-padded (the causal stack never lets a pad reach
    a real token), then the LM head."""
    longest = max(map(len, batch_ids))
    ids = torch.full((len(batch_ids), longest), pad_id, dtype=torch.long, device=device)
    for i, r in enumerate(batch_ids):
        ids[i, : len(r)] = torch.tensor(r, device=device)
    h = model.model.language_model(input_ids=ids).last_hidden_state
    last = torch.tensor([len(r) - 1 for r in batch_ids], device=device)
    return model.lm_head(h[torch.arange(len(batch_ids), device=device), last])


@torch.no_grad()
def evaluate(model, items, device, pad_id):
    model.eval()
    right, by_q = 0, {}
    for b in range(0, len(items), 16):
        chunk = items[b:b + 16]
        logits = forward_last(model, [it[1] for it in chunk], device, pad_id)
        for (qid, _ids, groups, gold), row in zip(chunk, logits):
            ok = int(option_logprobs(row, groups).argmax()) == max(range(len(gold)), key=gold.__getitem__)
            right += ok
            n, r = by_q.get(qid, (0, 0))
            by_q[qid] = (n + 1, r + ok)
    model.train()
    return right / max(1, len(items)), {q: f"{r}/{n}" for q, (n, r) in sorted(by_q.items())}


def main():
    train_file, out_dir = sys.argv[1], sys.argv[2]
    device = torch.device("cuda")
    model = AutoModel.from_pretrained(REPO, trust_remote_code=True, dtype=torch.bfloat16).to(device)
    engine, P = model.engine, prompt_module(model)
    pad_id = engine.tokenizer.pad_token_id or 0

    rows = [json.loads(l) for l in open(train_file) if l.strip()]
    items = [(r["question_id"], *encode(engine, P, r)) for r in rows]
    random.seed(20261025)
    random.shuffle(items)
    held, train = items[:HOLDOUT], items[HOLDOUT:]
    lengths = sorted(len(it[1]) for it in items)
    print(f"{len(rows)} rows: {len(train)} train, {len(held)} held out. Tokens p50 {lengths[len(lengths) // 2]}, max {lengths[-1]}", flush=True)

    for p in model.parameters():
        p.requires_grad_(False)
    lora = add_lora(model.model.language_model)
    params = [p for m in lora.values() for p in (m.A, m.B)]
    print(f"LoRA on {len(lora)} linears, {sum(p.numel() for p in params) / 1e6:.1f}M trainable parameters", flush=True)
    model.train()

    acc, per_q = evaluate(model, held, device, pad_id)
    print(f"held-out before training: {acc:.1%} {per_q}", flush=True)

    opt = torch.optim.AdamW(params, lr=LR, weight_decay=0.0)
    total_updates = max(1, math.ceil(len(train) / (MICRO_BATCH * GRAD_ACCUM)) * EPOCHS)
    warmup = max(1, total_updates // 20)
    sched = torch.optim.lr_scheduler.LambdaLR(
        opt, lambda s: min(1.0, (s + 1) / warmup) * 0.5 * (1 + math.cos(math.pi * min(1.0, s / total_updates))))

    t0 = time.time()
    for epoch in range(EPOCHS):
        random.seed(42 + epoch)
        random.shuffle(train)
        total, n = 0.0, 0
        opt.zero_grad(set_to_none=True)
        for step, b in enumerate(range(0, len(train), MICRO_BATCH), start=1):
            chunk = train[b:b + MICRO_BATCH]
            logits = forward_last(model, [it[1] for it in chunk], device, pad_id)
            loss = torch.stack([
                -(torch.tensor(gold, device=device) * option_logprobs(row, groups)).sum()
                for (_q, _ids, groups, gold), row in zip(chunk, logits)
            ]).mean()
            (loss / GRAD_ACCUM).backward()
            if step % GRAD_ACCUM == 0 or b + MICRO_BATCH >= len(train):
                torch.nn.utils.clip_grad_norm_(params, 1.0)
                opt.step(); sched.step(); opt.zero_grad(set_to_none=True)
            total += loss.item(); n += 1
            if n % 100 == 0:
                print(f"  epoch {epoch + 1}/{EPOCHS} step {n} loss {total / n:.4f} ({time.time() - t0:.0f}s)", flush=True)
        acc, per_q = evaluate(model, held, device, pad_id)
        print(f"=== epoch {epoch + 1}/{EPOCHS} done in {time.time() - t0:.0f}s, avg loss {total / max(1, n):.4f}, held-out {acc:.1%} {per_q}", flush=True)

    os.makedirs(out_dir, exist_ok=True)
    torch.save({"rank": RANK, "alpha": ALPHA, "targets": TARGETS,
                "weights": {name: {"A": m.A.detach().cpu(), "B": m.B.detach().cpu()} for name, m in lora.items()}},
               os.path.join(out_dir, "lora.pt"))
    print(f"Saved adapters to {out_dir}/lora.pt after {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
