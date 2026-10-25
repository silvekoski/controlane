import { Arrow, Badge, Buttons, Caps, Card, Chip, Slide, Src, Tone } from "../components"
import { IDEAS } from "../data/ideas"

type P = { index: number; section: string }

export const Icon = ({ kind, color = "currentColor" }: { kind: string; color?: string }) => (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {kind === "ban" && <><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></>}
    {kind === "check" && <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></>}
    {kind === "search" && <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l5 5" /></>}
    {kind === "model" && <><rect x="5" y="5" width="14" height="14" rx="3" /><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" /></>}
    {kind === "layout" && <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 10h18M9 10v10" /></>}
    {kind === "person" && <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4.5 4-6 8-6s7 1.5 8 6" /></>}
  </svg>
)

export const TitleSlide = () => {
  const pts: [number, number][] = [[140, 160], [520, 330], [300, 600], [700, 760], [470, 930], [820, 820], [860, 400], [700, 140]]
  const cols = ["#43afc1", "#fd6a31", "#fd4a61", "#29af77"]
  return (
    <div className="slide dark" style={{ flexDirection: "row" }}>
      <div style={{ width: 960, padding: "96px 96px", display: "flex", flexDirection: "column" }}>
        <div className="mono" style={{ fontSize: 22, color: "var(--sand)" }}>Prompt Operations Hackathon · 24 to 25 Oct 2026</div>
        <h1 className="s-title" style={{ fontSize: 84, marginTop: "auto", lineHeight: 1.08 }}>Eight ways to give your agents more legwork</h1>
        <p style={{ fontSize: 34, marginTop: 40 }}>Help us pick the one to build</p>
        <p style={{ fontSize: 24, color: "var(--sand)", marginTop: 8, marginBottom: 40 }}>Veikka Silvekoski</p>
      </div>
      <svg width="960" height="1080" viewBox="0 0 960 1080" style={{ flex: "none" }}>
        <g stroke="#423d33" strokeWidth="5" fill="none" strokeLinecap="round">
          <polyline points={pts.map((p) => p.join(",")).join(" ")} />
          <path d={`M${pts[1]} L${pts[6]}`} strokeDasharray="4 16" />
          <path d={`M${pts[2]} L${pts[5]}`} strokeDasharray="4 16" />
        </g>
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="26" fill={cols[i % 4]} stroke="#12110e" strokeWidth="8" />)}
      </svg>
    </div>
  )
}

export const HeardSlide = ({ index, section }: P) => {
  const stats = [["25,000+", "cars delivered a year", "BR"], ["~96%", "of intra-FI orders run with no human", "T2"], ["20-30%", "of gigs are chained to another gig", "T2"], ["~1 h", "GPS starts before pickup", "T3"]]
  const quotes = [["Individual problems are simple. The problem comes with scale.", "T1"], ["Moving context from people's heads into evals is the job.", "T2"]]
  return (
    <Slide index={index} section={section} eyebrow="What we heard" title="The hard part is the chain, not the case">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
        {stats.map(([big, cap, t]) => (
          <Card key={big} style={{ height: 300, display: "flex", flexDirection: "column" }}>
            <div className="disp" style={{ fontSize: 64 }}>{big}</div>
            <p style={{ fontSize: 26, color: "var(--brown)", marginTop: 14 }}>{cap}</p>
            <Src t={t} style={{ marginTop: "auto" }} />
          </Card>
        ))}
      </div>
      <div className="col gap16" style={{ marginTop: 40 }}>
        {quotes.map(([q, t]) => (
          <div key={t} className="quote" style={{ fontSize: 32, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "30px 40px" }}>
            <span>&ldquo;{q}&rdquo;</span><span className="src" style={{ margin: 0 }}>{t}</span>
          </div>
        ))}
      </div>
    </Slide>
  )
}

export const RulesSlide = ({ index, section }: P) => {
  const rules: [string, string, string][] = [
    ["ban", "The agent never contacts a customer on its own", "BR"],
    ["person", "A person says yes before bookings, dates, costs and customer messages", "BR"],
    ["search", "Asking and looking up need no yes", "BR"],
    ["model", "A real model in a loop. Everything else can be mocked", "BR"],
    ["layout", "Ops people, not engineers: no developer-tool look", "BR"],
    ["check", "Must handle 100+ deliveries per person per day", "T2"],
  ]
  return (
    <Slide index={index} section={section} eyebrow="Your rules, our lens" title="How we scored our own ideas">
      <div className="row" style={{ gap: 6, height: 84 }}>
        {[["Control room", "40%", 40, "var(--ink)"], ["How we used AI", "30%", 30, "var(--teal-ink)"], ["Taste", "30%", 30, "var(--orange-ink)"]].map(([l, p, f, c]) => (
          <div key={l as string} style={{ flex: f as number, background: c as string, color: "var(--birch)", borderRadius: 14, padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 28, fontWeight: 600, height: "100%" }}>
            <span>{l}</span><span className="disp">{p}</span>
          </div>
        ))}
      </div>
      <div className="col" style={{ marginTop: 28, gap: 8 }}>
        {rules.map(([k, text, t], i) => (
          <div key={text} className="row" style={{ height: 76, borderRadius: 14, padding: "0 28px", gap: 28, background: i % 2 ? "var(--birch)" : "var(--tray)", fontSize: 30 }}>
            <Icon kind={k} color="var(--brown)" /><span style={{ flex: 1 }}>{text}</span><Src t={t} />
          </div>
        ))}
      </div>
    </Slide>
  )
}

export const PatternSlide = ({ index, section }: P) => (
  <Slide index={index} section={section} eyebrow="One pattern, eight places" title="Cheap work first, then one decision">
    <div className="row gap16">
      <Tone style={{ width: 300, height: 84, justifyContent: "center" }}>Signal</Tone><Arrow />
      <Tone tone="teal" style={{ width: 300, height: 84, justifyContent: "center" }}>Cheap checks</Tone><Arrow />
      <Tone tone="green" style={{ width: 300, height: 84, justifyContent: "center" }}>Finish quietly</Tone>
    </div>
    <div className="row gap16" style={{ marginLeft: 510, marginTop: 12 }}>
      <Arrow v />
    </div>
    <div className="row gap16" style={{ marginLeft: 388 }}>
      <Tone tone="orange" style={{ width: 300, height: 84, justifyContent: "center" }}>Decision card</Tone><Arrow />
      <Tone style={{ width: 300, height: 84, justifyContent: "center" }}>Person decides</Tone><Arrow />
      <Tone tone="teal" style={{ width: 420, height: 84, justifyContent: "center" }}>Outcome + reason logged</Tone>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "800px 1fr", gap: 32, marginTop: 40 }}>
      <Card style={{ height: 360 }}>
        <Caps style={{ color: "var(--green-ink)" }}>Agent just does it</Caps>
        <p style={{ fontSize: 28, marginTop: 10 }}>Look up, ask the driver, ask the pickup place, log</p>
        <hr style={{ border: 0, borderTop: "2px solid var(--hair)", margin: "26px 0" }} />
        <Caps style={{ color: "var(--orange-ink)" }}>Person says yes first</Caps>
        <p style={{ fontSize: 28, marginTop: 10 }}>Cost, date, booking, any customer message</p>
      </Card>
      <Card style={{ height: 330 }}>
        <Caps>Decision card (mock)</Caps>
        <p style={{ fontSize: 24, marginTop: 14, color: "var(--brown)" }}>
          <b>What happened</b> A long stop<br /><b>What the agent found</b> A service area, driver safe<br /><b>Suggestion</b> Call the dealer about roadside
        </p>
        <div style={{ marginTop: 28 }}><Buttons /></div>
      </Card>
    </div>
  </Slide>
)

export const MapSlide = ({ index, section }: P) => {
  const stages: [string, number[]][] = [["Dispatch", [1]], ["Travel to car", [2, 3, 7]], ["Pickup", [5]], ["On the road", [4, 6]], ["Delivery", []]]
  return (
    <Slide index={index} section={section} eyebrow="Where they fit" title="Eight ideas across one delivery">
      <div className="row gap16" style={{ alignItems: "flex-start" }}>
        {stages.map(([name, pins], i) => (
          <div key={name} className="row gap16" style={{ flex: 1 }}>
            <div className="col gap16" style={{ flex: 1, alignItems: "center" }}>
              <Tone tone={i === 3 ? "teal" : ""} style={{ width: "100%", height: 130, fontSize: 26, justifyContent: "center" }}>{i + 1}&nbsp; {name}</Tone>
              <div className="row gap8" style={{ height: 80 }}>{pins.map((n) => <Badge key={n} n={n} />)}</div>
            </div>
            {i < 4 && <Arrow />}
          </div>
        ))}
      </div>
      <Tone tone="orange" style={{ height: 150, marginTop: 28, justifyContent: "space-between" }}>
        <span className="caps" style={{ color: "var(--orange-ink)", fontSize: 24 }}>Learning layer, under every agent</span><Badge n={8} />
      </Tone>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "30px 24px", marginTop: 56 }}>
        {IDEAS.map((i) => <div key={i.n} className="row gap16" style={{ fontSize: 28 }}><Badge n={i.n} size="sm" />{i.short}</div>)}
      </div>
    </Slide>
  )
}
