// Captures the Controlane screens (port 3000) for the video.
// Read only: it opens pages and scrolls. It does not change the control room clock or any card.
// Usage: node scripts/capture.mjs [name]
import { chromium } from "playwright-core"

const APP = "http://localhost:3000"
const only = process.argv[2]

// [file, url, options]. `scrollTo` scrolls the main pane so that the text sits near the top.
const SHOTS = [
  ["01-overview", `${APP}/overview`],
  ["02-decisions-queue", `${APP}/decisions`, { scrollTo: "Decision queue", offset: 330 }],
  ["03-decision-card-cd-420055", `${APP}/decisions/card-2cff6162d3`],
  ["03b-decision-models-cd-420055", `${APP}/decisions/card-2cff6162d3`, { scrollTo: "How the decision models checked it", offset: 120 }],
  ["04-rejected-card-cd-420603", `${APP}/decisions/card-97f57aab75`],
  ["04b-labeling-cd-420603", `${APP}/label`],
  ["05-live-map", `${APP}/live`],
  ["06b-late-card-cd-420145", `${APP}/decisions/card-a145e590be`],
  ["07-checks-and-evals", `${APP}/evals`],
  ["08-agent-traces", `${APP}/traces`],
  ["09-order-cd-420458", `${APP}/orders/CD-420458`],
  ["09b-inbox", `${APP}/inbox`],
  ["09c-drivers", `${APP}/drivers`],
]

const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" })
for (const [name, url, opt = {}] of SHOTS) {
  if (only && name !== only) continue
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: opt.dark ? "dark" : "light" })
  await context.addInitScript((dark) => { try { localStorage.setItem("theme", dark ? "dark" : "light") } catch {} }, !!opt.dark)
  const page = await context.newPage()
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(2500)
  // Hide the Next.js dev badge.
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" })
  if (opt.scrollTo) {
    await page.evaluate(({ text, offset }) => {
      const el = [...document.querySelectorAll("h1,h2,h3,h4,p,div,span")].find((e) => e.childElementCount === 0 && e.textContent?.trim() === text)
      if (!el) return
      let box = el.parentElement
      while (box && !(box.scrollHeight > box.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement
      const scroller = box ?? document.scrollingElement
      const top = el.getBoundingClientRect().top - (box ? box.getBoundingClientRect().top : 0)
      scroller.scrollTop += top - offset
    }, { text: opt.scrollTo, offset: opt.offset ?? 100 })
    await page.waitForTimeout(800)
  }
  await page.screenshot({ path: new URL(`../public/ui/${name}.png`, import.meta.url).pathname })
  console.log(name)
  await context.close()
}
await browser.close()
