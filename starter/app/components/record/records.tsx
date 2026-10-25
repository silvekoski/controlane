"use client"

import type { ReactNode } from "react"
import { ChevronRightIcon } from "@/components/icons"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { humanize } from "@/lib/present/labels"
import type { RecordView } from "@/lib/present/types"
import { OrderLinks, SectionHead } from "../ui"
import { CostsPanel, DriversPanel, FactsPanel, MarketPanel, TravelPanel, WorkPanel } from "./aside"
import { KindIcon } from "./bits"
import { EvidenceDetails, HistoryDays, ProposalCards, RouteDetails } from "./sections"

type Entry = { id: string; icon: string; title: string; sub: string; count: number | null; body: ReactNode }

function plural(count: number, noun: string, nouns = `${noun}s`): string {
  return `${count} ${count === 1 ? noun : nouns}`
}

/** Every linked record, folded away until someone opens it. */
export function RecordsPanel({ view, orderId }: { view: RecordView; orderId: string }) {
  const steps = view.journey.groups.reduce((sum, group) => sum + group.steps.length, 0)
  const openAlerts = view.alerts.filter((alert) => alert.status === "OPEN").length
  const openWork = view.workItems.filter((item) => item.status !== "DONE").length
  const entries: Entry[] = [
    { id: "facts", icon: "note", title: "Order facts", sub: "plate, VIN, model year, customer reference, status, created", count: null, body: <FactsPanel view={view} /> },
    { id: "route", icon: "pin", title: "Route details", sub: `${plural(steps, "stop")} with slots, contacts, access state, site procedures and proofs`, count: null, body: <RouteDetails view={view} /> },
    { id: "work", icon: "alert", title: "Alerts, work items and incidents", sub: [openAlerts ? plural(openAlerts, "open alert") : null, openWork ? plural(openWork, "open work item") : null, view.incidents.length ? plural(view.incidents.length, "incident") : null].filter(Boolean).join(" · ") || "nothing open", count: view.alerts.length + view.workItems.length + view.incidents.length, body: <WorkPanel view={view} /> },
    { id: "drivers", icon: "driver", title: "Drivers", sub: view.assignments.length ? view.assignments.map((assignment) => `${assignment.driver.name} (${assignment.statusLabel.toLowerCase()})`).join(", ") : "no assignment", count: view.assignments.length, body: <DriversPanel view={view} /> },
    { id: "market", icon: "offer", title: "Driver market", sub: view.offers.length ? view.offers.map((offer) => `${offer.statusLabel.toLowerCase()}${offer.fee ? ` ${offer.fee}` : ""}`).join(", ") : "no offer published", count: view.offers.length, body: <MarketPanel view={view} /> },
    { id: "travel", icon: "ferry", title: "Travel", sub: view.reservations.length || view.options.length ? [view.reservations.length ? plural(view.reservations.length, "booking") : null, view.options.length ? plural(view.options.length, "quote") : null].filter(Boolean).join(" · ") : "no booking or quote", count: view.reservations.length + view.options.length, body: <TravelPanel view={view} /> },
    { id: "costs", icon: "receipt", title: "Costs", sub: view.expenses.length ? ["APPROVED", "SUBMITTED", "REJECTED", "SUPERSEDED"].map((status) => [status, view.expenses.filter((expense) => expense.status === status).length] as const).filter(([, count]) => count).map(([status, count]) => `${count} ${status.toLowerCase()}`).join(" · ") : "no cost claim", count: view.expenses.length, body: <CostsPanel view={view} /> },
    { id: "evidence-details", icon: "photo", title: "Proofs, documents and custody", sub: `${plural(view.proofs.length, "proof")} · ${plural(view.documents.length, "document")}${view.custody.assets.length ? ` · ${plural(view.custody.assets.length, "tracked asset")}` : ""}${view.siteVisits.length ? ` · ${plural(view.siteVisits.length, "site visit")}` : ""}`, count: view.proofs.length + view.documents.length, body: <EvidenceDetails view={view} /> },
    { id: "proposals", icon: "proposal", title: "Earlier agent work and room activity", sub: view.proposals.length || view.notifications.length ? `${plural(view.proposals.length, "proposal")} with rationale, evidence and execution · ${plural(view.notifications.length, "room post")}` : "nothing recorded", count: view.proposals.length + view.notifications.length, body: <ProposalCards view={view} /> },
    { id: "events", icon: "history", title: "All events", sub: "the recorded history by day, with what each event changed", count: view.historyTotal, body: <HistoryDays view={view} /> },
  ]
  return <section className="flex scroll-mt-16 flex-col" id="records">
    <SectionHead title="Everything on this order" note={<>Folded away. Open what you need. The <a href={`/api/orders/${orderId}`} target="_blank" rel="noopener noreferrer">order API</a> has every field.</>} />
    <div className="flex flex-col divide-y rounded-xl border bg-card">{entries.map((entry) => <Collapsible key={entry.id} id={entry.id} className="group/rec scroll-mt-16">
      <CollapsibleTrigger className="flex w-full items-center gap-3 px-3 py-2.5 text-left outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset">
        <KindIcon name={entry.icon} className="size-4 text-muted-foreground" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] font-medium">{entry.title}</span>
          <span className="truncate text-xs text-muted-foreground">{entry.sub}</span>
        </span>
        {entry.count != null && entry.count > 0 && <span className="font-mono text-xs text-muted-foreground tabular-nums">{entry.count}</span>}
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/rec:rotate-90" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t bg-muted/10 px-3 pt-3 pb-4 sm:pl-10">{entry.body}</CollapsibleContent>
    </Collapsible>)}</div>
    {(view.inboxHints.length > 0 || view.otherRecords.length > 0) && <p className="mt-3 max-w-[80ch] text-xs text-muted-foreground">
      {view.inboxHints.map((hint) => <span key={hint.id}>Support inbox: {hint.stateLabel.toLowerCase()}{hint.confirmed ? "" : " (candidate, not a confirmed link)"}{hint.candidates.length ? <> among <OrderLinks orders={hint.candidates} /></> : ""}. </span>)}
      {view.otherRecords.length > 0 && <>Also linked in the API: {view.otherRecords.map((record) => `${humanize(record.collection).toLowerCase()} (${record.count})`).join(", ")}.</>}
    </p>}
  </section>
}
