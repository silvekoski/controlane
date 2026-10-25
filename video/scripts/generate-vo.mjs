// Generates one mp3 per beat with ElevenLabs, plus word timings and durations.
// Usage: ELEVENLABS_API_KEY=... node scripts/generate-vo.mjs [sceneNumber]
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { execFileSync } from "node:child_process"

const KEY = process.env.ELEVENLABS_API_KEY
if (!KEY) throw new Error("Set ELEVENLABS_API_KEY")
const VOICE = process.env.ELEVENLABS_VOICE ?? "lFlVeySAnvqZnJlprb7g"
const MODEL = process.env.ELEVENLABS_MODEL ?? "eleven_v4"
const only = process.argv[2]

const beats = JSON.parse(await readFile(new URL("../src/data/beats.json", import.meta.url)))
const timingPath = new URL("../src/data/vo-timing.json", import.meta.url)
let timing = {}
try { timing = JSON.parse(await readFile(timingPath)) } catch {}
await mkdir(new URL("../public/vo/", import.meta.url), { recursive: true })

const spoken = beats.filter((b) => b.text)
for (const [k, b] of spoken.entries()) {
  if (only && !b.id.startsWith(only.padStart(2, "0"))) continue
  const body = { text: b.text, model_id: MODEL, previous_text: spoken[k - 1]?.text, next_text: spoken[k + 1]?.text }
  let res
  for (const settings of [{ stability: 0.6, similarity_boost: 0.8, speed: 1.15 }, { stability: 0.6, similarity_boost: 0.8 }, undefined]) {
    res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": KEY, "content-type": "application/json" },
      body: JSON.stringify({ ...body, ...(settings && { voice_settings: settings }) }),
    })
    if (res.ok) break
    const err = await res.text()
    console.warn(`  ${b.id} attempt failed (${res.status}): ${err.slice(0, 160)}`)
  }
  if (!res.ok) throw new Error(`Failed on ${b.id}`)
  const json = await res.json()
  const file = new URL(`../public/vo/${b.id}.mp3`, import.meta.url)
  await writeFile(file, Buffer.from(json.audio_base64, "base64"))
  const duration = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file.pathname]).toString())
  // Group characters into words.
  const a = json.alignment ?? json.normalized_alignment
  const words = []
  let cur = null
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) { cur = null; return }
    if (!cur) { cur = { w: "", start: a.character_start_times_seconds[i], end: 0 }; words.push(cur) }
    cur.w += ch
    cur.end = a.character_end_times_seconds[i]
  })
  timing[b.id] = { duration, words }
  console.log(b.id, duration.toFixed(2) + "s")
  await writeFile(timingPath, JSON.stringify(timing, null, 1))
}
