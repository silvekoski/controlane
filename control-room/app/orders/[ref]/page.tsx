import Link from "next/link";
import { notFound } from "next/navigation";
import { checkPhotos } from "../../actions";
import { AutoRefresh } from "../../components/AutoRefresh";
import { JevPill } from "../../components/JevPill";
import { Step } from "../../components/Step";
import { data } from "@/lib/data";
import { nowIso } from "@/lib/store";
import { viewState } from "@/lib/history";
import { fmtAge, fmtClock, fmtTime, jevSummary, orderBasics } from "@/lib/view";
import { PHOTO_KIND_LABEL, photosForOrder, visualCheckers, visualQuestion } from "@/lib/visual";
import { allFixes, allMessages } from "@/lib/world";
import { attachmentsFor } from "@/lib/vision";

export const dynamic = "force-dynamic";

const WHO: Record<string, string> = { agent: "Agent", driver: "Driver", operator: "Ops", customer: "Customer", system: "System" };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ run?: string }> }) {
  const { ref } = await params;
  const { run: runId } = await searchParams;
  const d = data();
  const order = d.order(ref);
  if (!order) notFound();
  const s = viewState();
  const now = nowIso(s);
  const b = orderBasics(order.reference);
  const runs = s.runs.filter((r) => r.orderId === order.id).reverse();
  const focus = runs.find((r) => r.id === runId) ?? runs[0];
  const cards = s.cards.filter((c) => c.orderId === order.id).reverse();
  const openCard = cards.find((c) => c.status === "new" || c.status === "changed");
  const focusCard = focus?.cardId ? cards.find((c) => c.id === focus.cardId) : undefined;
  const focusJev = focusCard ? jevSummary(focusCard) : undefined;
  const fixes = allFixes(s, order.id);
  const last = fixes.at(-1);
  const msgs = allMessages(s, order.id);
  const events = [
    ...msgs.map((m) => ({ at: m.at, kind: m.from, node: (
      <div>
        <div className="tl-who">{WHO[m.from]} · {m.channel === "internal_note" ? "internal note" : m.channel === "customer_email" ? "email" : "driver chat"}{m.dataset ? "" : " · simulated"}</div>
        <div className={`bubble ${m.from === "agent" ? "bubble-agent" : ""} ${m.channel === "internal_note" ? "bubble-internal" : ""}`}>{m.text}</div>
      </div>
    ) })),
    ...s.timeline.filter((t) => t.orderId === order.id).map((t) => ({ at: t.at, kind: t.actor, node: <div><div className="tl-who">{WHO[t.actor]}</div>{t.text.replace(/^World change: /, "")}</div> })),
    ...d.forOrder("alerts", order.id).map((a) => ({ at: a.triggered_at, kind: "system", node: <div><div className="tl-who">Alert · {a.status.toLowerCase()}</div>{a.summary}</div> })),
  ].sort((a, b2) => b2.at.localeCompare(a.at));
  const bookings = d.forOrder("travel_reservations", order.id);
  const quotes = d.forOrder("travel_options", order.id);
  const photos = photosForOrder(order.id);
  const vision = visualCheckers();

  return (
    <main className="page stack-lg">
      <AutoRefresh active={runs.some((r) => r.status === "running")} />
      <header className="stack">
        <Link href="/orders" className="muted small">← Orders</Link>
        <div className="spread">
          <div>
            <p className="eyebrow">{order.reference} · {order.route_kind === "IMPORT" ? "Import" : "Domestic"}</p>
            <h1 className="h1">{b.car} for {b.customer}</h1>
            <p className="lede">{b.pickup} → {b.delivery} · driver {b.driver}</p>
          </div>
          {openCard && <Link href={`/cards/${openCard.id}`} className="btn btn-primary">Open the decision</Link>}
        </div>
      </header>

      <div className="grid-2">
        <div className="stack-lg">
          {focus && (
            <section className="panel">
              <div className="panel-head">
                <h2 className="h3">Agent work · {fmtClock(focus.startedAt)}</h2>
                {focus.status === "running" ? <span className="live"><span className="dot" /> Working</span> : <span className={`pill ${focus.status === "failed" ? "pill-critical" : focus.status === "quiet" ? "pill-ok" : "pill-accent"}`}>{focus.status === "quiet" ? "Closed without a person" : focus.status === "card" ? "Brought to a person" : "Failed"}</span>}
              </div>
              <div className="panel-body">
                <p className="small muted" style={{ marginBottom: 8 }}>
                  Event: {focus.trigger} {focus.mode === "scripted" ? "· scripted replay (no API key)" : `· ${focus.model}`}
                  {focus.operatorInstruction ? ` · operator note: “${focus.operatorInstruction}”` : ""}
                </p>
                <ul className="steps">{focus.steps.map((st, i) => <Step key={i} st={st} />)}</ul>
                {focus.status === "running" && <div className="skel" style={{ height: 14, width: "60%", marginTop: 10 }} />}
                {focus.error && <p className="blockbox" style={{ marginTop: 10 }}>{focus.error}</p>}
                {focusCard && focusJev?.checked && (
                  <div className={`jev-verdict ${focusJev.traps ? "jev-verdict-warn" : "jev-verdict-ok"}`} style={{ marginTop: 12 }}>
                    <b>Jev</b> checked the proposal on {focusJev.questions} known traps in {Math.round(focusJev.ms)} ms:{" "}
                    {focusJev.traps ? (focusJev.traps === 1 ? "1 trap found." : `${focusJev.traps} traps found.`) : "no trap found."}
                  </div>
                )}
                {focus.cardId && <p style={{ marginTop: 12 }}><Link className="btn btn-primary btn-sm" href={`/cards/${focus.cardId}`}>Open the decision card</Link></p>}
              </div>
            </section>
          )}

          <section className="panel">
            <div className="panel-head"><h2 className="h3">Timeline</h2><span className="muted small">Newest first · who said what and when</span></div>
            <div className="panel-body">
              {events.length ? (
                <ul className="timeline">
                  {events.map((e, i) => (
                    <li key={i} className={`tl-${e.kind}`}>
                      <span className="tl-time" title={fmtTime(e.at)}>{fmtClock(e.at)}<br /><span style={{ fontSize: 10 }}>{e.at.slice(5, 10)}</span></span>
                      <span className="tl-dot" />
                      {e.node}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty"><p className="empty-title">No events yet.</p><p>Routine orders often have none.</p></div>
              )}
            </div>
          </section>
        </div>

        <div className="stack-lg">
          <section className="panel">
            <div className="panel-head"><h2 className="h3">Facts</h2></div>
            <div className="panel-body">
              <dl className="stack small" style={{ margin: 0 }}>
                <div><dt className="muted">Delivery promise</dt><dd style={{ margin: 0 }}>{b.promise ? `${fmtTime(b.promise.start_at)} to ${fmtClock(b.promise.end_at)}` : "None recorded"} <span className="muted">· {b.promise?.source?.toLowerCase()}</span></dd></div>
                <div><dt className="muted">Last GPS fix</dt><dd style={{ margin: 0 }}>{last ? <>{last.placeHint ?? `${last.distanceRemainingKm ?? "?"} km to go`} <span className={minutesAgo(last.observedAt, now) > 60 ? "pill pill-warn" : "muted"}>{fmtAge(last.observedAt, now)}</span></> : "No fix. Normal before the tracking window."}</dd></div>
                {bookings.map((r) => <div key={r.id}><dt className="muted">Booked {r.kind.toLowerCase()}</dt><dd style={{ margin: 0 }}>{r.booking_reference}, departs {fmtTime(r.departure_at)}{r.check_in_cutoff_at ? `, check-in closes ${fmtClock(r.check_in_cutoff_at)}` : ""}</dd></div>)}
                {quotes.map((q) => <div key={q.id}><dt className="muted">{q.kind.toLowerCase()} {q.status === "SOLD_OUT" ? "sold out" : "quote, not booked"}</dt><dd style={{ margin: 0 }}>{q.from_city} → {q.to_city}, {fmtTime(q.departure_at)}{q.quote_cents ? `, €${q.quote_cents / 100}` : ""} <span className="muted">· checked {fmtAge(q.checked_at, now)}</span></dd></div>)}
              </dl>
            </div>
          </section>

          {photos.length > 0 && (
            <section className="panel">
              <div className="panel-head">
                <h2 className="h3">Photos</h2>
                {vision.configured.length > 0 && (
                  <form action={checkPhotos.bind(null, order.reference)}>
                    <button className="btn btn-sm" type="submit">Check again</button>
                  </form>
                )}
              </div>
              <div className="panel-body stack">
                <p className="small muted">
                  {vision.configured.length
                    ? `${vision.configured.map((c) => c.label).join(" · ")} answered typed questions about each photo.`
                    : `No visual model is connected. ${vision.missing.map((m) => `${m.label}: ${m.why}.`).join(" ")}`}
                </p>
                <ul className="photos">
                  {photos.map((p) => {
                    const checks = s.photoChecks?.[p.id] ?? [];
                    return (
                      <li key={p.id} className="photo">
                        <a href={`/photos/${p.id}`} target="_blank" rel="noreferrer"><img src={`/photos/${p.id}`} alt={PHOTO_KIND_LABEL[p.kind] ?? p.kind} loading="lazy" /></a>
                        <div className="stack small">
                          <p><b>{PHOTO_KIND_LABEL[p.kind] ?? p.kind}</b> <span className="muted">· {p.status.toLowerCase()}{p.capturedAt ? ` · ${fmtTime(p.capturedAt)}` : ""}</span></p>
                          {checks.length ? (
                            <ul className="jev-list">
                              {checks.map((c) => (
                                <li key={`${c.model}-${c.questionId}`} className={`jev-row jev-${c.flagged ? "trap" : c.unsure ? "unsure" : "ok"}`}>
                                  <span className="jev-mark">{c.flagged ? "!" : c.unsure ? "?" : "✓"}</span>
                                  <div>
                                    <p className="jev-q">{visualQuestion(c.questionId)?.question.replace("`photo`", "the photo") ?? c.questionId}</p>
                                    <p className="muted">{c.answer === "error" ? c.message : <><b>{c.answer}</b> · {Math.round(c.confidence * 100)}% sure · {c.model === "jev_vision" ? "Jev" : c.model}{c.flagged || c.unsure ? <> · {c.message}</> : null}</>}</p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : <p className="muted">Not checked yet.</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          )}

          {attachmentsFor(order.reference).length > 0 && (
            <section className="panel">
              <div className="panel-head"><h2 className="h3">Photos and documents</h2><span className="muted small">From the packet</span></div>
              <div className="panel-body files">
                {attachmentsFor(order.reference).map((a) => (
                  <figure key={a.id}>
                    <a href={`/api/files/${a.file}`} target="_blank" rel="noreferrer"><img className="thumb-sm" src={`/api/files/${a.file}`} alt={a.kind} /></a>
                    <figcaption>{a.kind.replaceAll("_", " ").toLowerCase()}<br />{a.status.toLowerCase()}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          {cards.length > 0 && (
            <section className="panel">
              <div className="panel-head"><h2 className="h3">Decision cards</h2></div>
              <ul className="quiet-list">
                {cards.map((c) => (
                  <li key={c.id} style={{ gridTemplateColumns: "70px minmax(0,1fr) auto" }}>
                    <span className="mono muted">{fmtClock(c.createdAt)}</span>
                    <Link className="link" href={`/cards/${c.id}`}>{c.summary}</Link>
                    <JevPill card={c} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {runs.length > 1 && (
            <section className="panel">
              <div className="panel-head"><h2 className="h3">Earlier agent runs</h2></div>
              <ul className="quiet-list">
                {runs.slice(1).map((r) => (
                  <li key={r.id} style={{ gridTemplateColumns: "70px minmax(0,1fr)" }}>
                    <span className="mono muted">{fmtClock(r.startedAt)}</span>
                    <Link className="link" href={`/orders/${order.reference}?run=${r.id}`}>{r.status === "quiet" ? "Closed quietly" : r.status === "card" ? "Decision card" : r.status}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function minutesAgo(iso: string, now: string) {
  return (Date.parse(now) - Date.parse(iso)) / 60000;
}
