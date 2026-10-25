"use client"

import dynamic from "next/dynamic"
import Image from "next/image"
import Link from "next/link"
import { useMemo } from "react"
import { AlertTriangle as AlertIcon, CheckCircle, Clock, Flag01, MarkerPin01 } from "@untitledui/icons"
import { Skeleton } from "@/components/ui/skeleton"
import { driverPhoto } from "@/lib/driver-photos"
import { cityPosition } from "@/lib/geo"
import { fmtDateTime, fmtDay, relativeTo } from "@/lib/present/time"
import type { JourneyStep, RecordView, TrackingView } from "@/lib/present/types"
import { cn } from "@/lib/utils"
import { LaneIcon } from "../status-icons"
import { Monogram, TONE_TEXT } from "../ui"

const RouteMap = dynamic(() => import("./route-map"), { ssr: false, loading: () => <Skeleton className="size-full rounded-none" /> })

/* The car as a dashboard, after the vehicle-detail reference. It shows the car with three gauges,
   a map with specs, activity per day and the next deadlines. Every value comes from the order record. */

function primaryJourney(view: RecordView) {
  const group = view.journey.groups.find((item) => item.role === "PRIMARY") ?? view.journey.groups[0]
  const steps = group?.steps ?? []
  const legs = group?.legs ?? []
  const leg = legs.find((item) => item.tracking || item.inference) ?? legs[0] ?? null
  const tracking: TrackingView | null = leg?.tracking ?? leg?.inference ?? null
  return { steps, leg, tracking }
}

export function CarDashboard({ view }: { view: RecordView }) {
  const { header } = view
  const vehicle = header.vehicle
  const { steps, leg, tracking } = primaryJourney(view)
  const pickup = steps.find((step) => step.role === "PICKUP") ?? steps[0]
  const delivery = [...steps].reverse().find((step) => step.role === "DELIVERY") ?? steps[steps.length - 1]
  const distance = view.journey.distanceKm ?? leg?.distanceKm ?? null
  const delivered = header.lane === "delivered"
  const progress = delivered ? 1 : tracking?.progress ?? (pickup?.recorded ? 0.05 : 0)
  const open = view.attention.length

  return <div className="flex flex-col gap-4">
  <header className="flex flex-col gap-3">
    <div className="flex flex-wrap gap-2" aria-label="Order totals">
      <Pill><LaneIcon lane={header.lane} />{header.laneLabel}</Pill>
      <Pill>Reference <span className="font-mono font-medium text-foreground">{header.reference}</span></Pill>
      <Pill>Route <span className="font-medium text-foreground">{header.routeKindLabel}{distance ? ` · ${distance} km` : ""}</span></Pill>
      {open > 0 && <Pill className="text-warning"><AlertIcon className="size-3.5" aria-hidden="true" />Need a person <span className="font-mono font-medium">{open}</span></Pill>}
    </div>
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{vehicle?.title ?? "Vehicle not linked"}</h1>
      <p className="text-[13px] text-muted-foreground">{header.customer.name} · {pickup?.place.city ?? "?"} → {delivery?.place.city ?? "?"} · <span className="font-mono">{vehicle?.vin ?? "No VIN"}</span></p>
    </div>
  </header>
  <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_21rem]" aria-label="Car overview">
    <div className="grid overflow-hidden rounded-xl border bg-card lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4 p-4">
        <div className="relative mx-auto aspect-[16/8] w-full max-w-xl overflow-hidden rounded-xl bg-muted">
          {vehicle?.illustrationSlug && <Image src={`/car-images/${vehicle.illustrationSlug}.webp`} alt={`Illustration of a ${vehicle.title}`} fill sizes="600px" className="object-cover" priority />}
          <span className="absolute top-2 left-2 rounded-md bg-background/85 px-2 py-0.5 text-[11px] text-muted-foreground backdrop-blur">Model illustration</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <EndPoint step={pickup} label="Pickup" icon={MarkerPin01} />
          <EndPoint step={delivery} label="Delivery" icon={Flag01} align="right" />
        </div>
      </div>
      <div className="flex flex-col border-t lg:border-t-0 lg:border-l">
        <div className="relative h-56 shrink-0 lg:h-64">
          <MapOrNote from={pickup} to={delivery} progress={progress} tracking={tracking} />
        </div>
        <dl className="grid flex-1 content-start gap-y-2 px-4 py-3.5 text-[13px]">
          <Spec label="Make">{vehicle?.make ?? "–"}</Spec>
          <Spec label="Model">{vehicle?.model ?? "–"}</Spec>
          <Spec label="Year">{vehicle?.year ?? "Not recorded"}</Spec>
          <Spec label="Fuel">{vehicle?.fuel ?? "Not recorded"}</Spec>
          <Spec label="Registration"><span className="font-mono">{vehicle?.plate ?? "No plate"}</span></Spec>
          <Spec label="Route">{header.routeKindLabel}{distance ? ` · ${distance} km` : ""}</Spec>
          <Spec label="Customer"><Link href={`/customers/${header.customer.id}`} className="hover:underline">{header.customer.name}</Link></Spec>
          <Spec label="Reference"><span className="font-mono">{header.reference}</span></Spec>
        </dl>
      </div>
    </div>

    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
      <ActivityCard view={view} />
      <DeadlinesCard view={view} steps={steps} tracking={tracking} />
    </div>
  </section>
  </div>
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border bg-card px-3 text-xs text-muted-foreground", className)}>{children}</span>
}

function EndPoint({ step, label, icon: Icon, align = "left" }: { step: JourneyStep | undefined; label: string; icon: typeof Flag01; align?: "left" | "right" }) {
  if (!step) return <div />
  const flagged = step.access?.tone === "warn" || step.access?.tone === "danger" || step.contact?.tone === "warn"
  return <div className={cn("flex flex-col gap-0.5 border-t-2 pt-2", step.recorded ? "border-primary" : "border-border", align === "right" && "items-end text-right")}>
    <span className={cn("inline-flex items-center gap-1 text-xs", flagged ? "text-warning" : "text-muted-foreground")}>{flagged ? <AlertIcon className="size-3.5" aria-hidden="true" /> : <Icon className="size-3.5" aria-hidden="true" />}{label}</span>
    <span className="text-[15px] font-semibold">{step.place.city}{step.place.country ? `, ${step.place.country}` : ""}</span>
    <span className="text-xs text-muted-foreground">{step.recorded ? `${step.recorded.label} ${fmtDay(step.recorded.at, step.place.zone)}` : step.access?.statusLabel ?? step.place.kindLabel}</span>
  </div>
}

function MapOrNote({ from, to, progress, tracking }: { from: JourneyStep | undefined; to: JourneyStep | undefined; progress: number; tracking: TrackingView | null }) {
  const a = from ? cityPosition(from.place.city, from.place.country) : null
  const b = to ? cityPosition(to.place.city, to.place.country) : null
  if (!a || !b) return <div className="grid size-full place-items-center bg-muted text-xs text-muted-foreground">No map for this route.</div>
  const moving = progress > 0 && progress < 1
  const car: [number, number] | null = moving ? [a[0] + (b[0] - a[0]) * progress, a[1] + (b[1] - a[1]) * progress] : null
  return <>
    <RouteMap from={a} to={b} car={car} carLabel={tracking?.observedAt ? `Estimated · ${tracking.qualityLabel}` : "Estimated"} />
    <p className="pointer-events-none absolute right-2 bottom-2 z-[400] rounded-md bg-background/85 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur">
      City level. The car point is the route share, not GPS.
    </p>
  </>
}

function Spec({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex gap-2"><dt className="text-muted-foreground">{label}:</dt><dd className="min-w-0 truncate font-medium">{children}</dd></div>
}

/** Events per day on this order, for the 7 days up to the snapshot. One line, a hover target per day. */
function ActivityCard({ view }: { view: RecordView }) {
  const days = useMemo(() => {
    const end = view.snapshotAt ? Date.parse(view.snapshotAt) : Date.now()
    return Array.from({ length: 7 }, (_, index) => {
      const key = new Date(end - (6 - index) * 86400000).toISOString().slice(0, 10)
      return { key, count: view.history.find((day) => day.key === key)?.events.length ?? 0 }
    })
  }, [view])
  const total = days.reduce((sum, day) => sum + day.count, 0)
  const max = Math.max(1, ...days.map((day) => day.count))
  const w = 300, h = 90
  const x = (i: number) => 12 + i * ((w - 24) / 6)
  const y = (v: number) => h - 14 - v / max * (h - 30)
  const path = days.map((day, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(day.count).toFixed(1)}`).join(" ")
  const peak = days.reduce((best, day, i) => day.count > days[best].count ? i : best, 0)
  return <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
    <div className="flex items-baseline justify-between"><h2 className="text-[13px] font-medium">Activity</h2><a href="#activity" className="text-xs text-muted-foreground hover:text-foreground">View all</a></div>
    <p className="text-xs text-muted-foreground">Events in the last 7 days <span className="ml-1 font-mono text-xl font-semibold text-foreground tabular-nums">{total}</span></p>
    <svg viewBox={`0 0 ${w} ${h + 14}`} className="w-full text-chart-1" role="img" aria-label={`Events per day: ${days.map((day) => `${day.key} ${day.count}`).join(", ")}`}>
      <path d={`${path} L${x(6)},${h - 14} L${x(0)},${h - 14} Z`} fill="currentColor" opacity="0.1" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      {days[peak].count > 0 && <line x1={x(peak)} x2={x(peak)} y1={6} y2={h - 14} stroke="var(--foreground)" strokeWidth="1" opacity="0.4" />}
      {days.map((day, i) => <g key={day.key}>
        <circle cx={x(i)} cy={y(day.count)} r={i === peak && day.count ? 4.5 : 3} fill={i === peak && day.count ? "var(--background)" : "currentColor"} stroke="currentColor" strokeWidth="2" />
        <rect x={x(i) - 20} y="0" width="40" height={h} fill="transparent"><title>{`${day.key}: ${day.count} events`}</title></rect>
        <text x={x(i)} y={h + 10} textAnchor="middle" className="fill-muted-foreground text-[9px]">{fmtDay(`${day.key}T12:00:00Z`)}</text>
      </g>)}
    </svg>
  </div>
}

/** The next time windows and the ETA on this order, in time order. */
function DeadlinesCard({ view, steps, tracking }: { view: RecordView; steps: JourneyStep[]; tracking: TrackingView | null }) {
  const items = useMemo(() => {
    const list: { label: string; at: string; zone: string | null; where: string }[] = []
    for (const step of steps) for (const window of step.windows) {
      if (window.purpose.includes("AVAILABILITY")) continue
      list.push({ label: window.label, at: window.end ?? window.start, zone: window.zone, where: step.place.city })
    }
    if (tracking?.eta) list.push({ label: "ETA", at: tracking.eta, zone: null, where: tracking.sourceLabel })
    const now = view.snapshotAt ?? ""
    const upcoming = list.filter((item) => item.at >= now).sort((a, b) => a.at.localeCompare(b.at))
    return (upcoming.length ? upcoming : list.sort((a, b) => b.at.localeCompare(a.at))).slice(0, 4)
  }, [steps, tracking, view.snapshotAt])
  const driver = view.assignments.find((item) => item.status === "IN_PROGRESS") ?? view.assignments[0]
  return <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
    <div className="flex items-baseline justify-between"><h2 className="text-[13px] font-medium">Deadlines <span className="font-mono text-xs text-muted-foreground">{items.length}</span></h2><Clock className="size-4 text-muted-foreground" aria-hidden="true" /></div>
    {items.length === 0 && <p className="text-xs text-muted-foreground">No time windows on this order.</p>}
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      {items.map((item, index) => {
        const rel = relativeTo(item.at, view.snapshotAt)
        return <div key={index} className="border-l-2 border-border pl-2.5">
          <p className="font-mono text-[13px] font-medium text-foreground tabular-nums">{fmtDateTime(item.at, item.zone)}</p>
          <p className="text-[11px] text-muted-foreground">{item.label} · {item.where}{rel ? ` · ${rel.text}` : ""}</p>
        </div>
      })}
    </div>
    {driver && <div className="flex items-center justify-between border-t pt-3 text-[13px]">
      <span className="text-xs text-muted-foreground">Driver</span>
      <span className="flex items-center gap-2"><Monogram name={driver.driver.name} photo={driverPhoto(driver.driver.id)} className="size-6 text-[9px]" />{driver.driver.id ? <Link href={`/drivers/${driver.driver.id}`} className="font-medium hover:underline">{driver.driver.name}</Link> : driver.driver.name}</span>
    </div>}
  </div>
}

/** The driver card for the Overview tab, after the profile row in the reference. */
export function DriverCard({ view }: { view: RecordView }) {
  const assignment = view.assignments.find((item) => item.status === "IN_PROGRESS") ?? view.assignments.find((item) => item.status === "ASSIGNED") ?? view.assignments[0]
  const { header } = view
  const info: [string, string][] = [[header.customerReference ?? "–", "Customer reference"], [fmtDateTime(header.createdAt), "Order created"], [header.readinessLabel ?? "–", "Readiness"], [header.source ?? "–", "Source"]]
  return <div className="grid gap-5 rounded-xl border bg-card p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]">
    <div className="flex items-center gap-4">
      {assignment ? <>
        <Monogram name={assignment.driver.name} photo={driverPhoto(assignment.driver.id)} className="size-12 text-sm" />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">{assignment.driver.id ? <Link href={`/drivers/${assignment.driver.id}`} className="hover:underline">{assignment.driver.name}</Link> : assignment.driver.name}</p>
          <p className="text-xs text-muted-foreground">{assignment.driverHome ? `Home base ${assignment.driverHome}` : "Driver"}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs", TONE_TEXT[assignment.tone])}><span className="size-1.5 rounded-full bg-current" aria-hidden="true" />{assignment.statusLabel}</span>
            {assignment.fee && <span className="rounded-md border px-2 py-0.5 font-mono text-xs tabular-nums">{assignment.fee}</span>}
            <span className="rounded-md border px-2 py-0.5 text-xs">{header.routeKindLabel}</span>
          </div>
        </div>
      </> : <p className="text-[13px] text-muted-foreground">No driver on this order yet.</p>}
    </div>
    <dl className="grid content-center gap-y-2 text-[13px] md:border-l md:pl-5">
      <Spec label="Accepted">{assignment?.acceptedAt ? fmtDateTime(assignment.acceptedAt) : "–"}</Spec>
      <Spec label="Started">{assignment?.startedAt ? fmtDateTime(assignment.startedAt) : "–"}</Spec>
      <Spec label="Completed">{assignment?.completedAt ? fmtDateTime(assignment.completedAt) : "–"}</Spec>
    </dl>
    <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3.5 md:col-span-2 xl:col-span-1">
      <p className="text-sm font-semibold">Info</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">{info.map(([value, label]) => <div key={label} className="min-w-0">
        <span className="block truncate text-[13px] font-medium">{value}</span><span className="text-[11px] text-muted-foreground">{label}</span>
      </div>)}</div>
      {header.vehicle && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><CheckCircle className="size-3" aria-hidden="true" />Synthetic VIN and plate</span>}
    </div>
  </div>
}
