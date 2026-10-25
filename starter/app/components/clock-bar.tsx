"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { BotIcon, ClockIcon, HistoryIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import type { Tone } from "@/lib/present/types"
import { cn } from "@/lib/utils"
import { act } from "./control"
import { Chip } from "./ui"

/* The control room clock and the event feed in the top bar.
   The clock has two modes. "live" shows the real time. "travel" starts at a chosen moment and moves with real time.
   The control room fires each monitoring event when its clock passes the event time. */

export type FeedState = "upcoming" | "due" | "running" | "card" | "closed" | "failed" | "missed"

export type FeedItem = { id: string; at: string; orderRef: string; orderId: string | null; title: string; state: FeedState; label: string; runId?: string; cardId?: string }

export type ClockView = { mode: "live" | "travel"; now: string; offsetMs: number; nextEventAt: string | null; feed: FeedItem[] }

const SNAPSHOT_PRESET = "2026-10-21T08:55:00Z"
const POLL_MS = 10_000

const fmtWhen = (t: number) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(t))
const fmtHm = (iso: string) => iso.slice(11, 16)

const STATE_TONE: Record<FeedState, Tone> = { upcoming: "neutral", due: "accent", running: "accent", card: "warn", closed: "ok", failed: "danger", missed: "neutral" }

/** Reads the control room clock and its feed. Polls, and tells the other views to reload when an event changes state. */
function useClock() {
  const [view, setView] = useState<ClockView | null>(null)
  const [offline, setOffline] = useState(false)
  const signature = useRef("")
  const load = useCallback(() => {
    fetch("/api/control?view=clock", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok || !body.clock) { setOffline(true); return }
        const clock = body.clock as ClockView
        setOffline(false)
        setView(clock)
        const next = clock.feed.map((item) => `${item.id}:${item.state}`).join("|")
        if (signature.current && signature.current !== next) window.dispatchEvent(new Event("control-changed"))
        signature.current = next
      })
      .catch(() => setOffline(true))
  }, [])
  useEffect(() => {
    load()
    const timer = setInterval(load, POLL_MS)
    window.addEventListener("control-changed", load)
    return () => { clearInterval(timer); window.removeEventListener("control-changed", load) }
  }, [load])
  // Read again just after the next event time, so the event shows without delay.
  useEffect(() => {
    if (!view?.nextEventAt) return
    const wait = Date.parse(view.nextEventAt) - (Date.now() + view.offsetMs) + 1000
    if (wait > POLL_MS * 6) return
    const timer = setTimeout(load, Math.max(1000, wait))
    return () => clearTimeout(timer)
  }, [view?.nextEventAt, view?.offsetMs, load])
  return { view, offline }
}

/** The clock time on this device: the real time plus the control room offset. */
function useTicking(offsetMs: number | undefined) {
  const [t, setT] = useState<number | null>(null)
  useEffect(() => {
    if (offsetMs === undefined) return
    const tick = () => setT(Date.now() + offsetMs)
    tick()
    const timer = setInterval(tick, 15_000)
    return () => clearInterval(timer)
  }, [offsetMs])
  return t
}

export function ClockBar() {
  const { view, offline } = useClock()
  const t = useTicking(view?.offsetMs)
  const [pending, start] = useTransition()
  const [at, setAt] = useState("")
  const [open, setOpen] = useState(false)

  const setClock = (body: { mode: "live" } | { mode: "travel"; at: string }, done: string) => start(async () => {
    try {
      await act({ action: "set_clock", ...body })
      toast.success(done)
      setOpen(false)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not set the clock")
    }
  })

  if (offline && !view) return <Chip tone="neutral" className="hidden sm:inline-flex">Control room not running</Chip>
  if (!view || t === null) return null
  const travel = view.mode === "travel"
  const active = view.feed.filter((item) => item.state === "running" || item.state === "card").length

  return <div className="flex items-center gap-1.5">
    {travel
      ? <Chip tone="warn" className="tabular-nums"><HistoryIcon aria-hidden="true" />Viewing {fmtWhen(t)} UTC (time travel)</Chip>
      : <span className="hidden items-center gap-1.5 font-mono text-xs text-muted-foreground tabular-nums sm:flex" title="Real time"><ClockIcon className="size-3.5" aria-hidden="true" />{fmtWhen(t)} UTC</span>}
    {travel && <Button variant="outline" size="sm" disabled={pending} onClick={() => setClock({ mode: "live" }, "Back to the real time")}>Back to now</Button>}

    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground" aria-label="Go to a time"><HistoryIcon aria-hidden="true" /><span className="hidden md:inline">Time</span></Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <PopoverHeader>
          <PopoverTitle>Go to a time</PopoverTitle>
          <PopoverDescription>The screens show the state at that time. Then the clock moves with real time. Events fire when the clock passes them.</PopoverDescription>
        </PopoverHeader>
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">Date and time (UTC)
            <Input type="datetime-local" value={at} onChange={(event) => setAt(event.target.value)} />
          </label>
          <Button size="sm" disabled={pending || !at} onClick={() => setClock({ mode: "travel", at: `${at}:00Z` }, "Clock set")}>Go to this time</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setClock({ mode: "travel", at: SNAPSHOT_PRESET }, "Clock set to the packet snapshot")}>Packet snapshot, 21 Oct 08:55 UTC</Button>
          {travel && <Button size="sm" variant="ghost" disabled={pending} onClick={() => setClock({ mode: "live" }, "Back to the real time")}>Back to now</Button>}
        </div>
      </PopoverContent>
    </Popover>

    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground"><BotIcon aria-hidden="true" /><span className="hidden md:inline">Events</span>{active > 0 && <span className="font-mono text-xs tabular-nums">{active}</span>}</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[26rem] max-w-[calc(100vw-2rem)]">
        <PopoverHeader>
          <PopoverTitle>Event feed</PopoverTitle>
          <PopoverDescription>Monitoring events on 21 Oct 2026. The agent starts on each event when the clock passes its time. An event more than 2 hours old does not start: it is missed.</PopoverDescription>
        </PopoverHeader>
        <ol className="flex flex-col divide-y">
          {view.feed.map((item) => <li key={item.id} className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-start gap-2 py-1.5 text-[13px]">
            <span className="pt-0.5 font-mono text-xs text-muted-foreground tabular-nums">{fmtHm(item.at)}</span>
            <span className="flex min-w-0 flex-col">
              {item.orderId
                ? <Link href={item.cardId && item.state === "card" ? `/decisions/${item.cardId}` : `/orders/${item.orderId}#agent`} className="font-mono text-xs hover:underline">{item.orderRef}</Link>
                : <span className="font-mono text-xs">{item.orderRef}</span>}
              <span className={cn(item.state === "missed" && "text-muted-foreground")}>{item.title}</span>
            </span>
            <Chip tone={STATE_TONE[item.state]} dot={item.state === "running"}>{item.label}</Chip>
          </li>)}
        </ol>
      </PopoverContent>
    </Popover>
  </div>
}
