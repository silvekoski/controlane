"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ArrowRightIcon, Building2Icon, ChevronRightIcon, ClockIcon, FileSignatureIcon, HandshakeIcon, MailIcon, MapPinIcon, PackageIcon, SearchIcon,
  TriangleAlertIcon, WarehouseIcon, XIcon, type LucideIcon,
} from "@/components/icons"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { laneLabel } from "@/lib/present/labels"
import { fmtDateTime, fmtDay } from "@/lib/present/time"
import type { BoardCard, EntityView, PlaceList, PlaceRow } from "@/lib/present/types"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { branchImage } from "@/lib/branch-images"
import { carImage } from "@/lib/car-images"
import { AppFrame } from "../components/app-frame"
import type { MapRoute } from "../components/places-map"
import { LaneIcon } from "../components/status-icons"

const PlacesMap = dynamic(() => import("../components/places-map"), { ssr: false, loading: () => <Skeleton className="size-full rounded-none" /> })

const KINDS = [["all", "All"], ["DEALERSHIP", "Dealerships"], ["SOURCE_DEALER", "Source dealers"], ["other", "Yards and storage"]] as const
const KIND_ICON: Record<string, LucideIcon> = { DEALERSHIP: Building2Icon, SOURCE_DEALER: HandshakeIcon, TRANSFER_YARD: WarehouseIcon, INDEPENDENT_STORAGE: WarehouseIcon }
const FACT_ICON: Record<string, LucideIcon> = { Kind: Building2Icon, Address: MapPinIcon, Hours: ClockIcon, Handover: HandshakeIcon, "Signed release": FileSignatureIcon, "Pickup contact": MailIcon }
const PROGRESS: Record<string, number> = { intake: 0.08, ready: 0.18, market: 0.3, booked: 0.45, moving: 0.72, delivered: 1, cancelled: 0 }

/** Places as a tracking view: the list or one place on the left, the map on the right, the place's orders over the map. */
export default function PlacesPage() {
  const [list, setList] = useState<PlaceList | null>(null)
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>("all")
  const [query, setQuery] = useState("")
  const [city, setCity] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<EntityView | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/places", { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("Could not load places"); return response.json() as Promise<PlaceList> })
      .then(setList)
      .catch((cause: unknown) => { if (!controller.signal.aborted) toast.error(cause instanceof Error ? cause.message : "Could not load places", { description: "Check that the local database is running and seeded." }) })
    const wanted = window.location.hash.replace(/^#/, "")
    if (wanted) setSelected(wanted)
    return () => controller.abort()
  }, [])

  useEffect(() => {
    setDetail(null)
    if (!selected) return
    const controller = new AbortController()
    fetch(`/api/entities/site/${encodeURIComponent(selected)}`, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("Could not load the place"); return response.json() as Promise<EntityView> })
      .then(setDetail)
      .catch((cause: unknown) => { if (!controller.signal.aborted) toast.error(cause instanceof Error ? cause.message : "Could not load the place") })
    return () => controller.abort()
  }, [selected])

  const rows = list?.rows ?? []
  const place = rows.find((row) => row.id === selected) ?? null
  const needle = query.trim().toLowerCase()
  const shown = rows.filter((row) => (kind === "all" || (kind === "other" ? row.kind !== "DEALERSHIP" && row.kind !== "SOURCE_DEALER" : row.kind === kind))
    && (!city || `${row.city}|${row.country}` === city)
    && (!needle || `${row.name} ${row.city} ${row.customer?.name ?? ""}`.toLowerCase().includes(needle)))
  const routes: MapRoute[] = useMemo(() => (detail?.cards ?? []).map((card) => ({ key: card.id, from: card.from, to: card.to, live: card.displayLane === "moving" })), [detail])

  const choose = (id: string | null) => {
    setSelected(id)
    window.history.replaceState(null, "", id ? `#${id}` : window.location.pathname)
  }

  return <AppFrame section="sites" snapshotAt={list?.snapshotAt ?? null} board>
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[26rem_minmax(0,1fr)]">
      <section className="flex min-h-0 min-w-0 flex-col border-b lg:border-r lg:border-b-0" aria-label={place ? "Place detail" : "Places"}>
        {place
          ? <PlaceDetail place={place} detail={detail} onClose={() => choose(null)} />
          : <>
            <div className="flex flex-col gap-3 border-b px-4 py-3">
              <div className="flex items-baseline gap-2">
                <h1 className="text-base font-semibold">Places</h1>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">{list ? `${shown.length} of ${rows.length}` : ""}</span>
              </div>
              <InputGroup className="h-8">
                <InputGroupAddon><SearchIcon className="size-3.5" aria-hidden="true" /></InputGroupAddon>
                <InputGroupInput className="text-[13px]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, city or customer" aria-label="Search places" />
              </InputGroup>
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex h-7 max-w-full items-center overflow-x-auto rounded-md bg-muted p-0.5" role="radiogroup" aria-label="Kind">
                  {KINDS.map(([key, label]) => <button key={key} type="button" role="radio" aria-checked={kind === key} onClick={() => setKind(key)}
                    className={cn("h-6 rounded-[5px] px-2 text-xs text-muted-foreground hover:text-foreground", kind === key && "bg-background text-foreground shadow-xs ring-1 ring-border")}>{label}</button>)}
                </div>
                {city && <span className="inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs">
                  <MapPinIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />{city.replace("|", ", ")}
                  <button type="button" onClick={() => setCity(null)} className="text-muted-foreground hover:text-foreground" aria-label="Clear the city filter"><XIcon className="size-3.5" aria-hidden="true" /></button>
                </span>}
              </div>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {!list && [0, 1, 2, 3, 4].map((index) => <li key={index} className="flex gap-3 border-b px-4 py-3"><Skeleton className="size-9" /><Skeleton className="h-9 flex-1" /></li>)}
              {shown.map((row) => {
                const Icon = KIND_ICON[row.kind] ?? Building2Icon
                return <li key={row.id}>
                  <button type="button" onClick={() => choose(row.id)} className="flex w-full items-center gap-3 border-b px-4 py-3 text-left outline-none hover:bg-accent/60 focus-visible:bg-accent">
                    <span className="relative h-11 w-16 shrink-0 overflow-hidden rounded-lg bg-muted"><Image src={branchImage(row.id, row.kind).src} alt="" fill sizes="64px" className="object-cover" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{row.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{row.address ? `${row.address}, ` : ""}{row.city}, {row.country}</span>
                      <span className="mt-0.5 block"><CarStack vehicles={row.vehicles} fallback={Icon} /></span>
                    </span>
                    {row.needPerson > 0 && <span className="inline-flex items-center gap-1 text-xs text-warning" title={`${row.needPerson} orders need a person`}><TriangleAlertIcon className="size-3" aria-hidden="true" />{row.needPerson}</span>}
                    <span className="shrink-0 text-right font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums">{row.orders} {row.orders === 1 ? "order" : "orders"}</span>
                    <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              })}
              {list && shown.length === 0 && <li className="px-4 py-6 text-sm text-muted-foreground">No place matches these filters.</li>}
            </ul>
          </>}
      </section>

      <section className="relative min-h-[28rem] min-w-0 overflow-hidden" aria-label="Map">
        {list && <PlacesMap places={city ? rows.filter((row) => `${row.city}|${row.country}` === city) : rows} selectedId={place?.id ?? null} routes={routes} onSelect={choose} />}
        <p className="pointer-events-none absolute top-3 left-3 z-[400] rounded-md bg-background/85 px-2 py-1 text-[11px] text-muted-foreground shadow-xs backdrop-blur">
          The sites and their addresses are fictional. Pins show an approximate point near the city centre.
        </p>
        {detail && detail.cards.length > 0 && <div className="absolute inset-x-0 bottom-0 z-[400] flex gap-3 overflow-x-auto p-3" aria-label="Orders at this place">
          {detail.cards.map((card) => <OrderTile key={card.id} card={card} role={detail.roles[card.id] ?? ""} />)}
        </div>}
      </section>
    </div>
  </AppFrame>
}

/** One order over the map: car, role at this place, route with a progress bar, and the decisive date. */
function OrderTile({ card, role }: { card: BoardCard; role: string }) {
  const progress = PROGRESS[card.displayLane] ?? 0
  const image = carImage(card.vehicle)
  return <Link href={`/orders/${card.id}`} className="flex w-80 shrink-0 flex-col gap-2.5 rounded-xl border bg-background/95 p-3.5 shadow-lg backdrop-blur transition-colors hover:border-foreground/25">
    <span className="flex items-center gap-3">
      {image && <span className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-muted"><Image src={image} alt="" fill sizes="80px" className="object-cover" /></span>}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-1.5"><LaneIcon lane={card.displayLane} /><span className="truncate text-[13px] font-semibold">{card.vehicle}</span></span>
        <span className="w-fit rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{role}</span>
      </span>
    </span>
    <span className="flex items-center justify-between text-xs">
      <span className="font-mono">{card.reference}</span>
      <span className="text-muted-foreground">{laneLabel(card.displayLane)}</span>
    </span>
    <span className="h-1.5 overflow-hidden rounded-full bg-muted"><span className={cn("block h-full rounded-full", card.displayLane === "cancelled" ? "bg-muted-foreground" : "bg-primary")} style={{ width: `${Math.max(4, progress * 100)}%` }} /></span>
    <span className="flex items-center justify-between text-[11px] tracking-wide text-muted-foreground uppercase">
      <span>{card.from.city}</span><span>{card.to.city}</span>
    </span>
    {card.decisive && <span className="rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs"><span className="text-muted-foreground">{card.decisive.label}</span> · {fmtDateTime(card.decisive.start, card.decisive.zone)}</span>}
  </Link>
}

function PlaceDetail({ place, detail, onClose }: { place: PlaceRow; detail: EntityView | null; onClose: () => void }) {
  const Icon = KIND_ICON[place.kind] ?? Building2Icon
  const total = Math.max(1, place.pickups + place.deliveries + place.transfers)
  const timeline = (detail?.cards ?? []).slice().sort((a, b) => (a.decisive?.start ?? "").localeCompare(b.decisive?.start ?? ""))
  const facts = (detail?.facts ?? []).filter((fact) => fact.label !== "Orders in this snapshot")
  return <>
    <header className="flex h-11 shrink-0 items-center justify-between border-b px-4">
      <h1 className="text-[13px] font-medium">Place detail</h1>
      <button type="button" onClick={onClose} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close and show all places"><XIcon className="size-4" aria-hidden="true" /></button>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto">
      <BranchPhoto place={place} />
      <section className="flex flex-col gap-3 border-b p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border bg-muted/60"><Icon className="size-5 text-primary" aria-hidden="true" /></span>
          <div className="min-w-0">
            <h2 className="text-base leading-tight font-semibold">{place.name}</h2>
            {place.address && <p className="text-[13px]">{place.address}, {place.city}, {place.country}</p>}
            <p className="text-xs text-muted-foreground">{place.kindLabel} · {place.customer ? <Link href={`/customers/${place.customer.id}`} className="hover:underline">{place.customer.name}</Link> : "No customer"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[`${place.city}, ${place.country}`, `${place.orders} ${place.orders === 1 ? "order" : "orders"}`, place.kindLabel].map((text) => <span key={text} className="rounded-full border px-2.5 py-0.5 text-xs">{text}</span>)}
          {place.needPerson > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-warning/12 px-2.5 py-0.5 text-xs text-warning"><TriangleAlertIcon className="size-3" aria-hidden="true" />{place.needPerson} need a person</span>}
        </div>
      </section>

      <CarsStrip cards={detail?.cards ?? null} />
      <PlacePhotos detail={detail} />

      <section className="flex flex-col gap-3 border-b p-4" aria-label="How orders use this place">
        <h3 className="text-[13px] font-medium">How orders use this place</h3>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-chart-1" aria-hidden="true" />Pickups <b className="font-mono text-foreground">{place.pickups}</b></span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-chart-2" aria-hidden="true" />Deliveries <b className="font-mono text-foreground">{place.deliveries}</b></span>
          {place.transfers > 0 && <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-muted-foreground" aria-hidden="true" />Transfers <b className="font-mono text-foreground">{place.transfers}</b></span>}
        </div>
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${place.pickups} pickups, ${place.deliveries} deliveries, ${place.transfers} transfers`}>
          {place.pickups > 0 && <span className="h-full bg-chart-1" style={{ width: `${place.pickups / total * 100}%` }} />}
          {place.deliveries > 0 && <span className="h-full bg-chart-2" style={{ width: `${place.deliveries / total * 100}%` }} />}
          {place.transfers > 0 && <span className="h-full bg-muted-foreground" style={{ width: `${place.transfers / total * 100}%` }} />}
        </div>
        {!detail && <Skeleton className="h-28 w-full" />}
        {facts.length > 0 && <dl className="flex flex-col">
          {facts.map((fact) => {
            const FactIcon = FACT_ICON[fact.label] ?? PackageIcon
            return <div key={fact.label} className="flex items-start gap-2.5 py-1.5 text-[13px]">
              <FactIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <dt className="w-28 shrink-0 text-muted-foreground">{fact.label}</dt>
              <dd className={cn("min-w-0 flex-1 text-right break-words", fact.mono && "font-mono text-xs")}>{fact.value}{fact.hint && <span className="block text-xs text-muted-foreground">{fact.hint}</span>}</dd>
            </div>
          })}
        </dl>}
      </section>

      <section className="flex flex-col gap-3 border-b p-4" aria-label="Orders at this place">
        <h3 className="text-[13px] font-medium">Orders at this place</h3>
        {detail && timeline.length === 0 && <p className="text-xs text-muted-foreground">No order in this snapshot uses this place.</p>}
        <ol className="flex flex-col">
          {timeline.map((card, index) => {
            const live = card.displayLane === "moving"
            const image = carImage(card.vehicle)
            return <li key={card.id} className="relative grid grid-cols-[1.25rem_3.5rem_minmax(0,1fr)_3.5rem] gap-x-3 pb-4 last:pb-0">
              {index < timeline.length - 1 && <span className="absolute top-5 bottom-0 left-[0.6rem] w-px bg-border" aria-hidden="true" />}
              <span className={cn("relative mt-0.5 grid size-5 place-items-center rounded-full border bg-background", live && "border-primary ring-3 ring-primary/20")}><span className={cn("size-2 rounded-full", live ? "bg-primary" : "bg-muted-foreground/40")} /></span>
              <span className="pt-0.5 text-xs text-muted-foreground tabular-nums">{card.decisive ? fmtDay(card.decisive.start, card.decisive.zone) : "–"}</span>
              <Link href={`/orders/${card.id}`} className="group min-w-0">
                <span className="block truncate text-[13px] group-hover:underline">{detail?.roles[card.id] ?? "Order"} · {card.vehicle}</span>
                <span className="flex items-center gap-1 truncate text-xs text-muted-foreground"><span className="font-mono">{card.reference}</span> · {card.from.city}<ArrowRightIcon className="size-3" aria-hidden="true" />{card.to.city} · {laneLabel(card.displayLane)}</span>
              </Link>
              <span className="relative h-9 w-14 overflow-hidden rounded-md bg-muted">{image && <Image src={image} alt="" fill sizes="56px" className="object-cover" />}</span>
            </li>
          })}
        </ol>
      </section>

      {detail && detail.notes.length > 0 && <Collapsible className="group/notes p-4">
        <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-[13px] font-medium">
          <ChevronRightIcon className="size-3.5 transition-transform group-data-[state=open]/notes:rotate-90" aria-hidden="true" />Site procedures
          <span className="ml-auto text-xs font-normal text-muted-foreground">{detail.notes.length}</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-2 pt-3">
          {detail.notes.map((note) => <p key={note} className="text-xs leading-relaxed text-muted-foreground">{note}</p>)}
        </CollapsibleContent>
      </Collapsible>}
      <p className="px-4 pb-4"><Link href={place.href} className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">Open the full place record</Link></p>
    </div>
  </>
}

/** The model illustrations of the cars that pass through this place, most common model first. */
function CarsStrip({ cards }: { cards: BoardCard[] | null }) {
  if (!cards) return <div className="border-b p-4"><Skeleton className="h-36 w-full rounded-xl" /></div>
  const models = [...cards.reduce((map, card) => map.set(card.vehicle, (map.get(card.vehicle) ?? 0) + 1), new Map<string, number>()).entries()]
    .sort((a, b) => b[1] - a[1]).filter(([vehicle]) => carImage(vehicle))
  if (!models.length) return null
  const [first, ...rest] = models
  return <section className="flex flex-col gap-2 border-b p-4" aria-label="Cars through this place">
    <div className="flex items-baseline justify-between">
      <h3 className="text-[13px] font-medium">Cars through this place</h3>
      <span className="text-xs text-muted-foreground">{cards.length} {cards.length === 1 ? "car" : "cars"} · {models.length} {models.length === 1 ? "model" : "models"}</span>
    </div>
    <figure className="relative aspect-[16/7] overflow-hidden rounded-xl bg-muted">
      <Image src={carImage(first[0])!} alt={`Illustration of a ${first[0]}`} fill sizes="400px" className="object-cover" />
      <figcaption className="absolute bottom-2 left-2 rounded-md bg-background/85 px-2 py-0.5 text-xs backdrop-blur">{first[0]}{first[1] > 1 ? ` · ${first[1]} orders` : ""}</figcaption>
    </figure>
    {rest.length > 0 && <div className="grid grid-cols-3 gap-2">
      {rest.slice(0, 3).map(([vehicle, count]) => <figure key={vehicle} className="flex flex-col gap-1">
        <span className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted"><Image src={carImage(vehicle)!} alt={`Illustration of a ${vehicle}`} fill sizes="130px" className="object-cover" /></span>
        <figcaption className="truncate text-[11px] text-muted-foreground">{vehicle}{count > 1 ? ` · ${count}` : ""}</figcaption>
      </figure>)}
    </div>}
    <p className="text-[11px] text-muted-foreground">Model illustrations. They are not photos of these cars.</p>
  </section>
}

type Attachment = { id: string; kind: string; content_type: string; captured_at: string | null; url?: string; order_id: string }
const PHOTO_ROLE: Record<string, string> = { PICKUP_PHOTOS: "Pickup", TRADE_IN_PICKUP_PHOTOS: "Pickup", KEY_PICKUP_PHOTOS: "Pickup", DELIVERY_PHOTOS: "Delivery", TRADE_IN_DELIVERY_PHOTOS: "Delivery" }
const PHOTO_LABEL: Record<string, string> = { PICKUP_PHOTOS: "Pickup photo", TRADE_IN_PICKUP_PHOTOS: "Trade-in pickup", KEY_PICKUP_PHOTOS: "Key handover", DELIVERY_PHOTOS: "Delivery photo", TRADE_IN_DELIVERY_PHOTOS: "Trade-in delivery", SITE_VISIT_PHOTO: "Site visit" }

/** Photos taken at this place: pickup photos from orders it hands over, delivery photos from orders it receives. */
function PlacePhotos({ detail }: { detail: EntityView | null }) {
  const [photos, setPhotos] = useState<(Attachment & { reference: string })[] | null>(null)
  useEffect(() => {
    setPhotos(null)
    if (!detail) return
    const controller = new AbortController()
    Promise.all(detail.cards.map((card) => fetch(`/api/orders/${card.id}/attachments`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ attachments: Attachment[] }> : { attachments: [] })
      .then((data) => data.attachments.filter((item) => item.url && item.content_type.startsWith("image/"))
        .filter((item) => item.kind === "SITE_VISIT_PHOTO" || (detail.roles[card.id] ?? "").includes(PHOTO_ROLE[item.kind] ?? "none"))
        .map((item) => ({ ...item, reference: card.reference })))))
      .then((groups) => setPhotos(groups.flat()))
      .catch(() => { if (!controller.signal.aborted) setPhotos([]) })
    return () => controller.abort()
  }, [detail])
  if (!photos || photos.length === 0) return null
  return <section className="flex flex-col gap-2 border-b p-4" aria-label="Photos from this place">
    <div className="flex items-baseline justify-between">
      <h3 className="text-[13px] font-medium">Photos from this place</h3>
      <span className="text-xs text-muted-foreground">{photos.length} from the order records</span>
    </div>
    <div className="grid grid-cols-3 gap-2">
      {photos.slice(0, 6).map((photo) => <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className="group flex flex-col gap-1">
        <span className="relative aspect-square overflow-hidden rounded-lg bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed URLs from the local store change every load */}
          <img src={photo.url} alt={`${PHOTO_LABEL[photo.kind] ?? "Photo"} for ${photo.reference}`} className="size-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
        </span>
        <span className="truncate text-[11px] text-muted-foreground">{PHOTO_LABEL[photo.kind] ?? "Photo"} · {photo.reference}</span>
      </a>)}
    </div>
  </section>
}

/** Up to three car thumbnails, overlapped, for the models that pass through a place. */
function CarStack({ vehicles, fallback: Fallback }: { vehicles: string[]; fallback: LucideIcon }) {
  const images = vehicles.map(carImage).filter((src): src is string => !!src).slice(0, 3)
  if (!images.length) return <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-muted/60"><Fallback className="size-4 text-muted-foreground" aria-hidden="true" /></span>
  return <span className="flex shrink-0 items-center" aria-hidden="true">
    {images.map((src, index) => <span key={src} className={cn("relative h-5 w-7 shrink-0 overflow-hidden rounded bg-muted ring-2 ring-background", index > 0 && "-ml-2")} style={{ zIndex: 3 - index }}>
      <Image src={src} alt="" fill sizes="48px" className="object-cover" />
    </span>)}
  </span>
}

/** An example photo of this kind of place, with its credit. The site itself is fictional. */
function BranchPhoto({ place }: { place: PlaceRow }) {
  const image = branchImage(place.id, place.kind)
  return <figure className="relative aspect-[16/8] shrink-0 overflow-hidden border-b bg-muted">
    <Image src={image.src} alt={`Example photo: ${image.title}`} fill sizes="420px" className="object-cover" priority />
    <span className="absolute top-2 left-2 rounded-md bg-background/85 px-2 py-0.5 text-[11px] backdrop-blur">Example photo</span>
    <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-6 pb-2 text-[10px] text-white/85">
      <a href={image.page} target="_blank" rel="noreferrer" className="hover:underline">{image.title}</a> · {image.author} · {image.license}
    </figcaption>
  </figure>
}
