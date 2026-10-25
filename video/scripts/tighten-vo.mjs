// Trims silence around each voiceover clip (using the word timestamps) and speeds it up a little,
// then rewrites the durations and word times to match. Safe to run once after generate-vo.mjs.
import { readFile, writeFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"

const TEMPO = Number(process.env.TEMPO ?? 1.12)
const path = new URL("../src/data/vo-timing.json", import.meta.url)
const timing = JSON.parse(await readFile(path))
for (const [id, t] of Object.entries(timing)) {
  if (t.tightened) continue
  const file = new URL(`../public/vo/${id}.mp3`, import.meta.url).pathname
  const lead = Math.max(0, t.words[0].start - 0.05)
  const end = Math.min(t.duration, t.words.at(-1).end + 0.18)
  const tmp = file.replace(".mp3", ".tmp.mp3")
  execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", String(lead), "-to", String(end), "-i", file, "-af", `atempo=${TEMPO}`, "-b:a", "128k", tmp])
  execFileSync("mv", [tmp, file])
  const duration = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString())
  timing[id] = { duration, tightened: true, words: t.words.map((w) => ({ w: w.w, start: Math.max(0, (w.start - lead) / TEMPO), end: (w.end - lead) / TEMPO })) }
}
await writeFile(path, JSON.stringify(timing, null, 1))
console.log("total speech", Object.values(timing).reduce((a, t) => a + t.duration, 0).toFixed(1), "s")
