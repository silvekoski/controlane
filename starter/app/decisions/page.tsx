"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { BanIcon, BotIcon, CircleCheckIcon, ClockIcon, FilterIcon, InboxIcon, LoaderCircleIcon, RepeatIcon, SearchIcon, ShieldCheckIcon, TriangleAlertIcon, type LucideIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { AppFrame } from "../components/app-frame"
import { JevLogo } from "../components/agent"
import { ControlError, DecidedChip, EscalationChip, LeftChip, useControl, type CardRow, type Escalation, type QueueView } from "../components/control"
import { Chip } from "../components/ui"

/* The decision queue as a dashboard. The stat tiles and charts come from the queue view only.
   The queue itself reads like an inbox: one sentence for each decision, sorted by the time left. */

const GOOD_BG = "bg-[oklch(0.62_0.15_155)]"
const isOpen = (card: CardRow) => card.status === "new" || card.status === "changed"

export default function DecisionsPage() {
  const [grouped, setGrouped] = useState(false)
  const [poll, setPoll] = useState(false)
  const [query, setQuery] = useState("")
  const [kind, setKind] = useState<string | null>(null)
  const { data, error, offline } = useControl<QueueView>("view=queue", poll)
  useEffect(() => setPoll(Boolean(data?.running.length)), [data?.running.length])
  useEffect(() => { try { setGrouped(localStorage.getItem("decisions-grouped") === "1") } catch {} }, [])
  const group = (next: boolean) => { setGrouped(next); try { localStorage.setItem("decisions-grouped", next ? "1" : "0") } catch {} }

  const kinds = useMemo(() => {
    const out = new Map<string, number>()
    for (const card of data?.open ?? []) out.set(card.kind.label, (out.get(card.kind.label) ?? 0) + 1)
    return [...out.entries()]
  }, [data])

  const needle = query.trim().toLowerCase()
  const shown = useMemo(() => (data?.open ?? []).filter((card) => (!kind || card.kind.label === kind)
    && (!needle || [card.summary, card.orderRef, card.car, card.customer, card.driver, card.kind.label].some((value) => value?.toLowerCase().includes(needle)))), [data, kind, needle])
  const groups = useMemo(() => {
    const out = new Map<string, CardRow[]>()
    for (const card of shown) out.set(card.kind.label, [...(out.get(card.kind.label) ?? []), card])
    return [...out.entries()]
  }, [shown])

  const open = data?.open ?? []
  const n = open.length
  const jevOn = data?.system.checkers.some((name) => name.startsWith("Jev"))
  const traps = open.reduce((total, card) => total + card.jev.traps, 0)
  const warnings = open.reduce((total, card) => total + (card.blocked ? 0 : card.warnings), 0)
  const blocked = open.filter((card) => card.blocked).length
  const changed = open.filter((card) => card.status === "changed").length
  const overdue = open.filter((card) => card.left.tone === "critical").length
  const soon = open.filter((card) => card.left.tone === "warn").length
  const calm = n - overdue - soon
  const agentAlone = data?.decided.filter((card) => card.escalation.level === "agent").length ?? 0
  const rejected = data?.decided.filter((card) => card.status === "rejected").length ?? 0
  // decidedAt is a label such as "Wed 21 Oct, 12:08 UTC". Today is the same day label in UTC.
  const today = data ? new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(data.now)).replace(",", "") : ""
  const decidedToday = data?.decided.filter((card) => card.decidedAt?.startsWith(today)).length ?? 0

  return <AppFrame section="decisions">
    <div className="flex max-w-7xl flex-col gap-5">
      {error && <ControlError error={error} offline={offline} />}
      {!data && !error && <div className="flex flex-col gap-5" aria-busy="true"><Skeleton className="h-10 w-80" /><div className="grid gap-5 lg:grid-cols-3">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-80 rounded-2xl" />)}</div><Skeleton className="h-64 rounded-2xl" /></div>}
      {data && <>
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-3xl font-semibold tracking-tight">{n === 0 ? "Nothing needs you right now." : n === 1 ? "1 decision needs you" : `${n} decisions need you`}</h1>
            <p className="text-[13px] text-muted-foreground">
              <span className="font-medium text-foreground">{data.onTrack} orders on track</span> of {data.activeOrders} active · {data.deliveredOrDone} delivered or closed ·{" "}
              {data.quiet.length ? <>the agent closed <span className="font-medium text-foreground">{data.quiet.length}</span> {data.quiet.length === 1 ? "event" : "events"} without you</> : "no events closed by the agent yet"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline"><Link href="/evals"><ShieldCheckIcon aria-hidden="true" />Checks and evals</Link></Button>
            {n > 0 && <Button asChild size="sm"><Link href={`/decisions/${open[0].id}`}><InboxIcon aria-hidden="true" />Open the first card</Link></Button>}
          </div>
        </header>

        <div className="grid items-stretch gap-5 lg:grid-cols-2 xl:grid-cols-[1fr_1.15fr_1fr]">
          {/* Time left on the open cards, then the Jev checks and the approval limit. */}
          <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5" aria-label="Time left on open decisions">
            <div className="flex flex-col gap-1">
              <h2 className="text-[13px] text-muted-foreground">Time left on open decisions</h2>
              <span className="font-mono text-4xl font-semibold tracking-tight tabular-nums">{n}<span className="ml-2 font-sans text-base font-normal text-muted-foreground">open</span></span>
            </div>
            <TimeLeftBar overdue={overdue} soon={soon} calm={calm} />
            {n > 0 && <ul className="flex flex-col gap-1" aria-label="Next deadlines">
              {open.slice(0, 3).map((card) => <li key={card.id}><Link href={`/decisions/${card.id}`} className="flex items-center gap-2 rounded-lg px-1 py-1 text-[13px] hover:bg-muted/50">
                <span className="font-mono text-xs">{card.orderRef}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{card.deadlineLabel}</span>
                <span className={cn("font-mono text-xs tabular-nums", card.left.tone === "critical" ? "text-danger" : card.left.tone === "warn" ? "text-warning" : "text-muted-foreground")}>{card.left.text}</span>
              </Link></li>)}
            </ul>}
            <div className="mt-auto flex flex-col gap-3 rounded-xl bg-muted/50 p-3">
              <h3 className="flex items-center gap-2 text-[13px] font-medium"><JevLogo />{jevOn ? "Jev checks each card for known traps." : <span className="font-normal text-muted-foreground">Jev is not connected. Set OPENROUTER_API_KEY in the control room.</span>}</h3>
              <ul className="grid grid-cols-3 gap-2">
                <Count label="Traps on open cards" value={traps} tone={traps ? "warn" : undefined} />
                <Count label="Warnings" value={warnings} tone={warnings ? "warn" : undefined} />
                <Count label="Blocked rules" value={blocked} tone={blocked ? "danger" : undefined} />
              </ul>
              <p className="text-xs text-muted-foreground">Approval limit <span className="font-mono text-foreground">€{data.settings.costLimitEur}</span>: {data.settings.costLimitEur > 0 ? "the agent books alone below it" : "every change needs a person"}. <Link href="/evals#autonomy" className="text-foreground underline underline-offset-4">Change</Link></p>
            </div>
          </section>

          {/* Four stat tiles. The accent tile is the open queue. */}
          <section className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-3" aria-label="Totals">
            <Stat accent icon={InboxIcon} label="Open decisions" value={n} chip={`${data.activeOrders} active orders`} note={changed ? `${changed} changed since approval` : "waiting for a person"} />
            <Stat icon={ClockIcon} label="Overdue or due soon" value={overdue + soon} chip={`${overdue} overdue`} note={`${soon} due soon`} tone={overdue ? "danger" : soon ? "warn" : undefined} />
            <Stat icon={BotIcon} label="Closed by the agent" value={data.quiet.length} chip={`${agentAlone} cards run alone`} note="No person needed" />
            <Stat icon={CircleCheckIcon} label="Decided today" value={decidedToday} chip={`${data.decided.length} in all`} note={`${rejected} rejected`} />
          </section>

          <ByProblemType open={open} decided={data.decided} />
        </div>

        {data.running.length > 0 && <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5" aria-label="Agent runs">
          <h2 className="flex items-center gap-2 text-base font-semibold text-primary"><LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />The agent works on {data.running.length === 1 ? "1 event" : `${data.running.length} events`}</h2>
          <ul className="flex flex-col gap-1.5">{data.running.map((run) => <li key={run.id} className="flex items-baseline gap-3 rounded-lg bg-muted/50 px-3 py-2.5 text-[13px]">
            <Link href={`/orders/${run.orderId}#agent`} className="font-mono text-xs underline-offset-4 hover:underline">{run.orderRef}</Link>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{run.line}</span>
            <span className="text-xs text-muted-foreground">{run.started}</span>
          </li>)}</ul>
        </section>}

        <section className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-5" aria-label="Decision queue">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-0 flex-col">
              <h2 className="text-lg font-semibold">Decision queue</h2>
              <span className="text-xs text-muted-foreground">Sorted by the time left before a promise breaks.</span>
            </div>
            {n > 0 && <label className="ml-auto flex h-10 w-full min-w-0 items-center gap-2 rounded-xl bg-muted/50 px-3 text-[13px] sm:w-64">
              <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search decisions" aria-label="Search decisions by text, order, car, customer or driver" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" />
            </label>}
          </div>
          {n > 1 && <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by problem type">
            <Pill active={!kind} onClick={() => setKind(null)}>All <span className="font-mono tabular-nums">{n}</span></Pill>
            {kinds.map(([label, count]) => <Pill key={label} active={kind === label} onClick={() => setKind(kind === label ? null : label)}>{label} <span className="font-mono tabular-nums">{count}</span></Pill>)}
            <label className={cn("ml-auto flex h-8 cursor-pointer items-center gap-2 rounded-xl bg-muted/50 px-3 text-[13px]", grouped && "bg-primary/10 text-primary")}>
              <FilterIcon className="size-4" aria-hidden="true" />
              <input type="checkbox" className="size-3.5 accent-primary" checked={grouped} onChange={(event) => group(event.target.checked)} />Group by problem type
            </label>
          </div>}

          {n === 0 && <div className="rounded-xl bg-muted/50 px-6 py-10 text-center">
            <p className="font-medium">The queue is empty.</p>
            <p className="mt-1 text-sm text-muted-foreground">The agent watches every moving order. It brings you a card only when a person must decide.</p>
          </div>}
          {n > 0 && shown.length === 0 && <p className="rounded-xl bg-muted/50 px-4 py-6 text-sm text-muted-foreground">No decision matches the search or the filter.</p>}
          {shown.length > 0 && !grouped && <ul className="flex flex-col gap-1.5">{shown.map((card) => <QueueRow key={card.id} card={card} showKind={!kind} />)}</ul>}
          {shown.length > 0 && grouped && groups.map(([label, cards]) => <div key={label} className="flex flex-col gap-1.5">
            <h3 className="flex items-baseline gap-2 px-1 text-[13px] font-medium">{label}<span className="font-mono text-xs text-muted-foreground tabular-nums">{cards.length}</span></h3>
            <ul className="flex flex-col gap-1.5">{cards.map((card) => <QueueRow key={card.id} card={card} />)}</ul>
          </div>)}
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5" aria-label="Closed by the agent">
            <h2 className="flex items-baseline gap-2 text-base font-semibold">Closed by the agent{data.quiet.length > 0 && <span className="font-mono text-xs font-normal text-muted-foreground tabular-nums">{data.quiet.length}</span>}<span className="ml-auto text-xs font-normal text-muted-foreground">No person needed</span></h2>
            {data.quiet.length ? <ul className="flex flex-col gap-1.5">{data.quiet.map((item) => <li key={item.runId} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 rounded-lg bg-muted/50 px-3 py-2.5 text-[13px]">
              {item.orderId ? <Link href={`/orders/${item.orderId}#agent`} className="font-mono text-xs underline-offset-4 hover:underline">{item.orderRef}</Link> : <span className="font-mono text-xs">{item.orderRef}</span>}
              <span className="flex flex-col gap-0.5"><span>{item.reason}</span><span className="text-xs text-muted-foreground">{item.at}</span></span>
            </li>)}</ul> : <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">No events yet. Normal stops and GPS gaps close here.</p>}
          </section>
          <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5" aria-label="Decided">
            <h2 className="flex items-baseline gap-2 text-base font-semibold">Decided{data.decided.length > 0 && <span className="font-mono text-xs font-normal text-muted-foreground tabular-nums">{data.decided.length}</span>}<span className="ml-auto text-xs font-normal text-muted-foreground">What happens next</span></h2>
            {data.decided.length ? <ul className="flex flex-col gap-1.5">{data.decided.map((card) => <li key={card.id}>
              <Link href={`/decisions/${card.id}`} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 rounded-lg bg-muted/50 px-3 py-2.5 text-[13px] hover:bg-muted">
                <span className="font-mono text-xs">{card.orderRef}</span>
                <span className="flex flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-1.5"><DecidedChip card={card} /><span className="text-xs text-muted-foreground">{card.decidedBy} · {card.decidedAt}</span></span>
                  <span className="text-muted-foreground">{card.outcome}</span>
                </span>
              </Link>
            </li>)}</ul> : <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">Nothing decided yet.</p>}
          </section>
        </div>

        {data.failed.length > 0 && <section className="flex flex-col gap-2 rounded-2xl border bg-card p-5 text-sm" aria-label="Agent runs that failed">
          <h2 className="flex items-center gap-2 text-base font-semibold text-danger"><TriangleAlertIcon className="size-4" aria-hidden="true" />Agent runs that failed</h2>
          {data.failed.map((run) => <p key={run.id} className="rounded-lg bg-danger/10 px-3 py-2.5"><span className="font-mono text-xs">{run.orderRef}</span> · {run.error}. A person should look at this order.</p>)}
        </section>}
      </>}
    </div>
  </AppFrame>
}

function QueueRow({ card, showKind = false }: { card: CardRow; showKind?: boolean }) {
  return <li>
    <Link href={`/decisions/${card.id}`} className="flex flex-col gap-2 rounded-xl bg-muted/50 px-4 py-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-start sm:gap-4">
      <LeftChip left={card.left} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[14px] leading-snug font-medium">{card.summary}</span>
        <span className="text-xs text-muted-foreground"><span className="font-mono text-foreground">{card.orderRef}</span> · {card.car} · {card.customer} · {card.deadlineLabel}</span>
      </span>
      <span className="flex flex-wrap items-center gap-1.5 sm:max-w-[45%] sm:justify-end">
        {showKind && <Chip tone="neutral">{card.kind.label}</Chip>}
        <EscalationChip escalation={card.escalation} />
        {card.status === "changed" && <Chip tone="warn"><RepeatIcon aria-hidden="true" />Changed since approval</Chip>}
        {card.blocked && <Chip tone="danger"><BanIcon aria-hidden="true" />Blocked rule</Chip>}
        {!card.blocked && card.warnings > 0 && <Chip tone="warn"><TriangleAlertIcon aria-hidden="true" />{card.warnings === 1 ? "1 warning" : `${card.warnings} warnings`}</Chip>}
        {card.jev.checked && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Traps that Jev found on this card"><JevLogo className="h-4 px-1 text-[10px]" /><span className={cn("font-mono tabular-nums", card.jev.traps > 0 && "text-warning")}>{card.jev.traps === 1 ? "1 trap" : `${card.jev.traps} traps`}</span></span>}
        <span className="text-xs text-muted-foreground">{card.age}</span>
      </span>
    </Link>
  </li>
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={cn("flex h-8 items-center gap-1.5 rounded-xl px-3 text-[13px] transition-colors", active ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground")}>{children}</button>
}

function Stat({ icon: Icon, label, value, chip, note, tone, accent }: { icon: LucideIcon; label: string; value: number; chip: string; note: string; tone?: "warn" | "danger"; accent?: boolean }) {
  return <div className={cn("flex min-w-0 flex-col gap-3 rounded-xl p-4", accent ? "bg-primary text-primary-foreground" : "bg-muted/50")}>
    <div className="flex items-start justify-between gap-2">
      <span className={cn("text-[13px] leading-snug", accent ? "text-primary-foreground/85" : "text-muted-foreground")}>{label}</span>
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", accent ? "bg-primary-foreground/15" : "bg-card shadow-xs")}><Icon className="size-4" aria-hidden="true" /></span>
    </div>
    <span className={cn("mt-auto font-mono text-3xl font-semibold tracking-tight tabular-nums", tone === "warn" && "text-warning", tone === "danger" && "text-danger")}>{value}</span>
    <span className={cn("flex flex-wrap items-center gap-1.5 text-[11px] leading-snug", accent ? "text-primary-foreground/85" : "text-muted-foreground")}>
      <span className={cn("rounded-md px-1.5 py-0.5 font-mono tabular-nums", accent ? "bg-primary-foreground/15 text-primary-foreground" : "bg-card text-foreground")}>{chip}</span>{note}
    </span>
  </div>
}

function Count({ label, value, tone }: { label: string; value: number; tone?: "warn" | "danger" }) {
  return <li className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-card p-3 shadow-xs">
    <span className={cn("font-mono text-lg font-semibold tabular-nums", tone === "warn" && "text-warning", tone === "danger" && "text-danger")}>{value}</span>
    <span className="text-[11px] leading-snug text-muted-foreground">{label}</span>
  </li>
}

/** Open cards by time left: overdue, due soon and calm, as one stacked bar with a legend. */
function TimeLeftBar({ overdue, soon, calm }: { overdue: number; soon: number; calm: number }) {
  const parts = [
    { label: "Overdue", value: overdue, className: "bg-danger" },
    { label: "Due soon", value: soon, className: "bg-warning" },
    { label: "Time left", value: calm, className: GOOD_BG },
  ]
  const total = overdue + soon + calm
  return <div className="flex flex-col gap-2.5">
    <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={parts.map((part) => `${part.label}: ${part.value}`).join(", ")}>
      {total > 0 && parts.map((part) => part.value > 0 && <span key={part.label} className={cn("h-full first:rounded-l-full last:rounded-r-full", part.className)} style={{ flexGrow: part.value }} title={`${part.label}: ${part.value}`} />)}
    </div>
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
      {parts.map((part) => <li key={part.label} className="flex items-center gap-1.5"><span className={cn("size-2.5 rounded-xs", part.className)} aria-hidden="true" />{part.label}<span className="font-mono text-foreground tabular-nums">{part.value}</span></li>)}
    </ul>
  </div>
}

const SERIES = [
  { key: "open", label: "Open", className: "bg-[var(--chart-1)]" },
  { key: "decided", label: "Decided", className: "bg-[var(--chart-2)]" },
] as const
const LEVELS: { level: Escalation["level"]; label: string }[] = [
  { level: "agent", label: "Agent alone" },
  { level: "ops", label: "Ops decides" },
  { level: "outside", label: "Dealer or customer" },
]

/** Cards by problem type as horizontal stacked bars, then who must answer the open cards. */
function ByProblemType({ open, decided }: { open: CardRow[]; decided: CardRow[] }) {
  const rows = useMemo(() => {
    const out = new Map<string, { open: number; decided: number }>()
    for (const card of [...open, ...decided]) {
      const row = out.get(card.kind.label) ?? { open: 0, decided: 0 }
      row[isOpen(card) ? "open" : "decided"] += 1
      out.set(card.kind.label, row)
    }
    return [...out.entries()].map(([label, row]) => ({ label, ...row })).sort((a, b) => b.open + b.decided - (a.open + a.decided))
  }, [open, decided])
  const max = Math.max(1, ...rows.map((row) => row.open + row.decided))
  return <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 lg:col-span-2 xl:col-span-1" aria-label="Decisions by problem type">
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Decisions by problem type</h2>
      <p className="text-[13px] text-muted-foreground">Open and decided cards in the queue view.</p>
    </div>
    <div className="flex flex-col gap-3 rounded-xl bg-muted/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-medium">By problem type</h3>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-label="Legend">
          {SERIES.map((series) => <li key={series.key} className="flex items-center gap-1.5"><span className={cn("size-2.5 rounded-xs", series.className)} aria-hidden="true" />{series.label}</li>)}
        </ul>
      </div>
      {rows.length === 0 ? <p className="text-xs text-muted-foreground">No cards yet.</p> : <ul className="flex flex-col gap-2.5">
        {rows.map((row) => <li key={row.label} className="flex flex-col gap-1">
          <span className="flex items-baseline justify-between gap-2 text-xs"><span className="truncate">{row.label}</span><span className="font-mono text-muted-foreground tabular-nums">{row.open} open · {row.decided} decided</span></span>
          <span className="flex h-2.5 gap-0.5" style={{ width: `${((row.open + row.decided) / max) * 100}%` }}>
            {SERIES.map((series) => row[series.key] > 0 && <span key={series.key} className={cn("h-full rounded-[3px]", series.className)} style={{ flexGrow: row[series.key] }} title={`${row.label}, ${series.label}: ${row[series.key]}`} />)}
          </span>
        </li>)}
      </ul>}
    </div>
    <div className="mt-auto flex flex-col gap-2">
      <h3 className="text-[13px] font-medium">Who must answer the open cards</h3>
      <ul className="grid grid-cols-3 gap-2">
        {LEVELS.map(({ level, label }) => <li key={level} className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted/50 p-3">
          <span className={cn("font-mono text-lg font-semibold tabular-nums", level === "outside" && open.some((card) => card.escalation.level === level) && "text-warning")}>{open.filter((card) => card.escalation.level === level).length}</span>
          <span className="text-[11px] leading-snug text-muted-foreground">{label}</span>
        </li>)}
      </ul>
    </div>
  </section>
}
