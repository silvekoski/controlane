import fs from "node:fs";
import path from "node:path";
import { data } from "./data";
import { costUsd, create, hasClaude, MODELS, textOf, parseJson } from "./llm";
import { LIVE_QUESTIONS } from "./questions";
import { minutesBetween, readState } from "./store";
import { imageDataUrl } from "./vision";
import type { CheckerModel, CheckResult, Fact, ProposedAction, TypedQuestion } from "./types";
import { photoCardChecks } from "./visual";

// The check layer. Before a card goes into the queue:
// 1. plain code checks the hard rules and the facts it can calculate,
// 2. each configured decision model answers the typed questions,
// 3. each visual decision model answers questions about the photos behind the cited facts.

export type CheckInput = {
  at: string; // the decision moment
  state: Fact[];
  action: string; // summary and proposal in plain words
  proposal?: ProposedAction;
  image?: string; // packet path of a photo or scan, for vision questions
};

export type Answer = { answer: string; confidence: number; ms: number; costUsd?: number };

const STALE_MIN = 60;
export const WARN_CONFIDENCE = 0.7;

function ageMin(f: Fact, at: string) {
  return minutesBetween(f.observedAt, at);
}

function words(s: string) {
  return new Set(s.toLowerCase().split(/[^a-zäöüß0-9]+/).filter((w) => w.length > 3));
}

// ---------- Plain code: the answer when logic can calculate it ----------

export function codeAnswer(q: string, x: CheckInput): Answer | null {
  const t0 = performance.now();
  const a = x.action.toLowerCase();
  const done = (answer: string, confidence = 0.99): Answer => ({ answer, confidence, ms: Math.max(0.01, performance.now() - t0) });

  switch (q) {
    case "quote_as_booking": {
      const quoteFacts = x.state.filter((f) => /quote|not booked/i.test(f.value));
      const claimsBooked = /\b(is|was|already|now|has been)\s+(booked|confirmed|reserved)\b|\bbooked on\b|\bconfirmed (slot|space|crossing|sailing|booking)\b|\bon the booked\b/.test(a);
      const quotedRef = quoteFacts.some((f) => [...words(f.label)].some((w) => a.includes(w)));
      if (!quoteFacts.length) return done("no", 0.8);
      return done(claimsBooked && quotedRef ? "yes" : "no", claimsBooked ? 0.75 : 0.7);
    }
    case "stale_position": {
      const stale = x.state.filter((f) => f.source === "gps" && ageMin(f, x.at) > STALE_MIN);
      if (!stale.length) return done("no", 0.95);
      const usesIt = stale.some((f) => [...words(f.value)].filter((w) => !/^\d+$/.test(w)).some((w) => a.includes(w))) || /gps (shows|says|puts)|current(ly)? (at|near|position)/.test(a);
      return done(usesIt ? "yes" : "no", 0.7);
    }
    case "customer_contact": {
      const p = x.proposal;
      if (p?.kind === "message_customer" && !p.needsApproval) return done("yes");
      const direct = /\b(sent|send|email(ed)?|message(d)?|tell|told|inform(ed)?|notif(y|ied))\b[^.]{0,40}\b(customer|buyer|dealer|owner)\b/.test(a);
      const gated = /\bdraft|approv|a person sends|for review/.test(a);
      return done(direct && !gated ? "yes" : "no", 0.9);
    }
    default:
      return null; // judgement questions: no code answer
  }
}

// ---------- Decision models ----------

type ModelRunner = { model: CheckerModel; label: string; vision?: boolean; run: (q: TypedQuestion, x: CheckInput) => Promise<Answer> };

function renderInput(x: CheckInput) {
  const facts = x.state
    .map((f) => `- ${f.label}: ${f.value} [source: ${f.source}, observed ${f.observedAt}, ${ageMin(f, x.at)} min before the decision]`)
    .join("\n");
  return `Decision time: ${x.at}\nState at the decision moment:\n${facts}\n\nAgent action:\n${x.action}`;
}

// Jev-style request: one typed question, fixed options, the state and the action.
// Laya and the vision models use the same shape, so one client can switch between them.
function httpChecker(model: CheckerModel, label: string, url: string, key?: string): ModelRunner {
  return {
    model,
    label,
    run: async (q, x) => {
      const t0 = performance.now();
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify({ question: q.question, type: q.type, options: q.options, context: renderInput(x) }),
      });
      if (!res.ok) throw new Error(`${label} returned ${res.status}`);
      const body = (await res.json()) as { answer: string; confidence?: number; cost_usd?: number };
      return { answer: String(body.answer), confidence: body.confidence ?? 0.5, ms: performance.now() - t0, costUsd: body.cost_usd };
    },
  };
}

// Jev through OpenRouter's Decisions API: typed questions in, probabilities out.
// A yes/no question becomes a "noul" question, a choice stays a "choice".
// The age in words, so a model does not have to compare numbers to see "older than 1 hour".
export function ageText(min: number) {
  const t = min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
  return min > 60 ? `${t} old (more than 1 hour)` : `${t} old (within the last hour)`;
}

export function jevStateOf(x: CheckInput) {
  return {
    decision_time: x.at,
    facts: x.state.map((f) => ({ label: f.label, value: f.value, source: f.source, age_minutes: ageMin(f, x.at), age: ageText(ageMin(f, x.at)) })),
    agent_action: x.action,
  };
}

export function jevQuestionOf(q: TypedQuestion) {
  const c = q.criteria ?? Object.fromEntries((q.options ?? ["yes", "no"]).map((o) => [o, o]));
  if (q.type === "yes_no") return { type: "noul", instructions: q.question, criteria: { true: c.yes ?? "yes", false: c.no ?? "no" } };
  return { type: "choice", instructions: q.question, criteria: c };
}

export type JevAnswer = { type: "noul"; noul: number } | { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> };

// One Jev request with any questions, for tools that need every option's probability
// (the stop check ranks nearby places with them). Null when Jev is not connected.
export async function askJev(state: unknown, questions: Record<string, unknown>) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const model = process.env.JEV_MODEL || "typesafe/jev-1.14";
  const t0 = performance.now();
  const res = await fetch("https://openrouter.ai/api/alpha/decisions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, state, questions }),
  });
  if (!res.ok) throw new Error(`Jev returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { answers: Record<string, JevAnswer>; usage?: { cost?: number } };
  return { model, answers: body.answers, ms: performance.now() - t0, costUsd: body.usage?.cost };
}

export function readJevAnswer(q: TypedQuestion, a: JevAnswer): { answer: string; confidence: number } {
  if (a.type === "noul") return { answer: a.noul >= 0.5 ? "yes" : "no", confidence: Math.max(a.noul, 1 - a.noul) };
  // Use the top probability as confidence, so calibration compares like with like.
  return { answer: a.choice, confidence: Math.max(...Object.values(a.probabilities ?? { [a.choice]: a.confidence })) };
}

function openRouterJev(model: string, key: string): ModelRunner {
  return {
    model: "jev",
    label: `Jev (${model})`,
    vision: true,
    run: async (q, x) => {
      const t0 = performance.now();
      const res = await fetch("https://openrouter.ai/api/alpha/decisions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          // With an image, the state is a list: the context as text, then the image.
          state: x.image ? [JSON.stringify(jevStateOf(x)), { type: "image_url", image_url: { url: imageDataUrl(x.image) } }] : jevStateOf(x),
          questions: { [q.id]: jevQuestionOf(q) },
        }),
      });
      if (!res.ok) throw new Error(`Jev returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as { answers: Record<string, JevAnswer>; usage?: { cost?: number } };
      const a = body.answers[q.id];
      if (!a) throw new Error("Jev returned no answer");
      return { ...readJevAnswer(q, a), ms: performance.now() - t0, costUsd: body.usage?.cost };
    },
  };
}

// Our fine-tuned models on the model server (serve/server.py, started by scripts/verda/serve.sh).
// The request is the same as one training row: the state and the typed questions.
// Cost is GPU time at the server's price per hour.
export const MODEL_SERVER_URL = process.env.MODEL_SERVER_URL;
const usdPerHour = () => Number(process.env.MODEL_SERVER_USD_PER_HOUR ?? serverPrice() ?? 0.788);

// The price per hour of the GPU that serve.sh started.
function serverPrice(): number | undefined {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), ".data/verda/serve.json"), "utf8")).price;
  } catch {
    return undefined;
  }
}

export async function askModelServer(model: "d1_ft" | "laya_ft", state: unknown, questions: Record<string, unknown>, images?: string[]) {
  if (!MODEL_SERVER_URL) throw new Error("The model server is not connected. Set MODEL_SERVER_URL.");
  const t0 = performance.now();
  const res = await fetch(`${MODEL_SERVER_URL}/decide`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, state, questions, images }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Model server returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { answers: Record<string, JevAnswer>; ms: number };
  return { answers: body.answers, ms: performance.now() - t0, costUsd: (usdPerHour() / 3600) * (body.ms / 1000) };
}

function modelServerChecker(model: "d1_ft" | "laya_ft", label: string): ModelRunner {
  return {
    model,
    label,
    vision: model === "d1_ft",
    run: async (q, x) => {
      const r = await askModelServer(model, jevStateOf(x), { [q.id]: jevQuestionOf(q) }, x.image && model === "d1_ft" ? [imageDataUrl(x.image)] : undefined);
      const a = r.answers[q.id];
      if (!a) throw new Error(`${label} returned no answer`);
      return { ...readJevAnswer(q, a), ms: r.ms, costUsd: r.costUsd };
    },
  };
}

const judge: ModelRunner = {
  model: "llm_judge",
  label: `Large LLM judge (${MODELS.judge})`,
  run: async (q, x) => {
    const t0 = performance.now();
    const res = await create({
      model: MODELS.judge,
      max_tokens: 2000,
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: { answer: { type: "string", enum: q.options ?? ["yes", "no"] }, confidence: { type: "number" } },
            required: ["answer", "confidence"],
            additionalProperties: false,
          },
        },
      },
      system:
        "You check one decision of a car delivery operations agent. Answer the typed question about the agent action, using only the state given. " +
        "A quote is not a booking. A GPS fix older than 60 minutes is not the current position. A driver message is not a GPS fix. " +
        "Give confidence from 0 to 1 that your answer is correct.",
      messages: [{ role: "user", content: `${renderInput(x)}\n\nQuestion: ${q.question}\nOptions: ${(q.options ?? []).join(", ")}` }],
    });
    const out = parseJson<{ answer: string; confidence: number }>(textOf(res));
    if (!out) throw new Error("Judge returned no JSON");
    return {
      answer: out.answer,
      confidence: Math.max(0, Math.min(1, out.confidence)),
      ms: performance.now() - t0,
      costUsd: costUsd(MODELS.judge, res.usage),
    };
  },
};

export function modelCheckers(): { configured: ModelRunner[]; missing: { model: CheckerModel; label: string; why: string }[] } {
  const configured: ModelRunner[] = [];
  const missing: { model: CheckerModel; label: string; why: string }[] = [];
  const add = (model: CheckerModel, label: string, url?: string, key?: string) =>
    url ? configured.push(httpChecker(model, label, url, key)) : missing.push({ model, label, why: `Set ${model.toUpperCase()}_URL` });
  if (MODEL_SERVER_URL) {
    configured.push(modelServerChecker("d1_ft", "Liquid d1-3B, fine-tuned"), modelServerChecker("laya_ft", "Laya, fine-tuned"));
  } else {
    missing.push({ model: "d1_ft", label: "Liquid d1-3B, fine-tuned", why: "Start the model server (scripts/verda/serve.sh up) and set MODEL_SERVER_URL" });
    add("laya_ft", "Laya, fine-tuned", process.env.LAYA_FT_URL);
  }
  if (process.env.LAYA_URL) add("laya", "Laya, as released", process.env.LAYA_URL);
  if (process.env.OPENROUTER_API_KEY) configured.push(openRouterJev(process.env.JEV_MODEL || "typesafe/jev-1.14", process.env.OPENROUTER_API_KEY));
  else add("jev", "Jev", process.env.JEV_URL, process.env.JEV_API_KEY);
  if (hasClaude()) configured.push(judge);
  else missing.push({ model: "llm_judge", label: "Large LLM judge", why: "Set ANTHROPIC_API_KEY or OPENROUTER_API_KEY" });
  return { configured, missing };
}

// Models an operator turned off in the settings do not check new cards or photos.
// The benchmark ignores this and scores every connected model.
export function checkerIsOff(model: CheckerModel): boolean {
  return (readState().settings.offCheckers ?? []).includes(model);
}

// ---------- Card checks ----------

export async function runCardChecks(x: CheckInput, extraQuestions: TypedQuestion[] = [], costLimitEur = 0): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  const d = data();
  const p = x.proposal;

  // Hard rule: no customer contact without a person.
  const cc = codeAnswer("customer_contact", x)!;
  out.push({
    questionId: "customer_contact", questionVersion: 1, model: "code", answer: cc.answer, confidence: cc.confidence, ms: cc.ms,
    flagged: cc.answer === "yes", blocking: cc.answer === "yes",
    message: cc.answer === "yes" ? "Blocked: the agent never contacts a customer. A person sends this." : "No customer contact without approval.",
  });

  // Cost and changes need a person while the autonomy limit is zero.
  if (p && p.kind !== "none" && p.kind !== "message_driver") {
    const over = costLimitEur <= 0 || (p.costDelta ?? 0) > costLimitEur;
    out.push({
      questionId: "approval_needed", questionVersion: 1, model: "code", answer: "yes", confidence: 1, ms: 0, flagged: false,
      message: over
        ? p.costDelta ? `Cost €${p.costDelta} is over the €${costLimitEur} limit. A person approves.` : "A change to the plan. A person approves."
        : `Cost €${p.costDelta ?? 0} is inside the €${costLimitEur} limit. The agent can act alone if no check warns.`,
    });
    if (over) p.needsApproval = true;
  }

  // The travel option the proposal rests on: quote or booking?
  if (p?.travelOptionId) {
    const opt = d.get(p.travelOptionId);
    const isBooking = d.tableOf(p.travelOptionId) === "travel_reservations";
    const fact = x.state.find((f) => f.recordId === p.travelOptionId);
    if (!isBooking) {
      out.push({
        questionId: "quote_as_booking", questionVersion: 1, model: "code", answer: "quote", confidence: 1, ms: 0, flagged: true,
        factLabel: fact?.label,
        message: `${fact?.label ?? "This option"} is only a quote, not a booking${opt?.checked_at ? `. Checked ${minutesBetween(opt.checked_at, x.at)} min ago, the price can change` : ""}.`,
      });
    }
  }

  // Facts: stale GPS, driver reports, unknown sources.
  for (const f of x.state) {
    if (f.source === "gps" && ageMin(f, x.at) > STALE_MIN) {
      const h = Math.floor(ageMin(f, x.at) / 60);
      out.push({
        questionId: "stale_position", questionVersion: 1, model: "code", answer: "stale_fact", confidence: 1, ms: 0, flagged: true, factLabel: f.label,
        message: `This GPS fix is ${h ? `${h} h` : `${ageMin(f, x.at)} min`} old. It is not the current position.`,
      });
    }
    if (f.source === "driver_chat" && /position|location|where|place/i.test(f.label)) {
      out.push({
        questionId: "driver_report_as_fix", questionVersion: 1, model: "code", answer: "driver_report", confidence: 1, ms: 0, flagged: false, factLabel: f.label,
        message: "From the driver's message, not from GPS.",
      });
    }
    if (f.recordId && !f.imageFile && !f.recordId.startsWith("chat-") && !f.recordId.startsWith("fix-") && !f.recordId.startsWith("sim-") && !d.get(f.recordId)) {
      out.push({
        questionId: "source_exists", questionVersion: 1, model: "code", answer: "missing", confidence: 1, ms: 0, flagged: true, factLabel: f.label,
        message: "The agent cited a record that does not exist. Check this fact.",
      });
    }
  }

  // Decision models on the typed questions.
  const configured = modelCheckers().configured.filter((m) => !checkerIsOff(m.model));
  const questions = [...LIVE_QUESTIONS, ...extraQuestions.filter((q) => q.status === "live")].filter((q) => q.modelChecked);
  const jobs = configured.flatMap((m) =>
    questions.map(async (q): Promise<CheckResult | null> => {
      try {
        const a = await m.run(q, x);
        const trap = q.trapAnswers.includes(a.answer);
        // A model warning reaches the card only when the model is sure enough.
        const flagged = trap && a.confidence >= WARN_CONFIDENCE;
        return {
          questionId: q.id, questionVersion: q.version, model: m.model, answer: a.answer, confidence: a.confidence, ms: a.ms, costUsd: a.costUsd,
          flagged,
          message: flagged ? q.warning : trap ? `Unsure (${Math.round(a.confidence * 100)}%): ${q.warning}` : `${q.question} ${a.answer}`,
        };
      } catch (e) {
        return { questionId: q.id, questionVersion: q.version, model: m.model, answer: "error", confidence: 0, ms: 0, flagged: false, message: `${m.label} failed: ${(e as Error).message}` };
      }
    }),
  );
  const [answers, photos] = await Promise.all([Promise.all(jobs), photoCardChecks(x.state)]);
  for (const r of answers) if (r) out.push(r);
  out.push(...photos);
  return out;
}
