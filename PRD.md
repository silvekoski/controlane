# PRD: Safe On-the-Road Agent

Oct 24, 2026 · @Veikka Silvekoski · Bahn Car Delivery Control Room, Prompt Operations Hackathon

## Summary

We build an on-the-road agent for Bahn and a control room where operators approve its decisions. Before an operator sees a proposal, a cheap decision model (Laya) checks it for known traps. A discovery agent finds new types of failure and turns them into new checks and eval cases.

## Problem

On-the-road exceptions start chains, and agent mistakes in these chains are easy to miss.

- **Exceptions start chains.** A breakdown, a missed ship or a late driver becomes a new booking, a cost decision and a message to the dealer. Today a person holds the whole chain.
- **Agent mistakes look correct.** The packet names the traps: a quote treated as a booking, a driver message treated as a fresh location, an old instruction treated as the current plan, and a stale GPS signal.
- **New edge cases need a person to find them.** The knowledge lives in the heads of ops people. Bahn calls the move from their heads to evals one of its biggest problems.
- **Large LLM judges are too slow and expensive** to check every run.

## What Bahn said

The challenge talks (transcripts 01 to 03) support this plan. The transcription is rough, so these points are paraphrased.

| What Bahn said | Talk | What it means for us |
| --- | --- | --- |
| They tried a System One decision model (Jev). They believe it has use cases, but they did not find them yet. | 03 | Our pitch: we found a use case. |
| They start with a strong model, build evals, then switch to a cheaper model and compare the results. | 02 | Our benchmark uses the same method, one step cheaper. |
| They turn each agent mistake into an eval case. | 01 | The discovery loop does this automatically. |
| Their biggest eval problem: getting expert knowledge into evals, and making evals from new edge cases without manual work. | 02 | This is the main problem that we solve. |
| Many ops decisions have no single correct answer. | 03 | A label can accept more than one option, or use a score. |
| One main agent runs for each order and starts sub-agents, for example for flight booking. | 03 | We check each sub-agent decision, not the full order trace. |
| They want a filter that finds the important driver message in the noise. | 02 | A second use for decision models: message triage. |
| They do not use agents much for monitoring yet, and want new ideas there. | 03 | This supports the GPS stop check. |
| They check evals with an exact match or with an LLM judge. | 02 | The decision model replaces the expensive LLM judge. |

**Rule for fine-tuning:** Bahn doubted that a trained model is needed to predict problems such as a late ferry, because GPS and route data already answer that (03). We fine-tune only for judgement questions, such as "Was this the right escalation level?". Plain logic calculates the rest.

## Goals and success metrics

The demo must show four results with numbers. We set the targets after the first full run.

| Goal | Metric | How we measure |
| --- | --- | --- |
| Operators see only the cases that need them | Share of on-the-road events that the agent closes without a person | Agent runs on the dataset orders |
| Laya catches the traps | Catch rate and false alarm rate for each question | 30 to 50 hand-labeled decisions |
| Laya is cheap and fast | Cost and time for each check | Same checks on Jev and a large LLM judge |
| The eval loop works | New eval cases, and pass rate before and after a fix | Weak agent version vs fixed version |

**Base requirement:** one operator handles at least 100 deliveries per day with this tool. Bahn named this as the minimum (02).

## Benchmark against Jev

We run four checkers on the same test set and the same questions. The result shows if a small open model that Bahn owns can match Jev.

| Checker | Training | Why it is in the test |
| --- | --- | --- |
| Laya, as released | None | Baseline for the open model |
| Laya, fine-tuned | Labels from the discovery agent | Our main candidate |
| Jev | None | The strongest decision model with no training |
| Large LLM judge | None | Quality ceiling and cost reference |

**Results** (fill in after the run)

| Checker | Catch rate | False alarms | Calibration | Cost per 1,000 checks | Time per check |
| --- | --- | --- | --- | --- | --- |
| Laya, as released |  |  |  |  |  |
| Laya, fine-tuned |  |  |  |  |  |
| Jev |  |  |  |  |  |
| Large LLM judge |  |  |  |  |  |

Calibration means: an answer with 80% confidence is correct about 80% of the time.

**Rules for a fair test**

- The test set is the 30 to 50 hand-labeled decisions. No checker trains on it. Laya calibration uses a separate small set.
- Each checker gets the same input: the state at the decision moment and the action of the agent.
- Each checker gets the same typed questions and the same options.
- Report the results for each question, not only the average. A model can be good on one trap and weak on another.

Some ops decisions have more than one good answer. For these, a label can accept two options, or use a score instead of yes or no. A checker is correct if it picks any accepted option.

**What public claims say** (we test these, we do not trust them)

- Jev is stronger with no training and handles longer inputs. Laya beats Jev only after fine-tuning. Source: one [LinkedIn post](https://sg.linkedin.com/in/jjsurmeda), medium reliability.
- TypeSafe claims that Jev costs 0.042 USD per million input tokens, with free output. Source: [Futura-Sciences](https://www.futura-sciences.com/tech/actualites/intelligence-artificielle-jev-fait-parler-lui-cette-ia-annonce-etre-bien-plus-rapide-bien-moins-chere-grands-modeles-137822/), a vendor claim reported by a news site.
- The Laya authors report about 33 to 40 ms per question on one T4 GPU. Source: the same LinkedIn post.

## Visual checks

Drivers and sites send photos and scans. A visual decision model answers typed questions about them, in the same way that Laya answers questions about text.

| Input | Example questions |
| --- | --- |
| Dashboard photo from the driver | Is a warning light on? Which colour: red, amber or none? |
| Handover photo | Is new damage visible? Is the photo clear enough to judge? |
| Release document or CMR | Is the document signed? Does the VIN match the order? |
| Receipt | Is it a fuel, train or taxi receipt? Does the total match the claim? |

The agent uses these answers before it makes a card. For example, the agent asks the driver for a photo of the warning light. The visual model answers "red light" with 92% confidence. The card then shows the photo and the answer. When the confidence is low, the card asks the operator to look at the photo.

Test data: the 58 made-up documents, receipts and photos in the attachments folder.

**Image benchmark** (same result columns as the text benchmark)

| Checker | Weights | Fine-tune with images | Note |
| --- | --- | --- | --- |
| Jev 1.14 | Hosted only | Not known | Image input is new. TypeSafe warns against production use and says models do worse on images than on text. |
| Liquid d1-3B | Open | Yes | About 8 ms per question and 102 ms per 384 px image on an RTX 4090. Vendor figures. |
| SelfJev-4B Vision | Open | Yes | Same API as Jev. About 163 ms for one image and one question on an L40S. Author figures. |
| Large LLM judge with vision | Hosted only | Not needed | Quality ceiling and cost reference |

All three decision models use a Jev-style request format, so one client can switch between them.

Sources:

- [Jev 1.14 with image input](https://pasqualepillitteri.it/en/news/26048/jev-1-14-image-input-box-typesafe-warns): news blog, medium reliability.
- [Liquid d1-3B release](https://ithome.com/1/010/946.htm) and [Liquid d1 vision API guide](https://rohitai.com/blog/liquid-d1-vision-decision-model-api-guide): news and blog. Benchmarks are vendor-reported only.
- [SelfJev on PyPI](https://pypi.org/project/selfjev/0.3.0/): the author's own package page and figures.

## Users

The main user is an operations person who is not an engineer.

| User | What they do in the product |
| --- | --- |
| Operations person | Reads decision cards, then approves, edits or rejects them. Works with hundreds of deliveries each day. |
| Area expert | Labels unclear eval candidates with one tap. |
| Driver (simulated) | Answers the agent in the driver chat. |
| Bahn engineer | Reads the results table and the eval view. Not a daily user. |

## Scope

**In scope**

- On-the-road cases: a long stop, a warning light or breakdown, a missed ferry, and a late driver with a chained gig. Stretch: speeding and route deviation, which Bahn already calls drivers about (03).
- A queue of decision cards and an order page that shows the source and time of each fact.
- A simulated driver chat.
- Laya checks on each decision card, visual checks on photos and documents, and plain code checks for hard rules.
- A discovery agent on sampled traces, and a results table.

**Out of scope**

- Real bookings, real calls and real customer messages.
- Other areas: pickup readiness, travel booking and driver support.
- Hotel booking.
- Laya fine-tuning, if time is short. This is a stretch goal.

## Solution

The product has four parts. The agent does the work, Laya checks it, the operator decides, and the discovery loop makes the checks better over time.

1. **On-the-road agent.** A language model works in a loop with mock tools:
   - Read the order and the chained gigs.
   - Get the last GPS position and its time.
   - Look up the place at the stop.
   - Message the driver.
   - Get ferry and train options as quotes.
   - Calculate the effect on the arrival time.

   The agent does the cheap work first. If the facts are fine, it logs the event and stays quiet. If not, it makes a decision card.
2. **Control room.** A queue shows only the decision cards, sorted by time left before a promise breaks. Each card shows what happened, each fact with its source and time, what the agent did, and its suggestion. The operator can approve, edit or reject. A reject asks for a one-tap reason.
3. **Laya check layer.** Before a card goes into the queue, Laya answers the typed questions on each sub-agent decision in the proposal. If it finds a likely trap, the card shows a plain warning, for example "The next ferry is only a quote, not a booking." A visual decision model does the same for photos and scans. Plain code checks the hard rules, such as a customer message without approval.
4. **Discovery agent and eval loop.** A large LLM reads a sample of traces and rejected proposals. When it finds a new type of failure, it writes a typed question and labels the cases. Laya trains on these labels. If there is no time to fine-tune, Jev with no training does the same job. A hand-labeled test set measures both models.

&#91;embedded content: how the four parts connect\]

Quiet runs and rejected cards both feed the discovery agent. Its new questions go back into the Laya checks.

## Interface

We build a custom interface, not the starter board. Taste is 30% of the score, and many teams start from the same starter.

- **The queue reads like an inbox, not a board.** Each row is one sentence: what happened and the decision needed. Example: "Driver stopped 40 min on E45. Ferry at 18:00 at risk. Approve rebooking?"
- **Each fact shows its source and age**, for example "GPS, 12 min ago" or "Driver chat, 3 min ago". A Laya warning sits next to the fact that it questions.
- **Quiet orders are one line at the top**, for example "94 orders on track". This shows the scale in one glance.
- **We make our own design system:** type, spacing, colours, and empty and loading states.

Every card shows the facts that Bahn needs when something goes wrong (02): the customer, the driver, the current position, the arrival time, if the car will be late, and if a chained gig is at risk.

## Rules and approvals

The agent asks and looks up facts freely. A person approves each change.

| Action | Who does it | Approval |
| --- | --- | --- |
| Look up data, ask the driver, message the pickup place | Agent | None |
| Rebook a ferry or train, change a cost or a date | Agent proposes | A person approves |
| Message the customer | Agent drafts only | A person approves and sends |
| Laya and code checks | System, on every proposal | None |

The first step on the autonomy ladder is a cost limit. Below the limit, the agent rebooks without approval. Bahn's agents already book most flights this way and ask a person only for an expensive one (02). The brief asks us to start with approvals, so the demo sets the limit to zero and shows the setting. Later, an action type can get more freedom when its eval pass rate stays above a set limit.

**Check the facts again before acting.** An approved card can be out of date. In Bahn's example, a booking agent started after the driver had already cancelled (02). Just before the system runs an approved action, it reads the facts again. If a fact changed, the action does not run, and the card goes back to the queue marked "Changed since approval".

## Demo flow

The video is 3 minutes. The control room comes first, and the eval proof comes after it. Bahn prefers new takes on how people and agents work together over polished copies of existing tools (02), so the pitch leads with what is new.

1. **The problem, in one sentence.** Most orders are fine, and the agent must find the ones that are not.
2. **The queue.** 100 orders, and only a few decision cards.
3. **A live case.** A driver stops on the motorway. The agent checks the place and the GPS age, asks the driver, and makes a card.
4. **The decision.** The operator opens the card. Laya warns that the next ferry is only a quote. The operator approves the rebooking.
5. **The proof.** The eval view shows the failure type that the discovery agent found, and the results table.
6. **How we built it with AI.** What we asked the coding agents for, what we checked and what we threw away.

## Technical approach

We use the data from the Bahn repository and build everything else ourselves.

| Part | Choice |
| --- | --- |
| Data | Keep `dataset/`, `attachments/` and `SCHEMA.md` from the [Bahn repository](https://github.com/Bahn-Express/car-delivery-control-room). |
| Loading | Reuse the starter seed scripts (`db:seed`, `attachments:seed`), or write a small loader for the JSONL files. The data is a fixed snapshot, so a database is optional. |
| Data check | Run `check_packet.py` after loading. |
| Interface | Custom. Replace all starter components. |
| Stack | Next.js and TypeScript by default. The brief allows any framework or UI library. |
| Hard rule | The repository runs from a fresh clone with the steps in our README. |

## Build spec

This section is for the coding agent. The field names are proposals. Check each one against `dataset/SCHEMA.md` before coding.

### Decisions before coding

- [ ] Pick 5 to 10 on-the-road orders from the dataset. Note the trap in each one.
- [ ] Confirm Jev access, the Laya checkpoint and the visual model.

### Data models

```ts
type Fact = {
  label: string;
  value: string;
  source: "gps" | "driver_chat" | "order" | "site" | "operator" | "app" | "tool";
  observedAt: string; // ISO time, shown as age on the card
  recordId?: string;  // link to the dataset record
};

type ProposedAction = {
  kind: "rebook_ferry" | "rebook_train" | "change_date" | "change_cost"
      | "message_customer" | "message_driver" | "repost_gig" | "call_dealer" | "none";
  description: string;
  costDelta?: number;
  needsApproval: boolean;
};

type DecisionCard = {
  id: string;
  orderId: string;
  status: "new" | "approved" | "edited" | "rejected";
  summary: string;     // one sentence: what happened and the decision needed
  deadline: string;    // when a promise breaks; sorts the queue
  facts: Fact[];
  agentActions: string[]; // what the agent already did
  proposal: ProposedAction;
  checks: CheckResult[];
  decidedBy?: string;
  decidedAt?: string;
  rejectReason?: "wrong_info" | "too_early" | "ask_customer" | "other";
  rejectNote?: string; // answer to "How did you know?"
};

type TypedQuestion = {
  id: string;
  question: string;
  type: "yes_no" | "choice" | "score";
  options?: string[];
  source: string;      // where the question came from
  approvedBy?: string;
  version: number;
  status: "proposed" | "live" | "retired";
};

type CheckResult = {
  questionId: string;
  questionVersion: number;
  model: "code" | "laya" | "laya_ft" | "jev" | "d1" | "selfjev" | "llm_judge";
  answer: string;
  confidence: number;  // 0 to 1
  ms: number;
  costUsd?: number;
};

type DecisionTrace = {
  id: string;
  orderId: string;
  agent: string;       // "main" or the sub-agent name
  state: Fact[];       // the facts at the decision moment
  action: ProposedAction | { tool: string; input: unknown };
  reasoning?: string;
  createdAt: string;
};

type EvalCase = {
  id: string;
  traceId: string;
  questionId: string;
  acceptedAnswers: string[]; // more than one when the decision has several good answers
  labeledBy: "hand" | "discovery_agent" | "operator_reject";
  split: "train" | "calibration" | "test";
};
```

### Agent tools (mock)

| Tool | Input | Output | Approval |
| --- | --- | --- | --- |
| `get_order` | order id | Order, car and chained gigs | None |
| `get_gps` | driver id | Position, time of the fix, speed. Can be empty, because GPS starts only about 1 hour before pickup (03). | None |
| `lookup_place` | position | Place type and name, for example a fuel station | None |
| `message_driver` | driver id, text | Message id. The simulated driver answers. | None |
| `get_travel_options` | from, to, earliest time | Ferry and train options, each marked as a quote, with price and time | None |
| `estimate_arrival` | order id, position | New arrival time, minutes late, and if a chained gig is at risk. Includes charging stops for electric cars. | None |
| `propose_action` | proposed action, facts | A decision card in the queue | The card only. A person approves the action. |

No tool sends a message to a customer. A code check rejects any action that tries.

After approval, the system reads the facts again before it runs the action. A missing GPS position is normal before the tracking window, so the agent treats it as unknown, not as a problem.

### Prompts

- **On-the-road agent:** its role, the rules (cheap work first, never contact a customer, stop and ask when facts conflict), the tool list, and when to make a card instead of a log entry.
- **Simulated driver:** one persona for each test order, with the facts the driver knows and the facts the driver tells only when asked.
- **Discovery agent:** read sampled traces and rejected cards, find failure types that the live questions do not cover, and write question drafts with labels.

### Screens

| Screen | Shows | Empty state |
| --- | --- | --- |
| Queue | The "orders on track" line, then cards sorted by deadline | "Nothing needs you right now." |
| Decision card | Summary, facts with source and age, agent actions, proposal, warnings, and approve, edit and reject | Not needed |
| Order view | Timeline of events and messages, facts, and the traces for the order | "No events yet." |
| Eval view | Live questions, benchmark results and eval candidates | "No eval candidates yet." |
| Labeling view | One case at a time, a one-tap answer and a "How did you know?" field | "All cases are labeled." |

The loading state of each screen shows the same layout with placeholder blocks, not a spinner.

### Done when

| Phase | Done when |
| --- | --- |
| 1: Agent | On 3 dataset orders, the agent closes a normal stop quietly and makes a card for a breakdown and for a missed ferry. |
| 2: Control room | An operator can approve, edit and reject a card. Each fact shows its source and age. Warnings show on the card. The code check blocks a direct customer message. |
| 3: Proof | The results table has numbers for Laya as released, Jev and the large judge on the hand-labeled test set. |
| 4: Hand-in | A fresh clone runs with the README steps and no GPU. The video is 2 to 3 minutes. |

## Build plan until Sunday 15:00

Build the parts in this order. Each phase protects the higher-scoring part first.

**Phase 1: Agent**

- [ ] Load the dataset and pick 5 to 10 on-the-road orders with traps
- [ ] Build the agent loop with mock tools
- [ ] Build the simulated driver

**Phase 2: Control room**

- [ ] Build the decision card queue and the order page
- [ ] Add the code checks for hard rules
- [ ] Add the Laya or Jev checks on the cards

* [ ] Show the queue and one card to Bahn's ops people at the venue, and write down what confuses them

**Phase 3: Proof**

- [ ] Run the discovery agent on sampled traces
- [ ] Hand-label 30 to 50 decisions and a set of attachment images
- [ ] Run the benchmark against Jev and fill in the results table
- [ ] Stretch: fine-tune Laya

**Phase 4: Hand-in**

- [ ] Record the demo video
- [ ] Write the README and export the agent traces
- [ ] Push the public repository

## Risks and open questions

| Risk | Fallback |
| --- | --- |
| The eval part looks like a developer tool | Keep it in a separate view. Write the cards in ops language. |
| Fine-tuning takes too long | Use Jev with no training, or Laya with no fine-tuning. |
| The discovery agent labels cases wrongly | Measure it against the hand-labeled test set. |
| Agent traces are too long for Laya | Check one sub-agent decision at a time: the state at that moment and the action. |

**Open questions**

- [ ] Does Bahn accept the eval layer as part of the area? Ask on Discord.
- [ ] Can we use Jev this weekend, and which visual decision model do we use?
- [ ] Which Laya checkpoint do we use, and how do we fine-tune it? Check the Laya GitHub page.
- [ ] Which dataset orders have the best on-the-road traps?

