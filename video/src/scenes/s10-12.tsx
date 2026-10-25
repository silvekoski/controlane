import { interpolate, useCurrentFrame } from "remotion"
import { Badge, Box, Btn, Caps, Card, Chip, Cursor, AgentLog, DecisionCard, Disp, DrawPath, G, Glyph, Dot, Headline, OptionCard, PersonIcon, Pop, QuoteCard, Svg, Txt, Typed, ChatBubble } from "../components"
import { IDEAS } from "../data/ideas"
import { useCount, useEase, usePulse, useSpr } from "../motion"
import { sceneTiming } from "../timing"
import { C, F } from "../theme"
import { IdeaFrame, Label, SceneShell } from "./frame"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

const Wave = ({ x, y, w = 700, at, out, color = C.teal }: { x: number; y: number; w?: number; at: number; out?: number; color?: string }) => {
  const f = useCurrentFrame()
  if (f < at || (out !== undefined && f > out)) return null
  const bars = 48
  return (
    <svg style={{ position: "absolute", left: x, top: y }} width={w} height={120}>
      {Array.from({ length: bars }, (_, i) => {
        const h = 14 + 80 * Math.abs(Math.sin(i * 0.7 + f * 0.3) * Math.sin(i * 0.23 + f * 0.11))
        return <rect key={i} x={i * (w / bars)} y={60 - h / 2} width={w / bars - 6} height={h} rx={5} fill={color} />
      })}
    </svg>
  )
}

// ---------- Scene 10: idea 7, voice desk ----------
export const Scene10 = () => {
  const T = sceneTiming(10)
  const f = useCurrentFrame()
  const b2 = T.at("02"), b3 = T.at("03"), b4 = T.at("04"), b5 = T.at("05")
  const gauge = useEase(b5 + 20, b5 + 33, 0.8, 0.2)
  const click = T.cue("04", "picks")
  const msgs: [string, string, "left" | "right"][] = [["Agent", "Is there space for one car on tonight's ship?", "left"], ["Desk", "Tonight is full. Seven thirty tomorrow has space.", "right"], ["Agent", "What does a name change cost?", "left"], ["Desk", "35 euros.", "right"]]
  return (
    <IdeaFrame idea={7} T={T} scoreAt={T.at("06")}>
      <AgentLog at={b3} lines={[
        { at: b3 + 8, fn: "voice.call(desk)", out: "connected" },
        { at: b3 + 30, fn: "transcript.parse()", out: "2 slots · fee 35 €" },
        { at: b4 + 6, fn: "options.build()", out: "2 options" },
        { at: b4 + 40, fn: "voice.callback()", out: "confirmed" },
      ]} w={520} />
      <Pop at={b2} out={b3} x={300} y={320} from="up"><Glyph kind="ferry" size={300} color={C.tealInk} /></Pop>
      <Pop at={b2 + 14} out={b3} x={1300} y={340} from="scale">
        <div style={{ position: "relative", transform: `rotate(${Math.sin(f * 1.3) * 6}deg)` }}><Glyph kind="phone" size={260} color={C.ink} /></div>
      </Pop>
      <Wave x={610} y={800} w={700} at={b3 + 6} out={b4 + 33} />
      {msgs.map(([who, text, side], i) => (
        <ChatBubble key={i} text={text} at={b3 + 10 + i * Math.floor((T.len("03") - 20) / 4)} out={b4 + 4} x={side === "left" ? 260 : 900} y={250 + i * 125} w={760} side={side} size={30} />
      ))}
      <OptionCard label="07:30 tomorrow" time="+35 €" cost="Hotel needed?" at={b4 + 6} x={480} y={330} w={460} />
      <OptionCard label="19:00 tomorrow" time="+35 €" cost="No hotel" at={b4 + 12} x={1000} y={330} w={460} hi={f >= b4 + 33} />
      <Cursor path={[{ f: b4 + 16, x: 1700, y: 700 }, { f: b4 + 31, x: 1200, y: 460 }]} clicks={[b4 + 33]} />
      <Wave x={610} y={800} w={700} at={b4 + 38} out={b4 + 61} color={C.green} />
      <Pop at={b4 + 62} x={780} y={790} from="up"><Chip tone="green" size={32}>Confirmed</Chip></Pop>
    </IdeaFrame>
  )
}

// ---------- Scene 11: idea 8, Jev ----------
const CHECKS = ["Treated a quote as a booking?", "Right escalation level?", "Customer contacted first?"]
const TRACE = ["run 4812 · read order", "run 4812 · asked driver", "run 4813 · quote sent", "run 4813 · escalate", "run 4814 · read order", "run 4814 · booked ferry", "run 4815 · asked driver", "run 4815 · escalate"]
export const Scene11 = () => {
  const T = sceneTiming(11)
  const f = useCurrentFrame()
  const b2 = T.at("02"), b3 = T.at("03"), b4 = T.at("04"), b5 = T.at("05"), b6 = T.at("06"), b7 = T.at("07")
  const runs = useCount(b2 + 20, 140, 0, 480)
  const labeled = useCount(b2 + 20, 140, 0, 6)
  const failAt = b4 + 10
  const feedback = useEase(T.cue("06", "check") - 6, T.cue("06", "check") + 22)
  const loop = (a: number) => a
  const lap = useEase(b7 + 10, b7 + T.len("07") - 10, 0, 2)
  const ring = ["Run trace", "Typed checks", "Eval candidate", "Draft eval", "Expert", "Eval set", "Operator rejects", "New check"]
  const cx = 960, cy = 500, R = 270
  return (
    <IdeaFrame idea={8} T={T} scoreAt={T.at("08")}>
      {/* beat 2: know-how in heads */}
      <Pop at={b2} out={b3} x={260} y={290} from="up"><Glyph kind="head" size={240} color={C.brown} /></Pop>
      {["Port B uses the side gate", "Dealer X needs a call", "Ferry desk closes at 6"].map((n, k) => <Pop key={n} at={b2 + 10 + k * 8} out={b3} x={520 + k * 40} y={310 + k * 70} w={430} from="left"><Chip tone="neutral" size={24}>{n}</Chip></Pop>)}
      <Pop at={b2 + 20} out={b3} x={1150} y={300} w={300}><Card style={{ textAlign: "center" }}><Caps>Test cases</Caps><Disp size={70}>{labeled}</Disp><Txt size={22} color={C.muted}>labeled by hand</Txt></Card></Pop>
      <Pop at={b2 + 20} out={b3} x={1500} y={300} w={300}><Card tone="orange" style={{ textAlign: "center" }}><Caps style={{ color: C.orangeInk }}>Runs</Caps><Disp size={70} color={C.orangeInk}>{runs}</Disp><Txt size={22} color={C.orangeInk}>waiting</Txt></Card></Pop>
      {/* beat 3: trace and checks */}
      <Pop at={b3} out={b6} x={96} y={250} w={640} dim={f >= b5 ? 0.3 : 1}>
        <Card style={{ padding: 20, height: 500, overflow: "hidden" }}>
          <Caps>Agent run trace</Caps>
          <div style={{ marginTop: 14, transform: `translateY(${-((f - b3) * 1.4) % 200}px)` }}>
            {[...TRACE, ...TRACE].map((t, i) => <div key={i} style={{ fontFamily: F.mono, fontSize: 22, color: C.brown, padding: "7px 0" }}>{t}</div>)}
          </div>
        </Card>
      </Pop>
      {CHECKS.map((c, k) => {
        const tick = b3 + 22 + k * 26
        const failed = k === 0 && f >= failAt
        return (
          <Pop key={c} at={b3 + 6 + k * 6} out={b7} x={820} y={270 + k * 130} w={620}>
            <Card tone={failed ? "red" : undefined} style={{ padding: "18px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Txt size={26} weight={500} color={failed ? C.redInk : C.ink}>{c}</Txt>
                {f >= tick ? <Glyph kind="check" size={40} color={failed ? C.red : C.greenInk} /> : <span />}
              </div>
              <div style={{ marginTop: 10, height: 10, borderRadius: 5, background: C.hair }}><div style={{ width: `${(failed ? 0.28 : 0.93) * 100 * useEase(tick, tick + 10)}%`, height: "100%", borderRadius: 5, background: failed ? C.red : C.green }} /></div>
            </Card>
          </Pop>
        )
      })}
      {/* beat 4 and 5: candidate, draft, fork */}
      <Pop at={b4 + 13} out={b6} x={1500} y={270} w={320} from="right"><Card tone="orange"><Caps style={{ color: C.orangeInk }}>Eval candidate</Caps><Txt size={24} style={{ marginTop: 8 }}>run 4813 · quote sent</Txt></Card></Pop>
      <Pop at={b5} out={b6} x={1330} y={460} w={500} from="up"><Card><Caps>Draft eval</Caps><Txt size={24} style={{ marginTop: 10 }}><Typed text="A quote must never become a booking." at={b5 + 8} cps={30} /></Txt></Card></Pop>
      <Svg>
        <DrawPath d="M 1500 650 C 1500 720 1100 700 1100 780" at={b5 + 28} dur={18} stroke={C.green} width={5} id="clr" out={b6} />
        <DrawPath d="M 1650 650 C 1650 720 1700 720 1700 780" at={b5 + 31} dur={18} stroke={C.orange} width={5} id="unc" out={b6} />
      </Svg>
      <Pop at={b5 + 38} out={b6} x={900} y={780} w={400}><Box tone="green" style={{ height: 110 }}>Eval set · clear</Box></Pop>
      <Pop at={b5 + 42} out={b6} x={1580} y={780} w={240}><div style={{ textAlign: "center" }}><PersonIcon size={90} color={C.orangeInk} /><Txt size={22} color={C.orangeInk}>Area expert</Txt></div></Pop>
      {/* beat 6: operator reason becomes a check */}
      <DecisionCard at={b6} out={b7} x={820} y={700} w={760} pulse={false} label="Decision card · Reject + why" rows={[["Why", ""]]} hover={2}
        extra={<Txt size={26} style={{ marginTop: 6 }}><Typed text="This port always uses the other address." at={b6 + 22} cps={26} /></Txt>} />
      {f >= T.cue("06", "check") - 6 && f < T.cue("06", "check") + 40 && (
        <div style={{ position: "absolute", left: 1180 - feedback * 220, top: 800 - feedback * 150, opacity: 1 }}><Chip tone="teal" size={26}>New check</Chip></div>
      )}
      {/* beat 7: the loop */}
      {ring.map((n, k) => {
        const a = (k / 8) * Math.PI * 2 - Math.PI / 2
        const on = Math.abs(((lap * 8) % 8) - k) < 0.7
        return (
          <Pop key={n} at={b7 + k * 4} x={cx + Math.cos(a) * R * 1.35 - 130} y={cy + Math.sin(a) * R * 0.95 - 40} w={260}>
            <Box tone={on ? "orange" : k === 1 || k === 7 ? "teal" : "neutral"} style={{ height: 80, fontSize: 26, transform: `scale(${on ? 1.08 : 1})` }}>{n}</Box>
          </Pop>
        )
      })}
      <Svg>
        <DrawPath d={`M ${cx} ${cy - R * 0.95} A ${R * 1.35} ${R * 0.95} 0 1 1 ${cx - 1} ${cy - R * 0.95}`} at={b7} dur={50} stroke={C.sand} width={5} dashed id="loop" />
      </Svg>
    </IdeaFrame>
  )
}

// ---------- Scene 12: outro ----------
export const Scene12 = () => {
  const T = sceneTiming(12)
  const f = useCurrentFrame()
  const b2 = T.at("02"), b3 = T.at("03")
  return (
    <SceneShell n={12}>
      <div style={{ position: "absolute", left: 96, top: 120 }}>
        <Headline words={["Which", "one", "should", "we", "build?"]} at={b2} size={110} gap={6} style={{ width: 1700 }} />
      </div>
      <div style={{ position: "absolute", left: 96, top: 440, width: 1728, display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 20 }}>
        {IDEAS.map((d, k) => {
          const land = T.at("01") + k * 6
          const wave = f >= b2 + 16 ? Math.max(0, 1 - Math.abs(((f - b2 - 30) / 8) % 14 - k) / 1.2) : 0
          return (
            <Pop key={d.n} at={land} from="up" style={{ height: 380 }}>
              <div style={{ transform: `scale(${1 + 0.06 * wave})` }}>
                <Card tone={wave > 0.4 ? "orange" : undefined} style={{ height: 380, padding: "40px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
                  <Badge n={d.n} size={110} />
                  <Txt size={26} weight={600} style={{ textAlign: "center" }}>{["Carpooling", "Strike watch", "Scooters", "GPS stop check", "Check-in", "Data stick", "Voice desk", "Judge every run"][k]}</Txt>
                </Card>
              </div>
            </Pop>
          )
        })}
      </div>
      <Svg><DrawPath d="M 96 900 C 600 840 1100 960 1824 880" at={b3} dur={40} stroke={C.ink} width={8} id="end" out={b3 + 33} /></Svg>
      <Pop at={b3 + 20} x={96} y={960}><Txt size={26} color={C.muted}>Prompt Operations Hackathon · 24 to 25 Oct 2026 · Veikka Silvekoski</Txt></Pop>
      <Cursor path={[{ f: b2 + 20, x: 1500, y: 330 }, { f: b2 + 50, x: 700, y: 400 }, { f: b2 + 82, x: 1300, y: 380 }]} />
    </SceneShell>
  )
}
