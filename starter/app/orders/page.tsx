"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { CarIcon, KanbanIcon, ListIcon, SearchIcon, TriangleAlertIcon, XIcon } from "@/components/icons"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toggle } from "@/components/ui/toggle"
import type { AgentCard } from "@/lib/agent-state"
import { LANES, laneLabel } from "@/lib/present/labels"
import { fmtDateTime, fmtDay, fmtRange } from "@/lib/present/time"
import type { BoardCard, Overview } from "@/lib/present/types"
import { cn } from "@/lib/utils"
import { AppFrame } from "../components/app-frame"
import { JevChip, useAgentState } from "../components/agent"
import { LaneIcon, PriorityIcon, TONE_DOT } from "../components/status-icons"
import { Monogram, TONE_TEXT } from "../components/ui"

type View = "list" | "board"

const chip = "h-7 gap-1.5 rounded-md border border-border bg-transparent px-2 text-xs font-normal text-muted-foreground shadow-none hover:bg-accent hover:text-foreground data-[state=on]:border-warning/40 data-[state=on]:bg-warning/10 data-[state=on]:text-warning"

export default function Home() {
  const [search, setSearch] = useState("")
  const [onlyAttention, setOnlyAttention] = useState(false)
  const [lane, setLane] = useState<string | null>(null)
  const [view, setView] = useState<View>("board")
  const [overview, setOverview] = useState<Overview | null>(null)
  const [error, setError] = useState("")
  const agent = useAgentState()
  const openCards = useMemo(() => new Map((agent?.cards ?? []).filter((item) => item.status === "new" || item.status === "changed").map((item) => [item.orderId, item])), [agent])

  useEffect(() => {
    try { if (localStorage.getItem("orders-view") === "list") setView("list") } catch {}
  }, [])
  const chooseView = (next: string) => {
    if (next !== "list" && next !== "board") return
    setView(next)
    try { localStorage.setItem("orders-view", next) } catch {}
  }

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/overview?q=${encodeURIComponent(search)}`, { signal: controller.signal })
        .then((response) => { if (!response.ok) throw new Error("Could not load orders"); return response.json() as Promise<Overview> })
        .then((data) => { setOverview(data); setError("") })
        .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load orders") })
    }, search ? 180 : 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [search])

  const visible = useMemo(() => {
    const cards = overview?.visible ?? []
    return cards.filter((card) => (!onlyAttention || card.attention.length > 0) && (!lane || card.displayLane === lane))
  }, [overview, onlyAttention, lane])
  const attentionTotal = overview ? Object.values(overview.attentionCounts).reduce((sum, count) => sum + count, 0) : 0
  const filtering = !!search || onlyAttention || !!lane
  const lanes = LANES.filter(([key]) => (!lane || key === lane) && (!filtering || visible.some((card) => card.displayLane === key)))

  const viewSwitch = <div className="flex h-7 items-center rounded-md bg-muted p-0.5" role="radiogroup" aria-label="View">
    {([["list", "List", ListIcon], ["board", "Board", KanbanIcon]] as const).map(([key, label, Icon]) => <button key={key} type="button" role="radio" aria-checked={view === key} onClick={() => chooseView(key)}
      className={cn("flex h-6 items-center gap-1.5 rounded-[5px] px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground", view === key && "bg-background text-foreground shadow-xs ring-1 ring-border")}>
      <Icon className="size-3.5" aria-hidden="true" />{label}
    </button>)}
  </div>

  return <AppFrame section="board" board snapshotAt={overview?.snapshotAt ?? null}>
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
          {viewSwitch}
          <InputGroup className="h-7 min-w-0 flex-1 sm:w-64 sm:flex-none">
            <InputGroupAddon><SearchIcon className="size-3.5" aria-hidden="true" /></InputGroupAddon>
            <InputGroupInput className="text-xs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter by reference, car, customer or city" aria-label="Search orders" />
            {search && <InputGroupAddon align="inline-end">
              <InputGroupButton size="icon-xs" onClick={() => setSearch("")} aria-label="Clear search"><XIcon aria-hidden="true" /></InputGroupButton>
            </InputGroupAddon>}
          </InputGroup>
          <Toggle size="sm" pressed={onlyAttention} onPressedChange={setOnlyAttention} className={chip}>
            <TriangleAlertIcon aria-hidden="true" /> Needs a person{overview ? <span className="font-mono tabular-nums">{attentionTotal}</span> : null}
          </Toggle>
          {lane && <span className="inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs">
            <span className="text-muted-foreground">Lane is</span><LaneIcon lane={lane} />{laneLabel(lane)}
            <button type="button" onClick={() => setLane(null)} className="ml-0.5 text-muted-foreground hover:text-foreground" aria-label="Clear the lane filter"><XIcon className="size-3.5" aria-hidden="true" /></button>
          </span>}
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">{overview ? `${visible.length} of ${overview.total} orders` : ""}</span>
        </div>
        {error && <p className="m-3 flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{error}. Check that the local database is running and seeded.
        </p>}
        {!overview && !error && <div className="flex flex-col" aria-busy="true">{[0, 1, 2, 3, 4, 5].map((index) => <div key={index} className="flex h-9 items-center gap-3 border-b px-4"><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-64" /></div>)}</div>}
        {overview && filtering && visible.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">
          {search ? <>No orders match “{search}”{onlyAttention ? " among the orders that need a person" : ""}.</> : "No order matches these filters."}
        </p>}
        {overview && view === "list" && <OrderList lanes={lanes} visible={visible} overview={overview} filtering={filtering} onlyAttention={onlyAttention} openCards={openCards} />}
        {overview && view === "board" && <section className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-3" aria-label="Order lanes">
          {lanes.map(([key, label]) => {
            const cards = visible.filter((card) => card.displayLane === key)
            const needing = overview.attentionCounts[key] ?? 0
            return <div className="flex min-h-0 w-[18.5rem] shrink-0 flex-col rounded-xl border bg-muted/50" key={key}>
              <header className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-2">
                <LaneIcon lane={key} /><span className="text-[13px] font-medium">{label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{filtering ? `${cards.length} of ${overview.counts[key] ?? 0}` : overview.counts[key] ?? 0}</span>
                {needing > 0 && !onlyAttention && <span className="ml-auto inline-flex items-center gap-1 text-xs text-warning tabular-nums" title={`${needing} need a person`}><TriangleAlertIcon className="size-3" aria-hidden="true" />{needing}</span>}
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 pb-2">
                {cards.length === 0 && <p className="px-1.5 py-2 text-xs text-muted-foreground">{filtering ? "No matching orders in this lane." : "No orders in this lane."}</p>}
                {cards.length > 0 && <ul className="flex flex-col gap-2">{cards.map((card) => <li className="min-w-0" key={card.id}><BoardTile card={card} agent={openCards.get(card.id)} /></li>)}</ul>}
              </div>
            </div>
          })}
        </section>}
      </div>
      {overview && view === "list" && <ViewPanel overview={overview} visible={visible} attentionTotal={attentionTotal} jevCards={openCards.size} lane={lane} onLane={setLane} />}
    </div>
  </AppFrame>
}

const MAKE_LOGOS = new Set(["aston-martin", "audi", "bentley", "bmw", "ferrari", "hyundai", "kia", "lamborghini", "mercedes-benz", "polestar", "porsche", "skoda", "tesla", "toyota", "volkswagen", "volvo"])

/** The make mark from public/car-logos, drawn as a mask so it takes the text colour in both themes. */
function MakeLogo({ make }: { make: string | null }) {
  const slug = (make ?? "").toLowerCase().replace(/\s+/g, "-").replace("š", "s")
  if (!MAKE_LOGOS.has(slug)) return <CarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
  return <span className="size-4 shrink-0 bg-foreground" aria-hidden="true"
    style={{ mask: `url(/car-logos/${slug}.svg) center / contain no-repeat`, WebkitMask: `url(/car-logos/${slug}.svg) center / contain no-repeat` }} />
}

/** One order on the board, as a deal card in the kanban reference. */
function BoardTile({ card, agent }: { card: BoardCard; agent?: AgentCard }) {
  const date = card.decisive
  const tag = card.work[0]
  return <Link href={`/orders/${card.id}`}
    className="flex flex-col gap-2 rounded-xl border bg-card p-3 text-[13px] shadow-xs outline-none transition-colors hover:border-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50"
    aria-label={`${card.vehicle}, ${card.reference}, ${laneLabel(card.displayLane)}`}>
    <span className="flex min-w-0 items-center gap-2">
      <MakeLogo make={card.vehicleMake} />
      <span className="min-w-0 flex-1 truncate font-medium">{card.vehicle}</span>
      <span className="font-mono text-[11px] text-muted-foreground">{card.reference}</span>
    </span>
    <span className="truncate text-muted-foreground">{card.customer}</span>
    {date && <span className="flex min-w-0 items-center gap-1.5 text-xs" title={`${date.label}: ${date.end ? fmtRange(date.start, date.end, date.zone) : fmtDateTime(date.start, date.zone)}${date.note ? ` · ${date.note}` : ""}`}>
      <span className="shrink-0 whitespace-nowrap text-muted-foreground">{date.label}</span>
      <span className="size-1 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden="true" />
      <span className={cn("shrink-0 whitespace-nowrap tabular-nums", date.tone === "danger" || date.tone === "warn" ? TONE_TEXT[date.tone] : "text-foreground/80")}>{fmtDay(date.start, date.zone)}</span>
      <span className="truncate text-muted-foreground">{card.from.city} → {card.to.city}</span>
    </span>}
    {(tag || agent || card.attention.length > 0) && <span className="flex min-w-0 items-center gap-1.5 border-t pt-2">
      <span className="grid size-6 shrink-0 place-items-center rounded-md border"><PriorityIcon tone={card.attentionTone} waiting={card.attention.length} /></span>
      {tag && <span className="inline-flex h-6 min-w-0 items-center gap-1.5 rounded-md border px-2 text-xs" title={tag.text}>
        <span className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[tag.tone])} aria-hidden="true" /><span className="truncate">{tag.text}</span>
      </span>}
      {agent && <span className="ml-auto shrink-0"><JevChip card={agent} /></span>}
    </span>}
  </Link>
}

function OrderList({ lanes, visible, overview, filtering, onlyAttention, openCards }: {
  lanes: typeof LANES[number][]; visible: BoardCard[]; overview: Overview; filtering: boolean; onlyAttention: boolean; openCards: Map<string, AgentCard>
}) {
  return <div className="min-h-0 flex-1 overflow-y-auto" role="list" aria-label="Orders by lane">
    {lanes.map(([key, label]) => {
      const cards = visible.filter((card) => card.displayLane === key)
      const needing = overview.attentionCounts[key] ?? 0
      return <section key={key} aria-label={label}>
        <header className="sticky top-0 z-[1] flex h-9 items-center gap-2 border-b bg-muted px-4">
          <LaneIcon lane={key} />
          <h2 className="text-[13px] font-medium">{label}</h2>
          <span className="text-xs text-muted-foreground tabular-nums">{filtering ? `${cards.length} of ${overview.counts[key] ?? 0}` : overview.counts[key] ?? 0}</span>
          {needing > 0 && !onlyAttention && <span className="ml-auto text-xs text-warning tabular-nums">{needing} need a person</span>}
        </header>
        {cards.length === 0 && <p className="border-b px-4 py-2 text-xs text-muted-foreground">No orders in this lane.</p>}
        {cards.map((card) => <OrderRow key={card.id} card={card} agent={openCards.get(card.id)} />)}
      </section>
    })}
  </div>
}

function OrderRow({ card, agent }: { card: BoardCard; agent?: AgentCard }) {
  const date = card.decisive
  const pills = card.work.slice(0, 2)
  return <Link href={`/orders/${card.id}`} role="listitem"
    className="group flex h-10 items-center gap-3 border-b px-4 text-[13px] outline-none hover:bg-accent/60 focus-visible:bg-accent" title={`${card.from.city} → ${card.to.city}`}
    aria-label={`${card.vehicle}, ${card.reference}, ${laneLabel(card.displayLane)}`}>
    <PriorityIcon tone={card.attentionTone} waiting={card.attention.length} />
    <span className="w-[4.75rem] shrink-0 font-mono text-xs text-muted-foreground">{card.reference}</span>
    <LaneIcon lane={card.displayLane} />
    <span className="flex min-w-0 flex-1 items-baseline gap-2">
      <span className="truncate font-medium">{card.vehicle}</span>
      <span className="hidden truncate text-muted-foreground sm:inline">{card.customer}</span>
    </span>
    <span className="hidden min-w-0 shrink items-center gap-1.5 md:flex">
      {pills.map((line, index) => <span key={index} className={cn("inline-flex h-5 max-w-48 min-w-0 items-center gap-1.5 rounded-full border px-2 text-[11px]", TONE_TEXT[line.tone] === "text-muted-foreground" ? "text-muted-foreground" : "text-foreground/90")} title={line.text}>
        <span className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[line.tone])} aria-hidden="true" />
        <span className="truncate">{line.text}</span>
      </span>)}
      {card.work.length > 2 && <span className="text-[11px] text-muted-foreground">+{card.work.length - 2}</span>}
    </span>
    {agent && <JevChip card={agent} />}
    {date && <span className={cn("w-14 shrink-0 text-right text-xs tabular-nums", date.tone === "danger" || date.tone === "warn" ? TONE_TEXT[date.tone] : "text-muted-foreground")}
      title={`${date.label}: ${date.end ? fmtRange(date.start, date.end, date.zone) : fmtDateTime(date.start, date.zone)}${date.note ? ` · ${date.note}` : ""}`}>
      {fmtDay(date.start, date.zone)}
    </span>}
    <Monogram name={card.customer} />
  </Link>
}

/** The view details on the right, as in Linear: what the view holds, and counts that filter it. */
function ViewPanel({ overview, visible, attentionTotal, jevCards, lane, onLane }: {
  overview: Overview; visible: BoardCard[]; attentionTotal: number; jevCards: number; lane: string | null; onLane: (lane: string | null) => void
}) {
  const customers = useMemo(() => {
    const counts = new Map<string, number>()
    for (const card of visible) counts.set(card.customer, (counts.get(card.customer) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
  }, [visible])
  const routes = useMemo(() => {
    const counts = new Map<string, number>()
    for (const card of visible) counts.set(card.routeKindLabel, (counts.get(card.routeKindLabel) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [visible])
  const row = "flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] hover:bg-accent"
  return <aside className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l xl:flex" aria-label="View details">
    <div className="flex flex-col gap-1.5 border-b p-4">
      <h2 className="text-sm font-medium">All orders</h2>
      <p className="text-xs text-muted-foreground">Every order in the snapshot, grouped by lane. Orders that need a person come first in each lane.</p>
    </div>
    <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 border-b p-4 text-[13px]">
      <dt className="text-muted-foreground">Snapshot</dt><dd className="tabular-nums">{overview.snapshotAt ? fmtDateTime(overview.snapshotAt) : "Unknown"}</dd>
      <dt className="text-muted-foreground">Need a person</dt><dd className="text-warning tabular-nums">{attentionTotal}</dd>
      <dt className="text-muted-foreground">Moving now</dt><dd className="tabular-nums">{overview.counts.moving ?? 0}</dd>
      <dt className="text-muted-foreground">Agent cards</dt><dd className="tabular-nums">{jevCards} <span className="text-muted-foreground">checked by Jev</span></dd>
    </dl>
    <Tabs defaultValue="lanes" className="gap-2 p-3">
      <TabsList className="w-full">
        <TabsTrigger value="lanes" className="text-xs">Lanes</TabsTrigger>
        <TabsTrigger value="customers" className="text-xs">Customers</TabsTrigger>
        <TabsTrigger value="routes" className="text-xs">Routes</TabsTrigger>
      </TabsList>
      <TabsContent value="lanes" className="flex flex-col">
        {LANES.map(([key, label]) => <button key={key} type="button" className={cn(row, lane === key && "bg-accent")} onClick={() => onLane(lane === key ? null : key)} aria-pressed={lane === key}>
          <LaneIcon lane={key} /><span className="flex-1 truncate">{label}</span>
          {(overview.attentionCounts[key] ?? 0) > 0 && <span className="text-xs text-warning tabular-nums">{overview.attentionCounts[key]}</span>}
          <span className="w-6 text-right text-xs text-muted-foreground tabular-nums">{overview.counts[key] ?? 0}</span>
        </button>)}
      </TabsContent>
      <TabsContent value="customers" className="flex flex-col">
        {customers.map(([name, count]) => <div key={name} className={row}><span className="flex-1 truncate">{name}</span><span className="text-xs text-muted-foreground tabular-nums">{count}</span></div>)}
      </TabsContent>
      <TabsContent value="routes" className="flex flex-col">
        {routes.map(([name, count]) => <div key={name} className={row}><span className="flex-1 truncate">{name}</span><span className="text-xs text-muted-foreground tabular-nums">{count}</span></div>)}
      </TabsContent>
    </Tabs>
  </aside>
}
