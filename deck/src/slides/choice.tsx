import { Badge, Caps, Card, Chip, Dots, Slide, Tone } from "../components"
import { CRITERIA, IDEAS } from "../data/ideas"

type P = { index: number; section: string }

export const MatrixSlide = ({ index, section }: P) => (
  <Slide index={index} section={section} eyebrow="Side by side" title="How they compare">
    <div style={{ display: "grid", gridTemplateColumns: "420px repeat(6, 1fr)", alignItems: "center", rowGap: 6 }}>
      <div />
      {CRITERIA.map((c) => <div key={c} className="tc muted" style={{ fontSize: 21, fontWeight: 600, padding: "0 6px 12px" }}>{c}</div>)}
      {IDEAS.map((id, r) => (
        <div key={id.n} style={{ display: "contents" }}>
          <div className="row gap16" style={{ height: 64, paddingLeft: 24, fontSize: 28, fontWeight: id.recommended ? 600 : 400, background: id.recommended ? "var(--orange-bg)" : r % 2 ? "var(--birch)" : "var(--tray)", borderRadius: "14px 0 0 14px" }}>
            <Badge n={id.n} size="sm" />{id.short}{id.n === 8 && <span className="muted">*</span>}
          </div>
          {id.scores.map((sc, i) => (
            <div key={i} className="row" style={{ height: 64, justifyContent: "center", background: id.recommended ? "var(--orange-bg)" : r % 2 ? "var(--birch)" : "var(--tray)", borderRadius: i === 5 ? "0 14px 14px 0" : 0 }}><Dots n={sc} /></div>
          ))}
        </div>
      ))}
    </div>
    <p className="muted" style={{ fontSize: 20, marginTop: 20 }}>* Not one of the four areas by itself. It pairs with an ops agent. Ratings are our first pass. Please correct “Bahn's pain” live.</p>
    <p className="muted" style={{ fontSize: 18, marginTop: 8 }}>
      Brief fit: matches one of the four listed areas · Bahn's pain: how strongly Bahn asked for it · Control room: how much it shows people and agents handing over work (40%) · Demo w/ packet: buildable in two days with the given data · New idea: Bahn prefers fresh takes (T2) · Low risk: fewer unknowns in hardware, law and third parties
    </p>
  </Slide>
)

export const ScatterSlide = ({ index, section }: P) => {
  const W = 1100, H = 560
  const quads: [string, string, string, number, number][] = [
    ["Build now", "var(--green-bg)", "var(--green-ink)", 0, 0], ["Big bet", "var(--teal-bg)", "var(--teal-ink)", 1, 0],
    ["Nice to have", "var(--tray)", "var(--muted)", 0, 1], ["Skip for now", "var(--hair-soft)", "var(--muted)", 1, 1],
  ]
  return (
    <Slide index={index} section={section} eyebrow="Value vs effort" title="Where two days go furthest">
      <div className="row" style={{ gap: 48, alignItems: "flex-start" }}>
        <div style={{ position: "relative", width: W, height: H }}>
          {quads.map(([l, bg, fg, qx, qy]) => (
            <div key={l} style={{ position: "absolute", left: qx * W / 2 + 3, top: qy * H / 2 + 3, width: W / 2 - 6, height: H / 2 - 6, background: bg, borderRadius: 16, padding: 20 }}>
              <span className="caps" style={{ color: fg }}>{l}</span>
            </div>
          ))}
          {IDEAS.map((id) => (
            <div key={id.n} style={{ position: "absolute", left: id.xy[0] * W - 30, top: (1 - id.xy[1]) * H - 30, borderRadius: "50%", boxShadow: id.recommended ? "0 0 0 5px var(--orange)" : "0 0 0 4px var(--birch)" }}>
              <Badge n={id.n} size="lg" />
            </div>
          ))}
          <span className="muted" style={{ position: "absolute", left: 0, bottom: -44, fontSize: 22 }}>Low effort</span>
          <span className="muted" style={{ position: "absolute", right: 0, bottom: -44, fontSize: 22 }}>High effort</span>
        </div>
        <div className="col" style={{ gap: 16, paddingTop: 6 }}>
          <Caps>High value is up</Caps>
          {IDEAS.map((id) => <div key={id.n} className="row gap16" style={{ fontSize: 26 }}><Badge n={id.n} size="sm" />{id.short}</div>)}
        </div>
      </div>
    </Slide>
  )
}

export const BundlesSlide = ({ index, section }: P) => {
  const bundles: [string, number[], string, boolean][] = [
    ["Watch the trip", [5, 4], "Before GPS: check-in. During GPS: stop check. One agent covers the whole trip.", false],
    ["Keep travel on plan", [2, 3], "Re-plan broken legs. Scooters become one more option.", false],
    ["Learn from every decision", [8], "Add to any agent. Every rejection becomes an eval.", true],
  ]
  return (
    <Slide index={index} section={section} eyebrow="Bundles" title="Some ideas are one agent">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
        {bundles.map(([name, ns, why, plus]) => (
          <Card key={name} style={{ height: 600, padding: 44 }}>
            <h2 className="disp" style={{ fontSize: 34, textTransform: "uppercase", lineHeight: 1.15 }}>{name}</h2>
            <div className="row gap16" style={{ marginTop: 40 }}>
              {ns.map((n, k) => (
                <span key={n} className="row gap16"><Badge n={n} size="lg" />{k < ns.length - 1 && <b style={{ fontSize: 44, color: "var(--muted)" }}>+</b>}</span>
              ))}
              {plus && <span className="muted" style={{ fontSize: 28 }}>+ any agent</span>}
            </div>
            <Caps style={{ marginTop: 48 }}>Why together</Caps>
            <p style={{ fontSize: 28, marginTop: 10, color: "var(--brown)" }}>{why}</p>
          </Card>
        ))}
      </div>
    </Slide>
  )
}

export const RecommendSlide = ({ index, section }: P) => {
  const steps = ["100 orders quiet", "3 need a person", "Open one", "Decide", "Reject with reason", "New check appears"]
  const List = ({ items }: { items: string[] }) => <ul style={{ marginTop: 16, fontSize: 28, color: "var(--brown)" }}>{items.map((i) => <li key={i} style={{ marginTop: 8 }}>· {i}</li>)}</ul>
  return (
    <Slide index={index} section={section} eyebrow="What we would build" title="Watch the trip, and learn from every “no”">
      <div className="row gap32" style={{ alignItems: "stretch" }}>
        <Card style={{ flex: 1, padding: 44, minHeight: 330 }}>
          <Chip tone="teal">Primary</Chip>
          <div style={{ fontSize: 34, fontWeight: 600, marginTop: 16 }}>(5)+(4) Watch the trip</div>
          <List items={["Real agent, On the road area", "Your Bentley example, end to end", "Decision cards are the control room"]} />
        </Card>
        <Card style={{ flex: 1, padding: 44, minHeight: 330 }}>
          <Chip tone="orange">Layer</Chip>
          <div style={{ fontSize: 34, fontWeight: 600, marginTop: 16 }}>(8) Light version</div>
          <List items={["Reject + why on each card", "Typed checks on each run", "Draft evals for review"]} />
        </Card>
      </div>
      <Caps style={{ marginTop: 36 }}>What the demo shows</Caps>
      <div className="row" style={{ marginTop: 16, gap: 12 }}>
        {steps.map((s, i) => (
          <Tone key={s} tone={i === 0 ? "green" : i === 5 ? "orange" : ""} style={{ flex: 1, height: 150, justifyContent: "center", textAlign: "center", fontSize: 26 }}>{s}</Tone>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 26, marginTop: 28, fontStyle: "italic" }}>Alternative: (2) Strike watch, if you want the travel area instead.</p>
    </Slide>
  )
}
