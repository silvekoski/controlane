import beatsJson from "./data/beats.json"
import timingJson from "./data/vo-timing.json"
import { FPS } from "./theme"

type Word = { w: string; start: number; end: number }
const timing = timingJson as Record<string, { duration: number; words: Word[] }>
export const TRANSITION = 8
export const PAD = 3 // frames of air after each spoken beat
export const TAIL = 8 // frames at the end of each scene, covered by the transition
const SILENT: Record<string, number> = { "12-03": 60 }

export type Beat = { id: string; text: string | null; start: number; frames: number }

const byScene: Record<number, Beat[]> = {}
let cursor: Record<number, number> = {}
for (const b of beatsJson as { id: string; text: string | null }[]) {
  const n = parseInt(b.id.slice(0, 2), 10)
  const t = timing[b.id]
  const frames = b.text ? Math.ceil((t?.duration ?? 3) * FPS) + PAD : (SILENT[b.id] ?? 22)
  const start = cursor[n] ?? 0
  ;(byScene[n] ??= []).push({ id: b.id, text: b.text, start, frames })
  cursor[n] = start + frames
}

export const sceneBeats = (n: number) => byScene[n]
export const sceneFrames = (n: number) => cursor[n] + TAIL
export const SCENE_NUMBERS = Object.keys(byScene).map(Number).sort((a, b) => a - b)

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, "")

/** Timing helpers for one scene. `at("03")` is the frame a beat starts; `cue("03", "word")` is the frame that word is spoken. */
export const sceneTiming = (n: number) => {
  const beats = byScene[n]
  const prefix = String(n).padStart(2, "0")
  const find = (k: string) => beats.find((b) => b.id === `${prefix}-${k.padStart(2, "0")}`)!
  return {
    beats,
    at: (k: string) => find(k).start,
    end: (k: string) => find(k).start + find(k).frames,
    len: (k: string) => find(k).frames,
    cue: (k: string, word: string, nth = 0) => {
      const b = find(k)
      const words = timing[b.id]?.words ?? []
      const hits = words.filter((w) => norm(w.w).startsWith(norm(word)))
      const hit = hits[nth]
      return b.start + (hit ? Math.round(hit.start * FPS) : Math.round(b.frames * 0.4))
    },
  }
}
export type SceneTiming = ReturnType<typeof sceneTiming>

/** First frame of a scene in the full video (scenes overlap by TRANSITION frames). */
export const sceneStart = (n: number) => {
  let start = 0
  for (const k of SCENE_NUMBERS) {
    if (k === n) return start
    start += sceneFrames(k) - TRANSITION
  }
  return start
}
