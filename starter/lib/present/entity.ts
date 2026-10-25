// A driver, customer or site, read through the orders it touches. The page
// reuses the board card so the same facts and attention signals appear here.

import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { customers, drivers, sites } from "@/lib/schema"
import { buildBoardCard } from "./board"
import { type Bundle, bool, num, rows, str, strings } from "./bundle"
import { label, labelIn, LANE_ORDER } from "./labels"
import { loadBoardBundles } from "./load"
import { deriveAttention } from "./attention"
import type { BoardCard, CustomerList, CustomerRow, DriverList, DriverRow, EntityKind, EntityList, EntityView, Fact } from "./types"

const KIND_LABEL: Record<EntityKind, string> = { driver: "Driver", customer: "Customer", site: "Managed site" }

function hoursText(value: unknown): string | null {
  const hours = typeof value === "object" && value && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  if (!hours) return null
  const parts = [
    str(hours.mon_fri) ? `Mon–Fri ${str(hours.mon_fri)}` : null,
    str(hours.sat) ? `Sat ${str(hours.sat)}` : "Sat closed",
    str(hours.sun) ? `Sun ${str(hours.sun)}` : "Sun closed",
  ].filter((part): part is string => !!part)
  return parts.length ? parts.join(" · ") : null
}

function laneSorted(cards: BoardCard[]): BoardCard[] {
  return [...cards].sort((a, b) => LANE_ORDER.indexOf(a.displayLane as (typeof LANE_ORDER)[number]) - LANE_ORDER.indexOf(b.displayLane as (typeof LANE_ORDER)[number])
    || String(a.decisive?.start ?? "").localeCompare(String(b.decisive?.start ?? "")))
}

function laneCounts(cards: BoardCard[]): string {
  const counts = LANE_ORDER.map((lane) => [lane, cards.filter((card) => card.displayLane === lane).length] as const).filter(([, count]) => count > 0)
  return counts.map(([lane, count]) => `${count} ${label(lane === "intake" ? "new" : lane).toLowerCase()}`).join(" · ")
}

export async function loadEntity(kind: EntityKind, id: string): Promise<EntityView | null> {
  if (kind === "driver") return loadDriver(id)
  if (kind === "customer") return loadCustomer(id)
  return loadSite(id)
}

async function loadDriver(id: string): Promise<EntityView | null> {
  const [driver] = await db.select().from(drivers).where(eq(drivers.id, id)).limit(1)
  if (!driver) return null
  const { snapshotAt, bundles } = await loadBoardBundles()
  const involved: { bundle: Bundle; role: string; at: string }[] = []
  for (const bundle of bundles) {
    const assignments = rows(bundle, "work_assignments").filter((row) => row.details.driver_id === id)
    const exposures = rows(bundle, "market_offer_exposures").filter((row) => row.details.driver_id === id)
    const reports = rows(bundle, "custody_reports").filter((row) => row.details.driver_id === id)
    if (!assignments.length && !exposures.length && !reports.length) continue
    const live = assignments.find((row) => row.details.status !== "CANCELLED") ?? assignments[0]
    const parts: string[] = []
    if (live && live.details.status !== "CANCELLED") parts.push(label(str(live.details.status)))
    if (assignments.some((row) => row.details.status === "CANCELLED")) parts.push(live && live.details.status !== "CANCELLED" ? "an earlier booking cancelled" : "Booking cancelled")
    for (const exposure of exposures) parts.push(`directed offer ${labelIn(str(exposure.details.status))}`)
    if (reports.length) parts.push("custody report filed")
    const at = str(live?.details.started_at) ?? str(live?.details.accepted_at) ?? str(exposures[0]?.details.shown_at) ?? bundle.order.createdAt
    involved.push({ bundle, role: parts.join(" · "), at })
  }
  involved.sort((a, b) => a.at.localeCompare(b.at))
  const cards = involved.map((item) => buildBoardCard(item.bundle))
  const statuses = involved.flatMap((item) => rows(item.bundle, "work_assignments").filter((row) => row.details.driver_id === id).map((row) => str(row.details.status) ?? ""))
  const facts: Fact[] = [
    { label: "Home base", value: `${driver.homeCity}, ${driver.homeCountry}`, hint: "a home base is not a current location" },
    { label: "Status", value: bool(driver.details.active) === false ? "Inactive" : "Active" },
    { label: "Assignments in this snapshot", value: statuses.length ? ["IN_PROGRESS", "ASSIGNED", "COMPLETED", "CANCELLED"].map((status) => [status, statuses.filter((item) => item === status).length] as const).filter(([, count]) => count).map(([status, count]) => `${count} ${labelIn(status)}`).join(" · ") : "none" },
  ]
  return {
    snapshotAt, kind: "driver", kindLabel: KIND_LABEL.driver, id, title: driver.displayName, subtitle: null, facts,
    notes: ["Orders are in the order the driver took them on. A prior duty's delivery city is a past observation, not where the driver is now."],
    links: [], cards, roles: Object.fromEntries(involved.map((item) => [item.bundle.order.id, item.role])),
  }
}

async function loadCustomer(id: string): Promise<EntityView | null> {
  const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1)
  if (!customer) return null
  const { snapshotAt, bundles } = await loadBoardBundles()
  const own = bundles.filter((bundle) => bundle.order.details && bundle.customer.id === id)
  const cards = laneSorted(own.map(buildBoardCard))
  const siteRows = await db.select().from(sites).where(eq(sites.customerId, id))
  const facts: Fact[] = [
    { label: "Account", value: label(customer.accountTier) },
    { label: "Country", value: customer.country },
    { label: "Orders in this snapshot", value: cards.length ? `${cards.length} · ${laneCounts(cards)}` : "none" },
  ]
  return {
    snapshotAt, kind: "customer", kindLabel: KIND_LABEL.customer, id, title: customer.name, subtitle: null, facts,
    notes: siteRows.length ? ["A site profile associated with this account does not grant access to every order using that site."] : [],
    links: siteRows.map((site) => ({ label: site.name, href: `/sites/${site.id}`, hint: `${label(site.kind)} · ${site.city}, ${site.country}` })),
    cards, roles: Object.fromEntries(own.map((bundle) => [bundle.order.id, "Contracting customer"])),
  }
}

async function loadSite(id: string): Promise<EntityView | null> {
  const [site] = await db.select().from(sites).where(eq(sites.id, id)).limit(1)
  if (!site) return null
  const { snapshotAt, bundles } = await loadBoardBundles()
  const involved: { bundle: Bundle; role: string }[] = []
  for (const bundle of bundles) {
    const pickupSite = bundle.order.pickupSiteId ?? bundle.places.get(bundle.order.pickupAddressId)?.managedSiteId ?? null
    const deliverySite = bundle.order.deliverySiteId ?? bundle.places.get(bundle.order.deliveryAddressId)?.managedSiteId ?? null
    const transfer = rows(bundle, "transport_points").some((point) => point.details.site_id === id && point.details.role === "TRANSFER")
    const roles: string[] = []
    if (pickupSite === id) roles.push("Pickup")
    if (deliverySite === id) roles.push("Delivery")
    if (transfer) roles.push("Transfer yard")
    if (!roles.length) continue
    involved.push({ bundle, role: roles.join(" and ") })
  }
  const cards = laneSorted(involved.map((item) => buildBoardCard(item.bundle)))
  const d = site.details
  const facts: Fact[] = [
    { label: "Kind", value: label(site.kind) },
    { label: "Address", value: `${str(d.address_line1) ?? "Street not recorded"}, ${site.city}, ${site.country}` },
    { label: "Hours", value: hoursText(d.opening_hours) ?? "Not recorded", hint: str(d.timezone) ? `local time, ${str(d.timezone)}` : null },
    { label: "Handover", value: str(d.handover_mode) ? label(str(d.handover_mode)) : "Not recorded", hint: num(d.advance_notice_minutes) ? `${num(d.advance_notice_minutes)} min advance notice` : null },
    { label: "Signed release", value: bool(d.requires_signed_release) == null ? "Not recorded" : bool(d.requires_signed_release) ? "Required" : "Not required" },
    { label: "Pickup contact", value: str(d.pickup_contact_email) ?? "Not recorded", mono: !!str(d.pickup_contact_email) },
    { label: "Orders in this snapshot", value: cards.length ? `${cards.length} · ${laneCounts(cards)}` : "none" },
  ]
  const notes = [
    str(d.pickup_access_note) ? `Pickup procedure: ${str(d.pickup_access_note)}` : null,
    str(d.delivery_access_note) && str(d.delivery_access_note) !== str(d.pickup_access_note) ? `Delivery procedure: ${str(d.delivery_access_note)}` : null,
    str(d.release_document_rule) ? `Release rule: ${str(d.release_document_rule)}` : null,
    "A standing site procedure is not a confirmation for a specific car, key set or appointment. Each order's endpoint detail records what was checked for that order.",
  ].filter((note): note is string => !!note)
  const customerLink = site.customerId ? await db.select({ id: customers.id, name: customers.name }).from(customers).where(eq(customers.id, site.customerId)).limit(1) : []
  return {
    snapshotAt, kind: "site", kindLabel: KIND_LABEL.site, id, title: site.name, subtitle: `${label(site.kind)} · ${site.city}, ${site.country}`, facts, notes,
    links: customerLink.map((customer) => ({ label: customer.name, href: `/customers/${customer.id}`, hint: "associated account" })),
    cards, roles: Object.fromEntries(involved.map((item) => [item.bundle.order.id, item.role])),
  }
}

/** Every driver, customer or site, with how many orders in the snapshot involve it. */
export async function listEntities(kind: EntityKind): Promise<EntityList> {
  const { bundles } = await loadBoardBundles()
  if (kind === "driver") {
    const rowsAll = await db.select().from(drivers)
    const counts = new Map<string, number>()
    for (const bundle of bundles) {
      const ids = new Set(rows(bundle, "work_assignments").map((row) => str(row.details.driver_id)).filter((value): value is string => !!value))
      for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    const items = rowsAll.map((driver) => ({
      id: driver.id, title: driver.displayName, subtitle: `${driver.homeCity}, ${driver.homeCountry}`, count: counts.get(driver.id) ?? 0, href: `/drivers/${driver.id}`,
    })).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
    return { kind, kindLabel: "Drivers", items }
  }
  if (kind === "customer") {
    const rowsAll = await db.select().from(customers)
    const counts = new Map<string, number>()
    for (const bundle of bundles) counts.set(bundle.customer.id, (counts.get(bundle.customer.id) ?? 0) + 1)
    const items = rowsAll.map((customer) => ({
      id: customer.id, title: customer.name, subtitle: `${label(customer.accountTier)} · ${customer.country}`, count: counts.get(customer.id) ?? 0, href: `/customers/${customer.id}`,
    })).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
    return { kind, kindLabel: "Customers", items }
  }
  const rowsAll = await db.select().from(sites)
  const counts = new Map<string, number>()
  for (const bundle of bundles) {
    const ids = new Set([
      bundle.order.pickupSiteId ?? bundle.places.get(bundle.order.pickupAddressId)?.managedSiteId ?? null,
      bundle.order.deliverySiteId ?? bundle.places.get(bundle.order.deliveryAddressId)?.managedSiteId ?? null,
      ...rows(bundle, "transport_points").map((point) => str(point.details.site_id)),
    ].filter((value): value is string => !!value))
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  const items = rowsAll.map((site) => ({
    id: site.id, title: site.name, subtitle: `${label(site.kind)} · ${site.city}, ${site.country}`, count: counts.get(site.id) ?? 0, href: `/sites/${site.id}`,
  })).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
  return { kind, kindLabel: "Places", items }
}

const CLOSED = new Set(["delivered", "cancelled"])

/** The driver fee for one order: the accepted offer, else the newest one, split across the orders it covers. */
function orderFeeCents(bundle: Bundle): number | null {
  const offers = rows(bundle, "market_offers").filter((row) => num(row.details.fee_cents) != null)
  const chosen = offers.find((row) => str(row.details.status) === "ACCEPTED")
    ?? [...offers].sort((a, b) => (str(b.details.published_at) ?? "").localeCompare(str(a.details.published_at) ?? ""))[0]
  if (!chosen) return null
  const members = Math.max(1, strings(chosen.details.order_ids).length)
  return Math.round((num(chosen.details.fee_cents) ?? 0) / members)
}

/** Every customer with order counts, driver fees and the last order, plus daily totals for the trend lines. */
export async function listCustomers(): Promise<CustomerList> {
  const { bundles, snapshotAt } = await loadBoardBundles()
  const all = await db.select().from(customers)
  const byId = new Map<string, CustomerRow>(all.map((customer) => [customer.id, {
    id: customer.id, name: customer.name, tier: customer.accountTier, tierLabel: label(customer.accountTier), country: customer.country, importBuyer: customer.importBuyer,
    orders: 0, open: 0, delivered: 0, cancelled: 0, needPerson: 0, feeCents: 0, pricedOrders: 0, lastOrderAt: null, href: `/customers/${customer.id}`,
  }]))
  const end = snapshotAt ? Date.parse(snapshotAt) : Date.now()
  const day = 24 * 60 * 60 * 1000
  const ordersPerDay = Array.from({ length: 14 }, () => 0)
  const feesPerDay = Array.from({ length: 14 }, () => 0)
  for (const bundle of bundles) {
    const row = byId.get(bundle.customer.id)
    if (!row) continue
    const lane = bundle.order.lane
    row.orders += 1
    if (lane === "delivered") row.delivered += 1
    else if (lane === "cancelled") row.cancelled += 1
    if (!CLOSED.has(lane)) row.open += 1
    if (deriveAttention(bundle).length > 0) row.needPerson += 1
    const fee = orderFeeCents(bundle)
    if (fee != null) { row.feeCents += fee; row.pricedOrders += 1 }
    if (!row.lastOrderAt || bundle.order.createdAt > row.lastOrderAt) row.lastOrderAt = bundle.order.createdAt
    const age = Math.floor((end - Date.parse(bundle.order.createdAt)) / day)
    if (age >= 0 && age < 14) {
      ordersPerDay[13 - age] += 1
      if (fee != null) feesPerDay[13 - age] += fee
    }
  }
  const rowsOut = [...byId.values()].sort((a, b) => b.orders - a.orders || a.name.localeCompare(b.name))
  return { snapshotAt, currency: "EUR", rows: rowsOut, ordersPerDay, feesPerDay }
}

/** Where an in-progress assignment stands, from its steps: the car in hand, or the driver on the way without it. */
function assignmentPhase(bundle: Bundle, assignmentId: string): { state: "driving" | "traveling"; doing: string } {
  const steps = rows(bundle, "assignment_steps").filter((step) => step.details.assignment_id === assignmentId)
    .sort((a, b) => (num(a.details.sequence) ?? 0) - (num(b.details.sequence) ?? 0))
  const done = (kind: string) => steps.some((step) => step.details.kind === kind && step.details.status === "COMPLETED")
  const card = buildBoardCard(bundle)
  if (done("VEHICLE_DELIVERY")) return { state: "traveling", doing: `Car delivered in ${card.to.city}. On the way back.` }
  if (done("VEHICLE_PICKUP")) {
    const ferry = steps.find((step) => step.details.kind === "VEHICLE_FERRY" && step.details.status !== "COMPLETED")
    return { state: "driving", doing: ferry ? `Car collected. Ferry ahead to ${str(ferry.details.to_city) ?? card.to.city}.` : `Car collected. On the way to ${card.to.city}.` }
  }
  return { state: "traveling", doing: `On the way to the pickup in ${card.from.city}.` }
}

/** Every driver with a state from the work assignments and their steps: driving, traveling or off duty. */
export async function listDrivers(): Promise<DriverList> {
  const { bundles, snapshotAt } = await loadBoardBundles()
  const all = await db.select().from(drivers)
  const byId = new Map<string, DriverRow & { orderIds: Set<string>; rank: number }>(all.map((driver) => [driver.id, {
    id: driver.id, name: driver.displayName, homeCity: driver.homeCity, homeCountry: driver.homeCountry, href: `/drivers/${driver.id}`,
    state: "off", doing: null, current: null, orders: 0, completed: 0, feeCents: 0, needPerson: 0, orderIds: new Set<string>(), rank: 0,
  }]))
  const RANK: Record<string, number> = { IN_PROGRESS: 2, ASSIGNED: 1 }
  for (const bundle of bundles) {
    const waiting = deriveAttention(bundle).length > 0
    for (const assignment of rows(bundle, "work_assignments")) {
      const d = assignment.details
      const row = byId.get(str(d.driver_id) ?? "")
      if (!row) continue
      const status = str(d.status) ?? ""
      if (!row.orderIds.has(bundle.order.id)) {
        row.orderIds.add(bundle.order.id)
        row.orders += 1
        if (waiting) row.needPerson += 1
      }
      if (status === "COMPLETED") row.completed += 1
      if (status !== "CANCELLED") row.feeCents += num(d.fee_cents) ?? 0
      const rank = RANK[status] ?? 0
      if (rank > row.rank) {
        const card = buildBoardCard(bundle)
        row.rank = rank
        row.current = { orderId: bundle.order.id, reference: bundle.order.reference, vehicle: card.vehicle, from: card.from.city, to: card.to.city, startedAt: str(d.started_at) ?? str(d.accepted_at), next: rank === 1 }
        if (rank === 2) {
          const phase = assignmentPhase(bundle, assignment.id)
          row.state = phase.state
          row.doing = phase.doing
        } else {
          row.state = "off"
          row.doing = `Next job: ${card.from.city} to ${card.to.city}.`
        }
      }
    }
  }
  const order: Record<string, number> = { driving: 0, traveling: 1, off: 2 }
  const rowsOut = [...byId.values()].map(({ orderIds: _ids, rank: _rank, ...row }) => row)
    .sort((a, b) => order[a.state] - order[b.state] || Number(!!b.current) - Number(!!a.current) || b.needPerson - a.needPerson || b.orders - a.orders || a.name.localeCompare(b.name))
  return { snapshotAt, currency: "EUR", rows: rowsOut }
}

export { strings }
