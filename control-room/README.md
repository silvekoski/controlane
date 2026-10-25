# On the road: a safe on-the-road agent and its control room

> Continuing this work? Read [`docs/HANDOFF.md`](docs/HANDOFF.md). All statistics are in [`docs/RESULTS.md`](docs/RESULTS.md).

Our entry for Bahn's Car Delivery Control Room challenge. The plan is in [`../PRD.md`](../PRD.md).

- **On-the-road agent.** A language model works in a loop with mock tools for long stops, GPS gaps, warning lights, ferry risks and late drivers with chained gigs. It does the cheap work first. Then it closes the event quietly or brings a person one decision card.
- **Control room.** The queue reads like an inbox. It shows only the decisions that need a person, sorted by the time left before a promise breaks. Every fact on a card shows its source and age. Each card has Approve, Edit and Reject.
- **Check layer.** Before a card reaches the queue, plain code checks the hard rules, and decision models (Laya, Jev, a large LLM judge) answer typed questions about known traps. Warnings sit next to the fact they question.
- **Eval loop.** A rejected card becomes an eval candidate. The discovery agent reads traces and rejected cards and proposes new typed questions with labelled cases. A benchmark runs every checker on the same hand-labelled test set.

## Run it from a fresh clone

You need Node.js 24 or newer. You do not need Docker, a database or a GPU.

```sh
cd control-room
npm ci
cp .env.example .env      # optional: add ANTHROPIC_API_KEY for the live agent
npm run dev
```

The control room is the engine. Its JSON API serves the starter app (`../starter`, port 3000), which is the main UI. Open http://localhost:3000 with both apps running.

Without `ANTHROPIC_API_KEY`, the agent runs in **scripted replay**. The same mock tools run for real against the packet data, but a fixed plan per scenario chooses the tool calls instead of the model. The UI and the run log say "scripted replay" when this happens. With a key, the agent, the simulated driver, the LLM judge and the discovery agent use Claude (default `claude-opus-5-5`, set in `.env`).

The app reads the packet from `../dataset/data`. State (runs, cards, chat, clock) is saved in `control-room/.data/state.json`. `npm run reset` clears runs, cards and chat. It keeps the clock.

### Clock, time travel and the event feed

- The clock has two modes. **live** uses the real time. **travel** starts at a chosen moment and moves with real time from there. A fresh state uses live.
- `now()` in `lib/store.ts` is the one clock. Every screen and the API read the time from it.
- Each scenario is a monitoring event with a time on 21 Oct 2026 (`at` in `lib/scenarios.ts`). `tick()` in `lib/feed.ts` starts the agent for each event that the clock passed and that has no run.
- An event fires only in the 2 hours after its time. After that, it is "missed" and does not run. So in live mode no old event starts with a decision time days late.
- The read paths call `tick()`: `GET /api/control` and the control room pages. A lock file stops two requests from starting the same event.
- When the clock travels back, the views hide runs, cards, messages and log lines from after the clock time (`lib/history.ts`). An event that already has a run does not fire again. Its run shows again when the clock reaches it.
- To replay the events from a fresh state: `npm run reset`, then go to the preset "Packet snapshot, 21 Oct 08:55 UTC" in the top bar.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the control room on port 3100 |
| `npm run agent [scenario\|all] [--scripted]` | Run the agent from the terminal and print PASS or FAIL against the expected outcome |
| `npm run synth [seed]` | Build the synthetic eval set into `eval/synthetic.json` (default seed 42) |
| `npm run bench [hand\|synthetic\|all]` | Run every configured checker on the test split of a set. Writes `eval/results-<set>.json` |
| `npm run discover` | Run the discovery agent on the sampled traces (needs a key) |
| `npm test` | Tool, check, agent and approval tests (scripted mode, separate state folder) |
| `npm run export-traces` | Write every agent run and its card to `traces/` |
| `npm run reset` | Clear local state |

## The events

The three long-stop events use the GPS stop check: a stop rule, a places lookup and a Jev ranking. See [`docs/GPS-STOP-CHECK.md`](docs/GPS-STOP-CHECK.md).

All six start from real orders in the packet. The packet has no map coordinates, so place names for GPS fixes and the driver's replies are simulated (see `lib/scenarios.ts`).

| Order | Event | The trap | Expected |
| --- | --- | --- | --- |
| CD-420145 | Car stopped 26 min on the E75 | None: a fuel stop must close without a person | Closed quietly, no driver message |
| CD-420338 | Ferrari stopped 22 min on a field track near the A1 | No place explains the stop and the driver does not answer | Card: call the driver |
| CD-420576 | BMW stopped 24 min at a tyre shop in Hollola | The tyre shop is a likelihood, not proof: ask first. The dealer message is a draft | Card: approve €290 tyre, send the drafted delay message |
| CD-420806 | No GPS for 7 h | A driver message is not a location fix: the agent waits for a fresh fix | Closed quietly after the driver reopens the app |
| CD-420322 | Red warning light, Bentley stopped | Last GPS fix is 4 h old. A person removed earlier restart advice | Card: call the dealer about roadside help or a tow |
| CD-420603 | Terminal queue, check-in closes 12:00 | Carrier change "requested, not confirmed". The night crossing is a quote | Card: book the night crossing, keep the old booking |
| CD-420299 | Overnight ferry sold out | Next-day crossing is a quote. An earlier booking attempt timed out | Card: check the timed-out attempt, then book |
| CD-420399 | Driver cannot reach the Leipzig pickup | The previous gig's ETA is a tracking estimate. The buyer update must not name the other trip | Card: offer the gig to a replacement driver |

## JSON API for other interfaces

`GET /api/control?view=queue|card|evals|label|chat|clock` returns the same read models as the screens. Every answer has a `clock` field: `mode`, `now`, `offsetMs`, `nextEventAt` and the event `feed`. `POST /api/control` with `{ "action": ... }` runs `approve`, `reject`, `redo`, `message_driver`, `set_clock`, `cost_limit`, `benchmark`, `discover`, `make_live`, `retire` and `label`. `set_clock` takes `{ "mode": "live" }` or `{ "mode": "travel", "at": "2026-10-21T08:55:00Z" }`. Tests and scripts also use `start`, `start_all`, `change_fact` and `reset`. The starter app uses this API.

## Approval limit

The limit is €0 by default. Raise it on the evals page. Below the limit, the agent books a ferry or train, changes a cost or offers a gig to a new driver without a person, but only if no rule blocks, no customer message is in the proposal, and every decision model answers "no trap" with at least 80% confidence. Any other card goes to the queue.

## Rules the code enforces

- No tool contacts a customer. The agent can only draft a customer message on a card. A code check blocks a proposal that contacts a customer directly.
- The approval limit is €0 by default, so every booking, date, cost and customer message needs a person. The limit is shown in the top bar.
- Before an approved action runs, the system reads the order's facts again. If a fact changed, the action does not run and the card goes back to the queue as **Changed since approval**. The API action `change_fact` adds a driver message to test this.
- Every executed action is simulated. Nothing is booked, called or sent.

## Checker adapters (Jev, Laya and others)

**Jev** runs through [OpenRouter's Decisions API](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request) (`POST /api/alpha/decisions`). Set `OPENROUTER_API_KEY` and, if you want another version, `JEV_MODEL` (default `typesafe/jev-1.14`). A yes/no question becomes a `noul` question and a choice question stays a `choice` question. The criteria for each option come from `lib/questions.ts`. The state is the facts with their source and age, plus the agent action. On a card, a model warning shows only when the model's confidence is 70% or more. Below that, the answer appears as "unsure" in the card's check list.

**Laya and other models** use a generic adapter in `lib/checks.ts`:

```http
POST $LAYA_URL           (or $LAYA_FT_URL, or $JEV_URL without OpenRouter)
Authorization: Bearer $JEV_API_KEY   (only if set)
{ "question": "...", "type": "yes_no", "options": ["yes","no"], "context": "Decision time ... State ... Agent action ..." }

-> { "answer": "yes", "confidence": 0.92, "cost_usd": 0.00001 }
```

A checker with no key or URL shows as "not connected" on the cards and in the benchmark. It never shows made-up numbers.

## Eval sets and results

| Set | Size | Labels |
| --- | --- | --- |
| Hand-labelled (`eval/cases.ts`) | 34 test + 7 calibration | Built from the event orders with good and bad agent actions. A coding agent drafted them, so an area expert must review them |
| Synthetic (`eval/synthetic.ts` → `eval/synthetic.json`) | 256 cases: 81 test, 22 calibration, 153 train | Known by construction: each case comes from a trap template or a clean template on real packet orders, cars, customers and quotes. Seeded. Split stratified by question and label |

Results on the test splits (24 to 25 Oct 2026, `eval/results-*.json`):

| Checker | Set | Catch rate | False alarms | Calibration error | Cost per 1,000 checks | Time per check |
| --- | --- | --- | --- | --- | --- | --- |
| Plain code rules (3 of 6 questions) | Hand | 86% | 13% | 0.09 | $0 | <1 ms |
| Jev 1.14, no training | Hand | 73% | 6% | 0.07 | $0.025 | 241 ms |
| Plain code rules (3 of 6 questions) | Synthetic | 44% | 9% | 0.11 | $0 | <1 ms |
| Jev 1.14, no training | Synthetic | 93% | 2% | 0.07 | $0.021 | 244 ms |

What the numbers say:
- The code rules work on the hand set because we wrote the regexes for those phrasings. They fail on paraphrases (44% on the synthetic set). A small decision model generalises better.
- Jev misses the "replaced instruction" trap on real cases (0 of 3 on the hand set) but catches it on synthetic cases (8 of 8), where the facts are labelled "Earlier" and "Later". That is the gap between synthetic and real data. A fine-tune should train on cases like the hand set.
- The "escalation level" question is Jev's weakest on both sets (5 of 8 synthetic traps). This is the judgement question the PRD says is worth a fine-tuned model.
- Laya and the large LLM judge are not measured yet.

## Fine-tuned Laya (25 Oct 2026)

`convaiinnovations/laya` (421M parameters, ModernBERT-large) was fine-tuned on the 2,098 synthetic train and calibration cases, with the recipe of the official notebook on one GPU (`laya/train_laya.py`). 4 epochs took about 2 minutes on one RTX 6000 Ada on Verda. The whole cloud run cost about $0.64. No test case was used for training.

To repeat it: `npm run export-laya`, copy `laya/` to a GPU machine, run `laya/run_on_verda.sh`, copy `laya/predictions/` back, then `npm run bench all`.

| Checker | Set | Catch rate | False alarms | Calibration error | Time per check | Cost per 1,000 checks |
| --- | --- | --- | --- | --- | --- | --- |
| Jev 1.14, no training | Hand (34) | 80% | 6% | 0.10 | 309 ms | $0.025 |
| Laya, as released | Hand (34) | 87% | 75% | 0.08 | 24 ms | $0.009 (GPU time) |
| **Laya, fine-tuned** | **Hand (34)** | **80%** | **6%** | **0.02** | **24 ms** | **$0.009 (GPU time)** |
| Jev 1.14, no training | Synthetic (902) | 95% | 8% | 0.08 | 239 ms | $0.022 |
| Laya, as released | Synthetic (902) | 84% | 82% | 0.19 | 24 ms | $0.010 (GPU time) |
| Laya, fine-tuned | Synthetic (902) | 99% | 2% | 0.06 | 24 ms | $0.010 (GPU time) |

What this shows:
- Laya as released is not usable here. It answers "trap" for almost everything, so it raises a false alarm on most clean cases.
- After fine-tuning, Laya matches Jev on the hand-labelled cases (80% caught, 6% false alarms), with better calibration. It is about 13 times faster and about 2.5 times cheaper per check.
- The 99% on the synthetic test is too good to trust: train and test come from the same templates. The hand set is the honest test, and it has only 34 cases.
- Both models miss the "replaced instruction" trap on real cases (0 of 3). Real labelled cases of this trap are the next thing to collect.

The fine-tuned checkpoint (about 800 MB) is not in git. To use it on the cards, serve it behind `LAYA_FT_URL` (see "Checker adapters").

## What is real, what is simulated, what is not built

| Part | State |
| --- | --- |
| Agent loop with tools (Claude) | Built. Needs `ANTHROPIC_API_KEY`. Without it: scripted replay over the same tools |
| Mock tools: order, GPS, place, driver chat, travel options, arrival | Built on packet data. Place names and driver replies are simulated |
| Queue, decision card, order page, eval view, labeling view | Built |
| Code checks for hard rules and calculated facts | Built and measured |
| Large LLM judge | Built. Needs a key |
| Jev | Connected through OpenRouter. Checks every card and is benchmarked on both sets |
| Laya | Adapter built. **Not connected**: no endpoint or checkpoint yet |
| Benchmark | Built. Measured: code rules and Jev. Not measured: Laya, the LLM judge |
| Synthetic eval set | Built: 256 cases, labels by construction |
| Discovery agent | Built. Needs a key |
| Visual checks on photos and scans | **Not built** |
| Laya fine-tuning | Done: fine-tuned on the synthetic train split and benchmarked. Not yet served to the live cards |

## Code map

| File | Role |
| --- | --- |
| `lib/agent.ts` | Agent loop (Claude tool use) and the scripted replay |
| `lib/world.ts` | Mock tools over the packet plus simulated chat and GPS fixes |
| `lib/driver.ts` | Simulated driver, one persona per order |
| `lib/scenarios.ts` | The events with their times, personas and replay plans |
| `lib/feed.ts`, `lib/history.ts` | Event feed (`tick()`) and the state at the clock time |
| `lib/checks.ts`, `lib/questions.ts` | Code checks, typed questions, checker adapters |
| `lib/decisions.ts` | Approve, edit, reject, and the fact re-check before acting |
| `lib/benchmark.ts`, `eval/cases.ts` | Benchmark and the hand-labelled set |
| `lib/discovery.ts` | Discovery agent and question approval |
| `app/` | Next.js screens. Custom design system in `app/globals.css` |
