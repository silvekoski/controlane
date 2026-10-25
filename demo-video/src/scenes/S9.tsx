import React from "react"
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion"
import { AnimatedLogo, BahnLogo, BrandMark, Captions, CornerBug, LaneWipe, SceneLabel, Shot } from "../components"
import { C, F } from "../lib/tokens"
import { cue } from "../lib/timing"
import { ease } from "../lib/motion"
import { bahnator } from "../lib/metrics"

const ID = "09-close"

const EndCard: React.FC<{ base: number }> = ({ base }) => {
  const frame = useCurrentFrame()
  const url = cue(ID, "control", 1) - base
  const open = cue(ID, "code") - base
  const up = (at: number) => ({ opacity: ease(frame, at, at + 14), transform: `translateY(${(1 - ease(frame, at, at + 14)) * 10}px)` })
  return (
    <AbsoluteFill style={{ background: C.canvas }}>
      <AnimatedLogo at={4} height={128} style={{ position: "absolute", left: (1920 - (128 * 1048) / 210) / 2, top: 230 }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 430, textAlign: "center", fontFamily: F.mono, fontSize: 40, color: C.accent, ...up(url) }}>https://controlane.bobs.build</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 506, textAlign: "center", fontFamily: F.sans, fontSize: 30, color: C.ink, ...up(50) }}>Veikka Silvekoski · bob the builder</div>
      {bahnator.hfUrl && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 568, display: "flex", justifyContent: "center", alignItems: "center", gap: 12, ...up(open) }}>
          <BrandMark name="huggingface" size={26} />
          <span style={{ fontFamily: F.mono, fontSize: 22, color: C.muted }}>{bahnator.hfUrl}</span>
        </div>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, top: 740, display: "flex", justifyContent: "center", alignItems: "center", gap: 16, ...up(60) }}>
        <BahnLogo height={22} color={C.ink} />
        <span style={{ fontFamily: F.sans, fontSize: 24, color: C.ink }}>Built for Bahn's challenge · Prompt Operations Hackathon 2026</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 800, display: "flex", justifyContent: "center", alignItems: "center", gap: 10, fontFamily: F.sans, fontSize: 19, color: C.muted, ...up(70) }}>
        <span>Map data © OpenStreetMap contributors</span>
        <span style={{ margin: "0 6px" }}>·</span><span>Fictional data, every action is simulated</span>
      </div>
    </AbsoluteFill>
  )
}

export const S9: React.FC = () => {
  const inbox = 48
  const drivers = 92
  const light = 140
  const end = cue(ID, "Control") - 10
  return (
    <AbsoluteFill style={{ background: C.canvas }}>
      <Sequence durationInFrames={inbox}><Shot src="ui/09-order-cd-420458.png" /></Sequence>
      <Sequence from={inbox} durationInFrames={drivers - inbox}><Shot src="ui/09b-inbox.png" /></Sequence>
      <Sequence from={drivers} durationInFrames={light - drivers}><Shot src="ui/09c-drivers.png" spot={[{ at: 0, x: 648, y: 296, w: 346, h: 78, o: 0 }, { at: 8, o: 1 }]} /></Sequence>
      <Sequence from={light} durationInFrames={end - light}><Shot src="ui/01-overview.png" /></Sequence>
      <Sequence from={end}><EndCard base={end} /></Sequence>
      <LaneWipe at={end} />
      <Sequence durationInFrames={end}><SceneLabel n={9} text="Taste" /><CornerBug /></Sequence>
      <Captions id={ID} />
    </AbsoluteFill>
  )
}
