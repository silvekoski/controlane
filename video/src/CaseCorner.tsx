import { interpolate, useCurrentFrame } from "remotion"
import { C, CARD_SHADOW, F, TONE, type ToneName } from "./theme"
import { sceneStart, sceneTiming } from "./timing"

type Step = [scene: number, local: number, label: string, tone: ToneName]
const T = (n: number) => sceneTiming(n)

/** How the current case changes over the video. Frames are local to each scene. */
const STEPS: Step[] = [
  [3, 0, "In transit", "teal"],
  [4, 0, "Dispatch", "teal"],
  [5, 0, "Travel to car", "teal"],
  [5, T(5).cue("03", "late"), "Strike on leg", "red"],
  [5, T(5).at("06"), "Re-routed", "green"],
  [5, T(5).at("07"), "Needs a person", "orange"],
  [6, 0, "Travel to car", "teal"],
  [7, 0, "On the road", "teal"],
  [7, T(7).at("06"), "Stopped 42 min", "orange"],
  [7, T(7).at("07"), "Needs a person", "red"],
  [7, T(7).cue("09", "yes") + 14, "Resolved", "green"],
  [8, 0, "Pickup in 6 h", "neutral"],
  [8, T(8).at("04"), "Check-ins set", "teal"],
  [8, T(8).cue("06", "tap") + 6, "Driver confirmed", "green"],
  [8, T(8).at("07") + 14, "Needs a person", "orange"],
  [9, 0, "On the road", "teal"],
  [9, T(9).at("02"), "Warning light", "orange"],
  [9, T(9).at("05"), "Fault P0301", "red"],
  [10, 0, "Travel to car", "teal"],
  [10, T(10).at("03"), "Ferry slot full", "orange"],
  [10, T(10).at("04") + 33, "Rebooked", "green"],
  [11, 0, "Logged for evals", "teal"],
]

/** The case every scene is working on. It lives above the scene transitions so it stays put. */
export const CaseCorner = () => {
  const f = useCurrentFrame()
  const from = sceneStart(3)
  const to = sceneStart(12)
  const steps = STEPS.map(([n, l, label, tone]) => ({ at: sceneStart(n) + l, label, tone }))
  const cur = [...steps].reverse().find((s) => f >= s.at) ?? steps[0]
  const opacity = interpolate(f, [from, from + 10, to - 10, to], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  if (opacity <= 0) return null
  const tone = TONE[cur.tone]
  return (
    <div style={{ position: "absolute", left: 1380, top: 24, width: 450, opacity, background: C.birch, borderRadius: 18, boxShadow: CARD_SHADOW, padding: "14px 20px", fontFamily: F.body }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted }}>Current case</span>
        <span style={{ fontFamily: F.mono, fontSize: 18, color: C.brown }}>CD-420055</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, marginTop: 2 }}>Bentley Continental GT</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <span style={{ fontSize: 20, color: C.muted }}>Seinäjoki → Turku</span>
        <span style={{ fontSize: 18, fontWeight: 500, padding: "3px 12px", borderRadius: 999, background: tone.bg, color: tone.fg, whiteSpace: "nowrap" }}>{cur.label}</span>
      </div>
    </div>
  )
}
