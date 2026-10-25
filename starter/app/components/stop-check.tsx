"use client"

import { BotIcon, CircleCheckIcon, MapPinIcon, MessageCircleIcon, SquareCheckIcon, TriangleAlertIcon, type LucideIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import type { CardCheck, Ranked, StopModel, StopStep, StopView } from "./control"

/* The GPS stop check for a person: what the rule saw, what is near the stop, and how Jev ranked
   the places and the cause. Then the agent's steps: what it asked the driver and how it ended. */

const pct = (p: number) => `${Math.round(p * 100)}%`

/** The places of a stop, ranked by Jev: 1 is the place Jev finds most likely to explain the stop. */
export function rankedPlaces(stop: StopView) {
  return [...stop.places].sort((a, b) => (b.probability ?? -1) - (a.probability ?? -1) || a.distanceM - b.distanceM).map((place, index) => ({ place, rank: index + 1 }))
}

function Bar({ value, strong }: { value: number; strong: boolean }) {
  return <span className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
    <span className={cn("absolute inset-y-0 left-0 rounded-full", strong ? "bg-primary" : "bg-muted-foreground/40")} style={{ width: `${Math.max(2, Math.round(value * 100))}%` }} />
  </span>
}

function CauseList({ causes }: { causes: Ranked[] }) {
  return <ul className="flex flex-col gap-1.5">
    {causes.filter((cause, index) => index < 3 || cause.probability >= 0.05).map((cause, index) => <li key={cause.id} className="grid grid-cols-[9.5rem_minmax(0,1fr)_2.75rem] items-center gap-2 text-[13px]">
      <span className={cn(index === 0 ? "font-medium" : "text-muted-foreground")}>{cause.label}</span>
      <Bar value={cause.probability} strong={index === 0} />
      <span className="text-right font-mono text-xs tabular-nums text-muted-foreground">{pct(cause.probability)}</span>
    </li>)}
  </ul>
}

export function StopFacts({ stop }: { stop: StopView }) {
  return <dl className="grid grid-cols-3 gap-2 text-[13px]">
    {([
      ["Standing when checked", `${stop.stoppedMinutes} min`],
      ["GPS age", stop.gpsAgeMinutes <= 1 ? "Fresh (1 min)" : stop.gpsAgeMinutes > 60 ? `Old: ${Math.floor(stop.gpsAgeMinutes / 60)} h ${stop.gpsAgeMinutes % 60} min` : `${stop.gpsAgeMinutes} min`],
      ["Places from", stop.provider === "google" ? "Google Places" : "Simulated"],
    ] as const).map(([label, value]) => <div key={label} className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-muted/50 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn(label === "GPS age" && stop.gpsAgeMinutes > 60 && "text-warning")}>{value}</dd>
    </div>)}
  </dl>
}

export function StopRanking({ stop }: { stop: StopView }) {
  const ranking = stop.ranking
  const ranked = rankedPlaces(stop)
  const none = ranking?.places.find((place) => place.id === "none")
  const topIsNone = ranking?.places[0]?.id === "none"
  return <div className="flex flex-col gap-4">
    {ranking && <div className="flex flex-col gap-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Why did it stop?</p>
      <CauseList causes={ranking.causes} />
    </div>}
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">What is near the stop</p>
      {stop.places.length === 0 ? <p className="text-sm text-muted-foreground">Nothing within the search radius.</p> : <ol className="flex flex-col gap-1">
        {ranked.map(({ place, rank }) => {
          const top = Boolean(ranking) && rank === 1 && !topIsNone
          return <li key={place.id} className={cn("grid grid-cols-[1.5rem_minmax(0,1fr)_2.75rem] items-center gap-x-2 gap-y-1 rounded-lg px-2 py-1.5", top && "bg-primary/8")}>
            <span className={cn("grid size-5 place-items-center rounded-full border text-[11px] font-semibold", top ? "border-primary bg-primary text-primary-foreground" : "border-foreground/60")}>{rank}</span>
            <span className="min-w-0 text-[13px]"><span className={cn(top && "font-medium")}>{place.name}</span> <span className="text-xs text-muted-foreground">· {place.typeLabel} · {place.distanceM} m{place.openNow == null ? "" : place.openNow ? " · open" : " · closed"}</span></span>
            <span className="text-right font-mono text-xs tabular-nums text-muted-foreground">{place.probability != null ? pct(place.probability) : ""}</span>
            {place.probability != null && <span className="col-start-2"><Bar value={place.probability} strong={top} /></span>}
          </li>
        })}
        {none && <li className={cn("grid grid-cols-[1.5rem_minmax(0,1fr)_2.75rem] items-center gap-x-2 gap-y-1 rounded-lg px-2 py-1.5", topIsNone && "bg-warning/10")}>
          <span className="grid size-5 place-items-center text-muted-foreground" aria-hidden="true">–</span>
          <span className={cn("text-[13px]", topIsNone ? "font-medium text-warning" : "text-muted-foreground")}>None of these places explains the stop</span>
          <span className="text-right font-mono text-xs tabular-nums text-muted-foreground">{pct(none.probability)}</span>
          <span className="col-start-2"><Bar value={none.probability} strong={topIsNone} /></span>
        </li>}
      </ol>}
    </div>
    {ranking?.others && ranking.others.length > 0 && <ModelComparison stop={stop} />}
    <p className="text-xs text-muted-foreground">
      {ranking
        ? ranking.byJev
          ? <>Ranked by Jev ({ranking.model}) in {ranking.ms} ms{ranking.costUsd != null ? ` for $${ranking.costUsd.toFixed(5)}` : ""}{ranking.driverReplySeen ? ", with the driver's reply" : ""}. A ranking is a likelihood, not proof.</>
          : <>Ranked by plain rules, because Jev is not connected. A ranking is a likelihood, not proof.</>
        : "Not ranked yet."}
    </p>
  </div>
}

const STEP: Record<StopStep["kind"], { icon: LucideIcon; label: string }> = {
  rule: { icon: TriangleAlertIcon, label: "Stop rule" },
  places: { icon: MapPinIcon, label: "Places lookup" },
  ranking: { icon: BotIcon, label: "Jev ranking" },
  ask: { icon: MessageCircleIcon, label: "Agent to driver" },
  reply: { icon: MessageCircleIcon, label: "Driver" },
  outcome: { icon: SquareCheckIcon, label: "Outcome" },
}

type RankDetail = {
  next_step?: string; why?: string; causes?: { label: string; probability: number }[]; places?: { name: string; probability: number }[]
  second_opinions?: { model: string; top_place?: string; top_cause?: string; agrees_with_jev: boolean }[]
}
type PlacesDetail = { places?: unknown[]; provider?: string; radius_m?: number }

const NEXT: Record<string, string> = { close_quietly: "Close quietly", ask_driver: "Ask the driver", card: "Bring a person a card" }

/** The agent's steps on one stop, in time order. */
export function StopSteps({ steps }: { steps: StopStep[] }) {
  if (!steps.length) return null
  return <ol className="relative flex flex-col gap-3 border-l pl-4">
    {steps.map((step, index) => {
      const { icon: Icon, label } = STEP[step.kind]
      const rank = step.kind === "ranking" ? (step.detail as RankDetail) : null
      const places = step.kind === "places" ? (step.detail as PlacesDetail) : null
      const last = step.kind === "outcome"
      return <li key={index} className="relative flex flex-col gap-1">
        <span className={cn("absolute top-0.5 -left-[1.4rem] grid size-4 place-items-center rounded-full bg-background", last ? "text-primary" : "text-muted-foreground")}><Icon className="size-3.5" aria-hidden="true" /></span>
        <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{label}</span> · {step.time}</p>
        {step.kind === "rule" && <p className="text-[13px]">{step.text.replace(/^Stop rule: the /, "The ")}</p>}
        {places && <p className="text-[13px]">{places.places?.length ?? 0} places within {places.radius_m ?? 400} m ({places.provider ?? "places lookup"}).</p>}
        {rank && <p className="text-[13px]">
          Top cause: <span className="font-medium">{rank.causes?.[0]?.label} {rank.causes?.[0] ? pct(rank.causes[0].probability) : ""}</span>
          {rank.places?.[0] ? <> · top place: {rank.places[0].name} {pct(rank.places[0].probability)}</> : null}
          <br /><span className="text-muted-foreground">Next step: <span className="text-foreground">{NEXT[rank.next_step ?? ""] ?? rank.next_step}</span>. {rank.why}</span>
        </p>}
        {rank?.second_opinions && rank.second_opinions.length > 0 && <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {rank.second_opinions.map((other) => <li key={other.model}>
            {other.model}: {other.top_cause ?? "–"}, {other.top_place ?? "–"} <span className={cn(other.agrees_with_jev ? "" : "text-danger")}>· {other.agrees_with_jev ? "agrees with Jev" : "disagrees with Jev"}</span>
          </li>)}
        </ul>}
        {(step.kind === "ask" || step.kind === "reply") && <p className={cn("max-w-[52ch] rounded-xl px-3 py-2 text-[13px]", step.kind === "ask" ? "bg-muted/60" : /^No answer/.test(step.text) ? "border border-dashed text-muted-foreground" : "bg-primary/8")}>{step.text}</p>}
        {last && <p className="flex items-start gap-1.5 text-[13px] font-medium">{/^Closed quietly/.test(step.text) ? <CircleCheckIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}{step.text}</p>}
      </li>
    })}
  </ol>
}

/** Jev and our fine-tuned models on the same two questions, side by side. Jev's answer drives the next step. */
export function ModelComparison({ stop }: { stop: StopView }) {
  const ranking = stop.ranking!
  const rows = [
    { key: "jev", label: ranking.byJev ? "Jev" : "Rules", places: ranking.places, causes: ranking.causes, ms: ranking.ms, costUsd: ranking.costUsd, error: undefined as string | undefined, lead: true },
    ...(ranking.others ?? []).map((other) => ({ key: other.model, ...other, lead: false })),
  ]
  const leadCause = ranking.causes[0]?.id
  const leadPlace = ranking.places[0]?.id
  return <div className="flex flex-col gap-2">
    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Same questions, three models</p>
    <ul className="flex flex-col divide-y rounded-xl border">
      {rows.map((row) => {
        const cause = row.causes[0]
        const place = row.places[0]
        const agrees = !row.lead && cause?.id === leadCause && place?.id === leadPlace
        const half = !row.lead && !agrees && (cause?.id === leadCause || place?.id === leadPlace)
        return <li key={row.key} className="flex flex-col gap-1 px-3 py-2">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="font-medium">{row.label}</span>
            {row.lead && <span className="rounded-sm border px-1.5 text-[11px] text-muted-foreground">drives the next step</span>}
            {!row.lead && !row.error && <span className={cn("rounded-sm border px-1.5 text-[11px]", agrees ? "text-muted-foreground" : half ? "border-warning/40 text-warning" : "border-danger/40 text-danger")}>{agrees ? "agrees" : half ? "partly agrees" : "disagrees"}</span>}
            <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">{row.error ? "" : `${row.ms} ms${row.costUsd != null ? ` · $${row.costUsd.toFixed(5)}` : ""}`}</span>
          </div>
          {row.error ? <p className="text-xs text-muted-foreground">Not answered: {row.error}</p> : <p className="text-xs text-muted-foreground">
            Place: <span className="text-foreground">{place?.label ?? "–"}</span> {place ? pct(place.probability) : ""} · Cause: <span className="text-foreground">{cause?.label ?? "–"}</span> {cause ? pct(cause.probability) : ""}
          </p>}
        </li>
      })}
    </ul>
  </div>
}

/** Which models work on a stop, and if they are connected. */
export function StopModels({ models }: { models: StopModel[] }) {
  return <ul className="flex flex-col gap-1.5">
    {models.map((model) => <li key={model.label} className="grid grid-cols-[0.75rem_minmax(0,1fr)] items-start gap-2 text-[13px]">
      <span className={cn("mt-1.5 size-2 rounded-full", model.connected ? "bg-primary" : "border border-muted-foreground")} aria-hidden="true" />
      <span><span className="font-medium">{model.label}</span>{model.connected ? "" : <span className="text-muted-foreground"> (not connected)</span>}<br /><span className="text-xs text-muted-foreground">{model.role}</span></span>
    </li>)}
  </ul>
}

/** How each decision model checked the card the agent made. */
export function CardChecks({ checks }: { checks: CardCheck[] }) {
  if (!checks.length) return <p className="text-[13px] text-muted-foreground">No decision model checked this card.</p>
  return <ul className="flex flex-col divide-y rounded-xl border">
    {checks.map((check) => <li key={check.model} className="flex flex-col gap-1 px-3 py-2">
      <div className="flex items-center gap-2 text-[13px]">
        <span className="font-medium">{check.label}</span>
        <span className={cn("rounded-sm border px-1.5 text-[11px]", check.traps ? "border-warning/40 text-warning" : "text-muted-foreground")}>{check.traps ? `${check.traps} ${check.traps === 1 ? "warning" : "warnings"}` : "no trap"}</span>
        <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">{check.answered} answers · {check.ms} ms each</span>
      </div>
      {check.warnings.map((warning, index) => <p key={index} className="text-xs text-warning">{warning}</p>)}
    </li>)}
  </ul>
}
