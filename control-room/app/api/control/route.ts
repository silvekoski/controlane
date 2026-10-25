import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { startRun } from "@/lib/agent";
import { EVAL_SETS, loadCases, runBenchmark, type EvalSet } from "@/lib/benchmark";
import { data } from "@/lib/data";
import { approveCard, operatorMessageDriver, REJECT_REASONS, rejectCard, simulateWorldChange } from "@/lib/decisions";
import { approveQuestion, labelCandidate, retireQuestion, runDiscovery } from "@/lib/discovery";
import { LIVE_QUESTIONS } from "@/lib/questions";
import { SCENARIOS } from "@/lib/scenarios";
import { clockInfo, nowIso, READONLY, readState, resetState, setClock, update, type Benchmark, type State } from "@/lib/store";
import { feed, FEED_LABEL, nextEventAt } from "@/lib/feed";
import { viewState } from "@/lib/history";
import type { DecisionCard, RejectReason } from "@/lib/types";
import {
  cardContext, cardKind, escalation, fmtAge, fmtLeft, fmtTime, jevMark, lastStepLine, modelsView, orderBasics, queue, scenarioStatus, SOURCE_LABEL, system,
} from "@/lib/view";
import { VISUAL_QUESTIONS } from "@/lib/vision";
import { visualQuestion } from "@/lib/visual";
import { allMessages } from "@/lib/world";
import { cars, stopSteps } from "@/lib/tracking";
import { MODEL_SERVER_URL } from "@/lib/checks";
import { CAUSE_LABEL, STOP_RULE_TEXT, typeLabel } from "@/lib/stopcheck";

// A JSON API for other interfaces, such as the redesigned starter app.
// GET ?view=queue|card|evals|label|chat|clock reads; POST { action, ... } decides.
// Every GET first fires due events (lib/feed.ts) and shows the state at the clock time.
// Every GET answer has "clock": the mode (live or travel), the time and the event feed.
// It uses the same functions as the control room screens, so the rules stay in one place.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL_LABEL: Record<string, string> = {
  code: "Rules", laya: "Laya", laya_ft: "Laya (fine-tuned)", d1_ft: "d1-3B (fine-tuned)", jev: "Jev", llm_judge: "Claude judge",
  jev_vision: "Jev (photo)", selfjev: "SelfJev (photo)", d1: "Liquid d1 (photo)", d1_omni: "Liquid d1 omni (photo)", llm_judge_vision: "Claude judge (photo)",
};

function questionText(s: State, qid: string) {
  const q = [...LIVE_QUESTIONS, ...s.questions, ...VISUAL_QUESTIONS].find((x) => x.id === qid) ?? visualQuestion(qid);
  return q?.question.replace("`photo`", "the photo") ?? qid;
}

function cardRow(s: State, c: DecisionCard, now: string) {
  const b = orderBasics(c.orderRef);
  const jev = c.checks.filter((x) => x.model === "jev");
  return {
    id: c.id,
    orderId: c.orderId,
    orderRef: c.orderRef,
    status: c.status,
    summary: c.summary,
    deadline: c.deadline,
    deadlineLabel: c.deadlineLabel,
    left: fmtLeft(c.deadline, now),
    age: fmtAge(c.createdAt, now),
    car: b.car,
    customer: b.customer,
    driver: b.driver,
    kind: cardKind(s, c),
    escalation: escalation(c),
    warnings: c.checks.filter((x) => x.flagged).length,
    blocked: c.checks.some((x) => x.blocking),
    jev: { checked: jev.length > 0, traps: jev.filter((x) => x.flagged).length },
    decidedBy: c.decidedBy ?? null,
    decidedAt: c.decidedAt ? fmtTime(c.decidedAt) : null,
    outcome: c.outcome ?? null,
    proposal: { kind: c.proposal.kind, description: c.proposal.description, costDelta: c.proposal.costDelta ?? null },
  };
}

function queueView(s: State) {
  const now = nowIso(s);
  const q = queue(s);
  const sys = system();
  return {
    now,
    settings: s.settings,
    system: { claude: sys.claude, provider: sys.provider, checkers: sys.checkers, missing: sys.missingCheckers },
    open: q.open.map((c) => cardRow(s, c, now)),
    decided: q.decided.slice(0, 12).map((c) => cardRow(s, c, now)),
    running: q.running.map((r) => ({ id: r.id, orderId: r.orderId, orderRef: r.orderRef, started: fmtAge(r.startedAt, now), line: lastStepLine(r) })),
    quiet: q.quiet.slice(0, 12).map((x) => ({ ...x, at: fmtAge(x.at, now), orderId: data().order(x.orderRef)?.id ?? null })),
    failed: q.failed.map((r) => ({ id: r.id, orderRef: r.orderRef, error: r.error ?? "Unknown error" })),
    onTrack: q.onTrack,
    activeOrders: q.activeOrders,
    deliveredOrDone: q.deliveredOrDone,
    scenarios: scenarioStatus(s).map((sc) => ({ id: sc.id, title: sc.title, orderRef: sc.orderRef, status: sc.lastRun?.status ?? null })),
  };
}

function cardView(s: State, cardId: string) {
  const card = s.cards.find((c) => c.id === cardId);
  if (!card) return null;
  const now = nowIso(s);
  const ctx = cardContext(s, card);
  const run = s.runs.find((r) => r.id === card.runId);
  const changeMsg = card.status === "changed" ? s.chat.filter((m) => m.orderId === card.orderId && m.from === "driver").at(-1) : undefined;
  const sys = system();
  return {
    now,
    row: cardRow(s, card, now),
    context: ctx,
    facts: card.facts.map((f) => ({
      label: f.label,
      value: f.value,
      source: SOURCE_LABEL[f.source] ?? f.source,
      age: fmtAge(f.observedAt, now),
      imageFile: f.imageFile ?? null,
      warnings: card.checks.filter((c) => c.factLabel === f.label).map((c) => ({ flagged: c.flagged, message: c.message, model: MODEL_LABEL[c.model] ?? c.model })),
    })),
    agentActions: card.agentActions,
    proposal: card.proposal,
    // Warnings that do not sit next to one fact.
    general: card.checks
      .filter((c) => c.flagged && (!c.factLabel || !card.facts.some((f) => f.label === c.factLabel)))
      .map((c) => ({ message: c.message, model: MODEL_LABEL[c.model] ?? c.model, blocking: Boolean(c.blocking) })),
    // Every model answer, one row per question, so Jev, Laya and the judge sit side by side.
    answers: [...new Set(card.checks.filter((c) => c.model !== "code").map((c) => c.questionId))].map((qid) => ({
      questionId: qid,
      question: questionText(s, qid),
      byModel: card.checks
        .filter((c) => c.questionId === qid && c.model !== "code")
        .map((c) => ({ model: c.model, label: MODEL_LABEL[c.model] ?? c.model, answer: c.answer, confidence: c.confidence, ms: c.ms, mark: jevMark(c, s.questions), message: c.message })),
    })),
    run: run ? { id: run.id, mode: run.mode, model: run.model ?? null } : null,
    stop: run?.stop ? { ...stopView(run.stop), steps: stopSteps(run).map((st) => ({ ...st, time: fmtTime(st.at) })) } : null,
    changeMsg: changeMsg ? { text: changeMsg.text, age: fmtAge(changeMsg.at, now) } : null,
    rejectReason: card.rejectReason ? REJECT_REASONS[card.rejectReason] : null,
    rejectNote: card.rejectNote ?? null,
    rejectReasons: REJECT_REASONS,
    canRedo: sys.claude,
    checkers: sys.checkers,
    missingCheckers: sys.missingCheckers,
  };
}

function lastBenchmark(s: State, set: EvalSet): Benchmark | undefined {
  if (s.benchmarks?.[set]) return s.benchmarks[set];
  const file = path.resolve(process.cwd(), `eval/results-${set}.json`);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Benchmark) : undefined;
}

function evalsView(s: State) {
  const sets = (Object.keys(EVAL_SETS) as EvalSet[]).map((set) => {
    let counts: { test: number; other: number } | null = null;
    try {
      const all = loadCases(set);
      counts = { test: all.filter((c) => c.split === "test").length, other: all.filter((c) => c.split !== "test").length };
    } catch {
      // Set not generated yet.
    }
    const b = lastBenchmark(s, set);
    return { id: set, label: EVAL_SETS[set], counts, ranAt: b ? fmtTime(b.ranAt) : null, rows: b?.rows ?? [] };
  });
  const live = [...LIVE_QUESTIONS, ...s.questions.filter((q) => q.status === "live")];
  return {
    settings: s.settings,
    canDiscover: system().claude,
    sets,
    questionText: Object.fromEntries(live.map((q) => [q.id, q.question])),
    live: live.map((q) => ({ id: q.id, question: q.question, source: q.source, version: q.version, approvedBy: q.approvedBy ?? null, modelChecked: q.modelChecked })),
    proposed: s.questions.filter((q) => q.status === "proposed").map((q) => ({ id: q.id, question: q.question, source: q.source })),
    unlabeled: s.candidates.filter((c) => !c.label).length,
    labeled: s.candidates.filter((c) => c.label).length,
  };
}

function labelView(s: State) {
  const now = nowIso(s);
  const todo = s.candidates.filter((c) => !c.label);
  const c = todo[0];
  return {
    left: todo.length,
    candidate: c
      ? {
          id: c.id,
          source: c.source,
          orderRef: c.orderRef,
          question: c.question,
          options: c.options,
          suggested: c.suggestedAnswer ?? null,
          action: c.action,
          state: c.state.map((f) => ({ label: f.label, value: f.value, source: SOURCE_LABEL[f.source] ?? f.source, age: fmtAge(f.observedAt, now) })),
        }
      : null,
    ...labelLists(s, now),
  };
}

// Lists and counts for the labeling page. They read the same candidates as "left" and "candidate".
function labelLists(s: State, now: string) {
  const byTime = (a?: string, b?: string) => (b ?? "").localeCompare(a ?? "");
  const done = s.candidates.filter((c) => c.label);
  const agrees = (c: (typeof s.candidates)[number]) => c.suggestedAnswer != null && c.label === c.suggestedAnswer;
  const waiting = s.candidates
    .filter((c) => !c.label)
    .sort((a, b) => byTime(a.createdAt, b.createdAt))
    .map((c) => ({
      id: c.id, source: c.source, orderRef: c.orderRef, questionId: c.questionId, question: c.question,
      suggested: c.suggestedAnswer ?? null, createdAt: c.createdAt, age: fmtAge(c.createdAt, now),
    }));
  const recent = [...done]
    .sort((a, b) => byTime(a.labeledAt, b.labeledAt))
    .slice(0, 20)
    .map((c) => ({
      id: c.id, source: c.source, orderRef: c.orderRef, questionId: c.questionId, question: c.question,
      suggested: c.suggestedAnswer ?? null, label: c.label ?? "", note: c.labelNote ?? null,
      labeledAt: c.labeledAt ?? null, labeledAge: c.labeledAt ? fmtAge(c.labeledAt, now) : null, labeledBy: c.labeledBy ?? null,
    }));
  const qmap = new Map<string, { questionId: string; question: string; waiting: number; labeled: number; agreed: number }>();
  for (const c of s.candidates) {
    const row = qmap.get(c.questionId) ?? { questionId: c.questionId, question: c.question, waiting: 0, labeled: 0, agreed: 0 };
    if (c.label) {
      row.labeled++;
      if (agrees(c)) row.agreed++;
    } else row.waiting++;
    qmap.set(c.questionId, row);
  }
  const bySource = (["operator_reject", "discovery_agent"] as const).map((source) => ({
    source,
    waiting: s.candidates.filter((c) => c.source === source && !c.label).length,
    labeled: done.filter((c) => c.source === source).length,
  }));
  const withSuggestion = done.filter((c) => c.suggestedAnswer != null);
  return {
    waiting,
    recent,
    byQuestion: [...qmap.values()].sort((a, b) => b.waiting + b.labeled - (a.waiting + a.labeled)),
    bySource,
    agreement: { agreed: withSuggestion.filter(agrees).length, total: withSuggestion.length },
  };
}

// The live map: every car on the road at the clock time, and the stop checks of the agent.
function trackingView(s: State) {
  const now = nowIso(s);
  const list = cars(s);
  const states = Object.fromEntries(feed(s).map((e) => [e.id, { state: e.state, label: FEED_LABEL[e.state], at: fmtTime(e.at) }]));
  const sys = system();
  return {
    now,
    rule: STOP_RULE_TEXT,
    models: stopModels(sys.checkers),
    counts: {
      moving: list.filter((c) => c.status === "moving").length,
      stopped: list.filter((c) => c.status === "stopped").length,
      signalLost: list.filter((c) => c.status === "signal_lost").length,
      arrived: list.filter((c) => c.status === "arrived").length,
    },
    cars: list.map((c) => {
      const run = c.event?.runId ? s.runs.find((r) => r.id === c.event!.runId) : undefined;
      return {
        ...c,
        stoppedFor: c.stoppedSince ? fmtAge(c.stoppedSince, now).replace(/ ago$/, "") : null,
        gpsAge: c.gpsAgeMin > 1 ? fmtAge(new Date(Date.parse(now) - c.gpsAgeMin * 60000).toISOString(), now) : "now",
        event: c.event
          ? {
              ...c.event,
              feed: states[c.event.scenarioId] ?? null,
              stop: c.event.stop ? stopView(c.event.stop) : null,
              steps: stopSteps(run).map((st) => ({ ...st, time: fmtTime(st.at) })),
              checks: cardChecks(s, c.event.cardId),
            }
          : null,
      };
    }),
  };
}

// The models on a stop, one row each, with every job it does: rank the stop, give a second opinion, check the card.
function stopModels(checkers: string[]) {
  const checks = (re: RegExp) => checkers.some((c) => re.test(c));
  const CHECK = "Checks the decision card for known traps";
  const rows = [
    { label: `Jev (${process.env.JEV_MODEL || "typesafe/jev-1.14"})`, connected: Boolean(process.env.OPENROUTER_API_KEY), roles: ["Ranks the places and the cause: its ranking drives the next step", ...(checks(/^Jev/) ? [CHECK] : [])] },
    { label: "d1-3B, fine-tuned (our GPU)", connected: Boolean(MODEL_SERVER_URL), roles: ["Second opinion on the stop ranking", ...(checks(/d1/) ? [CHECK] : [])] },
    { label: "Laya, fine-tuned (our GPU)", connected: Boolean(MODEL_SERVER_URL), roles: ["Second opinion on the stop ranking", ...(checks(/Laya/) ? [CHECK] : [])] },
    ...checkers.filter((c) => !/^Jev|d1|Laya/.test(c)).map((c) => ({ label: c, connected: true, roles: [CHECK] })),
  ];
  return rows.map((r) => ({ label: r.label, connected: r.connected, role: r.roles.join(". ") + "." }));
}

// How each decision model checked the card: answers and trap warnings per model.
function cardChecks(s: State, cardId: string | undefined) {
  const card = cardId ? s.cards.find((c) => c.id === cardId) : undefined;
  if (!card) return [];
  const models = [...new Set(card.checks.filter((c) => c.model !== "code").map((c) => c.model))];
  return models.map((m) => {
    const list = card.checks.filter((c) => c.model === m);
    return {
      model: m,
      label: MODEL_LABEL[m] ?? m,
      answered: list.filter((c) => c.answer !== "error").length,
      traps: list.filter((c) => c.flagged).length,
      ms: Math.round(list.reduce((a, c) => a + c.ms, 0) / Math.max(1, list.length)),
      warnings: list.filter((c) => c.flagged).map((c) => c.message),
    };
  });
}

function stopView(st: NonNullable<DecisionCard["stop"]>) {
  return {
    ...st,
    places: st.places.map((p) => ({ ...p, typeLabel: typeLabel(p.type), probability: st.ranking?.places.find((r) => r.id === p.id)?.probability ?? null })),
    ranking: st.ranking
      ? { ...st.ranking, causes: st.ranking.causes.map((c) => ({ ...c, label: CAUSE_LABEL[c.id] ?? c.label })), byJev: !st.ranking.model.startsWith("rules") }
      : null,
  };
}

function clockView(s: State) {
  return {
    ...clockInfo(s),
    nextEventAt: nextEventAt(s),
    feed: feed(s).map((e) => ({ ...e, label: FEED_LABEL[e.state] })),
  };
}

function chatView(s: State, orderId: string) {
  const now = nowIso(s);
  const o = data().t.orders.find((x) => x.id === orderId || x.reference === orderId);
  if (!o) return null;
  const persona = SCENARIOS.find((sc) => sc.orderRef === o.reference)?.driver;
  return {
    orderRef: o.reference,
    driver: orderBasics(o.reference).driver,
    simulatedDriver: Boolean(persona),
    messages: allMessages(s, o.id)
      .filter((m) => m.channel === "driver_chat")
      .map((m) => ({ id: m.id, from: m.from, text: m.text, at: fmtTime(m.at), age: fmtAge(m.at, now), simulated: !m.dataset })),
  };
}

export function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const s = viewState();
  const clock = clockView(s);
  const json = (v: object) => NextResponse.json({ ...v, clock });
  switch (p.get("view") ?? "queue") {
    case "queue":
      return json(queueView(s));
    case "clock":
      return json({});
    case "models":
      return json(modelsView());
    case "card": {
      const v = cardView(s, p.get("id") ?? "");
      return v ? json(v) : NextResponse.json({ error: "No such card", clock }, { status: 404 });
    }
    case "evals":
      return json(evalsView(s));
    case "tracking":
      return json(trackingView(s));
    case "label":
      return json(labelView(s));
    case "chat": {
      const v = chatView(s, p.get("order") ?? "");
      return v ? json(v) : NextResponse.json({ error: "No such order", clock }, { status: 404 });
    }
    default:
      return NextResponse.json({ error: "Unknown view" }, { status: 400 });
  }
}

type Body = Record<string, unknown> & { action?: string };

const str = (v: unknown) => (typeof v === "string" ? v : "");

export async function POST(request: NextRequest) {
  if (READONLY) return NextResponse.json({ error: "This is a read-only copy. Changes are not saved." }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as Body;
  try {
    switch (body.action) {
      case "approve": {
        const e = body.edits as { description?: string; costDelta?: number; customerDraft?: string; note?: string } | undefined;
        return NextResponse.json(approveCard(str(body.cardId), e));
      }
      case "reject":
        rejectCard(str(body.cardId), (str(body.reason) || "other") as RejectReason, str(body.note) || undefined);
        return NextResponse.json({ ok: true });
      case "redo": {
        const s = readState();
        const card = s.cards.find((c) => c.id === body.cardId);
        const run = s.runs.find((r) => r.id === card?.runId);
        if (!card || !run) return NextResponse.json({ error: "No such card" }, { status: 404 });
        rejectCard(card.id, "other", str(body.note));
        const next = startRun(run.scenarioId, { instruction: str(body.note) });
        return NextResponse.json({ ok: true, runId: next.id, orderId: next.orderId });
      }
      case "message_driver":
        if (!str(body.text).trim()) return NextResponse.json({ error: "Write a message" }, { status: 400 });
        await operatorMessageDriver(str(body.orderRef), str(body.text).trim());
        return NextResponse.json({ ok: true });
      case "start": {
        const run = startRun(str(body.scenarioId));
        return NextResponse.json({ ok: true, runId: run.id, orderId: run.orderId });
      }
      case "start_all": {
        const s = readState();
        for (const sc of SCENARIOS) if (!s.runs.some((r) => r.scenarioId === sc.id && r.status === "running")) startRun(sc.id);
        return NextResponse.json({ ok: true });
      }
      case "set_clock": {
        if (body.mode === "live") setClock({ mode: "live" });
        else if (body.mode === "travel") setClock({ mode: "travel", at: str(body.at) });
        else return NextResponse.json({ error: 'Send mode "live", or mode "travel" with "at".' }, { status: 400 });
        return NextResponse.json({ ok: true, clock: clockInfo() });
      }
      // Test hook: adds a driver message, so the facts change after a card was made.
      case "change_fact":
        simulateWorldChange(str(body.orderRef), str(body.text) || "Update: the situation changed, please call me before you book anything.");
        return NextResponse.json({ ok: true });
      // For tests and scripts: clears runs, cards and chat. The clock stays as it is.
      case "reset":
        resetState(true);
        return NextResponse.json({ ok: true });
      // Model settings: turn a decision model on or off for new cards and photos.
      case "set_checker": {
        const model = str(body.model);
        if (!modelsView().models.some((m) => m.model === model)) return NextResponse.json({ error: `No model ${model}` }, { status: 400 });
        update((s) => {
          const off = new Set(s.settings.offCheckers ?? []);
          if (body.on === false) off.add(model);
          else off.delete(model);
          s.settings.offCheckers = [...off];
        });
        return NextResponse.json({ ok: true, ...modelsView() });
      }
      // The model that answers the agent's check_image tool: auto, jev or d1_ft.
      case "image_model": {
        const model = str(body.model);
        if (model !== "auto" && model !== "jev" && model !== "d1_ft") return NextResponse.json({ error: 'Send model "auto", "jev" or "d1_ft".' }, { status: 400 });
        update((s) => {
          s.settings.imageModel = model;
        });
        return NextResponse.json({ ok: true, ...modelsView() });
      }
      case "cost_limit": {
        const eur = Number(body.eur);
        if (!Number.isFinite(eur)) return NextResponse.json({ error: "Write a number" }, { status: 400 });
        update((s) => {
          s.settings.costLimitEur = Math.max(0, Math.round(eur));
        });
        return NextResponse.json({ ok: true });
      }
      case "benchmark":
        await runBenchmark("hand");
        try {
          await runBenchmark("synthetic");
        } catch {
          // No synthetic set generated yet.
        }
        return NextResponse.json({ ok: true });
      case "discover":
        await runDiscovery();
        return NextResponse.json({ ok: true });
      case "make_live":
        approveQuestion(str(body.questionId), readState().settings.operator);
        return NextResponse.json({ ok: true });
      case "retire":
        retireQuestion(str(body.questionId));
        return NextResponse.json({ ok: true });
      case "label":
        labelCandidate(str(body.candidateId), str(body.answer), str(body.note) || undefined, readState().settings.operator);
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
