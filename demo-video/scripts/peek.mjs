import { chromium } from "playwright-core"
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" })
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
for (const [name, url] of process.argv.slice(2).map((a) => a.split("="))) {
  await p.goto(url, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {})
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `/private/tmp/claude-501/-Users-veikka-car-delivery-control-room/9e6fcd59-2849-4fc8-b586-d1e1dd89b82b/scratchpad/${name}.png` })
}
await b.close()
