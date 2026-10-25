import { addressLabel, data } from "./data";
import { hasClaude, llmProvider } from "./llm";
import { checkerIsOff, modelCheckers } from "./checks";
import { visualCheckers } from "./visual";
import { LIVE_QUESTIONS } from "./questions";
import { SCENARIOS } from "./scenarios";
import { minutesBetween, nowIso, readState, type State } from "./store";
import type { AgentRun, CheckResult, DecisionCard, TypedQuestion } from "./types";
import { allFixes } from "./world";

// Read models for the screens. Plain words, no internal codes.

export function fmtAge(iso: string, now: string) {
  const m = minutesBetween(iso, now);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ${m % 60 ? `${m % 60} min ` : ""}ago`;
  return `${Math.floor(h / 24)} days ago`;
}

export function fmtLeft(iso: string, now: string) {
  const m = minutesBetween(now, iso);
  if (m <= 0) return { text: "Overdue", tone: "critical" as const };
  const tone = m < 90 ? ("critical" as const) : m < 6 * 60 ? ("warn" as const) : ("calm" as const);
  if (m < 60) return { text: `${m} min left`, tone };
  const h = Math.floor(m / 60);
  if (h < 48) return { text: `${h} h ${m % 60} min left`, tone };
  return { text: `${Math.floor(h / 24)} days left`, tone };
}

export function fmtTime(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const t = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${day}, ${t} UTC`;
}

export function fmtClock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

export const SOURCE_LABEL: Record<string, string> = {
  gps: "GPS",
  driver_chat: "Driver chat",
  order: "Order",
  site: "Site",
  operator: "Ops note",
  app: "Agent log",
  tool: "Lookup",
};

export function orderBasics(ref: string) {
  const d = data();
  const o = d.order(ref)!;
  const veh = d.primaryVehicle(o.id);
  const asg = d.activeAssignment(o.id);
  const driver = d.get(asg?.driver_id);
  const customer = d.get(o.customer_id);
  const promise = d.deliveryPromise(o.id);
  return {
    ref: o.reference,
    id: o.id,
    status: o.status as string,
    car: veh ? `${veh.make} ${veh.model}` : "Car not recorded",
    fuel: veh?.fuel as string | undefined,
    customer: customer?.name ?? "Unknown customer",
    driver: driver?.display_name ?? "No driver booked",
    pickup: addressLabel(o.pickup_address_id),
    delivery: addressLabel(o.delivery_address_id),
    promise,
    routeKind: o.route_kind as string,
  };
}

// The facts Bahn needs on every card: customer, driver, position, arrival, late, chained gig.
export function cardContext(s: State, card: DecisionCard) {
  const b = orderBasics(card.orderRef);
  const run = s.runs.find((r) => r.id === card.runId);
  const est = [...(run?.steps ?? [])].reverse().find((st) => st.kind === "tool" && st.tool === "estimate_arrival");
  const out = (est && est.kind === "tool" ? est.output : undefined) as
    | { order_ref?: string; eta?: string; late?: boolean; minutes_late?: number; chained_gigs?: { order_ref: string; at_risk: boolean; pickup_start: string }[] }
    | undefined;
  const lastFix = allFixes(s, card.orderId).at(-1);
  const now = nowIso(s);
  // A GPS fact first: on a stop card, "Places nearby" is a lookup, not the position.
  const posFact = card.facts.find((f) => f.source === "gps" && /position|place|gate|stop/i.test(f.label)) ?? card.facts.find((f) => /position|place|gate/i.test(f.label));
  const chained = out?.chained_gigs?.find((g) => g.at_risk);
  return {
    ...b,
    position: posFact
      ? `${posFact.value} (${SOURCE_LABEL[posFact.source]}, ${fmtAge(posFact.observedAt, now)})`
      : lastFix
        ? `${lastFix.placeHint ?? `${lastFix.distanceRemainingKm ?? "?"} km to go`} (GPS, ${fmtAge(lastFix.observedAt, now)})`
        : b.status === "IN_TRANSIT" ? "Unknown" : "Not tracked yet: GPS starts about 1 h before pickup",
    // The estimate can be for the driver's current gig when this card is about the next one.
    eta: out?.eta ? `${out.order_ref && out.order_ref !== card.orderRef ? `Current gig ${out.order_ref}: ` : ""}${fmtTime(out.eta)}` : "Not calculated",
    late: out?.late ? `Yes, about ${Math.floor((out.minutes_late ?? 0) / 60)} h ${(out.minutes_late ?? 0) % 60} min` : out ? "No" : "Not known",
    chained: chained
      ? chained.order_ref === card.orderRef
        ? `This pickup is at risk (${fmtTime(chained.pickup_start)})`
        : `${chained.order_ref} at risk (pickup ${fmtTime(chained.pickup_start)})`
      : out?.chained_gigs?.length ? "Not at risk" : "None",
  };
}

export function queue(s: State) {
  const open = s.cards.filter((c) => c.status === "new" || c.status === "changed").sort((a, b) => a.deadline.localeCompare(b.deadline));
  const decided = s.cards.filter((c) => !(c.status === "new" || c.status === "changed")).sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""));
  const running = s.runs.filter((r) => r.status === "running");
  const failed = s.runs.filter((r) => r.status === "failed").slice(-3);
  const active = data().t.orders.filter((o) => !o.cancelled_at && o.status !== "DELIVERED");
  const needOrders = new Set([...open.map((c) => c.orderId), ...running.map((r) => r.orderId)]);
  return {
    open,
    decided,
    running,
    failed,
    quiet: [...s.quietLog].reverse(),
    totalOrders: data().t.orders.length,
    activeOrders: active.length,
    onTrack: active.filter((o) => !needOrders.has(o.id)).length,
    deliveredOrDone: data().t.orders.length - active.length,
  };
}

// Who must answer before the case can move. Bahn named three levels: the agent alone,
// a decision by ops, and new information from the dealer or the customer.
export type Escalation = { level: "agent" | "ops" | "outside"; text: string };

export function escalation(card: DecisionCard): Escalation {
  if (card.decidedBy?.startsWith("Agent")) return { level: "agent", text: "The agent acted alone" };
  const p = card.proposal;
  if (p.kind === "message_customer" || p.kind === "call_dealer" || p.customerDraft) return { level: "outside", text: "Needs the dealer or customer" };
  return { level: "ops", text: "Ops decides" };
}

export const KIND_LABEL: Record<string, string> = {
  long_stop: "Long stop",
  gps_gap: "GPS gap",
  warning_light: "Warning light or breakdown",
  ferry_risk: "Ferry at risk",
  sold_out: "Ferry sold out",
  late_driver: "Late driver, chained gig",
  photo_check: "Photo check",
  receipt_check: "Receipt check",
};

export function cardKind(s: State, card: DecisionCard) {
  const run = s.runs.find((r) => r.id === card.runId);
  const kind = SCENARIOS.find((sc) => sc.id === run?.scenarioId)?.kind ?? "other";
  return { kind, label: KIND_LABEL[kind] ?? "Other" };
}

export function lastStepLine(run: AgentRun) {
  const st = run.steps.at(-1);
  if (!st) return "Starting…";
  if (st.kind === "tool") return TOOL_LABEL[st.tool] ?? st.tool;
  if (st.kind === "driver") return `Driver replied: “${st.text.slice(0, 80)}${st.text.length > 80 ? "…" : ""}”`;
  return st.text;
}

export const TOOL_LABEL: Record<string, string> = {
  get_order: "Read the order",
  get_gps: "Checked the GPS",
  lookup_place: "Looked up the place",
  message_driver: "Messaged the driver",
  get_travel_options: "Read ferry and train options",
  estimate_arrival: "Calculated the arrival",
  check_photos: "Checked the photos",
  propose_action: "Made a decision card",
  close_quietly: "Closed the event",
};

export function scenarioStatus(s: State) {
  return SCENARIOS.map((sc) => {
    const runs = s.runs.filter((r) => r.scenarioId === sc.id);
    return { ...sc, lastRun: runs.at(-1) };
  });
}

export function system() {
  const { configured, missing } = modelCheckers();
  const on = configured.filter((c) => !checkerIsOff(c.model));
  return { claude: hasClaude(), provider: llmProvider(), checkers: on.map((c) => c.label), missingCheckers: missing };
}

// The decision models, for the model settings: which are connected, which are on,
// and how each one scored on the honest tests, so an operator can choose.
export function modelsView(s: State = readState()) {
  const score = (set: string, model: string) => {
    const r = s.benchmarks?.[set]?.rows.find((x) => x.model === model && x.status === "measured");
    return r ? { catchRate: r.catchRate ?? null, falseAlarmRate: r.falseAlarmRate ?? null, msPerCheck: r.msPerCheck ?? null } : null;
  };
  const text = modelCheckers();
  const photo = visualCheckers();
  const row = (kind: "text" | "photo", model: string, label: string, connected: boolean, why?: string) => ({
    kind, model, label, connected, on: connected && !checkerIsOff(model as never), why: why ?? null,
    score: kind === "text" ? score("synthetic_ood", model) : score("vision", model.replace(/_vision$/, "")),
  });
  return {
    models: [
      ...text.configured.map((m) => row("text", m.model, m.label, true)),
      ...text.missing.map((m) => row("text", m.model, m.label, false, m.why)),
      ...photo.configured.map((m) => row("photo", m.model, m.label, true)),
      ...photo.missing.filter((m) => m.model !== "selfjev" && m.model !== "d1").map((m) => row("photo", m.model, m.label, false, m.why)),
    ],
    imageModel: s.settings.imageModel ?? "auto",
  };
}

export function state() {
  return readState();
}

// Jev's result on one card. "unsure": Jev gave a trap answer below the warning limit.
export type JevMark = "trap" | "unsure" | "ok";

export function jevMark(c: CheckResult, extra: TypedQuestion[] = []): JevMark {
  if (c.flagged) return "trap";
  const q = [...LIVE_QUESTIONS, ...extra].find((x) => x.id === c.questionId);
  return q?.trapAnswers.includes(c.answer) ? "unsure" : "ok";
}

export function jevSummary(card: DecisionCard) {
  const checks = card.checks.filter((c) => c.model === "jev");
  const traps = checks.filter((c) => c.flagged).length;
  const ms = checks.reduce((t, c) => t + c.ms, 0);
  const cost = checks.reduce((t, c) => t + (c.costUsd ?? 0), 0);
  return { checked: checks.length > 0, questions: checks.length, traps, ms, cost };
}
