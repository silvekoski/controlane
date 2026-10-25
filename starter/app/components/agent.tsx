"use client"

import Link from "next/link"
import { useEffect, useState, type ReactNode } from "react"
import {
  BotIcon, BrainIcon, CheckIcon, ChevronRightIcon, CircleCheckIcon, CircleDashedIcon, CircleXIcon, LoaderCircleIcon,
  MessageCircleIcon, ShieldAlertIcon, ShieldCheckIcon, TriangleAlertIcon, UserRoundIcon, WrenchIcon, type LucideIcon,
} from "@/components/icons"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { AgentCard, AgentRun, AgentState, JevAnswer, TraceStep } from "@/lib/agent-state"
import { fmtDateTime } from "@/lib/present/time"
import { cn } from "@/lib/utils"
import { DriverChat } from "./driver-chat"
import { Chip, Empty, SectionHead, TONE_BADGE } from "./ui"

const TOOL_LABEL: Record<string, string> = {
  get_order: "Read the order", get_gps: "Checked the GPS", lookup_place: "Looked up the place", message_driver: "Messaged the driver",
  get_travel_options: "Read ferry and train options", estimate_arrival: "Calculated the arrival", make_card: "Made a decision card", propose_action: "Made a decision card", close_quietly: "Closed without a person",
}

export const RUN_STATUS: Record<AgentRun["status"], { text: string; tone: "accent" | "ok" | "danger" }> = {
  running: { text: "Working", tone: "accent" },
  quiet: { text: "Closed without a person", tone: "ok" },
  card: { text: "Brought to a person", tone: "accent" },
  failed: { text: "Failed", tone: "danger" },
}

const RUN_ICON: Record<AgentRun["status"], LucideIcon> = { running: LoaderCircleIcon, quiet: CircleCheckIcon, card: UserRoundIcon, failed: CircleXIcon }
const RUN_ICON_CLASS: Record<AgentRun["status"], string> = { running: "text-primary", quiet: "text-[oklch(0.62_0.15_155)]", card: "text-warning", failed: "text-danger" }

/** The run status as a word with an icon. */
export function RunStatusBadge({ status }: { status: AgentRun["status"] }) {
  const Icon = RUN_ICON[status]
  return <Badge variant="outline" className={cn("border-transparent font-normal", status === "failed" ? "bg-danger/15 text-danger" : "bg-muted text-foreground")}>
    <Icon className={RUN_ICON_CLASS[status]} aria-hidden="true" />{RUN_STATUS[status].text}
  </Badge>
}

/** Loads the control room's agent state, for all orders or for one. */
export function useAgentState(order?: string) {
  const [state, setState] = useState<AgentState | null>(null)
  const [tick, setTick] = useState(0)
  // The clock bar and every action send "control-changed": read the state again.
  useEffect(() => {
    const reload = () => setTick((value) => value + 1)
    window.addEventListener("control-changed", reload)
    return () => window.removeEventListener("control-changed", reload)
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/agent${order ? `?order=${encodeURIComponent(order)}` : ""}`, { signal: controller.signal, cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<AgentState> : null)
      .then((data) => { if (data) setState(data) })
      .catch(() => {})
    return () => controller.abort()
  }, [order, tick])
  return state
}

/** The Jev mark: the decision model that checks each proposal for known traps. */
export function JevLogo({ className }: { className?: string }) {
  return <span className={cn("inline-grid h-5 shrink-0 place-items-center rounded-sm bg-primary px-1.5 text-xs font-semibold text-primary-foreground", className)} aria-hidden="true">Jev</span>
}

/** The decision models that checked one card. Jev comes first. Older state files have no `checkers` list. */
function checkersOf(card: AgentCard): AgentCard["checkers"] {
  if (card.checkers?.length) return card.checkers
  return card.jev.checked ? [{ model: "jev", label: "Jev", checked: true, traps: card.jev.traps, answers: card.jev.answers }] : []
}

/** The checks on one card in a few words: the traps found by all decision models together. */
export function JevChip({ card }: { card: AgentCard }) {
  const checkers = checkersOf(card)
  if (!checkers.length) return <Badge variant="outline" className="border-dashed font-normal text-muted-foreground"><CircleDashedIcon aria-hidden="true" />Jev: not checked</Badge>
  const traps = checkers.reduce((sum, checker) => sum + checker.traps, 0)
  const name = checkers.length === 1 ? checkers[0].label : "Checks"
  const title = checkers.map((checker) => `${checker.label}: ${checker.traps} ${checker.traps === 1 ? "trap" : "traps"} in ${checker.answers.length} answers`).join(". ")
  return <Badge variant="outline" className={cn("border-transparent font-normal", traps ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground")} title={title}>
    {traps ? <TriangleAlertIcon aria-hidden="true" /> : <CheckIcon className="text-[oklch(0.62_0.15_155)]" aria-hidden="true" />}
    <span className="font-medium">{name}</span> {traps ? `${traps} ${traps === 1 ? "trap" : "traps"}` : "no trap"}
  </Badge>
}

const MARK: Record<JevAnswer["mark"], { sign: string; word: string; className: string }> = {
  trap: { sign: "!", word: "trap", className: TONE_BADGE.warn },
  unsure: { sign: "?", word: "unsure", className: "border-dashed text-muted-foreground" },
  ok: { sign: "✓", word: "pass", className: "text-muted-foreground" },
}

function JevMark({ mark }: { mark: JevAnswer["mark"] }) {
  const { sign, word, className } = MARK[mark]
  return <Badge variant="outline" className={cn("w-[4.5rem] justify-center font-normal", className)}>
    <span className="font-mono font-semibold" aria-hidden="true">{sign}</span>{word}
  </Badge>
}

/** Five cells, as in Evidline's confidence bar, with the share in words. */
function SureBar({ value, model = "Jev" }: { value: number; model?: string }) {
  const filled = Math.round(Math.min(1, Math.max(0, value)) * 5)
  return <span role="meter" aria-label={`${model} confidence`} aria-valuemin={0} aria-valuemax={1} aria-valuenow={value} aria-valuetext={`${Math.round(value * 100)}% sure`} className="inline-flex items-center gap-2">
    <span className="flex gap-0.5" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => <span key={i} className={cn("h-2.5 w-1.5 rounded-xs border border-foreground", i < filled ? "bg-foreground" : "bg-transparent")} />)}
    </span>
    <span className="font-mono text-xs tabular-nums">{Math.round(value * 100)}% sure</span>
  </span>
}

/** What Jev checked on one card, one line for each question. */
export function JevPanel({ card }: { card: AgentCard }) {
  const traps = card.jev.traps
  return <div className="flex flex-col gap-3 rounded-xl border bg-card p-3">
    <div className="flex items-start gap-2.5">
      <JevLogo className="mt-0.5" />
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[13px] font-medium">Jev checked this proposal</h3>
        <p className="text-xs text-muted-foreground">Jev is a fast decision model. It reads the facts and the agent action. Then it answers one question for each known trap.</p>
      </div>
    </div>
    {card.jev.checked ? <>
      <p className={cn("flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-[13px]", traps ? TONE_BADGE.warn : "text-muted-foreground")}>
        {traps ? <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
        <span>{traps ? `Jev found ${traps} ${traps === 1 ? "trap" : "traps"}. Read the warnings before you approve.` : "Jev found no trap in this proposal."}</span>
      </p>
      <JevAnswers card={card} />
    </> : <Empty>Jev did not check this card.</Empty>}
    {checkersOf(card).filter((checker) => checker.model !== "jev").map((checker) => <OtherChecker key={checker.model} checker={checker} />)}
    {card.otherWarnings.length > 0 && <ul className="flex flex-col gap-1.5 border-t pt-3">
      {card.otherWarnings.map((warning, index) => <li key={index} className="flex flex-wrap items-baseline gap-2 text-[13px]"><Chip tone="warn" dot>{warning.model}</Chip> <span>{warning.message}</span></li>)}
    </ul>}
  </div>
}

/** Another decision model's answers on the card, in the same rows as Jev's. Closed by default. */
function OtherChecker({ checker }: { checker: AgentCard["checkers"][number] }) {
  return <Collapsible className="group/checker border-t pt-2">
    <CollapsibleTrigger className="flex w-full flex-wrap items-center gap-2 text-left text-[13px]">
      <ChevronRightIcon className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]/checker:rotate-90" aria-hidden="true" />
      <span className="font-medium">{checker.label}</span>
      <Chip tone={checker.traps ? "warn" : "neutral"}>{checker.traps ? `${checker.traps} ${checker.traps === 1 ? "trap" : "traps"}` : "no trap"}</Chip>
      <span className="font-mono text-xs text-muted-foreground">{checker.answers.length} answers</span>
    </CollapsibleTrigger>
    <CollapsibleContent><AnswerRows answers={checker.answers} model={checker.label} /></CollapsibleContent>
  </Collapsible>
}

export function JevAnswers({ card }: { card: AgentCard }) {
  return <AnswerRows answers={card.jev.answers} model="Jev" />
}

function AnswerRows({ answers, model }: { answers: JevAnswer[]; model: string }) {
  return <ul className="flex flex-col">
    {answers.map((answer, index) => <li key={`${answer.questionId}-${index}`} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-b py-2 text-[13px] last:border-b-0 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto]">
      <JevMark mark={answer.mark} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span>{answer.question}</span>
        <span className="text-xs text-muted-foreground">
          {model} says <span className="font-mono font-medium text-foreground">{answer.answer}</span>
          {answer.mark === "trap" && <> · <span className="font-medium text-warning">{answer.message}</span></>}
          {answer.mark === "unsure" && " · not sure enough to warn"}
        </span>
      </span>
      <span className="col-start-2 flex items-center gap-3 sm:col-start-auto sm:flex-col sm:items-end sm:gap-0.5">
        <SureBar value={answer.confidence} model={model} />
        <span className="font-mono text-xs text-muted-foreground tabular-nums">{Math.round(answer.ms)} ms</span>
      </span>
    </li>)}
  </ul>
}

function StepRow({ icon: Icon, label, iconClass, children }: { icon: LucideIcon; label: string; iconClass?: string; children: ReactNode }) {
  return <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 rounded-xl bg-foreground/[0.04] px-3 py-2.5">
    <span className={cn("grid size-7 place-items-center rounded-full bg-card text-muted-foreground shadow-xs", iconClass)}><Icon className="size-3.5" aria-hidden="true" /><span className="sr-only">{label}</span></span>
    <div className="flex min-w-0 flex-col gap-1 pt-1 text-[13px]">{children}</div>
  </li>
}

function Step({ step }: { step: TraceStep }) {
  if (step.kind === "thought") return <StepRow icon={BrainIcon} label="Thought"><span className="text-muted-foreground">{step.text}</span></StepRow>
  if (step.kind === "driver") return <StepRow icon={MessageCircleIcon} label="Driver"><span>Driver replied: “{step.text}”</span></StepRow>
  if (step.kind === "outcome") return <StepRow icon={CheckIcon} label="Outcome" iconClass="text-foreground"><span className="font-medium">{step.text}</span></StepRow>
  return <StepRow icon={WrenchIcon} label="Tool call" iconClass="text-primary">
    <span className="flex flex-wrap items-baseline gap-2">
      <span className="font-medium">{TOOL_LABEL[step.tool] ?? step.tool}</span>
      {TOOL_LABEL[step.tool] && <span className="font-mono text-xs text-muted-foreground">{step.tool}</span>}
      {step.ms ? <span className="font-mono text-xs text-muted-foreground tabular-nums">{step.ms} ms</span> : null}
    </span>
    <Collapsible className="group/raw">
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronRightIcon className="size-3 transition-transform group-data-[state=open]/raw:rotate-90" aria-hidden="true" />Input and result
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="mt-1 max-h-80 overflow-auto rounded-lg bg-card p-2.5 font-mono text-xs leading-relaxed shadow-xs">{JSON.stringify({ input: step.input, output: step.output }, null, 2)}</pre>
      </CollapsibleContent>
    </Collapsible>
  </StepRow>
}

/** One agent run: each step, then the Jev check on the card it made. */
export function RunTrace({ run, card }: { run: AgentRun; card?: AgentCard }) {
  return <div className="flex flex-col gap-3">
    <ol className="flex flex-col gap-1.5">
      {run.steps.map((step, index) => <Step key={index} step={step} />)}
      {card?.jev.checked && <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 rounded-xl bg-foreground/[0.04] px-3 py-2.5">
        <span className="grid size-7 place-items-center rounded-full bg-card shadow-xs"><JevLogo className="h-4 px-0.5 text-[0.6rem]" /><span className="sr-only">Jev</span></span>
        <div className="flex min-w-0 flex-col gap-2 pt-1 text-[13px]">
          <span className="flex flex-wrap items-center gap-2"><span className="font-medium">Jev checked the proposal</span><JevChip card={card} /></span>
          <div className="rounded-lg bg-card px-3 shadow-xs"><JevAnswers card={card} /></div>
        </div>
      </li>}
    </ol>
    {run.quietReason && <p className="rounded-xl bg-foreground/[0.04] px-3 py-2.5 text-[13px] text-muted-foreground"><span className="font-medium text-foreground">Why no person was needed:</span> {run.quietReason}</p>}
    {run.error && <p className="flex items-start gap-2 rounded-xl bg-danger/10 px-3 py-2.5 text-[13px] text-danger"><TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{run.error}</p>}
  </div>
}

/** The agent section on an order record. */
export function AgentSection({ orderId }: { orderId: string }) {
  const state = useAgentState(orderId)
  if (!state) return null
  const card = state.cards.find((item) => item.status === "new" || item.status === "changed") ?? state.cards[0]
  const run = state.runs[0]
  return <section className="flex flex-col gap-3" id="agent">
    <SectionHead title="Control room agent" count={state.runs.length || null} note={<Link href="/traces">All agent traces</Link>} />
    {!state.available && <Empty>No control room state found. Start the control room. The agent fills this section when the clock passes an event.</Empty>}
    {state.available && !run && <Empty>The control room agent did not run on this order.</Empty>}
    {card && <Card size="sm" className="border ring-0">
      <CardHeader className="flex flex-wrap items-center gap-2">
        <BotIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        <Chip tone="accent" dot>{card.status === "new" ? "Waiting for a person" : card.status === "changed" ? "Changed since approval" : card.status}</Chip>
        <JevChip card={card} />
        <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">{fmtDateTime(card.createdAt)}</span>
        {(card.status === "new" || card.status === "changed") && <Link href={`/decisions/${card.id}`} className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90">Open the decision</Link>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-[13px] font-medium">{card.summary}</p>
          <p className="max-w-[70ch] text-[13px] text-muted-foreground">{card.proposal}</p>
        </div>
        <JevPanel card={card} />
      </CardContent>
    </Card>}
    {run && <Collapsible className="group/trace rounded-xl border bg-card">
      <CollapsibleTrigger className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-muted/40">
        <ChevronRightIcon className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]/trace:rotate-90" aria-hidden="true" />
        <span className="font-medium">Agent trace</span>
        <RunStatusBadge status={run.status} />
        <span className="font-mono text-xs text-muted-foreground">{run.steps.length} steps</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-3 py-3">
        <RunTrace run={run} card={state.cards.find((item) => item.id === run.cardId)} />
      </CollapsibleContent>
    </Collapsible>}
    <DriverChat orderId={orderId} />
  </section>
}
