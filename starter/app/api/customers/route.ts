import { NextResponse } from "next/server"
import { listCustomers } from "@/lib/present/entity"

export const runtime = "nodejs"

/** Customers with order counts, driver fees, the last order and daily trend values. */
export async function GET() {
  return NextResponse.json(await listCustomers())
}
