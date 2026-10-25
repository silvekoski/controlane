import { tick } from "./feed";
import { clockNowMs, readState, type State } from "./store";

// History for the travel clock. The screens show the state as it was at now():
// runs, cards, messages and log lines made after now() are hidden.
// A run or card that ended or was decided after now() shows as it was then.

const before = (iso: string | undefined, t: number) => Boolean(iso) && Date.parse(iso!) <= t;

export function asOf(s: State, t = clockNowMs(s.clock)): State {
  return {
    ...s,
    runs: s.runs
      .filter((r) => before(r.startedAt, t))
      .map((r) =>
        r.endedAt && !before(r.endedAt, t)
          ? { ...r, status: "running" as const, endedAt: undefined, cardId: undefined, quietReason: undefined, error: undefined, steps: r.steps.filter((st) => before(st.at, t)) }
          : r,
      ),
    cards: s.cards
      .filter((c) => before(c.createdAt, t))
      .map((c) =>
        c.decidedAt && !before(c.decidedAt, t)
          ? { ...c, status: "new" as const, decidedAt: undefined, decidedBy: undefined, outcome: undefined, rejectReason: undefined, rejectNote: undefined, editNote: undefined }
          : c,
      ),
    traces: s.traces.filter((x) => before(x.createdAt, t)),
    chat: s.chat.filter((x) => before(x.at, t)),
    fixes: s.fixes.filter((x) => before(x.observedAt, t)),
    timeline: s.timeline.filter((x) => before(x.at, t)),
    candidates: s.candidates.filter((x) => before(x.createdAt, t)),
    quietLog: s.quietLog.filter((x) => before(x.at, t)),
  };
}

// For read paths: fire due events, then return the state as it was at now().
export function viewState(): State {
  tick();
  return asOf(readState());
}
