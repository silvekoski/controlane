"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { CoinsIcon, EuroIcon, FilterIcon, PlaneIcon, ReceiptIcon, SearchIcon, TriangleAlertIcon, WalletIcon, type LucideIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Claim, FinanceView } from "@/lib/present/finance"
import { fmtDateTime, relativeTo } from "@/lib/present/time"
import { cn } from "@/lib/utils"
import { AppFrame } from "../components/app-frame"
import { useControl, type QueueView } from "../components/control"
import { Chip } from "../components/ui"

/* Finances: driver fees, open gigs, expense claims and Bahn-paid travel, with the money
   decisions that need a person first. The packet has no customer prices or invoices,
   so the page shows costs only. It only reads. Reviews and payments stay in their own tools. */

const euro = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
const euroExact = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 })
const eur = (cents: number) => euro.format(cents / 100)
const eurExact = (cents: number) => euroExact.format(cents / 100)
const GOOD = "text-[oklch(0.62_0.15_155)]"
const GOOD_BG = "bg-[oklch(0.62_0.15_155)]"

export default function FinancesPage() {
  const [data, setData] = useState<FinanceView | null>(null)
  const [error, setError] = useState("")
  const [onlyFlagged, setOnlyFlagged] = useState(false)
  const [query, setQuery] = useState("")
  const control = useControl<QueueView>("view=queue")

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/finance", { signal: controller.signal })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Could not load finances"); setData(body as FinanceView) })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load finances") })
    return () => controller.abort()
  }, [])

  // Cost changes the agent proposed: open ones need a person, decided ones show what ran.
  const agentCosts = useMemo(() => [...(control.data?.open ?? []), ...(control.data?.decided ?? [])].filter((card) => card.proposal?.costDelta), [control.data])
  const flagged = data?.waiting.filter((claim) => claim.flags.some((flag) => flag.tone !== "neutral")) ?? []
  const needle = query.trim().toLowerCase()
  const claims = (onlyFlagged ? flagged : data?.waiting ?? []).filter((claim) => !needle || [claim.kindLabel, claim.merchant, claim.driver?.name, claim.order?.reference].some((value) => value?.toLowerCase().includes(needle)))
  const oldest = data?.waiting[0] ? relativeTo(data.waiting[0].submittedAt, data.snapshotAt) : null
  const payoutsDue = data?.payouts.filter((payout) => payout.decision === "PAYOUT_DUE") ?? []
  const openAgentCosts = agentCosts.filter((card) => card.status === "new" || card.status === "changed")
  const decidedAgentCosts = agentCosts.filter((card) => card.status !== "new" && card.status !== "changed")
  const toDecide = flagged.length + payoutsDue.length + (data?.emptyPickups.length ?? 0) + openAgentCosts.length

  return <AppFrame section="finances" snapshotAt={data?.snapshotAt ?? null}>
    <div className="flex max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Finances</h1>
        <p className="text-[13px] text-muted-foreground">Driver pay, open gigs, expense claims and travel that Bahn paid, at the snapshot time. The packet has no customer prices or invoices, so this page shows costs, not revenue or margin.</p>
      </header>
      {error && <p className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert"><TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{error}. Check that the local database is running and seeded.</p>}
      {!data && !error && <div className="grid gap-5 lg:grid-cols-3" aria-busy="true">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-96 rounded-2xl" />)}</div>}
      {data && <>
        <div className="grid items-stretch gap-5 lg:grid-cols-2 xl:grid-cols-[1fr_1.15fr_1fr]">
          {/* Driver fees: the "total balance" of this page, with fees by route as its sub-wallets. */}
          <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5" aria-label="Driver fees booked">
            <div className="flex flex-col gap-1">
              <h2 className="text-[13px] text-muted-foreground">Driver fees booked</h2>
              <span className="font-mono text-4xl font-semibold tracking-tight tabular-nums">{eur(data.totals.feesBookedCents)}</span>
              <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-foreground tabular-nums">{data.totals.assignments} gigs</span>
                {eur(data.totals.feesDoneCents)} for completed ones
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button asChild size="lg" className="h-11"><a href="#claims"><ReceiptIcon data-icon="inline-start" aria-hidden="true" />Review claims</a></Button>
              <Button asChild size="lg" variant="outline" className="h-11"><a href="#open-gigs"><CoinsIcon data-icon="inline-start" aria-hidden="true" />Open gigs</a></Button>
            </div>
            <div className="mt-auto flex flex-col gap-3 rounded-xl bg-muted/50 p-3">
              <h3 className="text-[13px]"><span className="font-medium">Fees by route</span><span className="text-muted-foreground"> · {data.byRoute.length} routes</span></h3>
              <ul className="grid grid-cols-2 gap-2">
                {data.byRoute.map((route) => <li key={route.route} className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-card p-3 shadow-xs">
                  <span className="text-xs font-medium">{route.label}</span>
                  <span className="font-mono text-base font-semibold tabular-nums">{eur(route.totalCents)}</span>
                  <span className="text-[11px] text-muted-foreground">{route.count} gigs · average {eur(route.averageCents)}</span>
                  <span className="text-[11px] text-primary">{Math.round((route.totalCents / Math.max(1, data.totals.feesBookedCents)) * 100)}% of fees</span>
                </li>)}
              </ul>
              {data.byRoute.length > 1 && <p className="text-xs text-muted-foreground">An import gig pays about {Math.round((data.byRoute.find((r) => r.route === "IMPORT")?.averageCents ?? 0) / Math.max(1, data.byRoute.find((r) => r.route === "DOMESTIC")?.averageCents ?? 1))} times a domestic gig. Chained gigs cut the empty travel back home.</p>}
            </div>
          </section>

          {/* Four stat tiles. The accent tile is the money still on the market. */}
          <section className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-3" aria-label="Totals">
            <Stat accent icon={CoinsIcon} label="Open gigs on the market" value={eur(data.totals.openOffersCents)} chip={`${data.totals.openOffers} gigs`} note="no driver took yet" />
            <Stat icon={ReceiptIcon} label="Claims waiting for review" value={eur(data.totals.claimsWaitingCents)} chip={`${data.totals.claimsWaiting} claims`} note={oldest ? `oldest ${oldest.text}` : "waiting"} tone={data.totals.claimsWaiting ? "warn" : undefined} />
            <Stat icon={WalletIcon} label="Claims approved" value={eur(data.totals.claimsApprovedCents)} chip={`${eur(data.totals.claimsRejectedCents)} rejected`} note="A person accepted them. The money did not always move." />
            <Stat icon={PlaneIcon} label="Travel paid by Bahn" value={eur(data.totals.bahnTravelCents)} chip={`${data.totals.bahnTravel} flights`} note="for cross-border drivers" />
          </section>

          <ClaimsByKind rows={data.byKind} />
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-3">
          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5" aria-label="Fees for completed gigs">
              <h2 className="text-base font-semibold">Fees for completed gigs</h2>
              <div className="h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={data.totals.feesBookedCents} aria-valuenow={data.totals.feesDoneCents} aria-label="Fees for completed gigs out of all booked fees">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(data.totals.feesDoneCents / Math.max(1, data.totals.feesBookedCents)) * 100}%` }} />
              </div>
              <p className="flex items-baseline gap-1.5 text-xs text-muted-foreground"><span className="font-mono text-sm font-semibold text-foreground tabular-nums">{eur(data.totals.feesDoneCents)}</span>done out of<span className="ml-auto font-mono text-sm text-foreground tabular-nums">{eur(data.totals.feesBookedCents)}</span></p>
            </section>

            <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5" aria-label="Money decisions for a person">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-muted"><EuroIcon className="size-5" aria-hidden="true" /></span>
                <h2 className="text-base font-semibold">Money decisions for a person</h2>
                {toDecide > 0 && <span className="ml-auto rounded-full bg-muted px-2 py-0.5 font-mono text-xs tabular-nums">{toDecide}</span>}
              </div>
              {openAgentCosts.length > 0 && <Block title="Cost changes the agent proposed" note="Approve or reject each one on its decision card.">
                {openAgentCosts.map((card) => <Line key={card.id} href={`/decisions/${card.id}`} reference={card.orderRef} amount={`+${eur((card.proposal.costDelta ?? 0) * 100)}`} text={card.proposal.description} meta={card.left.text} />)}
              </Block>}
              {payoutsDue.length > 0 && <Block title="Pay a driver for a cancelled gig" note="The cancellation records that a payout is due.">
                {payoutsDue.map((payout) => <Line key={payout.id} href={payout.order ? `/orders/${payout.order.id}` : undefined} reference={payout.order?.reference ?? "No order"} amount={eurExact(payout.feeCents)} text={`${payout.driver?.name ?? "Unknown driver"}: ${payout.reason}`} meta={payout.cancelledAt ? relativeTo(payout.cancelledAt, data.snapshotAt)?.text ?? "" : ""} />)}
              </Block>}
              {data.emptyPickups.length > 0 && <Block title="Invoice an empty pickup fee?" note="When the car cannot leave because of the customer, Bahn usually invoices about half of the transport price. A person decides.">
                {data.emptyPickups.map((incident) => <Line key={incident.id} href={incident.order ? `/orders/${incident.order.id}` : undefined} reference={incident.order?.reference ?? "No order"} text={`Empty pickup, ${incident.status.toLowerCase()}`} meta={relativeTo(incident.openedAt, data.snapshotAt)?.text ?? ""} />)}
              </Block>}
              {flagged.length > 0 && <p className="text-xs text-muted-foreground">Also {flagged.length} expense claims with a problem. See the claims table.</p>}
            </section>
          </div>

          <section id="claims" className="flex min-w-0 scroll-mt-4 flex-col gap-4 rounded-2xl border bg-card p-5 xl:col-span-2" aria-label="Expense claims to review">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-0 flex-col">
                <h2 className="text-lg font-semibold">Expense claims to review</h2>
                <span className="text-xs text-muted-foreground">Oldest first: a driver waits for this money.</span>
              </div>
              <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl bg-muted/50 px-3 text-[13px] sm:w-56 sm:flex-none">
                  <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search claims" aria-label="Search claims by cost, driver or order" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" />
                </label>
                <label className={cn("flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-muted/50 px-3 text-[13px]", onlyFlagged && "bg-primary/10 text-primary")}>
                  <FilterIcon className="size-4" aria-hidden="true" />
                  <input type="checkbox" className="size-3.5 accent-primary" checked={onlyFlagged} onChange={(event) => setOnlyFlagged(event.target.checked)} />Only claims with a problem <span className="font-mono">{flagged.length}</span>
                </label>
              </div>
            </div>
            <div className="max-h-[38rem] overflow-y-auto rounded-xl bg-muted/30">
              {claims.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">{needle ? "No claim matches the search." : onlyFlagged ? "No waiting claim has a problem." : "No claims wait for review."}</p> : <Table>
                <TableHeader><TableRow className="sticky top-0 z-10 bg-muted hover:bg-muted">
                  <TableHead className="pl-4">Order</TableHead><TableHead>Cost</TableHead><TableHead>Driver</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Check</TableHead><TableHead className="pr-4">Submitted</TableHead>
                </TableRow></TableHeader>
                <TableBody>{claims.map((claim) => <ClaimRow key={claim.id} claim={claim} snapshotAt={data.snapshotAt} />)}</TableBody>
              </Table>}
            </div>
            <p className="text-xs text-muted-foreground">Read only. Approve or reject claims in the expense tool.</p>
          </section>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-2">
          {data.openOffers.length > 0 && <section id="open-gigs" className="flex scroll-mt-4 flex-col gap-3 rounded-2xl border bg-card p-5" aria-label="Open gigs">
            <h2 className="flex items-baseline gap-2 text-base font-semibold">Open gigs, highest fee first<span className="font-mono text-xs font-normal text-muted-foreground tabular-nums">{data.openOffers.length}</span></h2>
            <ul className="flex flex-col gap-1.5">{data.openOffers.slice(0, 6).map((offer) => <li key={offer.id}>
              {offer.order ? <Link href={`/orders/${offer.order.id}`} className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5 text-[13px] hover:bg-muted"><span className="font-mono text-xs">{offer.order.reference}</span><span className="text-muted-foreground">{offer.type}</span><span className="ml-auto font-mono tabular-nums">{eur(offer.feeCents)}</span></Link>
                : <span className="flex rounded-lg bg-muted/50 px-3 py-2.5 text-[13px]">{offer.type}<span className="ml-auto font-mono">{eur(offer.feeCents)}</span></span>}
            </li>)}</ul>
          </section>}

          {decidedAgentCosts.length > 0 && <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5" aria-label="Cost changes already decided">
            <h2 className="flex items-baseline gap-2 text-base font-semibold">Cost changes already decided<span className="ml-auto text-xs font-normal text-muted-foreground">From the control room agent</span></h2>
            <ul className="flex flex-col gap-1.5">{decidedAgentCosts.map((card) => <li key={card.id}>
              <Link href={`/decisions/${card.id}`} className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5 text-[13px] hover:bg-muted">
                <span className="font-mono text-xs">{card.orderRef}</span>
                <Chip tone="neutral">{card.status === "rejected" ? "Rejected" : card.escalation.level === "agent" ? "Agent acted alone" : "Approved"}</Chip>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{card.decidedBy}</span>
                <span className={cn("font-mono tabular-nums", card.status === "rejected" && "text-muted-foreground line-through")}>+{eur((card.proposal.costDelta ?? 0) * 100)}</span>
              </Link>
            </li>)}</ul>
          </section>}
        </div>
      </>}
    </div>
  </AppFrame>
}

function Stat({ icon: Icon, label, value, chip, note, tone, accent }: { icon: LucideIcon; label: string; value: string; chip: string; note: string; tone?: "warn"; accent?: boolean }) {
  return <div className={cn("flex min-w-0 flex-col gap-3 rounded-xl p-4", accent ? "bg-primary text-primary-foreground" : "bg-muted/50")}>
    <div className="flex items-start justify-between gap-2">
      <span className={cn("text-[13px] leading-snug", accent ? "text-primary-foreground/85" : "text-muted-foreground")}>{label}</span>
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", accent ? "bg-primary-foreground/15" : "bg-card shadow-xs")}><Icon className="size-4" aria-hidden="true" /></span>
    </div>
    <span className={cn("mt-auto font-mono text-2xl font-semibold tracking-tight tabular-nums", tone === "warn" && "text-warning")}>{value}</span>
    <span className={cn("flex flex-wrap items-center gap-1.5 text-[11px] leading-snug", accent ? "text-primary-foreground/85" : "text-muted-foreground")}>
      <span className={cn("rounded-md px-1.5 py-0.5 font-mono tabular-nums", accent ? "bg-primary-foreground/15 text-primary-foreground" : "bg-card text-foreground")}>{chip}</span>{note}
    </span>
  </div>
}

function Block({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5 rounded-xl bg-muted/50 p-3">
    <div className="flex flex-col gap-0.5 px-1"><h3 className="text-[13px] font-medium">{title}</h3><p className="text-xs text-muted-foreground">{note}</p></div>
    <ul className="flex flex-col gap-1">{children}</ul>
  </div>
}

function Line({ href, reference, amount, text, meta }: { href?: string; reference: string; amount?: string; text: string; meta: string }) {
  const body = <>
    <span className="flex items-baseline gap-2"><span className="font-mono text-xs">{reference}</span>{meta && <span className="text-xs text-muted-foreground">{meta}</span>}{amount && <span className="ml-auto font-mono font-semibold tabular-nums">{amount}</span>}</span>
    <span className="text-muted-foreground">{text}</span>
  </>
  return <li>
    {href ? <Link href={href} className="flex flex-col gap-1 rounded-lg bg-card px-3 py-2 text-[13px] shadow-xs hover:bg-accent/60">{body}</Link> : <span className="flex flex-col gap-1 rounded-lg bg-card px-3 py-2 text-[13px] shadow-xs">{body}</span>}
  </li>
}

const DOT = { danger: "bg-danger", warn: "bg-warning", neutral: "bg-muted-foreground" } as const

function ClaimRow({ claim, snapshotAt }: { claim: Claim; snapshotAt: string | null }) {
  return <TableRow>
    <TableCell className="pl-4">{claim.order ? <Link href={`/orders/${claim.order.id}`} className="font-mono text-xs underline-offset-4 hover:underline">{claim.order.reference}</Link> : "–"}</TableCell>
    <TableCell className="text-[13px]">{claim.kindLabel}{claim.merchant && <span className="block text-xs text-muted-foreground">{claim.merchant}{claim.country ? `, ${claim.country}` : ""}</span>}</TableCell>
    <TableCell className="text-[13px]">{claim.payer === "BAHN" ? <span className="text-muted-foreground">Paid by Bahn</span> : claim.driver ? <Link href={`/drivers/${claim.driver.id}`} className="underline-offset-4 hover:underline">{claim.driver.name}</Link> : "–"}</TableCell>
    <TableCell className="text-right font-mono text-[13px] tabular-nums">{eurExact(claim.amountCents)}</TableCell>
    <TableCell className="min-w-40 max-w-72 whitespace-normal">
      {claim.flags.length ? <ul className="flex flex-col gap-0.5">{claim.flags.map((flag) => <li key={flag.text} className={cn("flex items-baseline gap-1.5 text-xs", flag.tone === "danger" ? "text-danger" : flag.tone === "warn" ? "text-warning" : "text-muted-foreground")}><span className={cn("size-1.5 shrink-0 translate-y-[-1px] rounded-full", DOT[flag.tone])} aria-hidden="true" />{flag.text}</li>)}</ul>
        : <span className="flex items-baseline gap-1.5 text-xs"><span className={cn("size-1.5 shrink-0 translate-y-[-1px] rounded-full", GOOD_BG)} aria-hidden="true" /><span className={GOOD}>{claim.receipts === 1 ? "1 receipt" : `${claim.receipts} receipts`}</span></span>}
    </TableCell>
    <TableCell className="min-w-24 pr-4 text-xs whitespace-normal" title={claim.submittedAt ? fmtDateTime(claim.submittedAt) : undefined}>{claim.submittedAt ? fmtDateTime(claim.submittedAt) : "–"}<span className="block text-muted-foreground">{relativeTo(claim.submittedAt, snapshotAt)?.text ?? ""}</span></TableCell>
  </TableRow>
}

const SERIES = [
  { key: "approved", label: "Approved", className: "bg-primary" },
  { key: "submitted", label: "Waiting for review", className: "bg-[var(--chart-2)]" },
  { key: "rejected", label: "Rejected", className: "bg-muted-foreground/40" },
] as const

/** Claims by cost type: one stacked column each, with a 2 px gap between parts and a tooltip on each part. */
function ClaimsByKind({ rows }: { rows: FinanceView["byKind"] }) {
  const max = Math.max(...rows.map((row) => row.approved + row.submitted + row.rejected), 1)
  const step = max > 200000 ? 100000 : 50000
  const top = Math.ceil(max / step) * step
  const ticks = Array.from({ length: top / step + 1 }, (_, index) => top - index * step)
  return <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 lg:col-span-2 xl:col-span-1" aria-label="Expense claims by cost type">
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Expense claims</h2>
      <p className="text-[13px] text-muted-foreground">All claims by cost type and review status.</p>
    </div>
    <div className="flex flex-1 flex-col gap-3 rounded-xl bg-muted/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-medium">By cost type</h3>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-label="Legend">
          {SERIES.map((series) => <li key={series.key} className="flex items-center gap-1.5"><span className={cn("size-2.5 rounded-xs", series.className)} aria-hidden="true" />{series.label}</li>)}
        </ul>
      </div>
      <div className="grid flex-1 grid-cols-[auto_minmax(0,1fr)] gap-x-2">
        <ul className="flex h-56 flex-col justify-between font-mono text-[10px] text-muted-foreground tabular-nums" aria-hidden="true">
          {ticks.map((tick) => <li key={tick} className="leading-none">{eur(tick)}</li>)}
        </ul>
        <ul className="relative flex h-56 items-end justify-between gap-1.5">
          {ticks.map((tick) => <li key={tick} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted-foreground/15" style={{ bottom: `${(tick / top) * 100}%` }} aria-hidden="true" />)}
          {rows.map((row) => {
            const total = row.approved + row.submitted + row.rejected
            return <li key={row.kind} className="relative flex h-full min-w-0 flex-1 flex-col justify-end">
              <span className="mx-auto flex w-full max-w-7 flex-col-reverse gap-0.5" style={{ height: `${(total / top) * 100}%` }}>
                {SERIES.map((series) => row[series.key] > 0 && <Tooltip key={series.key}>
                  <TooltipTrigger asChild>
                    <span className={cn("min-h-1 w-full first:rounded-b-[5px] last:rounded-t-[5px]", series.className)} style={{ flexGrow: row[series.key] }} aria-label={`${row.label}, ${series.label}: ${eur(row[series.key])}`} />
                  </TooltipTrigger>
                  <TooltipContent>{row.label} · {series.label}: {eurExact(row[series.key])} · total {eur(total)}</TooltipContent>
                </Tooltip>)}
              </span>
            </li>
          })}
        </ul>
        <span aria-hidden="true" />
        <ul className="mt-1.5 flex justify-between gap-1.5 text-[10px] text-muted-foreground">
          {rows.map((row) => <li key={row.kind} className="min-w-0 flex-1 truncate text-center" title={`${row.label}: ${eur(row.approved + row.submitted + row.rejected)}`}>{row.label.split(",")[0]}</li>)}
        </ul>
      </div>
    </div>
  </section>
}
