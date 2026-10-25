import React from "react"
import { AbsoluteFill, Img, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion"
import { Captions, Card, CornerBug, SceneLabel, Shot } from "../components"
import { C, F } from "../lib/tokens"
import { cue } from "../lib/timing"
import { DEEP, ease, POP } from "../lib/motion"

const ID = "08-how-i-built-it"

// The real section headings of ../PRD.md, in order.
const HEADINGS = ["Summary", "Problem", "What Bahn said", "Goals and success metrics", "Benchmark against Jev", "Visual checks", "Users", "Scope", "Solution",
  "Interface", "Rules and approvals", "Demo flow", "Technical approach", "Build spec", "Build plan until Sunday 15:00", "Risks and open questions"]
// Heading -> the screen it produced.
const LINKS = [
  { heading: 9, src: "ui/01-overview.png", label: "Overview" },
  { heading: 10, src: "ui/03-decision-card-cd-420055-tall.png", label: "Decision card", tall: true },
  { heading: 11, src: "ui/05-live-map.png", label: "Live map" },
  { heading: 4, src: "ui/07-checks-and-evals.png", label: "Checks and evals" },
]
const PAGE = { x: 300, y: 150, w: 600, rowY: 268, row: 38 }
const THUMB = { x: 1120, y: 200, w: 300, h: 188, gx: 330, gy: 250 }

const Prd: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = spring({ frame, fps, config: DEEP, durationInFrames: 40 })
  const first = cue(ID, "every") - 6
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: PAGE.x, top: PAGE.y, perspective: 1600 }}>
        <Card style={{ width: PAGE.w, height: 760, padding: "34px 40px", transform: `rotateY(${(1 - p) * 28}deg) translateZ(${(1 - p) * -200}px)`, transformOrigin: "0 50%", opacity: p }}>
          <div style={{ fontFamily: F.mono, fontSize: 16, color: C.muted }}>PRD.md</div>
          <div style={{ marginTop: 8, fontFamily: F.sans, fontSize: 32, fontWeight: 650, letterSpacing: "-0.02em", color: C.ink }}>PRD: Safe On-the-Road Agent</div>
          <div style={{ marginTop: 18 }}>
            {HEADINGS.map((h, i) => {
              const k = LINKS.findIndex((l) => l.heading === i)
              const on = k >= 0 ? ease(frame, first + k * 12, first + k * 12 + 8) : 0
              return <div key={h} style={{ height: PAGE.row, display: "flex", alignItems: "center", gap: 12, fontFamily: F.sans, fontSize: 22, color: on > 0.5 ? C.accent : C.muted, fontWeight: on > 0.5 ? 600 : 400 }}>
                <span style={{ fontFamily: F.mono, fontSize: 16, color: on > 0.5 ? C.accent : C.input }}>##</span>{h}
              </div>
            })}
          </div>
        </Card>
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {LINKS.map((l, k) => {
          const at = first + k * 12
          const d = ease(frame, at, at + 16)
          const x1 = PAGE.x + PAGE.w - 20, y1 = PAGE.y + PAGE.rowY - 18 + l.heading * PAGE.row
          const x2 = THUMB.x + (k % 2) * THUMB.gx, y2 = THUMB.y + Math.floor(k / 2) * THUMB.gy + THUMB.h / 2
          return <path key={k} d={`M ${x1} ${y1} C ${x1 + 120} ${y1}, ${x2 - 120} ${y2}, ${x2} ${y2}`} pathLength={1} strokeDasharray={`${d} 1`} fill="none" stroke={C.accent} strokeWidth={2.5} />
        })}
      </svg>
      {LINKS.map((l, k) => {
        const s = spring({ frame: frame - first - k * 12 - 10, fps, config: POP })
        return (
          <div key={l.label} style={{ position: "absolute", left: THUMB.x + (k % 2) * THUMB.gx, top: THUMB.y + Math.floor(k / 2) * THUMB.gy, opacity: Math.min(1, s * 1.5), transform: `scale(${0.85 + 0.15 * s})` }}>
            <div style={{ width: THUMB.w, height: THUMB.h, borderRadius: 10, overflow: "hidden", boxShadow: `0 0 0 1px ${C.border}, 0 12px 28px -14px rgba(24,24,27,0.3)`, background: "#fff" }}>
              <Img src={staticFile(l.src)} style={{ width: THUMB.w, height: l.tall ? (THUMB.w * 2000) / 1440 : THUMB.h, display: "block" }} />
            </div>
            <div style={{ marginTop: 8, fontFamily: F.sans, fontSize: 18, color: C.muted }}>{l.label}</div>
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

const Node: React.FC<{ at: number; x: number; y: number; w?: number; children: React.ReactNode; strong?: boolean }> = ({ at, x, y, w = 280, children, strong }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - at, fps, config: POP })
  return (
    <div style={{ position: "absolute", left: x - w / 2, top: y, width: w, opacity: Math.min(1, s * 1.5), transform: `scale(${0.8 + 0.2 * s})` }}>
      <Card style={{ padding: strong ? "18px 22px" : "14px 18px", boxShadow: strong ? `0 0 0 2px ${C.accent}, 0 16px 34px -16px rgba(92,98,210,0.45)` : undefined, display: "flex", alignItems: "center", gap: 14 }}>{children}</Card>
    </div>
  )
}
const Label: React.FC<{ top: string; sub?: string }> = ({ top, sub }) => (
  <div><div style={{ fontFamily: F.sans, fontSize: 22, fontWeight: 600, color: C.ink }}>{top}</div>{sub && <div style={{ fontFamily: F.sans, fontSize: 17, color: C.muted, marginTop: 2 }}>{sub}</div>}</div>
)
const Logo: React.FC<{ file: string; w: number; h: number; color?: string }> = ({ file, w, h, color = C.ink }) => (
  <div style={{ width: w, height: h, flex: "none", background: color, WebkitMaskImage: `url(${staticFile(`logos/${file}`)})`, WebkitMaskSize: "contain", WebkitMaskRepeat: "no-repeat", WebkitMaskPosition: "center" }} />
)

// A few of the skills by name. The rest of the cloud stands for the hundreds without a name on screen.
const SKILLS = ["design", "copy", "evals", "dataviz", "browser checks", "plain English", "debugging", "plans", "reviews", "docs"]

/** The skills cloud: named chips first, then many small ones fill in. */
const Skills: React.FC<{ at: number; named: number[] }> = ({ at, named }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return (
    <div style={{ position: "absolute", left: 600, top: 520, width: 720, height: 150 }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: -36, textAlign: "center", fontFamily: F.sans, fontSize: 20, color: C.muted, opacity: ease(frame, at, at + 12) }}>Hundreds of my own skills direct how I work</div>
      {Array.from({ length: 90 }).map((_, k) => {
        const x = (k * 97) % 700, y = 10 + ((k * 53) % 130)
        const t = spring({ frame: frame - at - 6 - (k % 30) * 1.5, fps, config: POP })
        return <div key={k} style={{ position: "absolute", left: x, top: y, width: 18 + (k % 4) * 8, height: 8, borderRadius: 9, background: k % 7 === 0 ? "#c7cbf3" : C.greySoft, opacity: t * 0.9, transform: `scale(${t})` }} />
      })}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", alignContent: "center", padding: "0 30px" }}>
        {SKILLS.map((name, i) => {
          const t = spring({ frame: frame - (named[i] ?? at + 20 + i * 4), fps, config: POP })
          return <span key={name} style={{ padding: "8px 14px", borderRadius: 9, background: "#fff", boxShadow: `0 0 0 1px ${i < 3 ? "#d3d5f5" : C.border}, 0 6px 14px -8px rgba(24,24,27,0.2)`, fontFamily: F.sans, fontSize: 20, fontWeight: 500, color: i < 3 ? "#3f45b0" : C.ink, opacity: Math.min(1, t * 1.4), transform: `scale(${0.7 + 0.3 * t})` }}>{name}</span>
        })}
      </div>
    </div>
  )
}

/** How it was built: tools on the left, the harness in the centre, skills below it, inspiration above, other models on the right. */
const Build: React.FC<{ base: number }> = ({ base }) => {
  const frame = useCurrentFrame()
  const at = (w: string, n = 0) => cue(ID, w, n) - base
  const harness = { x: 960, y: 330 }
  const right = [
    { at: at("Gemini"), mark: "googlegemini.svg", t: "Gemini 3.8 Flash", by: "Google" },
    { at: at("Grok"), mark: "grok.svg", t: "Grok 4.7", by: "xAI" },
    { at: at("G", 2), mark: "openai.svg", t: "GPT-6 Astra", by: "OpenAI" },
  ]
  const review = { x: 960, y: 760, at: at("cross") }
  const line = (x1: number, y1: number, x2: number, y2: number, t: number, key: string) => {
    const d = ease(frame, t, t + 14)
    return <path key={key} d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`} pathLength={1} strokeDasharray={`${d} 1`} fill="none" stroke={C.accent} strokeWidth={2} opacity={0.7} />
  }
  const inspo = ease(frame, at("Dribbble") - 4, at("Dribbble") + 10)
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {line(560, 300, harness.x - 190, harness.y + 36, at("harness"), "pi")}
        {line(560, 440, harness.x - 190, harness.y + 50, at("harness"), "cc")}
        {right.map((r, i) => line(1380, 290 + i * 130, review.x + 170, review.y + 34, review.at, r.t))}
        {line(harness.x, harness.y + 90, review.x, review.y, review.at, "core")}
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: 120, display: "flex", justifyContent: "center", alignItems: "center", gap: 30, opacity: inspo }}>
        <span style={{ fontFamily: F.sans, fontSize: 20, color: C.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>Design inspiration</span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}><Logo file="dribbble.svg" w={40} h={40} color="#ea4c89" /><span style={{ fontFamily: F.sans, fontSize: 28, fontWeight: 600, color: C.ink }}>Dribbble</span></span>
        <span style={{ display: "flex", alignItems: "center", gap: 10, opacity: ease(frame, at("Mobbin") - 4, at("Mobbin") + 8) }}><Logo file="mobbin.svg" w={56} h={26} /><span style={{ fontFamily: F.sans, fontSize: 28, fontWeight: 600, color: C.ink }}>Mobbin</span></span>
      </div>
      <Node at={at("Pi")} x={420} y={258} w={280} strong><Label top="Pi coding agent" sub="where I mainly work" /></Node>
      <Node at={at("Claude")} x={420} y={398} w={280}><Logo file="claude.svg" w={34} h={34} color="#d97757" /><Label top="Claude Code" sub="sometimes" /></Node>
      <Node at={at("harness")} x={harness.x} y={harness.y} w={380} strong>
        <Logo file="claude.svg" w={44} h={44} color="#d97757" />
        <Label top="My own Claude harness" sub={frame >= at("Opus") ? "Opus 5.5 · Anthropic" : "Anthropic"} />
      </Node>
      <Skills at={at("Hundreds")} named={[at("design"), at("copy"), at("evals")]} />
      {right.map((r, i) => (
        <Node key={r.t} at={r.at} x={1540} y={258 + i * 130} w={320}>
          <Logo file={r.mark} w={36} h={36} />
          <Label top={r.t} sub={r.by} />
        </Node>
      ))}
      <div style={{ position: "absolute", left: 1380, width: 320, top: 210, textAlign: "center", fontFamily: F.sans, fontSize: 18, color: C.muted, opacity: ease(frame, at("Gemini"), at("Gemini") + 10) }}>Coded alongside</div>
      <Node at={review.at} x={review.x} y={review.y} w={340} strong><Label top="Cross-AI review" sub="decided what stayed" /></Node>
    </AbsoluteFill>
  )
}

export const S8: React.FC = () => {
  const frame = useCurrentFrame()
  const build = cue(ID, "work") - 8
  const trace = cue(ID, "Every", 1) - 8
  return (
    <AbsoluteFill style={{ background: C.canvas }}>
      <Sequence durationInFrames={build}><AbsoluteFill style={{ opacity: ease(frame, build - 10, build, 1, 0) }}><Prd /></AbsoluteFill></Sequence>
      <Sequence from={build} durationInFrames={trace - build}>
        <AbsoluteFill style={{ opacity: Math.min(ease(frame, build, build + 10), ease(frame, trace - 10, trace, 1, 0)) }}><Build base={build} /></AbsoluteFill>
      </Sequence>
      <Sequence from={trace}>
        <AbsoluteFill style={{ opacity: ease(frame, trace, trace + 10) }}>
          <Shot src="ui/08-agent-traces.png" spot={[{ at: 0, x: 276, y: 172, w: 352, h: 584, o: 0 }, { at: 10, o: 1 }, { at: cue(ID, "full") - trace, x: 309, y: 517, w: 300, h: 217 }]} />
        </AbsoluteFill>
      </Sequence>
      <SceneLabel n={8} text="How I built it" />
      <CornerBug />
      <Captions id={ID} />
    </AbsoluteFill>
  )
}
