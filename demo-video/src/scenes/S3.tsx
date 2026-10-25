import React from "react"
import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion"
import { Captions, Chip, CornerBug, LaneWipe, SceneLabel, Shot } from "../components"
import { C, F } from "../lib/tokens"
import { cue } from "../lib/timing"
import { ease, POP } from "../lib/motion"
import { room } from "../lib/metrics"

const ID = "03-most-orders-fine"
// The four open decisions in the queue when the screens were captured.
const OPEN = [
  { title: "Claim photo shows a scrape on the left rear", ref: "CD-420055", due: "Overdue" },
  { title: "Delivery photos show no car, no CMR signature", ref: "CD-420612", due: "Overdue" },
  { title: "Overnight ferry sold out, BMW import", ref: "CD-420299", due: "Overdue" },
  { title: "Porsche 4 days past its delivery window", ref: "CD-420145", due: "1 h 22 min left" },
]

/** 100 orders fall in. Closed ones drift aside, active ones settle in a quiet tray, and the decisions lift out. */
const Funnel: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const cols = 14, cw = 34, ch = 22, gap = 8
  const trayX = 520, trayY = 430, trayW = cols * (cw + gap) + 40
  const pileX = 1330, pileY = 470
  const lift = cue(ID, "keeps") - 12
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: trayX, top: trayY, width: trayW, height: 6 * (ch + gap) + 60, borderRadius: 18, background: C.okSoft, boxShadow: `inset 0 0 0 1.5px #bfe8d8`, opacity: ease(frame, 10, 30) }} />
      <div style={{ position: "absolute", left: trayX, top: trayY + 6 * (ch + gap) + 76, width: trayW, textAlign: "center", fontFamily: F.sans, fontSize: 26, fontWeight: 500, color: "#0f7a53", opacity: ease(frame, 40, 56) }}>On track: agents handle these</div>
      <div style={{ position: "absolute", left: pileX - 30, top: pileY + 4 * (ch + gap) + 40, width: 260, textAlign: "center", fontFamily: F.sans, fontSize: 22, color: C.muted, opacity: ease(frame, 40, 56) }}>Delivered or cancelled</div>
      {Array.from({ length: room.orders }).map((_, i) => {
        const isClosed = (k: number) => k % 4 === 1 && k < 92 // 23 of 100
        const closed = isClosed(i)
        const p = spring({ frame: frame - 4 - (i % 25) - Math.floor(i / 25) * 3, fps, config: { damping: 15, stiffness: 110, mass: 0.8 } })
        const startX = 560 + (i % 20) * 42, startY = -60 - Math.floor(i / 20) * 40
        // Closed cards stack in a small pile at the right. Active cards fill the tray row by row.
        const closedIndex = Array.from({ length: i }).filter((__, k) => isClosed(k)).length
        const activeIndex = i - closedIndex
        const tx = closed ? pileX + (closedIndex % 5) * (cw + 6) : trayX + 20 + (activeIndex % cols) * (cw + gap)
        const ty = closed ? pileY + Math.floor(closedIndex / 5) * (ch + 6) : trayY + 20 + Math.floor(activeIndex / cols) * (ch + gap)
        const x = startX + (tx - startX) * p, y = startY + (ty - startY) * p
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: cw, height: ch, borderRadius: 5, background: closed ? C.greySoft : "#fff", boxShadow: closed ? "none" : `inset 0 0 0 1.5px #a7dcc8`, transform: `rotate(${(1 - p) * ((i % 7) - 3) * 8}deg)` }} />
      })}
      {OPEN.map((o, i) => {
        const p = spring({ frame: frame - lift - i * 6, fps, config: POP })
        const y = trayY + 40 - p * 250
        return (
          <div key={o.ref} style={{ position: "absolute", left: 300 + i * 340, top: y - 70, width: 320, opacity: Math.min(1, p * 2), transform: `scale(${0.6 + 0.4 * p})`, transformOrigin: "50% 100%" }}>
            <div style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", boxShadow: `0 0 0 1px ${C.border}, 0 16px 30px -14px rgba(24,24,27,0.25)` }}>
              <Chip tone="danger" size={16}>{o.due}</Chip>
              <div style={{ marginTop: 10, fontFamily: F.sans, fontSize: 19, fontWeight: 600, lineHeight: 1.25, color: C.ink }}>{o.title}</div>
              <div style={{ marginTop: 6, fontFamily: F.mono, fontSize: 14, color: C.muted }}>{o.ref}</div>
            </div>
          </div>
        )
      })}
      <div style={{ position: "absolute", left: 0, right: 0, top: 80, textAlign: "center", fontFamily: F.sans, fontSize: 28, fontWeight: 600, color: C.ink, opacity: ease(frame, lift + 20, lift + 34) }}>These need a person</div>
    </AbsoluteFill>
  )
}

export const S3: React.FC = () => {
  const toOverview = cue(ID, "Seventy-five") - 8
  const toQueue = cue(ID, "Four") - 6
  const sorted = cue(ID, "sorted")
  return (
    <AbsoluteFill style={{ background: C.canvas }}>
      <Sequence durationInFrames={toOverview}><Funnel /></Sequence>
      <Sequence from={toOverview} durationInFrames={toQueue - toOverview}>
        <Shot src="ui/01-overview.png" cam={[{ at: 0 }, { at: 30, z: 1.25, cx: 560, cy: 160 }, { at: cue(ID, "active") - toOverview, z: 1.1, cx: 600, cy: 330 }]}
          spot={[{ at: 0, x: 276, y: 111, w: 542, h: 32, o: 0 }, { at: 6, o: 1 }, { at: cue(ID, "active") - toOverview + 8, x: 286, y: 158, w: 264, h: 372 }]} />
      </Sequence>
      <Sequence from={toQueue}>
        <Shot src="ui/02-decisions-queue.png" cam={[{ at: 0, z: 1 }]}
          spot={[{ at: 0, x: 304, y: 494, w: 100, h: 320, o: 0 }, { at: 14, o: 1 }, { at: sorted - toQueue, x: 296, y: 376, w: 300, h: 56 }, { at: sorted - toQueue + 40, x: 302, y: 490, w: 1086, h: 98 }]}
          pointer={[{ at: 0, x: 1100, y: 820 }, { at: sorted - toQueue + 30, x: 640, y: 528 }]} clicks={[sorted - toQueue + 84]} />
      </Sequence>
      <LaneWipe at={toOverview} />
      <LaneWipe at={toQueue} />
      <SceneLabel n={3} text="The control room" />
      <CornerBug />
      <Captions id={ID} />
    </AbsoluteFill>
  )
}
