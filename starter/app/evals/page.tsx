"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { ArrowDownIcon, ArrowUpIcon, InfoIcon, SparklesIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { AppFrame } from "../components/app-frame"
import { act, ControlError, useControl, type BenchRow, type EvalsView } from "../components/control"
import { Chip, More } from "../components/ui"

/* Checks and evals: for the ops lead and the Bahn engineer, not for the daily queue.
   The benchmark sets, each checker on one fixed colour, the live questions, the discovery agent and the approval limit. */

type Set = EvalsView["sets"][number]

const pct = (value?: number) => (value === undefined ? "–" : `${Math.round(value * 100)}%`)
const ms = (value?: number) => (value === undefined ? "–" : value < 1 ? "<1 ms" : `${Math.round(value)} ms`)
const usd = (value?: number) => (value === undefined ? "–" : value === 0 ? "$0" : `$${value.toFixed(value < 1 ? 3 : 2)}`)
const NAME: Record<string, string> = { jev: "Jev", laya: "Laya", laya_ft: "Laya FT", d1: "d1-3B", d1_omni: "d1-omni", code: "Rules", llm_judge: "Judge" }
const tag = (row: BenchRow) => NAME[row.model] ?? shortLabel(row)
const SHORT: Record<string, string> = { hand: "Hand-labelled", synthetic: "Synthetic", synthetic_ood: "Unseen templates", vision: "Photos and scans" }
const ORDER = ["jev", "laya", "laya_ft", "d1", "d1_omni", "code", "llm_judge"]
const color = (model: string) => `var(--checker-${model.replace("_", "-")}, var(--muted-foreground))`
const measured = (set: Set) => set.rows.filter((row) => row.status === "measured").sort((a, b) => ORDER.indexOf(a.model) - ORDER.indexOf(b.model))
const shortLabel = (row: BenchRow) => row.label.replace(/\s*\(.*\)$/, "").replace(", as released", "").replace("Large LLM judge", "LLM judge")

export default function EvalsPage() {
  const { data, error, offline } = useControl<EvalsView>("view=evals")
  const [pending, start] = useTransition()
  const [setId, setSetId] = useState("hand")

  const run = (label: string, body: Record<string, unknown>) => start(async () => {
    try { await act(body); toast.success(label) } catch (cause) { toast.error(cause instanceof Error ? cause.message : "The action failed") }
  })
  const chosen = data?.sets.find((set) => set.id === setId) ?? data?.sets[0]

  return <AppFrame section="evals">
    <div className="flex max-w-7xl flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Checks and evals</h1>
          <p className="max-w-[80ch] text-[13px] text-muted-foreground">Plain code checks the hard rules. Small decision models answer typed questions about each proposal before it reaches the queue. Each new mistake becomes a question and eval cases.</p>
        </div>
        {data && <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={pending || !data.canDiscover} title={data.canDiscover ? undefined : "Needs an LLM key in the control room"} onClick={() => run("Discovery agent finished", { action: "discover" })}><SparklesIcon aria-hidden="true" />Run discovery agent</Button>
          <Button size="sm" disabled={pending} onClick={() => run("Benchmark finished", { action: "benchmark" })}>{pending ? "Running…" : "Run benchmark"}</Button>
        </div>}
      </header>
      {error && <ControlError error={error} offline={offline} />}
      {!data && !error && <div className="grid gap-3 md:grid-cols-4" aria-busy="true">{[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-72 rounded-xl" />)}</div>}

      {data && <>
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Benchmark sets">
          {data.sets.map((set, index) => <SetCard key={set.id} set={set} variant={index % 2 ? "bars" : "list"} active={set.id === chosen?.id} onPick={() => setSetId(set.id)} />)}
        </section>

        <section className="grid gap-3 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <QuestionsCard data={data} />
          {chosen && <MetricStrip set={chosen} />}
        </section>

        {chosen && <CheckerChart sets={data.sets} chosen={chosen} onPick={setSetId} />}

        <More label="Full tables for every set and question">
          <div className="flex flex-col gap-4">
            {data.sets.map((set) => <FullTable key={set.id} set={set} questionText={data.questionText} />)}
          </div>
        </More>

        <section className="grid gap-3 lg:grid-cols-3">
          <DiscoveryCard data={data} pending={pending} run={run} />
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">Eval cases from the ops team</h2>
            <p className="text-[13px] text-muted-foreground">Each rejected card and each discovery case lands here. An area expert labels it with one tap, and the note “How did you know?” keeps the reason.</p>
            <div className="flex items-end gap-6">
              <span><span className="block font-mono text-2xl font-semibold tabular-nums">{data.unlabeled}</span><span className="text-xs text-muted-foreground">{data.unlabeled === 1 ? "case waits" : "cases wait"}</span></span>
              <span><span className="block font-mono text-2xl font-semibold tabular-nums">{data.labeled}</span><span className="text-xs text-muted-foreground">labelled</span></span>
            </div>
            <Button asChild size="sm" className="mt-auto self-start"><Link href="/label">Open labeling</Link></Button>
          </div>
          <CostLimit current={data.settings.costLimitEur} />
        </section>
      </>}
    </div>
  </AppFrame>
}

/** One benchmark set, as a prompt card in the reference: last run, size, then the checkers as a list or as bars. */
function SetCard({ set, variant, active, onPick }: { set: Set; variant: "list" | "bars"; active: boolean; onPick: () => void }) {
  const rows = measured(set)
  const best = rows.reduce<BenchRow | null>((top, row) => !top || (row.catchRate ?? 0) > (top.catchRate ?? 0) ? row : top, null)
  return <button type="button" onClick={onPick} aria-pressed={active}
    className={cn("flex min-h-72 flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-foreground/25", active && "border-primary/60 ring-1 ring-primary/30")}>
    <span className="flex items-start justify-between gap-2">
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">Last run: {set.ranAt ?? "never"}<InfoIcon className="size-3" aria-hidden="true" /></span>
      <span className="font-mono text-sm font-semibold tabular-nums" title="Test cases">{set.counts?.test ?? 0}</span>
    </span>
    <span className="text-lg leading-tight font-semibold tracking-tight">{SHORT[set.id] ?? set.label}</span>
    {rows.length === 0 && <span className="text-xs text-muted-foreground">Run the benchmark to fill this set.</span>}
    {variant === "list" && rows.length > 0 && <span className="flex flex-col">
      {rows.slice(0, 4).map((row) => {
        const lowAlarms = (row.falseAlarmRate ?? 1) <= 0.15
        return <span key={row.model} className="flex items-center gap-2 border-b border-dashed py-2 last:border-0">
          <span className="size-2 shrink-0 rounded-full" style={{ background: color(row.model) }} aria-hidden="true" />
          <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{shortLabel(row)}</span><span className="text-[11px] text-muted-foreground">{usd(row.costPer1000)} per 1,000</span></span>
          <span className="font-mono text-[13px] tabular-nums">{pct(row.catchRate)}</span>
          <span className={cn("inline-flex w-14 items-center justify-end gap-0.5 font-mono text-xs tabular-nums", lowAlarms ? "text-[oklch(0.62_0.15_155)]" : "text-danger")} title="False alarms">
            {lowAlarms ? <ArrowDownIcon className="size-3" aria-hidden="true" /> : <ArrowUpIcon className="size-3" aria-hidden="true" />}{pct(row.falseAlarmRate)}
          </span>
        </span>
      })}
    </span>}
    {variant === "bars" && rows.length > 0 && <span className="flex flex-1 flex-col justify-end gap-1">
      <span className="flex h-32 items-end gap-1.5" role="img" aria-label={`Catch rate: ${rows.map((row) => `${shortLabel(row)} ${pct(row.catchRate)}`).join(", ")}`}>
        {rows.map((row) => <span key={row.model} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${row.label}: catch ${pct(row.catchRate)}, false alarms ${pct(row.falseAlarmRate)}`}>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{pct(row.catchRate)}</span>
          <span className="w-full max-w-5 rounded-t-[4px]" style={{ height: `${Math.max(3, (row.catchRate ?? 0) * 100)}%`, background: `linear-gradient(to top, color-mix(in oklch, ${color(row.model)} 55%, transparent), ${color(row.model)})` }} />
        </span>)}
      </span>
      <span className="flex gap-1.5 border-t pt-1">{rows.map((row) => <span key={row.model} className="flex-1 truncate text-center text-[10px] text-muted-foreground">{tag(row)}</span>)}</span>
    </span>}
    <span className="mt-auto flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{best ? <>Best catch rate: <span className="text-foreground">{shortLabel(best)}</span></> : "No result yet"}</span>
      <span className="flex flex-wrap gap-1.5">
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px]">{set.counts?.test ?? 0} test cases</span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px]">{set.counts?.other ?? 0} for training</span>
      </span>
    </span>
  </button>
}

/** The live questions with the share Jev answers right on the hand-labelled set, as bars behind the text. */
function QuestionsCard({ data }: { data: EvalsView }) {
  const jev = data.sets.find((set) => set.id === "hand")?.rows.find((row) => row.model === "jev")
  return <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
    <div className="flex items-baseline justify-between"><h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">Live questions<InfoIcon className="size-3.5 text-muted-foreground" aria-hidden="true" /></h2><span className="text-xs text-muted-foreground">Jev correct, hand set</span></div>
    <ul className="flex flex-col gap-1.5">
      {data.live.map((question) => {
        const result = jev?.perQuestion[question.id]
        const share = result && result.n ? result.correct / result.n : null
        return <li key={question.id} className="flex items-center gap-3" title={`${question.question} · ${question.source} · v${question.version}${question.approvedBy ? ` · approved by ${question.approvedBy}` : ""}`}>
          <span className="relative min-w-0 flex-1 overflow-hidden rounded-md px-2 py-1.5">
            <span className="absolute inset-y-0 left-0 rounded-md bg-muted" style={{ width: `${(share ?? 0) * 100}%` }} aria-hidden="true" />
            <span className="relative block truncate text-[13px]">{question.question}</span>
          </span>
          <span className="w-10 text-right font-mono text-xs tabular-nums">{share === null ? (question.modelChecked ? "–" : "code") : `${Math.round(share * 100)}%`}</span>
        </li>
      })}
    </ul>
  </div>
}

/** Three metrics side by side, split by dashed lines, each as a dot strip on its own scale. */
function MetricStrip({ set }: { set: Set }) {
  const rows = measured(set)
  const metrics: { label: string; pick: (row: BenchRow) => number | undefined; fmt: (value?: number) => string; lowIsGood: boolean }[] = [
    { label: "Time per check", pick: (row) => row.msPerCheck, fmt: ms, lowIsGood: true },
    { label: "Cost per 1,000 checks", pick: (row) => row.costPer1000, fmt: usd, lowIsGood: true },
    { label: "Calibration error", pick: (row) => row.calibrationError, fmt: (value) => value === undefined ? "–" : value.toFixed(2), lowIsGood: true },
  ]
  return <div className="grid gap-x-6 gap-y-5 rounded-xl border bg-card p-4 md:grid-cols-3" aria-label={`Metrics for ${SHORT[set.id] ?? set.label}`}>
    <p className="text-xs text-muted-foreground md:col-span-3">Decision models only, on the {SHORT[set.id] ?? set.label} set. The strips use a log scale. The plain code rules cost nothing and take less than 1 ms.</p>
    {metrics.map((metric) => {
      const values = rows.filter((row) => row.model !== "code").map((row) => ({ row, value: metric.pick(row) })).filter((item): item is { row: BenchRow; value: number } => item.value !== undefined)
      const max = Math.max(...values.map((item) => item.value), 0.0001)
      const min = Math.max(Math.min(...values.map((item) => item.value)), max / 1000, 0.0001)
      const at = (value: number) => max === min ? 50 : (Math.log(Math.max(value, min)) - Math.log(min)) / (Math.log(max) - Math.log(min)) * 100
      const best = values.reduce<(typeof values)[number] | null>((top, item) => !top || item.value < top.value ? item : top, null)
      return <div key={metric.label} className="flex flex-col gap-3 border-l border-dashed pl-4">
        <span className="text-xs text-muted-foreground">{metric.label}</span>
        <span className="flex flex-col"><span className="font-mono text-2xl font-semibold tracking-tight">{best ? metric.fmt(best.value) : "–"}</span><span className="text-xs text-muted-foreground">{best ? `Best: ${shortLabel(best.row)}` : "No model measured"}</span></span>
        <ul className="flex flex-col gap-1">
          {values.map(({ row, value }) => <li key={row.model} className="flex items-center gap-2 text-[13px]">
            <span className="size-2 shrink-0 rounded-full" style={{ background: color(row.model) }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{shortLabel(row)}</span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{metric.fmt(value)}</span>
          </li>)}
        </ul>
        <span className="relative mt-auto h-3 rounded-full bg-muted" role="img" aria-label={`${metric.label}, log scale from ${metric.fmt(min)} to ${metric.fmt(max)}`}>
          {values.map(({ row, value }) => <span key={row.model} className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card" style={{ left: `${Math.min(97, Math.max(3, at(value)))}%`, background: color(row.model) }} title={`${row.label}: ${metric.fmt(value)}`} />)}
        </span>
      </div>
    })}
  </div>
}

/** Every checker on one set: bars for the catch rate, a dotted line for the false alarms. Both are shares, so they share one axis. */
function CheckerChart({ sets, chosen, onPick }: { sets: Set[]; chosen: Set; onPick: (id: string) => void }) {
  const rows = measured(chosen)
  const [show, setShow] = useState({ catch: true, alarms: true })
  const top = useMemo(() => rows.reduce<BenchRow | null>((best, row) => !best || (row.catchRate ?? 0) > (best.catchRate ?? 0) ? row : best, null), [rows])
  const w = 1080, h = 260, left = 40, right = 12, base = h - 26
  const slot = (w - left - right) / Math.max(1, rows.length)
  const y = (value: number) => base - value * (base - 16)
  const alarmPath = rows.map((row, index) => `${index ? "L" : "M"}${(left + slot * index + slot / 2).toFixed(1)},${y(row.falseAlarmRate ?? 0).toFixed(1)}`).join(" ")
  return <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label="Checkers compared">
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="mr-2 inline-flex items-center gap-1.5 text-sm font-semibold">Checkers compared<InfoIcon className="size-3.5 text-muted-foreground" aria-hidden="true" /></h2>
      <span className="text-xs text-muted-foreground">Set:</span>
      {sets.map((set) => <button key={set.id} type="button" onClick={() => onPick(set.id)} aria-pressed={set.id === chosen.id}
        className={cn("rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground", set.id === chosen.id && "bg-primary/12 font-medium text-foreground")}>{SHORT[set.id] ?? set.label}</button>)}
    </div>
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={`${SHORT[chosen.id]}: ${rows.map((row) => `${row.label} catch ${pct(row.catchRate)}, false alarms ${pct(row.falseAlarmRate)}`).join("; ")}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((tick) => <g key={tick}>
        <line x1={left} x2={w - right} y1={y(tick)} y2={y(tick)} stroke="var(--border)" strokeDasharray={tick ? "3 4" : undefined} />
        <text x={left - 6} y={y(tick) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">{tick * 100}%</text>
      </g>)}
      {rows.map((row, index) => {
        const x = left + slot * index
        const barW = Math.min(40, slot * 0.45)
        const value = row.catchRate ?? 0
        const isTop = row.model === top?.model
        return <g key={row.model}>
          <title>{`${row.label}: catch ${pct(row.catchRate)}, false alarms ${pct(row.falseAlarmRate)}`}</title>
          <rect x={x + (slot - barW) / 2} y={16} width={barW} height={base - 16} rx={4} fill="var(--muted)" opacity="0.5" />
          {show.catch && <rect x={x + (slot - barW) / 2} y={y(value)} width={barW} height={Math.max(2, base - y(value))} rx={4} fill={color(row.model)} opacity={isTop ? 1 : 0.55} />}
          {show.catch && <g transform={`translate(${x + slot / 2}, ${y(value) - 9})`}>
            <rect x={-19} y={-8} width={38} height={15} rx={4} fill="var(--foreground)" opacity={isTop ? 0.9 : 0.7} />
            <text textAnchor="middle" y={3} className="fill-background font-mono text-[10px]">{pct(row.catchRate)}</text>
          </g>}
          <text x={x + slot / 2} y={h - 8} textAnchor="middle" className={cn("text-[12px]", isTop ? "fill-foreground font-medium" : "fill-muted-foreground")}>{tag(row)}</text>
        </g>
      })}
      {show.alarms && <>
        <path d={alarmPath} fill="none" stroke="var(--foreground)" strokeWidth="2" strokeDasharray="2 4" strokeLinecap="round" opacity="0.8" />
        {rows.map((row, index) => <circle key={row.model} cx={left + slot * index + slot / 2} cy={y(row.falseAlarmRate ?? 0)} r={4} fill="var(--card)" stroke="var(--foreground)" strokeWidth="2"><title>{`${row.label}: false alarms ${pct(row.falseAlarmRate)}`}</title></circle>)}
      </>}
    </svg>
    <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
      <Toggle on={show.catch} onChange={(on) => setShow((value) => ({ ...value, catch: on }))}>Catch rate (bars, one colour per checker)</Toggle>
      <Toggle on={show.alarms} onChange={(on) => setShow((value) => ({ ...value, alarms: on }))}>False alarms (dotted line)</Toggle>
    </div>
  </section>
}

function Toggle({ on, onChange, children }: { on: boolean; onChange: (on: boolean) => void; children: React.ReactNode }) {
  return <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
    <span className={cn("relative h-4 w-7 rounded-full transition-colors", on ? "bg-primary" : "bg-border")}><span className={cn("absolute top-0.5 size-3 rounded-full bg-background transition-all", on ? "left-3.5" : "left-0.5")} /></span>
    {children}
  </button>
}

function FullTable({ set, questionText }: { set: Set; questionText: Record<string, string> }) {
  const rows = [...set.rows].sort((a, b) => ORDER.indexOf(a.model) - ORDER.indexOf(b.model))
  return <div className="flex flex-col gap-2">
    <h3 className="text-[13px] font-medium">{set.label} <span className="font-normal text-muted-foreground">· {set.counts ? `${set.counts.test} test cases, ${set.counts.other} more for training and calibration (not scored)` : "not generated yet: run npm run synth in the control room"}</span></h3>
    <div className="overflow-x-auto rounded-xl border">
      <Table className="text-[13px]">
        <TableHeader className="bg-muted/60"><TableRow className="hover:bg-transparent">
          <TableHead className="h-10 pl-4 text-xs">Checker</TableHead><TableHead className="h-10 text-right text-xs">Catch rate</TableHead><TableHead className="h-10 text-right text-xs">False alarms</TableHead>
          <TableHead className="h-10 text-right text-xs">Calibration error</TableHead><TableHead className="h-10 text-right text-xs">Cost per 1,000</TableHead><TableHead className="h-10 pr-4 text-right text-xs">Time per check</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.map((row) => row.status !== "measured"
            ? <TableRow key={row.model}><TableCell className="pl-4">{row.label}</TableCell><TableCell colSpan={5} className="pr-4 whitespace-normal text-muted-foreground">{row.status === "not_configured" ? `Not connected. ${row.note ?? ""}` : `Failed: ${row.note ?? ""}`}</TableCell></TableRow>
            : <TableRow key={row.model}>
              <TableCell className="pl-4"><span className="inline-flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: color(row.model) }} aria-hidden="true" />{row.label}</span></TableCell>
              <TableCell className="text-right font-mono tabular-nums">{pct(row.catchRate)}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{pct(row.falseAlarmRate)}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{row.calibrationError === undefined ? "–" : row.calibrationError.toFixed(2)}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{usd(row.costPer1000)}</TableCell>
              <TableCell className="pr-4 text-right font-mono tabular-nums">{ms(row.msPerCheck)}</TableCell>
            </TableRow>)}
        </TableBody>
      </Table>
    </div>
    {set.rows.some((row) => row.status === "measured") && <More label={`Results for each question · ${SHORT[set.id] ?? set.label}`}>
      <div className="overflow-x-auto rounded-xl border">
        <Table className="text-[13px]">
          <TableHeader className="bg-muted/60"><TableRow className="hover:bg-transparent"><TableHead className="h-10 pl-4 text-xs">Checker</TableHead><TableHead className="h-10 text-xs">Question</TableHead><TableHead className="h-10 text-right text-xs">Correct</TableHead><TableHead className="h-10 text-right text-xs">Traps caught</TableHead><TableHead className="h-10 pr-4 text-right text-xs">False alarms</TableHead></TableRow></TableHeader>
          <TableBody>{rows.flatMap((row) => Object.entries(row.perQuestion).map(([question, result]) => <TableRow key={row.model + question}>
            <TableCell className="pl-4">{row.label}</TableCell>
            <TableCell className="max-w-md whitespace-normal">{questionText[question] ?? question}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">{result.correct}/{result.n}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">{result.caught}/{result.traps}</TableCell>
            <TableCell className="pr-4 text-right font-mono tabular-nums">{result.falseAlarms}/{result.negatives}</TableCell>
          </TableRow>))}</TableBody>
        </Table>
      </div>
    </More>}
  </div>
}

function DiscoveryCard({ data, pending, run }: { data: EvalsView; pending: boolean; run: (label: string, body: Record<string, unknown>) => void }) {
  return <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
    <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold"><SparklesIcon className="size-4 text-primary" aria-hidden="true" />Found by the discovery agent <span className="font-mono text-xs font-normal text-muted-foreground">{data.proposed.length}</span></h2>
    {data.proposed.length ? <ul className="flex flex-col divide-y rounded-lg border">{data.proposed.map((question) => <li key={question.id} className="flex flex-col gap-2 px-3 py-2.5 text-[13px]">
      <span>{question.question}<span className="block text-xs text-muted-foreground">{question.source}</span></span>
      <span className="flex gap-1.5">
        <Button size="xs" disabled={pending} onClick={() => run("Question is live", { action: "make_live", questionId: question.id })}>Make live</Button>
        <Button size="xs" variant="ghost" disabled={pending} onClick={() => run("Question dropped", { action: "retire", questionId: question.id })}>Drop</Button>
      </span>
    </li>)}</ul> : <p className="text-[13px] text-muted-foreground">No proposed questions yet. {data.canDiscover ? "Run the discovery agent on the sampled traces." : "The discovery agent needs an LLM key in the control room."}</p>}
    <div className="mt-auto flex flex-wrap gap-1.5">
      {data.live.slice(0, 3).map((question) => <Chip key={question.id} tone="neutral">{question.modelChecked ? "Model" : "Code only"} · v{question.version}</Chip>)}
    </div>
  </div>
}

/** The first step on the autonomy ladder: below the limit, the agent books alone. Set with a slider, saved on demand. */
function CostLimit({ current }: { current: number }) {
  const [value, setValue] = useState(current)
  const [pending, start] = useTransition()
  useEffect(() => setValue(current), [current])
  const save = () => start(async () => {
    try { await act({ action: "cost_limit", eur: value }); toast.success(`Approval limit is €${value}`) } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not save") }
  })
  const max = 500
  return <section id="autonomy" className="flex flex-col gap-3 rounded-xl border bg-card p-4">
    <h2 className="text-sm font-semibold">Autonomy ladder</h2>
    <div className="flex items-center justify-between text-[13px]"><span className="font-medium">Approval limit</span><span className="rounded-md border px-2 py-0.5 font-mono text-xs tabular-nums">€{value}</span></div>
    <input type="range" min={0} max={max} step={10} value={value} onChange={(event) => setValue(Number(event.target.value))} aria-label="Approval limit in euro"
      className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[var(--primary)]"
      style={{ background: `linear-gradient(to right, var(--primary) ${value / max * 100}%, var(--muted) ${value / max * 100}%)` }} />
    <p className="text-[13px] text-muted-foreground">{value > 0 ? `The agent books a ferry or train, changes a cost or offers a gig to a new driver alone when the cost is €${value} or less.` : "Every booking, date, cost and customer message needs a person."}</p>
    <p className="text-xs text-muted-foreground">A person still decides when a hard rule blocks, the customer must get a message, or a decision model gives a trap answer or is less than 80% sure.</p>
    <Button size="sm" variant="outline" className="mt-auto self-start" disabled={pending || value === current} onClick={save}>{pending ? "Saving…" : "Save limit"}</Button>
  </section>
}
