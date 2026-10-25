"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon, BotIcon, InfoIcon, LoaderCircleIcon, SparklesIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { FinanceView } from "@/lib/present/finance"
import { LANES } from "@/lib/present/labels"
import { fmtDateTime, relativeTo } from "@/lib/present/time"
import type { Overview } from "@/lib/present/types"
import { cn } from "@/lib/utils"
import { AppFrame } from "../components/app-frame"
import { useControl, type BenchRow, type CardRow, type EvalsView, type LabelView, type QueueView } from "../components/control"

/* The overview: a little of every screen, in the style of the evals page. Four headline cards,
   a strip of small metrics, the order flow chart and three small panels. Each part loads on its own,
   so a stopped control room or database leaves the other parts working. */

type InboxThread = { id: string; categoryLabel: string; channelLabel: string; linkStateLabel: string; counterparty: { name: string | null } | null; updatedAt: string }
type InboxView = { view: { snapshotAt: string | null; open: number; threads: InboxThread[] } }

function useJson<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    const controller = new AbortController()
    fetch(url, { signal: controller.signal })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Could not load"); setData(body as T) })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load") })
    return () => controller.abort()
  }, [url])
  return { data, error }
}

const euro = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
const eur = (cents: number) => euro.format(cents / 100)
const pct = (value?: number) => (value === undefined ? "–" : `${Math.round(value * 100)}%`)
const hours = (value: number) => (value <= 0 ? "Overdue" : value < 1 ? `${Math.round(value * 60)} min` : value < 48 ? `${Math.round(value)} h` : `${Math.round(value / 24)} d`)

// One fixed colour for each lane, as on the orders board.
const LANE_COLOR: Record<string, string> = {
  intake: "oklch(0.6 0.01 286)", ready: "oklch(0.55 0.05 260)", market: "oklch(0.72 0.16 60)", booked: "var(--primary)",
  moving: "oklch(0.64 0.15 155)", delivered: "oklch(0.6 0.1 220)", cancelled: "oklch(0.7 0.005 286)",
}
const LANE_SHORT: Record<string, string> = { intake: "New", ready: "Ready", market: "Market", booked: "Assigned", moving: "Moving", delivered: "Delivered", cancelled: "Cancelled" }
const checker = (model: string) => `var(--checker-${model.replace("_", "-")}, var(--muted-foreground))`
const LEFT_COLOR: Record<string, string> = { critical: "var(--danger)", warn: "var(--warning)", calm: "var(--muted-foreground)" }

export default function OverviewPage() {
  const orders = useJson<Overview>("/api/overview?q=")
  const inbox = useJson<InboxView>("/api/inbox")
  const finance = useJson<FinanceView>("/api/finance")
  const [poll, setPoll] = useState(false)
  const queue = useControl<QueueView>("view=queue", poll)
  const evals = useControl<EvalsView>("view=evals")
  const label = useControl<LabelView>("view=label")
  useEffect(() => setPoll(Boolean(queue.data?.running.length)), [queue.data?.running.length])

  const snapshotAt = orders.data?.snapshotAt ?? null
  const decisions = queue.data?.open.length ?? null
  const working = Boolean(queue.data?.running.length)

  return <AppFrame section="overview" snapshotAt={snapshotAt}>
    <div className="flex max-w-7xl flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
          <p className="max-w-[80ch] text-[13px] text-muted-foreground">
            {decisions === null ? "A little of every screen." : decisions === 0 ? "Nothing needs you right now." : `${decisions === 1 ? "1 decision needs" : `${decisions} decisions need`} you.`}
            {queue.data ? ` ${queue.data.onTrack} of ${queue.data.activeOrders} active orders are on track.` : ""} {snapshotAt ? `Snapshot ${fmtDateTime(snapshotAt)}.` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {queue.data && <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs", working ? "text-primary" : "text-muted-foreground")}>
            {working ? <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden="true" /> : <span className="size-1.5 rounded-full bg-muted-foreground/60" aria-hidden="true" />}
            {working ? `Agent works on ${queue.data.running.length}` : "Agent idle"} · {queue.data.system.claude ? "live model" : "scripted replay"}
          </span>}
          <Button asChild size="sm" variant="outline"><Link href="/synthetic">Explore synthetic data<ArrowRightIcon aria-hidden="true" /></Link></Button>
          <Button asChild size="sm"><Link href="/decisions">Open decisions<ArrowRightIcon aria-hidden="true" /></Link></Button>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Headline">
        <DecisionsCard queue={queue.data} error={queue.error} />
        <OrdersCard orders={orders.data} error={orders.error} />
        <AgentCard queue={queue.data} error={queue.error} />
        <MoneyCard finance={finance.data} error={finance.error} />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <AttentionCard orders={orders.data} />
        <MetricStrip queue={queue.data} finance={finance.data} evals={evals.data} />
      </section>

      {orders.data && <FlowChart orders={orders.data} />}

      <section className="grid gap-3 lg:grid-cols-3">
        <Panel title="Inbox" href="/inbox" link="Open the inbox" count={inbox.data?.view.open}>
          {inbox.error ? <Note>{inbox.error}</Note> : !inbox.data ? <Lines /> : inbox.data.view.threads.length === 0 ? <Note>No support threads wait for a link.</Note>
            : <ul className="flex flex-col">{inbox.data.view.threads.slice(0, 4).map((thread) => <li key={thread.id} className="flex flex-col gap-0.5 border-b border-dashed py-2 last:border-0">
              <span className="flex items-baseline gap-2 text-[13px]"><span className="truncate font-medium">{thread.counterparty?.name ?? "Unknown sender"}</span><span className="ml-auto shrink-0 text-xs text-muted-foreground">{relativeTo(thread.updatedAt, inbox.data!.view.snapshotAt)?.text}</span></span>
              <span className="text-[11px] text-muted-foreground">{thread.categoryLabel} · {thread.channelLabel} · {thread.linkStateLabel}</span>
            </li>)}</ul>}
        </Panel>
        <ChecksPanel evals={evals.data} error={evals.error} label={label.data} />
        <Panel title="Closed by the agent" href="/traces" link="All agent traces" count={queue.data?.quiet.length}>
          {queue.error ? <Note>{queue.error}</Note> : !queue.data ? <Lines /> : queue.data.quiet.length === 0 ? <Note>No events closed yet. Normal stops and GPS gaps close here.</Note>
            : <ul className="flex flex-col">{queue.data.quiet.slice(0, 4).map((item) => <li key={item.runId} className="flex gap-2 border-b border-dashed py-2 text-[13px] last:border-0">
              <BotIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1"><span className="block truncate">{item.reason}</span><span className="text-[11px] text-muted-foreground">{item.orderRef} · {item.at}</span></span>
            </li>)}</ul>}
        </Panel>
      </section>
    </div>
  </AppFrame>
}

/** A headline card in the style of the evals set cards: a top line, a big title, a body and chips. */
function Hero({ href, top, value, title, children, chips, loading }: { href: string; top: string; value: ReactNode; title: string; children?: ReactNode; chips?: string[]; loading?: boolean }) {
  return <Link href={href} className="flex min-h-72 flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/25">
    <span className="flex items-start justify-between gap-2">
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">{top}<InfoIcon className="size-3" aria-hidden="true" /></span>
      <span className="font-mono text-sm font-semibold tabular-nums">{value}</span>
    </span>
    <span className="text-lg leading-tight font-semibold tracking-tight">{title}</span>
    {loading ? <span className="flex flex-col gap-2"><Skeleton className="h-4" /><Skeleton className="h-4" /><Skeleton className="h-4 w-2/3" /></span> : children}
    {chips && chips.length > 0 && <span className="mt-auto flex flex-wrap gap-1.5">{chips.map((chip) => <span key={chip} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px]">{chip}</span>)}</span>}
  </Link>
}

function DecisionsCard({ queue, error }: { queue: QueueView | null; error: string }) {
  const open = queue?.open ?? []
  const count = (level: CardRow["escalation"]["level"]) => open.filter((card) => card.escalation.level === level).length
  return <Hero href="/decisions" top={queue ? `${queue.decided.length} decided` : "Decisions"} value={queue ? open.length : "–"} title="Decisions waiting" loading={!queue && !error}
    chips={queue ? [`${count("ops")} ops decides`, `${count("outside")} need the dealer or customer`] : []}>
    {error && <span className="text-xs text-muted-foreground">{error}</span>}
    {queue && open.length === 0 && <span className="text-[13px] text-muted-foreground">The queue is empty. The agent brings a card only when a person must decide.</span>}
    {queue && open.length > 0 && <span className="flex flex-col">{open.slice(0, 4).map((card) => <span key={card.id} className="flex items-center gap-2 border-b border-dashed py-2 last:border-0">
      <span className="size-2 shrink-0 rounded-full" style={{ background: LEFT_COLOR[card.left.tone] }} aria-hidden="true" />
      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{card.summary}</span><span className="text-[11px] text-muted-foreground">{card.orderRef} · {card.kind.label}</span></span>
      <span className={cn("shrink-0 font-mono text-xs tabular-nums", card.left.tone === "critical" ? "text-danger" : card.left.tone === "warn" ? "text-warning" : "text-muted-foreground")}>{card.left.text.replace(" left", "")}</span>
    </span>)}</span>}
  </Hero>
}

function OrdersCard({ orders, error }: { orders: Overview | null; error: string }) {
  const max = orders ? Math.max(...Object.values(orders.counts), 1) : 1
  const attention = orders ? Object.values(orders.attentionCounts).reduce((total, value) => total + value, 0) : 0
  return <Hero href="/orders" top={orders ? `${attention} need a person` : "Orders"} value={orders?.total ?? "–"} title="Orders by lane" loading={!orders && !error}
    chips={orders ? [`${orders.counts.moving ?? 0} moving now`, `${orders.counts.delivered ?? 0} delivered`] : []}>
    {error && <span className="text-xs text-muted-foreground">{error}</span>}
    {orders && <span className="flex flex-1 flex-col justify-end gap-1">
      <span className="flex h-32 items-end gap-1.5" role="img" aria-label={`Orders by lane: ${LANES.map(([key, name]) => `${name} ${orders.counts[key] ?? 0}`).join(", ")}`}>
        {LANES.map(([key, name]) => <span key={key} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${name}: ${orders.counts[key] ?? 0} orders, ${orders.attentionCounts[key] ?? 0} need a person`}>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{orders.counts[key] ?? 0}</span>
          <span className="w-full max-w-5 rounded-t-[4px]" style={{ height: `${Math.max(3, ((orders.counts[key] ?? 0) / max) * 100)}%`, background: `linear-gradient(to top, color-mix(in oklch, ${LANE_COLOR[key]} 55%, transparent), ${LANE_COLOR[key]})` }} />
        </span>)}
      </span>
      <span className="flex gap-1.5 border-t pt-1">{LANES.map(([key]) => <span key={key} className="flex-1 truncate text-center text-[10px] text-muted-foreground">{LANE_SHORT[key] ?? key}</span>)}</span>
    </span>}
  </Hero>
}

function AgentCard({ queue, error }: { queue: QueueView | null; error: string }) {
  const quiet = queue?.quiet.length ?? 0
  const toPerson = (queue?.open.length ?? 0) + (queue?.decided.filter((card) => card.escalation.level !== "agent").length ?? 0)
  const alone = queue?.decided.filter((card) => card.escalation.level === "agent").length ?? 0
  const total = quiet + toPerson + alone
  const share = total ? (quiet + alone) / total : 0
  const parts = [
    { label: "Closed quietly", value: quiet, color: "var(--checker-laya-ft)" },
    { label: "Acted alone under the limit", value: alone, color: "var(--checker-jev)" },
    { label: "Brought to a person", value: toPerson, color: "var(--warning)" },
  ]
  return <Hero href="/traces" top={queue ? `Approval limit €${queue.settings.costLimitEur}` : "Agent"} value={queue ? total : "–"} title="Handled without a person" loading={!queue && !error}
    chips={queue ? [`${queue.running.length} working now`, `${queue.failed.length} failed`] : []}>
    {error && <span className="text-xs text-muted-foreground">{error}</span>}
    {queue && <>
      <span className="flex items-baseline gap-2"><span className="font-mono text-4xl font-semibold tracking-tight tabular-nums">{pct(share)}</span><span className="text-xs text-muted-foreground">of {total} events</span></span>
      <span className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={parts.map((part) => `${part.label} ${part.value}`).join(", ")}>
        {parts.map((part) => part.value > 0 && <span key={part.label} style={{ flexGrow: part.value, background: part.color }} title={`${part.label}: ${part.value}`} />)}
      </span>
      <span className="flex flex-col">{parts.map((part) => <span key={part.label} className="flex items-center gap-2 border-b border-dashed py-1.5 text-[13px] last:border-0">
        <span className="size-2 shrink-0 rounded-full" style={{ background: part.color }} aria-hidden="true" /><span className="flex-1">{part.label}</span><span className="font-mono text-xs tabular-nums">{part.value}</span>
      </span>)}</span>
    </>}
  </Hero>
}

function MoneyCard({ finance, error }: { finance: FinanceView | null; error: string }) {
  const problems = finance?.waiting.filter((claim) => claim.flags.some((flag) => flag.tone !== "neutral")).length ?? 0
  const kinds = finance?.byKind.slice(0, 4) ?? []
  return <Hero href="/finances" top={finance ? `${finance.totals.claimsWaiting} claims wait` : "Money"} value={finance ? eur(finance.totals.claimsWaitingCents) : "–"} title="Money" loading={!finance && !error}
    chips={finance ? [`${problems} claims with a problem`, `${finance.payouts.filter((payout) => payout.decision === "PAYOUT_DUE").length} payout due`] : []}>
    {error && <span className="text-xs text-muted-foreground">{error}</span>}
    {finance && <span className="flex flex-col">
      {[["Driver fees booked", finance.totals.feesBookedCents], ["Open gigs on the market", finance.totals.openOffersCents], ["Travel paid by Bahn", finance.totals.bahnTravelCents]].map(([name, value]) =>
        <span key={name} className="flex items-baseline gap-2 border-b border-dashed py-1.5 text-[13px]"><span className="flex-1 text-muted-foreground">{name}</span><span className="font-mono tabular-nums">{eur(value as number)}</span></span>)}
      <span className="mt-2 text-[11px] text-muted-foreground">Claims by type: approved and waiting</span>
      <span className="flex flex-col gap-1 pt-1">{kinds.map((kind) => {
        const max = Math.max(...kinds.map((item) => item.approved + item.submitted), 1)
        return <span key={kind.kind} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 text-[11px]">
          <span className="truncate text-muted-foreground">{kind.label}</span>
          <span className="flex h-2 gap-0.5" style={{ width: `${((kind.approved + kind.submitted) / max) * 100}%` }} title={`${kind.label}: ${eur(kind.approved)} approved, ${eur(kind.submitted)} waiting`}>
            {kind.approved > 0 && <span className="h-full rounded-l-[2px] bg-chart-1" style={{ flexGrow: kind.approved }} />}
            {kind.submitted > 0 && <span className="h-full rounded-r-[4px] bg-chart-2" style={{ flexGrow: kind.submitted }} />}
          </span>
        </span>
      })}</span>
    </span>}
  </Hero>
}

/** Orders that need a person in each lane, as bars behind the lane name, like the live questions on the evals page. */
function AttentionCard({ orders }: { orders: Overview | null }) {
  return <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
    <div className="flex items-baseline justify-between"><h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">Needs a person<InfoIcon className="size-3.5 text-muted-foreground" aria-hidden="true" /></h2><span className="text-xs text-muted-foreground">Share of the lane</span></div>
    {!orders ? <Lines /> : <ul className="flex flex-col gap-1.5">{LANES.map(([key, name]) => {
      const count = orders.counts[key] ?? 0
      const attention = orders.attentionCounts[key] ?? 0
      const share = count ? attention / count : 0
      return <li key={key} className="flex items-center gap-3" title={`${name}: ${attention} of ${count} orders need a person`}>
        <span className="relative min-w-0 flex-1 overflow-hidden rounded-md px-2 py-1.5">
          <span className="absolute inset-y-0 left-0 rounded-md" style={{ width: `${share * 100}%`, background: `color-mix(in oklch, ${LANE_COLOR[key]} 22%, transparent)` }} aria-hidden="true" />
          <span className="relative flex items-center gap-2 text-[13px]"><span className="size-2 shrink-0 rounded-full" style={{ background: LANE_COLOR[key] }} aria-hidden="true" /><span className="truncate">{name}</span></span>
        </span>
        <span className="w-14 text-right font-mono text-xs tabular-nums">{attention}<span className="text-muted-foreground">/{count}</span></span>
      </li>
    })}</ul>}
  </div>
}

type Dot = { key: string; label: string; value: number; color: string }

/** Three small metrics side by side, split by dashed lines, each with a dot strip on its own scale. */
function MetricStrip({ queue, finance, evals }: { queue: QueueView | null; finance: FinanceView | null; evals: EvalsView | null }) {
  const now = queue ? Date.parse(queue.now) : 0
  const left: Dot[] = (queue?.open ?? []).map((card) => ({ key: card.id, label: `${card.orderRef}: ${card.summary}`, value: (Date.parse(card.deadline) - now) / 3600000, color: LEFT_COLOR[card.left.tone] }))
  const claims: Dot[] = (finance?.waiting ?? []).map((claim) => ({ key: claim.id, label: `${claim.kindLabel}, ${claim.order?.reference ?? ""}`, value: claim.amountCents / 100, color: claim.flags.some((flag) => flag.tone !== "neutral") ? "var(--warning)" : "var(--chart-2)" }))
  const hand = evals?.sets.find((set) => set.id === "hand")
  const speed: Dot[] = (hand?.rows ?? []).filter((row): row is BenchRow & { msPerCheck: number } => row.status === "measured" && row.model !== "code" && row.msPerCheck !== undefined).map((row) => ({ key: row.model, label: row.label, value: row.msPerCheck, color: checker(row.model) }))
  const soonest = left.reduce<Dot | null>((top, dot) => !top || dot.value < top.value ? dot : top, null)
  const fastest = speed.reduce<Dot | null>((top, dot) => !top || dot.value < top.value ? dot : top, null)
  const metrics = [
    { title: "Time left on open decisions", big: soonest ? hours(soonest.value) : "–", sub: soonest ? `Soonest: ${soonest.label.split(":")[0]}` : "No open decision", dots: left, fmt: hours, scale: "linear" as const, list: [...left].sort((a, b) => a.value - b.value) },
    { title: "Expense claims waiting", big: finance ? eur(finance.totals.claimsWaitingCents) : "–", sub: finance ? `${claims.filter((dot) => dot.color === "var(--warning)").length} with a problem (amber)` : "Loading", dots: claims, fmt: (value: number) => euro.format(value), scale: "log" as const, list: [...claims].sort((a, b) => b.value - a.value) },
    { title: "Time per check, hand set", big: fastest ? `${Math.round(fastest.value)} ms` : "–", sub: fastest ? `Fastest: ${fastest.label.replace(/\s*\(.*\)$/, "")}` : "No benchmark yet", dots: speed, fmt: (value: number) => `${Math.round(value)} ms`, scale: "log" as const, list: [...speed].sort((a, b) => a.value - b.value) },
  ]
  return <div className="grid gap-x-6 gap-y-5 rounded-xl border bg-card p-4 md:grid-cols-3" aria-label="Small metrics">
    <p className="text-xs text-muted-foreground md:col-span-3">Each dot is one decision, one claim or one checker. Hover a dot to see it. The claim and speed strips use a log scale.</p>
    {metrics.map((metric) => {
      const values = metric.dots.map((dot) => Math.max(dot.value, 0.01))
      const max = Math.max(...values, 0.01), min = Math.min(...values, max)
      const at = (value: number) => max === min ? 50 : metric.scale === "log" ? (Math.log(Math.max(value, min)) - Math.log(min)) / (Math.log(max) - Math.log(min)) * 100 : (value - min) / (max - min) * 100
      return <div key={metric.title} className="flex flex-col gap-3 border-l border-dashed pl-4">
        <span className="text-xs text-muted-foreground">{metric.title}</span>
        <span className="flex flex-col"><span className="font-mono text-2xl font-semibold tracking-tight">{metric.big}</span><span className="truncate text-xs text-muted-foreground">{metric.sub}</span></span>
        <ul className="flex flex-col gap-1">
          {metric.list.slice(0, 5).map((dot) => <li key={dot.key} className="flex items-center gap-2 text-[13px]" title={dot.label}>
            <span className="size-2 shrink-0 rounded-full" style={{ background: dot.color }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{dot.label.replace(/\s*\(.*\)$/, "")}</span>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">{metric.fmt(dot.value)}</span>
          </li>)}
          {metric.list.length > 5 && <li className="text-[11px] text-muted-foreground">{metric.list.length - 5} more on the strip</li>}
        </ul>
        <span className="relative mt-auto h-3 rounded-full bg-muted" role="img" aria-label={`${metric.title}: ${metric.dots.length} values`}>
          {metric.dots.map((dot) => <span key={dot.key} className={cn("absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card", metric.dots.length > 12 ? "size-2.5 opacity-80" : "size-3")} style={{ left: `${Math.min(97, Math.max(3, at(Math.max(dot.value, 0.01))))}%`, background: dot.color }} title={`${dot.label}: ${metric.fmt(dot.value)}`} />)}
        </span>
      </div>
    })}
  </div>
}

/** Every lane: bars for the orders, a dotted line for the orders that need a person. Both are counts, so they share one axis. */
function FlowChart({ orders }: { orders: Overview }) {
  const [show, setShow] = useState({ orders: true, attention: true })
  const rows = useMemo(() => LANES.map(([key, name]) => ({ key, name, count: orders.counts[key] ?? 0, attention: orders.attentionCounts[key] ?? 0 })), [orders])
  const top = Math.max(...rows.map((row) => row.count), 1)
  // A multiple of 4 above the top bar, so the four grid steps are whole numbers and the top label fits.
  const ceiling = Math.ceil((top + 1) / 4) * 4
  const w = 1080, h = 240, left = 40, right = 12, base = h - 26
  const slot = (w - left - right) / rows.length
  const y = (value: number) => base - (value / ceiling) * (base - 16)
  const path = rows.map((row, index) => `${index ? "L" : "M"}${(left + slot * index + slot / 2).toFixed(1)},${y(row.attention).toFixed(1)}`).join(" ")
  return <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label="Order flow">
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="mr-2 inline-flex items-center gap-1.5 text-sm font-semibold">Order flow<InfoIcon className="size-3.5 text-muted-foreground" aria-hidden="true" /></h2>
      <span className="text-xs text-muted-foreground">From a new order to delivery. {orders.total} orders in the snapshot.</span>
      <Link href="/orders" className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">All orders<ArrowRightIcon className="size-3" aria-hidden="true" /></Link>
    </div>
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={rows.map((row) => `${row.name}: ${row.count} orders, ${row.attention} need a person`).join("; ")}>
      {[0, 0.25, 0.5, 0.75, 1].map((tick) => <g key={tick}>
        <line x1={left} x2={w - right} y1={y(tick * ceiling)} y2={y(tick * ceiling)} stroke="var(--border)" strokeDasharray={tick ? "3 4" : undefined} />
        <text x={left - 6} y={y(tick * ceiling) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">{Math.round(tick * ceiling)}</text>
      </g>)}
      {rows.map((row, index) => {
        const x = left + slot * index
        const barW = Math.min(44, slot * 0.45)
        const isTop = row.count === top
        return <g key={row.key}>
          <title>{`${row.name}: ${row.count} orders, ${row.attention} need a person`}</title>
          <rect x={x + (slot - barW) / 2} y={16} width={barW} height={base - 16} rx={4} fill="var(--muted)" opacity="0.5" />
          {show.orders && <rect x={x + (slot - barW) / 2} y={y(row.count)} width={barW} height={Math.max(2, base - y(row.count))} rx={4} fill={LANE_COLOR[row.key]} opacity={isTop ? 1 : 0.7} />}
          {show.orders && <g transform={`translate(${x + slot / 2}, ${y(row.count) - 9})`}>
            <rect x={-15} y={-8} width={30} height={15} rx={4} fill="var(--foreground)" opacity={isTop ? 0.9 : 0.7} />
            <text textAnchor="middle" y={3} className="fill-background font-mono text-[10px]">{row.count}</text>
          </g>}
          <text x={x + slot / 2} y={h - 8} textAnchor="middle" className={cn("text-[12px]", isTop ? "fill-foreground font-medium" : "fill-muted-foreground")}>{row.name}</text>
        </g>
      })}
      {show.attention && <>
        <path d={path} fill="none" stroke="var(--warning)" strokeWidth="2" strokeDasharray="2 4" strokeLinecap="round" />
        {rows.map((row, index) => <circle key={row.key} cx={left + slot * index + slot / 2} cy={y(row.attention)} r={4} fill="var(--card)" stroke="var(--warning)" strokeWidth="2"><title>{`${row.name}: ${row.attention} need a person`}</title></circle>)}
      </>}
    </svg>
    <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
      <Toggle on={show.orders} onChange={(on) => setShow((value) => ({ ...value, orders: on }))}>Orders (bars, one colour per lane)</Toggle>
      <Toggle on={show.attention} onChange={(on) => setShow((value) => ({ ...value, attention: on }))}>Need a person (dotted line)</Toggle>
    </div>
  </section>
}

/** The live checker and the fine-tuned models on the hand-labelled set, in their fixed colours. */
function ChecksPanel({ evals, error, label }: { evals: EvalsView | null; error: string; label: LabelView | null }) {
  const set = evals?.sets.find((item) => item.id === "hand") ?? evals?.sets.find((item) => item.rows.some((row) => row.status === "measured"))
  const rows = set?.rows.filter((row) => row.status === "measured" && (row.model === "jev" || row.model.endsWith("_ft"))) ?? []
  return <Panel title="Checks and evals" href="/evals" link="Open checks and evals" count={evals?.proposed.length || null}>
    {error ? <Note>{error}</Note> : !evals ? <Lines /> : rows.length === 0 ? <Note>No benchmark result yet. Run the benchmark on the evals page.</Note> : <>
      <span className="text-[11px] text-muted-foreground">Hand-labelled set · traps caught · false alarms</span>
      <ul className="flex flex-col">{rows.map((row) => {
        const lowAlarms = (row.falseAlarmRate ?? 1) <= 0.15
        return <li key={row.model} className="flex items-center gap-2 border-b border-dashed py-2 last:border-0">
          <span className="size-2 shrink-0 rounded-full" style={{ background: checker(row.model) }} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{row.label.replace(/\s*\(.*\)$/, "")}</span>
          <span className="font-mono text-[13px] tabular-nums">{pct(row.catchRate)}</span>
          <span className={cn("inline-flex w-14 items-center justify-end gap-0.5 font-mono text-xs tabular-nums", lowAlarms ? "text-[oklch(0.62_0.15_155)]" : "text-danger")} title="False alarms">
            {lowAlarms ? <ArrowDownIcon className="size-3" aria-hidden="true" /> : <ArrowUpIcon className="size-3" aria-hidden="true" />}{pct(row.falseAlarmRate)}
          </span>
        </li>
      })}</ul>
      <span className="mt-auto flex flex-wrap gap-1.5">
        {label && <Link href="/label" className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] hover:bg-accent">{label.left ? `${label.left} ${label.left === 1 ? "case waits" : "cases wait"} for a label` : "All cases labeled"}</Link>}
        {evals.proposed.length > 0 && <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px]"><SparklesIcon className="size-3 text-primary" aria-hidden="true" />{evals.proposed.length} new questions</span>}
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px]">{evals.live.length} live questions</span>
      </span>
    </>}
  </Panel>
}

function Panel({ title, href, link, count, children }: { title: string; href: string; link: string; count?: number | null; children: ReactNode }) {
  return <section className="flex min-h-64 flex-col gap-2 rounded-xl border bg-card p-4">
    <header className="flex items-baseline gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {count != null && count > 0 && <span className="font-mono text-xs text-muted-foreground">{count}</span>}
      <Link href={href} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">{link}<ArrowRightIcon className="size-3" aria-hidden="true" /></Link>
    </header>
    {children}
  </section>
}

function Toggle({ on, onChange, children }: { on: boolean; onChange: (on: boolean) => void; children: ReactNode }) {
  return <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
    <span className={cn("relative h-4 w-7 rounded-full transition-colors", on ? "bg-primary" : "bg-border")}><span className={cn("absolute top-0.5 size-3 rounded-full bg-background transition-all", on ? "left-3.5" : "left-0.5")} /></span>
    {children}
  </button>
}

function Note({ children }: { children: ReactNode }) {
  return <p className="text-[13px] text-muted-foreground">{children}</p>
}

function Lines() {
  return <div className="flex flex-col gap-2" aria-busy="true">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-4 w-full" />)}</div>
}
