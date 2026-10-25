import React from "react"
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile } from "remotion"
import { LaneWipe } from "./components"
import { C } from "./lib/tokens"
import { cue, scene, SCENES, speechRanges, TOTAL_FRAMES } from "./lib/timing"
import { S1 } from "./scenes/S1"
import { S2 } from "./scenes/S2"
import { S3 } from "./scenes/S3"
import { S4 } from "./scenes/S4"
import { S5 } from "./scenes/S5"
import { S6 } from "./scenes/S6"
import { S7 } from "./scenes/S7"
import { S8 } from "./scenes/S8"
import { S9 } from "./scenes/S9"

export const SCENE_COMPONENTS: Record<string, React.FC> = {
  "01-cold-open": S1, "02-title": S2, "03-most-orders-fine": S3, "04-decision-card": S4, "05-rejections-become-evals": S5,
  "06-stop-check-agent": S6, "07-bahnator": S7, "08-how-i-built-it": S8, "09-close": S9,
}

// Sound cues: [file, scene, scene-local frame, volume]. No cue sits on a spoken number.
const at = (id: string, word: string, n = 0, shift = 0) => cue(id, word, n) + shift
const SFX: [string, string, number, number][] = [
  ["01-sub-swell", "01-cold-open", 0, 0.5],
  ["02-route-ticks", "01-cold-open", at("01-cold-open", "twenty-five", 0, -8), 0.18],
  ["03-alert-pings", "01-cold-open", at("01-cold-open", "something"), 0.25],
  ["04-logo-whoosh", "02-title", 6, 0.4],
  ["06-marbles-settle", "03-most-orders-fine", 8, 0.25],
  ["07-focus-ping", "03-most-orders-fine", at("03-most-orders-fine", "keeps", 0, -12), 0.3],
  ["05-glass-click", "03-most-orders-fine", at("03-most-orders-fine", "sorted", 0, 84), 0.35],
  ["08-chip-pop", "04-decision-card", at("04-decision-card", "agent's"), 0.25],
  ["08-chip-pop", "04-decision-card", at("04-decision-card", "order"), 0.25],
  ["08-chip-pop", "04-decision-card", at("04-decision-card", "ops"), 0.25],
  ["09-caution-chime", "04-decision-card", at("04-decision-card", "traps"), 0.25],
  ["05-glass-click", "04-decision-card", at("04-decision-card", "reject", 0, 6), 0.35],
  ["11-card-flip", "05-rejections-become-evals", at("05-rejections-become-evals", "it", 0, -4), 0.35],
  ["05-glass-click", "05-rejections-become-evals", at("05-rejections-become-evals", "Your", 0, 4), 0.35],
  ["12-engine-off", "06-stop-check-agent", at("06-stop-check-agent", "stands", 0, -10), 0.22],
  ["13-radar-sweep", "06-stop-check-agent", at("06-stop-check-agent", "places"), 0.22],
  ["14-sort-ticks", "06-stop-check-agent", at("06-stop-check-agent", "ranks"), 0.25],
  ["15-message-out", "06-stop-check-agent", at("06-stop-check-agent", "asks", 0, -6), 0.3],
  ["04-logo-whoosh", "09-close", at("09-close", "Control", 0, -8), 0.3],
  ["16-gpu-hum", "07-bahnator", at("07-bahnator", "winning", 0, -6), 0.2],
  ["17-counter-stop", "07-bahnator", at("07-bahnator", "thirty-three", 1, -42), 0.12],
  ["05-glass-click", "08-how-i-built-it", at("08-how-i-built-it", "Claude"), 0.25],
  ["05-glass-click", "08-how-i-built-it", at("08-how-i-built-it", "Pi"), 0.25],
  ["05-glass-click", "08-how-i-built-it", at("08-how-i-built-it", "harness"), 0.25],
  ["05-glass-click", "08-how-i-built-it", at("08-how-i-built-it", "Gemini"), 0.25],
  ["05-glass-click", "08-how-i-built-it", at("08-how-i-built-it", "Dribbble"), 0.2],
  ["05-glass-click", "08-how-i-built-it", at("08-how-i-built-it", "cross"), 0.25],
  ["18-final-hit", "09-close", at("09-close", "Control", 0, -10), 0.4],
]

// Music: about -12 dB under speech, with a 150 ms attack, and fades at both ends.
const BED = 0.26
const DUCKED = 0.065
const musicVolume = (f: number) => {
  let gap = 99
  for (const [a, b] of speechRanges) {
    if (f >= a - 5 && f <= b + 4) { gap = 0; break }
    gap = Math.min(gap, f < a - 5 ? a - 5 - f : f - b - 4)
  }
  const duck = interpolate(gap, [0, 12], [DUCKED, BED], { extrapolateRight: "clamp" })
  const edges = Math.min(interpolate(f, [0, 60], [0, 1], { extrapolateRight: "clamp" }), interpolate(f, [TOTAL_FRAMES - 100, TOTAL_FRAMES - 10], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))
  return duck * edges
}

export const Video: React.FC = () => (
  <AbsoluteFill style={{ background: C.canvas }}>
    {SCENES.map((s) => {
      const Scene = SCENE_COMPONENTS[s.id]
      return (
        <Sequence key={s.id} from={s.from} durationInFrames={s.frames} name={s.id}>
          <Scene />
          <Sequence from={s.lead} name={`vo ${s.id}`}><Audio src={staticFile(`vo/${s.id}.mp3`)} /></Sequence>
        </Sequence>
      )
    })}
    {SFX.map(([file, id, f, volume], i) => (
      <Sequence key={i} from={scene(id).from + f} name={`sfx ${file}`}><Audio src={staticFile(`sfx/${file}.mp3`)} volume={volume} /></Sequence>
    ))}
    <Audio src={staticFile("music/bed.mp3")} volume={musicVolume} />
    {/* The lane wipe at every scene cut except the first, where the alerts fold into the logo. */}
    {SCENES.slice(2).map((s) => <LaneWipe key={s.id} at={s.from} />)}
  </AbsoluteFill>
)
