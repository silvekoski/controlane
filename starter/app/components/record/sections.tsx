"use client"

import Link from "next/link"
import { useState, type ReactNode } from "react"
import { CarIcon, CheckIcon, ChevronRightIcon, TriangleAlertIcon } from "@/components/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import type { AttentionItem, JourneyGroup, JourneyLeg, JourneyStep, ProposalView, RecordView, ThreadView } from "@/lib/present/types"
import { fmtClock, fmtDateTime, fmtDay, relativeTo } from "@/lib/present/time"
import { cn } from "@/lib/utils"
import { ActorName, Chip, Empty, OrderLink, OrderLinks, Range, SectionHead, TONE_TEXT, When } from "../ui"
import { KindIcon, Row, Rows, RowSub, RowText, RowTitle, SubHead } from "./bits"
import { OrderFiles } from "./files"

const ATTENTION_ICON: Record<AttentionItem["kind"], string> = {
  alert: "alert", owned_alert: "alert", work: "work", incident: "incident", waiting: "waiting", conversation: "message",
  proposal: "proposal", claim: "alert", custody: "key", check: "note", inbox: "inbox",
}

const nameLink = "underline decoration-border underline-offset-4 hover:decoration-foreground"

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function Section({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return <section id={id} className={cn("flex scroll-mt-16 flex-col", className)}>{children}</section>
}

function stepIcon(step: JourneyStep): string {
  if (step.recorded) return "check"
  return step.role === "PICKUP" ? "pin" : step.role === "DELIVERY" ? "flag" : "yard"
}

/* ── Needs a person ─────────────────────────────────────────────────────── */

export function AttentionPanel({ view }: { view: RecordView }) {
  const items = view.attention
  if (items.length === 0) return <div id="attention" className="flex scroll-mt-16 items-start gap-2.5 rounded-xl border bg-card p-4 text-[13px]">
    <CheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    <p className="flex flex-col gap-0.5">
      <span>Nothing in the records is waiting on a person.</span>
      <small className="text-xs text-muted-foreground">Checked: alerts, incidents, work items, conversations, agent proposals, claims, custody and a moving car&apos;s position. Not checked: proofs, documents and endpoint details beyond a booked car&apos;s pickup contact and access.</small>
    </p>
  </div>
  return <section id="attention" className="scroll-mt-16 overflow-hidden rounded-xl border border-warning/35 bg-card" aria-labelledby="attention-title">
    <header className="flex items-center gap-2 border-b bg-warning/5 px-4 py-2.5">
      <TriangleAlertIcon className="size-4 text-warning" aria-hidden="true" />
      <h2 id="attention-title" className="text-[13px] font-medium">Needs a person</h2><Badge variant="outline" className="border-warning/40 font-mono text-warning">{items.length}</Badge>
    </header>
    <ol className="flex flex-col divide-y">{items.map((item) => <li className="flex min-w-0 flex-col gap-1 px-4 py-2.5 sm:flex-row sm:gap-4" key={`${item.kind}-${item.recordId}`}>
      <div className="flex min-w-0 flex-1 gap-2.5">
        <KindIcon name={ATTENTION_ICON[item.kind]} className={cn("mt-0.5 size-4", TONE_TEXT[item.tone])} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className={cn("text-[13px] font-medium", TONE_TEXT[item.tone])}>{item.title}</div>
          {item.detail && <div className="text-[13px] text-muted-foreground">{item.detail}</div>}
        </div>
      </div>
      <div className="shrink-0 pl-6.5 text-xs text-muted-foreground sm:pl-0 sm:text-right">
        <div>{item.owner ?? "No owner"}</div>
        {item.at && item.atLabel ? <div>{capitalise(item.atLabel)} <When at={item.at} snapshotAt={view.snapshotAt} relative withZone={false} /></div> : null}
      </div>
    </li>)}</ol>
  </section>
}

/* ── Route strip ────────────────────────────────────────────────────────── */

export function RouteStrip({ view }: { view: RecordView }) {
  const groups = view.journey.groups
  if (!groups.length) return null
  return <Section id="journey">
    <SectionHead title="Route" note={view.journey.plan && !view.journey.plan.active ? "Draft plan, not activated" : undefined} />
    <div className="flex flex-col gap-4">{groups.map((group) => <RouteGroup key={group.itemId} group={group} view={view} labelled={groups.length > 1} />)}</div>
  </Section>
}

function RouteGroup({ group, view, labelled }: { group: JourneyGroup; view: RecordView; labelled: boolean }) {
  const legsFrom = new Map(group.legs.map((leg) => [leg.fromStepId, leg]))
  return <div className="flex flex-col gap-2">
    {labelled && <p className="text-xs text-muted-foreground">{group.roleLabel}: {group.vehicle}</p>}
    <div className="flex flex-col lg:flex-row lg:items-stretch">
      {group.steps.map((step) => {
        const leg = legsFrom.get(step.id)
        return <RouteStop key={step.id} step={step} leg={leg ?? null} view={view} />
      })}
    </div>
  </div>
}

function RouteStop({ step, leg, view }: { step: JourneyStep; leg: JourneyLeg | null; view: RecordView }) {
  const slot = step.windows.find((window) => window.selected && (window.purpose === "SELECTED_PICKUP_SLOT" || window.purpose === "CUSTOMER_DELIVERY_PROMISE" || window.purpose === "SELECTED_DELIVERY_SLOT"))
    ?? step.windows.find((window) => window.purpose.startsWith("REQUESTED_")) ?? null
  const name = step.site ? <Link className={nameLink} href={`/sites/${step.site.id}`}>{step.place.name}</Link> : step.place.name
  const openClaim = step.claims.some((claim) => claim.status === "OPEN")
  const states = (!step.recorded && (step.contact || step.access)) || openClaim
  return <>
    <div className={cn("flex min-w-0 flex-1 flex-col gap-1 rounded-xl border bg-card p-3.5", step.recorded && "bg-muted/30")}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><KindIcon name={stepIcon(step)} className="size-3.5" />{step.roleLabel}</div>
      <div className="text-[13px] font-medium">{name}</div>
      <div className="text-xs text-muted-foreground">{step.place.city}{step.place.country ? `, ${step.place.country}` : ""}{step.site ? "" : " · no site profile"}</div>
      {step.recorded
        ? <div className="mt-1 text-xs text-muted-foreground"><span className="text-foreground">{step.recorded.label}</span> <When at={step.recorded.at} /></div>
        : slot ? <div className="mt-1 text-xs"><span className="text-muted-foreground">{slot.label}</span> <Range start={slot.start} end={slot.end} zone={slot.zone} /></div>
        : <div className="mt-1 text-xs text-muted-foreground">No slot selected</div>}
      {states && <div className="mt-1 flex flex-wrap gap-1">
        {step.contact && !step.recorded && <Chip tone={step.contact.tone}>Contact {step.contact.statusLabel.toLowerCase()}</Chip>}
        {step.access && !step.recorded && <Chip tone={step.access.tone}>Access {step.access.statusLabel.toLowerCase()}</Chip>}
        {openClaim && <Chip tone="warn">Open claim</Chip>}
      </div>}
    </div>
    {leg && <RouteLeg leg={leg} view={view} />}
  </>
}

function RouteLeg({ leg, view }: { leg: JourneyLeg; view: RecordView }) {
  const assignment = leg.assignment
  const age = leg.tracking?.receivedAt ? relativeTo(leg.tracking.receivedAt, view.snapshotAt) : null
  return <div className="ml-4 flex min-w-0 flex-col gap-1 border-l border-dashed py-2.5 pl-4 text-xs text-muted-foreground lg:ml-0 lg:w-40 lg:shrink-0 lg:items-center lg:justify-center lg:border-l-0 lg:px-2 lg:py-0 lg:text-center">
    <div className="flex items-center gap-1.5 lg:w-full">
      <span className="hidden h-px flex-1 bg-border lg:block" aria-hidden="true" />
      <CarIcon className={cn("size-4 shrink-0", TONE_TEXT[leg.tone])} aria-hidden="true" />
      <span className="hidden h-px flex-1 bg-border lg:block" aria-hidden="true" />
      {leg.distanceKm != null && <b className="font-mono font-medium text-foreground tabular-nums lg:hidden">{leg.distanceKm} km</b>}
      <Chip tone={leg.tone} className="lg:hidden">{leg.statusLabel}</Chip>
    </div>
    {leg.distanceKm != null && <b className="hidden font-mono font-medium text-foreground tabular-nums lg:block">{leg.distanceKm} km</b>}
    <Chip tone={leg.tone} className="hidden lg:inline-flex">{leg.statusLabel}</Chip>
    {assignment ? <span><ActorName actor={assignment.driver} /> · {assignment.statusLabel.toLowerCase()}</span> : <span>No driver yet</span>}
    {leg.tracking?.eta && <span className={TONE_TEXT[leg.tone]}>ETA {fmtDateTime(leg.tracking.eta, view.header.keyDates.find((date) => date.key === "promise")?.zone ?? null)}{age ? `, ${age.text}` : ""}</span>}
  </div>
}

/* ── Conversations ──────────────────────────────────────────────────────── */

export function ConversationsSection({ view }: { view: RecordView }) {
  const { threads, notes } = view
  return <Section id="conversations">
    <SectionHead title="Conversations" count={threads.length} />
    {threads.length === 0 && notes.length === 0 && <Empty>No conversation is linked to this order.</Empty>}
    {threads.length + notes.length > 0 && <Rows>
      {threads.map((thread) => <ThreadRow key={thread.id} thread={thread} />)}
      {notes.map((note) => <Row key={note.id} side={<When at={note.at} withZone={false} />}>
        <RowTitle>Note from <ActorName actor={note.author} /></RowTitle>
        <RowText>{note.body}</RowText>
      </Row>)}
    </Rows>}
  </Section>
}

function ThreadRow({ thread }: { thread: ThreadView }) {
  const [open, setOpen] = useState(false)
  const last = thread.messages[thread.messages.length - 1]
  const count = thread.messages.length
  return <Collapsible open={open} onOpenChange={setOpen} asChild><article>
    <Row side={<When at={thread.updatedAt} withZone={false} />}>
      <RowTitle><KindIcon name="message" className="text-muted-foreground" />{thread.categoryLabel} <Chip tone={thread.tone}>{thread.statusLabel}</Chip></RowTitle>
      <RowSub>
        {thread.channelLabel}{thread.counterparty ? <> with <ActorName actor={thread.counterparty} /></> : ""} · {count} {count === 1 ? "message" : "messages"}
        {thread.waitingOn && ` · waiting on ${thread.waitingOn}`}{thread.owner && ` · ${thread.owner}`}
        {thread.relatedOrders.length > 0 && <> · also <OrderLinks orders={thread.relatedOrders} /></>}
      </RowSub>
      {last && !open && <RowText className="line-clamp-2"><b>{last.author.name}:</b> {last.body}</RowText>}
      <CollapsibleContent className="pt-1"><ThreadMessages thread={thread} /></CollapsibleContent>
      {count > 0 && <div><Button type="button" variant="ghost" size="xs" className="-ml-2 text-muted-foreground" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <ChevronRightIcon className={cn("transition-transform", open && "rotate-90")} aria-hidden="true" />
        {open ? "Hide messages" : `Read ${count === 1 ? "the message" : `all ${count} messages`}`}
      </Button></div>}
    </Row>
  </article></Collapsible>
}

function Tag({ children, internal = false }: { children: ReactNode; internal?: boolean }) {
  return <Badge variant="outline" className={cn("h-4.5 px-1.5 text-[0.7rem] font-normal", internal ? "border-dashed border-warning/50 text-warning" : "text-muted-foreground")}>{children}</Badge>
}

export function ThreadMessages({ thread }: { thread: ThreadView }) {
  return <div className="flex flex-col gap-2">{thread.messages.map((message) => {
    const fromUs = message.author.kind === "operator" || message.author.kind === "agent"
    return <div className={cn("flex flex-col gap-1 rounded-md border px-3 py-2", message.internal ? "border-dashed" : fromUs ? "bg-muted/40" : "bg-card")} key={message.id}>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
        <b className="font-medium text-foreground"><ActorName actor={message.author} /></b>
        <span>{message.author.role}</span>
        <span>to {message.recipient.name}</span>
        <span>· {message.channelLabel}</span>
        {message.internal && <Tag internal>Internal</Tag>}
        {message.author.kind === "agent" && <Tag>Agent</Tag>}
        {message.otherOrder && <Tag>Filed on <OrderLink order={message.otherOrder} /></Tag>}
        <time className="ml-auto font-mono tabular-nums" dateTime={message.at}>{fmtDateTime(message.at)}</time>
      </div>
      <p className="text-[13px] whitespace-pre-line">{message.body}</p>
    </div>
  })}</div>
}

/* ── Evidence ───────────────────────────────────────────────────────────── */

export function EvidenceSection({ view }: { view: RecordView }) {
  const { proofs, documents, custody } = view
  const total = proofs.length + documents.length + custody.assets.length
  return <Section id="evidence">
    <SectionHead title="Evidence" count={total} />
    <div className="flex flex-col gap-3">
    {total === 0 && <Empty>No proof or document record yet.</Empty>}
    {total > 0 && <div className="flex flex-wrap gap-1.5">
      {proofs.map((proof) => <Chip key={proof.id} tone={proof.tone} dot>{proof.kindLabel} · {proof.statusLabel.toLowerCase()}{proof.fileCount ? ` · ${proof.fileCount} files` : ""}</Chip>)}
      {documents.map((document) => <Chip key={document.id} tone={document.tone} dot>{document.kindLabel}{document.medium ? ` (${document.medium})` : ""} · {document.statusLabel.toLowerCase()}</Chip>)}
      {custody.assets.map((asset) => <Chip key={asset.id} tone={asset.nextAction ? "warn" : "neutral"} dot>{asset.kindLabel} · holder {asset.holder}</Chip>)}
    </div>}
    <OrderFiles orderId={view.header.id} />
    </div>
  </Section>
}

/* ── Earlier agent work ─────────────────────────────────────────────────── */

export function DecisionsSection({ view }: { view: RecordView }) {
  const { proposals } = view
  return <Section id="decisions">
    <SectionHead title="Earlier agent work" count={proposals.length} />
    {proposals.length === 0 && <Empty>No agent has proposed anything on this order yet. Your agent&apos;s proposals and the human decision on them belong here.</Empty>}
    {proposals.length > 0 && <Rows>{proposals.map((proposal) => <ProposalRow key={proposal.id} proposal={proposal} />)}</Rows>}
  </Section>
}

function ProposalRow({ proposal }: { proposal: ProposalView }) {
  return <Row side={<When at={proposal.createdAt} withZone={false} />}>
    <RowTitle><KindIcon name="proposal" className="text-muted-foreground" />{proposal.summary} <Chip tone={proposal.tone} dot>{proposal.statusLabel}</Chip></RowTitle>
    <RowSub>
      {proposal.agent.name} · {proposal.commandLabel.toLowerCase()}
      {proposal.review && <> · {proposal.review.decisionLabel.toLowerCase()} by {proposal.review.reviewer.name}</>}
      {proposal.execution && <> · execution {proposal.execution.statusLabel.toLowerCase()}{proposal.execution.effects ? `, ${proposal.execution.effects} event${proposal.execution.effects === 1 ? "" : "s"} committed` : ", nothing committed"}</>}
    </RowSub>
  </Row>
}

function Pairs({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-md bg-muted/40 px-3 py-2 text-[13px] [&_dt]:text-xs [&_dt]:leading-5 [&_dt]:text-muted-foreground">{children}</dl>
}

export function ProposalCards({ view }: { view: RecordView }) {
  const { proposals, notifications } = view
  return <div className="flex flex-col gap-3">
    {proposals.length === 0 && notifications.length === 0 && <Empty>Nothing recorded.</Empty>}
    {proposals.map((proposal) => <article className="flex flex-col gap-2 rounded-xl border bg-card p-3.5" key={proposal.id}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Chip tone={proposal.tone} dot>{proposal.statusLabel}</Chip><span>{proposal.agent.name} · {proposal.commandLabel.toLowerCase()} · <When at={proposal.createdAt} /></span></div>
      <p className="text-[13px] font-medium">{proposal.summary}</p>
      {proposal.rationale && <p className="text-[13px] text-muted-foreground">{proposal.rationale}</p>}
      {proposal.review && <Pairs>
        <dt>Recorded review</dt><dd>{proposal.review.decisionLabel} by {proposal.review.reviewer.name}, {fmtDateTime(proposal.review.at)}</dd>
        {proposal.review.note && <><dt>Note</dt><dd>{proposal.review.note}</dd></>}
      </Pairs>}
      {proposal.execution && <Pairs>
        <dt>Execution</dt><dd>{proposal.execution.statusLabel}{proposal.execution.at ? `, attempted ${fmtDateTime(proposal.execution.at)}` : ""} · {proposal.execution.effects ? `${proposal.execution.effects} committed event${proposal.execution.effects === 1 ? "" : "s"} linked` : "no committed event linked"}</dd>
        {proposal.execution.error && <><dt>Error</dt><dd className="text-danger">{proposal.execution.error}</dd></>}
      </Pairs>}
      <p className="text-xs text-muted-foreground">{proposal.evidenceCount} evidence link{proposal.evidenceCount === 1 ? "" : "s"}{proposal.dependency ? ` · ${proposal.dependency}` : ""}{proposal.superseded ? ` · ${proposal.superseded}` : ""}. Proposal text is never proof that anything changed.</p>
    </article>)}
    {notifications.length > 0 && <div>
      <SubHead>Internal room activity</SubHead>
      <Rows>{notifications.map((note) => <Row key={note.id} side={<><When at={note.at} withZone={false} /> · {note.deliveryLabel}</>}>
        <RowTitle>{note.activityLabel} <span className="text-xs font-normal text-muted-foreground">in {note.destination} by {note.actor.name}</span></RowTitle>
        <RowText>{note.preview}</RowText>
      </Row>)}</Rows>
    </div>}
  </div>
}

/* ── Activity ───────────────────────────────────────────────────────────── */

function EventLine({ event, time, detail }: { event: RecordView["history"][number]["events"][number]; time: ReactNode; detail: boolean }) {
  return <li className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 px-3 py-2 text-[13px] sm:grid-cols-[8rem_minmax(0,1fr)]">
    <time className="pt-px font-mono text-xs text-muted-foreground tabular-nums" dateTime={event.at} title={fmtDateTime(event.at)}>{time}</time>
    <div className="min-w-0">
      <span>{event.text}</span>
      {event.actor && <span className="text-muted-foreground"> · {event.actor}</span>}
      {event.shared && <span className="text-muted-foreground"> · shared bundle</span>}
      {detail && event.detail && <small className="block text-xs text-muted-foreground">{event.detail}</small>}
    </div>
  </li>
}

export function ActivitySection({ view }: { view: RecordView }) {
  const [all, setAll] = useState(false)
  const events = view.history.flatMap((day) => day.events)
  const shown = all ? events : events.slice(0, 6)
  return <Section id="history">
    <SectionHead title="Activity" count={view.historyTotal} />
    {events.length === 0 && <Empty>No events recorded.</Empty>}
    {events.length > 0 && <ol className="flex flex-col divide-y rounded-xl border bg-card">{shown.map((event) => <EventLine key={event.id} event={event} time={<>{fmtDay(event.at)} {fmtClock(event.at)}</>} detail={all} />)}</ol>}
    {events.length > 6 && <div className="mt-1"><Button type="button" variant="ghost" size="xs" className="-ml-2 text-muted-foreground" onClick={() => setAll((value) => !value)}>{all ? "Show the latest only" : `Show all ${events.length} events`}</Button></div>}
  </Section>
}

/* ── Detailed route, for the records panel ──────────────────────────────── */

export function RouteDetails({ view }: { view: RecordView }) {
  const { journey } = view
  return <div className="flex flex-col gap-4">
    {journey.plan && <p className="text-xs text-muted-foreground">{journey.plan.statusLabel} plan{journey.plan.version ? ` v${journey.plan.version}` : ""}{journey.plan.active ? "" : ", not activated"}{journey.plan.activatedAt ? `, activated ${fmtDateTime(journey.plan.activatedAt)}` : ""}{journey.otherPlans.length ? ` · ${journey.otherPlans.length} other ${journey.otherPlans.length === 1 ? "plan" : "plans"} kept in the API` : ""}</p>}
    {journey.groups.map((group) => {
      const legsFrom = new Map(group.legs.map((leg) => [leg.fromStepId, leg]))
      return <div key={group.itemId}>
        {journey.groups.length > 1 && <SubHead>{group.roleLabel}: {group.vehicle}</SubHead>}
        <ol className="flex flex-col">{group.steps.map((step, index) => {
          const leg = legsFrom.get(step.id)
          return <li key={step.id}>
            <StepView step={step} live={leg?.status === "IN_PROGRESS"} last={index === group.steps.length - 1 && !leg} />
            {leg && <LegView leg={leg} view={view} />}
          </li>
        })}</ol>
      </div>
    })}
  </div>
}

function Marker({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("absolute top-0 left-0 grid size-6 place-items-center rounded-full border bg-background text-muted-foreground", className)}>{children}</span>
}

function StepFact({ label, children, hint, tone }: { label: string; children: ReactNode; hint?: ReactNode; tone?: string }) {
  return <div className="flex min-w-0 flex-col gap-0.5">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className={cn("text-[13px]", tone)}>{children}{hint && <small className="block text-xs text-muted-foreground">{hint}</small>}</dd>
  </div>
}

function StepView({ step, live, last }: { step: JourneyStep; live: boolean; last: boolean }) {
  return <div className={cn("relative flex flex-col gap-2 pb-4 pl-9", !last && "before:absolute before:top-7 before:bottom-1 before:left-3 before:w-px before:bg-border")}>
    <Marker className={cn(step.recorded && "border-foreground/30 bg-muted text-foreground", live && "border-primary text-primary")}><KindIcon name={stepIcon(step)} className="size-3.5" /></Marker>
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="text-xs text-muted-foreground">{step.roleLabel}</span>
      <span className="text-[13px] font-medium">{step.site ? <Link className={nameLink} href={`/sites/${step.site.id}`}>{step.place.name}</Link> : step.place.name}</span>
      <span className="text-xs text-muted-foreground">{step.place.kindLabel}{step.site ? "" : " · no managed site profile"}</span>
    </div>
    <p className="-mt-1 text-xs text-muted-foreground">{step.place.addressLine ?? <span className="text-warning">Street not supplied</span>}{step.place.city ? `, ${step.place.city}` : ""}{step.place.country ? `, ${step.place.country}` : ""}</p>
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {step.windows.map((window) => <StepFact key={window.purpose + window.start} label={window.label} hint={<>{window.sourceLabel}{window.deadline ? ` · outer limit ${fmtDateTime(window.deadline, window.zone)}` : ""}</>}>
        <Range start={window.start} end={window.end} zone={window.zone} />
      </StepFact>)}
      {step.recorded && <StepFact label={step.recorded.label} hint={step.recorded.actor ? `reported by ${step.recorded.actor}` : "recorded event"}><When at={step.recorded.at} /></StepFact>}
      {step.contact && <StepFact label="Contact" tone={TONE_TEXT[step.contact.tone]} hint={<>{step.contact.handle ?? "no handle recorded"}{step.contact.confirmedAt ? ` · confirmed ${fmtDateTime(step.contact.confirmedAt)}${step.contact.sourceLabel ? ` via ${step.contact.sourceLabel}` : ""}` : " · no confirmation recorded for this order"}</>}>
        {step.contact.name ?? "Not supplied"}{step.contact.role ? ` (${step.contact.role})` : ""} · {step.contact.statusLabel.toLowerCase()}
      </StepFact>}
      {step.access && <StepFact label="Access" tone={TONE_TEXT[step.access.tone]} hint={<>{step.access.statedByLabel ? `stated by ${step.access.statedByLabel}` : ""}{step.access.confirmedAt ? ` · confirmed ${fmtDateTime(step.access.confirmedAt)}${step.access.sourceLabel ? ` via ${step.access.sourceLabel}` : ""}` : ""}</>}>
        {step.access.statusLabel}
      </StepFact>}
      {step.site?.hours && <StepFact label="Site hours" hint={<>local time{step.site.advanceNoticeMinutes ? ` · ${step.site.advanceNoticeMinutes} min advance notice` : ""}</>}>{step.site.hours}</StepFact>}
      {step.site?.handoverMode && <StepFact label="Handover" hint={step.site.contactEmail ?? undefined}>{step.site.handoverMode}</StepFact>}
    </dl>
    {step.access?.instruction && <RowText className="rounded-md bg-muted/40 px-3 py-2"><b>{step.site?.accessNote === step.access.instruction ? "Order instruction, copied from the site profile." : "Order instruction."}</b> {step.access.instruction}</RowText>}
    {step.site?.accessNote && step.site.accessNote !== step.access?.instruction && <RowText className="rounded-md bg-muted/40 px-3 py-2"><b>Site procedure.</b> {step.site.accessNote}</RowText>}
    {step.site?.releaseRule && <RowText className="rounded-md bg-muted/40 px-3 py-2"><b>Release rule.</b> {step.site.releaseRule}</RowText>}
    {step.claims.length > 0 && <div className="flex flex-col gap-1">{step.claims.map((claim) => <RowText key={claim.id}><Chip tone={claim.tone}>{claim.statusLabel}</Chip> Claim about the {claim.field.toLowerCase()}: {claim.claim}{claim.source ? ` (${claim.source}${claim.confidence ? `, ${claim.confidence}` : ""})` : ""}</RowText>)}</div>}
    {step.notes.length > 0 && <div className="flex flex-col gap-1">{step.notes.map((note) => <RowText key={note}>{note}</RowText>)}</div>}
    {step.proofs.length > 0 && <div className="flex flex-wrap gap-1.5">{step.proofs.map((proof) => <Chip key={proof.id} tone={proof.tone} dot>{proof.kindLabel} · {proof.statusLabel.toLowerCase()}{proof.fileCount ? ` · ${proof.fileCount} files` : ""}</Chip>)}</div>}
  </div>
}

function LegView({ leg, view }: { leg: JourneyLeg; view: RecordView }) {
  const assignment = leg.assignment
  const tracking = leg.tracking
  const age = tracking?.receivedAt ? relativeTo(tracking.receivedAt, view.snapshotAt) : null
  return <div className="relative flex flex-col gap-1.5 pb-4 pl-9 before:absolute before:top-7 before:bottom-1 before:left-3 before:w-0 before:border-l before:border-dashed">
    <Marker className="border-dashed"><CarIcon className="size-3.5" aria-hidden="true" /></Marker>
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
      {leg.distanceKm != null && <span><b className="font-medium tabular-nums">{leg.distanceKm} km</b> <span className="text-muted-foreground">planned</span></span>}
      <Chip tone={leg.tone}>{leg.statusLabel}</Chip>
      {assignment
        ? <span><b className="font-medium"><ActorName actor={assignment.driver} /></b><span className="text-muted-foreground">{assignment.driverHome ? `, home base ${assignment.driverHome}` : ""} · {assignment.statusLabel.toLowerCase()}{assignment.fee ? ` · ${assignment.fee}` : ""}</span></span>
        : <span className="text-muted-foreground">No driver booked for this leg</span>}
    </div>
    {assignment?.positioning && <RowSub>{assignment.positioning}{assignment.priorOrder && <> (<OrderLink order={assignment.priorOrder} />)</>}. A home base or prior duty is not a current location.</RowSub>}
    {assignment && assignment.steps.length > 0 && <ul className="flex flex-col gap-0.5">{assignment.steps.map((step) => <li className="flex items-start gap-1.5 text-xs text-muted-foreground" key={step.id}>
      <KindIcon name={step.status === "COMPLETED" ? "check" : "chevron"} className={cn("mt-px size-3", step.status === "COMPLETED" && "text-foreground")} />
      <span>{step.title} · <span className={TONE_TEXT[step.tone]}>{step.statusLabel.toLowerCase()}</span>{step.scheduledStart ? ` · ${fmtDateTime(step.scheduledStart)}` : ""}{step.note ? ` · ${step.note}` : ""}</span>
    </li>)}</ul>}
    {tracking && <RowSub>Driver app: <b className="font-medium text-foreground">ETA {fmtDateTime(tracking.eta)}</b>{tracking.remainingKm != null ? ` · ${tracking.remainingKm} km remaining` : ""}{tracking.progress != null ? ` · ${Math.round(tracking.progress * 100)}% of the leg` : ""} · {tracking.qualityLabel} signal{age ? `, received ${age.text}` : ""}. Unverified; no map position in this packet.</RowSub>}
    {leg.inference && <RowSub>Monitor inference: {leg.inference.note ?? `ETA ${fmtDateTime(leg.inference.eta)}`}</RowSub>}
  </div>
}

export function EvidenceDetails({ view }: { view: RecordView }) {
  const { proofs, documents, custody, siteVisits } = view
  return <div>
    {proofs.length > 0 && <><SubHead>Proofs</SubHead><Rows>{proofs.map((proof) => <Row key={proof.id}>
      <RowTitle>{proof.kindLabel} <Chip tone={proof.tone}>{proof.statusLabel}</Chip></RowTitle>
      <RowSub>{proof.pointLabel ? `${proof.pointLabel} · ` : ""}{proof.required ? "required" : "optional"}{proof.fileCount ? ` · ${proof.fileCount} files` : " · no files"}{proof.submittedAt ? ` · submitted ${fmtDateTime(proof.submittedAt)}` : " · nothing submitted"}{proof.reviewedAt ? ` · reviewed ${fmtDateTime(proof.reviewedAt)}` : ""}{proof.note ? ` · ${proof.note}` : ""}</RowSub>
    </Row>)}</Rows></>}
    {documents.length > 0 && <><SubHead>Documents</SubHead><Rows>{documents.map((document) => <Row key={document.id}>
      <RowTitle>{document.kindLabel}{document.medium ? ` (${document.medium})` : ""} <Chip tone={document.tone}>{document.statusLabel}</Chip></RowTitle>
      <RowSub>{document.required ? "required" : "optional"}{document.signatureScope ? ` · signatures: ${document.signatureScope}` : ""}{document.fileCount ? ` · ${document.fileCount} files` : " · no file"}{document.updatedAt ? ` · updated ${fmtDateTime(document.updatedAt)}` : ""}{document.note ? ` · ${document.note}` : ""}</RowSub>
    </Row>)}</Rows></>}
    {custody.assets.length > 0 && <><SubHead>Keys and papers</SubHead><Rows>{custody.assets.map((asset) => <Row key={asset.id}>
      <RowTitle><KindIcon name="key" className="text-muted-foreground" />{asset.label}</RowTitle>
      <RowSub>Holder {asset.holder} · basis {asset.basis}{asset.relatedOrder && <> · linked to <OrderLink order={asset.relatedOrder} /></>}{asset.owner ? ` · next check by ${asset.owner}` : ""}{asset.dueAt ? ` ${fmtDateTime(asset.dueAt)}` : ""}</RowSub>
      {asset.nextAction && <RowText className="text-warning">{asset.nextAction}</RowText>}
      {asset.events.map((event) => <RowSub key={event.id}>{fmtDateTime(event.at)} · {event.kindLabel} · {event.verification}{event.note ? ` · ${event.note}` : ""}</RowSub>)}
    </Row>)}</Rows></>}
    {custody.reports.length > 0 && <><SubHead>Custody reports</SubHead><Rows>{custody.reports.map((report) => <Row key={report.id} side={<When at={report.at} />}>
      <RowTitle><span><ActorName actor={report.driver} /> reported the vehicle {report.security}</span></RowTitle>
      <RowSub>Continuity: {report.continuity} · location evidence: {report.location}{report.parking ? ` · ${report.parking}` : ""}</RowSub>
    </Row>)}</Rows></>}
    {siteVisits.length > 0 && <><SubHead>Site visits</SubHead><Rows>{siteVisits.map((visit) => <Row key={visit.id} side={<When at={visit.at} />}>
      <RowTitle>{visit.site ?? "Site"}: {visit.outcome}</RowTitle>
      <RowSub>{visit.verifiedBySite ? "Verified by the site" : "Not verified by the site"}{visit.leftAt ? ` · left ${fmtClock(visit.leftAt)}` : ""}</RowSub>
    </Row>)}</Rows></>}
    {proofs.length + documents.length + custody.assets.length + custody.reports.length + siteVisits.length === 0 && <Empty>Nothing recorded.</Empty>}
  </div>
}

export function HistoryDays({ view }: { view: RecordView }) {
  if (!view.history.length) return <Empty>No events recorded.</Empty>
  return <div className="flex flex-col gap-4">{view.history.map((day) => <div key={day.key}>
    <SubHead>{day.label}</SubHead>
    <ol className="flex flex-col divide-y rounded-xl border bg-card">{day.events.map((event) => <EventLine key={event.id} event={event} time={fmtClock(event.at)} detail />)}</ol>
  </div>)}</div>
}
