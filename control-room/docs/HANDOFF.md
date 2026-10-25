# Handoff: on-the-road control room, checks and model training

State on 25 October 2026. Read this first, then `README.md` and `docs/RESULTS.md`. Nothing in this folder is committed to git yet.

## What exists

| Part | State | Where |
| --- | --- | --- |
| Control room app (queue, decision card, order page, evals, labeling) | Works. `npm run dev` → http://localhost:3100. The starter app (port 3000) is the main UI. Events fire from the clock (`lib/feed.ts`) | `app/`, `lib/` |
| On-the-road agent | Claude tool loop, through OpenRouter when there is no `ANTHROPIC_API_KEY`. Scripted replay runs the same tools when no model is set | `lib/agent.ts`, `lib/scenarios.ts` |
| 10 events (scenarios) with times on 21 Oct | 6 on-the-road, 4 photo and receipt; all pass | `lib/scenarios.ts`, `npm run agent all` |
| Checks on every card | Code rules; Jev through OpenRouter (text and images); d1-3B fine-tuned (text and photos) and Laya v6 on the model server; the LLM judge | `lib/checks.ts`, `lib/visual.ts`, `lib/vision.ts` |
| Model server | d1-3B + LoRA v1 and Laya v6 on one Verda GPU. The app reaches it at `MODEL_SERVER_URL` through an SSH tunnel. **It bills by the hour until `serve.sh down`** | `serve/`, `scripts/verda/serve.sh` |
| Eval sets | Hand (34 test), synthetic (12,000 cases), unseen-template synthetic (3,515), photos and scans (220) | `eval/` |
| Laya fine-tune | v6: 31/34 on the hand set, 86% caught / 8% false alarms on unseen templates (4,395) | `laya/`, `.data/checkpoints/laya-ft-v6.tgz` |
| Liquid d1 | **d1-3B with LoRA is the best checker:** 32/34 on the hand set, 93.5% correct (92% caught / 5% false alarms) on unseen templates, 216/220 photos. Adapters in `.data/checkpoints/d1-lora-v1.pt` | `d1/train_d1.py`, `d1/predict_d1.py` |
| Tests | 29 pass (`npm test`), offline, separate state folder | `tests/` |

## Secrets

All secrets are in `control-room/.env`, which git ignores: `OPENROUTER_API_KEY`, `JEV_MODEL`, `VERDA_CLIENT_ID`, `VERDA_CLIENT_SECRET`, and an empty `ANTHROPIC_API_KEY`. The OpenRouter key and the Verda secret were pasted into a chat, so rotate them after the hackathon. A hook in this setup blocks shell commands that read `.env`; scripts load it themselves through `dotenv` or `scripts/verda/run.sh`.

## How to repeat each step

Run everything from `control-room/`.

```sh
npm ci
npm run synth 1500                 # rebuild eval/synthetic.json (12,000 cases; seed 42)
npm run gen-families -- --more     # optional: ask the LLM for more families (costs about $0.60)
npm run export-laya                # laya/data/*.jsonl (train = synthetic train + calibration only)
scripts/verda/run.sh laya          # fine-tune + predict on a Verda GPU, deletes the machine after
npx tsx scripts/export-d1.ts       # d1/data (text sets + 220 image rows + 58 images)
scripts/verda/run.sh d1            # LoRA fine-tune of d1-3B, then predict with it and the released d1 models
scripts/verda/serve.sh up          # model server on the cheapest free GPU, plus the SSH tunnel (bills until "down")
scripts/verda/serve.sh status      # machine, price, hours on, health
scripts/verda/serve.sh tunnel      # open the tunnel again, for example after the Mac slept
scripts/verda/serve.sh down        # delete the machine, its disk and its key
npm run bench all                  # hand, synthetic, unseen templates, photos: Jev + files from laya/ and d1/
npm run report                     # rebuild the tables in docs/RESULTS.md
```

Notes:
- Prediction files are keyed by case ID, and IDs are reused when the synthetic set is rebuilt. After `npm run synth`, move old `laya/predictions/*.json` and `d1/predictions/*.json` aside (earlier versions are in `laya/predictions/v1` to `v4`), or the benchmark scores them against the wrong cases.
- A Verda run takes 15 to 30 minutes, mostly start-up and installs; Laya training itself takes 2 to 13 minutes. The script tries FIN-02, FIN-03, FIN-01, because the availability list is not always right.
- Checkpoints are git-ignored: `.data/checkpoints/laya-ft-v1.tgz`, `-v5`, `-v6` (about 800 MB each, `laya.Agent(path)` loads them) and `d1-lora-v1.pt` (98 MB, `predict_d1.py` and `serve/server.py` merge it into d1-3B).
- `npm run bench` reads d1-ft and Laya-ft from their prediction files. `BENCH_LIVE=1 npm run bench hand` scores the live model server instead. On 25 Oct the live scores were the same as the file scores.

## Open goal: "improve Laya until it is almost perfect"

Not reached. Target I set: unseen-template test at least 98% correct with at most 2% false alarms, and at most 1 miss on the hand set.

Where v5 fails is in `docs/RESULTS.md` ("Where v5 still fails"). In short: escalation judgements (55–79% by family type) and replaced-instruction cases told apart only by age or by a customer follow-up (68–72%). Laya is near perfect on the three factual questions.

What I would do next, in this order:
1. **Fine-tune d1-3B (3.1B, reads images).** It is 7 times larger than Laya and already gets 97% of image traps as released. Liquid ships no training recipe: the model loads its own code (`trust_remote_code=True`, `model.system_one(...)`). Read that code on a GPU machine, find the logits of the decision head, and train LoRA adapters on `laya/data/train.jsonl` with the same gold format. Score it with the same `predictions/*.json` file format so `npm run bench` picks it up (add the model to the list in `lib/benchmark.ts`).
2. **Train Laya on more of what fails:** more "by age only" and "customer follow-up" instruction cases, and more "too high" escalation cases. The in-distribution test split (2,551 cases) can also join training: the unseen-template and hand tests stay untouched.
3. **Collect real cases.** The hand set has only 34 cases. Real agent traces and operator rejects are the best data for the judgement questions. The labeling view already collects them.

## Known issues

- **Another Claude session built a parallel photo module** (`lib/visual.ts`, `app/photos/`, `app/traces/`, `JevPill.tsx`) next to this session's `lib/vision.ts`. Both work, but the cards show two Jev answer lists. Merge them into one module: keep `visual.ts`'s per-photo storage and add `vision.ts`'s document and receipt questions and the agent's `check_image` tool. `visual.ts` claimed OpenRouter does not pass images to Jev; that holds only for an `assets` field. This was fixed, and the control test is in its code comment.
- **Labels to review:** the hand-labelled cases (drafted by a coding agent) and `PHOTO_LABELS` in `eval/vision.ts`.
- **Model server cost:** on 25 Oct only an A100 80 GB ($2.149/h) was free. An A6000 ($0.79/h) is the cheapest type that works. Move with `serve.sh down`, then `serve.sh up`. A check takes about 26 ms on the GPU and about 210 ms from this Mac, because of the tunnel.
- **LLM judge rate limit:** through OpenRouter, a new account gets 20 requests per minute for Claude Opus. The judge then fails on some questions of a card.
- **Verda:** three unrelated CPU machines (`loud-city-runs-fin-03`, `futuristic-cable-unfolds-fin-02`, `fine-work-writes-fin-01`) are running and cost about $0.14 an hour together. They are not from this project.
