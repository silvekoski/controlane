import type { ComponentType } from "react"
import { AbsoluteFill } from "remotion"
import { TransitionSeries, linearTiming } from "@remotion/transitions"
import { slide } from "@remotion/transitions/slide"
import { SCENE_NUMBERS, TRANSITION, sceneFrames } from "./timing"
import { CaseCorner } from "./CaseCorner"
import { Scene01, Scene02, Scene03 } from "./scenes/s01-03"
import { Scene04, Scene05, Scene06 } from "./scenes/s04-06"
import { Scene07, Scene08, Scene09 } from "./scenes/s07-09"
import { Scene10, Scene11, Scene12 } from "./scenes/s10-12"
import { C } from "./theme"

export const SCENES: Record<number, ComponentType> = { 1: Scene01, 2: Scene02, 3: Scene03, 4: Scene04, 5: Scene05, 6: Scene06, 7: Scene07, 8: Scene08, 9: Scene09, 10: Scene10, 11: Scene11, 12: Scene12 }
const Missing = () => <AbsoluteFill style={{ background: C.canvas }} />

export const totalFrames = () => SCENE_NUMBERS.reduce((a, n) => a + sceneFrames(n), 0) - TRANSITION * (SCENE_NUMBERS.length - 1)

export const Video = () => (
  <AbsoluteFill>
  <TransitionSeries>
    {SCENE_NUMBERS.flatMap((n, i) => {
      const Comp = SCENES[n] ?? Missing
      const items = [
        <TransitionSeries.Sequence key={`s${n}`} durationInFrames={sceneFrames(n)}><Comp /></TransitionSeries.Sequence>,
      ]
      if (i < SCENE_NUMBERS.length - 1) {
        items.push(<TransitionSeries.Transition key={`t${n}`} presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: TRANSITION })} />)
      }
      return items
    })}
  </TransitionSeries>
  <CaseCorner />
  </AbsoluteFill>
)
