import { data, SNAPSHOT_AT } from "./data";
import { alongPath, cityPosition, metres, pathLength, type LatLng } from "./geo";
import { FIRE_WINDOW_MIN } from "./feed";
import { SCENARIOS, type Scenario } from "./scenarios";
import { clockNowMs, minutesBetween, type State } from "./store";
import { longStop, type TrackPoint } from "./stopcheck";
import type { AgentRun, StopCheck } from "./types";

// The live map. The packet has GPS observations (time, distance left, progress) but no
// coordinates, so each car moves on the straight line between its pickup and delivery city,
// at the progress its observations and app ETA give. A long-stop event puts the car on its
// real stop point, and the stop rule runs on the car's track, as it would on real GPS.

const SPEED_MS = 80_000 / 3600; // 80 km/h on the map line
const SIGNAL_LOST_MIN = 60;

export type CarStatus = "moving" | "stopped" | "signal_lost" | "arrived";

export type Car = {
  orderId: string;
  orderRef: string;
  driver: string;
  car: string;
  customer: string;
  from: { city: string; at: LatLng };
  to: { city: string; at: LatLng };
  path: LatLng[];
  at: LatLng;
  status: CarStatus;
  gpsAgeMin: number;
  stoppedSince?: string;
  stoppedMinutes?: number;
  ruleFired?: boolean; // the stop rule fired: standing for the rule's minimum time
  standingMinutes?: number; // standing, but not long enough for the rule yet
  eta?: string | null;
  event?: {
    scenarioId: string;
    title: string;
    kind: Scenario["kind"];
    runId?: string;
    runStatus?: AgentRun["status"];
    cardId?: string;
    quietReason?: string;
    stop?: StopCheck;
  };
};

function iso(ms: number) {
  return new Date(ms).toISOString();
}

// Progress (0 to 1) from the packet's observations: the last one before t, then on toward the app ETA.
function progressAt(orderId: string, t: number): { p: number; p0: number; lastObs?: string; eta?: string } | null {
  const obs = data()
    .forOrder("tracking_observations", orderId)
    .filter((o) => o.progress_fraction != null)
    .sort((a, b) => a.observed_at.localeCompare(b.observed_at));
  if (!obs.length) return null;
  const before = obs.filter((o) => Date.parse(o.observed_at) <= t);
  const last = before.at(-1) ?? obs[0];
  const p0 = Number(last.progress_fraction);
  const eta = last.estimated_delivery_at ? Date.parse(last.estimated_delivery_at) : NaN;
  const t0 = Date.parse(last.observed_at);
  if (!before.length || Number.isNaN(eta) || eta <= t0) return { p: p0, p0, lastObs: last.observed_at, eta: last.estimated_delivery_at };
  return { p: Math.min(1, p0 + (1 - p0) * ((t - t0) / (eta - t0))), p0, lastObs: last.observed_at, eta: last.estimated_delivery_at };
}

// A stop event's car: on the way to the stop point, standing there, then (if it resumes) on to the delivery.
function stopTrack(sc: Scenario, path: LatLng[], startedAtMs: number, t: number): LatLng {
  const stop = sc.stop!;
  const stopAt: LatLng = [stop.lat, stop.lng];
  const toStop = metres(path[0], stopAt);
  const stopStart = startedAtMs - stop.minutes * 60_000;
  const resume = stop.resumesAfterMin != null ? startedAtMs + stop.resumesAfterMin * 60_000 : Infinity;
  if (t < stopStart) return alongPath(path, toStop - SPEED_MS * ((stopStart - t) / 1000));
  if (t <= resume) return stopAt;
  return alongPath(path, toStop + SPEED_MS * ((t - resume) / 1000));
}

export function cars(view: State): Car[] {
  const d = data();
  const t = clockNowMs(view.clock);
  const nowIso = iso(t);
  const out: Car[] = [];
  for (const o of d.t.orders) {
    if (o.status !== "IN_TRANSIT") continue;
    const asg = d.activeAssignment(o.id);
    if (!asg || asg.status !== "IN_PROGRESS") continue;
    const pick = d.get(o.pickup_address_id);
    const drop = d.get(o.delivery_address_id);
    const from = cityPosition(pick?.city, pick?.country);
    const to = cityPosition(drop?.city, drop?.country);
    if (!from || !to) continue;
    const veh = d.primaryVehicle(o.id);
    const sc = SCENARIOS.find((x) => x.orderRef === o.reference && x.kind !== "photo_check" && x.kind !== "receipt_check");
    const run = sc ? view.runs.filter((r) => r.scenarioId === sc.id).at(-1) : undefined;
    const base = {
      orderId: o.id,
      orderRef: o.reference,
      driver: d.get(asg.driver_id)?.display_name ?? "Unknown driver",
      car: veh ? `${veh.make} ${veh.model}` : "Car",
      customer: d.get(o.customer_id)?.name ?? "",
      from: { city: pick!.city, at: from },
      to: { city: drop!.city, at: to },
    };
    const event = sc
      ? { scenarioId: sc.id, title: sc.title, kind: sc.kind, runId: run?.id, runStatus: run?.status, cardId: run?.cardId, quietReason: run?.quietReason, stop: run?.stop }
      : undefined;

    // A long-stop event: the track goes through the stop point, and the stop rule reads the track.
    // An event that was missed (the clock passed it with no run) has no stop: the car drove on.
    const missed = sc?.stop && !run && t - Date.parse(sc.at) > FIRE_WINDOW_MIN * 60_000;
    if (sc?.stop && !missed) {
      const path: LatLng[] = [from, [sc.stop.lat, sc.stop.lng], to];
      const started = Date.parse(run?.startedAt ?? sc.at);
      const points: TrackPoint[] = [];
      for (let m = 90; m >= 0; m -= 2) {
        const at = stopTrack(sc, path, started, t - m * 60_000);
        points.push({ at: iso(t - m * 60_000), lat: at[0], lng: at[1] });
      }
      const here = stopTrack(sc, path, started, t);
      // The rule needs 20 min. Before that, the map already shows the car standing.
      const rule = longStop(points, nowIso);
      const standing = longStop(points, nowIso, 4);
      const arrived = metres(here, to) < 500;
      out.push({
        ...base, path, at: here, gpsAgeMin: 1, event,
        status: arrived ? "arrived" : standing ? "stopped" : "moving",
        stoppedSince: standing?.since, stoppedMinutes: standing?.minutes,
        ruleFired: Boolean(rule),
        eta: null,
      });
      continue;
    }

    const path: LatLng[] = [from, to];
    const fixes = view.fixes.filter((f) => f.orderId === o.id);
    const prog = progressAt(o.id, t);
    // No GPS yet is normal before the tracking window: the car is not on the map.
    if (!prog && !fixes.length) continue;
    const { p, p0: lastP, lastObs, eta } = prog ?? { p: 0, p0: 0 };
    // A car whose packet signal was already old at the snapshot stays where it was last seen,
    // until a newer simulated fix (for example after the driver reopens the app) comes in.
    const lastSim = fixes.at(-1);
    const lostAtSnapshot = lastObs ? minutesBetween(lastObs, SNAPSHOT_AT) > SIGNAL_LOST_MIN : false;
    if (lostAtSnapshot && !lastSim) {
      const age = minutesBetween(lastObs!, nowIso);
      out.push({ ...base, path, at: alongPath(path, pathLength(path) * lastP), status: "signal_lost", gpsAgeMin: age, eta, event });
      continue;
    }
    let progress = p;
    if (lastSim?.distanceRemainingKm != null) {
      // Fresh simulated fix: progress from the distance left, then on toward the fix's ETA.
      const totalKm = pathLength(path) / 1000;
      const p0 = Math.max(0, Math.min(1, 1 - lastSim.distanceRemainingKm / Math.max(totalKm, lastSim.distanceRemainingKm + 1)));
      const t0 = Date.parse(lastSim.observedAt);
      const e = lastSim.estimatedDeliveryAt ? Date.parse(lastSim.estimatedDeliveryAt) : t0 + 3 * 3600_000;
      progress = Math.min(1, p0 + (1 - p0) * Math.max(0, (t - t0) / Math.max(e - t0, 60_000)));
    }
    out.push({
      ...base, path, at: alongPath(path, pathLength(path) * progress),
      status: progress >= 1 ? "arrived" : "moving",
      gpsAgeMin: lastSim ? minutesBetween(lastSim.observedAt, nowIso) : 1,
      eta: lastSim?.estimatedDeliveryAt ?? eta, event,
    });
  }
  return out;
}

/** The stop check of a run as steps for a person: the rule, the places, Jev's ranking, the driver, the outcome. */
export function stopSteps(run: AgentRun | undefined) {
  if (!run) return [];
  const steps: { at: string; kind: "rule" | "places" | "ranking" | "ask" | "reply" | "outcome"; text: string; detail?: unknown }[] = [];
  steps.push({ at: run.startedAt, kind: "rule", text: run.trigger });
  for (const st of run.steps) {
    if (st.kind === "tool" && st.tool === "nearby_places") steps.push({ at: st.at, kind: "places", text: "Looked up the places around the stop", detail: st.output });
    if (st.kind === "tool" && st.tool === "rank_stop_cause") steps.push({ at: st.at, kind: "ranking", text: "Jev ranked the places and the cause", detail: st.output });
    if (st.kind === "tool" && st.tool === "message_driver") steps.push({ at: st.at, kind: "ask", text: String((st.input as { text?: string })?.text ?? "") });
    if (st.kind === "driver") steps.push({ at: st.at, kind: "reply", text: st.text });
    if (st.kind === "outcome") steps.push({ at: st.at, kind: "outcome", text: st.text });
  }
  return steps;
}
