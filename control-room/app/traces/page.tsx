import Link from "next/link";
import { AutoRefresh } from "../components/AutoRefresh";
import { JevPill } from "../components/JevPill";
import { Step } from "../components/Step";
import { LIVE_QUESTIONS } from "@/lib/questions";
import { viewState } from "@/lib/history";
import { fmtClock, fmtTime, jevMark } from "@/lib/view";
import type { AgentRun } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS: Record<AgentRun["status"], { text: string; pill: string }> = {
  running: { text: "Working", pill: "pill-accent" },
  quiet: { text: "Closed without a person", pill: "pill-ok" },
  card: { text: "Brought to a person", pill: "pill-accent" },
  failed: { text: "Failed", pill: "pill-critical" },
};

// Every agent run, newest first, with each step and the Jev check on its card.
export default function TracesPage() {
  const s = viewState();
  const runs = [...s.runs].reverse();
  const questions = [...LIVE_QUESTIONS, ...s.questions];
  const count = (st: AgentRun["status"]) => runs.filter((r) => r.status === st).length;

  return (
    <main className="page stack-lg">
      <AutoRefresh active={runs.some((r) => r.status === "running")} />
      <header className="stack">
        <h1 className="h1">Agent traces</h1>
        <p className="lede">
          {runs.length} runs · {count("quiet")} closed without a person · {count("card")} brought to a person · {count("failed")} failed
        </p>
      </header>

      {runs.length === 0 && (
        <div className="panel empty">
          <p className="empty-title">No agent runs yet.</p>
          <p>No event has run at this clock time. The home page lists the event feed.</p>
        </div>
      )}

      {runs.map((r, i) => {
        const card = r.cardId ? s.cards.find((c) => c.id === r.cardId) : undefined;
        const jev = card?.checks.filter((c) => c.model === "jev") ?? [];
        const tools = r.steps.filter((st) => st.kind === "tool").length;
        return (
          <details key={r.id} className="panel trace" open={i < 10}>
            <summary className="panel-head trace-head">
              <span className="mono muted">{fmtClock(r.startedAt)}</span>
              <span className="trace-title">
                <Link className="link" href={`/orders/${r.orderRef}?run=${r.id}`}>{r.orderRef}</Link> {r.trigger}
                <span className="muted small" style={{ display: "block" }}>
                  {r.mode === "scripted" ? "Scripted replay" : r.model} · {tools} tool calls · {r.steps.length} steps
                  {r.usage ? ` · ${r.usage.inputTokens + r.usage.outputTokens} tokens` : ""}
                </span>
              </span>
              <span className="row">
                {card && <JevPill card={card} />}
                <span className={`pill ${STATUS[r.status].pill}`}>{STATUS[r.status].text}</span>
              </span>
            </summary>
            <div className="panel-body">
              {r.operatorInstruction && <p className="small muted" style={{ marginBottom: 8 }}>Operator note: “{r.operatorInstruction}”</p>}
              <ul className="steps">
                {r.steps.map((st, j) => <Step key={j} st={st} />)}
                {jev.length > 0 && (
                  <li>
                    <span className="jev-badge" style={{ fontSize: 10, padding: "2px 4px", alignSelf: "start", textAlign: "center" }}>Jev</span>
                    <span>
                      <b>Jev checked the proposal</b>
                      <ul className="trace-jev">
                        {jev.map((c) => {
                          const m = jevMark(c, s.questions);
                          return (
                            <li key={c.questionId} className={`jev-${m}`}>
                              <span className="jev-mark">{m === "trap" ? "!" : m === "unsure" ? "?" : "✓"}</span>
                              <span>{questions.find((q) => q.id === c.questionId)?.question ?? c.questionId} <b>{c.answer}</b> <span className="muted">· {Math.round(c.confidence * 100)}% · {Math.round(c.ms)} ms</span></span>
                            </li>
                          );
                        })}
                      </ul>
                    </span>
                  </li>
                )}
              </ul>
              {r.quietReason && <p className="small" style={{ marginTop: 8 }}><b>Why no person was needed:</b> {r.quietReason}</p>}
              {r.error && <p className="blockbox" style={{ marginTop: 8 }}>{r.error}</p>}
              <p className="small muted" style={{ marginTop: 8 }}>
                Started {fmtTime(r.startedAt)}{r.endedAt ? ` · ended ${fmtTime(r.endedAt)}` : ""}
                {card && <> · <Link className="link" href={`/cards/${card.id}`}>Open the decision card</Link></>}
              </p>
            </div>
          </details>
        );
      })}
    </main>
  );
}
