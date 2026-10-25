import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  AgentRun, BenchmarkRow, ChatMessage, DecisionCard, DecisionTrace, EvalCandidate, GpsFix, PhotoCheck, TimelineEvent, TypedQuestion,
} from "./types";

// Local state on top of the fixed snapshot: runs, cards, simulated messages and fixes.
// A JSON file is enough: one operator, one machine, and scripts share it with the app.

export type Benchmark = { set: string; ranAt: string; rows: BenchmarkRow[]; testCases: number };

// The clock has two modes. "live" uses the real time. "travel" starts at a chosen moment
// (anchorAt) and moves with real time from setAtMs, the real time when it was set.
export type Clock = { mode: "live" } | { mode: "travel"; anchorAt: string; setAtMs: number };

export type State = {
  version: number;
  clock: Clock;
  settings: {
    costLimitEur: number;
    operator: string;
    // Decision models that an operator turned off. They do not check new cards. All are on by default.
    offCheckers?: string[];
    // The model that answers the agent's check_image tool. "auto": Jev first, then d1-3B fine-tuned.
    imageModel?: "auto" | "jev" | "d1_ft";
  };
  runs: AgentRun[];
  cards: DecisionCard[];
  traces: DecisionTrace[];
  chat: ChatMessage[];
  fixes: GpsFix[];
  timeline: TimelineEvent[];
  candidates: EvalCandidate[];
  questions: TypedQuestion[]; // proposed questions from the discovery agent
  quietLog: { runId: string; orderRef: string; at: string; reason: string }[];
  benchmarks?: Record<string, Benchmark>; // by eval set: "hand", "synthetic"
  photoChecks?: Record<string, PhotoCheck[]>; // by photo id; answers are reused, not bought twice
};

const DIR = process.env.STATE_DIR ? path.resolve(process.env.STATE_DIR) : path.resolve(process.cwd(), ".data");
export const STATE_FILE = path.join(DIR, "state.json");
const FILE = STATE_FILE;

function fresh(): State {
  return {
    version: 1,
    clock: { mode: "live" },
    settings: { costLimitEur: 0, operator: "Ops shift" },
    runs: [], cards: [], traces: [], chat: [], fixes: [], timeline: [], candidates: [], questions: [], quietLog: [],
  };
}

export function readState(): State {
  if (!fs.existsSync(FILE)) return fresh();
  try {
    return { ...fresh(), ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  } catch {
    return fresh();
  }
}

// DEMO_READONLY=1 serves a fixed state file, for example on Vercel, where the disk is read-only.
export const READONLY = process.env.DEMO_READONLY === "1";

function writeState(s: State) {
  if (READONLY) throw new Error("This is a read-only copy. Changes are not saved.");
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(s, null, 1));
  fs.renameSync(tmp, FILE);
}

// Read, change and write in one step. Callers keep the work inside fn short.
export function update<T>(fn: (s: State) => T): T {
  const s = readState();
  const out = fn(s);
  s.version += 1;
  writeState(s);
  return out;
}

export function resetState(keepBenchmark = true) {
  const old = readState();
  const s = fresh();
  s.clock = old.clock;
  s.settings.offCheckers = old.settings?.offCheckers;
  s.settings.imageModel = old.settings?.imageModel;
  if (keepBenchmark) {
    s.benchmarks = old.benchmarks;
    s.photoChecks = old.photoChecks;
  }
  writeState(s);
}

export function id(prefix: string) {
  return `${prefix}-${crypto.randomBytes(5).toString("hex")}`;
}

// The one clock of the app. Every screen and the API read the time from here.
export function clockNowMs(clock: Clock | undefined): number {
  if (clock?.mode === "travel") return Date.parse(clock.anchorAt) + (Date.now() - clock.setAtMs);
  return Date.now();
}

export function now(state?: State): Date {
  const s = state ?? readState();
  return new Date(clockNowMs(s.clock));
}

// Go back to the real time, or travel to a moment. The travel clock then moves with real time.
export function setClock(next: { mode: "live" } | { mode: "travel"; at: string }) {
  if (next.mode === "travel" && Number.isNaN(Date.parse(next.at))) throw new Error("Write a valid date and time.");
  update((s) => {
    s.clock = next.mode === "travel" ? { mode: "travel", anchorAt: new Date(next.at).toISOString(), setAtMs: Date.now() } : { mode: "live" };
  });
}

// What a client clock needs: the mode and the offset from the real time in ms.
export type ClockInfo = { mode: Clock["mode"]; now: string; offsetMs: number };

export function clockInfo(state?: State): ClockInfo {
  const s = state ?? readState();
  const t = clockNowMs(s.clock);
  return { mode: s.clock?.mode ?? "live", now: new Date(t).toISOString(), offsetMs: s.clock?.mode === "travel" ? t - Date.now() : 0 };
}

export function nowIso(state?: State) {
  return now(state).toISOString();
}

export function minutesBetween(a: string | Date, b: string | Date) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

export function addMinutes(d: string | Date, min: number) {
  return new Date(new Date(d).getTime() + min * 60000).toISOString();
}
