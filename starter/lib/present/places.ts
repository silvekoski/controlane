// Managed sites for the places map: where each one is, whose it is, and how orders use it.

import { db } from "@/lib/db"
import { customers, sites } from "@/lib/schema"
import { deriveAttention } from "./attention"
import { rows, str } from "./bundle"
import { label } from "./labels"
import { loadBoardBundles } from "./load"
import type { PlaceList, PlaceRow } from "./types"

/** Every managed site with its pickup, delivery and transfer counts, for the places map and list. */
export async function listPlaces(): Promise<PlaceList> {
  const { bundles, snapshotAt } = await loadBoardBundles()
  const [siteRows, customerRows] = await Promise.all([db.select().from(sites), db.select({ id: customers.id, name: customers.name }).from(customers)])
  const names = new Map(customerRows.map((customer) => [customer.id, customer.name]))
  const byId = new Map<string, PlaceRow>(siteRows.map((site) => [site.id, {
    id: site.id, name: site.name, kind: site.kind, kindLabel: label(site.kind), city: site.city, country: site.country, href: `/sites/${site.id}`, address: str(site.details.address_line1),
    customer: site.customerId ? { id: site.customerId, name: names.get(site.customerId) ?? site.customerId } : null,
    orders: 0, pickups: 0, deliveries: 0, transfers: 0, needPerson: 0, vehicles: [],
  }]))
  const models = new Map<string, Map<string, number>>()
  for (const bundle of bundles) {
    const pickup = bundle.order.pickupSiteId ?? bundle.places.get(bundle.order.pickupAddressId)?.managedSiteId ?? null
    const delivery = bundle.order.deliverySiteId ?? bundle.places.get(bundle.order.deliveryAddressId)?.managedSiteId ?? null
    const transfers = new Set(rows(bundle, "transport_points").filter((point) => point.details.role === "TRANSFER").map((point) => str(point.details.site_id)).filter((id): id is string => !!id))
    const touched = new Set([pickup, delivery, ...transfers].filter((id): id is string => !!id))
    const waiting = deriveAttention(bundle).length > 0
    for (const id of touched) {
      const row = byId.get(id)
      if (!row) continue
      row.orders += 1
      if (id === pickup) row.pickups += 1
      if (id === delivery) row.deliveries += 1
      if (transfers.has(id)) row.transfers += 1
      if (waiting) row.needPerson += 1
      const item = bundle.items.find((entry) => entry.role === "PRIMARY") ?? bundle.items[0]
      if (item) {
        const vehicle = `${item.vehicle.make} ${item.vehicle.model}`
        const counts = models.get(id) ?? new Map<string, number>()
        counts.set(vehicle, (counts.get(vehicle) ?? 0) + 1)
        models.set(id, counts)
      }
    }
  }
  for (const [id, counts] of models) {
    const row = byId.get(id)
    if (row) row.vehicles = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([vehicle]) => vehicle)
  }
  return { snapshotAt, rows: [...byId.values()].sort((a, b) => b.orders - a.orders || a.name.localeCompare(b.name)) }
}
