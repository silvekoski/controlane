import fs from "node:fs";
import { startRun } from "./agent";
import { data } from "./data";
import { SCENARIOS } from "./scenarios";
import { clockNowMs, READONLY, readState, STATE_FILE, type State } from "./store";

// The event feed. Each scenario is an event with a time on 21 Oct 2026.
// When the clock passes that time, tick() starts one agent run for the event.
// The read paths (screens and GET /api/control) call tick(), so events fire as the clock moves.

// An event fires only inside this window after its time. Later, it is "missed" and stays unrun,
// so a run never starts with a decision time days after the event.
export const FIRE_WINDOW_MIN = 120;

export type FeedState = "upcoming" | "due" | "running" | "card" | "closed" | "failed" | "missed";

export type FeedItem = {
  id: string;
  at: string;
  orderRef: string;
  orderId: string | null;
  title: string;
  state: FeedState;
  runId?: string;
  cardId?: string;
};

const LOCK = `${STATE_FILE}.feed.lock`;
const STALE_LOCK_MS = 30_000;

// A lock file stops two requests (or two processes) from starting the same event twice.
function withLock(fn: () => void) {
  let fd: number;
  try {
    fd = fs.openSync(LOCK, "wx");
  } catch {
    try {
      if (Date.now() - fs.statSync(LOCK).mtimeMs < STALE_LOCK_MS) return;
      fs.rmSync(LOCK, { force: true });
      fd = fs.openSync(LOCK, "wx");
    } catch {
      return;
    }
  }
  try {
    fn();
  } finally {
    fs.closeSync(fd);
    fs.rmSync(LOCK, { force: true });
  }
}

function due(s: State, nowMs: number) {
  return SCENARIOS.filter((sc) => {
    const at = Date.parse(sc.at);
    // Any run of the event counts, also a run that is still in the future of a travel clock.
    return at <= nowMs && nowMs - at <= FIRE_WINDOW_MIN * 60_000 && !s.runs.some((r) => r.scenarioId === sc.id);
  });
}

// Start the agent for each event that is due and has no run yet. Safe to call often.
export function tick(): string[] {
  if (READONLY) return [];
  const started: string[] = [];
  const first = readState();
  if (!due(first, clockNowMs(first.clock)).length) return started;
  fs.mkdirSync(STATE_FILE.replace(/[^/\\]+$/, ""), { recursive: true });
  withLock(() => {
    // Read again inside the lock: another request can have started the event.
    const s = readState();
    for (const sc of due(s, clockNowMs(s.clock))) started.push(startRun(sc.id).id);
  });
  return started;
}

// The events in time order with their state at the current clock time.
// Pass the time-filtered state (see lib/history.ts), so future runs show as upcoming.
export function feed(view: State): FeedItem[] {
  const nowMs = clockNowMs(view.clock);
  return [...SCENARIOS]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((sc) => {
      const base = { id: sc.id, at: sc.at, orderRef: sc.orderRef, orderId: data().order(sc.orderRef)?.id ?? null, title: sc.title };
      const run = view.runs.filter((r) => r.scenarioId === sc.id).at(-1);
      if (run) {
        const state: FeedState = run.status === "quiet" ? "closed" : run.status;
        return { ...base, state, runId: run.id, cardId: run.cardId };
      }
      const at = Date.parse(sc.at);
      if (nowMs < at) return { ...base, state: "upcoming" as const };
      // A run that starts later on the travel clock is not visible yet: it is still to come.
      if (readState().runs.some((r) => r.scenarioId === sc.id)) return { ...base, state: "upcoming" as const };
      return { ...base, state: nowMs - at <= FIRE_WINDOW_MIN * 60_000 ? ("due" as const) : ("missed" as const) };
    });
}

// The next event time after now, so a screen can refresh when the clock reaches it.
export function nextEventAt(view: State): string | null {
  const nowMs = clockNowMs(view.clock);
  const next = SCENARIOS.map((sc) => sc.at)
    .filter((at) => Date.parse(at) > nowMs)
    .sort()[0];
  return next ?? null;
}

export const FEED_LABEL: Record<FeedState, string> = {
  upcoming: "Upcoming",
  due: "Due now",
  running: "Agent working",
  card: "Card",
  closed: "Closed by the agent",
  failed: "Failed",
  missed: "Missed",
};
