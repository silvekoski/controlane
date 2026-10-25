"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { use } from "react"
import { BanIcon, InfoIcon, RepeatIcon, TriangleAlertIcon } from "@/components/icons"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { AppFrame } from "../../components/app-frame"
import { ControlError, DecidedChip, EscalationChip, LeftChip, useControl, type CardView, type ModelAnswer } from "../../components/control"
import { Decide } from "../../components/decide"
import { StopFacts, StopRanking, StopSteps } from "../../components/stop-check"
import { Chip, SectionHead, TONE_BADGE } from "../../components/ui"

const StopMap = dynamic(() => import("../../components/track-map").then((m) => m.StopMap), { ssr: false, loading: () => <Skeleton className="size-full rounded-none" /> })

/* One decision card: what happened, each fact with its source and age, what the agent did,
   its proposal with the warnings, and every model answer side by side. */

export default function DecisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, error, offline } = useControl<CardView>(`view=card&id=${encodeURIComponent(id)}`)
  const row = data?.row
  const open = row?.status === "new" || row?.status === "changed"

  return <AppFrame section="decisions" crumbs={[{ label: row?.orderRef ?? "Decision" }]}>
    <div className="flex max-w-6xl flex-col gap-5">
      {error && <ControlError error={error} offline={offline} />}
      {!data && !error && <div className="flex flex-col gap-3" aria-busy="true"><Skeleton className="h-5 w-48" /><Skeleton className="h-8 w-2/3" /><Skeleton className="h-24 rounded-xl" /><div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-72 rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div></div>}
      {data && row && <>
        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {open ? <LeftChip left={row.left} /> : <DecidedChip card={row} />}
            <span className="text-xs text-muted-foreground">{row.deadlineLabel}</span>
            <Chip tone="neutral">{row.kind.label}</Chip>
            <EscalationChip escalation={row.escalation} />
            <Link href={`/orders/${row.orderId}#agent`} className="ml-auto text-xs underline underline-offset-4">Open order {row.orderRef}</Link>
          </div>
          <h1 className="max-w-[60ch] text-2xl leading-snug font-semibold tracking-tight">{row.summary}</h1>
          <p className="text-[13px] text-muted-foreground">The agent made this card {row.age}{data.run?.mode === "scripted" ? " (scripted replay)" : data.run?.model ? ` with ${data.run.model}` : ""}.</p>
        </header>

        {row.status === "changed" && <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-warning" role="alert">
          <RepeatIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span><span className="font-medium">Changed since approval.</span> A new fact came in after this card was made, so the action did not run.{data.changeMsg && <> The driver wrote {data.changeMsg.age}: “{data.changeMsg.text}”</>} Read the facts again, then decide.</span>
        </p>}

        <dl className="grid grid-cols-2 gap-2 rounded-2xl border bg-card p-3 text-[13px] md:grid-cols-3">
          {([["Customer", data.context.customer], ["Driver", data.context.driver], ["Car", data.context.car], ["Current position", data.context.position], ["Arrival", `${data.context.eta} · late: ${data.context.late}`], ["Chained gig", data.context.chained]] as const).map(([label, value]) =>
            <div key={label} className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-muted/50 px-3 py-2.5"><dt className="text-xs text-muted-foreground">{label}</dt><dd className={cn(label === "Chained gig" && /risk/i.test(value) && "text-warning")}>{value}</dd></div>)}
        </dl>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-5">
            <section className="rounded-2xl border bg-card p-5">
              <SectionHead title="What we know" note="Each fact with its source and age" />
              <ul className="flex flex-col gap-1.5">
                {data.facts.map((fact) => <li key={fact.label} className="flex flex-col gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
                  <div className="grid gap-x-3 gap-y-0.5 text-[13px] sm:grid-cols-[9rem_minmax(0,1fr)_auto]">
                    <span className="text-muted-foreground">{fact.label}</span>
                    <span className="flex items-start gap-2">
                      {fact.imageFile && <a href={`/api/control/files/${fact.imageFile}`} target="_blank" rel="noreferrer" title="Open the full image" className="shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/control/files/${fact.imageFile}`} alt={fact.label} className="size-14 rounded-md border object-cover" />
                      </a>}
                      {fact.value}
                    </span>
                    <span className="text-xs whitespace-nowrap text-muted-foreground"><span className="font-medium text-foreground">{fact.source}</span> · {fact.age}</span>
                  </div>
                  {fact.warnings.map((warning, index) => <p key={index} className={cn("flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs", warning.flagged ? TONE_BADGE.warn : "text-muted-foreground")}>
                    {warning.flagged ? <TriangleAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden="true" /> : <InfoIcon className="mt-px size-3.5 shrink-0" aria-hidden="true" />}
                    <span>{warning.message} <span className="opacity-75">· {warning.flagged ? "flagged" : "checked"} by {warning.model}</span></span>
                  </p>)}
                </li>)}
              </ul>
            </section>
            {data.stop && <section className="overflow-hidden rounded-2xl border bg-card">
              <div className="h-56 border-b"><StopMap stop={data.stop} car={data.context.car} /></div>
              <div className="flex flex-col gap-4 p-5">
                <SectionHead title="The stop check" note={<Link href={`/live?order=${row.orderId}`}>Open on the live map</Link>} />
                <StopFacts stop={data.stop} />
                <StopRanking stop={data.stop} />
                {data.stop.steps && data.stop.steps.length > 0 && <StopSteps steps={data.stop.steps} />}
              </div>
            </section>}
            <section className="rounded-2xl border bg-card p-5">
              <SectionHead title="What the agent already did" note={<Link href={`/orders/${row.orderId}#agent`}>Every step and the driver chat</Link>} />
              <ul className="flex flex-col gap-1.5 rounded-xl bg-muted/50 p-3 text-[13px]">
                {data.agentActions.map((action) => <li key={action} className="flex items-start gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />{action}</li>)}
              </ul>
            </section>
          </div>

          <div className="flex flex-col gap-5">
            <section className="overflow-hidden rounded-2xl border border-primary/40 bg-card">
              <div className="flex flex-col gap-3 p-5">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">The agent suggests</p>
                <p className="text-[15px] leading-relaxed">{data.proposal.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.proposal.costDelta ? <Chip tone="neutral">Cost +€{data.proposal.costDelta}</Chip> : null}
                  <Chip tone="neutral">{row.escalation.level === "agent" ? "Run by the agent" : "A person approves"}</Chip>
                  {data.proposal.travelOptionId && <Chip tone="ok" className="font-mono">{data.proposal.travelOptionId}</Chip>}
                </div>
                {data.general.map((warning, index) => <p key={index} className={cn("flex items-start gap-2 rounded-md border px-2.5 py-2 text-sm", warning.blocking ? TONE_BADGE.danger : TONE_BADGE.warn)}>
                  {warning.blocking ? <BanIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
                  <span>{warning.message} <span className="text-xs opacity-75">· flagged by {warning.model}</span></span>
                </p>)}
                {data.proposal.customerDraft && <div className="rounded-md border border-dashed p-3 text-sm">
                  <p className="mb-1 text-xs text-muted-foreground">Message to the customer: drafted by the agent. You send it after approval.</p>
                  <p className="whitespace-pre-line">{data.proposal.customerDraft}</p>
                </div>}
              </div>
              {open ? <Decide key={row.status} view={data} /> : <div className="flex flex-col gap-1.5 border-t bg-muted/40 p-4 text-sm">
                <p><span className="font-medium">{row.status === "rejected" ? "Rejected" : row.escalation.level === "agent" ? "Run by the agent" : row.status === "edited" ? "Edited and approved" : "Approved"}</span> by {row.decidedBy}{row.decidedAt ? ` at ${row.decidedAt}` : ""}.
                  {data.rejectReason && <> Reason: {data.rejectReason}{data.rejectNote ? `: “${data.rejectNote}”` : ""}.</>}</p>
                <p><span className="font-medium">What happens next:</span> {row.outcome}</p>
                {row.status === "rejected" && <p className="text-xs text-muted-foreground">The case went to the <Link href="/label" className="underline underline-offset-4">labeling queue</Link> as an eval case.</p>}
              </div>}
            </section>

            <ModelAnswers view={data} />
          </div>
        </div>
      </>}
    </div>
  </AppFrame>
}

const MARK: Record<ModelAnswer["mark"], { sign: string; className: string }> = {
  trap: { sign: "!", className: TONE_BADGE.warn },
  unsure: { sign: "?", className: "border-dashed text-muted-foreground" },
  ok: { sign: "✓", className: "text-muted-foreground" },
}

/** Each typed question with the answer of every connected model: Jev, Laya, the judge. */
function ModelAnswers({ view }: { view: CardView }) {
  const count = (mark: ModelAnswer["mark"]) => view.answers.reduce((total, question) => total + question.byModel.filter((answer) => answer.mark === mark).length, 0)
  const traps = count("trap")
  const unsure = count("unsure")
  return <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
    <div className="flex flex-col gap-0.5">
      <h2 className="text-sm font-medium">How the decision models checked it</h2>
      <p className="text-xs text-muted-foreground">Each model reads the facts and the proposal. Then it answers one typed question for each known trap. At 70% or more, a trap answer becomes a warning.</p>
    </div>
    {view.answers.length === 0 ? <p className="text-sm text-muted-foreground">No decision model checked this card.</p> : <>
      <p className={cn("rounded-md border px-2.5 py-1.5 text-sm", traps ? TONE_BADGE.warn : unsure ? "border-dashed" : "text-muted-foreground")}>{traps ? `${traps === 1 ? "1 trap answer" : `${traps} trap answers`}. Read the warnings before you approve.` : unsure ? `No model is sure of a trap, but ${unsure === 1 ? "1 answer is" : `${unsure} answers are`} unsure (marked ?). Read ${unsure === 1 ? "it" : "them"}.` : "No model found a trap."}</p>
      <ul className="flex flex-col">
        {view.answers.map((question) => <li key={question.questionId} className="flex flex-col gap-1.5 border-b py-2.5 last:border-b-0">
          <span className="text-[13px]">{question.question}</span>
          <ul className="flex flex-col gap-1">
            {question.byModel.map((answer, index) => <li key={`${answer.model}-${index}`} className="flex flex-wrap items-center gap-2 text-xs">
              <span className={cn("grid size-5 place-items-center rounded-sm border font-mono font-semibold", MARK[answer.mark].className)} aria-label={answer.mark}>{MARK[answer.mark].sign}</span>
              <span className="w-32 shrink-0 font-medium">{answer.label}</span>
              <span>says <span className="font-mono font-medium">{answer.answer}</span></span>
              <span className="text-muted-foreground tabular-nums">{Math.round(answer.confidence * 100)}% sure · {Math.round(answer.ms)} ms</span>
              {answer.mark === "trap" && <span className="basis-full pl-7 text-warning">{answer.message}</span>}
            </li>)}
          </ul>
        </li>)}
      </ul>
    </>}
    <div className="flex flex-wrap gap-1.5 border-t pt-3 text-xs">
      <Chip tone="neutral">Rules</Chip>
      {view.checkers.map((name) => <Chip key={name} tone="neutral">{name}</Chip>)}
      {view.missingCheckers.map((missing) => <Chip key={missing.model} tone="ok" className="border-dashed" ><span title={missing.why}>{missing.label}: not connected</span></Chip>)}
    </div>
  </section>
}
