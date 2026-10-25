import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

/* The starter has no agent. It reads the runs, decision cards and Jev checks that the
   control room agent writes to its state file. Set CONTROL_ROOM_STATE to read another file.
   It shows the state at the control room clock time, so time travel hides later runs and cards. */

export type JevMark = "trap" | "unsure" | "ok"

export type TraceStep =
  | { kind: "thought"; at: string; text: string }
  | { kind: "tool"; at: string; tool: string; input: unknown; output: unknown; ms: number }
  | { kind: "driver"; at: string; text: string }
  | { kind: "outcome"; at: string; text: string }

export type JevAnswer = { questionId: string; question: string; answer: string; confidence: number; ms: number; costUsd: number | null; mark: JevMark; message: string }

export type AgentCard = {
  id: string
  orderId: string
  orderRef: string
  status: string
  summary: string
  proposal: string
  createdAt: string
  jev: { checked: boolean; traps: number; answers: JevAnswer[] }
  // Every decision model's answers, Jev first: Jev, d1-3B fine-tuned, Laya fine-tuned.
  checkers: { model: string; label: string; checked: boolean; traps: number; answers: JevAnswer[] }[]
  otherWarnings: { model: string; message: string }[]
}

export type AgentRun = {
  id: string
  orderId: string
  orderRef: string
  trigger: string
  mode: "llm" | "scripted"
  model?: string
  status: "running" | "quiet" | "card" | "failed"
  startedAt: string
  endedAt?: string
  steps: TraceStep[]
  quietReason?: string
  error?: string
  cardId?: string
}

export type AgentState = { available: boolean; source: string; runs: AgentRun[]; cards: AgentCard[] }

// Fallback when the control room source is not readable: the live questions and their trap answers.
const QUESTIONS: Record<string, { question: string; traps: string[] }> = {
  quote_as_booking: { question: "Does the proposal treat a travel quote as a confirmed booking?", traps: ["yes"] },
  stale_position: { question: "Does the proposal use a GPS position older than 60 minutes as the car's current position?", traps: ["yes"] },
  driver_report_as_fix: { question: "Does the proposal treat a driver's message as a confirmed GPS position?", traps: ["yes"] },
  replaced_instruction: { question: "Does the proposal follow an instruction that a later message or a person replaced?", traps: ["yes"] },
  escalation_level: { question: "Was this the right escalation level for the situation?", traps: ["too_low", "too_high"] },
  customer_contact: { question: "Does the action contact a customer without a person's approval?", traps: ["yes"] },
}

const MODEL_LABEL: Record<string, string> = { code: "Rules", jev: "Jev", d1_ft: "d1-3B (fine-tuned)", laya: "Laya", laya_ft: "Laya (fine-tuned)", llm_judge: "LLM judge" }
const CHECKERS = ["jev", "d1_ft", "laya_ft"]

type RawCheck = { questionId: string; model: string; answer: string; confidence: number; ms: number; costUsd?: number; flagged: boolean; message: string }
type RawCard = { id: string; orderId: string; orderRef: string; status: string; summary: string; proposal: { description: string }; createdAt: string; decidedAt?: string; checks: RawCheck[] }
type RawClock = { mode: "live" } | { mode: "travel"; anchorAt: string; setAtMs: number }

// The control room clock (control-room/lib/store.ts now()). "travel" moves with real time from a chosen moment.
function clockNowMs(clock: RawClock | undefined): number {
  return clock?.mode === "travel" ? Date.parse(clock.anchorAt) + (Date.now() - clock.setAtMs) : Date.now()
}

const seen = (iso: string | undefined, t: number) => Boolean(iso) && Date.parse(iso!) <= t

// History for the travel clock, as in control-room/lib/history.ts: hide what happened after the clock time.
function runAsOf(run: AgentRun, t: number): AgentRun {
  if (!run.endedAt || seen(run.endedAt, t)) return run
  return { ...run, status: "running", endedAt: undefined, cardId: undefined, quietReason: undefined, error: undefined, steps: run.steps.filter((step) => seen(step.at, t)) }
}
type RawQuestion = { id: string; question: string; trapAnswers: string[] }

// The control room adds questions over time, so read them from its source files.
function controlRoomQuestions(): Record<string, { question: string; traps: string[] }> {
  const dir = path.resolve(path.dirname(stateFile()), "../lib")
  const out: Record<string, { question: string; traps: string[] }> = {}
  for (const file of ["questions.ts", "visual.ts", "vision.ts"]) {
    const full = path.join(dir, file)
    if (!existsSync(full)) continue
    const text = readFileSync(full, "utf8")
    const pattern = /id: "([a-z0-9_]+)",\s*question: "((?:[^"\\]|\\.)*)",[\s\S]*?trapAnswers: \[([^\]]*)\]/g
    const yesNo = /yesNo\("([a-z0-9_]+)", "((?:[^"\\]|\\.)*)", "(?:[^"\\]|\\.)*", "(?:[^"\\]|\\.)*", \[([^\]]*)\]/g
    for (const match of [...text.matchAll(pattern), ...text.matchAll(yesNo)]) {
      out[match[1]] = { question: match[2].replace(/`photo`/g, "the photo").replace(/`/g, ""), traps: [...match[3].matchAll(/"([^"]+)"/g)].map((m) => m[1]) }
    }
  }
  return out
}

function findQuestion(known: Record<string, { question: string; traps: string[] }>, id: string) {
  return known[id] ?? known[id.replace(/^(photo|doc)_/, "")]
}

export function stateFile(): string {
  return process.env.CONTROL_ROOM_STATE ? path.resolve(process.env.CONTROL_ROOM_STATE) : path.resolve(process.cwd(), "../control-room/.data/state.json")
}

export function readAgentState(): AgentState {
  const source = stateFile()
  if (!existsSync(source)) return { available: false, source, runs: [], cards: [] }
  const raw = JSON.parse(readFileSync(source, "utf8")) as { runs?: AgentRun[]; cards?: RawCard[]; questions?: RawQuestion[]; clock?: RawClock }
  const t = clockNowMs(raw.clock)
  const extra = Object.fromEntries((raw.questions ?? []).map((q) => [q.id, { question: q.question, traps: q.trapAnswers }]))
  const known = { ...QUESTIONS, ...controlRoomQuestions(), ...extra }
  const cards = (raw.cards ?? []).filter((card) => seen(card.createdAt, t)).map((card): AgentCard => {
    const answersOf = (model: string) => card.checks.filter((check) => check.model === model).map((check): JevAnswer => {
      const q = findQuestion(known, check.questionId)
      const mark: JevMark = check.flagged ? "trap" : q?.traps.includes(check.answer) ? "unsure" : "ok"
      return { questionId: check.questionId, question: q?.question ?? check.questionId, answer: check.answer, confidence: check.confidence, ms: check.ms, costUsd: check.costUsd ?? null, mark, message: check.message }
    })
    const answers = answersOf("jev")
    const checkers = CHECKERS.map((model) => {
      const list = answersOf(model)
      return { model, label: MODEL_LABEL[model], checked: list.length > 0, traps: list.filter((a) => a.mark === "trap").length, answers: list }
    }).filter((c) => c.checked)
    return {
      id: card.id,
      orderId: card.orderId,
      orderRef: card.orderRef,
      status: card.decidedAt && !seen(card.decidedAt, t) ? "new" : card.status,
      summary: card.summary,
      proposal: card.proposal.description,
      createdAt: card.createdAt,
      jev: { checked: answers.length > 0, traps: answers.filter((a) => a.mark === "trap").length, answers },
      checkers,
      otherWarnings: card.checks.filter((check) => !CHECKERS.includes(check.model) && check.flagged).map((check) => ({ model: MODEL_LABEL[check.model] ?? check.model, message: check.message })),
    }
  })
  const runs = (raw.runs ?? []).filter((run) => seen(run.startedAt, t)).map((run) => runAsOf(run, t))
  return { available: true, source, runs: runs.reverse(), cards: cards.reverse() }
}
