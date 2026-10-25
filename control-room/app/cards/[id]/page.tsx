import Link from "next/link";
import { notFound } from "next/navigation";
import { Decide } from "./Decide";
import { nowIso } from "@/lib/store";
import { viewState } from "@/lib/history";
import { cardContext, fmtAge, fmtLeft, fmtTime, jevMark, SOURCE_LABEL, system } from "@/lib/view";
import { REJECT_REASONS } from "@/lib/decisions";
import { LIVE_QUESTIONS } from "@/lib/questions";
import { VISUAL_QUESTIONS } from "@/lib/vision";
import type { CheckResult } from "@/lib/types";
import { visualCheckers, visualQuestion } from "@/lib/visual";

export const dynamic = "force-dynamic";

const MODEL_LABEL: Record<string, string> = {
  code: "Rules", laya: "Laya", laya_ft: "Laya (fine-tuned)", jev: "Jev", llm_judge: "Claude judge",
  jev_vision: "Jev (photo)", selfjev: "SelfJev (photo)", d1: "Liquid d1 (photo)", llm_judge_vision: "Claude judge (photo)",
};

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = viewState();
  const card = s.cards.find((c) => c.id === id);
  if (!card) notFound();
  const now = nowIso(s);
  const ctx = cardContext(s, card);
  const left = fmtLeft(card.deadline, now);
  const sys = system();
  const vision = visualCheckers();
  const flagged = card.checks.filter((c) => c.flagged);
  const factWarnings = (label: string) => card.checks.filter((c) => c.factLabel === label);
  const general = flagged.filter((c) => !c.factLabel || !card.facts.some((f) => f.label === c.factLabel));
  const blocked = card.checks.some((c) => c.blocking);
  const open = card.status === "new" || card.status === "changed";
  const run = s.runs.find((r) => r.id === card.runId);
  const changeMsg = card.status === "changed" ? s.chat.filter((m) => m.orderId === card.orderId && m.from === "driver").at(-1) : undefined;

  // Group model answers by question for the "how it was checked" list.
  const byQuestion = new Map<string, CheckResult[]>();
  for (const c of card.checks.filter((x) => x.model !== "code")) byQuestion.set(c.questionId, [...(byQuestion.get(c.questionId) ?? []), c]);

  const jevChecks = card.checks.filter((c) => c.model === "jev");
  const jevMissing = sys.missingCheckers.some((m) => m.model === "jev");
  const jevFlagged = jevChecks.filter((c) => c.flagged).length;

  return (
    <main className="page stack-lg">
      <div className="spread">
        <Link href="/" className="muted small">← Queue</Link>
        <Link href={`/orders/${card.orderRef}`} className="link small">Open order {card.orderRef}</Link>
      </div>

      <header className="stack">
        <div className="row">
          <span className={`pill pill-${left.tone}`}><span className="dot" /> {left.text}</span>
          <span className="muted small">{card.deadlineLabel}</span>
        </div>
        <h1 className="card-title">{card.summary}</h1>
        <p className="muted small">
          The agent made this card {fmtAge(card.createdAt, now)}{run?.mode === "scripted" ? " (scripted replay)" : run?.model ? ` with ${run.model}` : ""}.
        </p>
      </header>

      {card.status === "changed" && (
        <div className="result result-changed">
          <b>Changed since approval.</b> A new fact came in after this card was made, so the action did not run.
          {changeMsg && <> The driver wrote {fmtAge(changeMsg.at, now)}: “{changeMsg.text}”</>} Read the facts again, then decide.
        </div>
      )}

      <dl className="context">
        <div><dt>Customer</dt><dd>{ctx.customer}</dd></div>
        <div><dt>Driver</dt><dd>{ctx.driver}</dd></div>
        <div><dt>Car</dt><dd>{ctx.car}</dd></div>
        <div><dt>Current position</dt><dd>{ctx.position}</dd></div>
        <div><dt>Arrival</dt><dd>{ctx.eta} · late: {ctx.late}</dd></div>
        <div><dt>Chained gig</dt><dd>{ctx.chained}</dd></div>
      </dl>

      <div className="grid-2">
        <div className="stack-lg">
          <section className="panel">
            <div className="panel-head"><h2 className="h3">What we know</h2><span className="muted small">Each fact with its source and age</span></div>
            <div className="panel-body">
              <ul className="facts">
                {card.facts.map((f) => (
                  <li key={f.label} className="fact">
                    <div className="fact-main">
                      <span className="fact-label">{f.label}</span>
                      <span className="fact-value">
                        {f.imageFile && (
                          <a href={`/api/files/${f.imageFile}`} target="_blank" rel="noreferrer" className="thumb-link" title="Open the full image">
                            <img className="thumb" src={`/api/files/${f.imageFile}`} alt={f.label} />
                          </a>
                        )}
                        {f.value}
                      </span>
                      <span className="fact-src">
                        <b>{SOURCE_LABEL[f.source] ?? f.source}</b> · {fmtAge(f.observedAt, now)}
                      </span>
                    </div>
                    {factWarnings(f.label).map((w, i) => (
                      <div key={i} className={`flag ${w.flagged ? "flag-warn" : "flag-note"}`}>
                        <span className="flag-icon">{w.flagged ? "!" : "i"}</span>
                        <span>
                          {w.message} <span className="muted small">· {w.flagged ? "flagged" : "checked"} by {MODEL_LABEL[w.model]}</span>
                        </span>
                        {w.photoId && <a href={`/photos/${w.photoId}`} target="_blank" rel="noreferrer"><img className="flag-photo" src={`/photos/${w.photoId}`} alt="The photo the answer is about" loading="lazy" /></a>}
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2 className="h3">What the agent already did</h2></div>
            <div className="panel-body">
              <ul className="checklist">{card.agentActions.map((a) => <li key={a}>{a}</li>)}</ul>
              {run && <p className="small" style={{ marginTop: 10 }}><Link className="link" href={`/orders/${card.orderRef}?run=${run.id}`}>See every step and the driver chat</Link></p>}
            </div>
          </section>
        </div>

        <div className="stack-lg">
          <section className="proposal">
            <div className="proposal-body stack">
              <p className="eyebrow">The agent suggests</p>
              <p className="proposal-desc">{card.proposal.description}</p>
              <div className="row small muted" style={{ flexWrap: "wrap" }}>
                {card.proposal.costDelta ? <span className="badge">Cost +€{card.proposal.costDelta}</span> : null}
                <span className="badge">A person approves</span>
                {card.proposal.travelOptionId && <span className="badge badge-src">{card.proposal.travelOptionId}</span>}
              </div>
              {general.map((w, i) => (
                <div key={i} className={w.blocking ? "blockbox" : "warnbox"}>
                  <b>!</b> <span>{w.message} <span className="small">· flagged by {MODEL_LABEL[w.model]}</span></span>
                </div>
              ))}
              {card.proposal.customerDraft && (
                <div className="draft">
                  <p className="draft-head">Message to the customer: drafted by the agent. You send it after approval.</p>
                  {card.proposal.customerDraft}
                </div>
              )}
            </div>
            {open ? (
              <Decide
                cardId={card.id}
                description={card.proposal.description}
                costDelta={card.proposal.costDelta}
                customerDraft={card.proposal.customerDraft}
                blocked={blocked}
                canRedo={sys.claude}
                reasons={REJECT_REASONS}
              />
            ) : (
              <div className={`result ${card.status === "rejected" ? "result-rejected" : "result-ok"}`} style={{ borderRadius: "0 0 10px 10px" }}>
                <b>{card.status === "rejected" ? "Rejected" : card.status === "edited" ? "Edited and approved" : "Approved"}</b> by {card.decidedBy}
                {card.decidedAt ? ` at ${fmtTime(card.decidedAt)}` : ""}.
                {card.rejectReason && <> Reason: {REJECT_REASONS[card.rejectReason]}{card.rejectNote ? `: “${card.rejectNote}”` : ""}.</>}
                <p style={{ marginTop: 6 }}><b>What happens next:</b> {card.outcome}</p>
                {card.status === "rejected" && <p className="small" style={{ marginTop: 6 }}>The case went to the <Link className="link" href="/label">labeling queue</Link> as an eval candidate.</p>}
              </div>
            )}
          </section>

          <section className="jev">
            <div className="jev-head">
              <span className="jev-badge">Jev</span>
              <div>
                <h2 className="h3">Jev checked this proposal</h2>
                <p className="small muted">Jev is a fast decision model. It reads the facts and the agent action. Then it answers one yes or no question for each known trap.</p>
              </div>
            </div>
            {jevChecks.length > 0 ? (
              <>
                <p className={`jev-verdict ${jevFlagged ? "jev-verdict-warn" : "jev-verdict-ok"}`}>
                  {jevFlagged ? `Jev found ${jevFlagged} ${jevFlagged === 1 ? "trap" : "traps"}. Read the warnings before you approve.` : "Jev found no trap in this proposal."}
                </p>
                <ul className="jev-list">
                  {jevChecks.map((c) => {
                    const st = jevMark(c, s.questions);
                    return (
                      <li key={c.questionId} className={`jev-row jev-${st}`}>
                        <span className="jev-mark">{st === "trap" ? "!" : st === "unsure" ? "?" : "✓"}</span>
                        <div>
                          <p className="jev-q">{[...LIVE_QUESTIONS, ...s.questions].find((q) => q.id === c.questionId)?.question ?? c.questionId}</p>
                          <p className="small">
                            Jev says <b>{c.answer}</b> · {Math.round(c.confidence * 100)}% sure
                            {st === "trap" && <> · <b>{c.message}</b></>}
                            {st === "unsure" && <> · not sure enough to warn</>}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="small muted">{jevMissing ? "Jev is not connected, so it did not check this card." : "Jev did not answer for this card."}</p>
            )}
          </section>

          <section className="panel">
            <div className="panel-head"><h2 className="h3">How this card was checked</h2></div>
            <div className="panel-body stack small">
              <p><span className="pill pill-ok">Rules</span> Hard rules and calculated facts: customer contact, approvals, quotes, GPS age, sources.</p>
              {sys.checkers.length ? (
                <p><span className="pill pill-ok">{sys.checkers.join(" · ")}</span> answered {LIVE_QUESTIONS.filter((q) => q.modelChecked).length} typed questions.</p>
              ) : null}
              {vision.configured.length > 0 && (
                <p><span className="pill pill-ok">{vision.configured.map((c) => c.label).join(" · ")}</span> answered questions about the photos behind the facts.</p>
              )}
              {[...sys.missingCheckers, ...vision.missing].map((m) => (
                <p key={m.model} className="muted"><span className="pill pill-calm">{m.label}</span> not connected. {m.why}.</p>
              ))}
              {byQuestion.size > 0 && (
                <details className="raw">
                  <summary>Show each answer</summary>
                  <table className="table" style={{ marginTop: 8 }}>
                    <tbody>
                      {[...byQuestion.entries()].map(([qid, rs]) => (
                        <tr key={qid}>
                          <td>{LIVE_QUESTIONS.find((q) => q.id === qid)?.question ?? visualQuestion(qid)?.question.replace("`photo`", "the photo") ?? qid}</td>
                          <td>{rs.map((r) => <div key={r.model}>{MODEL_LABEL[r.model]}: <b>{r.answer}</b> ({Math.round(r.confidence * 100)}%, {Math.round(r.ms)} ms)</div>)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
