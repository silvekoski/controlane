import timingJson from "./vo-timing.json"
import voJson from "../../scripts/vo.json"
import { FPS } from "./tokens"

type Word = { w: string; start: number; end: number }
const timing = timingJson as Record<string, { duration: number; words: Word[] }>
const lines = voJson as { id: string; say: string; show: string }[]

// Each scene lasts as long as its voiceover, plus a lead before the voice and a tail after it.
const LEAD: Record<string, number> = { "01-cold-open": 36, "02-title": 14 }
const TAIL: Record<string, number> = { "02-title": 24, "06-stop-check-agent": 60, "07-bahnator": 30, "09-close": 120 }
const DEFAULT_LEAD = 12
const DEFAULT_TAIL = 21

export type Scene = { id: string; from: number; frames: number; lead: number; voiceFrames: number }

export const SCENES: Scene[] = (() => {
  let from = 0
  return lines.map((l) => {
    const lead = LEAD[l.id] ?? DEFAULT_LEAD
    const voiceFrames = Math.ceil((timing[l.id]?.duration ?? 5) * FPS)
    const frames = lead + voiceFrames + (TAIL[l.id] ?? DEFAULT_TAIL)
    const s = { id: l.id, from, frames, lead, voiceFrames }
    from += frames
    return s
  })
})()

export const TOTAL_FRAMES = SCENES.reduce((n, s) => n + s.frames, 0)
export const scene = (id: string) => SCENES.find((s) => s.id === id)!

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")

/** Frame (scene local) at which a spoken word starts. `nth` picks a later repeat. Uses the phonetic text. */
export const cue = (id: string, word: string, nth = 0) => {
  const s = scene(id)
  const hits = (timing[id]?.words ?? []).filter((w) => norm(w.w).startsWith(norm(word)))
  const hit = hits[nth] ?? hits[hits.length - 1]
  if (!hit) throw new Error(`No word "${word}" in ${id}`)
  return s.lead + Math.round(hit.start * FPS)
}

/** Caption chunks with frames, scene local. The `|` breaks in the spoken and shown text line up one to one. */
export const captions = (id: string) => {
  const s = scene(id)
  const line = lines.find((l) => l.id === id)!
  const say = line.say.split(" | ")
  const show = line.show.split(" | ")
  const words = timing[id]?.words ?? []
  let k = 0
  return say.map((chunk, i) => {
    const n = chunk.split(/\s+/).filter(Boolean).length
    const first = words[k]
    const last = words[Math.min(k + n - 1, words.length - 1)]
    k += n
    return { text: show[i], from: s.lead + Math.round((first?.start ?? 0) * FPS), to: s.lead + Math.round((last?.end ?? 0) * FPS) }
  })
}

/** Global frame ranges in which someone speaks, for ducking the music. */
export const speechRanges = SCENES.flatMap((s) => captions(s.id).map((c) => [s.from + c.from, s.from + c.to] as const))
