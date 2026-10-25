import React from "react"
import { AbsoluteFill, useCurrentFrame } from "remotion"
import { AnimatedLogo, BahnLogo, Captions } from "../components"
import { BAHN, C, F } from "../lib/tokens"
import { cue } from "../lib/timing"
import { ease } from "../lib/motion"

const ID = "02-title"
const LOGO_H = 150
const LOGO_W = (LOGO_H * 1048) / 210

export const S2: React.FC = () => {
  const frame = useCurrentFrame()
  const paper = ease(frame, 0, 18, 1, 0)
  const name = ease(frame, cue(ID, "by"), cue(ID, "by") + 14)
  const url = ease(frame, cue(ID, "team"), cue(ID, "team") + 14)
  const credit = ease(frame, cue(ID, "bob"), cue(ID, "bob") + 16)
  return (
    <AbsoluteFill style={{ background: C.canvas }}>
      <AbsoluteFill style={{ background: BAHN.paper, opacity: paper }} />
      <AnimatedLogo at={2} height={LOGO_H} style={{ position: "absolute", left: (1920 - LOGO_W) / 2, top: 330 }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 330 + LOGO_H + 64, textAlign: "center" }}>
        <div style={{ fontFamily: F.sans, fontSize: 40, fontWeight: 500, color: C.ink, opacity: name, transform: `translateY(${(1 - name) * 10}px)` }}>Veikka Silvekoski · bob the builder</div>
        <div style={{ marginTop: 18, fontFamily: F.mono, fontSize: 30, color: C.accent, opacity: url, transform: `translateY(${(1 - url) * 10}px)` }}>https://controlane.bobs.build</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 860, display: "flex", justifyContent: "center", alignItems: "center", gap: 16, opacity: credit }}>
        <BahnLogo height={20} color={C.muted} />
        <span style={{ fontFamily: F.sans, fontSize: 22, color: C.muted }}>Built for Bahn's challenge · Prompt Operations Hackathon 2026</span>
      </div>
      <Captions id={ID} />
    </AbsoluteFill>
  )
}
