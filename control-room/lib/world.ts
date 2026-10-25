import { addressLabel, data, Row } from "./data";
import { attachments, attachmentsFor, imageUrl } from "./vision";
import { scenarioForOrder } from "./scenarios";
import { addMinutes, id, minutesBetween, nowIso, State } from "./store";
import type { ChatMessage, GpsFix } from "./types";

// Mock tools for the on-the-road agent. They read the packet plus the simulated
// layer in state (driver chat, new GPS fixes). None of them changes a booking,
// a date, a cost or contacts a customer.

const AVG_KMH = 80;
const EV_CHARGE_EVERY_KM = 300;
const EV_CHARGE_MIN = 40;
const HANDOVER_BUFFER_MIN = 90;

function orderOrThrow(ref: string): Row {
  const o = data().order(ref);
  if (!o) throw new Error(`No order ${ref}`);
  return o;
}

export function datasetMessages(orderId: string): ChatMessage[] {
  return data()
    .forOrder("messages", orderId)
    .map((m) => ({
      id: m.id,
      orderId,
      at: m.authored_at,
      from: (["agent", "driver", "operator", "customer"].includes(m.author_type) ? m.author_type : "system") as ChatMessage["from"],
      channel: (m.channel === "internal_note" ? "internal_note" : m.channel === "customer_email" ? "customer_email" : "driver_chat") as ChatMessage["channel"],
      text: m.body,
      dataset: true,
    }));
}

export function allMessages(s: State, orderId: string): ChatMessage[] {
  return [...datasetMessages(orderId), ...s.chat.filter((c) => c.orderId === orderId)].sort((a, b) => a.at.localeCompare(b.at));
}

export function allFixes(s: State, orderId: string): GpsFix[] {
  const sc = scenarioForOrder(data().order(orderId)?.reference ?? "");
  const base: GpsFix[] = data()
    .forOrder("tracking_observations", orderId)
    .map((t) => ({
      id: t.id,
      orderId,
      observedAt: t.observed_at,
      receivedAt: t.received_at,
      distanceRemainingKm: t.distance_remaining_km ?? null,
      estimatedDeliveryAt: t.estimated_delivery_at ?? null,
      quality: t.location_quality,
      placeHint: sc?.placeHints[t.id],
    }));
  return [...base, ...s.fixes.filter((f) => f.orderId === orderId)].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
}

export function quotesFor(orderId: string): Row[] {
  const sc = scenarioForOrder(data().order(orderId)?.reference ?? "");
  return [...data().forOrder("travel_options", orderId), ...((sc?.simulatedQuotes as Row[]) ?? [])];
}

function age(s: State, iso: string) {
  const m = minutesBetween(iso, nowIso(s));
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} h ${m % 60} min ago`;
}

export function getOrder(s: State, input: { order_ref: string }) {
  const d = data();
  const o = orderOrThrow(input.order_ref);
  const veh = d.primaryVehicle(o.id);
  const asg = d.activeAssignment(o.id);
  const driver = d.get(asg?.driver_id);
  const customer = d.get(o.customer_id);
  const promise = d.deliveryPromise(o.id);
  const pickup = d.pickupSlot(o.id);
  const msgs = allMessages(s, o.id).slice(-8);
  return {
    order_ref: o.reference,
    status: o.status,
    route_kind: o.route_kind,
    customer: customer ? { id: customer.id, name: customer.name, note: "A customer. The agent never contacts a customer." } : null,
    car: veh ? { id: veh.id, make: veh.make, model: veh.model, fuel: veh.fuel, registration: veh.registration } : null,
    driver: driver ? { id: driver.id, name: driver.display_name, home_city: driver.home_city, note: "Home city is not a current location." } : null,
    assignment: asg ? { id: asg.id, status: asg.status, positioning: asg.positioning ?? null, driver_history: asg.driver_history ?? null } : null,
    pickup: { place: addressLabel(o.pickup_address_id), selected_slot: pickup ? { id: pickup.id, start: pickup.start_at, end: pickup.end_at, source: pickup.source } : null },
    delivery: {
      place: addressLabel(o.delivery_address_id),
      promise: promise ? { id: promise.id, start: promise.start_at, end: promise.end_at, source: promise.source, timezone: promise.timezone } : null,
    },
    chained_gigs: asg?.driver_id
      ? d.chainedGigs(asg.driver_id, o.id).map((g) => ({
          order_ref: g.order?.reference,
          assignment_id: g.id,
          pickup: addressLabel(g.order?.pickup_address_id),
          pickup_slot: g.pickup ? { start: g.pickup.start_at, end: g.pickup.end_at } : null,
        }))
      : [],
    previous_gig_of_this_driver: d.t.work_assignments
      .filter((a) => asg && a.driver_id === asg.driver_id && a.order_id !== o.id && a.status === "IN_PROGRESS")
      .map((a) => ({ order_ref: d.get(a.order_id)?.reference, assignment_id: a.id })),
    open_alerts: d.forOrder("alerts", o.id).filter((a) => a.status !== "RESOLVED").map((a) => ({ id: a.id, signal: a.signal, status: a.status, summary: a.summary, triggered_at: a.triggered_at })),
    open_incidents: d.forOrder("incidents", o.id).filter((i) => !i.resolved_at).map((i) => ({ id: i.id, kind: i.kind, status: i.status, reported_symptom: i.reported_symptom, recovery_decision: i.recovery_decision })),
    open_work_items: d.forOrder("work_items", o.id).filter((w) => w.status !== "DONE").map((w) => ({ id: w.id, kind: w.kind, next_action: w.next_action, due_at: w.due_at })),
    earlier_agent_proposals: d.forOrder("agent_proposals", o.id).map((p) => ({ id: p.id, status: p.status, summary: p.summary, review: p.review ? { decision: p.review.decision, note: p.review.decision_note } : null, execution_error: p.execution?.error ?? null })),
    recent_messages: msgs.map((m) => ({ id: m.id, at: m.at, from: m.from, channel: m.channel, text: m.text })),
    now: nowIso(s),
  };
}

export function getGps(s: State, input: { order_ref: string }) {
  const o = orderOrThrow(input.order_ref);
  const fixes = allFixes(s, o.id);
  const last = fixes.at(-1);
  if (!last) {
    return {
      order_ref: o.reference,
      last_fix: null,
      note: "No GPS fix. GPS starts only about 1 hour before pickup. Treat the position as unknown, not as a problem.",
    };
  }
  const minutes = minutesBetween(last.observedAt, nowIso(s));
  const prev = fixes.at(-2);
  return {
    order_ref: o.reference,
    last_fix: {
      id: last.id,
      observed_at: last.observedAt,
      received_at: last.receivedAt,
      age: age(s, last.observedAt),
      age_minutes: minutes,
      quality: last.quality,
      distance_remaining_km: last.distanceRemainingKm,
      app_eta: last.estimatedDeliveryAt,
      stale: minutes > 60 || last.quality === "STALE",
      position: last.lat != null && last.lng != null ? { lat: last.lat, lng: last.lng } : null,
    },
    previous_fix: prev ? { id: prev.id, observed_at: prev.observedAt, distance_remaining_km: prev.distanceRemainingKm } : null,
    note: "A GPS fix older than 60 minutes is not the current position. A driver message is not a fix. The app ETA is an estimate.",
  };
}

export function lookupPlace(s: State, input: { fix_id: string; order_ref?: string }) {
  let fixId = input.fix_id;
  if (fixId === "@latest" && input.order_ref) fixId = allFixes(s, orderOrThrow(input.order_ref).id).at(-1)?.id ?? "";
  const sim = s.fixes.find((f) => f.id === fixId);
  const ds = data().get(fixId);
  const sc = ds ? scenarioForOrder(data().get(ds.order_id)?.reference ?? "") : undefined;
  const hint = sim?.placeHint ?? sc?.placeHints[fixId];
  if (!hint) return { fix_id: fixId, place: null, note: "No place match for this fix. Ask the driver." };
  const kind = /fuel/i.test(hint) ? "fuel_station" : /rest area|Rasthof|services/i.test(hint) ? "rest_area" : /terminal/i.test(hint) ? "ferry_terminal_road" : "motorway";
  return { fix_id: fixId, place: hint, place_type: kind, note: "Simulated map lookup. The place is where the fix was, at the time of the fix." };
}

export function getTravelOptions(s: State, input: { order_ref: string }) {
  const o = orderOrThrow(input.order_ref);
  const reservations = data().forOrder("travel_reservations", o.id).map((r) => ({
    id: r.id,
    type: "BOOKING",
    kind: r.kind,
    status: r.status,
    booking_reference: r.booking_reference,
    departure_at: r.departure_at,
    check_in_cutoff_at: r.check_in_cutoff_at,
    expected_arrival_at: r.expected_arrival_at,
    check_in_confirmation: r.check_in_confirmation,
    boarding_confirmation: r.boarding_confirmation,
    amendment_request: r.amendment_request ?? null,
  }));
  const quotes = quotesFor(o.id).map((q) => ({
    id: q.id,
    type: q.status === "SOLD_OUT" ? "SOLD_OUT" : "QUOTE_NOT_BOOKED",
    kind: q.kind,
    provider: q.provider,
    from: q.from_city,
    to: q.to_city,
    departure_at: q.departure_at,
    check_in_cutoff_at: q.check_in_cutoff_at ?? null,
    arrival_at: q.arrival_at,
    price_eur: q.quote_cents != null ? q.quote_cents / 100 : null,
    checked_at: q.checked_at ?? nowIso(s),
    note: q.capacity_note,
  }));
  const attempts = data()
    .forOrder("agent_proposals", o.id)
    .filter((p) => String(p.command).startsWith("travel."))
    .map((p) => ({ id: p.id, command: p.command, status: p.status, error: p.execution?.error ?? null }));
  return {
    order_ref: o.reference,
    bookings: reservations,
    quotes,
    earlier_booking_attempts: attempts,
    note: "A quote is not a booking. Only a BOOKING row is a reservation. A booking does not prove check-in or boarding.",
  };
}

export function estimateArrival(s: State, input: { order_ref: string; extra_delay_minutes?: number; via_travel_option_id?: string; from_distance_km?: number }) {
  const d = data();
  const o = orderOrThrow(input.order_ref);
  const now = nowIso(s);
  const veh = d.primaryVehicle(o.id);
  const promise = d.deliveryPromise(o.id);
  const asg = d.activeAssignment(o.id);
  const last = allFixes(s, o.id).at(-1);
  const notes: string[] = [];

  let eta: string;
  const via = input.via_travel_option_id ? quotesFor(o.id).find((q) => q.id === input.via_travel_option_id) : undefined;
  if (via) {
    // Ferry arrival, then road time to the delivery city (about 3 h in the packet's notes).
    eta = addMinutes(via.arrival_at, 180);
    notes.push(`Uses ${via.kind} ${via.id} arriving ${via.arrival_at}, plus about 3 h by road. It is a quote, not a booking.`);
  } else {
    const km = input.from_distance_km ?? last?.distanceRemainingKm ?? null;
    if (km == null) {
      return { order_ref: o.reference, eta: null, note: "No distance known. GPS can be empty before the tracking window. Position is unknown." };
    }
    let minutes = (km / AVG_KMH) * 60;
    if (veh?.fuel === "electric") {
      const stops = Math.floor(km / EV_CHARGE_EVERY_KM);
      minutes += stops * EV_CHARGE_MIN;
      if (stops) notes.push(`Electric car: ${stops} charging stop(s) of ${EV_CHARGE_MIN} min.`);
    }
    minutes += input.extra_delay_minutes ?? 0;
    if (input.extra_delay_minutes) notes.push(`Includes ${input.extra_delay_minutes} min of extra delay.`);
    if (last && minutesBetween(last.observedAt, now) > 60) notes.push(`The distance comes from a fix ${age(s, last.observedAt)}. Treat the ETA as weak.`);
    eta = addMinutes(now, Math.round(minutes));
    // Be careful: never report an arrival earlier than the app's own estimate.
    if (last?.estimatedDeliveryAt && last.estimatedDeliveryAt > eta && !input.from_distance_km) {
      eta = last.estimatedDeliveryAt;
      notes.push("The app ETA is later than the road calculation, so the app ETA is used.");
    }
  }

  const minutesLate = promise ? Math.max(0, minutesBetween(promise.end_at, eta)) : null;
  const chained = asg?.driver_id
    ? d.chainedGigs(asg.driver_id, o.id).map((g) => {
        const free = addMinutes(eta, HANDOVER_BUFFER_MIN);
        const start = g.pickup?.start_at;
        const positioning = g.positioning;
        const reported = positioning?.driver_reported_earliest_departure_at;
        const atRisk = start ? free > start || (reported && reported > start) : false;
        return {
          order_ref: g.order?.reference,
          pickup_start: start ?? null,
          driver_free_from: free,
          driver_reported_earliest_departure: reported ?? null,
          at_risk: Boolean(atRisk),
          note: "Free time = ETA + 90 min handover buffer. It does not include travel or rest to the next pickup.",
        };
      })
    : [];

  return {
    order_ref: o.reference,
    eta,
    promise_end: promise?.end_at ?? null,
    minutes_late: minutesLate,
    late: (minutesLate ?? 0) > 0,
    chained_gigs: chained,
    notes,
  };
}

// Records a message to the driver. The simulated driver answers through driver.ts.
export function recordAgentMessage(s: State, orderId: string, text: string) {
  const msg: ChatMessage = { id: id("chat"), orderId, at: nowIso(s), from: "agent", channel: "driver_chat", text };
  s.chat.push(msg);
  return msg;
}

export function recordDriverReply(s: State, orderId: string, text: string) {
  // The reply lands a moment after the question, so the chat order stays clear.
  const msg: ChatMessage = { id: id("chat"), orderId, at: addMinutes(nowIso(s), 0.5), from: "driver", channel: "driver_chat", text };
  s.chat.push(msg);
  return msg;
}

export function addFix(s: State, orderId: string, fix: { minutesAgo: number; distanceRemainingKm: number; placeHint: string; etaMinutesFromNow: number; quality?: string; lat?: number; lng?: number }) {
  const at = addMinutes(nowIso(s), -fix.minutesAgo);
  const f: GpsFix = {
    id: id("fix"),
    orderId,
    observedAt: at,
    receivedAt: addMinutes(at, 1),
    distanceRemainingKm: fix.distanceRemainingKm,
    estimatedDeliveryAt: addMinutes(nowIso(s), fix.etaMinutesFromNow),
    quality: fix.quality ?? "COARSE",
    placeHint: fix.placeHint,
    simulated: true,
    lat: fix.lat,
    lng: fix.lng,
  };
  s.fixes.push(f);
  return f;
}

// A short digest of the facts a card depends on. If it changes after approval,
// the action does not run.
export function orderFingerprint(s: State, orderId: string) {
  const msgs = allMessages(s, orderId).filter((m) => m.from === "driver" || m.from === "customer").length;
  const fixes = allFixes(s, orderId).length;
  const asg = data().activeAssignment(orderId);
  const extra = s.timeline.filter((t) => t.orderId === orderId && t.text.startsWith("World change:")).length;
  return `m${msgs}-f${fixes}-a${asg?.status ?? "none"}-w${extra}`;
}

// ---------- Photos and scans ----------

export function listAttachments(s: State, input: { order_ref: string }) {
  const o = orderOrThrow(input.order_ref);
  const proofs = data().forOrder("proofs", o.id);
  return {
    order_ref: o.reference,
    files: attachmentsFor(o.reference).map((a) => {
      const proof = proofs.find((p) => p.id === a.recordId);
      return {
        attachment_id: a.id,
        kind: a.kind,
        file: a.file,
        record: `${a.recordType} ${a.recordId}`,
        record_status: a.status,
        review_note: proof?.review_note ?? null,
        captured_at: a.capturedAt ?? null,
        url: imageUrl(a.file),
      };
    }),
    note: "Use check_image to ask typed questions about a file. A photo shows what it shows at capture time; it does not prove who took it or when the damage happened.",
  };
}

// The comparison values come from the records, not from the agent, so a check
// cannot be steered by a wrong value in the agent's request.
export function imageContext(attachmentId: string) {
  const a = attachments().find((x) => x.id === attachmentId);
  if (!a) throw new Error(`No attachment ${attachmentId}`);
  const d = data();
  const items = d.t.order_items.filter((i) => i.order_id === a.orderId);
  const item = items.find((i) => i.role === (a.kind.startsWith("TRADE_IN") ? "TRADE_IN" : "PRIMARY")) ?? items[0];
  const veh = d.get(item?.vehicle_id);
  const ctx: Record<string, unknown> = {
    order_ref: d.get(a.orderId)?.reference,
    file_kind: a.kind,
    order_car: veh ? `${veh.make} ${veh.model}` : null,
    order_vin: veh?.synthetic_vin ?? null,
  };
  const exp = d.get(a.recordId);
  if (a.recordType === "expense" && exp) ctx.claimed_amount = `${exp.currency} ${(exp.amount_cents / 100).toFixed(2)}`;
  return { attachment: a, context: ctx };
}
