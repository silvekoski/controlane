import React from "react"
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion"
import { Captions, Chip, CornerBug, Crop, SceneLabel, Shot } from "../components"
import { C, F } from "../lib/tokens"
import { cue } from "../lib/timing"
import { DEEP, ease } from "../lib/motion"

const ID = "04-decision-card"
const SRC = "ui/03-decision-card-cd-420055-tall.png"
const IMG_H = 2000

/** The two photos from the card lift out of the page, side by side. */
const PhotoPair: React.FC<{ at: number; second: number; out: number }> = ({ at, second, out }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const cards = [
    { at, crop: [470, 450], label: "Claim photo", chip: <Chip tone="warn" size={17}>Damage is visible · flagged by Jev</Chip> },
    { at: second, crop: [470, 628], label: "Pickup photo", chip: <Chip size={17}>No damage visible at pickup</Chip> },
  ]
  const exit = ease(frame, out - 10, out)
  return (
    <div style={{ position: "absolute", left: 880, top: 395, width: 520, height: 360, perspective: 1600, opacity: 1 - exit }}>
      {cards.map((c, i) => {
        const p = spring({ frame: frame - c.at, fps, config: DEEP, durationInFrames: 36 })
        return (
          <div key={c.label} style={{ position: "absolute", left: i * 262, top: 0, width: 250, opacity: Math.min(1, p * 1.6),
            transform: `translateY(${(1 - p) * 60}px) translateZ(${(1 - p) * -200}px) rotateY(${(1 - p) * -50}deg)` }}>
            <div style={{ background: "#fff", borderRadius: 12, padding: 10, boxShadow: `0 0 0 1px ${C.border}, 0 28px 50px -20px rgba(24,24,27,0.35)` }}>
              <div style={{ position: "relative", width: 230, height: 230, borderRadius: 8, overflow: "hidden" }}>
                <Crop src={SRC} imgH={IMG_H} x={c.crop[0]} y={c.crop[1]} w={54} h={54} top={0} left={0} scale={230 / 54} />
              </div>
              <div style={{ marginTop: 10, fontFamily: F.sans, fontSize: 19, fontWeight: 600, color: C.ink }}>{c.label}</div>
              <div style={{ marginTop: 8 }}>{c.chip}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export const S4: React.FC = () => {
  const every = cue(ID, "Every")
  const before = cue(ID, "Before")
  const approve = cue(ID, "Approve", 1)
  const reject = cue(ID, "reject")
  return (
    <AbsoluteFill style={{ background: C.canvas }}>
      <Shot src={SRC} imgH={IMG_H}
        cam={[
          { at: 0, z: 1, sy: 0 },
          { at: every, sy: 150 },
          { at: before, sy: 300 },
        ]}
        spot={[
          { at: 0, x: 276, y: 70, w: 960, h: 108, o: 0 },
          { at: cue(ID, "question"), o: 1 },
          { at: cue(ID, "Here"), x: 302, y: 441, w: 512, h: 170 },
          { at: cue(ID, "pickup"), x: 302, y: 617, w: 512, h: 192 },
          { at: every, x: 296, y: 400, w: 524, h: 36 },
          { at: cue(ID, "agent's"), x: 664, y: 445, w: 146, h: 27 },
          { at: cue(ID, "order"), x: 688, y: 833, w: 122, h: 27 },
          { at: cue(ID, "ops"), x: 670, y: 963, w: 138, h: 27 },
          { at: cue(ID, "right"), x: 855, y: 389, w: 551, h: 385 },
          { at: cue(ID, "approves"), x: 869, y: 516, w: 137, h: 32 },
          { at: before, x: 868, y: 808, w: 525, h: 112 },
          { at: cue(ID, "traps"), x: 868, y: 930, w: 525, h: 106 },
          { at: cue(ID, "each"), x: 308, y: 512, w: 499, h: 40 },
          { at: approve, x: 862, y: 690, w: 236, h: 46 },
          { at: cue(ID, "Nothing"), x: 865, y: 735, w: 530, h: 28 },
          { at: cue(ID, "customer"), x: 869, y: 550, w: 524, h: 116 },
        ]}
        pointer={[{ at: 0, x: 1200, y: 1150 }, { at: approve - 30, x: 1150, y: 1000 }, { at: approve, x: 912, y: 716 }]}
        clicks={[reject + 6]}
      >
        <PhotoPair at={cue(ID, "scrape") - 4} second={cue(ID, "pickup")} out={every} />
      </Shot>
      <SceneLabel n={4} text="The control room" />
      <CornerBug />
      <Captions id={ID} />
    </AbsoluteFill>
  )
}
