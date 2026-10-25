import { Badge, Card, Slide, Src } from "../components"
import { IDEAS } from "../data/ideas"

type P = { index: number; section: string }

export const QuestionsSlide = ({ index, section }: P) => {
  const qs = [
    "Would you rather see “On the road” or “Driver travel” from us?",
    "The packet has alerts and planning estimates but no GPS ping stream. Is a mocked stream fine?",
    "Is an eval layer on top of the agent interesting, or a distraction?",
    "Which of the eight would you use first in real operations?",
  ]
  return (
    <Slide index={index} section={section} eyebrow="Before we build" title="Four quick questions">
      <div className="col gap24">
        {qs.map((q, i) => (
          <Card key={q} className="row gap32" style={{ height: 150, padding: "0 40px" }}>
            <Badge n={i + 1} size="lg" /><span style={{ fontSize: 36 }}>{q}</span>
          </Card>
        ))}
      </div>
    </Slide>
  )
}

export const VoteSlide = ({ index, section }: P) => (
  <Slide index={index} section={section} eyebrow="Your call" title="Which one should we build?">
    <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 20 }}>
      {IDEAS.map((id) => (
        <Card key={id.n} tone={id.recommended ? "pick" : ""} style={{ height: 420, padding: "44px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
          <Badge n={id.n} size="lg" />
          <div style={{ fontSize: 26, fontWeight: 600, textAlign: "center" }}>{id.short}</div>
        </Card>
      ))}
    </div>
    <div className="tone orange disp" style={{ marginTop: 48, height: 150, justifyContent: "center", fontSize: 48 }}>Our pick: (5)+(4) with (8)</div>
  </Slide>
)

export const SourcesSlide = ({ index, section }: P) => {
  const rows = [
    ["BR", "PARTICIPANT-BRIEF.md and the brief PDF", "High: official written text"],
    ["OC", "OPERATIONS-CONTEXT.md", "High: official written text"],
    ["T1", "Transcript “Bahn express 01” (stage pitch)", "Medium: auto-transcribed, some garbled passages"],
    ["T2", "Transcript “Bahn express 02” (booth Q&A)", "Medium: auto-transcribed, speaker turns unlabeled"],
    ["T3", "Transcript “Bahn express 03” (booth Q&A)", "Medium: auto-transcribed, speaker turns unlabeled"],
  ]
  return (
    <Slide index={index} section={section} eyebrow="Appendix A1" title="Sources">
      <div style={{ display: "grid", gridTemplateColumns: "120px 780px 1fr", fontSize: 26 }}>
        {["Tag", "Source", "Reliability"].map((h) => <div key={h} className="caps" style={{ padding: "0 24px 14px" }}>{h}</div>)}
        {rows.map(([t, s, r], i) => (
          <div key={t} style={{ display: "contents" }}>
            {[<Src key="a" t={t} style={{ fontSize: 26, color: "var(--ink)", fontWeight: 500 }} />, s, r].map((c, k) => (
              <div key={k} style={{ padding: "22px 24px", background: i % 2 ? "var(--birch)" : "var(--tray)", borderRadius: k === 0 ? "14px 0 0 14px" : k === 2 ? "0 14px 14px 0" : 0 }}>{c}</div>
            ))}
          </div>
        ))}
      </div>
      <p className="brown" style={{ fontSize: 24, marginTop: 36 }}>Known conflict: volume figures differ between the brief (25,000+ a year) and T1 (“over 5,000 last month”). The slides use the brief.</p>
    </Slide>
  )
}

export const AssumptionsSlide = ({ index, section }: P) => (
  <Slide index={index} section={section} eyebrow="Appendix A2" title="Assumptions">
    <div className="row gap32" style={{ alignItems: "stretch" }}>
      {[["Made-up numbers", "All prices, times and fees on the idea slides are made up, as the brief allows."], ["First-pass ratings", "Ratings on the matrix and the value-vs-effort chart are our first pass. Bahn should correct them."]].map(([h, b]) => (
        <Card key={h} style={{ flex: 1, height: 420, padding: 52 }}>
          <div style={{ fontSize: 36, fontWeight: 600 }}>{h}</div>
          <p style={{ fontSize: 30, marginTop: 20, color: "var(--brown)" }}>{b}</p>
        </Card>
      ))}
    </div>
  </Slide>
)
