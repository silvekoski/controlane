import { interpolate, interpolateColors, useCurrentFrame } from "remotion"
import { Badge, Box, Btn, Caps, Card, Chip, Cursor, AgentLog, DecisionCard, Disp, DrawPath, DriverFigure, CarIcon, G, Glyph, Dot, Lock, Pop, PersonIcon, QuoteCard, Stopwatch, Svg, Txt, Typed, ChatBubble } from "../components"
import { useCount, useEase, usePulse, useSpr } from "../motion"
import { sceneTiming } from "../timing"
import { C, F } from "../theme"
import { IdeaFrame, Label } from "./frame"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

// ---------- Scene 7: idea 4, GPS stop check ----------
export const Scene07 = () => {
  const T = sceneTiming(7)
  const f = useCurrentFrame()
  const b2 = T.at("02"), b3 = T.at("03"), b4 = T.at("04"), b5 = T.at("05"), b6 = T.at("06"), b7 = T.at("07"), b8 = T.at("08"), b9 = T.at("09")
  const stopAt = T.cue("02", "unchanged")
  const carX = interpolate(f, [b2, stopAt], [-120, 700], { ...clamp })
  const trail = Array.from({ length: 8 }, (_, i) => carX - 60 - i * 36)
  const scroll = f < stopAt ? 0 : (f - stopAt) * 1.2
  const probes: [number, number, "pin" | "signal" | "chat", string][] = [[250, 270, "pin", "Service area"], [560, 210, "signal", "Fresh, 2 min ago"], [900, 270, "chat", "Last message"]]
  const feed = T.at("07")
  const fly = (k: number) => useEase(feed + 6 + k * 6, feed + 20 + k * 6)
  const flies = [fly(0), fly(1), fly(2)]
  const lit = f >= b7 ? 2 : f >= b6 ? 1 : f >= b5 ? 0 : -1
  const boxes: [number, string, string, "green" | "orange" | "red", "pump" | "pin" | "warn"][] = [
    [130, "Gas station, time to spare", "Log it. Stay quiet.", "green", "pump"],
    [600, "Odd place or stale signal", "Ask the driver first.", "orange", "pin"],
    [1070, "Red warning light", "One decision card", "red", "warn"],
  ]
  const rejectAt = T.cue("08", "reason")
  const acceptAgain = T.cue("09", "yes")
  const sent = f >= acceptAgain + 13
  return (
    <IdeaFrame idea={4} T={T} scoreAt={T.at("10")}>
      {/* road */}
      <Svg>
        <line x1={0} y1={600} x2={1920} y2={600} stroke={C.hair} strokeWidth={16} />
        <line x1={-scroll % 80} y1={600} x2={1920} y2={600} stroke={C.birch} strokeWidth={4} strokeDasharray="40 40" />
        <G at={b2}>
          {f < stopAt + 16 && trail.map((x, i) => <circle key={i} cx={x} cy={612} r={7} fill={C.teal} opacity={Math.max(0, 1 - i / 8)} />)}
          <CarIcon x={carX} y={536} scale={1.3} color={f >= b6 + 10 ? C.red : C.ink} alert={f >= b7} />
        </G>
        {probes.map(([x, y], k) => <DrawPath key={k} d={`M 700 520 L ${x + 30} ${y + 90}`} at={b4 + 14 + k * 8} dur={16} stroke={C.teal} width={4} dashed id={`pr${k}`} out={feed + 22} />)}
      </Svg>
      <Stopwatch x={620} y={330} at={b2 + 20} out={b4} from={0} to={42} dur={Math.max(30, T.len("02") - 60)} />
      {/* beat 3: coffee or breakdown */}
      <Pop at={b3} out={b3 + 38} x={380} y={380} from="up"><Glyph kind="cup" size={110} color={C.brown} /></Pop>
      <Pop at={b3 + 8} out={b3 + 38} x={1050} y={380} from="up"><Glyph kind="warn" size={110} color={C.red} /></Pop>
      {/* beat 4: probes */}
      {probes.map(([x, y, g, label], k) => {
        const toX = 1130 + k * 220, toY = 200 + k * 20
        const x2 = x + (toX - x) * flies[k], y2 = y + (toY - y) * flies[k]
        const gone = f >= feed + 24
        return gone ? null : (
          <Pop key={label} at={b4 + 13 + k * 8} x={x2} y={y2} w={190} from="scale" style={{ opacity: 1 - flies[k] * 0.1 }}>
            <Card style={{ padding: "16px 12px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <Glyph kind={g} size={54} color={C.tealInk} />
              <Txt size={20} weight={500} color={C.tealInk}>{label}</Txt>
            </Card>
          </Pop>
        )
      })}
      {/* beats 5 to 7: decision tree */}
      <Svg>
        <DrawPath d="M 700 650 V 690" at={b5 - 4} dur={10} stroke={C.sand} width={5} id="trunk" />
        {boxes.map(([x, , , tone], k) => (
          <DrawPath key={k} d={`M 700 690 H ${x + 200} V 720`} at={b5 + k * 4} dur={14} stroke={lit === k ? { green: C.green, orange: C.orange, red: C.red }[tone] : C.sand} width={5} id={`tr${k}`} />
        ))}
      </Svg>
      {boxes.map(([x, h, b, tone, g], k) => {
        const on = lit === k
        const p = usePulse(on && k === 2)
        return (
          <Pop key={h} at={b5 + 4 + k * 4} x={x} y={730} w={400} dim={lit === -1 || on ? 1 : lit > k ? 0.3 : 0.6} from="up">
            <div style={{ transform: `scale(${p})` }}>
              <Box tone={tone} style={{ height: 150, flexDirection: "column", alignItems: "flex-start", gap: 8, fontSize: 28 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 12 }}><Glyph kind={g} size={40} color="currentColor" />{h}</span>
                <span style={{ fontWeight: 400, fontSize: 24 }}>{b}</span>
              </Box>
            </div>
          </Pop>
        )
      })}
      <Pop at={b5 + 16} x={130} y={900} w={400}><Txt size={22} color={C.greenInk} weight={500}>Arrival time safe · logged</Txt></Pop>
      <Pop at={b6 + 14} x={600} y={900} w={500}><Txt size={22} color={C.orangeInk} weight={500}>No answer: raise it</Txt></Pop>
      {/* beat 6: ask the driver */}
      <Pop at={b6 + 10} out={b7 + 10} x={1480} y={170} w={300} h={470} from="up">
        <div style={{ width: 300, height: 470, border: `9px solid ${C.ink}`, borderRadius: 48, background: C.birch, padding: "52px 22px", fontFamily: F.body }}>
          <div style={{ background: C.tealBg, color: C.tealInk, borderRadius: 22, padding: "14px 18px", fontSize: 26 }}>Everything OK?</div>
          <svg width={120} height={120} style={{ display: "block", margin: "50px auto 0" }}>
            <circle cx={60} cy={60} r={48} fill="none" stroke={C.hair} strokeWidth={10} />
            <circle cx={60} cy={60} r={48} fill="none" stroke={C.orange} strokeWidth={10} strokeLinecap="round" strokeDasharray={301} strokeDashoffset={301 * useEase(b6 + 16, b7, 0, 1)} transform="rotate(-90 60 60)" />
          </svg>
        </div>
      </Pop>
      {/* beat 7: the card, assembled from the probes */}
      <DecisionCard at={feed + 19} x={1130} y={150} w={690} pulse={f < rejectAt} label="Decision card"
        rows={[["What happened", "Stopped 42 min · A7 service area"], ["Evidence", "tracking #41 · alert #12 · photo · driver safe"], ["Suggestion", "Call dealer: roadside or tow · conf 0.87"]]}
        hover={f >= b8 && f < rejectAt - 6 ? Math.floor((f - b8) / 20) % 2 : f >= rejectAt - 6 ? 2 : -1} />
      <Cursor path={[{ f: b8, x: 1750, y: 640 }, { f: b8 + 20, x: 1220, y: 520 }, { f: b8 + 22, x: 1400, y: 520 }, { f: rejectAt - 6, x: 1620, y: 520 }, { f: acceptAgain + 10, x: 1240, y: 520 }]} clicks={[rejectAt, acceptAgain + 20]} />
      {/* beat 8: why */}
      <Pop at={rejectAt + 6} out={b9} x={1130} y={600} w={690} from="up">
        <Card style={{ padding: "20px 26px" }}><Caps>Why?</Caps><Txt size={28} style={{ marginTop: 8 }}><Typed text="This is a known fault, the driver can continue" at={rejectAt + 12} cps={26} /></Txt></Card>
      </Pop>
      {/* beat 9: customer message */}
      <Pop at={b9 + 4} x={200} y={290} w={820} from="up">
        <div style={{ position: "relative" }}>
          <Box tone={sent ? "teal" : "neutral"} style={{ justifyContent: "flex-start", fontWeight: 400, fontSize: 26, opacity: sent ? 1 : 0.6, textAlign: "left" }}>To the dealer: our driver's car has a warning light. Can you help?</Box>
        </div>
      </Pop>
      {f < acceptAgain + 20 ? <Lock x={950} y={250} at={b9 + 8} size={80} /> : null}
    </IdeaFrame>
  )
}

// ---------- Scene 8: idea 5, check-in ----------
export const Scene08 = () => {
  const T = sceneTiming(8)
  const f = useCurrentFrame()
  const b2 = T.at("02"), b3 = T.at("03"), b4 = T.at("04"), b5 = T.at("05"), b6 = T.at("06"), b7 = T.at("07")
  const pts = { home: 250, air: 700, land: 1100, pick: 1650 }
  const y = 560
  const fog = useEase(b3, b3 + 20)
  const known = (at: number) => useEase(at, at + 14)
  const seen = [known(T.cue("04", "schedules")), known(T.cue("04", "checkins")), known(T.cue("05", "known"))]
  const tapAt = T.cue("06", "tap")
  const status = f >= T.cue("05", "prompt") + 10 ? "Landed" : "In flight"
  const drift = useEase(b3 + 10, b4, 250, 1000)
  const ring = useEase(b7 + 20, b7 + 50, 0, 1)
  return (
    <IdeaFrame idea={5} T={T} scoreAt={T.at("08")}>
      <AgentLog at={b2} lines={[
        { at: b2 + 8, fn: "gps.policy()", out: "opens T-60 min" },
        { at: b3 + 6, fn: "trip.signal_gap()", out: "6 h dark" },
        { at: b4 + 6, fn: "checkins.schedule()", out: "home, airport" },
        { at: b5 + 6, fn: "flights.status()", out: "landed · skip prompt" },
        { at: b6 + 6, fn: 'push.send("on your way?")', out: "1 tap" },
        { at: b7 + 14, fn: "reminder.timeout()", out: "no answer · escalate", tone: "orange" },
      ]} />
      <Svg>
        <DrawPath d={`M 150 ${y} H 1770`} at={b2} dur={30} stroke={C.sand} width={8} id="tl8" />
        {f >= b2 + 20 && <rect x={1500} y={y - 60} width={interpolate(f, [b2 + 20, b2 + 24], [0, 200], clamp)} height={120} rx={20} fill={C.tealBg} stroke={C.teal} strokeWidth={3} />}
        {[[pts.home, pts.air], [pts.air, pts.land], [pts.land, 1500]].map(([x1, x2], i) => (
          <rect key={i} x={x1 + 8} y={y - 50} width={x2 - x1 - 16} height={100} rx={22} fill={interpolateColors(seen[i], [0, 1], [C.hair, C.tealBg])} stroke={interpolateColors(seen[i], [0, 1], [C.hair, C.teal])} strokeWidth={3} opacity={fog} />
        ))}
        {[["Leave home", pts.home], ["Airport", pts.air], ["Landing", pts.land], ["Pickup", pts.pick]].map(([l, x], i) => <G key={l as string} at={b2 + 10 + i * 4}><circle cx={x as number} cy={y} r={16} fill={C.ink} stroke={C.birch} strokeWidth={6} /></G>)}
        {[pts.home, pts.air].map((x, i) => f >= (i ? T.cue("04", "checkins") : T.cue("04", "schedules")) ? <circle key={x} cx={x} cy={y} r={30 + ((f - b4) % 40)} fill="none" stroke={C.teal} strokeWidth={4} opacity={Math.max(0, 1 - ((f - b4) % 40) / 40)} /> : null)}
        {f >= b3 + 10 && f < b4 + 16 && <g opacity={0.3}><DriverFigure x={drift} y={y - 40} scale={0.9} /></g>}
      </Svg>
      {[["Leave home", pts.home], ["Airport", pts.air], ["Landing", pts.land], ["Pickup", pts.pick]].map(([l, x], i) => <Pop key={l as string} at={b2 + 10 + i * 4} x={(x as number) - 120} y={y + 50} w={240}><Txt size={30} weight={600} style={{ textAlign: "center" }}>{l}</Txt></Pop>)}
      <Pop at={b2 + 16} x={1480} y={y + 120} w={300}><Chip tone="teal" size={24}>GPS window, 1 h</Chip></Pop>
      <Pop at={b3 + 14} out={T.cue("05", "known")} x={600} y={y - 200} w={500}><Txt size={34} weight={600} color={C.muted} style={{ textAlign: "center" }}>Blind for hours</Txt></Pop>
      {[[pts.home, "Leave home"], [pts.air, "Airport"]].map(([x, l], i) => <Pop key={l as string} at={i ? T.cue("04", "checkins") : T.cue("04", "schedules")} out={b5} x={(x as number) - 110} y={y - 100} w={220}><Chip tone="teal" size={24}>Check-in</Chip></Pop>)}
      <Pop at={b5} x={pts.land - 60} y={y - 220} from="up"><Glyph kind="plane" size={110} color={C.ink} /></Pop>
      <Pop at={b5 + 14} x={pts.land - 170} y={y - 330} w={340}><div style={{ textAlign: "center" }}><Chip tone={status === "Landed" ? "green" : "neutral"} size={28}>{status}</Chip><Txt size={22} color={C.muted} style={{ marginTop: 8 }}>Already known. No question.</Txt></div></Pop>
      {/* beat 6 and 7: the phone */}
      <Pop at={b6} out={b7 + 64} x={1340} y={200} w={320} h={310} from="up">
        <div style={{ width: 320, height: 310, border: `9px solid ${C.ink}`, borderRadius: 48, background: C.birch, padding: "50px 22px 20px", display: "flex", flexDirection: "column", gap: 14, alignItems: "center", fontFamily: F.body }}>
          <Txt size={28} weight={600} style={{ textAlign: "center" }}>{f >= b7 + 16 ? "Reminder" : "Are you on your way?"}</Txt>
          {f < b7 ? (<><Btn primary hover={f >= tapAt && f < tapAt + 8}>Yes</Btn><Btn>Share location once</Btn></>) : (
            <svg width={110} height={110}><circle cx={55} cy={55} r={42} fill="none" stroke={C.hair} strokeWidth={9} /><circle cx={55} cy={55} r={42} fill="none" stroke={C.orange} strokeWidth={9} strokeLinecap="round" strokeDasharray={264} strokeDashoffset={264 * ring} transform="rotate(-90 55 55)" /></svg>
          )}
        </div>
      </Pop>
      {f >= tapAt && f < tapAt + 14 && <div style={{ position: "absolute", left: 1340 + 160 - 40, top: 200 + 150, width: 80, height: 80, borderRadius: "50%", border: `4px solid ${C.teal}`, transform: `scale(${(f - tapAt) / 14 + 0.3})`, opacity: 1 - (f - tapAt) / 14 }} />}
      <Pop at={b7 + 55} x={1060} y={760} w={760} from="flip">
        <Card style={{ padding: "26px 32px" }}>
          <Caps>Decision card · no answer</Caps>
          <div style={{ display: "flex", gap: 18, marginTop: 18 }}><Btn primary hover>Repost the gig</Btn><Btn>Move the slot</Btn></div>
        </Card>
      </Pop>
      <Cursor path={[{ f: b7 + 40, x: 1700, y: 900 }, { f: b7 + 56, x: 1220, y: 880 }, { f: b7 + 74, x: 1480, y: 880 }]} />
    </IdeaFrame>
  )
}

// ---------- Scene 9: idea 6, data stick ----------
export const Scene09 = () => {
  const T = sceneTiming(9)
  const f = useCurrentFrame()
  const b2 = T.at("02"), b3 = T.at("03"), b4 = T.at("04"), b5 = T.at("05"), b6 = T.at("06")
  const stamp = useEase(T.cue("03", "hundred"), T.cue("03", "hundred") + 10, 0, 1)
  const slide = useEase(T.cue("03", "per"), T.cue("03", "per") + 30)
  const plug = useEase(b4 + 10, b4 + 16)
  const sev = useEase(b5 + 22, b5 + 44, 0, 0.85)
  const nodes: [string, number, "stick" | "pin" | "phone" | "head"][] = [["Stick", 230, "stick"], ["Car port", 640, "pin"], ["Driver app", 1050, "phone"], ["Agent", 1460, "head"]]
  const dimAfter = f >= b5 ? 0.25 : 1
  const veil = useEase(b6, b6 + 10)
  return (
    <IdeaFrame idea={6} T={T} scoreAt={T.at("07")}>
      <AgentLog at={b2} out={b5} w={560} lines={[
        { at: b2 + 8, fn: "vision.read(photo)", out: "blurry · conf 0.31", tone: "orange" },
        { at: b4 + 8, fn: "obd.stream()", out: "4 fields · 1 Hz" },
        { at: b4 + 30, fn: "dtc.decode()", out: "P0301 misfire" },
      ]} />
      {/* beat 2: blurry photo */}
      <Pop at={b2} out={b3} x={560} y={260} w={640} h={420}>
        <div style={{ width: 640, height: 420, borderRadius: 28, background: `linear-gradient(135deg, ${C.brown}, ${C.ink})`, filter: "blur(10px)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 270, top: 150, width: 90, height: 90, borderRadius: "50%", background: C.red, boxShadow: `0 0 60px ${C.red}` }} />
        </div>
      </Pop>
      {[0, 1, 2].map((k) => <Pop key={k} at={b2 + 20 + k * 10} out={b3} x={760 + k * 140} y={180 - (f - b2) * 0.3 % 40} from="up"><Disp size={90} color={C.orange}>?</Disp></Pop>)}
      <Pop at={b2 + 16} out={b3} x={1400} y={400}><PersonIcon size={140} /></Pop>
      {/* beat 3: price */}
      <Pop at={b3} out={b4} x={200} y={320} w={700}>
        <Card><Caps>Fleets</Caps>
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>{Array.from({ length: 6 }, (_, i) => <div key={i} style={{ width: 80, height: 50, borderRadius: 10, background: C.tealInk }} />)}</div>
          <Txt size={26} color={C.muted} style={{ marginTop: 16 }}>Same 50 trucks, every day ↻</Txt>
        </Card>
      </Pop>
      <Pop at={b3 + 14} out={b4} x={1100} y={320} w={620}>
        <div style={{ transform: `translateY(${slide * 20}px) rotate(${slide * 3}deg)` }}>
          <Card><Caps>This job</Caps><div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 20 }}><svg width={170} height={100}><CarIcon x={85} y={44} scale={0.8} /></svg><Txt size={26} color={C.muted}>Driven once →</Txt></div></Card>
        </div>
      </Pop>
      {stamp > 0 && f < b4 && <div style={{ position: "absolute", left: 640 + slide * 520, top: 640 + slide * -120, transform: `scale(${1.4 - 0.4 * stamp}) rotate(-4deg)`, opacity: stamp }}><Box tone="orange" style={{ fontSize: 36 }}>About 100 € per car</Box></div>}
      {/* beat 4: the device diagram */}
      <Svg>
        {[0, 1, 2].map((k) => <DrawPath key={k} d={`M ${nodes[k][1] + 120} 520 H ${nodes[k + 1][1] - 20}`} at={b4 + 16 + k * 10} dur={14} stroke={C.teal} width={5} id={`dd${k}`} />)}
      </Svg>
      {nodes.map(([l, x, g], k) => (
        <Pop key={l} at={b4 + k * 5} out={b5 + 220} x={x - (k === 0 ? (1 - plug) * 80 : 0)} y={440} w={200} dim={dimAfter}>
          <Card style={{ padding: "22px 12px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}><Glyph kind={g} size={64} color={C.tealInk} /><Txt size={26} weight={600}>{l}</Txt></Card>
        </Pop>
      ))}
      {["Fault code", "Fuel or battery", "Mileage", "Speed"].map((c, k) => {
        const t = ((f - (b4 + 28 + k * 14)) % 80) / 80
        return f >= b4 + 28 + k * 14 && f < b5 ? <div key={c} style={{ position: "absolute", left: 300 + t * 1200, top: 650 + (k % 2) * 60 }}><Chip tone="teal" size={22}>{c}</Chip></div> : null
      })}
      {/* beat 5: exact fault */}
      <DecisionCard at={b5} x={510} y={620} w={900} pulse={false} label="Decision card · with fault code"
        rows={[["What happened", "Warning light · A7 service area"], ["Fault", "P0301 · cylinder 1 misfire"], ["Evidence", "obd stream · 4 fields · conf 0.94"]]}
        extra={<div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 16 }}><Txt size={24} weight={600}>Severity</Txt><div style={{ flex: 1, height: 20, borderRadius: 10, background: C.hair }}><div style={{ width: `${sev * 100}%`, height: "100%", borderRadius: 10, background: C.orange }} /></div></div>} />
      {/* beat 6: open question */}
      {f >= b6 && <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, background: C.birch, opacity: 0.75 * veil }} />}
      <Pop at={b6 + 14} x={360} y={360} w={1200}>
        <div style={{ transform: "rotate(-3deg)" }}>
          <Box tone="orange" style={{ flexDirection: "column", gap: 14, padding: "44px 56px", boxShadow: `0 0 0 6px ${C.orange}` }}>
            <Caps style={{ color: C.orangeInk }}>Open question</Caps>
            <span style={{ fontSize: 46 }}>May a driver plug a device into a customer's car?</span>
          </Box>
        </div>
      </Pop>
    </IdeaFrame>
  )
}
