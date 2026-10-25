import Link from "next/link";
import { LabelForm } from "./LabelForm";
import { nowIso } from "@/lib/store";
import { viewState } from "@/lib/history";
import { fmtAge, SOURCE_LABEL } from "@/lib/view";

export const dynamic = "force-dynamic";

export default function LabelPage() {
  const s = viewState();
  const now = nowIso(s);
  const todo = s.candidates.filter((c) => !c.label);
  const c = todo[0];
  return (
    <main className="page page-narrow stack-lg">
      <header className="stack">
        <h1 className="h1">Labeling</h1>
        <p className="lede">One case at a time. Your answer becomes an eval case for the checks. {todo.length > 1 ? `${todo.length} cases left.` : ""}</p>
      </header>
      {!c ? (
        <div className="panel empty">
          <p className="empty-title">All cases are labeled.</p>
          <p>New cases come from rejected cards and from the discovery agent.</p>
          <p style={{ marginTop: 16 }}><Link href="/evals" className="link">See checks and evals</Link></p>
        </div>
      ) : (
        <section className="panel">
          <div className="panel-head">
            <span className="eyebrow">{c.source === "operator_reject" ? "From a rejected card" : "From the discovery agent"} · {c.orderRef}</span>
          </div>
          <div className="panel-body stack">
            <p className="h3">What the agent knew</p>
            <ul className="facts">
              {c.state.map((f) => (
                <li key={f.label} className="fact">
                  <div className="fact-main">
                    <span className="fact-label">{f.label}</span>
                    <span className="fact-value">{f.value}</span>
                    <span className="fact-src"><b>{SOURCE_LABEL[f.source] ?? f.source}</b> · {fmtAge(f.observedAt, now)}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="sunk"><p className="eyebrow" style={{ marginBottom: 4 }}>What the agent did</p><p style={{ whiteSpace: "pre-line" }}>{c.action}</p></div>
            <LabelForm id={c.id} question={c.question} options={c.options} suggested={c.suggestedAnswer} />
          </div>
        </section>
      )}
    </main>
  );
}
