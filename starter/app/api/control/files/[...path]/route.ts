import { NextResponse } from "next/server"

export const runtime = "nodejs"

const BASE = process.env.CONTROL_ROOM_URL ?? "http://localhost:3100"

/** Photos and scans that a decision card points to, served by the control room. */
export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  try {
    const response = await fetch(`${BASE}/api/files/${path.map(encodeURIComponent).join("/")}`, { cache: "no-store" })
    if (!response.ok) return new NextResponse("Not found", { status: response.status })
    return new NextResponse(response.body, { headers: { "content-type": response.headers.get("content-type") ?? "application/octet-stream", "cache-control": "private, max-age=3600" } })
  } catch {
    return new NextResponse("The control room does not answer", { status: 503 })
  }
}
