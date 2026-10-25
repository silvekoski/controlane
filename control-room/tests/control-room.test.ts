import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

// Tests use their own state folder, so they never touch the demo state.
process.env.STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "control-room-test-"));
process.env.ANTHROPIC_API_KEY = ""; // empty values stop dotenv from loading real keys
process.env.OPENROUTER_API_KEY = "";
process.env.MODEL_SERVER_URL = ""; // the fine-tuned model server must not answer in tests

const { codeAnswer, runCardChecks } = await import("../lib/checks");
const { runToEnd } = await import("../lib/agent");
const { approveCard, simulateWorldChange } = await import("../lib/decisions");
const { readState, resetState } = await import("../lib/store");
const { getGps, getTravelOptions } = await import("../lib/world");
const { SCENARIOS } = await import("../lib/scenarios");

resetState(false);

test("GPS older than 60 minutes is marked stale", () => {
  const out = getGps(readState(), { order_ref: "CD-420322" });
  assert.equal(out.last_fix?.stale, true);
  assert.ok((out.last_fix?.age_minutes ?? 0) >= 240);
});

test("missing GPS is unknown, not a problem", () => {
  const out = getGps(readState(), { order_ref: "CD-420735" });
  assert.equal(out.last_fix, null);
  assert.match(out.note, /unknown, not as a problem/);
});

test("travel tools keep quotes apart from bookings", () => {
  const out = getTravelOptions(readState(), { order_ref: "CD-420299" });
  assert.equal(out.bookings.length, 0);
  assert.ok(out.quotes.some((q) => q.type === "QUOTE_NOT_BOOKED"));
  assert.ok(out.quotes.some((q) => q.type === "SOLD_OUT"));
});

test("code check blocks a direct customer message", async () => {
  const checks = await runCardChecks({
    at: "2026-10-21T09:00:00Z",
    state: [],
    action: "Email the dealer now that the delivery is late.",
    proposal: { kind: "message_customer", description: "Email the dealer", needsApproval: false },
  });
  assert.ok(checks.some((c) => c.questionId === "customer_contact" && c.blocking));
});

test("a drafted customer message for a person is allowed", () => {
  const a = codeAnswer("customer_contact", { at: "2026-10-21T09:00:00Z", state: [], action: "Call the dealer. Customer draft attached for the operator to send after approval." });
  assert.equal(a?.answer, "no");
});

for (const sc of SCENARIOS) {
  test(`scripted agent: ${sc.id} ends as ${sc.expected}`, async () => {
    const run = await runToEnd(sc.id, { forceScripted: true });
    assert.equal(run.status, sc.expected === "quiet" ? "quiet" : "card");
  });
}

test("the ferry card warns that the night crossing is only a quote", () => {
  const card = readState().cards.find((c) => c.orderRef === "CD-420603")!;
  assert.ok(card.checks.some((c) => c.flagged && /only a quote/.test(c.message)));
});

test("approval stops when a fact changed after the card was made", () => {
  const card = readState().cards.find((c) => c.orderRef === "CD-420322" && c.status === "new")!;
  simulateWorldChange("CD-420322", "Update: please call me first.");
  const first = approveCard(card.id);
  assert.equal(first.ok, false);
  assert.equal(readState().cards.find((c) => c.id === card.id)?.status, "changed");
  const second = approveCard(card.id);
  assert.equal(second.ok, true);
});

// ---------- Visual checks ----------

const { jevImageRequest, photoCardChecks, photosForOrder, toPhotoCheck, visualQuestion } = await import("../lib/visual");

test("photos join to their order and owning record", () => {
  const photos = photosForOrder("CD-420455");
  assert.equal(photos.length, 2);
  assert.deepEqual(photos.map((p) => p.kind).sort(), ["DELIVERY_PHOTOS", "PICKUP_PHOTOS"]);
  assert.ok(photos.every((p) => p.recordId.startsWith("proof-")));
});

test("the Jev image request cites the photo it sends", () => {
  const p = photosForOrder("CD-420455")[0];
  const body = jevImageRequest("jev-1.14", [visualQuestion("photo_clear")!], p, "AAAA");
  const ref = body.state.photo;
  assert.deepEqual(Object.keys(body.assets), [ref]);
  assert.equal(body.assets[ref].data_base64, "AAAA");
  assert.match(body.questions.photo_clear.instructions, /`photo`/);
});

test("a low-confidence photo answer asks a person to look", () => {
  const p = photosForOrder("CD-420455")[0];
  const c = toPhotoCheck(visualQuestion("damage_visible")!, "selfjev", p, { answer: "yes", confidence: 0.55 }, 100, undefined, "2026-10-21T09:00:00Z");
  assert.equal(c.flagged, false);
  assert.equal(c.unsure, true);
  assert.match(c.message, /Look at the photo yourself/);
});

test("a card fact with a photo gets the visual answer next to it, checked once", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  process.env.SELFJEV_URL = "http://selfjev.test/v1";
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    calls++;
    const body = JSON.parse(init.body);
    assert.equal(Object.keys(body.assets).length, 1);
    return new Response(JSON.stringify({
      answers: {
        photo_clear: { type: "choice", choice: "clear", confidence: 0.95, probabilities: { clear: 0.95, unclear: 0.05 } },
        damage_visible: { type: "noul", noul: 0.9 },
      },
    }));
  }) as typeof fetch;
  try {
    const fact = { label: "Delivery photo", value: "One delivery photo", source: "order" as const, observedAt: "2026-10-21T08:00:00Z", recordId: "proof-x3d6fe85fc27b74cf" };
    const out = await photoCardChecks([fact]);
    const damage = out.find((c) => c.questionId === "damage_visible");
    assert.equal(damage?.flagged, true);
    assert.equal(damage?.factLabel, "Delivery photo");
    assert.ok(damage?.photoId);
    await photoCardChecks([fact]);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.SELFJEV_URL;
  }
});

// The autonomy ladder: below the limit the agent acts alone, but only when every check is sure.
const { canRunAlone } = await import("../lib/decisions");

function ferryCard(jev: { answer: string; confidence: number }[], over: Partial<import("../lib/types").ProposedAction> = {}) {
  const ids = ["quote_as_booking", "stale_position", "replaced_instruction"];
  return {
    proposal: { kind: "rebook_ferry", description: "Book the night crossing", costDelta: 120, needsApproval: true, ...over },
    checks: [
      { questionId: "quote_as_booking", questionVersion: 1, model: "code", answer: "quote", confidence: 1, ms: 0, flagged: true, message: "Only a quote" },
      ...jev.map((a, i) => ({ questionId: ids[i], questionVersion: 1, model: "jev", answer: a.answer, confidence: a.confidence, ms: 1, flagged: false, message: "" })),
    ],
  } as unknown as import("../lib/types").DecisionCard;
}

const sure = [{ answer: "no", confidence: 0.95 }, { answer: "no", confidence: 0.9 }, { answer: "no", confidence: 0.85 }];

test("below the limit and every model sure: the agent acts alone", () => {
  assert.equal(canRunAlone(ferryCard(sure), 200), true);
});

test("a limit of zero, a cost over the limit or a customer message needs a person", () => {
  assert.equal(canRunAlone(ferryCard(sure), 0), false);
  assert.equal(canRunAlone(ferryCard(sure), 100), false);
  assert.equal(canRunAlone(ferryCard(sure, { customerDraft: "Hello" }), 200), false);
});

test("an unsure trap answer or a guess below 80% needs a person", () => {
  assert.equal(canRunAlone(ferryCard([{ answer: "yes", confidence: 0.53 }, ...sure.slice(1)]), 200), false);
  assert.equal(canRunAlone(ferryCard([{ answer: "no", confidence: 0.55 }, ...sure.slice(1)]), 200), false);
});

test("without a decision model the agent does not act alone", () => {
  assert.equal(canRunAlone(ferryCard([]), 200), false);
});

// ---------- Clock, event feed and history ----------

const { tick, feed } = await import("../lib/feed");
const { asOf } = await import("../lib/history");
const { setClock, clockInfo } = await import("../lib/store");

test("a fresh state uses the real clock", () => {
  resetState(false);
  setClock({ mode: "live" });
  assert.equal(clockInfo().mode, "live");
  assert.ok(Math.abs(Date.parse(clockInfo().now) - Date.now()) < 5000);
});

test("in live mode, events more than 2 hours old are missed and do not fire", () => {
  resetState(false);
  setClock({ mode: "live" });
  assert.deepEqual(tick(), []);
  assert.ok(feed(readState()).every((e) => e.state === "missed"));
});

test("travel back: events fire once when the clock passes them", () => {
  resetState(false);
  setClock({ mode: "travel", at: "2026-10-21T08:55:00Z" });
  assert.deepEqual(tick(), []);
  assert.ok(feed(readState()).every((e) => e.state === "upcoming"));
  setClock({ mode: "travel", at: "2026-10-21T09:05:00Z" });
  assert.equal(tick().length, 2); // 09:00 and 09:04
  assert.deepEqual(tick(), []);
  const ids = readState().runs.map((r) => r.scenarioId).sort();
  assert.deepEqual(ids, ["stop-145", "warning-322"]);
});

test("travel before a run hides it, and the event does not fire again", () => {
  setClock({ mode: "travel", at: "2026-10-21T08:30:00Z" });
  const past = asOf(readState());
  assert.equal(past.runs.length, 0);
  assert.equal(past.timeline.length, 0);
  setClock({ mode: "travel", at: "2026-10-21T09:01:00Z" });
  assert.deepEqual(tick(), []);
  assert.equal(readState().runs.filter((r) => r.scenarioId === "stop-145").length, 1);
  setClock({ mode: "live" });
});

// ---------- GPS stop check ----------

const { longStop, nextStep } = await import("../lib/stopcheck");
const { cars } = await import("../lib/tracking");

test("the stop rule fires after 20 min within 150 m, not before", () => {
  const pts = (minutes: number) => Array.from({ length: minutes / 2 + 1 }, (_, i) => ({ at: new Date(Date.parse("2026-10-21T09:00:00Z") - (minutes - i * 2) * 60000).toISOString(), lat: 60.9105 + (i % 2) * 0.0003, lng: 25.5905 }));
  assert.equal(longStop(pts(18), "2026-10-21T09:00:00Z"), null);
  assert.equal(longStop(pts(22), "2026-10-21T09:00:00Z")?.minutes, 22);
  const moving = pts(30).map((p, i) => ({ ...p, lat: p.lat + i * 0.01 }));
  assert.equal(longStop(moving, "2026-10-21T09:00:00Z"), null);
});

test("each long-stop event fires when the stop rule fires on the car's track", () => {
  for (const sc of SCENARIOS.filter((s) => s.stop)) {
    setClock({ mode: "travel", at: sc.at });
    const car = cars(asOf(readState())).find((c) => c.orderRef === sc.orderRef);
    assert.ok(car?.ruleFired, `${sc.id}: rule did not fire`);
    assert.ok(Math.abs((car!.stoppedMinutes ?? 0) - sc.stop!.minutes) <= 2, `${sc.id}: stopped ${car!.stoppedMinutes} min`);
  }
  setClock({ mode: "live" });
});

test("stop policy: quiet for a fuel break, ask when unclear, card on no answer or breakdown", () => {
  const check = {
    orderRef: "CD-420145", fixId: "fix-1", lat: 0, lng: 0, stoppedSince: "", stoppedMinutes: 26, gpsAgeMinutes: 2, rule: "", provider: "simulated" as const,
    places: [{ id: "p-fuel", name: "Fuel", type: "fuel_station", lat: 0, lng: 0, distanceM: 20, openNow: true }],
  };
  const fuel = { places: [{ id: "p-fuel", label: "Fuel", probability: 0.8 }], causes: [{ id: "break", label: "", probability: 0.87 }] };
  const unusual = { places: [{ id: "none", label: "None", probability: 0.65 }], causes: [{ id: "unusual", label: "", probability: 0.7 }] };
  const breakdown = { places: [{ id: "p-fuel", label: "Fuel", probability: 0.5 }], causes: [{ id: "breakdown", label: "", probability: 0.9 }] };
  assert.equal(nextStep(check, fuel, { minutesLate: 0, asked: false, replied: false }).step, "close_quietly");
  assert.equal(nextStep(check, fuel, { minutesLate: 30, asked: false, replied: false }).step, "ask_driver");
  assert.equal(nextStep({ ...check, gpsAgeMinutes: 90 }, fuel, { minutesLate: 0, asked: false, replied: false }).step, "ask_driver");
  assert.equal(nextStep(check, unusual, { minutesLate: 0, asked: false, replied: false }).step, "ask_driver");
  assert.equal(nextStep(check, unusual, { minutesLate: 0, asked: true, replied: false }).step, "card");
  assert.equal(nextStep(check, breakdown, { minutesLate: 40, asked: true, replied: true }).step, "card");
});
