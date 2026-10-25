import type { ReactNode } from "react"
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion"
import { IdeaTitle, ScoreStrip } from "../components"
import { IDEAS } from "../data/ideas"
import { sceneBeats, sceneFrames, type SceneTiming } from "../timing"
import { C, CARD_SHADOW, F, TONE, type ToneName } from "../theme"
import { SNAPPY, useSpr } from "../motion"

/** Background, voiceover audio for every beat, and a slow camera push. */
export const SceneShell = ({ n, dark, children }: { n: number; dark?: boolean; children: ReactNode }) => {
  return (
    <AbsoluteFill style={{ background: dark ? C.ink : C.birch, overflow: "hidden" }}>
      {sceneBeats(n).map((b) => b.text && (
        <Sequence key={b.id} from={b.start} durationInFrames={b.frames}>
          <Audio src={staticFile(`vo/${b.id}.mp3`)} />
        </Sequence>
      ))}
      <AbsoluteFill>{children}</AbsoluteFill>
    </AbsoluteFill>
  )
}

/** Idea scene frame: title slam, tuck to the corner, score strip at the end. */
export const IdeaFrame = ({ idea, T, scoreAt, children }: { idea: number; T: SceneTiming; scoreAt: number; children: ReactNode }) => {
  const d = IDEAS[idea - 1]
  return (
    <SceneShell n={idea + 3}>
      {children}
      <IdeaTitle n={d.n} name={d.name} tags={d.tags} sub={d.sub} tuckAt={T.at("02")} />
      <ScoreStrip scores={d.scores} at={scoreAt} />
    </SceneShell>
  )
}

export const Label = ({ x, y, children, size = 28, color = C.brown, w, align = "left", weight = 500 }: { x: number; y: number; children: ReactNode; size?: number; color?: string; w?: number; align?: "left" | "center" | "right"; weight?: number }) => (
  <div style={{ position: "absolute", left: x, top: y, width: w, textAlign: align, fontFamily: F.body, fontSize: size, color, fontWeight: weight }}>{children}</div>
)
