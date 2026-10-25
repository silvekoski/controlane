import { NextResponse } from "next/server"
import { listPlaces } from "@/lib/present/places"

export const runtime = "nodejs"

/** Managed sites with their city, owner and how orders use them. */
export async function GET() {
  try {
    return NextResponse.json(await listPlaces())
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Could not load places" }, { status: 500 })
  }
}
