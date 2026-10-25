import "server-only"

import { inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { datasetMetadata, drivers, orders, relatedRecords } from "@/lib/schema"
import { label } from "./labels"

/* The money view of the snapshot: driver fees, open gigs, expense claims, Bahn-paid travel and
   the cost decisions that need a person. The packet has no customer prices or invoices,
   so this reads costs only. "Approved" means a claim was accepted, not that money moved. */

type Row = Record<string, unknown>

const cents = (value: unknown) => (typeof value === "number" ? value : 0)
const text = (value: unknown) => (typeof value === "string" ? value : null)

export type ClaimFlag = { tone: "warn" | "danger" | "neutral"; text: string }

export type Claim = {
  id: string; kind: string; kindLabel: string; status: string; amountCents: number; payer: string
  driver: { id: string; name: string } | null; order: { id: string; reference: string } | null
  merchant: string | null; country: string | null; submittedAt: string | null; serviceAt: string | null
  receipts: number; source: string; note: string | null; flags: ClaimFlag[]
}

export type FinanceView = {
  snapshotAt: string | null
  totals: {
    feesBookedCents: number; assignments: number; feesDoneCents: number
    openOffersCents: number; openOffers: number
    claimsWaitingCents: number; claimsWaiting: number
    claimsApprovedCents: number; claimsRejectedCents: number
    bahnTravelCents: number; bahnTravel: number
  }
  waiting: Claim[]
  byKind: { kind: string; label: string; approved: number; submitted: number; rejected: number }[]
  byRoute: { route: string; label: string; count: number; totalCents: number; averageCents: number }[]
  payouts: { id: string; decision: string; reason: string; feeCents: number; driver: { id: string; name: string } | null; order: { id: string; reference: string } | null; cancelledAt: string | null }[]
  emptyPickups: { id: string; status: string; openedAt: string | null; order: { id: string; reference: string } | null }[]
  openOffers: { id: string; feeCents: number; type: string; order: { id: string; reference: string } | null }[]
}

const FLAG_SOURCE: Record<string, string> = { DRIVER_CHAT: "Sent in the chat, not in the app" }

function claimFlags(row: Row, fingerprints: Map<string, number>): ClaimFlag[] {
  const flags: ClaimFlag[] = []
  if (cents(row.receipt_count) === 0) flags.push({ tone: "danger", text: "No receipt" })
  if (text(row.supersedes_expense_id)) flags.push({ tone: "warn", text: "Corrects an earlier claim: do not pay twice" })
  else if (text(row.receipt_fingerprint) && (fingerprints.get(String(row.receipt_fingerprint)) ?? 0) > 1) flags.push({ tone: "danger", text: "Same receipt as another claim" })
  if (FLAG_SOURCE[String(row.submission_source)]) flags.push({ tone: "neutral", text: FLAG_SOURCE[String(row.submission_source)] })
  if (row.kind === "HOTEL") flags.push({ tone: "neutral", text: "Hotel: rare, check why it was needed" })
  if (cents(row.amount_cents) >= 20000) flags.push({ tone: "neutral", text: "Over €200" })
  return flags
}

export async function loadFinance(): Promise<FinanceView> {
  const records = await db.select().from(relatedRecords).where(inArray(relatedRecords.collection, ["expenses", "work_assignments", "market_offers", "incidents"]))
  const of = (collection: string) => records.filter((record) => record.collection === collection).map((record) => ({ id: record.id, ...record.details }) as Row & { id: string })
  const expenses = of("expenses"), assignments = of("work_assignments"), offers = of("market_offers"), incidents = of("incidents")

  const orderRows = await db.select({ id: orders.id, reference: orders.reference, routeKind: orders.routeKind }).from(orders)
  const orderById = new Map(orderRows.map((row) => [row.id, row]))
  const driverRows = await db.select({ id: drivers.id, name: drivers.displayName }).from(drivers)
  const driverById = new Map(driverRows.map((row) => [row.id, row]))
  const meta = await db.select().from(datasetMetadata).limit(1)
  const snapshotAt = meta[0]?.snapshotAt.toISOString() ?? null

  const orderRef = (id: unknown) => { const row = orderById.get(String(id)); return row ? { id: row.id, reference: row.reference } : null }
  const driverRef = (id: unknown) => { const row = driverById.get(String(id)); return row ? { id: row.id, name: row.name } : null }

  const fingerprints = new Map<string, number>()
  for (const row of expenses) if (text(row.receipt_fingerprint)) fingerprints.set(String(row.receipt_fingerprint), (fingerprints.get(String(row.receipt_fingerprint)) ?? 0) + 1)

  const toClaim = (row: Row & { id: string }): Claim => ({
    id: row.id, kind: String(row.kind), kindLabel: label(String(row.kind)), status: String(row.status), amountCents: cents(row.amount_cents), payer: String(row.payer),
    driver: driverRef(row.driver_id), order: orderRef(row.order_id), merchant: text(row.merchant), country: text(row.cost_country),
    submittedAt: text(row.submitted_at), serviceAt: text(row.service_at), receipts: cents(row.receipt_count), source: label(String(row.submission_source)),
    note: text(row.review_note), flags: claimFlags(row, fingerprints),
  })

  const sum = (rows: Row[], key: string) => rows.reduce((total, row) => total + cents(row[key]), 0)
  const live = assignments.filter((row) => row.status !== "CANCELLED" || row.cancellation_payout_decision === "PAYOUT_DUE")
  const done = assignments.filter((row) => row.status === "COMPLETED")
  const published = offers.filter((row) => row.status === "PUBLISHED")
  const waiting = expenses.filter((row) => row.status === "SUBMITTED")
  const bahn = expenses.filter((row) => row.payer === "BAHN" && row.status !== "SUPERSEDED" && row.status !== "REJECTED")

  const kinds = [...new Set(expenses.map((row) => String(row.kind)))]
  const byKind = kinds.map((kind) => {
    const rows = expenses.filter((row) => row.kind === kind)
    const total = (status: string) => sum(rows.filter((row) => row.status === status), "amount_cents")
    return { kind, label: label(kind), approved: total("APPROVED"), submitted: total("SUBMITTED"), rejected: total("REJECTED") }
  }).sort((a, b) => (b.approved + b.submitted) - (a.approved + a.submitted))

  const routes = new Map<string, { count: number; totalCents: number }>()
  for (const row of live) {
    const route = orderById.get(String(row.order_id))?.routeKind ?? "UNKNOWN"
    const entry = routes.get(route) ?? { count: 0, totalCents: 0 }
    entry.count += 1; entry.totalCents += cents(row.fee_cents)
    routes.set(route, entry)
  }

  return {
    snapshotAt,
    totals: {
      feesBookedCents: sum(live, "fee_cents"), assignments: live.length, feesDoneCents: sum(done, "fee_cents"),
      openOffersCents: sum(published, "fee_cents"), openOffers: published.length,
      claimsWaitingCents: sum(waiting, "amount_cents"), claimsWaiting: waiting.length,
      claimsApprovedCents: sum(expenses.filter((row) => row.status === "APPROVED"), "amount_cents"),
      claimsRejectedCents: sum(expenses.filter((row) => row.status === "REJECTED"), "amount_cents"),
      bahnTravelCents: sum(bahn, "amount_cents"), bahnTravel: bahn.length,
    },
    // Oldest first: a driver waits for the money.
    waiting: waiting.map(toClaim).sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? "")),
    byKind,
    byRoute: [...routes.entries()].map(([route, entry]) => ({ route, label: label(route), count: entry.count, totalCents: entry.totalCents, averageCents: Math.round(entry.totalCents / entry.count) })).sort((a, b) => b.totalCents - a.totalCents),
    payouts: assignments.filter((row) => row.status === "CANCELLED").map((row) => ({
      id: row.id, decision: String(row.cancellation_payout_decision ?? "UNKNOWN"), reason: label(String(row.cancellation_reason ?? "")), feeCents: cents(row.fee_cents),
      driver: driverRef(row.driver_id), order: orderRef(row.order_id), cancelledAt: text(row.cancelled_at),
    })),
    emptyPickups: incidents.filter((row) => row.kind === "EMPTY_PICKUP").map((row) => ({ id: row.id, status: label(String(row.status)), openedAt: text(row.opened_at), order: orderRef(row.order_id) })),
    openOffers: published.map((row) => ({ id: row.id, feeCents: cents(row.fee_cents), type: label(String(row.type)), order: orderRef(row.order_id) })).sort((a, b) => b.feeCents - a.feeCents),
  }
}
