"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { BanIcon, BotIcon, CheckIcon, CircleCheckIcon, ClockIcon, HandshakeIcon, HistoryIcon, InboxIcon, SearchIcon, SearchXIcon, ShieldCheckIcon, SparklesIcon, TagIcon, UserRoundIcon, type LucideIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { AppFrame } from "../components/app-frame"
import { act, ControlError, useControl, type EvalsView, type LabelView } from "../components/control"

/* Labeling: one case at a time for an area expert. The answer becomes an eval case for the checks.
   The waiting count comes from the label view. The labelled count and the questions come from the evals view. */

const NICE: Record<string, string> = { yes: "Yes", no: "No", right: "Right", too_low: "Too low", too_high: "Too high", wrong_facts: "Wrong facts", too_early: "Too early", wrong_action: "Wrong action" }
const SOURCES = [
  { id: "operator_reject", label: "From a rejected card", note: "An operator rejected the card.", icon: BanIcon },
  { id: "discovery_agent", label: "From the discovery agent", note: "The agent found the case in a trace.", icon: SparklesIcon },
] as const

export default function LabelPage() {
  const { data, error, offline } = useControl<LabelView>("view=label")
  const evals = useControl<EvalsView>("view=evals")
  const [note, setNote] = useState("")
  const [pending, start] = useTransition()
  const candidate = data?.candidate

  const label = (answer: string) => start(async () => {
    if (!candidate) return
    try {
      await act({ action: "label", candidateId: candidate.id, answer, note })
      setNote("")
      toast.success(`Labelled: ${NICE[answer] ?? answer}`)
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not save the label") }
  })

  const waiting = data?.left ?? 0
  const labelled = evals.data?.labeled
  const source = SOURCES.find((item) => item.id === candidate?.source) ?? SOURCES[1]

  return <AppFrame section="label">
    <div className="flex max-w-7xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Labeling</h1>
          <p className="text-[13px] text-muted-foreground">One case at a time. Your answer becomes an eval case for the checks.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {data && <span className="text-[13px] text-muted-foreground">
            <span className="font-mono font-semibold text-foreground tabular-nums">{waiting}</span> waiting
            {labelled !== undefined && <> · <span className="font-mono font-semibold text-foreground tabular-nums">{labelled}</span> labelled</>}
          </span>}
          <Button asChild size="sm" variant="outline"><Link href="/evals"><ShieldCheckIcon aria-hidden="true" />Checks and evals</Link></Button>
        </div>
      </header>
      {error && <ControlError error={error} offline={offline} />}
      {!data && !error && <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]" aria-busy="true"><Skeleton className="h-[36rem] rounded-2xl" /><Skeleton className="h-80 rounded-2xl" /></div>}

      {data && <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {!candidate && <section className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-6 py-14 text-center" aria-label="No case to label">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted"><CircleCheckIcon className="size-6 text-[oklch(0.62_0.15_155)]" aria-hidden="true" /></span>
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold">All cases are labeled.</p>
            <p className="text-sm text-muted-foreground">New cases come from rejected cards and from the discovery agent.</p>
          </div>
          <Button asChild size="sm" variant="outline"><Link href="/evals">See checks and evals</Link></Button>
        </section>}

        {candidate && <section className="flex min-w-0 flex-col gap-5 rounded-2xl border bg-card p-5" aria-label="Case to label">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted"><source.icon className="size-5" aria-hidden="true" /></span>
            <div className="flex min-w-0 flex-col">
              <h2 className="text-base font-semibold">{source.label}</h2>
              <span className="text-xs text-muted-foreground">Order <span className="font-mono text-foreground">{candidate.orderRef}</span></span>
            </div>
            {waiting > 1 && <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"><span className="font-mono text-foreground tabular-nums">{waiting - 1}</span> more after this one</span>}
          </div>

          <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3">
            <h3 className="px-1 text-[13px] font-medium">What the agent knew</h3>
            <ul className="flex flex-col gap-1.5">{candidate.state.map((fact) => <li key={fact.label} className="grid gap-x-3 gap-y-0.5 rounded-lg bg-card px-3 py-2.5 text-[13px] shadow-xs sm:grid-cols-[9.5rem_minmax(0,1fr)_auto]">
              <span className="text-muted-foreground">{fact.label}</span>
              <span className="min-w-0">{fact.value}</span>
              <span className="text-xs whitespace-nowrap text-muted-foreground"><span className="font-medium text-foreground">{fact.source}</span> · {fact.age}</span>
            </li>)}</ul>
          </div>

          <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3">
            <h3 className="flex items-center gap-2 px-1 text-[13px] font-medium"><BotIcon className="size-4 text-muted-foreground" aria-hidden="true" />What the agent did</h3>
            <p className="rounded-lg bg-card px-3 py-2.5 text-[13px] whitespace-pre-line shadow-xs">{candidate.action}</p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-lg leading-snug font-semibold tracking-tight">{candidate.question}</p>
              {candidate.suggested && <p className="text-xs text-muted-foreground">Suggested: {NICE[candidate.suggested] ?? candidate.suggested}. Tap the answer you believe.</p>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Answers">
              {candidate.options.map((option) => {
                const suggested = option === candidate.suggested
                return <Button key={option} variant="outline" size="lg" disabled={pending} onClick={() => label(option)}
                  className={cn("h-14 justify-between rounded-xl px-4 text-base", suggested && "ring-1 ring-primary/50")}>
                  {NICE[option] ?? option.replaceAll("_", " ")}
                  {suggested && <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-normal text-primary">Suggested</span>}
                </Button>
              })}
            </div>
            <label className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3">
              <span className="flex items-baseline justify-between gap-2 px-1 text-[13px] font-medium">How did you know?<span className="text-xs font-normal text-muted-foreground">Optional</span></span>
              <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="The fact or the rule that told you the answer" className="min-h-20 border-0 bg-card text-sm shadow-xs dark:bg-card" />
            </label>
          </div>
        </section>}

        <aside className="flex min-w-0 flex-col gap-5">
          <section className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-3" aria-label="Totals">
            <Stat accent icon={InboxIcon} label="Cases waiting" value={waiting} note={waiting === 1 ? "1 case for you" : "for an area expert"} />
            <Stat icon={TagIcon} label="Labelled" value={labelled} note="eval cases" />
            <Stat icon={ShieldCheckIcon} label="Live questions" value={evals.data?.live.length} note={evals.data ? `${evals.data.live.filter((question) => question.modelChecked).length} model checked` : "–"} />
            <Stat icon={SparklesIcon} label="Proposed questions" value={evals.data?.proposed.length} note="from the discovery agent" />
            {data.agreement && <Stat className="col-span-2" icon={HandshakeIcon} label="Experts agree with the suggestion"
              value={data.agreement.total ? `${Math.round((data.agreement.agreed / data.agreement.total) * 100)}%` : undefined}
              note={data.agreement.total ? `${data.agreement.agreed} of ${data.agreement.total} labelled cases with a suggestion` : "No labelled case has a suggestion yet"} />}
          </section>

          <Progress labelled={labelled} waiting={waiting} />

          <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5" aria-label="Where cases come from">
            <h2 className="text-base font-semibold">Where cases come from</h2>
            <ul className="flex flex-col gap-1.5">{SOURCES.map((item) => {
              const current = candidate?.source === item.id
              return <li key={item.id} className="flex items-start gap-3 rounded-lg bg-muted/50 px-3 py-2.5 text-[13px]">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", current ? "bg-warning" : "bg-muted-foreground/40")} aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5"><span className="font-medium">{item.label}</span><span className="text-xs text-muted-foreground">{item.note}</span></span>
                {current && <span className="text-xs text-warning">This case</span>}
              </li>
            })}</ul>
          </section>
        </aside>
      </div>}

      {data?.waiting && <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <WaitingList cases={data.waiting} currentId={candidate?.id} />
          {data.recent && <RecentList cases={data.recent} />}
        </div>
        {data.byQuestion && <ByQuestion rows={data.byQuestion} />}
      </div>}
    </div>
  </AppFrame>
}

type Waiting = NonNullable<LabelView["waiting"]>[number]
type Recent = NonNullable<LabelView["recent"]>[number]
const nice = (answer: string | null) => (answer ? NICE[answer] ?? answer.replaceAll("_", " ") : "–")
const GOOD = "text-[oklch(0.62_0.15_155)]"

function Pill({ active, onClick, title, children }: { active: boolean; onClick: () => void; title?: string; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} title={title}
    className={cn("flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-xl px-3 text-[13px] transition-colors", active ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground")}>{children}</button>
}

const Count = ({ n }: { n: number }) => <span className="rounded bg-card px-1.5 font-mono text-[11px] tabular-nums shadow-xs">{n}</span>

/** All unlabelled cases, newest first, with a search and filters by source and by question. */
function WaitingList({ cases, currentId }: { cases: Waiting[]; currentId: string | undefined }) {
  const [query, setQuery] = useState("")
  const [source, setSource] = useState<string>("all")
  const [question, setQuestion] = useState<string>("all")
  const questions = useMemo(() => {
    const map = new Map<string, { id: string; text: string; n: number }>()
    for (const item of cases) {
      const row = map.get(item.questionId) ?? { id: item.questionId, text: item.question, n: 0 }
      row.n++
      map.set(item.questionId, row)
    }
    return [...map.values()]
  }, [cases])
  const q = query.trim().toLowerCase()
  const shown = cases.filter((item) => (source === "all" || item.source === source) && (question === "all" || item.questionId === question)
    && (!q || `${item.orderRef} ${item.question} ${nice(item.suggested)}`.toLowerCase().includes(q)))

  return <section className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4" aria-label="Cases waiting">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-base font-semibold"><InboxIcon className="size-4 text-muted-foreground" aria-hidden="true" />Cases waiting
        <span className="font-mono text-[13px] font-normal text-muted-foreground tabular-nums">{shown.length === cases.length ? cases.length : `${shown.length} of ${cases.length}`}</span></h2>
      <InputGroup className="h-8 w-full sm:w-64">
        <InputGroupAddon><SearchIcon className="size-3.5" aria-hidden="true" /></InputGroupAddon>
        <InputGroupInput className="text-[13px]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order or question" aria-label="Search cases waiting" />
      </InputGroup>
    </div>
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by source">
      <Pill active={source === "all"} onClick={() => setSource("all")}>All sources<Count n={cases.length} /></Pill>
      {SOURCES.map((item) => <Pill key={item.id} active={source === item.id} onClick={() => setSource(source === item.id ? "all" : item.id)}>
        <item.icon className="size-3.5" aria-hidden="true" />{item.label}<Count n={cases.filter((c) => c.source === item.id).length} />
      </Pill>)}
    </div>
    {questions.length > 0 && <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by question">
      <Pill active={question === "all"} onClick={() => setQuestion("all")}>All questions</Pill>
      {questions.map((item) => <Pill key={item.id} active={question === item.id} onClick={() => setQuestion(question === item.id ? "all" : item.id)} title={item.text}>
        <span className="truncate sm:max-w-64">{item.text}</span><Count n={item.n} />
      </Pill>)}
    </div>}
    {cases.length === 0 && <p className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-3 text-[13px] text-muted-foreground"><CircleCheckIcon className={cn("size-4", GOOD)} aria-hidden="true" />No case waits for a label.</p>}
    {cases.length > 0 && shown.length === 0 && <p className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-3 text-[13px] text-muted-foreground"><SearchXIcon className="size-4" aria-hidden="true" />No case matches the filters.</p>}
    {shown.length > 0 && <ul className="flex flex-col gap-1.5">{shown.map((item) => {
      const from = SOURCES.find((s) => s.id === item.source) ?? SOURCES[1]
      const current = item.id === currentId
      return <li key={item.id} className={cn("grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-lg px-3 py-2.5 text-[13px] sm:grid-cols-[auto_minmax(0,1fr)_auto]", current ? "bg-primary/5 ring-1 ring-primary/40" : "bg-muted/50")}>
        <span className="mt-0.5 flex size-7 items-center justify-center rounded-full bg-card shadow-xs" title={from.label}><from.icon className="size-3.5" aria-hidden="true" /><span className="sr-only">{from.label}</span></span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-medium">{item.orderRef}</span>
            {current && <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">This case</span>}</span>
          <span className="min-w-0">{item.question}</span>
          <span className="text-xs text-muted-foreground">Suggested: <span className="text-foreground">{nice(item.suggested)}</span></span>
        </span>
        <span className="col-start-2 flex items-center gap-1 text-xs whitespace-nowrap text-muted-foreground sm:col-start-3" title={item.createdAt}><ClockIcon className="size-3" aria-hidden="true" />{item.age}</span>
      </li>
    })}</ul>}
  </section>
}

/** The last labelled cases: the label, if it agrees with the suggestion, the note and who labelled it. */
function RecentList({ cases }: { cases: Recent[] }) {
  return <section className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4" aria-label="Recently labelled">
    <h2 className="flex items-center gap-2 text-base font-semibold"><HistoryIcon className="size-4 text-muted-foreground" aria-hidden="true" />Recently labelled
      <span className="font-mono text-[13px] font-normal text-muted-foreground tabular-nums">{cases.length}</span></h2>
    {cases.length === 0 && <p className="rounded-lg bg-muted/50 px-3 py-3 text-[13px] text-muted-foreground">No case has a label yet. Labels show here after an expert gives them.</p>}
    {cases.length > 0 && <ul className="flex flex-col gap-1.5">{cases.map((item) => {
      const agrees = item.suggested !== null && item.label === item.suggested
      return <li key={item.id} className="flex flex-col gap-1.5 rounded-lg bg-muted/50 px-3 py-2.5 text-[13px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">{nice(item.label)}</span>
          {agrees && <span className={cn("flex items-center gap-1 text-xs", GOOD)} title="The label is the same as the suggestion"><CheckIcon className="size-3.5" aria-hidden="true" />Agrees</span>}
          {item.suggested !== null && !agrees && <span className="rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground" title={`Suggested: ${nice(item.suggested)}`}>Changed</span>}
          <span className="font-mono text-xs text-muted-foreground">{item.orderRef}</span>
        </div>
        <p className="min-w-0">{item.question}</p>
        {item.note && <p className="text-muted-foreground italic">“{item.note}”</p>}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {item.labeledBy && <span className="flex items-center gap-1"><UserRoundIcon className="size-3" aria-hidden="true" />{item.labeledBy}</span>}
          {item.labeledAge && <span className="flex items-center gap-1" title={item.labeledAt ?? undefined}><ClockIcon className="size-3" aria-hidden="true" />{item.labeledAge}</span>}
        </p>
      </li>
    })}</ul>}
  </section>
}

/** One stacked bar per question: labelled against waiting, on one shared scale. */
function ByQuestion({ rows }: { rows: NonNullable<LabelView["byQuestion"]> }) {
  const max = Math.max(1, ...rows.map((row) => row.labeled + row.waiting))
  const parts = [
    { key: "labeled" as const, label: "Labelled", color: "var(--chart-1)" },
    { key: "waiting" as const, label: "Waiting", color: "var(--chart-2)" },
  ]
  return <section className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4" aria-label="By question">
    <div className="flex flex-col gap-1">
      <h2 className="text-base font-semibold">By question</h2>
      <p className="text-xs text-muted-foreground">Labelled and waiting cases for each question.</p>
    </div>
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
      {parts.map((part) => <li key={part.key} className="flex items-center gap-1.5"><span className="size-2.5 rounded-xs" style={{ background: part.color }} aria-hidden="true" />{part.label}</li>)}
    </ul>
    {rows.length === 0 && <p className="rounded-lg bg-muted/50 px-3 py-3 text-[13px] text-muted-foreground">No cases yet.</p>}
    <ul className="flex flex-col gap-3">{rows.map((row) => {
      const total = row.labeled + row.waiting
      return <li key={row.questionId} className="flex flex-col gap-1.5" title={`${row.question}\nLabelled: ${row.labeled}. Waiting: ${row.waiting}. Agree with the suggestion: ${row.agreed}.`}>
        <span className="line-clamp-2 text-[13px] leading-snug">{row.question}</span>
        <div className="flex items-center gap-2">
          <div className="flex h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${row.labeled} labelled, ${row.waiting} waiting`}>
            <div className="flex h-full gap-0.5" style={{ width: `${(total / max) * 100}%` }}>
              {parts.map((part) => row[part.key] > 0 && <span key={part.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ flexGrow: row[part.key], background: part.color }} title={`${part.label}: ${row[part.key]}`} />)}
            </div>
          </div>
          <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums"><span className="text-foreground">{row.labeled}</span> / {total}</span>
        </div>
        {row.labeled > 0 && <span className="text-[11px] text-muted-foreground"><span className="font-mono text-foreground tabular-nums">{row.agreed}</span> of <span className="font-mono tabular-nums">{row.labeled}</span> agree with the suggestion</span>}
      </li>
    })}</ul>
  </section>
}

function Stat({ icon: Icon, label, value, note, accent, className }: { icon: LucideIcon; label: string; value: number | string | undefined; note: string; accent?: boolean; className?: string }) {
  return <div className={cn("flex min-w-0 flex-col gap-3 rounded-xl p-4", accent ? "bg-primary text-primary-foreground" : "bg-muted/50", className)}>
    <div className="flex items-start justify-between gap-2">
      <span className={cn("text-[13px] leading-snug", accent ? "text-primary-foreground/85" : "text-muted-foreground")}>{label}</span>
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", accent ? "bg-primary-foreground/15" : "bg-card shadow-xs")}><Icon className="size-4" aria-hidden="true" /></span>
    </div>
    <span className="mt-auto font-mono text-3xl font-semibold tracking-tight tabular-nums">{value ?? "–"}</span>
    <span className={cn("text-[11px] leading-snug", accent ? "text-primary-foreground/85" : "text-muted-foreground")}>{note}</span>
  </div>
}

/** Labelled cases against all cases, as one stacked bar with a legend. */
function Progress({ labelled, waiting }: { labelled: number | undefined; waiting: number }) {
  const done = labelled ?? 0
  const total = done + waiting
  const parts = [
    { label: "Labelled", value: done, className: "bg-primary" },
    { label: "Waiting", value: waiting, className: "bg-muted-foreground/30" },
  ]
  return <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5" aria-label="Labeling progress">
    <div className="flex flex-col gap-1">
      <h2 className="text-[13px] text-muted-foreground">Labelled out of all cases</h2>
      <span className="flex items-baseline gap-2">
        <span className="font-mono text-3xl font-semibold tracking-tight tabular-nums">{labelled === undefined || total === 0 ? "–" : `${Math.round((done / total) * 100)}%`}</span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">{labelled === undefined ? "" : `${done} of ${total}`}</span>
      </span>
    </div>
    <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Labelled cases out of all cases">
      {total > 0 && parts.map((part) => part.value > 0 && <span key={part.label} className={cn("h-full first:rounded-l-full last:rounded-r-full", part.className)} style={{ flexGrow: part.value }} title={`${part.label}: ${part.value}`} />)}
    </div>
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
      {parts.map((part) => <li key={part.label} className="flex items-center gap-1.5"><span className={cn("size-2.5 rounded-xs", part.className)} aria-hidden="true" />{part.label}<span className="font-mono text-foreground tabular-nums">{labelled === undefined && part.label === "Labelled" ? "–" : part.value}</span></li>)}
    </ul>
  </section>
}
