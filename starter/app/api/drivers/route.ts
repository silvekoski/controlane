import { NextResponse } from "next/server"
import { listDrivers } from "@/lib/present/entity"

export const runtime = "nodejs"

/** Drivers grouped by state, with the current or next job and work totals. */
export async function GET() {
  try {
    return NextResponse.json(await listDrivers())
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Could not load drivers" }, { status: 500 })
  }
}
