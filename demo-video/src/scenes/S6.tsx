import React from "react"
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion"
import { Captions, Card, CornerBug, SceneLabel, Shot } from "../components"
import { C, F } from "../lib/tokens"
import { cue } from "../lib/timing"
import { ease } from "../lib/motion"

const ID = "06-stop-check-agent"
const FADE = 8

/** Fades a shot in over the previous one. */
const In: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame()
  const o = ease(frame, 0, FADE)
  return <AbsoluteFill style={{ opacity: o, transform: `translateY(${(1 - o) * 10}px)` }}>{children}</AbsoluteFill>
}

/** The stop timer on the live map: an amber ring that counts the minutes. */
const StopTimer: React.FC<{ at: number; done: number }> = ({ at, done }) => {
  const frame = useCurrentFrame()
  const p = ease(frame, at, done)
  const o = ease(frame, at - 10, at)
  const r = 46, len = 2 * Math.PI * r
  return (
    <div style={{ position: "absolute", left: 930, top: 360, opacity: o, transform: `scale(${0.9 + 0.1 * o})` }}>
      <Card style={{ display: "flex", alignItems: "center", gap: 22, padding: "20px 26px" }}>
        <svg width={112} height={112} viewBox="0 0 112 112">
          <circle cx={56} cy={56} r={r} fill="none" stroke={C.greySoft} strokeWidth={8} />
          <circle cx={56} cy={56} r={r} fill="none" stroke={C.warning} strokeWidth={8} strokeLinecap="round" strokeDasharray={`${len * p} ${len}`} transform="rotate(-90 56 56)" />
          <text x={56} y={64} textAnchor="middle" style={{ fontFamily: F.mono, fontSize: 26, fontWeight: 600, fill: C.ink }}>{Math.round(26 * p)}</text>
        </svg>
        <div>
          <div style={{ fontFamily: F.sans, fontSize: 24, fontWeight: 600, color: C.ink }}>Stopped {Math.round(26 * p)} min</div>
          <div style={{ fontFamily: F.sans, fontSize: 19, color: C.muted, marginTop: 4 }}>Porsche 911 Carrera · CD-420145</div>
          <div style={{ fontFamily: F.sans, fontSize: 19, color: "#b45309", marginTop: 4 }}>No stop in the plan</div>
        </div>
      </Card>
    </div>
  )
}

/** The hackathon scope, then the job this agent does. */
const ScopeCard: React.FC<{ pick: number; out: number }> = ({ pick, out }) => {
  const frame = useCurrentFrame()
  const o = Math.min(ease(frame, 4, 18), ease(frame, out - 10, out, 1, 0))
  const p = ease(frame, pick, pick + 12)
  return (
    <div style={{ position: "absolute", left: 860, top: 150, width: 470, opacity: o, transform: `translateY(${(1 - o) * 12}px)` }}>
      <Card style={{ padding: "24px 28px" }}>
        <div style={{ fontFamily: F.sans, fontSize: 18, color: C.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>Hackathon scope</div>
        <div style={{ marginTop: 8, fontFamily: F.sans, fontSize: 30, fontWeight: 600, color: C.ink, lineHeight: 1.2 }}>One agent, one specific job</div>
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.border}`, opacity: p }}>
          <div style={{ fontFamily: F.sans, fontSize: 18, color: C.accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>My pick</div>
          <div style={{ marginTop: 6, fontFamily: F.sans, fontSize: 30, fontWeight: 600, color: C.ink }}>The live map</div>
          <div style={{ marginTop: 6, fontFamily: F.sans, fontSize: 21, color: C.muted }}>Watch every car on the road, and act on long stops</div>
        </div>
      </Card>
    </div>
  )
}

/** Two soft rings from the stop on the map, as the places lookup runs. */
const Radar: React.FC<{ at: number; x: number; y: number }> = ({ at, x, y }) => {
  const frame = useCurrentFrame()
  return <>{[0, 18].map((d) => {
    const t = ease(frame, at + d, at + d + 40)
    if (t <= 0 || t >= 1) return null
    return <div key={d} style={{ position: "absolute", left: x - 220 * t, top: y - 220 * t, width: 440 * t, height: 440 * t, borderRadius: 999, border: `3px solid ${C.accent}`, opacity: 1 - t }} />
  })}</>
}

const Step: React.FC<{ text: string; at: number; shown: number }> = ({ text, at, shown }) => {
  const frame = useCurrentFrame()
  const done = ease(frame, at, at + 8)
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: ease(frame, shown, shown + 10) }}>
      <div style={{ width: 22, height: 22, borderRadius: 99, flex: "none", background: done > 0.5 ? C.accent : "transparent", boxShadow: `inset 0 0 0 2px ${done > 0.5 ? C.accent : C.input}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {done > 0.5 && <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 6.2 L5 8.5 L9.5 3.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </div>
      <span style={{ fontFamily: F.sans, fontSize: 18, color: done > 0.5 ? C.ink : C.muted }}>{text}</span>
    </div>
  )
}

const Outcome: React.FC<{ text: string; color: string; at: number; shown: number }> = ({ text, color, at, shown }) => {
  const frame = useCurrentFrame()
  const on = ease(frame, at, at + 10)
  return (
    <div style={{ opacity: ease(frame, shown, shown + 10) * (0.4 + 0.6 * on), display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 34, height: 12, borderRadius: 99, background: on > 0.5 ? color : C.greySoft }} />
      <span style={{ fontFamily: F.sans, fontSize: 18, fontWeight: on > 0.5 ? 600 : 400, color: C.ink }}>{text}</span>
    </div>
  )
}

export const S6: React.FC = () => {
  const gps = cue(ID, "checks") - 10
  const chat = cue(ID, "reads") - 8
  const fuel = cue(ID, "Fuel", 1) - 8
  const odd = cue(ID, "Odd") - 8
  const asks = cue(ID, "asks") - 8
  const shown = cue(ID, "cheap") - 6
  const outcomes = fuel - 10
  const rel = (f: number, from: number) => f - from
  return (
    <AbsoluteFill style={{ background: C.canvas }}>
      <Sequence durationInFrames={gps + FADE}>
        <Shot src="ui/05-live-map.png"
          spot={[{ at: 0, x: 673, y: 53, w: 767, h: 847, o: 0 }, { at: cue(ID, "watches"), o: 1 }, { at: cue(ID, "stands") - 16, x: 262, y: 188, w: 405, h: 48 }, { at: cue(ID, "plain"), x: 266, y: 91, w: 397, h: 60 }]}>
          <ScopeCard pick={cue(ID, "live")} out={cue(ID, "watches") + 20} />
          <StopTimer at={cue(ID, "stands")} done={cue(ID, "minutes")} />
        </Shot>
      </Sequence>
      <Sequence from={gps} durationInFrames={chat - gps + FADE}>
        <In><Shot src="ui/06-stop-closed-quietly-cd-420145.jpg"
          spot={[{ at: 0, x: 400, y: 296, w: 128, h: 74, o: 0 }, { at: 8, o: 1 },
            { at: rel(cue(ID, "places"), gps), x: 268, y: 516, w: 394, h: 180 },
            { at: rel(cue(ID, "fuel"), gps), x: 268, y: 518, w: 394, h: 42 },
            { at: rel(cue(ID, "cafe"), gps), x: 268, y: 558, w: 394, h: 54 },
            { at: rel(cue(ID, "truck"), gps), x: 268, y: 616, w: 394, h: 40 },
            { at: rel(cue(ID, "ranks"), gps), x: 268, y: 380, w: 394, h: 104 }]}>
          <Radar at={rel(cue(ID, "places"), gps)} x={998} y={533} />
        </Shot></In>
      </Sequence>
      <Sequence from={chat} durationInFrames={fuel - chat + FADE}>
        <In><Shot src="ui/06b-late-card-cd-420145.png"
          spot={[{ at: 0, x: 302, y: 754, w: 512, h: 94, o: 0 }, { at: 8, o: 1 }, { at: rel(cue(ID, "arrival"), chat), x: 663, y: 297, w: 362, h: 78 }]} /></In>
      </Sequence>
      <Sequence from={fuel} durationInFrames={odd - fuel + FADE}>
        <In><Shot src="ui/06-stop-closed-quietly-cd-420145.jpg"
          spot={[{ at: 0, x: 266, y: 186, w: 398, h: 82, o: 0 }, { at: 8, o: 1 }]} /></In>
      </Sequence>
      <Sequence from={odd} durationInFrames={asks - odd + FADE}>
        <In><Shot src="ui/06d-unusual-stop-cd-420338.jpg"
          spot={[{ at: 0, x: 268, y: 598, w: 393, h: 40, o: 0 }, { at: 8, o: 1 }]} /></In>
      </Sequence>
      <Sequence from={asks}>
        <In><Shot src="ui/06c-tyre-card-cd-420576.jpg" imgH={2300}
          cam={[{ at: 0, sy: 1350 }, { at: rel(cue(ID, "breakdown"), asks), sy: 0 }, { at: rel(cue(ID, "one", 1), asks), sy: 260 }]}
          spot={[{ at: 0, x: 288, y: 1878, w: 470, h: 232, o: 0 }, { at: 8, o: 1 },
            { at: rel(cue(ID, "breakdown"), asks), x: 276, y: 72, w: 950, h: 104 },
            { at: rel(cue(ID, "one", 1), asks), x: 868, y: 566, w: 524, h: 262 },
            { at: rel(cue(ID, "decision", 1), asks), x: 864, y: 990, w: 232, h: 44 }]} /></In>
      </Sequence>

      <SceneLabel n={6} text="The agent: on the road">
        <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 14 }}>
          <Step text="GPS signal" at={cue(ID, "G")} shown={shown} />
          <Step text="Places lookup" at={cue(ID, "places")} shown={shown} />
          <Step text="Driver chat" at={cue(ID, "chat")} shown={shown} />
          <Step text="Arrival time" at={cue(ID, "arrival")} shown={shown} />
        </div>
        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 14 }}>
          <Outcome text="Stay quiet" color={C.ok} at={cue(ID, "Fuel", 1)} shown={outcomes} />
          <Outcome text="Ask the driver" color={C.warning} at={cue(ID, "Odd")} shown={outcomes} />
          <Outcome text="One decision" color={C.danger} at={cue(ID, "breakdown")} shown={outcomes} />
        </div>
      </SceneLabel>
      <CornerBug />
      <Captions id={ID} />
    </AbsoluteFill>
  )
}
