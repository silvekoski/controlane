import React from "react"
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion"
import { BahnLogo, Captions, Crop } from "../components"
import { BAHN, C, F } from "../lib/tokens"
import { cue } from "../lib/timing"
import { DEEP, ease, POP } from "../lib/motion"

const ID = "01-cold-open"
// The map is the real OpenStreetMap layer from the live map capture. Region in capture px.
const MAP = { src: "ui/05-live-map.png", x: 673, y: 53, w: 758, h: 838 }
const S = 1.42
// City positions in the map region, read from the same capture.
const P = {
  helsinki: [599, 212], tampere: [572, 150], kobenhavn: [317, 405], hamburg: [259, 489], berlin: [337, 522],
  frankfurt: [230, 607], munchen: [295, 685], dusseldorf: [187, 567], stockholm: [444, 260],
} as const
type City = keyof typeof P
const ROUTES: [City, City, number][] = [
  ["hamburg", "helsinki", -0.22], ["munchen", "hamburg", 0.12], ["frankfurt", "kobenhavn", -0.15],
  ["dusseldorf", "hamburg", 0.1], ["tampere", "helsinki", 0.3], ["berlin", "kobenhavn", 0.2], ["kobenhavn", "stockholm", -0.2],
]
// From the brief: "A normal week has things like these in it".
const ALERTS: { text: string; at: City; dx: number; dy: number }[] = [
  { text: "Missed the train", at: "frankfurt", dx: -40, dy: -10 },
  { text: "Car not ready", at: "munchen", dx: 30, dy: 20 },
  { text: "Paper nobody mentioned", at: "dusseldorf", dx: -60, dy: -40 },
  { text: "Ferry sold out", at: "stockholm", dx: 70, dy: 20 },
  { text: "Tampere in the address, Helsinki in the notes", at: "tampere", dx: -60, dy: -26 },
]

const arc = (a: readonly number[], b: readonly number[], bend: number) => {
  const [x1, y1] = a.map((v) => v * S), [x2, y2] = b.map((v) => v * S)
  const mx = (x1 + x2) / 2 - (y2 - y1) * bend, my = (y1 + y2) / 2 + (x2 - x1) * bend
  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`
}

const Counter: React.FC<{ at: number; big: string; small: string }> = ({ at, big, small }) => {
  const frame = useCurrentFrame()
  const o = ease(frame, at, at + 12)
  return (
    <div style={{ opacity: o, transform: `translateY(${(1 - o) * 14}px)` }}>
      <div style={{ fontFamily: F.sans, fontSize: 88, fontWeight: 650, letterSpacing: "-0.035em", color: BAHN.ink, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{big}</div>
      <div style={{ fontFamily: F.sans, fontSize: 26, color: BAHN.muted, marginTop: 10 }}>{small}</div>
    </div>
  )
}

export const S1: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const fromDark = ease(frame, 0, 26, 1, 0)
  const tilt = 54 - 16 * spring({ frame: frame - 20, fps, config: DEEP, durationInFrames: 260 })
  const dolly = -260 + 260 * spring({ frame: frame - 10, fps, config: DEEP, durationInFrames: 300 })
  const mapIn = ease(frame, 14, 50)
  const routesAt = cue(ID, "twenty-five") - 8
  const alertsAt = cue(ID, "something")
  return (
    <AbsoluteFill style={{ background: BAHN.paper }}>
      {/* The map, tilted in 3D, fading into the paper at its edges. */}
      <div style={{ position: "absolute", left: 720, top: -40, width: 1200, height: 1000, perspective: 1600, opacity: mapIn,
        WebkitMaskImage: "radial-gradient(ellipse 60% 58% at 52% 50%, #000 55%, transparent 100%)" }}>
        <div style={{ position: "absolute", left: 60, top: -80, width: MAP.w * S, height: MAP.h * S, transformStyle: "preserve-3d",
          transform: `translateZ(${dolly}px) rotateX(${tilt}deg) rotateZ(-6deg)`, transformOrigin: "50% 60%" }}>
          <div style={{ position: "absolute", inset: 0, filter: "grayscale(1) contrast(0.85) brightness(1.06)" }}>
            <Crop src={MAP.src} imgH={900} x={MAP.x} y={MAP.y} w={MAP.w} h={MAP.h} top={0} left={0} scale={S} />
          </div>
          <div style={{ position: "absolute", inset: 0, background: BAHN.paper, mixBlendMode: "multiply", opacity: 0.9 }} />
          <svg width={MAP.w * S} height={MAP.h * S} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            {ROUTES.map(([a, b, bend], i) => {
              const p = ease(frame, routesAt + i * 9, routesAt + i * 9 + 40)
              return <path key={i} d={arc(P[a], P[b], bend)} pathLength={1} fill="none" stroke={C.accent} strokeWidth={4} strokeLinecap="round"
                strokeDasharray={`${p} 1`} style={{ filter: `drop-shadow(0 0 6px ${C.accent}88)` }} />
            })}
            {Object.values(P).map(([x, y], i) => <circle key={i} cx={x * S} cy={y * S} r={7} fill={BAHN.paper} stroke={C.accent} strokeWidth={3} opacity={ease(frame, routesAt + i * 4, routesAt + i * 4 + 10)} />)}
          </svg>
          {ALERTS.map((a, i) => {
            const at = alertsAt + i * 7
            const p = spring({ frame: frame - at, fps, config: POP })
            const [x, y] = P[a.at]
            return (
              <div key={a.text} style={{ position: "absolute", left: x * S + a.dx, top: y * S + a.dy, transformOrigin: "50% 100%",
                transform: `translate(-50%, -100%) rotateZ(6deg) rotateX(${-tilt}deg) scale(${1.25 * p})`, opacity: Math.min(1, p * 1.5) }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 13px", borderRadius: 9, background: "#fff", boxShadow: `inset 0 0 0 1.5px #f2c48a, 0 8px 20px -8px rgba(18,17,14,0.25)`, fontFamily: F.sans, fontSize: 21, fontWeight: 500, color: "#9a4f05", whiteSpace: "nowrap" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 9, background: C.warning }} />{a.text}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Numbers from the brief, one per beat. */}
      <div style={{ position: "absolute", left: 120, top: 150, display: "flex", flexDirection: "column", gap: 54 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, opacity: ease(frame, 30, 50), marginBottom: -14 }}>
          <BahnLogo height={22} color={BAHN.ink} />
          <span style={{ fontFamily: F.mono, fontSize: 17, color: BAHN.muted }}>from the challenge brief</span>
        </div>
        <Counter at={cue(ID, "twenty-five")} big="25,000+" small="cars delivered this year" />
        <Counter at={cue(ID, "One")} big="1" small="driver per car" />
        <Counter at={cue(ID, "three")} big="3" small="countries: Finland, Denmark, Germany" />
      </div>

      <div style={{ position: "absolute", right: 48, top: 920, fontFamily: F.sans, fontSize: 15, color: BAHN.muted, opacity: mapIn }}>Map data © OpenStreetMap contributors</div>
      <Captions id={ID} />
      <AbsoluteFill style={{ background: BAHN.ink, opacity: fromDark }} />
    </AbsoluteFill>
  )
}
