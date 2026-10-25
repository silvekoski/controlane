import React from "react"
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion"
import { Captions, Card, CornerBug, SceneLabel, Shot } from "../components"
import { C, F, WIN } from "../lib/tokens"
import { cue } from "../lib/timing"
import { DEEP, ease, POP } from "../lib/motion"

const ID = "05-rejections-become-evals"
const TOO_EARLY = { x: 477, y: 833 } // centre of the "Too early" answer on the labeling page

export const S5: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const flipAt = cue(ID, "it") - 6
  const flip = spring({ frame: frame - flipAt, fps, config: DEEP, durationInFrames: 34 })
  const angle = flip * 180
  const tap = cue(ID, "Your") + 4
  const flyAt = tap + 10
  const fly = ease(frame, flyAt, flyAt + 26)
  const land = spring({ frame: frame - flyAt - 26, fps, config: POP })
  // The token flies from the answer to the eval stack in the right gutter.
  const from = { x: WIN.x + TOO_EARLY.x, y: WIN.y + TOO_EARLY.y }
  const to = { x: 1792, y: 640 }
  const tx = from.x + (to.x - from.x) * fly
  const ty = from.y + (to.y - from.y) * fly - Math.sin(fly * Math.PI) * 180
  return (
    <AbsoluteFill style={{ background: C.canvas }}>
      <div style={{ position: "absolute", inset: 0, perspective: 2000 }}>
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: `rotateY(${angle}deg)`, transformOrigin: "50% 45%", opacity: angle < 90 ? 1 : 0 }}>
          <Shot src="ui/04-rejected-card-cd-420603.png"
            spot={[{ at: 0, x: 276, y: 72, w: 960, h: 70, o: 0 }, { at: cue(ID, "rejects") - 6, o: 1 }, { at: cue(ID, "card"), x: 864, y: 559, w: 534, h: 106 }]} />
        </div>
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: `rotateY(${angle - 180}deg)`, transformOrigin: "50% 45%", opacity: angle >= 90 ? 1 : 0 }}>
          <Shot src="ui/04b-labeling-cd-420603.png"
            spot={[{ at: 0, x: 296, y: 170, w: 724, h: 56, o: 0 }, { at: cue(ID, "labeling"), o: 1 }, { at: cue(ID, "case") + 10, x: 296, y: 674, w: 724, h: 56 }, { at: tap - 8, x: 296, y: 799, w: 362, h: 68 }]}
            pointer={[{ at: 0, x: 900, y: 1000 }, { at: cue(ID, "case"), x: TOO_EARLY.x, y: TOO_EARLY.y + 4 }]} clicks={[tap]} />
        </div>
      </div>

      {/* The eval stack in the right gutter. */}
      <div style={{ position: "absolute", left: 1700, top: 560, width: 184, opacity: ease(frame, flyAt - 20, flyAt) }}>
        {[2, 1, 0].map((k) => <div key={k} style={{ position: "absolute", left: k * 6, top: 40 - k * 6, width: 172, height: 110, borderRadius: 12, background: "#fff", boxShadow: `0 0 0 1px ${C.border}` }} />)}
        <Card style={{ position: "absolute", left: 0, top: 40, width: 172, height: 110, padding: "14px 16px", transform: `scale(${1 + 0.06 * Math.sin(Math.min(1, land) * Math.PI)})` }}>
          <div style={{ fontFamily: F.sans, fontSize: 17, color: C.muted }}>Eval cases</div>
          <div style={{ marginTop: 6, fontFamily: F.mono, fontSize: 40, fontWeight: 600, color: C.accent }}>{frame >= flyAt + 26 ? "+1" : "0"}</div>
        </Card>
      </div>
      {frame >= flyAt && fly < 1 && <div style={{ position: "absolute", left: tx - 14, top: ty - 14, width: 28, height: 28, borderRadius: 99, background: C.accent, boxShadow: `0 0 0 6px ${C.accent}33` }} />}

      <SceneLabel n={5} text="The control room">
        <div style={{ marginTop: 24, fontFamily: F.sans, fontSize: 18, lineHeight: 1.35, color: C.accent, fontWeight: 500, opacity: ease(frame, cue(ID, "judgement"), cue(ID, "judgement") + 14) }}>From people's heads to evals</div>
      </SceneLabel>
      <CornerBug />
      <Captions id={ID} />
    </AbsoluteFill>
  )
}
