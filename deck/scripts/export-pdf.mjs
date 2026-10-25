import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { extname, join, normalize } from "node:path"
import puppeteer from "puppeteer-core"

const dist = new URL("../dist/", import.meta.url).pathname
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".woff": "font/woff" }
const server = createServer(async (req, res) => {
  let path = normalize(new URL(req.url, "http://x").pathname)
  if (path === "/") path = "/index.html"
  let file
  try {
    file = await readFile(join(dist, path))
  } catch {
    res.writeHead(404).end()
    return
  }
  res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" }).end(file)
}).listen(0, "127.0.0.1")
await new Promise((r) => server.once("listening", r))
const { port } = server.address()

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--no-sandbox"],
})
const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })
await page.goto(`http://127.0.0.1:${port}/?print`, { waitUntil: "load" })
await page.evaluate(() => document.fonts.ready)
const out = new URL("../../Bahn-solution-options-deck.pdf", import.meta.url).pathname
await page.pdf({ path: out, width: "1920px", height: "1080px", printBackground: true })
await browser.close()
server.close()
console.log("written", out)
