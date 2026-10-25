"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { AppFrame } from "../components/app-frame"
import { ControlError, useControl, type StopModel, type TrackedCar, type TrackingView } from "../components/control"
import { CardChecks, StopFacts, StopModels, StopRanking, StopSteps } from "../components/stop-check"
import { Chip, More } from "../components/ui"

/* The live map: every car on the road at the clock time. A plain rule watches each track.
   When a car stands still too long, the agent checks the places around it and Jev ranks them.
   Then the agent closes the stop quietly, asks the driver, or brings a person one card. */

const LiveMap = dynamic(() => import("../components/track-map"), { ssr: false, loading: () => <Skeleton className="size-full rounded-none" /> })

type Mark = { text: string; tone: "danger" | "warn" | "ok" | "neutral" }

function markOf(car: TrackedCar): Mark {
  const run = car.event?.runStatus
  if (car.status === "stopped") {
    if (run === "card") return { text: "Card for a person", tone: "danger" }
    if (run === "running") return { text: "Agent checking", tone: "warn" }
    if (run === "quiet") return { text: "Closed by the agent", tone: "ok" }
    return { text: car.ruleFired ? "Rule fired" : "Standing, under 20 min", tone: car.ruleFired ? "warn" : "neutral" }
  }
  if (car.status === "signal_lost") return { text: run === "card" ? "Card for a person" : run === "quiet" ? "Closed by the agent" : "No GPS", tone: run === "card" ? "danger" : "neutral" }
  if (run === "quiet") return { text: "Stop closed by the agent", tone: "ok" }
  if (run === "card") return { text: "Card for a person", tone: "danger" }
  return { text: car.status === "arrived" ? "Arrived" : "Moving", tone: "neutral" }
}

const ORDER: Record<Mark["tone"], number> = { danger: 0, warn: 1, ok: 2, neutral: 3 }

function statusLine(car: TrackedCar) {
  if (car.status === "stopped") return `Standing ${car.stoppedFor ?? `${car.stoppedMinutes} min`} · GPS ${car.gpsAge === "now" ? "fresh" : car.gpsAge}`
  if (car.status === "signal_lost") return `No GPS for ${car.gpsAge.replace(/ ago$/, "")}`
  if (car.status === "arrived") return `Arrived in ${car.to.city}`
  return `${car.from.city} → ${car.to.city}`
}

function CarRow({ car, onClick }: { car: TrackedCar; onClick: () => void }) {
  const mark = markOf(car)
  return <li>
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 border-b px-4 py-2.5 text-left outline-none hover:bg-accent/60 focus-visible:bg-accent">
      <span className={cn("size-2.5 shrink-0 rounded-full", car.status === "stopped" ? (mark.tone === "danger" ? "bg-danger" : mark.tone === "ok" ? "bg-muted-foreground" : "bg-warning") : car.status === "signal_lost" ? "border-2 border-dashed border-muted-foreground" : "bg-foreground/70")} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{car.car} <span className="font-normal text-muted-foreground">· {car.orderRef}</span></span>
        <span className="block truncate text-xs text-muted-foreground">{car.driver} · {statusLine(car)}</span>
      </span>
      {mark.tone !== "neutral" && <Chip tone={mark.tone} className="shrink-0">{mark.text}</Chip>}
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  </li>
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="flex flex-col gap-2">
    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
    {children}
  </section>
}

// What a person reads when the agent has not checked the stop (yet).
function notRunText(car: TrackedCar) {
  const feed = car.event?.feed
  if (feed?.state === "upcoming") return `The stop rule fires at ${feed.at}. Then the agent checks the places and the models rank the cause.`
  if (feed?.state === "missed") return `This event is on ${feed.at}, and the clock passed it on live time, so the agent did not run. Use Time in the top bar to go to 21 Oct 08:55 UTC and replay it.`
  if (feed?.state === "due") return "The event is due. The agent starts within seconds."
  return "The agent has not checked this event."
}

function Detail({ car, models, back }: { car: TrackedCar; models: StopModel[]; back: () => void }) {
  const event = car.event
  const stop = event?.stop
  const mark = markOf(car)
  return <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
    <div className="flex flex-col gap-2 border-b px-4 py-3">
      <button type="button" onClick={back} className="-ml-1 flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ChevronLeftIcon className="size-3.5" aria-hidden="true" />All cars</button>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">{car.car}</h2>
        <Chip tone={mark.tone}>{mark.text}</Chip>
      </div>
      <p className="text-xs text-muted-foreground">
        <Link href={`/orders/${car.orderId}`} className="underline underline-offset-4">{car.orderRef}</Link> · {car.driver} · {car.customer} · {car.from.city} → {car.to.city}
      </p>
      <p className="text-[13px]">{statusLine(car)}</p>
    </div>

    {event?.cardId && <div className="border-b px-4 py-3">
      <Link href={`/decisions/${event.cardId}`} className="flex items-center justify-between rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
        <span>The agent brought a person one decision</span><ChevronRightIcon className="size-4" aria-hidden="true" />
      </Link>
    </div>}
    {event?.quietReason && <p className="border-b px-4 py-3 text-[13px]"><span className="font-medium">Closed without a person.</span> <span className="text-muted-foreground">{event.quietReason}</span></p>}

    {stop ? <div className="flex flex-col gap-5 px-4 py-4">
      <StopFacts stop={stop} />
      <StopRanking stop={stop} />
      {event.checks.length > 0 && <Section title="How the models checked the card"><CardChecks checks={event.checks} /></Section>}
      {event.steps.length > 0 && <Section title="What the agent did"><StopSteps steps={event.steps} /></Section>}
      <Section title="Models on this stop"><StopModels models={models} /></Section>
    </div> : event ? <div className="flex flex-col gap-5 px-4 py-4">
      <div className="flex flex-col gap-2 text-[13px]">
        <p><span className="font-medium">{event.title}.</span> <span className="text-muted-foreground">{event.runStatus ? `The agent ${event.runStatus === "running" ? "works on it now" : "handled this event"}.` : notRunText(car)}</span></p>
        <Link href={`/orders/${car.orderId}#agent`} className="w-fit text-xs underline underline-offset-4">Every agent step on the order</Link>
      </div>
      {event.checks.length > 0 && <Section title="How the models checked the card"><CardChecks checks={event.checks} /></Section>}
      <Section title={event.kind === "long_stop" ? "Models that will work on this stop" : "Models on this event"}><StopModels models={event.kind === "long_stop" ? models : models.slice(-1)} /></Section>
    </div> : car.status === "stopped" ? <p className="px-4 py-4 text-[13px] text-muted-foreground">The car stands still, but the rule needs 20 min before the agent checks it.</p>
      : <p className="px-4 py-4 text-[13px] text-muted-foreground">Nothing to check. The car moves as planned.</p>}
  </div>
}

export default function LivePage() {
  const { data, error, offline } = useControl<TrackingView>("view=tracking", true)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    const order = new URLSearchParams(window.location.search).get("order")
    if (order) setSelected(order)
  }, [])
  const choose = (orderId: string | null) => {
    setSelected(orderId)
    const url = new URL(window.location.href)
    if (orderId) url.searchParams.set("order", orderId)
    else url.searchParams.delete("order")
    window.history.replaceState(null, "", url)
  }

  const cars = useMemo(() => data?.cars ?? [], [data])
  const chosen = cars.find((car) => car.orderId === selected || car.orderRef === selected) ?? null
  const { look, moving } = useMemo(() => {
    const sorted = [...cars].sort((a, b) => ORDER[markOf(a).tone] - ORDER[markOf(b).tone] || a.orderRef.localeCompare(b.orderRef))
    const look = sorted.filter((car) => car.status === "stopped" || car.status === "signal_lost" || markOf(car).tone !== "neutral")
    return { look, moving: sorted.filter((car) => !look.includes(car)) }
  }, [cars])

  return <AppFrame section="live" board>
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[26rem_minmax(0,1fr)]">
      <section className="flex min-h-0 min-w-0 flex-col border-b lg:border-r lg:border-b-0" aria-label={chosen ? "Car detail" : "Cars on the road"}>
        {error && <div className="p-4"><ControlError error={error} offline={offline} /></div>}
        {chosen ? <Detail car={chosen} models={data?.models ?? []} back={() => choose(null)} /> : <>
          <div className="flex flex-col gap-2 border-b px-4 py-3">
            <h1 className="text-base font-semibold">Live map</h1>
            <p className="text-xs text-muted-foreground">Every car on the road. The stop rule: {data?.rule.toLowerCase() ?? "…"}. Then the agent checks the places nearby and Jev ranks why the car stopped.</p>
            {data && <div className="flex flex-wrap gap-1.5">
              <Chip tone="neutral">{data.counts.moving} moving</Chip>
              <Chip tone={data.counts.stopped ? "warn" : "neutral"}>{data.counts.stopped} standing</Chip>
              <Chip tone="neutral">{data.counts.signalLost} without GPS</Chip>
            </div>}
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {!data && !error && [0, 1, 2, 3].map((index) => <li key={index} className="flex gap-3 border-b px-4 py-3"><Skeleton className="size-3 rounded-full" /><Skeleton className="h-8 flex-1" /></li>)}
            {data && look.length === 0 && <li className="px-4 py-4 text-sm text-muted-foreground">No car stands still and every GPS signal is fresh.</li>}
            {look.map((car) => <CarRow key={car.orderId} car={car} onClick={() => choose(car.orderId)} />)}
            {moving.length > 0 && <li className="px-4 py-3">
              <More label={`${moving.length} cars moving as planned`}>
                <ul className="-mx-4">{moving.map((car) => <CarRow key={car.orderId} car={car} onClick={() => choose(car.orderId)} />)}</ul>
              </More>
            </li>}
          </ul>
        </>}
      </section>
      <section className="relative min-h-[28rem] min-w-0 overflow-hidden" aria-label="Map">
        {data && <LiveMap cars={cars} selected={chosen?.orderId ?? null} onSelect={choose} />}
        <p className="pointer-events-none absolute top-3 left-3 z-[400] rounded-md bg-background/85 px-2 py-1 text-[11px] text-muted-foreground shadow-xs backdrop-blur">
          Routes are straight lines between cities. Stop points and places are simulated.
        </p>
      </section>
    </div>
  </AppFrame>
}
