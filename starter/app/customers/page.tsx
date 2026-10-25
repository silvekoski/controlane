"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, CircleCheckIcon, CircleMinusIcon, CopyIcon, EuroIcon, PackageIcon, SearchIcon,
  TriangleAlertIcon, UsersIcon, type LucideIcon,
} from "@/components/icons"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fmtDay, fmtMoney } from "@/lib/present/time"
import type { CustomerList, CustomerRow } from "@/lib/present/types"
import { cn } from "@/lib/utils"
import { AppFrame } from "../components/app-frame"
import { Monogram } from "../components/ui"

type View = "all" | "open" | "attention"
type SortKey = "id" | "name" | "orders" | "open" | "fees" | "avg" | "status" | "last"

const avgFee = (row: CustomerRow) => row.pricedOrders ? row.feeCents / row.pricedOrders : 0
const SORT: Record<SortKey, (row: CustomerRow) => number | string> = {
  id: (row) => row.id, name: (row) => row.name, orders: (row) => row.orders, open: (row) => row.open,
  fees: (row) => row.feeCents, avg: avgFee, status: (row) => row.open > 0 ? 1 : 0, last: (row) => row.lastOrderAt ?? "",
}

export default function CustomersPage() {
  const router = useRouter()
  const [list, setList] = useState<CustomerList | null>(null)
  const [view, setView] = useState<View>("all")
  const [query, setQuery] = useState("")
  const [tier, setTier] = useState("all")
  const [country, setCountry] = useState("all")
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "orders", desc: true })

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/customers", { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("Could not load customers"); return response.json() as Promise<CustomerList> })
      .then(setList)
      .catch((cause: unknown) => { if (!controller.signal.aborted) toast.error(cause instanceof Error ? cause.message : "Could not load customers", { description: "Check that the local database is running and seeded." }) })
    return () => controller.abort()
  }, [])

  const rows = list?.rows ?? []
  const tiers = useMemo(() => [...new Map(rows.map((row) => [row.tier, row.tierLabel])).entries()], [rows])
  const countries = useMemo(() => [...new Set(rows.map((row) => row.country))].sort(), [rows])
  const counts = { all: rows.length, open: rows.filter((row) => row.open > 0).length, attention: rows.filter((row) => row.needPerson > 0).length }
  const needle = query.trim().toLowerCase()
  const shown = rows
    .filter((row) => view === "all" || (view === "open" ? row.open > 0 : row.needPerson > 0))
    .filter((row) => (tier === "all" || row.tier === tier) && (country === "all" || row.country === country))
    .filter((row) => !needle || row.name.toLowerCase().includes(needle) || row.id.includes(needle))
    .sort((a, b) => {
      const x = SORT[sort.key](a), y = SORT[sort.key](b)
      const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))
      return (sort.desc ? -order : order) || a.name.localeCompare(b.name)
    })

  const money = (cents: number) => fmtMoney(Math.round(cents), list?.currency ?? "EUR")
  const copy = (id: string) => {
    navigator.clipboard.writeText(id).then(() => toast.success(`Copied ${id}`, { description: "The customer ID is on your clipboard." }), () => toast.error("Could not copy the customer ID"))
  }
  const sortBy = (key: SortKey) => setSort((current) => ({ key, desc: current.key === key ? !current.desc : key !== "name" && key !== "id" }))

  const totalFees = rows.reduce((sum, row) => sum + row.feeCents, 0)
  const newOrders = list?.ordersPerDay.reduce((sum, value) => sum + value, 0) ?? 0
  const feesTwoWeeks = list?.feesPerDay.reduce((sum, value) => sum + value, 0) ?? 0

  return <AppFrame section="customers" snapshotAt={list?.snapshotAt ?? null}>
    <div className="flex max-w-7xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-[13px] text-muted-foreground">Dealers and buyers in the snapshot, with their orders and the driver fees they caused.</p>
        </div>
      </header>

      <section className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card md:grid-cols-5 md:divide-x" aria-label="Key numbers">
        {!list ? [0, 1, 2, 3, 4].map((index) => <div key={index} className="p-4"><Skeleton className="h-12 w-full" /></div>) : <>
          <Kpi icon={UsersIcon} label="Customers" value={String(rows.length)} note={`${rows.filter((row) => row.tier === "key").length} key accounts`} />
          <Kpi icon={CircleCheckIcon} label="With open orders" value={String(counts.open)} note={`${Math.round(counts.open / Math.max(1, rows.length) * 100)}% of customers`} />
          <Kpi icon={TriangleAlertIcon} label="Need a person" value={String(counts.attention)} note="customers with waiting work" tone="warn" />
          <Kpi icon={PackageIcon} label="New orders, 14 days" value={String(newOrders)} spark={list.ordersPerDay} sparkLabel="New orders per day" />
          <Kpi icon={EuroIcon} label="Driver fees, 14 days" value={money(feesTwoWeeks)} spark={list.feesPerDay} sparkLabel="Driver fees per day" format={money} note={`${money(totalFees)} in the snapshot`} />
        </>}
      </section>

      <div className="flex flex-col">
        <div className="flex flex-wrap items-center gap-1 border-b" role="tablist" aria-label="Customer views">
          {([["all", "All customers"], ["open", "Open orders"], ["attention", "Need a person"]] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => setView(key)}
            className={cn("-mb-px flex h-10 items-center gap-1.5 border-b-2 border-transparent px-2.5 text-[13px] text-muted-foreground hover:text-foreground", view === key && "border-primary font-medium text-foreground")}>
            {label}<span className="rounded bg-muted px-1.5 font-mono text-[11px] tabular-nums">{counts[key]}</span>
          </button>)}
        </div>
        <div className="flex flex-wrap items-center gap-2 py-3">
          <InputGroup className="h-8 w-full sm:w-64">
            <InputGroupAddon><SearchIcon className="size-3.5" aria-hidden="true" /></InputGroupAddon>
            <InputGroupInput className="text-[13px]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or ID" aria-label="Search customers" />
          </InputGroup>
          <Select value={tier} onValueChange={setTier}>
            <SelectTrigger size="sm" className="w-44 text-[13px]" aria-label="Account tier"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All account tiers</SelectItem>{tiers.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger size="sm" className="w-36 text-[13px]" aria-label="Country"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All countries</SelectItem>{countries.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}</SelectContent>
          </Select>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">{shown.length} of {rows.length} customers</span>
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <Table className="text-[13px]">
            <TableHeader className="bg-muted/60">
              <TableRow className="hover:bg-transparent">
                <SortHead label="Customer ID" sortKey="id" sort={sort} onSort={sortBy} className="pl-4" />
                <SortHead label="Name" sortKey="name" sort={sort} onSort={sortBy} />
                <SortHead label="Orders" sortKey="orders" sort={sort} onSort={sortBy} right />
                <SortHead label="Open" sortKey="open" sort={sort} onSort={sortBy} right />
                <SortHead label="Driver fees" sortKey="fees" sort={sort} onSort={sortBy} right />
                <SortHead label="Avg. fee" sortKey="avg" sort={sort} onSort={sortBy} right />
                <SortHead label="Status" sortKey="status" sort={sort} onSort={sortBy} />
                <SortHead label="Last order" sortKey="last" sort={sort} onSort={sortBy} className="pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!list && [0, 1, 2, 3, 4, 5].map((index) => <TableRow key={index}><TableCell colSpan={8} className="px-4 py-3"><Skeleton className="h-5 w-full" /></TableCell></TableRow>)}
              {shown.map((row) => <TableRow key={row.id} className="cursor-pointer" onClick={() => router.push(row.href)}>
                <TableCell className="py-3 pl-4">
                  <button type="button" onClick={(event) => { event.stopPropagation(); copy(row.id) }} className="group/id inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground" aria-label={`Copy the customer ID ${row.id}`}>
                    {row.id}<CopyIcon className="size-3 opacity-0 group-hover/id:opacity-100" aria-hidden="true" />
                  </button>
                </TableCell>
                <TableCell className="py-3">
                  <span className="flex items-center gap-2.5">
                    <Monogram name={row.name} className="size-7 text-[10px]" />
                    <span className="min-w-0">
                      <Link href={row.href} onClick={(event) => event.stopPropagation()} className="block truncate font-medium hover:underline">{row.name}</Link>
                      <span className="block text-xs text-muted-foreground">{row.tierLabel} · {row.country}{row.importBuyer ? " · import buyer" : ""}</span>
                    </span>
                  </span>
                </TableCell>
                <TableCell className="py-3 text-right font-mono tabular-nums">{row.orders}</TableCell>
                <TableCell className="py-3 text-right font-mono tabular-nums">{row.open || <span className="text-muted-foreground">0</span>}</TableCell>
                <TableCell className="py-3 text-right font-mono tabular-nums">{row.pricedOrders ? money(row.feeCents) : <span className="text-muted-foreground">No fee yet</span>}</TableCell>
                <TableCell className="py-3 text-right font-mono tabular-nums">{row.pricedOrders ? money(avgFee(row)) : <span className="text-muted-foreground">–</span>}</TableCell>
                <TableCell className="py-3">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {row.open > 0
                      ? <span className="inline-flex items-center gap-1 rounded-md bg-[oklch(0.72_0.15_155)]/12 px-1.5 py-0.5 text-xs text-[oklch(0.5_0.13_155)] dark:text-[oklch(0.78_0.14_155)]"><CircleCheckIcon className="size-3.5" aria-hidden="true" />Open orders</span>
                      : <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"><CircleMinusIcon className="size-3.5" aria-hidden="true" />No open orders</span>}
                    {row.needPerson > 0 && <span className="inline-flex items-center gap-1 rounded-md bg-warning/12 px-1.5 py-0.5 text-xs text-warning" title={`${row.needPerson} orders need a person`}><TriangleAlertIcon className="size-3" aria-hidden="true" />{row.needPerson}</span>}
                  </span>
                </TableCell>
                <TableCell className="py-3 pr-4 tabular-nums">{row.lastOrderAt ? fmtDay(row.lastOrderAt) : <span className="text-muted-foreground">No orders</span>}</TableCell>
              </TableRow>)}
              {list && shown.length === 0 && <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No customer matches these filters.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  </AppFrame>
}

function SortHead({ label, sortKey, sort, onSort, right = false, className }: {
  label: string; sortKey: SortKey; sort: { key: SortKey; desc: boolean }; onSort: (key: SortKey) => void; right?: boolean; className?: string
}) {
  const active = sort.key === sortKey
  const Icon = !active ? ArrowUpDownIcon : sort.desc ? ArrowDownIcon : ArrowUpIcon
  return <TableHead className={cn("h-10", right && "text-right", className)} aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}>
    <button type="button" onClick={() => onSort(sortKey)} className={cn("inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground", active && "text-foreground")}>
      {label}<Icon className={cn("size-3", !active && "opacity-50")} aria-hidden="true" />
    </button>
  </TableHead>
}

/** One key number, with an optional trend line for the last 14 days. */
function Kpi({ icon: Icon, label, value, note, spark, sparkLabel, format, tone }: {
  icon: LucideIcon; label: string; value: string; note?: string; spark?: number[]; sparkLabel?: string; format?: (value: number) => string; tone?: "warn"
}) {
  return <div className="flex min-w-0 flex-col gap-2 border-b p-4 md:border-b-0">
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="size-3.5" aria-hidden="true" />{label}</span>
    <span className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
      <span className={cn("font-mono text-xl font-semibold tracking-tight tabular-nums", tone === "warn" && "text-warning")}>{value}</span>
      {spark && <Sparkline values={spark} label={sparkLabel ?? label} format={format} />}
    </span>
    {note && <span className="truncate text-xs text-muted-foreground">{note}</span>}
  </div>
}

/** A single-series line. Each day has a hover target with its value. */
function Sparkline({ values, label, format = String }: { values: number[]; label: string; format?: (value: number) => string }) {
  const width = 88, height = 26, max = Math.max(...values, 1)
  const x = (index: number) => index / Math.max(1, values.length - 1) * width
  const y = (value: number) => height - 2 - value / max * (height - 4)
  const points = values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ")
  return <svg viewBox={`0 0 ${width} ${height}`} className="h-6 w-[88px] shrink-0 overflow-visible text-chart-1" role="img" aria-label={`${label}, last 14 days: ${values.map(format).join(", ")}`}>
    <polyline points={`0,${height} ${points} ${width},${height}`} fill="currentColor" opacity="0.12" stroke="none" />
    <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    {values.map((value, index) => <rect key={index} x={x(index) - width / values.length / 2} y="0" width={width / values.length} height={height} fill="transparent" className="peer">
      <title>{`${14 - index === 1 ? "Snapshot day" : `${14 - index - 1} days before`}: ${format(value)}`}</title>
    </rect>)}
  </svg>
}
