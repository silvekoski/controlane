import { NextRequest, NextResponse } from "next/server"
import { readAgentState } from "@/lib/agent-state"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Agent runs, decision cards and Jev checks from the control room. `?order=` keeps one order. */
export function GET(request: NextRequest) {
  const state = readAgentState()
  const order = request.nextUrl.searchParams.get("order")
  if (!order) return NextResponse.json(state)
  return NextResponse.json({ ...state, runs: state.runs.filter((run) => run.orderId === order), cards: state.cards.filter((card) => card.orderId === order) })
}
