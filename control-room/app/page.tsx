import Link from "next/link";
import { AutoRefresh } from "./components/AutoRefresh";
import { JevPill } from "./components/JevPill";
import { nowIso } from "@/lib/store";
import { viewState } from "@/lib/history";
import { feed, FEED_LABEL } from "@/lib/feed";
import { fmtAge, fmtClock, fmtLeft, jevSummary, lastStepLine, orderBasics, queue, system } from "@/lib/view";

export const dynamic = "force-dynamic";

export default function QueuePage() {
  const s = viewState();
  const now = nowIso(s);
  const q = queue(s);
  const n = q.open.length;
  const jevOn = system().checkers.some((c) => c.startsWith("Jev"));
  const jevCards = q.open.map(jevSummary).filter((j) => j.checked);
  const jevTraps = jevCards.reduce((t, j) => t + j.traps, 0);

  return (
    <main className="page stack-lg">
      <AutoRefresh active={q.running.length > 0} />

      <section className="stack">
        <div className="scale">
          <h1 className="scale-big">{n === 0 ? "Nothing needs you right now." : n === 1 ? "1 decision needs you" : `${n} decisions need you`}</h1>
        </div>
        <p className="scale-line">
          <b>{q.onTrack} orders on track</b> of {q.activeOrders} active · {q.deliveredOrDone} delivered or closed ·{" "}
          {q.quiet.length > 0 ? (
            <>
              the agent closed <b>{q.quiet.length}</b> {q.quiet.length === 1 ? "event" : "events"} without you
            </>
          ) : (
            "no events closed by the agent yet"
          )}
        </p>
      </section>

      <div className="jev-strip">
        <span className="jev-badge">Jev</span>
        {jevOn ? (
          <span>
            Jev checks each card for known traps before it reaches you.{" "}
            {jevCards.length > 0 && <b>{jevCards.length === 1 ? "1 open card checked" : `${jevCards.length} open cards checked`}, {jevTraps === 1 ? "1 trap found" : `${jevTraps} traps found`}.</b>}
          </span>
        ) : (
          <span>Jev is not connected. Set OPENROUTER_API_KEY to check each card for known traps.</span>
        )}
      </div>

      {q.running.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            <span className="live">
              <span className="dot" /> The agent is working on {q.running.length === 1 ? "1 event" : `${q.running.length} events`}
            </span>
          </div>
          <ul className="quiet-list">
            {q.running.map((r) => (
              <li key={r.id}>
                <span className="mono muted">{fmtClock(r.startedAt)}</span>
                <Link className="link" href={`/orders/${r.orderRef}?run=${r.id}`}>{r.orderRef}</Link>
                <span className="muted">{lastStepLine(r)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        {n > 0 ? (
          <div className="panel">
            <ul className="inbox">
              {q.open.map((c) => {
                const b = orderBasics(c.orderRef);
                const left = fmtLeft(c.deadline, now);
                const warnings = c.checks.filter((x) => x.flagged).length;
                const blocked = c.checks.some((x) => x.blocking);
                return (
                  <li key={c.id}>
                    <Link href={`/cards/${c.id}`} className="inbox-row">
                      <span className={`pill pill-${left.tone}`}>
                        <span className="dot" /> {left.text}
                      </span>
                      <span>
                        <span className="inbox-summary">{c.summary}</span>
                        <span className="inbox-meta" style={{ display: "block" }}>
                          {c.orderRef} · {b.car} · {b.customer} · {c.deadlineLabel}
                        </span>
                      </span>
                      <span className="inbox-right">
                        {c.status === "changed" && <span className="pill pill-warn">Changed since approval</span>}
                        {blocked && <span className="pill pill-critical">Blocked rule</span>}
                        {warnings > 0 && !blocked && <span className="pill pill-warn">{warnings === 1 ? "1 warning" : `${warnings} warnings`}</span>}
                        {jevOn && <JevPill card={c} />}
                        <span className="muted small">{fmtAge(c.createdAt, now)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="panel empty">
            <p className="empty-title">The queue is empty.</p>
            <p>The agent watches every moving order. It brings you a card only when a person must decide.</p>
          </div>
        )}
      </section>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2 className="h3">Closed by the agent</h2>
            <span className="muted small">No person needed</span>
          </div>
          {q.quiet.length ? (
            <ul className="quiet-list">
              {q.quiet.slice(0, 8).map((x) => (
                <li key={x.runId}>
                  <span className="mono muted">{fmtClock(x.at)}</span>
                  <Link className="link" href={`/orders/${x.orderRef}`}>{x.orderRef}</Link>
                  <span>{x.reason}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-body muted small">No events yet. Normal stops and gaps close here.</p>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2 className="h3">Decided</h2>
            <span className="muted small">What happens next</span>
          </div>
          {q.decided.length ? (
            <ul className="quiet-list">
              {q.decided.slice(0, 6).map((c) => (
                <li key={c.id} style={{ gridTemplateColumns: "70px 92px minmax(0,1fr)" }}>
                  <span className="mono muted">{c.decidedAt ? fmtClock(c.decidedAt) : ""}</span>
                  <Link className="link" href={`/cards/${c.id}`}>{c.orderRef}</Link>
                  <span>
                    <span className={`pill ${c.status === "rejected" ? "pill-calm" : "pill-ok"}`} style={{ marginRight: 8 }}>
                      {c.status === "edited" ? "Edited" : c.status === "approved" ? "Approved" : "Rejected"}
                    </span>
                    <span className="muted">{c.outcome}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-body muted small">Nothing decided yet.</p>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2 className="h3">Event feed</h2>
          <span className="muted small">Monitoring events on 21 Oct. The agent starts when the clock passes an event.</span>
        </div>
        <ul className="quiet-list">
          {feed(s).map((e) => (
            <li key={e.id}>
              <span className="mono muted">{fmtClock(e.at)}</span>
              <Link className="link" href={e.runId ? `/orders/${e.orderRef}?run=${e.runId}` : `/orders/${e.orderRef}`}>{e.orderRef}</Link>
              <span>
                {e.title} <span className="muted">· {FEED_LABEL[e.state]}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {q.failed.length > 0 && (
        <section className="panel panel-pad stack">
          <h2 className="h3">Agent runs that failed</h2>
          {q.failed.map((r) => (
            <p key={r.id} className="small">
              <Link className="link" href={`/orders/${r.orderRef}?run=${r.id}`}>{r.orderRef}</Link> · {r.error}. A person should look at this order.
            </p>
          ))}
        </section>
      )}
    </main>
  );
}
