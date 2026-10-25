import { interpolate, useCurrentFrame } from "remotion"
import { Badge, Box, Btn, Caps, Card, Chip, Cursor, AgentLog, DecisionCard, Disp, DrawPath, DriverFigure, CarIcon, G, Glyph, Dot, Lock, Pop, PersonIcon, QuoteCard, Svg, Txt, Typed, OptionCard } from "../components"
import { useCount, useEase, usePulse, useSpr } from "../motion"
import { sceneTiming } from "../timing"
import { C, F } from "../theme"
import { IdeaFrame, Label } from "./frame"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

// ---------- Scene 4: idea 1, driver carpooling ----------
export const Scene04 = () => {
  const T = sceneTiming(4)
  const f = useCurrentFrame()
  const b2 = T.at("02"), b3 = T.at("03"), b4 = T.at("04"), b5 = T.at("05"), b6 = T.at("06")
  const walk = useEase(b2 + 6, b2 + 38, 300, 640)
  const payAt = T.cue("02", "pay"), higherAt = T.cue("02", "travel")
  const fee = useCount(higherAt, 40, 30, 50)
  const ticketH = useEase(payAt + 14, payAt + 16, 0, 160)
  const fly = useEase(payAt, payAt + 16)
  const sameAt = T.cue("04", "overlapping")
  const part = T.cue("03", "already")
  const dashed = f >= part
  const carX = useEase(b4 + 6, b4 + 22, 300, 1000)
  const bufFill = useEase(b5 + 8, b5 + 24, 0, 0.85)
  const ghost = useEase(b5 + 22, b5 + 33, 0, 0.35)
  const acceptAt = T.cue("06", "accept")
  const down = useCount(T.cue("06", "drops"), 30, 50, 38)
  const glow = f >= sameAt ? 1 : 0
  return (
    <IdeaFrame idea={1} T={T} scoreAt={T.at("07")}>
      <AgentLog at={b2} lines={[
        { at: b2 + 6, fn: 'orders.get("CD-420055")', out: "DOMESTIC · 2 legs" },
        { at: b2 + 22, fn: "fees.compute()", out: "50 € incl. train 25 €" },
        { at: b4 + 8, fn: "drivers.nearby(route)", out: "2 candidates" },
        { at: b4 + 22, fn: "routes.overlap()", out: "Tampere · 0 km detour" },
        { at: b5 + 6, fn: "buffer.check()", out: "+34 min ≥ 20 · safe" },
        { at: b6 + 6, fn: "offers.send(2)", out: "awaiting accept" },
      ]} />
      {/* beat 2: the cost of getting to the pickup */}
      <Svg>
        <G at={b2} out={b3}>
          <DriverFigure x={walk} y={640} scale={1.4} />
          <line x1={250} y1={706} x2={900} y2={706} stroke={C.hair} strokeWidth={6} strokeLinecap="round" />
        </G>
      </Svg>
      <Pop at={b2 + 8} out={b3} x={700} y={500} from="up"><Glyph kind="train" size={150} color={C.tealInk} /></Pop>
      <Pop at={b2 + 6} out={b3} x={1280} y={330}><Caps>Fee</Caps></Pop>
      <Pop at={b2 + 10} out={b3} x={1280} y={780 - 240} w={150} h={240} style={{ background: C.tealInk, borderRadius: "14px 14px 0 0" }}><div /></Pop>
      {f >= payAt + 14 && <div style={{ position: "absolute", left: 1280, top: 780 - 240 - ticketH, width: 150, height: ticketH, background: C.orange, borderRadius: "14px 14px 0 0", opacity: f > b3 ? 0 : 1 }} />}
      {f >= payAt && f < payAt + 18 && (
        <div style={{ position: "absolute", left: 800 + fly * 480, top: 520 + fly * 20 - Math.sin(fly * Math.PI) * 120 }}>
          <Chip tone="orange" size={26}>Train ticket 25 €</Chip>
        </div>
      )}
      <Pop at={b2 + 10} out={b3} x={1470} y={470}><Disp size={90}>{fee} €</Disp></Pop>
      {/* beat 3: the Telegram group */}
      <Pop at={b3} out={b4} x={260} y={290} w={800}>
        <div style={{ borderRadius: 28, boxShadow: `0 0 0 4px ${dashed ? C.sand : C.hair}`, outline: dashed ? `4px dashed ${C.sand}` : "none", outlineOffset: 10, padding: 28, background: C.birch, opacity: dashed ? 0.55 : 1 }}>
          <Caps>Telegram group</Caps>
          {["Anyone going to Tampere?", "I can take one more.", "Leaving at 9."].map((m, i) => (
            <Pop key={m} at={b3 + 10 + i * 18} from="left"><div style={{ marginTop: 14, display: "inline-block", background: C.tealBg, color: C.tealInk, borderRadius: 22, padding: "12px 22px", fontSize: 28, fontFamily: F.body }}>{m}</div></Pop>
          ))}
        </div>
      </Pop>
      <Pop at={b3 + 20} out={b4} x={1300} y={420} from="right"><Card><Disp size={52}>Bahn</Disp></Card></Pop>
      {/* beat 4: the match */}
      <Svg>
        <DrawPath d="M 300 520 H 1000" at={b4 + 4} dur={30} stroke={C.teal} width={glow ? 12 : 8} id="rA" out={b5} />
        <DrawPath d="M 1000 540 C 1120 740 1320 800 1520 800" at={b4 + 20} dur={30} stroke={C.orange} width={glow ? 12 : 8} dashed id="rB" out={b5} />
        <G at={b4} out={b5}>
          <Dot x={300} y={520} at={b4 + 2} color={C.teal} /><Dot x={1000} y={520} at={b4 + 16} color={C.teal} /><Dot x={1520} y={800} at={b4 + 33} color={C.orange} />
          <CarIcon x={carX} y={470} scale={0.9} color={C.teal} />
          {f > b4 + 19 && <DriverFigure x={1000} y={450} scale={0.8} color={C.orangeInk} />}
          {glow === 1 && <circle cx={1000} cy={520} r={30 + ((f - sameAt) % 30) * 2} fill="none" stroke={C.green} strokeWidth={5} opacity={1 - ((f - sameAt) % 30) / 30} />}
        </G>
      </Svg>
      <Pop at={b4 + 4} out={b5} x={230} y={560}><Txt size={30} weight={500}>Espoo</Txt></Pop><Pop at={b4 + 16} out={b5} x={930} y={560}><Txt size={30} weight={500}>Tampere</Txt></Pop><Pop at={b4 + 33} out={b5} x={1450} y={840}><Txt size={30} weight={500}>Pickup</Txt></Pop>
      <Pop at={b4 + 8} out={b5} x={300} y={380}><Chip tone="teal">Driver A</Chip></Pop>
      <Pop at={b4 + 22} out={b5} x={1060} y={350}><Chip tone="orange">Driver B</Chip></Pop>
      <Pop at={sameAt} out={b5} x={1070} y={470} from="scale"><Chip tone="green">Match</Chip></Pop>
      {/* beat 5: the buffer */}
      <Pop at={b5} out={b6} x={560} y={330} w={800}>
        <Card>
          <Caps>Buffer</Caps>
          <div style={{ position: "relative", marginTop: 24, height: 44, borderRadius: 22, background: C.hair }}>
            <div style={{ width: `${bufFill * 100}%`, height: "100%", borderRadius: 22, background: C.green }} />
            <div style={{ position: "absolute", left: "60%", top: -12, width: 5, height: 68, background: C.ink }} />
            <div style={{ position: "absolute", left: "60%", top: 64, transform: "translateX(-50%)", fontFamily: F.body, fontSize: 24, color: C.muted }}>safe</div>
          </div>
          <div style={{ marginTop: 90, display: "flex", alignItems: "center", gap: 20, opacity: f > b5 + 22 ? 1 : 0 }}>
            <div style={{ flex: 1, position: "relative", height: 30, borderRadius: 15, background: C.hair }}>
              <div style={{ width: `${ghost * 100}%`, height: "100%", borderRadius: 15, background: C.red }} />
              <div style={{ position: "absolute", left: "60%", top: -8, width: 4, height: 46, background: C.sand }} />
            </div>
            <Chip tone="red" size={24}>Too tight</Chip>
          </div>
        </Card>
      </Pop>
      {/* beat 6: accept */}
      {[0, 1].map((k) => (
        <div key={k}>
          <Pop at={b6 + k * 4} out={b6 + 220} x={470 + k * 400} y={160} w={340} h={540} from="up">
            <div style={{ width: 340, height: 540, border: `9px solid ${C.ink}`, borderRadius: 54, background: C.birch, padding: "70px 24px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 28, fontFamily: F.body }}>
              <Txt size={32} weight={600} style={{ textAlign: "center" }}>Share a ride?</Txt>
              <Txt size={22} color={C.muted} style={{ textAlign: "center" }}>Espoo to Tampere, 09:00</Txt>
              <div style={{ marginTop: "auto" }}><Btn primary hover={f >= acceptAt + k * 6 && f < acceptAt + k * 6 + 8}>Accept</Btn></div>
            </div>
          </Pop>
          {f >= acceptAt + k * 6 && f < acceptAt + k * 6 + 14 && <div style={{ position: "absolute", left: 470 + k * 400 + 170 - 40, top: 160 + 540 - 110, width: 80, height: 80, borderRadius: "50%", border: `4px solid ${C.teal}`, transform: `scale(${(f - acceptAt - k * 6) / 14 + 0.3})`, opacity: 1 - (f - acceptAt - k * 6) / 14 }} />}
        </div>
      ))}
      <Pop at={b6 + 20} x={1400} y={330} w={380}>
        <Card style={{ textAlign: "center" }}>
          <Caps>Fee</Caps>
          <Disp size={90} style={{ marginTop: 6 }}>{down} €</Disp>
          {f >= T.cue("06", "drops") + 30 && <div style={{ marginTop: 14 }}><Chip tone="green">Lower</Chip></div>}
        </Card>
      </Pop>
    </IdeaFrame>
  )
}

// ---------- Scene 5: idea 2, rail strike watch ----------
const ROWS = [0, 1, 2, 3, 4]
const AFFECT = [0, 2, 3]
export const Scene05 = () => {
  const T = sceneTiming(5)
  const f = useCurrentFrame()
  const b2 = T.at("02"), b3 = T.at("03"), b4 = T.at("04"), b5 = T.at("05"), b6 = T.at("06"), b7 = T.at("07")
  const crack = T.cue("03", "late")
  const plane = useEase(b2, b2 + 16, 340, 520)
  const opts: [string, number, number, string][] = [["Bus", 40, 12, "min"], ["Taxi", 0, 85, "min"], ["Later train", 2, 0, "h"], ["Other airport", 60, 60, "min"]]
  const counts = [0, 1, 2, 3].map((k) => [useCount(b5 + 10 + k * 6, 30, 0, opts[k][1]), useCount(b5 + 10 + k * 6, 30, 0, opts[k][2])])
  const busFly = useEase(b6 + 6, b6 + 16)
  const taxiSlide = useEase(b7, b7 + 16)
  const cardX = (k: number) => 190 + k * 400
  return (
    <IdeaFrame idea={2} T={T} scoreAt={T.at("08")}>
      <AgentLog at={b2} lines={[
        { at: b2 + 6, fn: "flights.status()", out: "landed 14:10" },
        { at: b3 + 6, fn: "trips.next_leg()", out: "train 14:55 · DB" },
        { at: b4 + 6, fn: 'notices.fetch("rail")', out: "3 strikes" },
        { at: b4 + 28, fn: "trips.join(notices)", out: "3 of 5 affected" },
        { at: b5 + 6, fn: "options.rank(4)", out: "bus +12 € · taxi +85 €" },
        { at: b6 + 6, fn: "driver.notify()", out: "sent · no yes needed" },
        { at: b7 + 6, fn: "policy.cost_limit()", out: "85 € > 60 € · gate", tone: "orange" },
      ]} />
      {/* beats 2 and 3: one trip, one strike */}
      <Svg>
        <G at={b2} out={b4}>
          <DrawPath d="M 220 600 H 1500" at={b2 + 6} dur={30} stroke={C.sand} width={8} id="tl" />
          <DrawPath d="M 440 600 H 1100" at={b2 + 16} dur={24} stroke={f >= crack ? C.red : C.teal} width={16} id="leg" />
          {f >= crack && <polyline points="740,570 770,610 745,625 780,650" fill="none" stroke={C.red} strokeWidth={8} strokeLinejoin="round" />}
          <DriverFigure x={470} y={540} scale={1.1} />
        </G>
      </Svg>
      <Pop at={b2} out={b4} x={150} y={plane} from="up"><Glyph kind="plane" size={110} color={C.ink} /></Pop>
      <Pop at={b2} out={b4} x={150} y={640}><Txt size={28} weight={500}>Landing</Txt></Pop>
      <Pop at={b2 + 16} out={b4} x={640} y={650}><Chip tone={f >= crack ? "red" : "teal"}>Train leg</Chip></Pop>
      <Pop at={b2} out={b4} x={1380} y={640}><Txt size={28} weight={500}>Pickup slot</Txt></Pop>
      <Pop at={b3} out={b4} x={1290} y={380}><div style={{ transform: `scale(${1})` }}><Disp size={0}>{""}</Disp></div></Pop>
      {f >= b3 && f < b4 + 8 && <Stopwatch2 at={b3} />}
      {/* beat 4: five trips, three notices */}
      {ROWS.map((r) => {
        const hit = AFFECT.includes(r) && f >= b4 + 33
        return (
          <div key={r}>
            <Pop at={b4 + r * 4} out={b5} x={260} y={290 + r * 100} w={900} h={50}>
              <div style={{ position: "relative", height: 50, opacity: f >= b4 + 33 && !AFFECT.includes(r) ? 0.3 : 1 }}>
                <div style={{ position: "absolute", top: 22, left: 0, right: 0, height: 6, borderRadius: 3, background: C.hair }} />
                <div style={{ position: "absolute", top: 17, left: 260 + r * 40, width: 300, height: 16, borderRadius: 8, background: hit ? C.red : C.teal }} />
                <Label x={-130} y={6} size={24} color={C.muted}>Trip {r + 1}</Label>
              </div>
            </Pop>
          </div>
        )
      })}
      {[0, 1, 2].map((k) => (
        <Pop key={k} at={b4 + 14 + k * 8} out={b5} x={1330} y={290 + k * 150} w={430} from="right">
          <Card tone="red" style={{ padding: "18px 24px" }}><Txt size={26} weight={600} color={C.redInk}>Strike notice {k + 1}</Txt><Txt size={22} color={C.brown}>Rail, Central Europe</Txt></Card>
        </Pop>
      ))}
      <Svg>
        {AFFECT.map((r, k) => <DrawPath key={r} d={`M 1330 ${365 + (k % 3) * 150} C 1250 ${365 + (k % 3) * 150} 1250 ${320 + r * 100} ${420 + r * 40 + 300}  ${320 + r * 100}`} at={T.cue("04", "joins") + k * 6} dur={20} stroke={C.red} width={4} id={`n${r}`} out={b5} />)}
      </Svg>
      {/* beat 5: four options */}
      <Svg><DrawPath d="M 200 330 H 1720" at={b5} dur={20} stroke={C.sand} width={8} id="br" out={b7 + 110} /><DrawPath d="M 760 330 H 1160" at={b5 + 10} dur={14} stroke={C.red} width={16} id="br2" out={b7 + 110} /></Svg>
      {/* beat 6: driver gets it */}
      <Pop at={b6} out={b7} x={1440} y={200} w={420} h={580} from="up">
        <div style={{ width: 420, height: 580, border: `9px solid ${C.ink}`, borderRadius: 54, background: C.birch, padding: "64px 24px", fontFamily: F.body }}>
          <Txt size={28} weight={600} style={{ textAlign: "center" }}>New route</Txt>
          <Txt size={22} color={C.muted} style={{ textAlign: "center", marginTop: 8 }}>Bus, +40 min</Txt>
        </div>
      </Pop>
      <Pop at={b6 + 16} out={b7} x={1440} y={810} w={420}><Chip tone="green">Driver told. No yes needed.</Chip></Pop>
      {opts.map(([name, , , unit], k) => {
        const hi = k === 0 && f >= b6
        const dim = f >= b6 && f < b7 && k > 0 ? 0 : 1
        let x = cardX(k), y = 440
        if (k === 0 && f >= b6) { x = cardX(0) + busFly * (1470 - cardX(0)); y = 440 + busFly * 0 }
        if (k === 1 && f >= b7) { x = cardX(1) + taxiSlide * 280; y = 440 + taxiSlide * 0 }
        return (
          <Pop key={name} at={b5 + 10 + k * 6} out={k === 0 ? b7 : k >= 2 ? b6 : undefined} x={x} y={y} w={360} from="up" dim={dim}>
            <Card tone={hi ? "teal" : undefined} style={{ padding: "24px 28px" }}>
              <Txt size={30} weight={600}>{name}</Txt>
              <Txt size={34} color={C.brown} style={{ marginTop: 8 }}>+{counts[k][0]} {unit}</Txt>
              <Txt size={34} weight={600} color={C.orangeInk}>+{counts[k][1]} €</Txt>
            </Card>
          </Pop>
        )
      })}
      {/* beat 7: cost limit */}
      <Svg><DrawPath d="M 960 220 V 700" at={b7} dur={20} stroke={C.orange} width={5} dashed id="lim" /></Svg>
      <Pop at={b7} x={870} y={170}><Caps style={{ color: C.orangeInk }}>Cost limit</Caps></Pop>
      <Lock x={1130} y={400} at={b7 + 19} size={90} />
      <Pop at={b7 + 20} x={1300} y={760} w={280}><Card><div style={{ display: "flex", gap: 14, alignItems: "center" }}><Glyph kind="calendar" size={54} color={C.brown} /><Txt size={26} weight={600}>Pickup date</Txt></div></Card></Pop>
      <Lock x={1520} y={730} at={T.cue("07", "person")} size={80} />
      <DecisionCard at={b7 + 28} x={1240} y={230} w={620} pulse label="Decision card" rows={[["What happened", "Taxi 85 € > cost limit 60 €"], ["Evidence", "notice #3 · policy.cost_limit"], ["Suggestion", "Approve taxi · conf 0.91"]]} hover={f >= b7 + 60 ? 0 : -1} />
      <Cursor path={[{ f: b7 + 38, x: 1700, y: 900 }, { f: b7 + 66, x: 1330, y: 530 }]} />
    </IdeaFrame>
  )
}
const Stopwatch2 = ({ at }: { at: number }) => {
  const f = useCurrentFrame()
  const v = Math.floor((f - at) / 4)
  const s = useSpr(at)
  return (
    <div style={{ position: "absolute", left: 1330, top: 410, opacity: s, display: "flex", alignItems: "center", gap: 14, fontFamily: F.mono, fontSize: 40, color: C.redInk }}>
      <Glyph kind="warn" size={64} color={C.red} /> {String(Math.floor(v / 60)).padStart(2, "0")}:{String(v % 60).padStart(2, "0")}
    </div>
  )
}

// ---------- Scene 6: idea 3, scooters ----------
export const Scene06 = () => {
  const T = sceneTiming(6)
  const f = useCurrentFrame()
  const b2 = T.at("02"), b3 = T.at("03"), b4 = T.at("04"), b5 = T.at("05"), b6 = T.at("06")
  const km = useEase(b2 + 10, b2 + 38, 0, 3.5)
  const race = (end: number) => useEase(b5 + 10, b5 + 10 + end, 0, 1)
  const pos = [race(52), race(18), race(28)]
  const ticks = [0, 1, 2].map((k) => T.at("04") + 14 + k * 24)
  const lanes = [330, 470, 610]
  const names: ("bus" | "taxi" | "scooter")[] = ["bus", "taxi", "scooter"]
  const times = [38, 9, 14]
  const timers = [0, 1, 2].map((k) => useCount(b5 + 10, [52, 18, 28][k], 0, times[k]))
  return (
    <IdeaFrame idea={3} T={T} scoreAt={T.at("07")}>
      <Svg>
        <G at={b2} out={b3 + 220}>
          <DrawPath d="M 360 470 H 1500" at={b2 + 6} dur={30} stroke={C.sand} width={6} dashed id="far" out={b3} />
          <Dot x={360} y={470} at={b2 + 4} /><Dot x={1500} y={470} at={b2 + 16} color={C.orange} />
        </G>
        {f >= b3 && lanes.map((y, k) => <G key={y} at={b3 + k * 4}><line x1={360} y1={y} x2={1500} y2={y} stroke={C.hair} strokeWidth={4} strokeDasharray="2 12" strokeLinecap="round" /></G>)}
      </Svg>
      <Pop at={b2 + 4} x={200} y={452}><Txt size={28} weight={500}>Station</Txt></Pop><Pop at={b2 + 16} x={1560} y={452}><Txt size={28} weight={500}>Pickup</Txt></Pop>
      <Pop at={b2 + 20} out={b3} x={760} y={380}><Disp size={60}>{km.toFixed(1)} km</Disp></Pop>
      {lanes.map((y, k) => {
        const x = 360 + pos[k] * 1140
        const show = k < 2 ? f >= b3 + k * 6 : f >= b3 + 14
        const solid = k < 2 || f >= b4
        return show ? (
          <div key={k} style={{ position: "absolute", left: x - 40, top: y - 80, opacity: solid ? 1 : 0.3 }}>
            <Glyph kind={names[k]} size={80} color={k === 2 ? C.tealInk : C.ink} />
            {k === 2 && f >= b3 + 20 && f < b4 && <div style={{ position: "absolute", left: -10, top: 38, width: 100, height: 6, background: C.red, transform: "rotate(-30deg)" }} />}
          </div>
        ) : null
      })}
      <Pop at={b3 + 6} out={b4 + 220} x={360} y={215}><Chip tone="neutral" size={24}>Google Routes</Chip></Pop>
      {["Free scooter near the station", "Pickup inside the zone", "Legal place to park"].map((t, k) => (
        <Pop key={t} at={ticks[k] - 6} out={b5} x={560} y={740 + k * 60} w={900} from="left">
          <div style={{ display: "flex", gap: 18, alignItems: "center", opacity: f >= ticks[k] ? 1 : 0.5 }}>
            <Glyph kind="check" size={46} color={f >= ticks[k] ? C.greenInk : C.sand} /><Txt size={32}>{t}</Txt>
          </div>
        </Pop>
      ))}
      {[0, 1, 2].map((k) => f >= b5 + 10 ? <div key={k} style={{ position: "absolute", left: 360 + pos[k] * 1140 - 40, top: lanes[k] - 130, fontFamily: F.mono, fontSize: 30, color: C.brown }}>{timers[k]} min</div> : null)}
      {([["Bus", "38 min", "4 €"], ["Taxi", "9 min", "22 €"], ["Scooter", "14 min", "6 €"]] as const).map(([n, t, c], k) => (
        <OptionCard key={n} label={n} time={t} cost={c} at={b5 + 56 + k * 4} x={360 + k * 420} y={760} w={380} hi={k === 2} />
      ))}
      <Pop at={b5 + 66} x={760} y={728}><Chip tone="neutral" size={22}>Backup</Chip></Pop>
      <Pop at={b6} x={1000} y={190} from="scale"><div style={{ display: "flex", gap: 14, alignItems: "center", opacity: 0.8 }}><PersonIcon size={70} color={C.sand} /><Chip tone="green" size={24}>No person needed</Chip></div></Pop>
    </IdeaFrame>
  )
}
