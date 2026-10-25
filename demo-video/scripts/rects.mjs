// Captures one tall page and prints the boxes of the given texts, in CSS px.
// Usage: node scripts/rects.mjs <name> <url> <height> "text 1" "text 2" ...
import { chromium } from "playwright-core"
const [name, url, height, ...texts] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" })
const ctx = await b.newContext({ viewport: { width: 1440, height: Number(height) }, deviceScaleFactor: 2, colorScheme: "light" })
await ctx.addInitScript(() => { try { localStorage.setItem("theme", "light") } catch {} })
const p = await ctx.newPage()
await p.goto(url, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {})
await p.waitForTimeout(2500)
await p.addStyleTag({ content: "nextjs-portal{display:none!important}" })
if (name !== "-") await p.screenshot({ path: `public/ui/${name}.png` })
for (const t of texts) {
  const boxes = await p.evaluate((t) => [...document.querySelectorAll("body *")].filter((e) => e.textContent?.includes(t) && ![...e.children].some((c) => c.textContent?.includes(t))).map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] }), t)
  console.log(JSON.stringify(t), JSON.stringify(boxes.slice(0, 3)))
}
await b.close()
