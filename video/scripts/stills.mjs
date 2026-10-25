// Usage: node scripts/stills.mjs Scene1:80 Scene2:300 ...   (writes out/stills/<scene>-<frame>.png)
import { bundle } from "@remotion/bundler"
import { renderStill, selectComposition } from "@remotion/renderer"
import { mkdir } from "node:fs/promises"

const browserExecutable = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const serveUrl = await bundle({ entryPoint: new URL("../src/index.ts", import.meta.url).pathname })
await mkdir("out/stills", { recursive: true })
for (const spec of process.argv.slice(2)) {
  const [id, frame] = spec.split(":")
  const composition = await selectComposition({ serveUrl, id, browserExecutable })
  await renderStill({ composition, serveUrl, frame: Number(frame), output: `out/stills/${id}-${frame}.png`, browserExecutable })
  console.log("ok", spec)
}
