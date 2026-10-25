// Masters the render: -14 LUFS integrated, true peak under -1 dBTP, AAC 48 kHz. It copies the video stream.
// Usage: node scripts/master.mjs [in] [out]
import { execFileSync } from "node:child_process"

const input = process.argv[2] ?? "out/controlane-demo-raw.mp4"
const output = process.argv[3] ?? "out/controlane-demo.mp4"
const target = "I=-14:TP=-1.5:LRA=11"

/** Measures loudness with ffmpeg's loudnorm filter and returns its JSON report. */
const measure = (file) => JSON.parse(execFileSync("sh", ["-c", `ffmpeg -hide_banner -i "${file}" -af loudnorm=${target}:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p'`]).toString())

// Pass 1 measures. Pass 2 applies the measured values.
const m = measure(input)
const filter = `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`
execFileSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", "-i", input, "-c:v", "copy", "-af", filter, "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-movflags", "+faststart", output], { stdio: "inherit" })

const r = measure(output)
console.log(`Input ${m.input_i} LUFS, ${m.input_tp} dBTP -> output ${r.input_i} LUFS, ${r.input_tp} dBTP`)
console.log(`Wrote ${output}`)
