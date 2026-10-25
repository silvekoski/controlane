import { askJev, askModelServer, ageText, MODEL_SERVER_URL, type JevAnswer } from "./checks";
import { data } from "./data";
import { metres, type LatLng } from "./geo";
import { nearbyPlaces } from "./places";
import { scenarioForOrder } from "./scenarios";
import { addMinutes, minutesBetween, nowIso, readState, update, type State } from "./store";
import type { NearbyPlace, Ranked, StopCheck } from "./types";
import { allFixes, allMessages, estimateArrival } from "./world";

// The GPS stop check. A plain rule finds a long stop that is not in the plan. Then the agent
// does the cheap checks: what is near the stop (nearby_places), and what most likely caused it
// (rank_stop_cause: Jev ranks the places and the causes with probabilities). A code policy turns
// the ranking and the facts into the next step: close quietly, ask the driver, or make a card.

export const STOP_RULE = { radiusM: 150, minMinutes: 20 };
export const STOP_RULE_TEXT = `Not moved more than ${STOP_RULE.radiusM} m for ${STOP_RULE.minMinutes} min or more, and no stop in the plan`;

export type TrackPoint = { at: string; lat: number; lng: number };

/** The rule: the car stayed within the radius for at least the minimum time. Returns the stop start. */
export function longStop(points: TrackPoint[], nowAt: string, minMinutes = STOP_RULE.minMinutes): { since: string; minutes: number; at: LatLng } | null {
  const past = points.filter((p) => p.at <= nowAt).sort((a, b) => a.at.localeCompare(b.at));
  const last = past.at(-1);
  if (!last) return null;
  const here: LatLng = [last.lat, last.lng];
  let since = last.at;
  for (let i = past.length - 2; i >= 0; i--) {
    if (metres(here, [past[i].lat, past[i].lng]) > STOP_RULE.radiusM) break;
    since = past[i].at;
  }
  const minutes = minutesBetween(since, nowAt);
  return minutes >= minMinutes ? { since, minutes, at: here } : null;
}

const TYPE_LABEL: Record<string, string> = {
  fuel_station: "fuel station", ev_charging: "charging station", food: "café or restaurant", rest_area: "rest area", car_repair: "car repair or tyre shop",
  parking: "car park", hotel: "hotel", shop: "shop", medical: "medical", police: "police", industrial: "industrial site", farm: "farm", other: "other",
};
export const typeLabel = (t: string) => TYPE_LABEL[t] ?? t.replace(/_/g, " ");

const BREAK_TYPES = ["fuel_station", "ev_charging", "food", "rest_area", "hotel", "shop"];

export const CAUSES: Record<string, string> = {
  break: "A normal break: fuel, charging, food, a toilet stop or a rest the driver needs",
  breakdown: "A breakdown or damage: a warning light, a flat tyre, an accident, the car cannot go on",
  traffic: "Traffic, roadworks, or a queue at a border or ferry terminal",
  stale_gps: "The position is old: the app stopped sending, so the car may be moving",
  unusual: "Something unusual that a person should check: a stop far from any service, with no explanation",
};
export const CAUSE_LABEL: Record<string, string> = {
  break: "Normal break", breakdown: "Breakdown or damage", traffic: "Traffic or queue", stale_gps: "Old GPS signal", unusual: "Unusual, needs a check",
};

function placeLine(p: NearbyPlace) {
  const open = p.openNow == null ? "opening hours not known" : p.openNow ? "open now" : "closed now";
  return `${p.name}: ${typeLabel(p.type)}, ${p.distanceM} m from the GPS point, ${open}`;
}

// ---------- tool: nearby_places ----------

export async function nearbyPlacesTool(runId: string, input: { order_ref: string; radius_m?: number }) {
  const s = readState();
  const o = data().order(input.order_ref);
  if (!o) return { error: `No order ${input.order_ref}` };
  const fix = allFixes(s, o.id).at(-1);
  if (!fix || fix.lat == null || fix.lng == null) {
    return { order_ref: o.reference, places: [], note: "The last GPS fix has no coordinates, so there is nothing to look up. Ask the driver where they are." };
  }
  const run = s.runs.find((r) => r.id === runId);
  const stop = scenarioForOrder(o.reference)?.stop;
  const radius = Math.min(Math.max(input.radius_m ?? 400, 100), 1500);
  const found = await nearbyPlaces([fix.lat, fix.lng], radius, stop?.nearby ?? []);
  const now = nowIso(s);
  // The stop started when the rule's window started: the event says how long the car stood before the agent ran.
  const since = stop && run ? addMinutes(run.startedAt, -stop.minutes) : fix.observedAt;
  const check: StopCheck = {
    orderRef: o.reference,
    fixId: fix.id,
    lat: fix.lat,
    lng: fix.lng,
    stoppedSince: since,
    stoppedMinutes: minutesBetween(since, now),
    gpsAgeMinutes: minutesBetween(fix.observedAt, now),
    rule: STOP_RULE_TEXT,
    provider: found.provider,
    places: found.places,
  };
  update((st) => {
    const r = st.runs.find((x) => x.id === runId);
    if (r) r.stop = check;
  });
  return {
    order_ref: o.reference,
    fix_id: fix.id,
    position: { lat: fix.lat, lng: fix.lng },
    gps_age: ageText(check.gpsAgeMinutes),
    stopped_minutes: check.stoppedMinutes,
    rule: check.rule,
    provider: found.provider === "google" ? "Google Places" : "Simulated places (no Google key)",
    radius_m: radius,
    places: found.places.map((p) => ({ place_id: p.id, name: p.name, type: typeLabel(p.type), distance_m: p.distanceM, open_now: p.openNow })),
    note: [found.note, "A place near the car does not prove why it stopped. Call rank_stop_cause to rank the places and causes."].filter(Boolean).join(" "),
  };
}

// ---------- tool: rank_stop_cause ----------

type Ranking = NonNullable<StopCheck["ranking"]>;

function sortRanked(probs: Record<string, number>, label: (id: string) => string): Ranked[] {
  const total = Object.values(probs).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(probs)
    .map(([id, p]) => ({ id, label: label(id), probability: Math.round((p / total) * 1000) / 1000 }))
    .sort((a, b) => b.probability - a.probability);
}

const BREAKDOWN_WORDS = /flat|tyre|tire|puncture|warning|light|broke|engine|smoke|accident|crash|won'?t start|tow|mechanic|garage|leak/i;
const BREAK_WORDS = /fuel|petrol|diesel|coffee|toilet|break|lunch|food|charging|charge|rest|all fine|all good/i;

// Used only when Jev is not connected. Plain scores, shown as "rules", never as Jev.
function rulesRanking(check: StopCheck, chat: string[]): Pick<Ranking, "places" | "causes"> {
  const prior: Record<string, number> = { fuel_station: 0.9, ev_charging: 0.9, food: 0.8, rest_area: 0.8, car_repair: 0.6, parking: 0.5, shop: 0.5, hotel: 0.4, other: 0.2, industrial: 0.15, farm: 0.1 };
  const placeScores: Record<string, number> = {};
  for (const p of check.places) placeScores[p.id] = (prior[p.type] ?? 0.2) * Math.exp(-p.distanceM / 250) * (p.openNow === false ? 0.3 : 1);
  placeScores.none = 0.15 + (check.places.some((p) => p.distanceM <= STOP_RULE.radiusM) ? 0 : 0.6);
  const driver = chat.join(" ");
  const top = sortRanked(placeScores, (x) => x)[0];
  const topType = check.places.find((p) => p.id === top?.id)?.type;
  const causes: Record<string, number> = { break: 0.1, breakdown: 0.1, traffic: 0.05, stale_gps: 0.05, unusual: 0.1 };
  if (check.gpsAgeMinutes > 60) causes.stale_gps += 1;
  if (BREAKDOWN_WORDS.test(driver)) causes.breakdown += 1.2;
  else if (BREAK_WORDS.test(driver)) causes.break += 1.2;
  if (topType && BREAK_TYPES.includes(topType)) causes.break += 0.8;
  else if (topType === "car_repair") causes.breakdown += 0.5;
  else causes.unusual += 0.7;
  return { places: sortRanked(placeScores, (id) => labelOfPlace(check, id)), causes: sortRanked(causes, (id) => CAUSE_LABEL[id]) };
}

function labelOfPlace(check: StopCheck, id: string) {
  if (id === "none") return "None of these places";
  return check.places.find((p) => p.id === id)?.name ?? id;
}

/** The next step from the facts and the ranking. Plain code, so the policy is the same in every run. */
export function nextStep(check: StopCheck, r: Pick<Ranking, "places" | "causes">, x: { minutesLate: number | null; asked: boolean; replied: boolean }) {
  const cause = r.causes[0];
  const place = r.places[0];
  const placeType = check.places.find((p) => p.id === place?.id)?.type;
  if (x.replied && cause?.id === "breakdown") return { step: "card", why: "The driver reports a breakdown or damage. A person decides the recovery." };
  if ((x.minutesLate ?? 0) > 0 && x.replied) return { step: "card", why: `The delivery is about ${x.minutesLate} min late. A person decides what to tell the customer.` };
  if (x.asked && !x.replied) return { step: "card", why: "The agent asked the driver and got no answer. A person calls the driver." };
  if (check.gpsAgeMinutes > 60) return { step: "ask_driver", why: "The GPS position is more than 1 hour old. Ask the driver where they are and to open the app." };
  const quiet = cause?.id === "break" && cause.probability >= 0.6 && placeType && BREAK_TYPES.includes(placeType) && (x.minutesLate ?? 0) === 0;
  if (quiet) return { step: "close_quietly", why: `A normal break at a ${typeLabel(placeType!)}, the position is fresh and the arrival is safe. Log it, do not message the driver.` };
  if (x.replied && cause?.id === "break" && (x.minutesLate ?? 0) === 0) return { step: "close_quietly", why: "The driver explains a normal break and the arrival is safe." };
  if (!x.asked && cause?.id === "breakdown") return { step: "ask_driver", why: `Jev ranks a breakdown most likely${place && place.id !== "none" ? ` (${place.label} first)` : ""}. A ranking is not proof: ask the driver if they are OK and what happened.` };
  if (!x.asked) return { step: "ask_driver", why: `No place clearly explains the stop (top cause: ${CAUSE_LABEL[cause?.id ?? "unusual"]}). Ask the driver if everything is fine.` };
  return { step: "card", why: "The facts still do not explain the stop. A person checks." };
}

export async function rankStopCauseTool(runId: string, input: { order_ref: string }) {
  const s = readState();
  const o = data().order(input.order_ref);
  if (!o) return { error: `No order ${input.order_ref}` };
  const run = s.runs.find((r) => r.id === runId);
  const check = run?.stop;
  if (!check) return { error: "Call nearby_places first: there are no places to rank yet." };
  const now = nowIso(s);
  const chat = allMessages(s, o.id).filter((m) => m.channel === "driver_chat" && m.at >= check.stoppedSince);
  const asked = chat.some((m) => m.from === "agent" || m.from === "operator");
  const replied = chat.some((m) => m.from === "driver");
  const arrival = estimateArrival(s, { order_ref: o.reference });
  const veh = data().primaryVehicle(o.id);
  const ids = check.places.slice(0, 6).map((p, i) => ({ key: `p${i + 1}`, place: p }));

  const state = {
    decision_time: now,
    car: veh ? `${veh.make} ${veh.model}, ${veh.fuel}` : "unknown",
    stop: { stopped_for: `${minutesBetween(check.stoppedSince, now)} min`, in_the_plan: "no planned stop here", gps_position_age: ageText(check.gpsAgeMinutes) },
    arrival: { estimate: arrival.eta, promise_end: arrival.promise_end, minutes_late: arrival.minutes_late },
    nearby_places: check.places.slice(0, 6).map(placeLine),
    driver_chat_since_stop: chat.length ? chat.map((m) => `${m.from} at ${m.at.slice(11, 16)} UTC: ${m.text}`) : ["No messages since the stop started."],
    driver_was_asked_and_did_not_answer: asked && !replied,
  };
  const questions = {
    stop_place: {
      type: "choice",
      instructions: "Which place near the GPS point most likely explains why the car stopped here?",
      criteria: {
        ...Object.fromEntries(ids.map(({ key, place }) => [key, placeLine(place)])),
        none: "None of these places: the car stopped at the roadside, in traffic, or somewhere with no reason to stop",
      },
    },
    stop_cause: { type: "choice", instructions: "What is the most likely cause of this long stop?", criteria: CAUSES },
  };

  const probs = (a: JevAnswer | undefined) => (a && a.type === "choice" ? a.probabilities ?? { [a.choice]: a.confidence } : {});
  const placeIds = (p: Record<string, number>) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k === "none" ? "none" : ids.find((x) => x.key === k)?.place.id ?? k, v]));
  // A second opinion from our fine-tuned models on the model server, asked at the same time as Jev.
  const SECOND = [{ model: "d1_ft", label: "d1-3B, fine-tuned" }, { model: "laya_ft", label: "Laya, fine-tuned" }] as const;
  const second = MODEL_SERVER_URL
    ? Promise.all(SECOND.map(async (m) => {
        try {
          const r = await askModelServer(m.model, state, questions);
          return { ...m, places: sortRanked(placeIds(probs(r.answers.stop_place)), (id) => labelOfPlace(check, id)), causes: sortRanked(probs(r.answers.stop_cause), (id) => CAUSE_LABEL[id] ?? id), ms: Math.round(r.ms), costUsd: r.costUsd };
        } catch (e) {
          return { ...m, places: [], causes: [], ms: 0, error: (e as Error).message.slice(0, 120) };
        }
      }))
    : Promise.resolve([]);

  let ranking: Ranking;
  try {
    const jev = await askJev(state, questions);
    if (!jev) throw new Error("not connected");
    const placeProbs = placeIds(probs(jev.answers.stop_place));
    ranking = {
      model: jev.model,
      places: sortRanked(placeProbs, (id) => labelOfPlace(check, id)),
      causes: sortRanked(probs(jev.answers.stop_cause), (id) => CAUSE_LABEL[id] ?? id),
      ms: Math.round(jev.ms),
      costUsd: jev.costUsd,
      rankedAt: now,
      driverReplySeen: replied,
    };
  } catch (e) {
    const t0 = performance.now();
    const r = rulesRanking(check, chat.filter((m) => m.from === "driver").map((m) => m.text));
    ranking = { model: "rules", ...r, ms: Math.round(performance.now() - t0), rankedAt: now, driverReplySeen: replied };
    if ((e as Error).message !== "not connected") ranking.model = `rules (Jev failed: ${(e as Error).message.slice(0, 80)})`;
  }
  ranking.others = await second;
  const next = nextStep(check, ranking, { minutesLate: arrival.minutes_late ?? null, asked, replied });
  update((st) => {
    const r = st.runs.find((x) => x.id === runId);
    if (r?.stop) r.stop.ranking = ranking;
  });
  return {
    order_ref: o.reference,
    ranked_by: ranking.model.startsWith("rules") ? "Plain rules (Jev is not connected)" : `Jev (${ranking.model})`,
    places: ranking.places.map((p) => ({ place_id: p.id, name: p.label, probability: p.probability })),
    causes: ranking.causes.map((c) => ({ cause: c.id, label: c.label, probability: c.probability })),
    arrival: { eta: arrival.eta, minutes_late: arrival.minutes_late, chained_gigs: arrival.chained_gigs },
    second_opinions: ranking.others.filter((o) => !o.error).map((o) => ({ model: o.label, top_place: o.places[0]?.label, top_cause: o.causes[0]?.label, agrees_with_jev: o.causes[0]?.id === ranking.causes[0]?.id })),
    next_step: next.step,
    why: next.why,
    note: "The ranking is a likelihood, not proof. The next step is the code policy: close quietly only when a normal break is likely, the position is fresh and the arrival is safe.",
  };
}

export function stopOf(s: State, runId: string | undefined) {
  return runId ? s.runs.find((r) => r.id === runId)?.stop : undefined;
}
