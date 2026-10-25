import React from "react"
import { AbsoluteFill, Img, staticFile } from "remotion"
import { BahnLogo, ControlaneLogo } from "./components"
import { C, F } from "./lib/tokens"
import { room } from "./lib/metrics"

/** The YouTube thumbnail, 1280 x 720. Big type on the left, the real decision queue tilted on the right. */
export const Thumbnail: React.FC = () => (
  <AbsoluteFill style={{ background: C.canvas, overflow: "hidden" }}>
    <div style={{ position: "absolute", right: -220, top: -160, width: 900, height: 900, borderRadius: 999, background: `radial-gradient(circle, ${C.accent}33, transparent 65%)` }} />
    {/* The decision queue with its four open cards, in a window. */}
    <div style={{ position: "absolute", left: 700, top: 140, perspective: 1400 }}>
      <div style={{ width: 760, height: 470, borderRadius: 18, overflow: "hidden", transform: "rotateY(-16deg) rotateX(4deg)", transformOrigin: "0 50%",
        boxShadow: `0 0 0 1px ${C.border}, 0 40px 80px -30px rgba(24,24,27,0.35)`, background: "#fff" }}>
        <Img src={staticFile("ui/02-decisions-queue.png")} style={{ position: "absolute", left: -300 * 0.9, top: -366 * 0.9, width: 1440 * 0.9, height: 900 * 0.9, maxWidth: "none" }} />
      </div>
    </div>
    <ControlaneLogo height={58} style={{ position: "absolute", left: 64, top: 70 }} />
    <div style={{ position: "absolute", left: 64, top: 190, fontFamily: F.sans, fontWeight: 750, letterSpacing: "-0.045em", lineHeight: 0.98 }}>
      <div style={{ fontSize: 102, color: C.ink }}>{room.active} orders.</div>
      <div style={{ fontSize: 102, color: C.accent }}>{room.decisions} need you.</div>
    </div>
    <div style={{ position: "absolute", left: 64, top: 470, width: 540, fontFamily: F.sans, fontSize: 32, fontWeight: 500, lineHeight: 1.25, color: C.ink }}>An AI control room for car delivery</div>
    <div style={{ position: "absolute", left: 64, bottom: 54, display: "flex", alignItems: "center", gap: 14 }}>
      <BahnLogo height={24} color={C.muted} />
      <span style={{ fontFamily: F.sans, fontSize: 24, color: C.muted }}>hackathon · Prompt Operations 2026</span>
    </div>
  </AbsoluteFill>
)
