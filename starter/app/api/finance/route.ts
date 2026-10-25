import { NextResponse } from "next/server"
import { loadFinance } from "@/lib/present/finance"

export const runtime = "nodejs"

/** Driver fees, open gigs, expense claims and the money decisions that need a person. */
export async function GET() {
  try {
    return NextResponse.json(await loadFinance())
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Could not load finances" }, { status: 500 })
  }
}
