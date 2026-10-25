# Results: checks, evals and model training

All statistics from the build on 24 and 25 October 2026. The tables under "Latest benchmark" come from `eval/results-*.json` and are rebuilt with `npm run report`. The history tables are this session's records of earlier runs; their prediction files are in `laya/predictions/v1` to `v4`.

## How to read the numbers

- **Catch rate:** of the cases where the right answer is a trap, the share the checker flagged.
- **False alarms:** of the cases where the right answer is clean, the share the checker flagged anyway.
- **Calibration error:** gap between stated confidence and real accuracy over 5 bins. 0 is perfect.
- **Correct:** a case can accept more than one answer; any accepted answer counts.
- **Cost:** Jev is the OpenRouter price. Laya and d1 run on our own GPU, so their cost is GPU time on one RTX 6000 Ada at $1.425 per hour.
- **Time:** Jev includes the network round trip. Laya and d1 are measured on the GPU, one request at a time.

## Eval sets

| Set | Size | Where the labels come from | Trust |
| --- | --- | --- | --- |
| Hand-labelled (`eval/cases.ts`) | 34 test, 7 calibration | Drafted by a coding agent from the packet orders, with good and bad agent actions. `ri-03` was changed on 25 Oct: its label rested on an ops note that was missing from the facts, so the packet's own note was added | Highest, but small. Needs an area expert's review |
| Synthetic (`eval/synthetic.ts` → `eval/synthetic.json`) | 12,000 cases: 5,092 train, 842 calibration, 2,551 test, 3,515 unseen-template test | By construction: each case comes from a trap or a clean template. 676 template families, of which 476 are hand-written combinations and LLM-written families (`eval/generated/families.json`, written with `anthropic/claude-opus-5.5`) | The test split shares templates with training, so it flatters trained models |
| Synthetic, unseen templates | 3,515 | 203 template families held out of training completely (whole instruction topics, whole escalation situations, about a quarter of the phrasings) | The honest synthetic test |
| Photos and scans (`eval/vision.ts`) | 220 | Documents and receipts: dataset records (document kind, order VIN, expense kind and amount), plus mismatch variants (another order's VIN, a claim changed by 15–20%). Photos: labelled by looking at each of the 16 packet photos (`PHOTO_LABELS`) | Clean synthetic documents; few photo traps (1 damage, 2 no-car). Shows the image input works, not reliability on messy photos |

## Latest benchmark

<!-- results:start -->
### Hand-labelled decisions

34 test cases. Run 2026-10-25 09:35 UTC.

| Checker | Catch rate | False alarms | Calibration error | Time per check | Cost per 1,000 checks |
| --- | --- | --- | --- | --- | --- |
| Plain code rules | 86% | 13% | 0.09 | <1 ms | $0.0000 |
| Jev (typesafe/jev-1.14) | 100% | 13% | 0.12 | 321 ms | $0.0278 |
| Laya, as released | 87% | 81% | 0.14 | 10 ms | $0.0040 |
| Laya, fine-tuned (synthetic train split) | 87% | 6% | 0.02 | 10 ms | $0.0040 |
| Liquid d1-3B, as released | 53% | 31% | 0.21 | 23 ms | $0.0090 |
| Liquid d1-omni-600M, as released | 33% | 31% | 0.20 | 19 ms | $0.0075 |
| Liquid d1-3B, fine-tuned (LoRA, synthetic train split) | 93% | 6% | 0.05 | 23 ms | $0.0090 |
| Large LLM judge | not run: Set ANTHROPIC_API_KEY | | | | |

Correct answers per question:

| Question | Plain code rules | Jev (typesafe/jev-1.14) | Laya, as released | Laya, fine-tuned (synthetic train split) | Liquid d1-3B, as released | Liquid d1-omni-600M, as released | Liquid d1-3B, fine-tuned (LoRA, synthetic train split) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| quote_as_booking | 5/7 | 6/7 | 4/7 | 6/7 | 4/7 | 5/7 | 6/7 |
| stale_position | 6/6 | 6/6 | 3/6 | 6/6 | 4/6 | 3/6 | 6/6 |
| customer_contact | 4/4 | 4/4 | 2/4 | 4/4 | 3/4 | 2/4 | 4/4 |
| driver_report_as_fix | – | 5/5 | 3/5 | 5/5 | 3/5 | 4/5 | 5/5 |
| replaced_instruction | – | 4/5 | 3/5 | 3/5 | 4/5 | 2/5 | 4/5 |
| escalation_level | – | 7/7 | 1/7 | 7/7 | 3/7 | 3/7 | 7/7 |

### Synthetic set (labels by construction)

3187 test cases. Run 2026-10-25 09:37 UTC.

| Checker | Catch rate | False alarms | Calibration error | Time per check | Cost per 1,000 checks |
| --- | --- | --- | --- | --- | --- |
| Plain code rules | 44% | 23% | 0.18 | <1 ms | $0.0000 |
| Jev (typesafe/jev-1.14) | 90% | 15% | 0.05 | 228 ms | $0.0249 |
| Laya, as released | 63% | 54% | 0.12 | 10 ms | $0.0039 |
| Laya, fine-tuned (synthetic train split) | 100% | 0% | 0.07 | 10 ms | $0.0039 |
| Liquid d1-3B, as released | 63% | 31% | 0.09 | 23 ms | $0.0091 |
| Liquid d1-omni-600M, as released | 39% | 36% | 0.23 | 16 ms | $0.0064 |
| Liquid d1-3B, fine-tuned (LoRA, synthetic train split) | 100% | 0% | 0.07 | 22 ms | $0.0089 |
| Large LLM judge | not run: Set ANTHROPIC_API_KEY | | | | |

Correct answers per question:

| Question | Plain code rules | Jev (typesafe/jev-1.14) | Laya, as released | Laya, fine-tuned (synthetic train split) | Liquid d1-3B, as released | Liquid d1-omni-600M, as released | Liquid d1-3B, fine-tuned (LoRA, synthetic train split) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| quote_as_booking | 153/320 | 318/320 | 175/320 | 320/320 | 210/320 | 180/320 | 320/320 |
| stale_position | 223/320 | 319/320 | 158/320 | 320/320 | 225/320 | 160/320 | 320/320 |
| customer_contact | 202/317 | 311/317 | 170/317 | 317/317 | 267/317 | 172/317 | 317/317 |
| driver_report_as_fix | – | 294/317 | 169/317 | 317/317 | 206/317 | 193/317 | 317/317 |
| replaced_instruction | – | 872/955 | 543/955 | 954/955 | 718/955 | 477/955 | 955/955 |
| escalation_level | – | 665/958 | 347/958 | 958/958 | 405/958 | 416/958 | 958/958 |

### Synthetic set, templates never seen in training

4395 test cases. Run 2026-10-25 09:39 UTC.

| Checker | Catch rate | False alarms | Calibration error | Time per check | Cost per 1,000 checks |
| --- | --- | --- | --- | --- | --- |
| Plain code rules | 42% | 20% | 0.18 | <1 ms | $0.0000 |
| Jev (typesafe/jev-1.14) | 92% | 13% | 0.07 | 229 ms | $0.0251 |
| Laya, as released | 60% | 54% | 0.13 | 10 ms | $0.0039 |
| Laya, fine-tuned (synthetic train split) | 86% | 8% | 0.04 | 10 ms | $0.0039 |
| Liquid d1-3B, as released | 67% | 33% | 0.07 | 23 ms | $0.0090 |
| Liquid d1-omni-600M, as released | 43% | 35% | 0.19 | 16 ms | $0.0064 |
| Liquid d1-3B, fine-tuned (LoRA, synthetic train split) | 92% | 5% | 0.02 | 22 ms | $0.0089 |
| Large LLM judge | not run: Set ANTHROPIC_API_KEY | | | | |

Correct answers per question:

| Question | Plain code rules | Jev (typesafe/jev-1.14) | Laya, as released | Laya, fine-tuned (synthetic train split) | Liquid d1-3B, as released | Liquid d1-omni-600M, as released | Liquid d1-3B, fine-tuned (LoRA, synthetic train split) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| quote_as_booking | 215/435 | 435/435 | 243/435 | 435/435 | 301/435 | 307/435 | 423/435 |
| stale_position | 306/437 | 429/437 | 202/437 | 425/437 | 293/437 | 223/437 | 436/437 |
| customer_contact | 289/446 | 435/446 | 249/446 | 446/446 | 338/446 | 220/446 | 442/446 |
| driver_report_as_fix | – | 420/446 | 235/446 | 446/446 | 304/446 | 320/446 | 442/446 |
| replaced_instruction | – | 1224/1321 | 712/1321 | 1088/1321 | 1022/1321 | 684/1321 | 1208/1321 |
| escalation_level | – | 981/1310 | 471/1310 | 1042/1310 | 593/1310 | 563/1310 | 1158/1310 |

### Photos and scans from the packet

220 test cases. Run 2026-10-25 09:39 UTC.

| Checker | Catch rate | False alarms | Calibration error | Time per check | Cost per 1,000 checks |
| --- | --- | --- | --- | --- | --- |
| Jev (typesafe/jev-1.14) | 100% | 0% | 0.04 | 400 ms | $0.1918 |
| Liquid d1-3B, as released | 97% | 5% | 0.07 | 170 ms | $0.0674 |
| Liquid d1-omni-600M, as released | 84% | 32% | 0.34 | 63 ms | $0.0250 |
| Liquid d1-3B, fine-tuned (LoRA, synthetic train split) | 97% | 2% | 0.08 | 164 ms | $0.0650 |
| Laya, as released | not run: Set LAYA_URL | | | | |
| Laya, fine-tuned | not run: Set LAYA_FT_URL | | | | |
| Large LLM judge | not run: Set ANTHROPIC_API_KEY | | | | |

Correct answers per question:

| Question | Jev (typesafe/jev-1.14) | Liquid d1-3B, as released | Liquid d1-omni-600M, as released | Liquid d1-3B, fine-tuned (LoRA, synthetic train split) |
| --- | --- | --- | --- | --- |
| photo_vehicle_main | 14/14 | 12/14 | 12/14 | 14/14 |
| photo_damage_visible | 11/11 | 11/11 | 9/11 | 11/11 |
| photo_keys_visible | 16/16 | 16/16 | 16/16 | 16/16 |
| photo_matches_car | 29/29 | 21/29 | 16/29 | 25/29 |
| doc_type | 42/42 | 42/42 | 8/42 | 42/42 |
| doc_vin_matches | 60/60 | 60/60 | 30/60 | 59/60 |
| doc_receiver_signed | 12/12 | 12/12 | 12/12 | 12/12 |
| receipt_kind | 12/12 | 12/12 | 0/12 | 12/12 |
| receipt_total_matches | 24/24 | 24/24 | 12/24 | 24/24 |

<!-- results:end -->

## Laya fine-tuning history

Laya = `convaiinnovations/laya` (421M parameters, ModernBERT-large), laya 0.4.15. All runs used the recipe of the official notebook (`laya/train_laya.py`, RLCD loss, temperature calibration) on one RTX 6000 Ada on Verda. No test case was used for training in any run.

| Version | Training data | Epochs | Train time | Change |
| --- | --- | --- | --- | --- |
| v1 | 2,098 synthetic (256-case generator, then 3,000) | 4 | 2 min | First fine-tune |
| v2 | 1,564 | 4 | 1.5 min | Held-out template split; harder replaced-instruction and two-fix stale-GPS cases |
| v3 | 2,971 | 6 | 4.5 min | 356 families (LLM-written families added); fact ages in words ("more than 1 hour"); `ri-03` made answerable |
| v4 | 4,456 | 6 | 7 min | 674 families; hard negatives for customer contact; more current-only instruction cases |
| v5 | 5,934 | 8 | about 13 min | Reworded replaced-instruction question (v2 of the question); double data for the two judgement questions |

Results of each version (the synthetic sets changed between versions, so compare within a row family, not across all rows):

| Version | Hand-labelled: correct | Hand: catch / false alarms | Unseen templates: catch / false alarms | Notes |
| --- | --- | --- | --- | --- |
| Laya as released | 21/34 | 87% / 75% | 84% / 82% (v1 set) | Calls almost everything a trap |
| v1 | 28/34 | 80% / 6% | not measured (no unseen split yet) | 99% / 2% on the in-distribution synthetic test, which shares templates |
| v2 | 24/34 | 73% / 38% | 76% / 18% | The honest split showed it learned templates, not rules |
| v3 | 28/34 | 80% / 19% | 90% / 20% | Stale GPS 97%, escalation 69% |
| v4 | 27/34 | 80% / 25% | 87% / 8% | Customer contact fixed: 447/450 |
| v5 | 29/34 | 80% / 13% | 86% / 10% | Replaced instruction 80%, escalation 77% |

Where v5 still fails on unseen templates (share correct, by family type):

| Family type | Correct |
| --- | --- |
| Escalation: card proposed, right answer "too high" | 55% of 195 |
| Replaced instruction: customer follow-up emails | 68% of 90 |
| Replaced instruction: notes told apart by age only | 72% of 190 |
| Escalation: closed, right answer "right" | 77% of 234 |
| Escalation: closed, right answer "too low" | 79% of 224 |
| Stale GPS: stale fix used as now | 86% of 137 |
| Replaced instruction: current instruction only | 87% of 347 |
| Replaced instruction: reviewer edits | 91% of 105 |

## Earlier Jev and code results (before the set was rebuilt)

| Set | Checker | Catch | False alarms | Calibration | Time | Cost per 1,000 |
| --- | --- | --- | --- | --- | --- | --- |
| Hand (first run) | Code rules (3 of 6 questions) | 86% | 13% | 0.09 | <1 ms | $0 |
| Hand (first run) | Jev 1.14 | 73% | 6% | 0.07 | 241 ms | $0.025 |
| Synthetic, 256 cases | Code rules | 44% | 9% | 0.11 | <1 ms | $0 |
| Synthetic, 256 cases | Jev 1.14 | 93% | 2% | 0.07 | 244 ms | $0.021 |

Effect of rewording the replaced-instruction question (Jev, no training): hand-labelled traps caught went from 0/3 to 3/3, and unseen-template accuracy on that question from 77% to 93%.

## Image checks

- Jev reads images through OpenRouter when the image is inside the `state` list as `{type: "image_url"}`. An `assets` field is dropped. Control test on one receipt: with the image, P(match) was 0.99 / 0.01 / 0.01 for the true claim and two wrong claims (about 4,250 more input tokens); without it 0.47 / 0.49 / 0.48.
- Demo checks on packet photos (Jev): CD-420071 pickup photo is not the order's Audi Q8 e-tron (99%); CD-420612 delivery photo shows no car (96%); CD-420055 claim close-up shows damage (99%); CD-420145 fuel receipt matches the €45.84 claim (99%), and a claim of €54.84 does not (99%).

## Costs

| Item | Cost |
| --- | --- |
| Verda GPU runs (1 failed start, 6 runs of 1 RTX 6000 Ada, all deleted after) | about $2 (balance $152.06 → $149.51, including three unrelated CPU machines) |
| OpenRouter, LLM-written families (`claude-opus-5.5`) | about $1.35 (including one failed reply) |
| OpenRouter, Jev benchmark and card checks | well under $1 |
