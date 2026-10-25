import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/* The decision queue, the decide actions, evals and labeling live in the control room app.
   This route passes the requests to its JSON API, so the browser talks to one origin.
   Set CONTROL_ROOM_URL when the control room does not run on port 3100. */

const BASE = process.env.CONTROL_ROOM_URL ?? "http://localhost:3100"

function offline() {
  return NextResponse.json({ error: `The control room does not answer at ${BASE}. Start it with "cd control-room && npm run dev".`, offline: true }, { status: 503 })
}

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${BASE}/api/control?${request.nextUrl.searchParams}`, { cache: "no-store" })
    return NextResponse.json(await response.json(), { status: response.status })
  } catch {
    return offline()
  }
}

export async function POST(request: NextRequest) {
  if (process.env.DEMO_READONLY === "1") return NextResponse.json({ error: "This is a read-only copy. Changes are not saved." }, { status: 403 })
  try {
    const response = await fetch(`${BASE}/api/control`, { method: "POST", headers: { "content-type": "application/json" }, body: await request.text(), cache: "no-store" })
    return NextResponse.json(await response.json(), { status: response.status })
  } catch {
    return offline()
  }
}
