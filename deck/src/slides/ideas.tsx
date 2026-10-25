import type { CSSProperties, ReactNode } from "react"
import { Arrow, Buttons, Caps, Card, Chip, IdeaSlide, Tone } from "../components"
import { IDEAS } from "../data/ideas"

type P = { index: number; section: string }
const idea = (n: number) => IDEAS[n - 1]

const OptionCard = ({ title, lines, hi, w }: { title: string; lines: [string, CSSProperties?][]; hi?: boolean; w?: number }) => (
  <Card tone={hi ? "teal" : ""} style={{ flex: 1, width: w, padding: "24px 26px" }}>
    <div style={{ fontSize: 26, fontWeight: 600, color: hi ? "var(--teal-ink)" : undefined }}>{title}</div>
    {lines.map(([l, st], i) => <div key={i} style={{ fontSize: 28, marginTop: 10, ...st }}>{l}</div>)}
  </Card>
)

export const Carpool = ({ index, section }: P) => (
  <IdeaSlide idea={idea(1)} index={index} section={section}>
    <Card tone="tray" style={{ height: 330, padding: 0, position: "relative" }}>
      <svg width="904" height="330" viewBox="0 0 904 330" fontFamily="Poppins" fontSize="24">
        <text x="48" y="52" fill="#1f6f7b" fontWeight="600">Driver A delivers a car</text>
        <line x1="70" y1="100" x2="834" y2="100" stroke="#43afc1" strokeWidth="6" strokeLinecap="round" />
        <text x="48" y="150" fill="#12110e">Espoo</text><text x="856" y="150" textAnchor="end" fill="#12110e">Tampere</text>
        <text x="48" y="212" fill="#b04617" fontWeight="600">Driver B needs a ride to the next pickup</text>
        <line x1="834" y1="262" x2="70" y2="262" stroke="#fd6a31" strokeWidth="6" strokeLinecap="round" strokeDasharray="2 14" />
        <text x="48" y="312" fill="#12110e">Pickup</text>
        {[[70, 100, "#43afc1"], [834, 100, "#43afc1"], [70, 262, "#fd6a31"], [834, 262, "#fd6a31"]].map(([x, y, c], i) => <circle key={i} cx={x as number} cy={y as number} r="14" fill={c as string} stroke="#fffef7" strokeWidth="5" />)}
      </svg>
      <div style={{ position: "absolute", right: 40, bottom: 28 }}><Chip tone="orange">Buffer ≥ X min</Chip></div>
    </Card>
    <div className="row gap16" style={{ marginTop: 28 }}>
      <Card style={{ flex: 1 }}><div className="muted" style={{ fontSize: 22 }}>Fee before</div><div className="disp" style={{ fontSize: 56 }}>50 EUR</div></Card>
      <Arrow />
      <Card tone="green" style={{ flex: 1 }}><div style={{ fontSize: 22, color: "var(--green-ink)" }}>Fee after</div><div className="disp" style={{ fontSize: 56, color: "var(--green-ink)" }}>Lower</div></Card>
    </div>
  </IdeaSlide>
)

export const Strike = ({ index, section }: P) => (
  <IdeaSlide idea={idea(2)} index={index} section={section}>
    <div className="row gap16" style={{ fontSize: 24, fontWeight: 600 }}>
      <span>Landing</span><Tone tone="red" style={{ flex: 1, height: 64, justifyContent: "center" }}>Train leg · strike</Tone><span>Pickup slot</span>
    </div>
    <div className="row gap16" style={{ marginTop: 32, alignItems: "stretch" }}>
      {[["Bus", "+40 min", "+12 EUR"], ["Taxi", "+0 min", "+85 EUR"], ["Later train", "+2 h", "+0 EUR"], ["Other airport", "+1 h", "+60 EUR"]].map(([n, m, c]) => (
        <OptionCard key={n} title={n} lines={[[m, { color: "var(--brown)" }], [c, { fontWeight: 600, color: "var(--orange-ink)" }]]} />
      ))}
    </div>
    <div className="row gap16" style={{ marginTop: 28 }}>
      <Tone tone="green" style={{ flex: 1, height: 110 }}>Driver is told. No yes needed.</Tone>
      <Tone tone="orange" style={{ flex: 1, height: 110 }}>Cost over limit. A person says yes.</Tone>
    </div>
  </IdeaSlide>
)

export const Scooters = ({ index, section }: P) => (
  <IdeaSlide idea={idea(3)} index={index} section={section}>
    <div className="row gap16" style={{ fontSize: 26, fontWeight: 600 }}>
      <span>Station</span>
      <div style={{ flex: 1, borderTop: "5px dotted var(--sand)", position: "relative", height: 0 }}>
        <span className="muted" style={{ position: "absolute", top: -42, left: "50%", transform: "translateX(-50%)", fontSize: 24, fontWeight: 400 }}>3.5 km</span>
      </div>
      <span>Pickup</span>
    </div>
    <div className="row gap16" style={{ marginTop: 36, alignItems: "stretch" }}>
      {[["Bus", "38 min", "4 EUR", false], ["Taxi", "9 min", "22 EUR", false], ["Scooter *", "14 min", "6 EUR", true]].map(([n, m, c, hi]) => (
        <Card key={n as string} tone={hi ? "teal" : ""} style={{ flex: 1, padding: "28px" }}>
          <div style={{ fontSize: 28, fontWeight: 600, color: hi ? "var(--teal-ink)" : undefined }}>{n}</div>
          <div className="disp" style={{ fontSize: 52, marginTop: 14 }}>{m}</div>
          <div style={{ fontSize: 30, marginTop: 10, color: "var(--brown)" }}>{c}</div>
        </Card>
      ))}
    </div>
    <Caps style={{ marginTop: 36 }}>The agent checks</Caps>
    <div className="row gap8" style={{ marginTop: 14 }}>
      {["Free scooter", "Inside zone", "Legal end spot"].map((c) => <Chip key={c} tone="teal">{c}</Chip>)}
    </div>
  </IdeaSlide>
)

export const GpsStop = ({ index, section }: P) => (
  <IdeaSlide idea={idea(4)} index={index} section={section}>
    <div className="row" style={{ justifyContent: "center" }}><Tone style={{ width: 400, height: 70, justifyContent: "center" }}>Long unplanned stop</Tone></div>
    <svg width="904" height="50" viewBox="0 0 904 50" fill="none" stroke="#ccc6ba" strokeWidth="3"><path d="M452 0V22M150 22H754M150 22V50M452 22V50M754 22V50" /></svg>
    <div className="row gap16" style={{ alignItems: "stretch" }}>
      {[["green", "Gas station, ETA safe", "Log. Stay quiet."], ["orange", "Odd place or stale GPS", "Ask the driver. No answer: raise."], ["red", "Breakdown or ETA at risk", "Decision card"]].map(([t, h, b]) => (
        <Tone key={h} tone={t} style={{ flex: 1, flexDirection: "column", alignItems: "flex-start", fontSize: 22, height: 190, gap: 8 }}>
          <span style={{ fontSize: 24 }}>{h}</span><span style={{ fontWeight: 400 }}>{b}</span>
        </Tone>
      ))}
    </div>
    <Card style={{ marginTop: 24, padding: "24px 28px" }}>
      <p style={{ fontSize: 22, color: "var(--brown)" }}>Car stopped 42 min, A7 service area. Driver safe. Red warning light (photo). ETA +1 day. Chained gig at risk. Suggest: call dealer about roadside or a tow.</p>
      <div style={{ marginTop: 16 }}><Buttons /></div>
    </Card>
  </IdeaSlide>
)

export const CheckIn = ({ index, section }: P) => {
  const ev: [string, number, string][] = [["Leave home", 70, "Check-in"], ["Airport", 270, "Check-in"], ["Landing", 480, "Flight status"], ["Pickup", 830, ""]]
  return (
    <IdeaSlide idea={idea(5)} index={index} section={section}>
      <svg width="904" height="160" viewBox="0 0 904 160" fontFamily="Poppins">
        <rect x="560" y="2" width="220" height="40" rx="10" fill="#e9f5f7" stroke="#43afc1" strokeWidth="2" />
        <text x="670" y="29" textAnchor="middle" fontSize="20" fontWeight="600" fill="#1f6f7b">GPS window · 1 h</text>
        <line x1="30" y1="80" x2="874" y2="80" stroke="#ccc6ba" strokeWidth="4" />
        {ev.map(([l, x, s]) => (
          <g key={l}>
            <circle cx={x} cy="80" r="12" fill="#12110e" stroke="#fffef7" strokeWidth="4" />
            <text x={x} y="124" textAnchor="middle" fontSize="22" fontWeight="600" fill="#12110e">{l}</text>
            {s && <text x={x} y="150" textAnchor="middle" fontSize="19" fill="#726958">{s}</text>}
          </g>
        ))}
      </svg>
      <div className="row gap32" style={{ marginTop: 10, alignItems: "flex-start" }}>
        <Tone style={{ flex: 1, height: 200, fontSize: 24 }}>Flight status is already known. No question to the driver.</Tone>
        <div style={{ width: 360, height: 340, border: "7px solid var(--ink)", borderRadius: 44, padding: "36px 28px", background: "var(--birch)", display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 600, textAlign: "center" }}>Are you on your way?</div>
          <span className="btn primary" style={{ width: "100%", justifyContent: "center" }}>Yes</span>
          <span className="btn" style={{ width: "100%", justifyContent: "center", fontSize: 20 }}>Share location once</span>
        </div>
      </div>
    </IdeaSlide>
  )
}

export const DataStick = ({ index, section }: P) => (
  <IdeaSlide idea={idea(6)} index={index} section={section}>
    <div className="row" style={{ gap: 6 }}>
      {["Stick", "Car port", "Driver app", "Agent", "Decision card + code"].map((d, i) => (
        <div key={d} className="row" style={{ flex: 1, gap: 6 }}>
          <Card tone={i === 4 ? "orange" : ""} style={{ flex: 1, height: 130, padding: 10, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontSize: 22, fontWeight: 600 }}>{d}</Card>
          {i < 4 && <svg className="arr" style={{ width: 30 }} viewBox="0 0 56 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"><path d="M4 12h46M40 4l10 8-10 8" /></svg>}
        </div>
      ))}
    </div>
    <Caps style={{ marginTop: 40 }}>The stick reads</Caps>
    <div className="row gap8" style={{ marginTop: 14 }}>{["Fault code", "Fuel or battery", "Mileage", "Speed"].map((c) => <Chip key={c} tone="teal">{c}</Chip>)}</div>
    <Tone tone="orange" style={{ marginTop: 40, flexDirection: "column", alignItems: "flex-start", gap: 8, padding: "28px 32px" }}>
      <span className="caps" style={{ color: "var(--orange-ink)" }}>Open question</span>
      <span style={{ fontSize: 30 }}>May a driver plug a device into a customer car?</span>
    </Tone>
  </IdeaSlide>
)

export const VoiceDesk = ({ index, section }: P) => {
  const msgs: [string, string][] = [["Agent", "Is there space for one car on tonight's ship?"], ["Desk", "Tonight is full. 07:30 tomorrow has space."], ["Agent", "What does a name change cost?"], ["Desk", "35 EUR."]]
  return (
    <IdeaSlide idea={idea(7)} index={index} section={section}>
      <div className="col gap16">
        {msgs.map(([who, text], i) => (
          <div key={i} className={`tone ${who === "Agent" ? "teal" : ""}`} style={{ width: 640, borderRadius: 24, fontWeight: 400, fontSize: 24, alignSelf: who === "Agent" ? "flex-start" : "flex-end" }}>
            <b style={{ marginRight: 12 }}>{who}</b>{text}
          </div>
        ))}
      </div>
      <Caps style={{ marginTop: 28 }}>Options for a person to pick</Caps>
      <div className="row gap16" style={{ marginTop: 14 }}>
        <OptionCard title="07:30 tomorrow" lines={[["+35 EUR, hotel needed?", { fontSize: 24, color: "var(--brown)" }]]} />
        <OptionCard title="19:00 tomorrow" lines={[["+35 EUR, no hotel", { fontSize: 24, color: "var(--brown)" }]]} />
      </div>
    </IdeaSlide>
  )
}

const Node = ({ c, r, tone, children }: { c: number; r: number; tone: string; children: ReactNode }) => (
  <Tone tone={tone} style={{ gridColumn: c, gridRow: r, height: 96, justifyContent: "center", textAlign: "center", fontSize: 21, lineHeight: 1.25, boxShadow: "0 0 0 2px var(--hair)" }}>{children}</Tone>
)
const Cell = ({ c, r, children, span = 1, style }: { c: number; r: number; children: ReactNode; span?: number; style?: CSSProperties }) => (
  <div style={{ gridColumn: `${c} / span ${span}`, gridRow: r, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", ...style }}>{children}</div>
)

export const JudgeLoop = ({ index, section }: P) => (
  <IdeaSlide idea={idea(8)} index={index} section={section}>
    <div style={{ display: "grid", gridTemplateColumns: "184px 56px 184px 56px 184px 56px 184px", gridTemplateRows: "96px 80px 96px 80px 96px", fontFamily: "var(--font-body)" }}>
      <Node c={1} r={1} tone="">Agent run trace</Node>
      <Cell c={2} r={1}><Arrow /></Cell>
      <Node c={3} r={1} tone="teal">Typed checks, every run</Node>
      <Cell c={4} r={1}><Arrow /></Cell>
      <Node c={5} r={1} tone="orange">Eval candidate</Node>
      <Cell c={6} r={1}><Arrow /></Cell>
      <Node c={7} r={1} tone="teal">Draft eval (LLM)</Node>

      <Cell c={5} r={2} span={3}>
        <svg width="424" height="80" viewBox="0 0 424 80" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fontFamily="Poppins">
          <path d="M332 4V70M322 60l10 10 10-10" stroke="#1b7a52" />
          <path d="M332 4V28H92V70M82 60l10 10 10-10" stroke="#ccc6ba" />
          <text x="344" y="48" fontSize="18" fill="#1b7a52">clear</text>
          <text x="180" y="22" fontSize="18" fill="#726958">unclear</text>
        </svg>
      </Cell>
      <Node c={5} r={3} tone="">Area expert</Node>
      <Cell c={6} r={3}><Arrow /></Cell>
      <Node c={7} r={3} tone="green">Eval set</Node>

      <Cell c={3} r={2} style={{ gridRow: "2 / 5" }}>
        <svg width="40" height="256" viewBox="0 0 40 256" fill="none" stroke="#1f6f7b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 252V6M10 16L20 6l10 10" /></svg>
      </Cell>
      <Node c={1} r={5} tone="orange">Operator: Reject + why</Node>
      <Cell c={2} r={5}><Arrow /></Cell>
      <Node c={3} r={5} tone="teal">New typed check</Node>
    </div>
    <p className="muted" style={{ fontSize: 20, marginTop: 14, fontStyle: "italic" }}>The new check feeds back into “Typed checks, every run”.</p>
  </IdeaSlide>
)
