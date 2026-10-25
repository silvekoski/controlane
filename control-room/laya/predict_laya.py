"""Predict the test sets with Laya as released and Laya fine-tuned.

Writes predictions/<model>-<set>.json: { case id: { answer, confidence, ms } },
which the benchmark in lib/benchmark.ts scores with the same code as Jev.

Usage: python predict_laya.py out/laya-ft
"""
import json, os, sys, time

import laya

SETS = {"hand": "data/test-hand.jsonl", "synthetic": "data/test-synthetic.jsonl", "synthetic_ood": "data/test-synthetic_ood.jsonl"}


def read_answer(qtype, a):
    if qtype == "noul":
        p = float(a["noul"])
        return ("yes" if p >= 0.5 else "no"), max(p, 1 - p)
    probs = a.get("probabilities") or {a["choice"]: a.get("confidence", 0.5)}
    return a["choice"], float(max(probs.values()))


def run(name, agent):
    for set_name, path in SETS.items():
        rows = [json.loads(l) for l in open(path) if l.strip()]
        agent.predict(rows[0]["state"], rows[0]["questions"])  # warm-up, not timed
        out = {}
        for r in rows:
            qid = r["question_id"]
            t0 = time.perf_counter()
            res = agent.predict(r["state"], r["questions"])
            ms = (time.perf_counter() - t0) * 1000
            answer, conf = read_answer(r["questions"][qid]["type"], res["answers"][qid])
            out[r["id"]] = {"answer": answer, "confidence": round(conf, 4), "ms": round(ms, 2)}
        os.makedirs("predictions", exist_ok=True)
        with open(f"predictions/{name}-{set_name}.json", "w") as f:
            json.dump(out, f)
        print(f"{name} {set_name}: {len(out)} predictions", flush=True)


if __name__ == "__main__":
    try:
        released = laya.load("convaiinnovations/laya", device="cuda")
    except TypeError:  # older laya versions pick the device themselves
        released = laya.load("convaiinnovations/laya")
    run("laya", released)
    if len(sys.argv) > 1 and os.path.isdir(sys.argv[1]):
        run("laya_ft", laya.Agent(sys.argv[1], device="cuda"))
