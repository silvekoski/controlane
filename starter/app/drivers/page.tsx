"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  ArrowUpRightIcon, CarFrontIcon, CheckIcon, CopyIcon, EuroIcon, KanbanIcon, ListIcon, MapPinIcon, MoonIcon, PackageIcon, SearchIcon,
  TrainFrontIcon, TriangleAlertIcon, type LucideIcon,
} from "@/components/icons"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { driverPhoto } from "@/lib/driver-photos"
import { fmtMoney } from "@/lib/present/time"
import type { DriverList, DriverRow, DriverState } from "@/lib/present/types"
import { cn } from "@/lib/utils"
import { AppFrame } from "../components/app-frame"
import { Monogram } from "../components/ui"

const STATES: { key: DriverState; label: string; note: string; icon: LucideIcon; tint: string; dot: string; empty: string }[] = [
  { key: "driving", label: "Driving", note: "Car collected, on the way to the delivery", icon: CarFrontIcon, tint: "text-[oklch(0.72_0.15_155)]", dot: "bg-[oklch(0.72_0.15_155)]", empty: "Nobody drives a car now." },
  { key: "traveling", label: "Traveling", note: "On the way to a pickup or back home, without a car", icon: TrainFrontIcon, tint: "text-primary", dot: "bg-primary", empty: "Nobody travels without a car in this snapshot." },
  { key: "off", label: "Off duty", note: "No job in progress. Some have a next job.", icon: MoonIcon, tint: "text-muted-foreground", dot: "bg-muted-foreground/60", empty: "Every driver has a job." },
]

type View = "board" | "list"

export default function DriversPage() {
  const [list, setList] = useState<DriverList | null>(null)
  const [view, setView] = useState<View>("board")
  const [query, setQuery] = useState("")
  const [country, setCountry] = useState("all")

  useEffect(() => {
    try { if (localStorage.getItem("drivers-view") === "list") setView("list") } catch {}
    const controller = new AbortController()
    fetch("/api/drivers", { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("Could not load drivers"); return response.json() as Promise<DriverList> })
      .then(setList)
      .catch((cause: unknown) => { if (!controller.signal.aborted) toast.error(cause instanceof Error ? cause.message : "Could not load drivers", { description: "Check that the local database is running and seeded." }) })
    return () => controller.abort()
  }, [])
  const chooseView = (next: View) => {
    setView(next)
    try { localStorage.setItem("drivers-view", next) } catch {}
  }

  const rows = list?.rows ?? []
  const countries = [...new Set(rows.map((row) => row.homeCountry))].sort()
  const needle = query.trim().toLowerCase()
  const shown = rows.filter((row) => (country === "all" || row.homeCountry === country)
    && (!needle || `${row.name} ${row.id} ${row.homeCity} ${row.current?.reference ?? ""}`.toLowerCase().includes(needle)))
  const count = (state: DriverState) => rows.filter((row) => row.state === state).length
  const money = (cents: number) => fmtMoney(cents, list?.currency ?? "EUR")
  const copy = (id: string) => navigator.clipboard.writeText(id).then(() => toast.success(`Copied ${id}`, { description: "The driver ID is on your clipboard." }), () => toast.error("Could not copy the driver ID"))

  return <AppFrame section="drivers" snapshotAt={list?.snapshotAt ?? null} board>
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3 px-4 pt-5 pb-3 md:px-6">
        <div className="flex flex-wrap gap-2" aria-label="Driver totals">
          {list ? <>
            <Pill icon={CarFrontIcon} label="Driving" value={`${count("driving")}/${rows.length}`} className="text-[oklch(0.72_0.15_155)]" />
            <Pill icon={TrainFrontIcon} label="Traveling" value={String(count("traveling"))} />
            <Pill icon={MoonIcon} label="Off duty" value={String(count("off"))} />
            <Pill icon={ArrowUpRightIcon} label="Next jobs" value={String(rows.filter((row) => row.state === "off" && row.current).length)} />
            <Pill icon={TriangleAlertIcon} label="Need a person" value={String(rows.filter((row) => row.needPerson > 0).length)} className="text-warning" />
            <Pill icon={EuroIcon} label="Fees" value={money(rows.reduce((sum, row) => sum + row.feeCents, 0))} />
          </> : [0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-8 w-28 rounded-full" />)}
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Drivers</h1>
          <p className="text-[13px] text-muted-foreground">Who drives a car now, who travels to a job, and who is off duty.</p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-y px-4 py-2 md:px-6">
        <div className="flex h-7 items-center rounded-md bg-muted p-0.5" role="radiogroup" aria-label="View">
          {([["board", "Board", KanbanIcon], ["list", "List", ListIcon]] as const).map(([key, label, Icon]) => <button key={key} type="button" role="radio" aria-checked={view === key} onClick={() => chooseView(key)}
            className={cn("flex h-6 items-center gap-1.5 rounded-[5px] px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground", view === key && "bg-background text-foreground shadow-xs ring-1 ring-border")}>
            <Icon className="size-3.5" aria-hidden="true" />{label}
          </button>)}
        </div>
        <InputGroup className="h-7 min-w-48 flex-1 sm:w-64 sm:flex-none">
          <InputGroupAddon><SearchIcon className="size-3.5" aria-hidden="true" /></InputGroupAddon>
          <InputGroupInput className="text-xs" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by name, ID, city or order" aria-label="Filter drivers" />
        </InputGroup>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger size="sm" className="h-7 w-36 text-xs" aria-label="Home country"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All countries</SelectItem>{countries.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}</SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{list ? `${shown.length} of ${rows.length} drivers` : ""}</span>
      </div>

      {!list && <div className="flex gap-3 p-3">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-96 w-80 rounded-xl" />)}</div>}

      {list && view === "board" && <section className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-3 md:px-6" aria-label="Drivers by state">
        {STATES.map((state) => {
          const cards = shown.filter((row) => row.state === state.key)
          return <div key={state.key} className="flex min-h-0 w-[22rem] shrink-0 flex-col rounded-xl border bg-muted/50">
            <header className="flex shrink-0 flex-col gap-0.5 px-3.5 pt-3.5 pb-2.5">
              <span className="flex items-center gap-2">
                <state.icon className={cn("size-4", state.tint)} aria-hidden="true" />
                <h2 className="text-sm font-semibold">{state.label}</h2>
                <span className="rounded-md bg-background px-1.5 font-mono text-xs text-muted-foreground tabular-nums">{cards.length}</span>
              </span>
              <span className="text-xs text-muted-foreground">{state.note}</span>
            </header>
            <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain px-2 pb-2">
              {cards.length === 0 && <li className="rounded-xl border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">{needle || country !== "all" ? "No driver matches these filters." : state.empty}</li>}
              {cards.map((row) => <li key={row.id}><DriverCard row={row} dot={state.dot} money={money} onCopy={copy} /></li>)}
            </ul>
          </div>
        })}
      </section>}

      {list && view === "list" && <div className="min-h-0 flex-1 overflow-auto p-3 md:px-6">
        <div className="overflow-x-auto rounded-xl border">
          <Table className="text-[13px]">
            <TableHeader className="bg-muted/60">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-10 pl-4 text-xs">Driver</TableHead><TableHead className="h-10 text-xs">State</TableHead><TableHead className="h-10 text-xs">Now</TableHead>
                <TableHead className="h-10 text-xs">Job</TableHead><TableHead className="h-10 text-right text-xs">Orders</TableHead><TableHead className="h-10 text-right text-xs">Completed</TableHead>
                <TableHead className="h-10 pr-4 text-right text-xs">Fees</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((row) => {
                const state = STATES.find((item) => item.key === row.state)!
                return <TableRow key={row.id}>
                  <TableCell className="py-2.5 pl-4">
                    <span className="flex items-center gap-2.5">
                      <Monogram name={row.name} photo={driverPhoto(row.id)} className="size-7 text-[10px]" />
                      <span className="min-w-0"><Link href={row.href} className="block font-medium hover:underline">{row.name}</Link><span className="block font-mono text-[11px] text-muted-foreground">{row.id} · {row.homeCity}, {row.homeCountry}</span></span>
                    </span>
                  </TableCell>
                  <TableCell className="py-2.5"><span className="inline-flex items-center gap-1.5 text-xs"><state.icon className={cn("size-3.5", state.tint)} aria-hidden="true" />{state.label}</span></TableCell>
                  <TableCell className="max-w-64 truncate py-2.5 text-muted-foreground">{row.doing ?? "No open job."}</TableCell>
                  <TableCell className="py-2.5">{row.current ? <Link href={`/orders/${row.current.orderId}`} className="font-mono text-xs hover:underline">{row.current.reference}</Link> : <span className="text-muted-foreground">–</span>}</TableCell>
                  <TableCell className="py-2.5 text-right font-mono tabular-nums">{row.orders}</TableCell>
                  <TableCell className="py-2.5 text-right font-mono tabular-nums">{row.completed}</TableCell>
                  <TableCell className="py-2.5 pr-4 text-right font-mono tabular-nums">{row.feeCents ? money(row.feeCents) : <span className="text-muted-foreground">–</span>}</TableCell>
                </TableRow>
              })}
              {shown.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No driver matches these filters.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>}
    </div>
  </AppFrame>
}

function Pill({ icon: Icon, label, value, className }: { icon: LucideIcon; label: string; value: string; className?: string }) {
  return <span className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-card px-3 text-xs text-muted-foreground">
    <Icon className={cn("size-3.5", className)} aria-hidden="true" />{label}<span className="font-mono font-medium text-foreground tabular-nums">{value}</span>
  </span>
}

/** One driver as a card: who, where from, what now, which job, and the work totals as chips. */
function DriverCard({ row, dot, money, onCopy }: { row: DriverRow; dot: string; money: (cents: number) => string; onCopy: (id: string) => void }) {
  return <article className="flex flex-col gap-3 rounded-xl border bg-card p-3.5 shadow-xs transition-colors hover:border-foreground/20">
    <div className="flex items-start gap-3">
      <span className="relative shrink-0">
        <Monogram name={row.name} photo={driverPhoto(row.id)} className="size-10 text-xs" />
        <span className={cn("absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-card", dot)} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={row.href} className="truncate text-[13px] font-semibold hover:underline">{row.name}</Link>
          <button type="button" onClick={() => onCopy(row.id)} className="group/id inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-px font-mono text-[11px] text-muted-foreground hover:text-foreground" aria-label={`Copy the driver ID ${row.id}`}>
            {row.id}<CopyIcon className="size-2.5 opacity-60 group-hover/id:opacity-100" aria-hidden="true" />
          </button>
        </div>
        <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPinIcon className="size-3" aria-hidden="true" />Home base {row.homeCity}, {row.homeCountry}</span>
      </div>
      {row.current && <Link href={`/orders/${row.current.orderId}`} className="grid size-8 shrink-0 place-items-center rounded-full border text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`Open order ${row.current.reference}`} title={`Open ${row.current.reference}`}>
        <ArrowUpRightIcon className="size-4" aria-hidden="true" />
      </Link>}
    </div>
    {row.doing && <p className="text-[13px] text-foreground/85">{row.doing}</p>}
    {row.current && <Link href={`/orders/${row.current.orderId}`} className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs hover:bg-muted">
      <span className="shrink-0 font-mono whitespace-nowrap text-muted-foreground">{row.current.reference}</span>
      <span className="truncate font-medium">{row.current.vehicle}</span>
      <span className="ml-auto truncate text-muted-foreground">{row.current.from} → {row.current.to}</span>
    </Link>}
    <div className="flex flex-wrap gap-1.5">
      <Chip icon={PackageIcon} title="Orders in the snapshot">{row.orders}</Chip>
      <Chip icon={CheckIcon} title="Completed jobs">{row.completed}</Chip>
      {row.feeCents > 0 && <Chip icon={EuroIcon} title="Fees for jobs that are not cancelled">{money(row.feeCents)}</Chip>}
      {row.needPerson > 0 && <Chip icon={TriangleAlertIcon} title="Orders that need a person" className="text-warning">{row.needPerson}</Chip>}
    </div>
  </article>
}

function Chip({ icon: Icon, title, className, children }: { icon: LucideIcon; title: string; className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex h-6 items-center gap-1 rounded-full border px-2 font-mono text-[11px] tabular-nums", className)} title={title}>
    <Icon className="size-3" aria-hidden="true" />{children}
  </span>
}
