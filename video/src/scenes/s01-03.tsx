import { Easing, interpolate, useCurrentFrame } from "remotion"
import { getLength, getPointAtLength } from "@remotion/paths"
import { AgentLog, Badge, Box, Caps, Card, Chip, Cursor, DecisionCard, Disp, DrawPath, G, Glyph, Headline, Lock, Pin, Pop, Svg, Txt, Typed } from "../components"
import { SNAPPY, useCount, useEase, usePulse, useSpr } from "../motion"
import { sceneTiming } from "../timing"
import { C, F } from "../theme"
import { Label, SceneShell } from "./frame"

// ---------- Scene 1: title ----------
export const Scene01 = () => {
  return (
    <SceneShell n={1} dark>
      <div style={{ position: "absolute", left: 96, top: 150, width: 900 }}>
        <div style={{ fontFamily: F.mono, fontSize: 26, color: C.sand }}>Prompt Operations Hackathon · 24 to 25 Oct 2026</div>
        <Disp size={104} color={C.birch} style={{ marginTop: 120, textTransform: "uppercase" }}>Eight ways to give your agents more legwork</Disp>
        <Txt size={40} color={C.birch} style={{ marginTop: 56 }}>Help us pick one</Txt>
        <Txt size={28} color={C.sand} style={{ marginTop: 14 }}>Veikka Silvekoski</Txt>
      </div>
      <TrailStreaks />
    </SceneShell>
  )
}

const TrailStreaks = () => {
  const f = useCurrentFrame()
  const paths = [
    "M 1000 900 C 1300 300 1500 1000 1980 200", "M 980 700 C 1300 500 1600 900 1990 520", "M 1040 300 C 1400 700 1600 200 1990 760",
    "M 1100 1000 C 1300 800 1700 700 1990 980", "M 1000 140 C 1400 200 1600 500 1990 90",
  ]
  const cols = [C.teal, C.orange, C.red, C.green, C.teal]
  const drift = Math.sin(f / 40) * 14
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0, opacity: 0.9 }}>
      <defs><filter id="blur"><feGaussianBlur stdDeviation="6" /></filter></defs>
      {paths.map((d, i) => (
        <g key={i} transform={`translate(0 ${drift * (i % 2 ? 1 : -1)})`}>
          <path d={d} fill="none" stroke={cols[i]} strokeWidth={14} strokeLinecap="round" filter="url(#blur)" opacity={0.7} />
          <path d={d} fill="none" stroke={cols[i]} strokeWidth={4} strokeLinecap="round" />
        </g>
      ))}
    </svg>
  )
}

// ---------- Scene 2: the pattern ----------
export const Scene02 = () => {
  const T = sceneTiming(2)
  const f = useCurrentFrame()
    const sig = T.at("02")
  const orbit = f / 22
  const quiet = T.cue("04", "quietly")
  const dimQuiet = useEase(quiet, quiet + 12, 1, 0.3)
  const lockAt = T.cue("06", "gated")
  const p = usePulse(f > T.at("05") + 60)
  const tokens: [string, "coin" | "calendar" | "bubble"][] = [["Costs money", "coin"], ["Moves a date", "calendar"], ["Talks to a customer", "bubble"]]
  return (
    <SceneShell n={2}>
      <AgentLog at={T.at("03")} lines={[
        { at: T.at("03") + 8, fn: "places.lookup(pos)", out: "A7 service area" },
        { at: T.at("03") + 22, fn: "tracking.last_ping()", out: "2 min ago" },
        { at: T.at("03") + 36, fn: "chat.last_message()", out: "driver ok, 09:12" },
        { at: T.at("05") + 8, fn: "card.create()", out: "pending human", tone: "orange" },
      ]} y={700} />
      <div style={{ position: "absolute", inset: 0, transform: "translateY(-190px)" }}>
      {/* signal */}
      <Svg>
        {[0, 14].map((d) => {
          const q = ((f - sig - d) % 46) / 46
          return f >= sig + d && f < sig + 92 ? <circle key={d} cx={260} cy={560} r={30 + q * 90} fill="none" stroke={C.teal} strokeWidth={5} opacity={1 - q} /> : null
        })}
        <G at={sig}><circle cx={260} cy={560} r={30} fill={C.teal} stroke={C.birch} strokeWidth={6} /></G>
        <DrawPath d="M 300 560 H 590" at={T.at("03")} dur={18} stroke={C.sand} id="s2a" />
        <DrawPath d="M 920 560 C 1010 560 1010 330 1130 330" at={T.at("04")} dur={22} stroke={C.green} id="s2b" />
        <DrawPath d="M 920 560 C 1010 560 1010 760 1130 760" at={T.at("05")} dur={22} stroke={C.orange} id="s2c" />
      </Svg>
      <Label x={190} y={620} size={26} color={C.muted}>Something happens</Label>
      <Pop at={T.at("03")} x={600} y={500} w={320} h={120}><Box tone="teal" style={{ height: 120, fontSize: 32 }}>Cheap checks</Box></Pop>
      {[0, 1, 2].map((k) => {
        const a = orbit + (k * Math.PI * 2) / 3
        return (
          <Pop key={k} at={T.at("03") + 8 + k * 5} x={760 + Math.cos(a) * 190 - 28} y={560 + Math.sin(a) * 150 - 28} from="scale">
            {k === 2 ? <Typed text="…" at={0} /> : null}
            <Glyph kind={(["search", "pin", "chat"] as const)[k]} size={56} color={C.tealInk} />
          </Pop>
        )
      })}
      <Pop at={T.at("04") + 12} x={1130} y={280} w={430}>
        <div style={{ opacity: dimQuiet, transform: `translateY(${(1 - dimQuiet) * -30}px)` }}>
          <Box tone="green" style={{ height: 100, justifyContent: "flex-start", gap: 18 }}><Glyph kind="check" size={52} color={C.greenInk} />Done quietly</Box>
        </div>
      </Pop>
      <DecisionCard at={T.at("05") + 14} x={1130} y={620} w={690} pulse={false} rows={[["What happened", "Position unchanged 42 min"], ["Evidence", "tracking #41 · alert #12"], ["Suggestion", "Call dealer · conf 0.87"]]} hover={f > lockAt + 40 ? 0 : -1} />
      {tokens.map(([l, g], k) => (
        <Pop key={l} at={T.at("06") + k * 6} x={1130 + k * 230} y={440} w={200} from="up">
          <Card style={{ padding: 18, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <Glyph kind={g} size={60} color={C.brown} />
            <Txt size={22} weight={500} style={{ textAlign: "center" }}>{l}</Txt>
          </Card>
        </Pop>
      ))}
      {tokens.map((_, k) => <Lock key={k} x={1130 + k * 230 + 140} y={410} at={lockAt + k * 7} size={64} />)}
      <Cursor path={[{ f: lockAt + 26, x: 1700, y: 990 }, { f: lockAt + 52, x: 1210, y: 905 }]} />
      <div style={{ position: "absolute", left: 1130, top: 600, width: 690, height: 0, transform: `scale(${p})` }} />
      </div>
    </SceneShell>
  )
}

// ---------- Scene 3: the map ----------
const STATIONS = ["Dispatch", "Travel to car", "Pickup", "On the road", "Delivery"]
const SX = (i: number) => 260 + i * 350
const PINS: [number, number, string][] = [[1, 0, "Carpooling"], [2, 1, "Strike watch"], [3, 1, "Scooters"], [7, 1, "Voice desk"], [5, 2, "Check-in"], [4, 3, "GPS stop check"], [6, 3, "Data stick"]]
const PIN_OFFSET: Record<number, number> = { 1: 0, 2: -90, 3: 0, 7: 90, 5: 0, 4: -50, 6: 50 }

export const Scene03 = () => {
  const T = sceneTiming(3)
  const f = useCurrentFrame()
  const drive = useEase(T.at("01") + 14, T.at("01") + T.len("01") - 10, 100, SX(4))
  const learn = T.at("03")
  const pulse = interpolate(f, [T.cue("03", "every") + 30, T.cue("03", "every") + 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  return (
    <SceneShell n={3}>
      <Svg>
        <DrawPath d={`M 100 440 H ${SX(4) + 120}`} at={2} dur={30} stroke={C.ink} width={8} id="map" />
        {STATIONS.map((s, i) => <G key={s} at={10 + i * 6}><circle cx={SX(i)} cy={440} r={20} fill={C.birch} stroke={C.ink} strokeWidth={8} /></G>)}
        {[0, 1, 2, 3, 4].map((i) => (
          <DrawPath key={i} d={`M 1620 730 C 1500 600 ${SX(i) + 100} 620 ${SX(i)} 470`} at={T.cue("03", "every")} dur={22} stroke={pulse > 0 && pulse < 1 ? C.orange : C.orange} width={4 + 4 * Math.sin(pulse * Math.PI)} id={`ll${i}`} />
        ))}
        <G at={T.at("01") + 10} out={T.at("01") + T.len("01") + 2}>
          <g transform={`translate(${drive} 400)`}>
            <path d="M-34 8 L-30 -4 Q-24 -14 -12 -14 H12 Q22 -14 28 -4 L36 2 Q40 4 40 10 V14 H-38 V10Z" fill={C.orange} />
            <circle cx={-20} cy={14} r={8} fill={C.birch} stroke={C.orange} strokeWidth={5} /><circle cx={22} cy={14} r={8} fill={C.birch} stroke={C.orange} strokeWidth={5} />
          </g>
        </G>
      </Svg>
      {STATIONS.map((s, i) => (
        <Pop key={s} at={12 + i * 6} x={SX(i) - 150} y={490} w={300} from="up"><Txt size={34} weight={600} style={{ textAlign: "center" }}>{i + 1}&nbsp; {s}</Txt></Pop>
      ))}
      {PINS.map(([n, st, name], k) => {
        const at = T.at("02") + k * 5
        return (
          <div key={n}>
            <Pin n={n} x={SX(st) + PIN_OFFSET[n]} y={340} at={at} size={72} />
          </div>
        )
      })}
      <Pop at={learn} x={96} y={700} w={1728} from="up">
        <Box tone="orange" style={{ height: 150, justifyContent: "flex-start", paddingLeft: 48 }}>
          <Caps style={{ color: C.orangeInk, fontSize: 30 }}>Learning layer, under every agent</Caps>
        </Box>
      </Pop>
      <Pin n={8} x={1680} y={775} at={learn + 14} size={84} />
    </SceneShell>
  )
}
