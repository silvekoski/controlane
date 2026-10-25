# GPS stop check: one agent, one task

Bahn tracks each driver by GPS during a gig. A long stop can be a coffee break, a breakdown or a stale signal, and today a person checks each one. This agent does that check. It does the cheap work first, and a person sees only the stops that need one.

## The flow

```
GPS track ──► Stop rule (code) ──► Agent (Claude, tool loop)
                                     1. get_gps          is the fix fresh?
                                     2. nearby_places    what is at the stop? (Google Places or simulated)
                                     3. rank_stop_cause  Jev ranks the places and the cause, code policy picks the next step
                                     4. message_driver   only if the policy says ask
                                     5. rank_stop_cause  again, with the driver's reply (or the silence)
                                   ──► close_quietly   or   propose_action (one decision card)
```

| Step | Who | What it does | Costs |
| --- | --- | --- | --- |
| Stop rule | Plain code (`longStop` in `lib/stopcheck.ts`) | Fires when the car stays within 150 m for 20 min and the plan has no stop there | Nothing |
| Freshness | `get_gps` | A fix older than 60 min is not the current position: the agent asks the driver instead of trusting the place | Nothing |
| Places lookup | `nearby_places` | Google Places Nearby Search (New) around the fix, 400 m by default. Without `GOOGLE_MAPS_API_KEY`, the event's simulated places | One Places call |
| Ranking | `rank_stop_cause` → Jev | Two typed choice questions in one request: which place explains the stop (each place, or "none"), and what the cause is (normal break, breakdown, traffic, old GPS, unusual). Jev returns a probability for every option | About $0.00004, about 250 ms |
| Next step | Plain code (`nextStep`) | Turns the ranking and the facts into `close_quietly`, `ask_driver` or `card`. Code, not the model, so the policy is the same in every run and can be tested | Nothing |
| Driver | `message_driver` | The agent may message the driver without approval. A silent driver counts as an answer: "no reply in 15 min" | Nothing |
| Card | `propose_action` | One decision for a person: stop place and time, driver reply, arrival impact, one next step. A customer message is only a draft | A person's time |

**Second opinions from our own models.** When the model server runs (`MODEL_SERVER_URL`), `rank_stop_cause` asks the fine-tuned d1-3B and the fine-tuned Laya the same two questions at the same time as Jev. Only Jev's ranking drives the next step. The other two are shown next to it as "agrees" or "disagrees", per ranking round. On the BMW stop, before the driver answered:

| Model | Top place | Top cause | Time |
| --- | --- | --- | --- |
| Jev | Tyre shop 91% | Breakdown 89% | about 475 ms |
| d1-3B, fine-tuned | Tyre shop 68% | Breakdown 67% | about 157 ms |
| Laya, fine-tuned | None 85% | Old GPS 79% (wrong) | about 124 ms |

d1 is close to Jev on a question type it was never trained on. Laya, fine-tuned only on the trap questions, does not carry over. After the driver's reply, all three agree. The answers vary between runs, so the screens show each run's own numbers.

The policy, in words:

- **Close quietly** when Jev ranks a normal break at 60% or more, the top place is a fuel station, café, rest area or charger, the fix is fresh, and the arrival is safe. The agent does not message the driver.
- **Ask the driver** when the place is unusual, the position is old, Jev leans to a breakdown (a ranking is not proof), or the arrival is at risk and nobody has asked yet.
- **Card** when the driver reports a breakdown, the delivery is late after the driver answered, or the driver does not answer.

The rules from the brief stay in force. The agent never contacts a customer. Every cost, date or customer message needs a person. The approval limit (€0 by default) and the fact re-check before an approved action apply to these cards too.

## The three examples

All three use real orders from the packet. The stop points sit on real map locations, but the places and the driver replies are simulated.

### 1. Fuel stop, closed quietly (CD-420145, Porsche 911, Lahti → Helsinki, 21 Oct 09:00 UTC)

- The rule fires after 26 min at the E75 Renkomäki junction. The GPS fix is 2 min old.
- Places: Aster Road Fuel 24 m, Aster Road Café 49 m, E75 truck parking 205 m.
- Jev: Aster Road Fuel 79 to 81%, cause "normal break" 85 to 88%.
- The policy says `close_quietly`: the arrival stays inside the promise (13:00 UTC).
- **Result:** a log line, no driver message, no card. The live map marks the stop "Closed by the agent".

### 2. Unusual place, silent driver: card (CD-420338, Ferrari 296 GTB, Düsseldorf → Hamburg, 09:15 UTC)

- The rule fires after 22 min on a field track at Mastbruch near Heidenau, about 400 m from the A1. The fix is fresh, so the stop is real.
- Places within 400 m: a forest access track (141 m) and a closed farm shop (359 m). No fuel, food or rest area.
- First Jev ranking: cause "unusual" 73 to 75%. The policy says `ask_driver`.
- The agent asks: "Is everything OK with you and the car?" There is no answer in 15 min.
- Second Jev ranking, with the silence: "none of these places" 65 to 70%, unusual 70 to 82%. The policy says `card`.
- **Card:** "Ferrari stopped 22 min on a field track near the A1 and the driver does not answer. Call the driver now?" The proposal is `call_driver`. There is no customer message: the delivery is still on time, so there is nothing to tell the dealer yet.

### 3. Tyre puncture, delivery late: card (CD-420576, BMW M4, Tampere → Lahti, 09:40 UTC)

- The rule fires after 24 min at Salpakangas, Hollola, 9 km before Lahti.
- Places: Rengasvala Tyre Centre 39 m, a café 181 m, a fuel station 291 m.
- First Jev ranking: tyre shop 88 to 90%, cause "breakdown" 65 to 69%. That is not proof, so the policy says `ask_driver`.
- The driver answers: a nail in the rear left tyre, a new tyre from the warehouse at about 13:00 UTC, fitted by 13:30, about €290.
- `estimate_arrival` with 230 min of delay gives about 13:37 UTC, about 40 min after the promise. The chained gig (CD-420719, Oulu, 22 Oct) is not at risk.
- Second Jev ranking: tyre shop 100%, breakdown 100%. The policy says `card`.
- **Card:** "BMW M4 has a nail in a tyre at a shop in Hollola, about 40 min late. Approve €290 tyre and tell the dealer?" The proposal is `change_cost` with +€290 and a **drafted** message to Varnela Automotive. Nothing is paid or sent until a person approves.

## Where to see it

- **Live map** (`/live` in the starter app). Every car on the road at the clock time. A standing car pulses amber, red with a card, and a car without GPS is hollow. Select a stop to see the places numbered by Jev's rank, the cause bars and every agent step. To replay the day, set the clock to "21 Oct 08:55 UTC" in the top bar.
- **Decision card.** A stop card has a "The stop check" section with the stop map, the ranking and the steps.
- **Terminal.** `npm run stops` (in `control-room`) runs the three events at their own times in scripted mode and prints the places, Jev's ranking and the outcome. `npm run stops -- --llm` uses the live Claude agent. Use `STATE_DIR=<folder>` to keep it away from the demo state.

## Measured on 25 Oct 2026

| Run | Fuel stop | Ferrari | BMW |
| --- | --- | --- | --- |
| Scripted replay, real Jev | Quiet | Card | Card |
| Live agent (Claude Opus 5.5 through OpenRouter), real Jev | Quiet, no driver message | Card (asked first) | Card (asked first) |

## Real, simulated, not built

| Part | State |
| --- | --- |
| Stop rule on the car's track | Built and tested (`npm test`) |
| Google Places lookup | Built. Needs `GOOGLE_MAPS_API_KEY`. Without the key, or if Google fails, the simulated places are used and the screens say "Simulated" |
| Jev ranking | Real, through OpenRouter's Decisions API. Without a key, plain rule scores are used and labelled "rules", never "Jev" |
| Positions | The packet has no coordinates. Cars move on the straight line between cities. Stop points are hand-placed on real map locations |
| Driver replies | Simulated driver (Claude with a persona, or scripted text). The 15 min wait for a silent driver is shortened to a moment in the demo |
| Places on the route that are not stops (traffic jams, ferry queues) | Not built. The "traffic" cause exists, but no event uses it yet |
