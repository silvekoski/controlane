"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { BotIcon, CheckIcon, CircleDotIcon, ClockIcon, CoinsIcon, SearchIcon, ShieldAlertIcon, ShieldCheckIcon, UserRoundIcon, XIcon, type LucideIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Empty as EmptyState, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AgentCard, AgentRun, JevAnswer, TraceStep } from "@/lib/agent-state"
import { fmtDateTime } from "@/lib/present/time"
import { cn } from "@/lib/utils"
import { AppFrame } from "../components/app-frame"
import { JevChip, RunStatusBadge, RunTrace, useAgentState } from "../components/agent"

/* An observability dashboard for the agent: who ran, how long, what Jev found. */

const GOOD = "text-[oklch(0.62_0.15_155)]"
const GOOD_BG = "bg-[oklch(0.62_0.15_155)]"

const STATUS: Record<AgentRun["status"], { icon: LucideIcon; className: string; bar: string; label: string }> = {
  card: { icon: UserRoundIcon, className: "text-warning", bar: "bg-warning", label: "Brought to a person" },
  quiet: { icon: CheckIcon, className: GOOD, bar: GOOD_BG, label: "Closed without a person" },
  running: { icon: CircleDotIcon, className: "text-primary", bar: "bg-primary", label: "Working" },
  failed: { icon: XIcon, className: "text-danger", bar: "bg-danger", label: "Failed" },
}

const FILTERS = [["all", "All runs"], ["card", "To a person"], ["quiet", "Closed"], ["failed", "Failed"]] as const

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)]
}

const ms = (value: number | null) => value == null ? "–" : value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)} ms`
const usd = (value: number) => value > 0 && value < 0.0001 ? "<$0.0001" : value < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`
const duration = (run: AgentRun) => run.endedAt ? Date.parse(run.endedAt) - Date.parse(run.startedAt) : null
const isTool = (step: TraceStep) => step.kind === "tool"
const toolMs = (run: AgentRun) => run.steps.reduce((sum, step) => sum + (step.kind === "tool" ? step.ms : 0), 0)
const clock = (iso: string) => iso.slice(11, 16)

export default function TracesPage() {
  const state = useAgentState()
  const runs = useMemo(() => state?.runs ?? [], [state])
  const cards = useMemo(() => new Map((state?.cards ?? []).map((card) => [card.id, card])), [state])
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all")
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState<string | null>(null)
  const [tab, setTab] = useState("runs")

  const answers = useMemo(() => runs.flatMap((run) => {
    const card = run.cardId ? cards.get(run.cardId) : undefined
    return (card?.jev.answers ?? []).map((answer) => ({ answer, run }))
  }), [runs, cards])
  const jevMs = answers.map(({ answer }) => answer.ms)
  const jevCost = answers.reduce((sum, { answer }) => sum + (answer.costUsd ?? 0), 0)
  const traps = answers.filter(({ answer }) => answer.mark === "trap")
  const toPerson = runs.filter((run) => run.status === "card").length
  const live = runs.some((run) => run.mode === "llm")
  const working = runs.some((run) => run.status === "running")
  const count = (key: (typeof FILTERS)[number][0]) => key === "all" ? runs.length : runs.filter((run) => run.status === key).length

  const needle = search.trim().toLowerCase()
  const shown = runs.filter((run) => (filter === "all" || run.status === filter) && (!needle || `${run.orderRef} ${run.trigger}`.toLowerCase().includes(needle)))
  const openRun = runs.find((run) => run.id === open)
  const openCard = openRun?.cardId ? cards.get(openRun.cardId) : undefined

  return <AppFrame section="traces">
    <div className="flex max-w-7xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Agent traces</h1>
          <p className="max-w-[80ch] text-[13px] text-muted-foreground">The on-the-road agent: each event that the control room sends, each step that the agent took, and each Jev check on its proposal.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-8 items-center gap-1.5 rounded-xl bg-muted/50 px-3 text-[13px] text-muted-foreground">Runs <span className="font-mono text-foreground tabular-nums">{runs.length}</span></span>
          <span className="flex h-8 items-center gap-1.5 rounded-xl bg-muted/50 px-3 text-[13px]"><BotIcon className="size-4 text-muted-foreground" aria-hidden="true" />{live ? "Live model" : "Scripted replay"}</span>
          <span className={cn("flex h-8 items-center gap-1.5 rounded-xl px-3 text-[13px]", working ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground")}>
            <span className={cn("size-1.5 rounded-full", working ? "bg-primary" : "bg-muted-foreground/60")} aria-hidden="true" />{working ? "Working" : "Idle"}
          </span>
        </div>
      </header>

      {!state && <div className="grid gap-5 lg:grid-cols-3" aria-busy="true">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-96 rounded-2xl" />)}</div>}
      {state && !state.available && <EmptyState className="rounded-2xl border bg-card py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon"><BotIcon aria-hidden="true" /></EmptyMedia>
          <EmptyTitle>No control room state</EmptyTitle>
          <EmptyDescription>No control room state at <span className="font-mono">{state.source}</span>. Start the control room. The agent writes runs to this file.</EmptyDescription>
        </EmptyHeader>
      </EmptyState>}
      {state?.available && runs.length === 0 && <EmptyState className="rounded-2xl border bg-card py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon"><BotIcon aria-hidden="true" /></EmptyMedia>
          <EmptyTitle>No agent runs yet</EmptyTitle>
          <EmptyDescription>No event has run at this clock time. Open Events in the top bar to see the feed. To replay the events, go to the packet snapshot time.</EmptyDescription>
        </EmptyHeader>
      </EmptyState>}

      {runs.length > 0 && <>
        <div className="grid items-stretch gap-5 lg:grid-cols-2 xl:grid-cols-[1fr_1.15fr_1fr]">
          <RunsPanel runs={runs} toPerson={toPerson} traps={traps.length} onOpen={setOpen} onTraps={() => { setTab("traps"); document.getElementById("run-table")?.scrollIntoView({ behavior: "smooth", block: "start" }) }} />

          {/* Four stat tiles. The accent tile is the Jev checks. */}
          <section className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-3" aria-label="Key numbers">
            <Stat icon={UserRoundIcon} label="To a person" value={`${Math.round(toPerson / runs.length * 100)}%`} chip={`${toPerson} of ${runs.length} runs`} note="A person must decide." />
            <Stat accent icon={ShieldCheckIcon} label="Jev checks" value={String(answers.length)} chip={`${traps.length} ${traps.length === 1 ? "trap" : "traps"} found`} note="on the agent proposals" />
            <Stat icon={ClockIcon} label="Jev P50 time" value={ms(percentile(jevMs, 0.5))} chip={`P99 ${ms(percentile(jevMs, 0.99))}`} note="for each answer" />
            <Stat icon={CoinsIcon} label="Jev cost" value={usd(jevCost)} chip={answers.length ? `${usd(jevCost / answers.length)} per check` : "no checks"} note="for all checks" />
          </section>

          <JevTimeChart runs={runs} cards={cards} />
        </div>

        <StepsChart runs={runs} onOpen={setOpen} />

        <section id="run-table" className="flex min-w-0 scroll-mt-4 flex-col gap-4 rounded-2xl border bg-card p-5" aria-label="Runs and Jev checks">
          <Tabs value={tab} onValueChange={setTab} className="gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-0 flex-col">
                <h2 className="text-lg font-semibold">Runs and Jev checks</h2>
                <span className="text-xs text-muted-foreground">Newest first. Click a row to open the full trace.</span>
              </div>
              <label className="ml-auto flex h-10 w-full min-w-0 items-center gap-2 rounded-xl bg-muted/50 px-3 text-[13px] sm:w-64">
                <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search runs" aria-label="Search runs by order or event" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TabsList className="h-10 rounded-xl bg-muted/50 p-1">
                <TabsTrigger value="runs" className="rounded-lg px-3 text-[13px] data-active:bg-card">Runs</TabsTrigger>
                <TabsTrigger value="checks" className="rounded-lg px-3 text-[13px] data-active:bg-card">Jev checks</TabsTrigger>
                <TabsTrigger value="traps" className="rounded-lg px-3 text-[13px] data-active:bg-card">Traps{traps.length > 0 && <span className="rounded-md bg-warning/15 px-1.5 font-mono text-[11px] text-warning tabular-nums">{traps.length}</span>}</TabsTrigger>
              </TabsList>
              <div className="flex flex-wrap items-center gap-2 sm:ml-auto" role="radiogroup" aria-label="Run status">
                {FILTERS.map(([key, label]) => <button key={key} type="button" role="radio" aria-checked={filter === key} onClick={() => setFilter(key)}
                  className={cn("flex h-8 items-center gap-1.5 rounded-xl px-3 text-[13px] transition-colors", filter === key ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground")}>
                  {label} <span className="font-mono tabular-nums">{count(key)}</span>
                </button>)}
              </div>
            </div>
            <TabsContent value="runs"><RunsTable runs={shown} cards={cards} onOpen={setOpen} /></TabsContent>
            <TabsContent value="checks"><ChecksTable rows={answers.filter(({ run }) => shown.includes(run))} onOpen={setOpen} /></TabsContent>
            <TabsContent value="traps"><ChecksTable rows={traps.filter(({ run }) => shown.includes(run))} onOpen={setOpen} /></TabsContent>
          </Tabs>
        </section>
      </>}
    </div>

    <Sheet open={!!openRun} onOpenChange={(next) => { if (!next) setOpen(null) }}>
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-2xl">
        {openRun && <>
          <SheetHeader className="gap-2 p-5 pb-3">
            <SheetDescription className="flex flex-wrap items-center gap-2 text-xs">
              <Link href={`/orders/${openRun.orderId}`} className="font-mono text-foreground underline-offset-4 hover:underline">{openRun.orderRef}</Link>
              <span aria-hidden="true">·</span><span className="font-mono tabular-nums">{fmtDateTime(openRun.startedAt)}</span>
              <span aria-hidden="true">·</span><span>{openRun.mode === "scripted" ? "Scripted replay" : openRun.model}</span>
            </SheetDescription>
            <SheetTitle className="pr-8 text-lg leading-snug font-semibold tracking-tight">{openRun.trigger}</SheetTitle>
            <div className="flex flex-wrap items-center gap-1.5">
              <RunStatusBadge status={openRun.status} />
              {openCard && <JevChip card={openCard} />}
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Mini label="Duration" value={ms(duration(openRun))} />
              <Mini label={`Steps, ${openRun.steps.filter(isTool).length} tools`} value={`${openRun.steps.length}`} />
              <Mini label="Tool time" value={ms(toolMs(openRun))} />
              <Mini label="Jev cost" value={openCard ? usd(openCard.jev.answers.reduce((sum, answer) => sum + (answer.costUsd ?? 0), 0)) : "–"} />
            </ul>
          </SheetHeader>
          <div className="px-5 pb-5"><RunTrace run={openRun} card={openCard} /></div>
        </>}
      </SheetContent>
    </Sheet>
  </AppFrame>
}

function Stat({ icon: Icon, label, value, chip, note, accent }: { icon: LucideIcon; label: string; value: string; chip: string; note: string; accent?: boolean }) {
  return <div className={cn("flex min-w-0 flex-col gap-3 rounded-xl p-4", accent ? "bg-primary text-primary-foreground" : "bg-muted/50")}>
    <div className="flex items-start justify-between gap-2">
      <span className={cn("text-[13px] leading-snug", accent ? "text-primary-foreground/85" : "text-muted-foreground")}>{label}</span>
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", accent ? "bg-primary-foreground/15" : "bg-card shadow-xs")}><Icon className="size-4" aria-hidden="true" /></span>
    </div>
    <span className="mt-auto font-mono text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
    <span className={cn("flex flex-wrap items-center gap-1.5 text-[11px] leading-snug", accent ? "text-primary-foreground/85" : "text-muted-foreground")}>
      <span className={cn("rounded-md px-1.5 py-0.5 font-mono tabular-nums", accent ? "bg-primary-foreground/15 text-primary-foreground" : "bg-card text-foreground")}>{chip}</span>{note}
    </span>
  </div>
}

function Mini({ label, value }: { label: string; value: string }) {
  return <li className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-foreground/[0.04] p-3">
    <span className="font-mono text-base font-semibold tabular-nums">{value}</span>
    <span className="text-[11px] text-muted-foreground">{label}</span>
  </li>
}

function StatusDot({ status }: { status: AgentRun["status"] }) {
  const { icon: Icon, className, label } = STATUS[status]
  return <span className={cn("grid size-7 shrink-0 place-items-center rounded-full bg-card shadow-xs", className)} title={label}><Icon className="size-3.5" aria-label={label} /></span>
}

/** The runs in all: the count, the outcome as one stacked bar, and the latest runs. */
function RunsPanel({ runs, toPerson, traps, onOpen, onTraps }: { runs: AgentRun[]; toPerson: number; traps: number; onOpen: (id: string) => void; onTraps: () => void }) {
  const parts = (Object.keys(STATUS) as AgentRun["status"][]).map((status) => ({ status, ...STATUS[status], value: runs.filter((run) => run.status === status).length }))
  const steps = runs.reduce((sum, run) => sum + run.steps.length, 0)
  return <section className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-5" aria-label="Agent runs">
    <div className="flex flex-col gap-1">
      <h2 className="text-[13px] text-muted-foreground">Agent runs</h2>
      <span className="font-mono text-4xl font-semibold tracking-tight tabular-nums">{runs.length}<span className="ml-2 font-sans text-base font-normal text-muted-foreground">runs</span></span>
      <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-foreground tabular-nums">{runs.length - toPerson} closed</span>
        without a person
      </span>
    </div>
    <div className="flex flex-col gap-2.5">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={parts.map((part) => `${part.label}: ${part.value}`).join(", ")}>
        {parts.map((part) => part.value > 0 && <span key={part.status} className={cn("h-full first:rounded-l-full last:rounded-r-full", part.bar)} style={{ flexGrow: part.value }} title={`${part.label}: ${part.value}`} />)}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
        {parts.map((part) => <li key={part.status} className="flex items-center gap-1.5"><span className={cn("size-2.5 rounded-xs", part.bar)} aria-hidden="true" />{part.label}<span className="font-mono text-foreground tabular-nums">{part.value}</span></li>)}
      </ul>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <Button size="lg" className="h-11" onClick={() => onOpen(runs[0].id)}><BotIcon data-icon="inline-start" aria-hidden="true" />Latest trace</Button>
      <Button size="lg" variant="outline" className="h-11" onClick={onTraps}><ShieldAlertIcon data-icon="inline-start" aria-hidden="true" />See traps <span className="font-mono text-xs tabular-nums">{traps}</span></Button>
    </div>
    <div className="mt-auto flex flex-col gap-2 rounded-xl bg-muted/50 p-3">
      <h3 className="text-[13px]"><span className="font-medium">Latest runs</span><span className="text-muted-foreground"> · {steps} steps in all</span></h3>
      <ul className="flex flex-col gap-1.5">
        {runs.slice(0, 3).map((run) => <li key={run.id}>
          <button type="button" onClick={() => onOpen(run.id)} className="flex w-full items-center gap-3 rounded-lg bg-card px-3 py-2 text-left text-[13px] shadow-xs hover:bg-accent/60">
            <StatusDot status={run.status} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-baseline gap-2"><span className="font-mono text-xs">{run.orderRef}</span><span className="ml-auto font-mono text-[11px] text-muted-foreground tabular-nums">{fmtDateTime(run.startedAt)}</span></span>
              <span className="truncate text-xs text-muted-foreground" title={run.trigger}>{run.trigger}</span>
            </span>
          </button>
        </li>)}
      </ul>
    </div>
  </section>
}

function Toggle({ on, onChange, swatch, children }: { on: boolean; onChange: (on: boolean) => void; swatch: string; children: React.ReactNode }) {
  return <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
    <span className={cn("relative h-4 w-7 rounded-full transition-colors", on ? "bg-primary" : "bg-border")}><span className={cn("absolute top-0.5 size-3 rounded-full bg-background transition-all", on ? "left-3.5" : "left-0.5")} /></span>
    <span className={cn("size-2.5 rounded-xs", swatch)} aria-hidden="true" />{children}
  </button>
}

/** Each run as one segmented bar, one segment per step in order. Tool calls are series 1, the rest series 2. */
function StepsChart({ runs, onOpen }: { runs: AgentRun[]; onOpen: (id: string) => void }) {
  const [show, setShow] = useState({ tools: true, other: true })
  const ordered = [...runs].reverse()
  const longest = Math.max(...ordered.map((run) => run.steps.length), 1)
  const tools = runs.reduce((sum, run) => sum + run.steps.filter(isTool).length, 0)
  const other = runs.reduce((sum, run) => sum + run.steps.length, 0) - tools
  const STEP_WORD: Record<TraceStep["kind"], string> = { thought: "Reasoning", tool: "Tool call", driver: "Driver reply", outcome: "Outcome" }
  return <section className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-5" aria-label="Steps per run">
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Steps per run</h2>
      <p className="text-[13px] text-muted-foreground">One segment for each step, in order. The oldest run is at the top. Click a run to open its trace.</p>
    </div>
    <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-4" role="group" aria-label={`Steps of ${ordered.length} runs, oldest first. The runs table lists the same runs.`}>
      {ordered.map((run) => <button key={run.id} type="button" onClick={() => onOpen(run.id)} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-lg px-1 py-0.5 text-left hover:bg-muted sm:grid-cols-[8rem_minmax(0,1fr)_7.5rem]">
        <span className="flex flex-col leading-tight"><span className="font-mono text-xs">{run.orderRef}</span><span className="font-mono text-[10px] text-muted-foreground tabular-nums">{clock(run.startedAt)} UTC</span></span>
        <span className="flex h-5 gap-0.5" style={{ width: `${run.steps.length / longest * 100}%` }}>
          {run.steps.map((step, index) => {
            const on = isTool(step) ? show.tools : show.other
            return <span key={index} className={cn("h-full flex-1 rounded-[4px] transition-colors", !on ? "bg-muted-foreground/15" : isTool(step) ? "bg-[var(--chart-1)]" : "bg-[var(--chart-2)]")}
              title={`${run.orderRef} · step ${index + 1}: ${STEP_WORD[step.kind]}${step.kind === "tool" ? ` (${step.tool}, ${step.ms} ms)` : ""}`} />
          })}
        </span>
        <span className="col-start-2 font-mono text-[11px] text-muted-foreground tabular-nums sm:col-start-auto sm:text-right"><span className="text-foreground">{run.steps.length}</span> steps · {run.steps.filter(isTool).length} tools</span>
      </button>)}
    </div>
    <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
      <Toggle on={show.tools} swatch="bg-[var(--chart-1)]" onChange={(on) => setShow((value) => ({ ...value, tools: on }))}>Tool calls <span className="font-mono text-foreground tabular-nums">{tools}</span></Toggle>
      <Toggle on={show.other} swatch="bg-[var(--chart-2)]" onChange={(on) => setShow((value) => ({ ...value, other: on }))}>Reasoning, replies and outcome <span className="font-mono text-foreground tabular-nums">{other}</span></Toggle>
    </div>
  </section>
}

/** Jev answer time per run: P50 and P99 bars on one millisecond axis, with the values on the right. */
function JevTimeChart({ runs, cards }: { runs: AgentRun[]; cards: Map<string, AgentCard> }) {
  const rows = [...runs].reverse().flatMap((run) => {
    const times = (run.cardId ? cards.get(run.cardId)?.jev.answers ?? [] : []).map((answer) => answer.ms)
    return times.length ? [{ run, p50: percentile(times, 0.5)!, p99: percentile(times, 0.99)! }] : []
  })
  const top = Math.max(...rows.map((row) => row.p99), 1)
  const step = top > 800 ? 500 : top > 400 ? 200 : 100
  const max = Math.ceil(top / step) * step
  const ticks = Array.from({ length: max / step + 1 }, (_, index) => index * step)
  return <section className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-5 lg:col-span-2 xl:col-span-1" aria-label="Jev time per run">
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Jev time per run</h2>
      <p className="text-[13px] text-muted-foreground">Answer time for each run with a Jev check. The oldest run is at the top.</p>
    </div>
    <div className="flex flex-1 flex-col gap-3 rounded-xl bg-muted/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-medium">By run</h3>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-label="Legend">
          <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-xs bg-[var(--chart-1)]" aria-hidden="true" />P50</li>
          <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-xs bg-[var(--chart-2)]" aria-hidden="true" />P99</li>
        </ul>
      </div>
      {rows.length === 0 ? <p className="text-xs text-muted-foreground">No Jev checks yet.</p> : <div className="flex flex-1 flex-col justify-center gap-2" role="img" aria-label={`Jev answer time for ${rows.length} runs. The Jev checks tab lists every answer.`}>
        {rows.map(({ run, p50, p99 }) => <div key={run.id} className="flex flex-col gap-0.5">
          <span className="flex items-baseline gap-2 font-mono text-[11px] leading-tight tabular-nums">
            <span>{run.orderRef}</span><span className="text-[10px] text-muted-foreground">{clock(run.startedAt)} UTC</span>
            <span className="ml-auto">{ms(p50)}</span><span className="text-muted-foreground">{ms(p99)}</span>
          </span>
          <span className="relative flex flex-col gap-px">
            {ticks.map((tick) => <span key={tick} className="pointer-events-none absolute -inset-y-0.5 border-l border-dashed border-muted-foreground/20" style={{ left: `${tick / max * 100}%` }} aria-hidden="true" />)}
            <span className="relative h-1.5 rounded-r-[3px] bg-[var(--chart-1)]" style={{ width: `${p50 / max * 100}%` }} title={`${run.orderRef} · P50 ${ms(p50)}`} />
            <span className="relative h-1.5 rounded-r-[3px] bg-[var(--chart-2)]" style={{ width: `${p99 / max * 100}%` }} title={`${run.orderRef} · P99 ${ms(p99)}`} />
          </span>
        </div>)}
        <span className="relative mt-1 h-3 font-mono text-[10px] text-muted-foreground tabular-nums" aria-hidden="true">
          {ticks.map((tick, index) => <span key={tick} className={cn("absolute leading-none whitespace-nowrap", index === 0 ? "" : index === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: `${tick / max * 100}%` }}>{index === ticks.length - 1 ? `${tick} ms` : tick}</span>)}
        </span>
      </div>}
    </div>
  </section>
}

function TablePanel({ empty, children }: { empty: string | null; children: React.ReactNode }) {
  return <div className="max-h-[38rem] overflow-auto rounded-xl bg-muted/30">
    {empty ? <p className="px-4 py-6 text-sm text-muted-foreground">{empty}</p> : children}
  </div>
}

function RunsTable({ runs, cards, onOpen }: { runs: AgentRun[]; cards: Map<string, AgentCard>; onOpen: (id: string) => void }) {
  return <TablePanel empty={runs.length ? null : "No run matches the search or the filter."}>
    <Table className="text-[13px]">
      <TableHeader><TableRow className="sticky top-0 z-10 bg-muted hover:bg-muted">
        <TableHead className="w-12 pl-4"><span className="sr-only">Status</span></TableHead><TableHead>Run</TableHead><TableHead>Start time</TableHead>
        <TableHead className="text-right">Duration</TableHead><TableHead className="text-right">Steps</TableHead><TableHead className="text-right">Tool time</TableHead>
        <TableHead>Jev</TableHead><TableHead className="text-right">Jev cost</TableHead><TableHead className="pr-4">Outcome</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {runs.map((run) => {
          const card = run.cardId ? cards.get(run.cardId) : undefined
          const cost = (card?.jev.answers ?? []).reduce((sum, answer) => sum + (answer.costUsd ?? 0), 0)
          return <TableRow key={run.id} className="cursor-pointer" onClick={() => onOpen(run.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") onOpen(run.id) }} aria-label={`Open the trace for ${run.orderRef}`}>
            <TableCell className="py-2.5 pl-4"><StatusDot status={run.status} /></TableCell>
            <TableCell className="max-w-md min-w-56 py-2.5 whitespace-normal">
              <span className="block font-mono text-xs font-medium">{run.orderRef}</span>
              <span className="line-clamp-1 text-muted-foreground" title={run.trigger}>{run.trigger}</span>
            </TableCell>
            <TableCell className="py-2.5 font-mono text-xs tabular-nums">{fmtDateTime(run.startedAt)}</TableCell>
            <TableCell className="py-2.5 text-right font-mono text-xs tabular-nums">{ms(duration(run))}</TableCell>
            <TableCell className="py-2.5 text-right font-mono text-xs tabular-nums">{run.steps.length} <span className="text-muted-foreground">/ {run.steps.filter(isTool).length} tools</span></TableCell>
            <TableCell className="py-2.5 text-right font-mono text-xs tabular-nums">{ms(toolMs(run))}</TableCell>
            <TableCell className="py-2.5">{card ? <JevChip card={card} /> : <span className="text-xs text-muted-foreground">No card</span>}</TableCell>
            <TableCell className="py-2.5 text-right font-mono text-xs tabular-nums">{card ? usd(cost) : "–"}</TableCell>
            <TableCell className="py-2.5 pr-4"><RunStatusBadge status={run.status} /></TableCell>
          </TableRow>
        })}
      </TableBody>
    </Table>
  </TablePanel>
}

const MARK: Record<JevAnswer["mark"], { className: string; label: string }> = {
  trap: { className: "text-warning", label: "Trap" },
  unsure: { className: "text-muted-foreground", label: "Unsure" },
  ok: { className: GOOD, label: "Pass" },
}

function ChecksTable({ rows, onOpen }: { rows: { answer: JevAnswer; run: AgentRun }[]; onOpen: (id: string) => void }) {
  return <TablePanel empty={rows.length ? null : "No Jev answer matches the search or the filter."}>
    <Table className="text-[13px]">
      <TableHeader><TableRow className="sticky top-0 z-10 bg-muted hover:bg-muted">
        <TableHead className="w-12 pl-4"><span className="sr-only">Mark</span></TableHead><TableHead>Question</TableHead><TableHead>Run</TableHead><TableHead>Answer</TableHead>
        <TableHead>Sure</TableHead><TableHead className="text-right">Time</TableHead><TableHead className="pr-4 text-right">Cost</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map(({ answer, run }, index) => <TableRow key={`${run.id}-${answer.questionId}-${index}`} className="cursor-pointer" onClick={() => onOpen(run.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") onOpen(run.id) }}>
          <TableCell className="py-2 pl-4">
            <span className={cn("grid size-7 place-items-center rounded-full bg-card shadow-xs", MARK[answer.mark].className)} title={MARK[answer.mark].label}>
              {answer.mark === "trap" ? <ShieldAlertIcon className="size-3.5" aria-label="Trap" /> : answer.mark === "unsure" ? <span className="text-xs font-semibold" aria-label="Unsure">?</span> : <CheckIcon className="size-3.5" aria-label="Pass" />}
            </span>
          </TableCell>
          <TableCell className="max-w-md min-w-56 py-2 whitespace-normal">
            <span className="line-clamp-1" title={answer.question}>{answer.question}</span>
            {answer.mark === "trap" && <span className="block text-xs text-warning">{answer.message}</span>}
          </TableCell>
          <TableCell className="py-2 font-mono text-xs">{run.orderRef}</TableCell>
          <TableCell className="py-2"><span className="rounded-md bg-card px-1.5 py-0.5 font-mono text-xs shadow-xs">{answer.answer}</span></TableCell>
          <TableCell className="py-2">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${Math.round(answer.confidence * 100)}%` }} /></span>
              <span className="font-mono text-xs tabular-nums">{Math.round(answer.confidence * 100)}%</span>
            </span>
          </TableCell>
          <TableCell className="py-2 text-right font-mono text-xs tabular-nums">{ms(answer.ms)}</TableCell>
          <TableCell className="py-2 pr-4 text-right font-mono text-xs tabular-nums">{answer.costUsd == null ? "–" : usd(answer.costUsd)}</TableCell>
        </TableRow>)}
      </TableBody>
    </Table>
  </TablePanel>
}
