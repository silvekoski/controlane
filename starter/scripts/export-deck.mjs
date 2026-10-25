// Export the pitch deck at /deck to a PDF, and save one PNG per slide to check for overflow.
// Run with the app on port 3000: node scripts/export-deck.mjs [out.pdf] [png-dir]
import { mkdir } from "node:fs/promises"
import puppeteer from "puppeteer-core"

const base = process.env.DECK_URL ?? "http://localhost:3000/deck"
const out = process.argv[2] ?? new URL("../../Controlane-pitch-deck.pdf", import.meta.url).pathname
const pngs = process.argv[3]

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
})
const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }])
await page.goto(`${base}?print`, { waitUntil: "networkidle0" })
await page.evaluate(() => document.fonts.ready)
await page.pdf({ path: out, width: "1920px", height: "1080px", printBackground: true })
console.log("written", out)

if (pngs) {
  await mkdir(pngs, { recursive: true })
  const slides = await page.$$(".slide")
  for (const [k, s] of slides.entries()) await s.screenshot({ path: `${pngs}/slide-${String(k + 1).padStart(2, "0")}.png` })
  console.log("screenshots in", pngs)
}
await browser.close()
