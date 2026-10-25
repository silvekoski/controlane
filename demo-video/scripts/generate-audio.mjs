// Generates the voiceover, sound effects and music with ElevenLabs.
// Usage: node scripts/generate-audio.mjs vo|sfx|music [id]
// Reads ELEVENLABS_API_KEY, ELEVENLABS_VOICE and ELEVENLABS_MODEL from .env.
import { readFile, writeFile, access } from "node:fs/promises"
import { execFileSync } from "node:child_process"

const env = Object.fromEntries((await readFile(new URL("../.env", import.meta.url), "utf8")).split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]))
const KEY = env.ELEVENLABS_API_KEY
const VOICE = env.ELEVENLABS_VOICE ?? "lFlVeySAnvqZnJlprb7g"
const MODEL = env.ELEVENLABS_MODEL ?? "eleven_v4"
const [mode, only] = process.argv.slice(2)
const root = (p) => new URL(`../${p}`, import.meta.url)
const exists = (p) => access(p).then(() => true, () => false)
const duration = (file) => parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file.pathname]).toString())

async function post(path, body) {
  const res = await fetch(`https://api.elevenlabs.io${path}`, { method: "POST", headers: { "xi-api-key": KEY, "content-type": "application/json" }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`${path} ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return res
}

if (mode === "vo") {
  const lines = JSON.parse(await readFile(root("scripts/vo.json")))
  const timingPath = root("src/lib/vo-timing.json")
  const timing = (await exists(timingPath)) ? JSON.parse(await readFile(timingPath)) : {}
  for (const [k, line] of lines.entries()) {
    if (only && line.id !== only) continue
    const text = line.say.replaceAll(" | ", " ")
    const base = { text, model_id: MODEL, previous_text: lines[k - 1]?.say.replaceAll(" | ", " "), next_text: lines[k + 1]?.say.replaceAll(" | ", " ") }
    const settings = { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true, speed: 1.05 }
    let res
    // Some models reject context fields or some settings. Fall back step by step and say which body worked.
    for (const [name, body] of [["full", { ...base, voice_settings: settings }], ["no context", { text, model_id: MODEL, voice_settings: settings }], ["defaults", { text, model_id: MODEL }]]) {
      try { res = await post(`/v1/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_192`, body); console.log(`  ${line.id}: ${name}`); break }
      catch (e) { console.warn(`  ${line.id} ${name} failed: ${e.message}`) }
    }
    if (!res) throw new Error(`No voiceover for ${line.id}`)
    const json = await res.json()
    const file = root(`public/vo/${line.id}.mp3`)
    await writeFile(file, Buffer.from(json.audio_base64, "base64"))
    const a = json.alignment ?? json.normalized_alignment
    const words = []
    let cur = null
    a.characters.forEach((ch, i) => {
      if (/\s/.test(ch)) { cur = null; return }
      if (!cur) { cur = { w: "", start: a.character_start_times_seconds[i], end: 0 }; words.push(cur) }
      cur.w += ch
      cur.end = a.character_end_times_seconds[i]
    })
    timing[line.id] = { duration: duration(file), words }
    console.log(line.id, timing[line.id].duration.toFixed(2) + "s")
    await writeFile(timingPath, JSON.stringify(timing, null, 1))
  }
}

if (mode === "sfx") {
  const list = JSON.parse(await readFile(root("scripts/sfx.json")))
  for (const s of list) {
    if (only && s.id !== only) continue
    const res = await post("/v1/sound-generation?output_format=mp3_44100_192", { text: s.prompt, duration_seconds: s.seconds, prompt_influence: 0.6 })
    await writeFile(root(`public/sfx/${s.id}.mp3`), Buffer.from(await res.arrayBuffer()))
    console.log(s.id, "ok")
  }
}

if (mode === "music") {
  const prompt = "Minimal modern electronic, 100 BPM, warm analog synth pulse, no vocals, calm and confident. Sparse intro, soft kick enters at 0:19, a small lift at 1:14, a bigger lift at 2:02, a calmer section from 3:19, resolves on a warm chord at 4:01, then a calm tail to 4:20."
  const res = await post("/v1/music?output_format=mp3_44100_192", { prompt, music_length_ms: 260000, force_instrumental: true })
  await writeFile(root("public/music/bed.mp3"), Buffer.from(await res.arrayBuffer()))
  console.log("music", duration(root("public/music/bed.mp3")).toFixed(1) + "s")
}
