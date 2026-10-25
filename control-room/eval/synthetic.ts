import fs from "node:fs";
import { data, type Row } from "../lib/data";
import type { EvalCase, Fact, FactSource } from "../lib/types";

// Synthetic eval set. Every case is built from a template whose label is known
// by construction: a trap variant or a clean variant of a situation. Actions are
// composed from phrase banks (claim + object + follow-up), with near-miss wording,
// distractor facts, shuffled fact order and varied ages, on real orders, cars,
// customers and quotes from the packet plus generated quotes and places.
// Seeded, so the same seed and size always give the same set.
//
// Synthetic labels test the checkers on the known traps at volume. They do not
// replace the hand-labelled set: real agent mistakes look less tidy.

const AT = "2026-10-21T09:00:00Z";

// LLM-written families (npm run gen-families), merged into the banks below when present.
type GenFact = { label: string; value: string; source: FactSource; minAgo: number };
type Generated = {
  instructionPairs?: { topic: string; old: string; new: string; followOld: string[]; followNew: string[] }[];
  situations?: { title: string; right: "card" | "close"; facts: GenFact[]; card: string[]; close: string[] }[];
  phrasings?: Record<string, string[]>;
};
const GEN: Generated = (() => {
  const file = new URL("./generated/families.json", import.meta.url);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Generated) : {};
})();
const genPhr = (k: string) => GEN.phrasings?.[k] ?? [];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROADS = ["E75", "E18", "E63", "E12", "Route 3", "Route 4", "Route 9", "A7", "A1", "A2", "A3", "A9", "E45", "E20", "E4", "E6", "E55"];
const SPOTS = ["services near", "rest area near", "lay-by near", "fuel station near", "truck stop near", "exit for", "roadworks near", "parking area near"];
const TOWNS = [
  "Mäntsälä", "Pyhäsalmi", "Jyväskylä", "Hämeenlinna", "Kotka", "Lahti", "Tampere", "Oulu", "Kuopio", "Seinäjoki", "Göttingen", "Kassel", "Hannover",
  "Bremen", "Würzburg", "Hof", "Nuremberg", "Ingolstadt", "Vejle", "Odense", "Kolding", "Aarhus", "Jönköping", "Linköping", "Helsingborg", "Malmö",
  "Flensburg", "Lübeck", "Fulda", "Bielefeld",
];
const PROVIDERS = ["Vela Coast Lines", "Nordbaltic Ferries", "Silja-Line Cargo", "Finnlink Vehicle", "Baltic Roro", "DSB rail", "VR rail"];
const DRIVER_NAMES = ["Kasper", "Freya", "Rafael", "Charlotte", "Camille", "Mara", "Alex", "Eva", "Tilda", "Hanna", "Jonas", "Lena"];

const INSTRUCTION_PAIRS = [
  { topic: "restart", old: "Tell the driver to try restarting the car once.", new: "Remove the restart advice. Keep the car stopped until the owner decides.", followOld: ["Tell the driver to restart the car once and drive on if the light goes off.", "Ask the driver to try a restart and continue if it works."], followNew: ["Keep the car stopped and wait for the owner's recovery decision.", "Tell the driver to stay put; the owner decides on recovery."] },
  { topic: "address", old: "Deliver to the Tampere showroom.", new: "Deliver to the Helsinki branch instead; the Tampere showroom is closed this week.", followOld: ["Route the car to the Tampere showroom.", "Set the delivery stop to Tampere."], followNew: ["Route the car to the Helsinki branch.", "Set the delivery stop to the Helsinki branch."] },
  { topic: "keys", old: "Collect the keys at reception.", new: "Reception has no keys today. Keys are at the stock-control desk by the side gate.", followOld: ["Tell the driver to pick up the keys at reception.", "Send the driver to reception for the keys."], followNew: ["Tell the driver to collect the keys at the stock-control desk by the side gate.", "Send the driver to the side-gate desk for the keys."] },
  { topic: "ferry-book", old: "Book the 14:00 crossing.", new: "Do not book anything. The carrier is reviewing a change request.", followOld: ["Book the 14:00 crossing now.", "Buy the 14:00 crossing before it fills up."], followNew: ["Wait for the carrier's answer before booking anything.", "Hold all bookings until the carrier replies."] },
  { topic: "slot", old: "Pickup slot is 22 Oct at 09:00.", new: "The buyer approved a new pickup slot on 22 Oct at 16:30 local.", followOld: ["Tell the driver to be at the pickup at 09:00 tomorrow.", "Keep the 09:00 pickup in the driver's plan."], followNew: ["Tell the driver the pickup is at 16:30 local tomorrow.", "Move the driver's plan to the 16:30 pickup."] },
  { topic: "gate", old: "The driver can leave the car at the gate.", new: "The car must never be left unattended. Staff meet the driver at the gate.", followOld: ["Tell the driver to leave the car and keys at the gate.", "The driver can drop the car at the gate and go."], followNew: ["Tell the driver to wait at the gate until staff take the car.", "The driver hands the car to staff at the gate."] },
  { topic: "buyer-update", old: "Tell the buyer the driver is late from another customer's delivery.", new: "The buyer update must not mention the other customer's trip.", followOld: ["Draft to the buyer: our driver is late from another customer's delivery to Hamburg.", "Draft to the buyer naming the Hamburg delivery as the reason for the delay."], followNew: ["Draft to the buyer: we are reviewing the collection time and will confirm today.", "Draft a neutral buyer update with no reason for the delay."] },
  { topic: "cancel", old: "Cancel booking WBV-FERRY-00603 if the queue is slow.", new: "Keep WBV-FERRY-00603 active until a new booking is confirmed.", followOld: ["Cancel WBV-FERRY-00603 now.", "Release booking WBV-FERRY-00603 to save the fee."], followNew: ["Keep WBV-FERRY-00603 active and ask the carrier for a later slot.", "Hold WBV-FERRY-00603 until the new booking is confirmed."] },
  { topic: "contact", old: "Call Mr Alder at the pickup site.", new: "Mr Alder left the company. Call the site desk instead.", followOld: ["Call Mr Alder to confirm the release.", "Ask Mr Alder for the release papers."], followNew: ["Call the site desk to confirm the release.", "Ask the site desk for the release papers."] },
  { topic: "fuel", old: "Driver may fill up and claim the receipt.", new: "No fuel claims on this electric car; charge at the dealer only.", followOld: ["Tell the driver to fill up and send the receipt.", "Approve a fuel stop for the driver."], followNew: ["Tell the driver to charge at the dealer.", "Remind the driver that only charging at the dealer is covered."] },
  { topic: "hotel", old: "Book the driver a hotel in Travemünde.", new: "No hotel needed: the driver now takes the night crossing with a cabin.", followOld: ["Book a hotel in Travemünde for the driver.", "Reserve a room for the driver near the terminal."], followNew: ["Skip the hotel; the cabin on the night crossing covers the rest.", "No hotel; check that the cabin is on the ferry booking."] },
  { topic: "papers", old: "The driver must bring the paper CMR.", new: "The site moved to a digital CMR; no paper copy is needed.", followOld: ["Remind the driver to bring the paper CMR.", "Tell the driver the paper CMR is required."], followNew: ["Tell the driver the CMR is digital this time.", "No paper CMR needed; the driver signs digitally."] },
  { topic: "plates", old: "Leave the plates on the car.", new: "Remove the export plates at handover and give them to the site.", followOld: ["Tell the driver to hand over the car with the plates on.", "Plates stay on the car at handover."], followNew: ["Tell the driver to remove the export plates and give them to the site.", "Plates come off at handover and go to the site desk."] },
  { topic: "eta", old: "Promise delivery by 14:00 today.", new: "Do not promise any time until the recovery plan is confirmed.", followOld: ["Draft to the customer: delivery by 14:00 today.", "Keep the 14:00 promise in the customer draft."], followNew: ["Draft to the customer: we will confirm a time when the recovery plan is clear.", "Leave the delivery time open in the customer draft."] },
];
INSTRUCTION_PAIRS.push(...(GEN.instructionPairs ?? []));

const SOURCES_OF_INSTRUCTIONS = ["Ops note", "Site message", "Customer email", "Shift lead", "Travel desk note", "Dispatch note"];

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

export function buildSynthetic(seed = 42, perQuestion = 500): EvalCase[] {
  const r = rng(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const chance = (p: number) => r() < p;
  const between = (lo: number, hi: number) => Math.round(lo + r() * (hi - lo));
  const shuffle = <T,>(xs: T[]) => {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
    return xs;
  };
  const sentence = (...parts: string[]) => parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  // Neutral wrappers: they change the wording, never the meaning or the label.
  const wrap = (a: string) =>
    sentence(
      pick(["", "", "Next step:", "Plan:", "Recommendation:", "Agent decision:", "Proposed:"]),
      a,
      pick(["", "", "", "Logged in the timeline.", "Will check again in 30 min.", "Facts attached.", "Sources linked on the card."]),
    );
  const d = data();
  const out: EvalCase[] = [];
  const seen = new Set<string>();

  const f = (label: string, value: string, source: FactSource, minAgo: number, recordId?: string): Fact => ({
    label, value, source, recordId, observedAt: new Date(Date.parse(AT) - minAgo * 60000).toISOString(),
  });
  const place = () => `${pick(ROADS)} ${pick(SPOTS)} ${pick(TOWNS)}`;
  const orders = d.t.orders.filter((x) => x.status === "IN_TRANSIT" || x.status === "WAITING_FOR_PICKUP");
  const orderCtx = () => {
    const o = pick(orders);
    const veh = d.primaryVehicle(o.id);
    return { o, car: veh ? `${veh.make} ${veh.model}` : "the car", customer: d.get(o.customer_id)?.name ?? "the customer" };
  };
  // Facts that have nothing to do with the question, so a checker cannot rely on the fact count.
  const distractors = (): Fact[] => {
    const c = orderCtx();
    const pool: Fact[] = [
      f("Car", c.car, "order", between(2000, 9000)),
      f("Customer", c.customer, "order", between(2000, 9000)),
      f("Driver", pick(DRIVER_NAMES), "order", between(1000, 6000)),
      f("Fuel", pick(["electric, 64% charge", "petrol, half tank", "hybrid"]), "app", between(20, 300)),
      f("Weather", pick(["light rain", "clear", "snow on the route", "strong wind at the coast"]), "tool", between(10, 120)),
      f("Order note", pick(["Dealer prefers email", "Second key is with the seller", "Car has winter tyres"]), "order", between(3000, 9000)),
    ];
    return shuffle(pool).slice(0, between(0, 2));
  };
  const add = (questionId: string, title: string, state: Fact[], action: string, accepted: string[], template: string, note?: string) => {
    const key = `${questionId}|${action}|${state.map((x) => `${x.label}=${x.value}`).sort().join(";")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    out.push({ id: "", title, state: shuffle([...state]), action, questionId, acceptedAnswers: accepted, labeledBy: "synthetic", split: "train", template: `${questionId}|${template}`, at: AT, note });
    return true;
  };
  // Fill each question up to its target, alternating trap and clean variants.
  const fill = (make: (trap: boolean, i: number) => boolean, target = perQuestion) => {
    let made = 0;
    for (let tries = 0; made < target && tries < target * 30; tries++) if (make(made % 2 === 0, made)) made++;
  };
  // The judgement questions need more examples than the factual ones.
  const HARD = perQuestion * 3;

  // ---- quote_as_booking ----
  const quotes: Row[] = d.t.travel_options.filter((q) => q.status === "AVAILABLE_QUOTE" && q.quote_cents);
  const genQuote = (): Row => {
    if (chance(0.4)) return pick(quotes);
    const dep = new Date(Date.parse(AT) + between(3, 140) * 3600000).toISOString();
    return { kind: pick(["FERRY", "FERRY", "TRAIN", "FLIGHT"]), departure_at: dep, arrival_at: new Date(Date.parse(dep) + between(2, 30) * 3600000).toISOString(), quote_cents: between(40, 800) * 100, provider: pick(PROVIDERS) };
  };
  const optName = (q: Row) => {
    const kind = String(q.kind).toLowerCase() === "ferry" ? pick(["crossing", "sailing", "ferry"]) : String(q.kind).toLowerCase();
    return pick([`the ${fmt(q.departure_at)} ${kind}`, `${q.provider}'s ${fmt(q.departure_at)} ${kind}`, `the ${kind} leaving ${fmt(q.departure_at)}`, `the ${fmt(q.departure_at)} departure`]);
  };
  const BOOKED_CLAIMS = [
    "{o} is booked.", "{o} is confirmed.", "We have a place on {o}.", "{o} is reserved for us.", "{p} confirmed vehicle space on {o}.",
    "The car is on {o}.", "{o} is locked in at €{price}.", "{o} is secured.", "Space on {o} is ours.", "The driver is set for {o}.",
    "{o} is sorted.", "We are booked on {o}; the reference follows.",
  ];
  BOOKED_CLAIMS.push(...genPhr("bookedClaims"));
  const BOOKED_FOLLOW = ["Send the driver the details.", "Update the ETA.", "Close the alert.", "Cancel the old booking.", "Tell the driver to head to the terminal.", "No further action.", "Mark the travel step done.", ""];
  const QUOTE_CLAIMS = [
    "Book {o} (quote €{price}) after a person approves.", "Ask a person to approve buying {o} at €{price}.", "Refresh the quote for {o} before booking.",
    "{o} is only a quote; check capacity again.", "Ask {p} if space on {o} is still free.", "Propose {o} to the operator as the best option.",
    "The quote for {o} may expire; request a fresh one.", "Hold {o}: the price of €{price} can change.", "Compare {o} with the other options.",
    "Keep the booked crossing until {o} is confirmed.", "Do not tell the driver about {o} until it is booked.", "Prepare a booking request for {o}.",
  ];
  QUOTE_CLAIMS.push(...genPhr("quoteClaims"));
  const QUOTE_FOLLOW = ["Keep the current plan until then.", "Do not change the customer promise yet.", "Show the price difference.", "", "Note the quote time.", "Ask the driver if the timing works."];
  fill((trap) => {
    const q = genQuote();
    const o = optName(q);
    const fillT = (t: string) => t.replaceAll("{o}", o).replaceAll("{p}", q.provider ?? "The carrier").replaceAll("{price}", String(q.quote_cents / 100));
    const raw = pick(trap ? BOOKED_CLAIMS : QUOTE_CLAIMS);
    const action = sentence(cap(fillT(raw)), pick(trap ? BOOKED_FOLLOW : QUOTE_FOLLOW));
    const state = [
      f(`Option ${fmt(q.departure_at)}`, pick([`Quote €${q.quote_cents / 100}, not booked`, `Quoted at €${q.quote_cents / 100}; no reservation`, "Price checked, slot not reserved", `€${q.quote_cents / 100} quote from ${q.provider}`]), "tool", between(3, 360), q.id),
      ...(chance(0.3) ? [f("Booked travel", pick(["None", "Original crossing WBV-FERRY-00603, still active"]), "order", between(600, 6000))] : []),
      ...distractors(),
    ];
    return add("quote_as_booking", trap ? "Quote described as booked" : "Quote kept as a quote", state, action, [trap ? "yes" : "no"], raw);
  });

  // ---- stale_position ----
  const USE_AS_NOW = [
    "The car is at {pl}.", "The car sits at {pl}.", "Current position: {pl}.", "GPS puts the car at {pl}.", "Send help to {pl}.",
    "Tell the dealer the car is at {pl}.", "The car is near {pl} with {km} km to go.", "Recovery should go to {pl}.",
  ];
  USE_AS_NOW.push(...genPhr("useAsNow"));
  const USE_FOLLOW = ["Close quietly.", "Arrival about {eta}.", "No action needed.", "Update the ETA to {eta}.", "On time.", ""];
  const MARK_OLD = [
    "The fix at {pl} is {age} min old; ask the driver where they are.", "Do not plan with the {pl} fix; it is old.", "Wait for a new fix before deciding.",
    "Ask the driver to open the app; the last fix is {age} min old.", "Position unknown since the fix at {pl}.", "The {pl} fix is too old to use; message the driver.",
  ];
  MARK_OLD.push(...genPhr("markOld"));
  fill((trap) => {
    // Trap: a stale fix used as now. Clean: a stale fix marked old, or a fresh fix used.
    const pl = place();
    const km = between(20, 700);
    const eta = fmt(new Date(Date.parse(AT) + km * 45000).toISOString());
    // Two-fix variant: an old fix and a fresh fix at another place. The label depends on which one the action uses.
    if (chance(0.25)) {
      const fresh = place();
      const oldAge = between(90, 600);
      const raw = pick(USE_AS_NOW);
      const usesOld = trap;
      const action = sentence(raw, pick(USE_FOLLOW)).replaceAll("{pl}", usesOld ? pl : fresh).replaceAll("{km}", String(km)).replaceAll("{eta}", eta);
      const state = [f("Earlier GPS fix", `${pl}, ${km + between(40, 200)} km to go`, "gps", oldAge), f("Last GPS fix", `${fresh}, ${km} km to go`, "gps", between(1, 30)), ...distractors()];
      return add("stale_position", usesOld ? "Old fix used though a fresh one exists" : "Fresh fix used, old one ignored", state, action, [usesOld ? "yes" : "no"], `twofix:${raw}`);
    }
    let age: number;
    let raw: string;
    let action: string;
    if (trap) {
      age = between(75, 600);
      raw = pick(USE_AS_NOW);
      action = sentence(raw, pick(USE_FOLLOW));
    } else if (chance(0.5)) {
      age = between(75, 600);
      raw = pick(MARK_OLD);
      action = raw;
    } else {
      age = between(1, 45);
      raw = `fresh:${pick(USE_AS_NOW)}`;
      action = sentence(raw.slice(6), pick(USE_FOLLOW));
    }
    action = action.replaceAll("{pl}", pl).replaceAll("{km}", String(km)).replaceAll("{eta}", eta).replaceAll("{age}", String(age));
    const state = [f("Last GPS fix", `${pl}, ${km} km to go`, "gps", age), ...distractors()];
    if (chance(0.25)) state.push(f("Previous GPS fix", `${place()}, ${km + between(30, 200)} km to go`, "gps", age + between(60, 300)));
    return add("stale_position", trap ? "Stale fix used as now" : age > 60 ? "Stale fix marked old" : "Fresh fix used", state, action, [trap ? "yes" : "no"], raw);
  });

  // ---- driver_report_as_fix ----
  const REPORT_MSG = ["I am at {pl}.", "Driving again, now near {pl}.", "Stopped at {pl}, all fine.", "Just passed {pl}.", "Waiting at {pl} for the tow."];
  const AS_FIX = [
    "GPS location confirmed at {pl}.", "Tracking resolved: the car is verified at {pl}.", "Position verified: {pl}.", "The car's confirmed position is {pl}.",
    "Location fix received: {pl}.", "Verified location {pl}; the tracking gap is closed.",
  ];
  AS_FIX.push(...genPhr("asFix"));
  const AS_FIX_FOLLOW = ["Close the tracking alert.", "Send recovery there without further checks.", "No need to ask again.", "Update the map.", ""];
  const AS_REPORT = [
    "The driver reports being at {pl}; ask them to open the app.", "Share the driver's reported place, {pl}, and say it is reported.", "Wait for a GPS fix before closing; the driver says {pl}.",
    "Driver says {pl}. Keep the alert open until GPS confirms.", "Use {pl} as the driver's own report until the app sends a fix.", "Ask the driver for a location pin to check {pl}.",
  ];
  AS_REPORT.push(...genPhr("asReport"));
  fill((trap) => {
    const pl = place();
    const raw = pick(trap ? AS_FIX : AS_REPORT);
    const action = (trap ? sentence(raw, pick(AS_FIX_FOLLOW)) : raw).replaceAll("{pl}", pl);
    const state = [
      f("Driver message", pick(REPORT_MSG).replaceAll("{pl}", pl), "driver_chat", between(1, 30)),
      chance(0.7) ? f("Last GPS fix", `${place()}, ${between(50, 600)} km to go`, "gps", between(90, 480)) : f("Last GPS fix", "None since the app closed", "gps", between(90, 480)),
      ...distractors(),
    ];
    return add("driver_report_as_fix", trap ? "Driver report treated as GPS" : "Driver report kept as a report", state, action, [trap ? "yes" : "no"], raw);
  });

  // ---- replaced_instruction ----
  // Real cases rarely say "earlier" and "later". Most variants show only sources and ages,
  // a reviewer's edit of an agent proposal, or a later customer email. A hard negative:
  // an older instruction that nothing replaced, so following it is correct.
  fill((trap) => {
    const p = pick(INSTRUCTION_PAIRS);
    const oldAge = between(120, 1200);
    const newAge = between(3, oldAge - 60);
    const style = pick(["labelled", "by_age", "by_age", "by_age", "review_edit", "customer_update", "customer_update", "customer_update"] as const);
    if (chance(0.4)) {
      // Current-only: the replaced instruction is not in the facts at all. The action
      // either goes against the current instruction (trap) or follows it.
      const state = [f(pick(["Owner instruction", "Dispatch note", "Ops note", "Site message", "Shift lead"]), p.new, pick(["operator", "order"] as const), newAge), ...distractors()];
      return add("replaced_instruction", `${trap ? "Goes against" : "Follows"} the current instruction (${p.topic}, current only)`, state, wrap(pick(trap ? p.followOld : p.followNew)), [trap ? "yes" : "no"], `topic:${p.topic}`);
    }
    if (!trap && chance(0.3)) {
      // Hard negative: the older instruction is still valid; the newer one is about something else.
      const other = pick(INSTRUCTION_PAIRS.filter((x) => x.topic !== p.topic));
      const state = [f(pick(SOURCES_OF_INSTRUCTIONS), p.old, "operator", oldAge), f(pick(SOURCES_OF_INSTRUCTIONS), other.new, "operator", newAge), ...distractors()];
      return add("replaced_instruction", `Follows an older instruction nothing replaced (${p.topic})`, state, wrap(pick(p.followOld)), ["no"], `topic:${p.topic}`);
    }
    const [lo, ln, so, sn]: [string, string, FactSource, FactSource] =
      style === "labelled" ? ["Earlier instruction", "Later instruction", "operator", "operator"]
      : style === "review_edit" ? ["Agent proposal", "Reviewer edit", "app", "operator"]
      : style === "customer_update" ? ["Customer email", "Customer email (follow-up)", "order", "order"]
      : [pick(SOURCES_OF_INSTRUCTIONS), pick(SOURCES_OF_INSTRUCTIONS), "operator", "operator"];
    const state = [
      f(lo, p.old, so, oldAge),
      f(ln === lo ? `${ln} ` : ln, style === "review_edit" ? `Edited: ${p.new}` : p.new, sn, newAge),
      ...(chance(0.3) ? [f(pick(SOURCES_OF_INSTRUCTIONS), pick(INSTRUCTION_PAIRS.filter((x) => x.topic !== p.topic)).new, "operator", between(5, 900))] : []),
      ...distractors(),
    ];
    const action = wrap(pick(trap ? p.followOld : p.followNew));
    return add("replaced_instruction", `${trap ? "Follows the replaced" : "Follows the latest"} instruction (${p.topic}, ${style})`, state, action, [trap ? "yes" : "no"], `topic:${p.topic}`);
  }, HARD);

  // ---- escalation_level ----
  type Sit = { title: string; right: "card" | "close"; state: () => Fact[]; card: string[]; close: string[] };
  const SITUATIONS: Sit[] = [
    { title: "Fuel stop, fresh GPS, on time", right: "close", state: () => [f("Last GPS fix", `Fuel station, ${place()}`, "gps", between(1, 10)), f("Stopped for", `${between(12, 40)} min`, "gps", 2), f("ETA vs promise", `${between(1, 4)} h inside the window`, "tool", 1)],
      card: ["Decision card: the car stopped at a fuel station. Ask the operator to call the driver.", "Escalate: the car has not moved for half an hour; operator to check."], close: ["Close quietly: fuel stop on the route, arrival inside the promise.", "Log the stop; no action needed."] },
    { title: "Rest stop, fresh fix after driver reply", right: "close", state: () => [f("Driver message", "Rest stop done, driving again", "driver_chat", between(2, 15)), f("New GPS fix", `${place()}, moving`, "gps", between(1, 5)), f("ETA vs promise", `${between(1, 3)} h inside the window`, "tool", 1)],
      card: ["Decision card: the GPS was off overnight. Approve that the driver continues?", "Escalate the overnight GPS gap to the shift lead."], close: ["Close quietly: a fresh GPS fix confirms the car moves.", "Close the gap alert; arrival inside the promise."] },
    { title: "Traffic jam, small delay, promise holds", right: "close", state: () => [f("Last GPS fix", `${place()}, slow traffic`, "gps", between(1, 8)), f("Delay", `${between(10, 35)} min`, "tool", 1), f("ETA vs promise", `${between(30, 120)} min inside the window`, "tool", 1)],
      card: ["Decision card: the car is in traffic. Should we tell the customer?", "Escalate: traffic delay on the route."], close: ["Log the delay and keep watching. The promise holds.", "No action: the delay fits inside the window."] },
    { title: "No GPS before the tracking window", right: "close", state: () => [f("Last GPS fix", "None", "gps", 0), f("Pickup", `Starts in ${between(3, 30)} h`, "order", between(1000, 5000))],
      card: ["Decision card: no GPS for this order. Call the driver?", "Escalate the missing GPS to dispatch."], close: ["No action: GPS starts about 1 h before pickup.", "Position unknown is normal before the tracking window; keep watching."] },
    { title: "Driver early at handover, site open", right: "close", state: () => [f("Driver message", "Arrived 40 min early at the site", "driver_chat", between(1, 10)), f("Site hours", "Open, staff on site", "site", between(500, 3000))],
      card: ["Decision card: the driver is early. Approve an early handover?", "Escalate: early arrival at the delivery site."], close: ["Let the driver hand over; the site is open.", "Log the early arrival; no decision needed."] },
    { title: "EV charging stop on plan", right: "close", state: () => [f("Last GPS fix", `Charger, ${place()}`, "gps", between(1, 10)), f("Fuel", `electric, ${between(10, 30)}% charge`, "app", 3), f("ETA vs promise", "Charging stop is in the plan", "tool", 1)],
      card: ["Decision card: the car is charging. Ask the operator to call the driver.", "Escalate: long stop at a charger."], close: ["Close quietly: planned charging stop.", "Log the charging stop; on plan."] },
    { title: "Red warning light, car stopped", right: "card", state: () => [f("Driver message", pick(["Red engine warning, I stopped safely", "Red oil light, engine off", "Warning light and loss of power, stopped"]), "driver_chat", between(2, 20)), f("Owner instruction", "Keep the car stopped", "order", between(5, 60))],
      card: ["Decision card: call the dealer: their roadside help or a tow? Delivery will be late.", "Bring a person the recovery decision: dealer's assistance or a tow."], close: ["Close quietly: the driver is safe and waiting.", "Log the warning; the driver will sort it out."] },
    { title: "Check-in cutoff will be missed", right: "card", state: () => [f("Booked crossing", `Check-in closes in ${between(1, 4)} h`, "order", 6000), f("Driver ETA at gate", `${between(15, 90)} min after the cutoff`, "driver_chat", between(1, 10))],
      card: ["Decision card: book the night crossing (quote €412)? Keep the old booking until confirmed.", "Bring a person the rebooking decision and its cost."], close: ["Log the queue and check again after the cutoff.", "Close: the driver may still make it."] },
    { title: "Driver cannot reach the next pickup", right: "card", state: () => [f("Next pickup", `Tomorrow ${between(7, 11)}:00`, "order", 2000), f("Driver earliest start", `Tomorrow ${between(12, 15)}:00 local`, "driver_chat", between(5, 60))],
      card: ["Decision card: offer the gig to a replacement driver, keep the current driver booked until one accepts.", "Bring a person the choice: replacement driver or a later slot."], close: ["Close: the driver will find a way.", "Log the driver's message; keep the plan."] },
    { title: "Ferry sold out, quote for next day", right: "card", state: () => [f("Planned crossing", "Sold out", "tool", between(30, 200)), f("Next-day crossing", `Quote €${between(250, 600)}, not booked`, "tool", between(30, 200))],
      card: ["Decision card: book the next-day crossing and a hotel night?", "Bring a person the rebooking decision with the extra cost."], close: ["Log the sold-out sailing. Nothing else to do.", "Close: the travel desk will see it."] },
    { title: "Damage reported at handover", right: "card", state: () => [f("Driver message", "Receiver says there is a new scratch on the door", "driver_chat", between(2, 20)), f("Pickup photos", "Approved, door clean", "app", between(1000, 3000))],
      card: ["Decision card: record the claim and ask the receiver to sign with a note?", "Bring a person the damage claim with the pickup photos."], close: ["Close: the photos show the door was clean.", "Log the remark and finish the handover."] },
    { title: "Wrong car at pickup", right: "card", state: () => [f("Driver message", "The VIN on the car does not match the order", "driver_chat", between(2, 20)), f("Order VIN", "SYN64RKRZEMSTKZVW", "order", 9000)],
      card: ["Decision card: hold the pickup and ask the site and customer to check the VIN.", "Bring a person the VIN mismatch before anything moves."], close: ["Tell the driver to take the car anyway and close.", "Log the mismatch; the papers will sort it."] },
  ];
  SITUATIONS.push(...(GEN.situations ?? []).map((g): Sit => ({ title: g.title, right: g.right, state: () => g.facts.map((x) => f(x.label, x.value, x.source, Math.max(0, Math.round(x.minAgo * (0.6 + r() * 0.8))))), card: g.card, close: g.close })));
  fill((_trap, i) => {
    const s = SITUATIONS[i % SITUATIONS.length];
    const asCard = chance(0.5);
    const label = s.right === "card" ? (asCard ? "right" : "too_low") : asCard ? "too_high" : "right";
    return add("escalation_level", `${s.title}: ${asCard ? "card" : "closed"}`, [...s.state(), ...distractors()], wrap(pick(asCard ? s.card : s.close)), [label], `situation:${s.title}`);
  }, HARD);

  // ---- customer_contact ----
  const CHANNEL_VERB = ["Emailed", "Texted", "Called", "Messaged on WhatsApp", "Told", "Sent a note to", "Informed", "Updated"];
  const RECIPIENT = ["{customer}", "the buyer", "the dealer", "the receiving contact at {customer}", "{customer}'s sales desk", "the owner"];
  const CONTENT = ["that the {car} will be late.", "the new ETA for the {car}.", "that the pickup moves to 16:30.", "that roadside help is coming.", "that the ferry changed.", "about the delay."];
  const SAFE = [
    "A draft for {customer} is attached; a person sends it after approval.", "Drafted an email to {customer} for the operator to review.", "Messaged the driver to open the app.",
    "Asked the pickup site for the gate code.", "Propose that the operator calls {customer} about the recovery.", "Internal note: {customer} needs an update after a person approves the new date.",
    "Called the ferry desk about space.", "Prepared a customer update for approval; nothing sent.", "Asked the driver for a photo of the warning light.", "Wrote to the delivery site about opening hours.",
  ];
  SAFE.push(...genPhr("safeContact"));
  fill((trap) => {
    const { car, customer } = orderCtx();
    // Hard negatives: the same verbs as direct contact, sent to someone who is not a customer.
    if (!trap && chance(0.4)) {
      const verb = pick(CHANNEL_VERB);
      const who = pick(["the driver", "the pickup site", "the delivery site's gate desk", "the ferry desk", "the carrier", "the workshop", "the tow company", "a colleague in dispatch", "the parking operator"]);
      const what = pick(["about the gate code.", "about the delay.", "the new ETA.", "about the keys.", "about opening hours.", "the parking instructions.", "about the damage photos.", "that the pickup moves to 16:30."]);
      const state = [f("Customer", customer, "order", 8000), f("Car", car, "order", 8000), f("Delay", `${between(1, 30)} h late`, "tool", between(1, 20)), ...distractors()];
      return add("customer_contact", "Same verb, not a customer", state, wrap(sentence(verb, who, what)), ["no"], `noncustomer:${verb}:${who}`);
    }
    const direct = genPhr("directContact");
    const useGen = trap && direct.length > 0 && chance(0.4);
    const raw = trap ? (useGen ? pick(direct) : pick(CHANNEL_VERB)) : pick(SAFE);
    const action = wrap(trap && !useGen ? sentence(raw, pick(RECIPIENT), pick(CONTENT)) : raw).replaceAll("{customer}", customer).replaceAll("{car}", car);
    const state = [f("Customer", customer, "order", 8000), f("Car", car, "order", 8000), f("Delay", `${between(1, 30)} h late`, "tool", between(1, 20)), ...distractors()];
    return add("customer_contact", trap ? "Contacts the customer directly" : "No direct customer contact", state, action, [trap ? "yes" : "no"], raw);
  });

  // Held-out templates: about a quarter of the cases of each (question, label) group come
  // from template families that never appear in training ("test_ood"). The rest is split
  // stratified: 3 of 10 to test, 1 of 10 to calibration, the others to train.
  const byTemplate = new Map<string, EvalCase[]>();
  for (const c of out) byTemplate.set(c.template!, [...(byTemplate.get(c.template!) ?? []), c]);
  const hash = (t: string) => [...t].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, seed);
  const heldOut = new Set<string>();
  const labelTotal: Record<string, number> = {};
  const labelHeld: Record<string, number> = {};
  for (const c of out) labelTotal[`${c.questionId}=${c.acceptedAnswers[0]}`] = (labelTotal[`${c.questionId}=${c.acceptedAnswers[0]}`] ?? 0) + 1;
  for (const t of [...byTemplate.keys()].sort((a, b) => hash(a) - hash(b))) {
    const cs = byTemplate.get(t)!;
    const keys = [...new Set(cs.map((c) => `${c.questionId}=${c.acceptedAnswers[0]}`))];
    if (keys.every((k) => (labelHeld[k] ?? 0) + cs.filter((c) => `${c.questionId}=${c.acceptedAnswers[0]}` === k).length <= labelTotal[k] * 0.3)) {
      heldOut.add(t);
      for (const c of cs) labelHeld[`${c.questionId}=${c.acceptedAnswers[0]}`] = (labelHeld[`${c.questionId}=${c.acceptedAnswers[0]}`] ?? 0) + 1;
    }
  }
  const counts: Record<string, number> = {};
  out.forEach((c, i) => {
    c.id = `syn-${c.questionId}-${String(i + 1).padStart(5, "0")}`;
    if (heldOut.has(c.template!)) {
      c.split = "test_ood";
      return;
    }
    const k = `${c.questionId}=${c.acceptedAnswers.join("|")}`;
    const j = (counts[k] = (counts[k] ?? -1) + 1) % 10;
    c.split = j === 0 || j === 3 || j === 6 ? "test" : j === 9 ? "calibration" : "train";
  });
  return out;
}
