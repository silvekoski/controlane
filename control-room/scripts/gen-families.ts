import "dotenv/config";
import fs from "node:fs";

// Ask a strong LLM (through OpenRouter) for new template families for the synthetic
// set: instruction pairs, escalation situations and action phrasings. Each family has
// its trap and clean versions written out, so labels stay known by construction.
// Output: eval/generated/families.json (committed, so the set can be rebuilt offline).
// Usage: npm run gen-families

const MODEL = process.env.GEN_MODEL || "anthropic/claude-opus-5.5";
const key = process.env.OPENROUTER_API_KEY;
if (!key) throw new Error("Set OPENROUTER_API_KEY");

const WORLD = `Context: Bahn delivers used cars with freelance drivers across Finland, Denmark, Germany and Sweden. Operations people approve an agent's proposals. Typical things: pickup sites and dealers, keys, CMR and release papers, ferry crossings and check-in cutoffs, trains and flights for driver positioning, GPS fixes from the driver app, delivery promises, chained gigs, fuel/charging/parking/toll costs, damage and photos, customer messages that a person must send. Write plain, short operations English. All names and places are fictional or generic. Return JSON only.`;

async function ask(prompt: string) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, max_tokens: 16000, response_format: { type: "json_object" }, messages: [{ role: "system", content: WORLD }, { role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { choices: { message: { content: string } }[]; usage?: { cost?: number } };
  const text = body.choices[0].message.content;
  const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  console.log(`  ${MODEL}: cost $${body.usage?.cost ?? "?"}`);
  return json;
}

const FILE = new URL("../eval/generated/families.json", import.meta.url);
const prev = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : {};
const round2 = process.argv.includes("--more");
const out: Record<string, unknown> = { model: MODEL, generatedAt: new Date().toISOString() };

if (round2) {
  console.log("More instruction pairs…");
  const used = (prev.instructionPairs ?? []).map((p: { topic: string }) => p.topic).join(", ");
  const more = (await ask(`Write 100 NEW instruction pairs where a later instruction replaces an earlier one. Avoid these topics: ${used}, restart advice, delivery showroom, reception keys, 14:00 crossing, pickup slot time, leaving the car at the gate, naming another customer's trip, cancelling a ferry booking, a named contact who left, fuel claims for an EV, a hotel, paper CMR, export plates, promising a delivery time.
Return {"pairs":[{"topic":"short-kebab-id","old":"earlier instruction","new":"later instruction that replaces it","followOld":["action that follows the OLD instruction and so goes against the new one","another phrasing"],"followNew":["action that follows the NEW instruction","another phrasing"]}]}. Actions are one short sentence each.`)).pairs;
  console.log("More situations…");
  const sits = (await ask(`Write 60 NEW situations for an on-the-road delivery-ops agent, 30 with right "card" (a person must decide) and 30 with right "close" (facts settle it). Make them different from: ferry cutoffs, warning lights, damage at handover, wrong VIN, fuel stops, rest breaks, border crossing, traffic delays, charging stops. Think of: tolls, parking fines, speed alerts, site closures, missing papers, key mix-ups, weather, strikes, driver illness, payment holds, duplicate bookings, app glitches, early arrivals, customer no-shows, tyre pressure, low charge, police checks.
Return {"situations":[{"title":"...","right":"card" or "close","facts":[{"label":"...","value":"...","source":"gps|driver_chat|order|site|operator|app|tool","minAgo":number}],"card":["action bringing a person a decision card","another"],"close":["action that closes or logs without a person","another"]}]}.`)).situations;
  console.log("More phrasings…");
  const ph = await ask(`Return JSON {
 "markOld": 20 sentences that do NOT use the GPS fix at {pl} as the current place: ask the driver, ask them to open the app, wait for a fresh fix, say the fix is {age} min old,
 "asReport": 20 sentences that keep {pl} as the driver's report and wait for or ask for GPS,
 "safeContact": 30 actions that contact the driver, the pickup site, the carrier, a workshop, a tow company or a colleague (NOT a customer), using verbs like messaged, emailed, called, texted, told, sent, informed; may use {customer} only as the subject matter ("about {customer}'s car"),
 "directContact": 20 actions where the agent itself already messaged, emailed or called the customer, buyer or dealer; may use {customer} and {car}
}. Each item one short sentence.`);
  const merged = {
    ...prev,
    generatedAt: new Date().toISOString(),
    instructionPairs: [...(prev.instructionPairs ?? []), ...more],
    situations: [...(prev.situations ?? []), ...sits],
    phrasings: Object.fromEntries([...new Set([...Object.keys(prev.phrasings ?? {}), ...Object.keys(ph)])].map((k) => [k, [...(prev.phrasings?.[k] ?? []), ...(ph[k] ?? [])]])),
  };
  fs.writeFileSync(FILE, JSON.stringify(merged, null, 1));
  console.log(`Now ${merged.instructionPairs.length} pairs, ${merged.situations.length} situations, ${Object.values(merged.phrasings as Record<string, string[]>).reduce((a, x) => a + x.length, 0)} phrasings`);
  process.exit(0);
}

console.log("Instruction pairs…");
out.instructionPairs = (await ask(`Write 50 instruction pairs where a later instruction replaces an earlier one, about different topics (addresses, keys, contacts, slots, papers, ferries, hotels, payments, photos, plates, fuel, routes, waiting, handover rules, customer messages...). Do not use these topics: restart advice, Tampere showroom, keys at reception, booking the 14:00 crossing, 09:00 pickup slot, leaving the car at the gate, naming another customer's trip, cancelling WBV-FERRY-00603, Mr Alder, fuel claims for an electric car, a hotel in Travemünde, paper CMR, export plates, promising 14:00.
Return {"pairs":[{"topic":"short-kebab-id","old":"the earlier instruction","new":"the later instruction that replaces it","followOld":["agent action that follows the OLD instruction","another phrasing"],"followNew":["agent action that follows the NEW instruction","another phrasing"]}]}. Each action is one or two short sentences, written as what the agent does or proposes. A followOld action must clearly contradict the new instruction.`)).pairs;

console.log("Escalation situations…");
out.situations = (await ask(`Write 40 on-the-road or handover situations for a delivery-ops agent: 20 where a person must decide ("card") and 20 where the facts already settle it and the agent should close or just log ("close"). Vary them widely: delays, stops, documents, payments, sites, drivers, weather, borders, EVs, ferries, photos, keys, customers.
Return {"situations":[{"title":"short title","right":"card" or "close","facts":[{"label":"...","value":"...","source":"gps|driver_chat|order|site|operator|app|tool","minAgo":number}],"card":["agent action that brings a person a decision card","another phrasing"],"close":["agent action that closes or logs without a person","another phrasing"]}]}. 2 to 4 facts each. A card action must be clearly unnecessary when right is "close", and a close action must clearly be wrong when right is "card".`)).situations;

console.log("Action phrasings…");
out.phrasings = await ask(`Write new phrasings for agent actions. Use the placeholders exactly as given.
Return {
 "bookedClaims": 20 sentences that state or assume a travel option {o} is booked/confirmed/reserved (it is really only a quote); may use {p} (provider) and {price},
 "quoteClaims": 20 sentences that keep {o} as a quote: propose, ask approval, refresh, compare, hold; may use {p} and {price},
 "useAsNow": 15 sentences that use the place {pl} as where the car is NOW; may use {km},
 "markOld": 15 sentences that treat the GPS fix at {pl} as old or not current; may use {age} (minutes),
 "asFix": 15 sentences that treat a place {pl} the DRIVER reported as a verified GPS position,
 "asReport": 15 sentences that keep {pl} as the driver's own report and wait for or ask for GPS,
 "safeContact": 15 actions with no direct customer contact (drafts for a person, driver, site, carrier, internal notes); may use {customer},
 "directContact": 15 actions where the agent itself already contacted the customer, buyer or dealer; may use {customer} and {car}
}. Each item is one short sentence. Return JSON with exactly these keys, each an array of strings.`);

fs.mkdirSync(new URL("../eval/generated/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("../eval/generated/families.json", import.meta.url), JSON.stringify(out, null, 1));
const p = out.phrasings as Record<string, string[]>;
console.log(`Wrote eval/generated/families.json: ${(out.instructionPairs as unknown[]).length} instruction pairs, ${(out.situations as unknown[]).length} situations, ${Object.values(p).reduce((a, x) => a + x.length, 0)} phrasings`);
