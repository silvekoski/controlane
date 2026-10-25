"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { ArrowUpRightIcon, ChevronLeftIcon, InboxIcon, LockIcon, MailOpenIcon, PaperclipIcon, SearchIcon, SendIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Empty as EmptyState, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { actorPhoto } from "@/lib/driver-photos"
import { fmtClock, fmtDateTime, fmtDayHeading, relativeTo } from "@/lib/present/time"
import type { InboxMessageView, InboxThreadView, InboxView } from "@/lib/present/types"
import { cn } from "@/lib/utils"
import { AppFrame } from "../components/app-frame"
import { ActorName, Chip, Monogram, OrderLinks, When } from "../components/ui"

type Status = "open" | "all"

/** A support inbox as a chat client: conversations on the left, the thread as chat in the middle, its facts on the right. */
export default function InboxPage() {
  const [view, setView] = useState<InboxView | null>(null)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [showList, setShowList] = useState(true)
  const [status, setStatus] = useState<Status>("all")
  const [channel, setChannel] = useState("all")
  const [query, setQuery] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/inbox", { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("Could not load the inbox"); return response.json() as Promise<{ view: InboxView }> })
      .then((data) => {
        setView(data.view)
        setError("")
        const wanted = window.location.hash.replace(/^#/, "")
        const first = data.view.threads.find((thread) => thread.id === wanted) ?? data.view.threads[0]
        if (first) setSelected(first.id)
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        const message = cause instanceof Error ? cause.message : "Could not load the inbox"
        setError(message)
        toast.error(message, { description: "Check that the local database is running and seeded." })
      })
    return () => controller.abort()
  }, [])

  const threads = view?.threads ?? []
  const channels = useMemo(() => [...new Map(threads.map((thread) => [thread.channel, thread.channelLabel])).entries()], [threads])
  const needle = query.trim().toLowerCase()
  const shown = threads.filter((thread) => (status === "all" || thread.status === "OPEN")
    && (channel === "all" || thread.channel === channel)
    && (!needle || `${thread.counterparty?.name ?? ""} ${thread.categoryLabel} ${thread.messages.map((message) => message.body).join(" ")}`.toLowerCase().includes(needle)))
  const thread = threads.find((item) => item.id === selected) ?? null

  const choose = (id: string) => {
    setSelected(id)
    setShowList(false)
    window.history.replaceState(null, "", `#${id}`)
  }

  return <AppFrame section="inbox" snapshotAt={view?.snapshotAt ?? null} board>
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
      <div className="flex h-7 items-center rounded-md bg-muted p-0.5" role="radiogroup" aria-label="Status">
        {([["all", "All"], ["open", "Open"]] as const).map(([key, label]) => <button key={key} type="button" role="radio" aria-checked={status === key} onClick={() => setStatus(key)}
          className={cn("flex h-6 items-center gap-1.5 rounded-[5px] px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground", status === key && "bg-background text-foreground shadow-xs ring-1 ring-border")}>
          {label}<span className="font-mono text-[11px] tabular-nums opacity-70">{key === "all" ? threads.length : view?.open ?? ""}</span>
        </button>)}
      </div>
      <InputGroup className="h-7 min-w-0 flex-1 sm:w-64 sm:flex-none">
        <InputGroupAddon><SearchIcon className="size-3.5" aria-hidden="true" /></InputGroupAddon>
        <InputGroupInput className="text-xs" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by sender, topic or text" aria-label="Search conversations" />
      </InputGroup>
      <Select value={channel} onValueChange={setChannel}>
        <SelectTrigger size="sm" className="h-7 w-36 text-xs" aria-label="Channel"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">All channels</SelectItem>{channels.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
      </Select>
      <span className="ml-auto text-xs text-muted-foreground tabular-nums">{view ? `${shown.length} of ${threads.length} conversations` : ""}</span>
    </div>
    <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(19rem,24rem)_minmax(0,1fr)] xl:grid-cols-[minmax(19rem,24rem)_minmax(0,1fr)_18rem]">
      <section className={cn("flex min-h-0 flex-col md:border-r", !showList && "hidden md:flex")} aria-label="Conversations">
        <header className="flex flex-col gap-0.5 border-b bg-muted px-4 py-2.5">
          <h1 className="text-[13px] font-medium">Support inbox</h1>
          <p className="text-xs text-muted-foreground">These arrived before an order link was certain.</p>
        </header>
        {error && <p className="px-4 py-3 text-sm text-danger" role="alert">{error}.</p>}
        {!view && !error && <div className="flex flex-col">{[0, 1, 2].map((index) => <div key={index} className="flex gap-3 border-b px-4 py-3"><Skeleton className="size-9 rounded-full" /><Skeleton className="h-12 flex-1" /></div>)}</div>}
        <ul className="min-h-0 flex-1 overflow-y-auto">{shown.map((item) => {
          const last = item.messages[item.messages.length - 1]
          const active = item.id === selected
          const name = item.counterparty?.name ?? "Unknown sender"
          return <li key={item.id}>
            <button type="button" onClick={() => choose(item.id)} aria-current={active ? "true" : undefined}
              className={cn("grid w-full grid-cols-[0.75rem_2rem_minmax(0,1fr)] gap-x-2.5 border-b px-4 py-3 text-left outline-none hover:bg-accent/60 focus-visible:bg-accent", active && "bg-accent hover:bg-accent")}>
              <span className="pt-2.5">{item.status === "OPEN" && <span className="block size-1.5 rounded-full bg-primary" aria-label="Open" />}</span>
              <Monogram name={name} photo={actorPhoto(item.counterparty)} className="mt-0.5 size-8 text-[10px]" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-[13px] font-medium">{name}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{ago(item.updatedAt, view?.snapshotAt)}</span>
                </span>
                <span className="truncate text-xs text-muted-foreground">{item.counterparty?.role ?? "sender"} · {item.channelLabel} · {item.categoryLabel}</span>
                {last && <span className="mt-0.5 line-clamp-2 text-xs text-foreground/80">{last.body}</span>}
                <span className="mt-1"><Chip tone={item.linkTone} className="h-5 text-[11px]">{item.linkStateLabel}</Chip></span>
              </span>
            </button>
          </li>
        })}</ul>
        {view && shown.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">No conversation matches these filters.</p>}
      </section>

      <section className={cn("flex min-h-0 flex-col", showList && "hidden md:flex")} aria-label="Conversation">
        {!view && !error && <div className="flex flex-col gap-3 p-6"><span className="sr-only">Loading…</span><Skeleton className="h-10 w-72" /><Skeleton className="h-24 w-2/3" /></div>}
        {view && !thread && <EmptyState className="m-6 flex-none border py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon"><InboxIcon aria-hidden="true" /></EmptyMedia>
            <EmptyTitle>Choose a conversation.</EmptyTitle>
            <EmptyDescription>The open conversation shows here.</EmptyDescription>
          </EmptyHeader>
        </EmptyState>}
        {thread && <Conversation thread={thread} snapshotAt={view?.snapshotAt ?? null} onBack={() => setShowList(true)} />}
      </section>

      {thread && <Details thread={thread} />}
    </div>
  </AppFrame>
}

function ago(at: string | null | undefined, snapshotAt: string | null | undefined): string {
  const rel = relativeTo(at, snapshotAt)
  return rel ? rel.text.replace(" ago", "") : ""
}

function Conversation({ thread, snapshotAt, onBack }: { thread: InboxThreadView; snapshotAt: string | null; onBack: () => void }) {
  const name = thread.counterparty?.name ?? "Unknown sender"
  const first = thread.counterparty?.name.split(" ")[0] ?? "the sender"
  const order = thread.linked[0] ?? null
  const [draft, setDraft] = useState("")
  const send = () => {
    toast.info("This starter is read only. Nothing was sent.", { description: draft.trim() ? `Your draft to ${first} stays in the box.` : "Write the reply in the support tool." })
  }
  return <>
    <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3 md:px-6">
      <Button type="button" variant="ghost" size="icon-sm" className="-ml-1 md:hidden" onClick={onBack} aria-label="All conversations"><ChevronLeftIcon aria-hidden="true" /></Button>
      <Monogram name={name} photo={actorPhoto(thread.counterparty)} className="size-10 text-xs" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-base font-semibold">{thread.counterparty ? <ActorName actor={thread.counterparty} /> : name}</h2>
          <Chip dot tone={thread.tone} className="h-5 text-[11px]">{thread.statusLabel}</Chip>
        </div>
        <p className="truncate text-xs text-muted-foreground">{thread.counterparty?.role ?? "sender"} · {thread.channelLabel} · {thread.categoryLabel}</p>
      </div>
      {order && <Button asChild size="sm"><Link href={`/orders/${order.id}`}>Open {order.reference}<ArrowUpRightIcon aria-hidden="true" /></Link></Button>}
    </header>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-2 text-xs text-muted-foreground md:px-6 xl:hidden">
      <Chip tone={thread.linkTone} className="h-5 text-[11px]">{thread.linkStateLabel}</Chip>
      {thread.linked.length > 0 && <span>Linked: <OrderLinks orders={thread.linked} /></span>}
      {thread.candidates.length > 0 && !thread.linked.length && <span>Candidates: <OrderLinks orders={thread.candidates} /></span>}
      {thread.owner && <span>Owner: {thread.owner}</span>}
      {thread.waitingOn && <span>Waiting on {thread.waitingOn}</span>}
    </div>

    <ol className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-6 md:px-6" aria-label="Messages">
      {thread.messages.map((message, index) => {
        const previous = thread.messages[index - 1]
        const newDay = !previous || previous.at.slice(0, 10) !== message.at.slice(0, 10)
        return <li key={message.id} className="flex flex-col gap-5">
          {newDay && <DaySeparator at={message.at} snapshotAt={snapshotAt} />}
          <Bubble message={message} />
        </li>
      })}
      {thread.messages.length === 0 && <EmptyState className="flex-none border py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon"><MailOpenIcon aria-hidden="true" /></EmptyMedia>
          <EmptyTitle>No messages filed under this thread.</EmptyTitle>
        </EmptyHeader>
      </EmptyState>}
    </ol>

    <form className="border-t p-3 md:px-6" onSubmit={(event) => { event.preventDefault(); send() }}>
      <div className="rounded-lg border bg-card p-3 focus-within:ring-3 focus-within:ring-ring/30">
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} placeholder={`Message ${first}…`} aria-label={`Message ${first}`}
          className="w-full resize-none bg-transparent text-[13px] outline-none placeholder:text-muted-foreground" />
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><PaperclipIcon className="size-3.5" aria-hidden="true" />Read only: replies go through the support tool.</span>
          <Button type="submit" size="sm" className="ml-auto">Send<SendIcon aria-hidden="true" /></Button>
        </div>
      </div>
    </form>
  </>
}

function DaySeparator({ at, snapshotAt }: { at: string; snapshotAt: string | null }) {
  const same = snapshotAt && snapshotAt.slice(0, 10) === at.slice(0, 10)
  return <div className="flex items-center gap-3 text-xs text-muted-foreground" role="separator">
    <span className="h-px flex-1 bg-border" /><span>{same ? "Snapshot day" : fmtDayHeading(at)}</span><span className="h-px flex-1 bg-border" />
  </div>
}

/** Support messages sit on the right, the sender's on the left, internal notes full width with a dashed border. */
function Bubble({ message }: { message: InboxMessageView }) {
  const ours = message.author.kind === "operator"
  if (message.internal) return <div className="flex flex-col gap-1.5 rounded-lg border border-warning/30 bg-warning/5 px-3.5 py-2.5">
    <span className="flex flex-wrap items-center gap-2 text-xs text-warning"><LockIcon className="size-3.5" aria-hidden="true" />Internal note · {message.author.name}<time dateTime={message.at} className="ml-auto tabular-nums" title={fmtDateTime(message.at)}>{fmtClock(message.at)}</time></span>
    <p className="text-[13px] leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap">{message.body}</p>
  </div>
  return <div className={cn("flex gap-3", ours && "flex-row-reverse")}>
    <Monogram name={message.author.name} photo={actorPhoto(message.author)} className="mt-0.5 size-8 text-[10px]" />
    <div className={cn("flex max-w-[80%] min-w-0 flex-col gap-1.5", ours && "items-end")}>
      <span className="flex flex-wrap items-baseline gap-2 text-xs">
        <span className="font-medium text-foreground">{ours ? `${message.author.name} (support)` : message.author.name}</span>
        <time dateTime={message.at} className="text-muted-foreground tabular-nums" title={fmtDateTime(message.at)}>{fmtClock(message.at)}</time>
        <span className="text-muted-foreground">to {message.recipient.name} · {message.channelLabel}{message.language ? ` · ${message.language.toUpperCase()}` : ""}</span>
      </span>
      <p className={cn("rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap", ours ? "rounded-tr-lg bg-primary/15 text-foreground" : "rounded-tl-lg bg-muted")}>{message.body}</p>
    </div>
  </div>
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 py-1.5 text-[13px]"><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 break-words">{children}</dd></div>
}

/** The thread's facts: who, which channel, which orders it may belong to and why. Wide screens only. */
function Details({ thread }: { thread: InboxThreadView }) {
  return <aside className="hidden min-h-0 flex-col overflow-y-auto border-l xl:flex" aria-label="Conversation details">
    <section className="border-b p-4">
      <h3 className="mb-1 text-xs font-medium text-muted-foreground">Details</h3>
      <dl>
        <Row label="Status"><Chip dot tone={thread.tone} className="h-5 text-[11px]">{thread.statusLabel}</Chip></Row>
        <Row label="Order link"><Chip tone={thread.linkTone} className="h-5 text-[11px]">{thread.linkStateLabel}</Chip></Row>
        <Row label="Channel">{thread.channelLabel}</Row>
        <Row label="Owner">{thread.owner ?? <span className="text-muted-foreground">Not recorded</span>}</Row>
        {thread.waitingOn && <Row label="Waiting on">{thread.waitingOn}</Row>}
        <Row label="Opened"><When at={thread.openedAt} withZone={false} /></Row>
      </dl>
    </section>
    {(thread.linked.length > 0 || thread.candidates.length > 0) && <section className="border-b p-4">
      <h3 className="mb-1 text-xs font-medium text-muted-foreground">Orders</h3>
      <dl>
        {thread.linked.length > 0 && <Row label="Linked"><OrderLinks orders={thread.linked} /></Row>}
        {thread.candidates.length > 0 && !thread.linked.length && <Row label="Candidates"><OrderLinks orders={thread.candidates} /><span className="block text-xs text-muted-foreground">hypotheses, not links</span></Row>}
      </dl>
      {thread.candidateBasis && <p className="mt-2 text-xs leading-relaxed text-muted-foreground"><span className="font-medium text-foreground">Basis.</span> {thread.candidateBasis}</p>}
    </section>}
    {thread.resolution && <section className="p-4">
      <h3 className="mb-1 text-xs font-medium text-muted-foreground">Resolution</h3>
      <p className="text-[13px]">{thread.resolution.decisionLabel}</p>
      {thread.resolution.at && <p className="text-xs text-muted-foreground">{fmtDateTime(thread.resolution.at)}</p>}
    </section>}
  </aside>
}
