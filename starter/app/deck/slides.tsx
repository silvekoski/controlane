import type { CSSProperties, ReactNode } from "react"
import { BahnLogo, ControlaneLogo } from "@/app/components/brand"
import { ArrowRightIcon, CheckIcon, LockIcon, UserRoundIcon } from "@/components/icons"
import { BRIEF, CHECKER, LINKS, SNAPSHOT, STOP } from "@/lib/deck/metrics"
import { ArrowDefs, Badge, BarCompare, In, Shot, Slide, TONE, TRUTH } from "./parts"

const Truth = () => <span>{TRUTH}</span>
const sep = <span aria-hidden style={{ color: "var(--deck-grey)" }}>·</span>

// 1. Who
function Title() {
  return <section className="slide" aria-label="Slide 1" style={{ padding: "0 96px" }}>
    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "700px 1fr", gap: 80, alignItems: "center", paddingBottom: 60 }}>
      <div>
        <In n={0}><ControlaneLogo className="h-[88px]" /></In>
        <In n={1}><h1 style={{ marginTop: 56, fontSize: 64 }}>Agents do the legwork, people decide</h1></In>
        <In n={2}><p style={{ marginTop: 40, fontSize: 28 }}>Veikka Silvekoski {sep} bob the builder</p></In>
        <In n={3}><p className="d-mono" style={{ marginTop: 12, fontSize: 28, color: "var(--primary)" }}>{LINKS.site}</p></In>
      </div>
      <In n={2}>
        <Shot src="/deck/01-overview.jpg" alt="The Controlane overview: decisions waiting, orders by lane, work handled without a person, and money." crop={[0, 0, 2880, 1800]} width={944} />
      </In>
    </div>
    <div className="foot">
      <BahnLogo className="h-[22px] text-foreground" />
      <span>Built for Bahn&apos;s challenge {sep} Prompt Operations Hackathon, 24 to 25 Oct 2026</span>
      <span style={{ marginLeft: "auto" }}><Truth /></span>
      <span className="d-mono" style={{ marginLeft: 24 }}>01 / 10</span>
    </div>
  </section>
}

// 2. The problem
function Problem() {
  const stats = [[BRIEF.cars, "cars this year"], [BRIEF.drivers, "drivers"], [BRIEF.people, "people in operations"], [BRIEF.countries, "countries"]]
  const chain = ["Ferry sold out", "New booking", "Hotel?", "Email to the ferry line", "Cost decision"]
  return <Slide n={2} chip="The problem" title="Every change starts a chain someone has to hold" sub="Each problem is simple alone. The chain is the hard part." foot={<span>Source: Bahn challenge brief</span>}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
      {stats.map(([v, l], k) => <In key={l} n={3 + k} className="d-card" style={{ padding: "28px 32px" }}>
        <div className="d-mono" style={{ fontSize: 64, fontWeight: 600, letterSpacing: "-0.03em" }}>{v}</div>
        <div style={{ fontSize: 22, color: "var(--muted-foreground)" }}>{l}</div>
      </In>)}
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 72 }}>
      {chain.map((c, k) => <div key={c} style={{ display: "contents" }}>
        <In n={7 + k} className="d-card" style={{ flex: 1, height: 132, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 24px", ...(k === 0 ? { borderColor: "var(--warning)" } : {}) }}>
          <span className="d-mono" style={{ fontSize: 18, color: "var(--muted-foreground)" }}>Step {k + 1}</span>
          <span style={{ fontSize: 26, fontWeight: 600 }}>{c}</span>
        </In>
        <In n={7 + k}><ArrowRightIcon style={{ width: 32, height: 32, color: "var(--muted-foreground)" }} /></In>
      </div>)}
      <In n={12} style={{ width: 210, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10 }}>
        <span style={{ width: 76, height: 76, borderRadius: "50%", display: "grid", placeItems: "center", background: "color-mix(in oklch, var(--primary), transparent 88%)", color: "var(--primary)" }}>
          <UserRoundIcon style={{ width: 40, height: 40 }} />
        </span>
        <span style={{ fontSize: 20, fontWeight: 500 }}>Today, one person holds all of it</span>
      </In>
    </div>
  </Slide>
}

// 3. The control room: the quiet funnel
function Queue() {
  const rows: [number, string, string][] = [
    [SNAPSHOT.orders, "orders", ""],
    [SNAPSHOT.active, "active", `${SNAPSHOT.orders - SNAPSHOT.active} delivered or cancelled leave here`],
    [SNAPSHOT.onTrack, "on track", "the agents handle these"],
    [SNAPSHOT.decisions, "decisions", "a person decides these first"],
  ]
  return <Slide n={3} chip="The control room" title={`${SNAPSHOT.onTrack} of ${SNAPSHOT.active} active orders need nobody; ${SNAPSHOT.decisions} decisions come first`}
    foot={<><span>Source: overview snapshot, {SNAPSHOT.label}</span>{sep}<Truth /></>}>
    <div style={{ display: "grid", gridTemplateColumns: "600px 1fr", gap: 72, alignItems: "start" }}>
      <div style={{ display: "grid", gap: 22, marginTop: 8 }}>
        {rows.map(([v, l, note], k) => {
          const last = k === rows.length - 1
          return <div key={l}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span className="d-mono" style={{ fontSize: 40, fontWeight: 600, color: last ? "var(--primary)" : undefined }}>{v}</span>
              <span style={{ fontSize: 24, fontWeight: 500 }}>{l}</span>
            </div>
            <div className="grow-x" style={{ "--i": 3 + k, marginTop: 6, height: 40, borderRadius: 6, width: `${Math.max(v, 1.4)}%`, background: last ? "var(--primary)" : "var(--deck-grey)" } as CSSProperties} />
            {note && <In n={4 + k}><div className="d-src" style={{ marginTop: 6, fontSize: 19 }}>{note}</div></In>}
          </div>
        })}
      </div>
      <In n={4}>
        <Shot src="/deck/02-decisions-queue.jpg" alt="The decision queue: three overdue cards for CD-420055, CD-420612 and CD-420299, each with its problem type and who must answer." crop={[580, 760, 2210, 1000]} width={1040} />
        <p className="d-src" style={{ marginTop: 18, fontSize: 20 }}>&ldquo;Sorted by the time left before a promise breaks.&rdquo; From the app</p>
      </In>
    </div>
  </Slide>
}

// 4. The control room: one decision card
function Card() {
  const callouts: [number, number, string][] = [
    [2420, 274, "Question first, and who decides"],
    [1692, 840, "Every fact with its source and age"],
    [2050, 1063, "The suggestion, and who approves it"],
    [1560, 1063, "Models flag known traps before you approve"],
  ]
  return <Slide n={4} chip="The control room" title="One card shows what happened, who said it, and what is next"
    foot={<><span>&ldquo;The system reads the facts again before it acts.&rdquo; From the app</span>{sep}<Truth /></>}>
    <div style={{ display: "grid", gridTemplateColumns: "1040px 1fr", gap: 64, alignItems: "start" }}>
      <In n={3}>
        <Shot src="/deck/03-decision-card-cd-420055.jpg" alt="Decision card CD-420055: a claim photo shows a scrape, the facts with their sources, and the agent's suggestion waiting for approval." crop={[540, 140, 2300, 1420]} width={1040}
          overlay={(at) => callouts.map(([x, y], k) => <span key={k} className="in" style={{ ...at(x, y), "--i": 5 + k, transform: "translate(-50%, -50%)" } as CSSProperties}><Badge n={k + 1} /></span>)} />
      </In>
      <ol style={{ display: "grid", gap: 36, marginTop: 24 }}>
        {callouts.map(([, , text], k) => <In key={k} n={5 + k} style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <Badge n={k + 1} /><span style={{ fontSize: 28, fontWeight: 500 }}>{text}</span>
        </In>)}
      </ol>
    </div>
  </Slide>
}

// 5. The agent: the stop check flow
export function StopFlow() {
  const nodes = [["GPS pings", "position and speed"], ["Stop rule", "long and not planned"], ["Cheap checks", "signal, places, chat"], ["Decision models", "rank the likely cause"], ["Outcome policy", "plain code picks"]]
  const outs: [string, string, string][] = [["A", "Log it quietly", "good"], ["B", "Ask the driver", "warning"], ["C", "One card for a person", "critical"]]
  const W = 222, G = 32, Y = 20, H = 128, X = [200, 620, 1040]
  return <svg viewBox="0 0 1240 520" width={1240} height={520} role="img" aria-label="Stop check flow: GPS pings, stop rule, cheap checks, decision models, outcome policy, then one of three outcomes.">
    <ArrowDefs />
    {nodes.map(([t, s], k) => {
      const x = k * (W + G), hot = k === 2
      return <g key={t} className="in" style={{ "--i": 3 + k } as CSSProperties}>
        <rect x={x + 1} y={Y} width={W} height={H} rx={12} fill={hot ? "color-mix(in oklch, var(--primary), transparent 90%)" : "var(--card)"} stroke={hot ? "var(--primary)" : "var(--border)"} strokeWidth={hot ? 2.5 : 1.5} />
        <text x={x + 22} y={Y + 54} fontSize={24} fontWeight={600} fill={hot ? "var(--primary)" : "var(--foreground)"}>{t}</text>
        <text x={x + 22} y={Y + 92} fontSize={18} fill="var(--muted-foreground)">{s}</text>
        {k < nodes.length - 1 && <line x1={x + W + 6} y1={Y + H / 2} x2={x + W + G - 4} y2={Y + H / 2} stroke="var(--muted-foreground)" strokeWidth={2} markerEnd="url(#deck-arrow)" />}
      </g>
    })}
    <g className="in" style={{ "--i": 8 } as CSSProperties}>
      <path d={`M ${4 * (W + G) + W / 2} ${Y + H + 4} V 280 H ${X[0]} V 330 M ${X[1]} 280 V 330 M ${X[2]} 280 V 330`} fill="none" stroke="var(--muted-foreground)" strokeWidth={2} />
      {X.map((x) => <line key={x} x1={x} y1={326} x2={x} y2={338} stroke="var(--muted-foreground)" strokeWidth={2} markerEnd="url(#deck-arrow)" />)}
    </g>
    {outs.map(([l, t, tone], k) => {
      const cx = X[k]
      return <g key={l} className="in" style={{ "--i": 9 + k } as CSSProperties}>
        <rect x={cx - 190} y={346} width={380} height={110} rx={12} fill={`color-mix(in oklch, ${TONE[tone]}, transparent 88%)`} stroke={TONE[tone]} strokeWidth={2} />
        <circle cx={cx - 140} cy={401} r={22} fill={TONE[tone]} />
        <text x={cx - 140} y={409} fontSize={22} fontWeight={700} textAnchor="middle" fill="white">{l}</text>
        <text x={cx - 100} y={410} fontSize={25} fontWeight={600} fill="var(--foreground)">{t}</text>
      </g>
    })}
  </svg>
}

function StopCheck() {
  const costs: [string, string][] = [["GPS signal", "free"], ["Places lookup", "one call"], ["Driver chat", "free"], ["Arrival time", "free"], ["Decision models", `about ${CHECKER.ms[0].value} ms`]]
  return <Slide n={5} chip="The agent" title="The stop check does the cheap work first" sub="A plain rule finds the stop. The models rank the cause. Plain code picks the outcome.">
    <div style={{ display: "grid", gridTemplateColumns: "1240px 1fr", gap: 56 }}>
      <StopFlow />
      <In n={9} className="d-card" style={{ padding: "28px 32px", alignSelf: "start" }}>
        <div className="d-caps">Cheap first</div>
        <div style={{ display: "grid", marginTop: 12 }}>
          {costs.map(([l, c], k) => <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderTop: k ? "1px solid var(--border)" : undefined, fontSize: 22 }}>
            <span>{l}</span><span className="d-mono" style={{ color: "var(--muted-foreground)" }}>{c}</span>
          </div>)}
        </div>
      </In>
    </div>
  </Slide>
}

// 6. The control room: one stop, three outcomes
function StopMap() {
  const cx = 400, cy = 230, pxPerM = 1.2
  return <svg viewBox="0 0 800 480" width={800} height={480} role="img" aria-label={`Schematic map of the stop on ${STOP.order} and three nearby places.`} style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--muted)" }}>
    <path d="M 560 0 Q 640 120 800 140 V 0 Z" fill="color-mix(in oklch, var(--chart-2), transparent 82%)" />
    <rect x={40} y={330} width={190} height={110} rx={10} fill="color-mix(in oklch, var(--deck-good), transparent 86%)" />
    <path d="M -10 270 C 200 250 300 262 400 256 S 640 240 810 300" fill="none" stroke="var(--card)" strokeWidth={26} />
    <path d="M -10 270 C 200 250 300 262 400 256 S 640 240 810 300" fill="none" stroke="var(--deck-grey)" strokeWidth={1.5} strokeDasharray="10 10" />
    <path d="M 300 -10 C 320 120 340 200 330 490" fill="none" stroke="var(--card)" strokeWidth={14} />
    <path d="M 520 490 C 540 380 560 300 640 150" fill="none" stroke="var(--card)" strokeWidth={14} />
    <text x={24} y={248} fontSize={16} fill="var(--muted-foreground)">E18</text>
    {STOP.places.map((p, k) => {
      const a = (p.angle * Math.PI) / 180, r = p.m * pxPerM
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r
      const left = x < cx || x > 560
      return <g key={p.name} className="in" style={{ "--i": 4 + k } as CSSProperties}>
        <line x1={cx} y1={cy} x2={x} y2={y} stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="4 6" />
        <path d={`M ${x} ${y} c -11 -14 -16 -22 -16 -30 a 16 16 0 0 1 32 0 c 0 8 -5 16 -16 30 z`} fill="var(--card)" stroke="var(--muted-foreground)" strokeWidth={2} />
        <circle cx={x} cy={y - 30} r={6} fill="var(--muted-foreground)" />
        <text x={left ? x - 26 : x + 26} y={y - 34} fontSize={20} fontWeight={600} textAnchor={left ? "end" : "start"} fill="var(--foreground)">{p.name}</text>
        <text x={left ? x - 26 : x + 26} y={y - 10} fontSize={18} textAnchor={left ? "end" : "start"} fill="var(--muted-foreground)" fontFamily="var(--font-mono)">{p.m} m</text>
      </g>
    })}
    <g className="in" style={{ "--i": 3 } as CSSProperties}>
      <circle cx={cx} cy={cy} r={34} fill="color-mix(in oklch, var(--primary), transparent 80%)" />
      <circle cx={cx} cy={cy} r={14} fill="var(--primary)" stroke="var(--card)" strokeWidth={4} />
      <text x={cx} y={cy + 66} textAnchor="middle" fontSize={18} fontWeight={600} fill="var(--primary)" fontFamily="var(--font-mono)">{STOP.order}</text>
    </g>
    <text x={784} y={466} fontSize={15} textAnchor="end" fill="var(--muted-foreground)">Schematic map, fictional places</text>
  </svg>
}

function OneStop() {
  return <Slide n={6} chip="The control room" title="One stop, three outcomes, one decision for a person"
    foot={<><span>Source: the worked example in the stop check build spec</span>{sep}<Truth /></>}>
    <div style={{ display: "grid", gridTemplateColumns: "800px 1fr", gap: 72 }}>
      <In n={2}><StopMap /></In>
      <ol style={{ position: "relative", display: "grid", gap: 26, alignContent: "start", paddingTop: 8 }}>
        <span aria-hidden style={{ position: "absolute", left: 13, top: 22, bottom: 22, width: 2, background: "var(--border)" }} />
        {STOP.timeline.map((s, k) => <In key={s.t} n={4 + k} style={{ display: "grid", gridTemplateColumns: "28px 100px 1fr", alignItems: "center", gap: 20, position: "relative" }}>
          <span style={{ width: 28, height: 28, borderRadius: "50%", background: TONE[s.tone], boxShadow: "0 0 0 6px var(--background)" }} />
          <span className="d-mono" style={{ fontSize: 28, fontWeight: 600 }}>{s.t}</span>
          <span style={{ fontSize: 28 }}>{s.text}</span>
        </In>)}
      </ol>
    </div>
    <In n={10} className="d-card" style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "20px 28px", display: "flex", alignItems: "center", gap: 24, borderColor: "var(--primary)" }}>
      <span className="d-caps" style={{ color: "var(--primary)" }}>The card suggests</span>
      <span style={{ fontSize: 26, fontWeight: 500 }}>&ldquo;Call the dealer: their own roadside help, or should we arrange a tow?&rdquo;</span>
    </In>
  </Slide>
}

// 7. The control room and AI: approvals and the eval loop
function Approvals() {
  const ladder: [string, boolean][] = [["Look up and read", true], ["Message a driver", true], ["Message a customer", false], ["Book, spend or move a date", false]]
  const loop = ["Card", "Person rejects", "One-tap labeling case", "New eval case"]
  const C = 380, CY = 270, RX = 260, RY = 200
  return <Slide n={7} chip="The control room" title="A person approves every change, and every rejection becomes an eval">
    <div style={{ display: "grid", gridTemplateColumns: "820px 1fr", gap: 72 }}>
      <div>
        <div style={{ display: "grid", gap: 14 }}>
          {ladder.map(([a, alone], k) => <In key={a} n={3 + k} className="d-card" style={{ display: "grid", gridTemplateColumns: "56px 1fr auto", alignItems: "center", gap: 16, padding: "20px 24px" }}>
            <span style={{ width: 48, height: 48, borderRadius: 10, display: "grid", placeItems: "center", background: `color-mix(in oklch, ${alone ? TONE.good : TONE.warning}, transparent 86%)`, color: alone ? TONE.good : TONE.warning }}>
              {alone ? <CheckIcon style={{ width: 28, height: 28 }} /> : <LockIcon style={{ width: 26, height: 26 }} />}
            </span>
            <span style={{ fontSize: 28, fontWeight: 500 }}>{a}</span>
            <span style={{ fontSize: 22, color: alone ? "var(--muted-foreground)" : TONE.warning, fontWeight: alone ? 400 : 600 }}>{alone ? "The agent alone" : "A person approves"}</span>
          </In>)}
        </div>
        <In n={7}><p className="d-src" style={{ marginTop: 20, fontSize: 21 }}>More freedom only when a person raises the limit.</p></In>
      </div>
      <svg viewBox={`0 0 ${C * 2} ${CY * 2}`} width={C * 2} height={CY * 2} role="img" aria-label="The loop: card, person rejects, one-tap labeling case, new eval case, and back to the card.">
        <ArrowDefs />
        <g className="in" style={{ "--i": 4 } as CSSProperties}>
          <ellipse cx={C} cy={CY} rx={RX} ry={RY} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeDasharray="6 10" />
          {[1, 3, 5, 7].map((q) => {
            // A short clockwise tangent with an arrow head, half way between two nodes.
            const a = -Math.PI / 2 + (q * Math.PI) / 4
            const x = C + Math.cos(a) * RX, y = CY + Math.sin(a) * RY
            const dx = -Math.sin(a) * RX, dy = Math.cos(a) * RY, l = Math.hypot(dx, dy) / 14
            return <line key={q} x1={x - dx / l} y1={y - dy / l} x2={x + dx / l} y2={y + dy / l} stroke="var(--primary)" strokeWidth={2.5} markerEnd="url(#deck-arrow)" />
          })}
        </g>
        {loop.map((t, k) => {
          const a = -Math.PI / 2 + (k * Math.PI) / 2
          const x = C + Math.cos(a) * RX, y = CY + Math.sin(a) * RY
          const w = Math.max(150, t.length * 13 + 40)
          return <g key={t} className="in" style={{ "--i": 5 + k } as CSSProperties}>
            <rect x={x - w / 2} y={y - 32} width={w} height={64} rx={32} fill="var(--card)" stroke={k === 3 ? "var(--primary)" : "var(--border)"} strokeWidth={k === 3 ? 2.5 : 1.5} />
            <text x={x} y={y + 8} fontSize={22} fontWeight={600} textAnchor="middle" fill={k === 3 ? "var(--primary)" : "var(--foreground)"}>{t}</text>
          </g>
        })}
        <g className="in" style={{ "--i": 9 } as CSSProperties}>
          <text x={C} y={CY - 6} fontSize={26} fontWeight={600} textAnchor="middle" fill="var(--foreground)">From people&apos;s heads</text>
          <text x={C} y={CY + 28} fontSize={26} fontWeight={600} textAnchor="middle" fill="var(--primary)">to evals</text>
        </g>
      </svg>
    </div>
  </Slide>
}

// 8. The model
function Model() {
  return <Slide n={8} chip="The model" title={`A ${CHECKER.cost} fine-tune beats the commercial checker on unseen cases`}
    foot={<span>Synthetic test: {CHECKER.testCases} cases from {CHECKER.heldOutFamilies} template families held out of training</span>}>
    <In n={2}>
      <div className="d-mono" style={{ fontSize: 40, fontWeight: 600, color: "var(--primary)" }}>{CHECKER.name}</div>
      <div style={{ fontSize: 22, color: "var(--muted-foreground)", marginTop: 4 }}>{CHECKER.base} {sep} {CHECKER.trainable} {sep} {CHECKER.runs}</div>
    </In>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginTop: 32 }}>
      <In n={3}><BarCompare title="Correct answers" unit="%" max={100} rows={CHECKER.correct} start={3} /></In>
      <In n={4}><BarCompare title="False alarms, lower is better" unit="%" max={14} rows={CHECKER.falseAlarms} start={6} /></In>
      <In n={5}><BarCompare title="Milliseconds per check, lower is better" unit=" ms" max={240} rows={CHECKER.ms} start={9} /></In>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 32 }}>
      <In n={8} className="d-card d-mono" style={{ padding: "16px 24px", fontSize: 22, display: "flex", gap: 14, alignItems: "center" }}>
        <span style={{ color: "var(--primary)", fontWeight: 600 }}>{CHECKER.cost}</span>{sep}<span>{CHECKER.trainMinutes} min training</span>{sep}<span>{CHECKER.gpu}</span>{sep}<span>{CHECKER.host}</span>
      </In>
      <In n={9} style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center", fontSize: 20 }}>
        <img src="/deck/huggingface.svg" alt="Hugging Face" style={{ width: 32, height: 32 }} />
        <span className="d-card d-mono" style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>{LINKS.bahnator}</span>
        <span className="d-card d-mono" style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>{LINKS.laya}</span>
      </In>
    </div>
  </Slide>
}

// 9. How I built it
function Built() {
  const prd: [string, string, string][] = [
    ["Problem", "/deck/01-overview.jpg", "Overview"],
    ["Rules and approvals", "/deck/03-decision-card-cd-420055.jpg", "Decision card"],
    ["Interface", "/deck/05-live-map.jpg", "Live map"],
    ["Benchmark against Jev", "/deck/07-checks-and-evals.jpg", "Checks and evals"],
    ["Visual checks", "/deck/04b-labeling-cd-420603.jpg", "Labeling"],
  ]
  const models = ["Gemini 3.8 Flash", "Grok 4.7", "GPT-6 Astra"]
  const logos: [string, string][] = [["claude", "Claude"], ["googlegemini", "Gemini"], ["x", "Grok"], ["openai", "OpenAI"], ["huggingface", "Hugging Face"]]
  const rowH = 76
  return <Slide n={9} chip="How I built it" title="PRD first, four models, one cross-AI review">
    <div style={{ display: "grid", gridTemplateColumns: "820px 1fr", gap: 72 }}>
      <In n={2} style={{ display: "grid", gridTemplateColumns: "380px 80px 1fr", alignItems: "start" }}>
        <div className="d-card" style={{ padding: "20px 24px" }}>
          <div className="d-mono" style={{ fontSize: 18, color: "var(--muted-foreground)" }}>PRD.md</div>
          <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>Safe On-the-Road Agent</div>
          {prd.map(([h]) => <div key={h} style={{ height: rowH, display: "flex", alignItems: "center", fontSize: 21, borderTop: "1px solid var(--border)" }}>## {h}</div>)}
        </div>
        <svg width={80} height={86 + rowH * 5} aria-hidden>
          {prd.map((_, k) => <path key={k} d={`M 0 ${120 + k * rowH} C 40 ${120 + k * rowH} 40 ${32 + k * (rowH + 18) + 36} 80 ${32 + k * (rowH + 18) + 36}`} fill="none" stroke="var(--primary)" strokeWidth={2} />)}
        </svg>
        <div style={{ display: "grid", gap: 18, paddingTop: 32 }}>
          {prd.map(([h, src, name]) => <div key={h} style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Shot src={src} alt={`${name} screen`} crop={[0, 0, 2880, 1800]} width={115} style={{ borderRadius: 6, boxShadow: "none" }} />
            <span style={{ fontSize: 20 }}>{name}</span>
          </div>)}
        </div>
      </In>
      <div>
        <In n={4} style={{ display: "grid", gridTemplateColumns: "1fr 64px 280px", alignItems: "center" }}>
          <div style={{ display: "grid", gap: 12 }}>
            <div className="d-card" style={{ padding: "16px 20px", borderColor: "var(--primary)", fontSize: 24, fontWeight: 600 }}>My Claude framework on Opus 5.5</div>
            <div style={{ display: "flex", gap: 10 }}>
              {[1, 2, 3].map((k) => <span key={k} className="d-card d-placeholder" style={{ padding: "8px 14px", fontSize: 18 }}>[skill name]</span>)}
            </div>
            <div className="d-card" style={{ padding: "12px 20px", fontSize: 21 }}>Pi coding agent</div>
            <div style={{ display: "flex", gap: 10 }}>
              {models.map((m) => <span key={m} className="d-card" style={{ padding: "10px 14px", fontSize: 19 }}>{m}</span>)}
            </div>
          </div>
          <ArrowRightIcon style={{ width: 36, height: 36, color: "var(--muted-foreground)", justifySelf: "center" }} />
          <div className="d-card" style={{ padding: "28px 24px", textAlign: "center", fontSize: 26, fontWeight: 600, background: "color-mix(in oklch, var(--primary), transparent 90%)", borderColor: "var(--primary)", color: "var(--primary)" }}>Cross-AI review</div>
        </In>
        <In n={5} style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 28 }}>
          <span className="d-caps">Built with</span>
          {logos.map(([f, a]) => <img key={f} src={`/deck/${f}.svg`} alt={a} className="dark:invert" style={{ height: 32, width: 32, opacity: 0.8 }} />)}
        </In>
        <In n={6} style={{ marginTop: 36 }}>
          <div className="d-caps">Where I did not take the first answer</div>
          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            <div className="d-card" style={{ padding: "16px 20px", fontSize: 21 }}>Whole template families held out, not random rows, so the test measures new kinds of cases.</div>
            <div className="d-card d-placeholder" style={{ padding: "16px 20px", fontSize: 21 }}>[Add one more true example]</div>
          </div>
        </In>
      </div>
    </div>
  </Slide>
}

// 10. Try it
function Close({ qr }: { qr: string }) {
  const links: [string, string][] = [["GitHub", LINKS.github], ["bahnator weights, Hugging Face", LINKS.bahnator], ["Laya v6 weights, Hugging Face", LINKS.laya]]
  const next = ["A real places lookup behind the mock", "More eval families from rejected cards", "More freedom per action as approval rates prove out"]
  return <Slide n={10} chip="Try it" title={`Try it at ${LINKS.site}`}
    foot={<>
      <span>Veikka Silvekoski {sep} bob the builder</span>{sep}
      <BahnLogo className="h-[18px] text-foreground" /><span>Built for Bahn&apos;s challenge</span>{sep}
      <span>Icons: Untitled UI and Simple Icons</span>
    </>}>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 520px", gap: 64, alignItems: "center", height: "100%" }}>
      <div>
        <In n={2} style={{ display: "flex", alignItems: "center", gap: 48 }}>
          <div className="d-card" style={{ padding: 18, background: "white" }}>
            <div style={{ width: 240, height: 240 }} dangerouslySetInnerHTML={{ __html: qr }} role="img" aria-label={`QR code for ${LINKS.siteUrl}`} />
          </div>
          <div className="d-mono" style={{ fontSize: 60, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--primary)" }}>{LINKS.site}</div>
        </In>
        <In n={3} style={{ display: "flex", gap: 16, marginTop: 44 }}>
          {links.map(([l, v]) => <div key={l} className="d-card" style={{ padding: "14px 20px" }}>
            <div style={{ fontSize: 18, color: "var(--muted-foreground)" }}>{l}</div>
            <div className="d-mono" style={{ fontSize: 18, marginTop: 4, whiteSpace: "nowrap" }}>{v}</div>
          </div>)}
        </In>
      </div>
      <In n={4} className="d-card" style={{ padding: "28px 32px" }}>
        <div className="d-caps">Next</div>
        <ol style={{ display: "grid", gap: 20, marginTop: 18 }}>
          {next.map((t, k) => <li key={t} style={{ display: "flex", gap: 16, fontSize: 26 }}>
            <span className="d-mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{k + 1}</span>{t}
          </li>)}
        </ol>
      </In>
    </div>
  </Slide>
}

export function slides(qr: string): (() => ReactNode)[] {
  return [Title, Problem, Queue, Card, StopCheck, OneStop, Approvals, Model, Built, () => <Close qr={qr} />]
}
