"use client"

import Link from "next/link"
import { use, useEffect, useState } from "react"
import { Building2Icon, SearchIcon, SearchXIcon, TriangleAlertIcon, UserRoundIcon, UsersIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Empty as EmptyState, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { EntityKind, EntityList, EntityView } from "@/lib/present/types"
import { AppFrame, type Section } from "./app-frame"
import { Card } from "./card"
import { Empty, FactList, Monogram, PageHeader } from "./ui"

const SECTION: Record<EntityKind, Section> = { driver: "drivers", customer: "customers", site: "sites" }
const INDEX: Record<EntityKind, { href: string; label: string; noun: string }> = {
  driver: { href: "/drivers", label: "Drivers", noun: "driver" },
  customer: { href: "/customers", label: "Customers", noun: "customer" },
  site: { href: "/sites", label: "Places", noun: "place" },
}

export function EntityPage({ kind, params }: { kind: EntityKind; params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [view, setView] = useState<EntityView | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/entities/${kind}/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error(response.status === 404 ? `${INDEX[kind].label.slice(0, -1)} not found` : "Could not load record"); return response.json() as Promise<EntityView> })
      .then((data) => { setView(data); setError("") })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load record") })
    return () => controller.abort()
  }, [kind, id])
  useEffect(() => { if (view) document.title = `${view.title} · Controlane` }, [view])
  const index = INDEX[kind]
  const LinkIcon = kind === "customer" ? Building2Icon : UsersIcon
  const KindGlyph = kind === "customer" ? UsersIcon : kind === "driver" ? UserRoundIcon : Building2Icon
  return <AppFrame section={SECTION[kind]} snapshotAt={view?.snapshotAt ?? null} crumbs={[{ label: view?.title ?? (error ? "Not found" : "Record") }]}>
    {error && <EmptyState className="flex-none border py-12" role="alert">
      <EmptyHeader>
        <EmptyMedia variant="icon"><TriangleAlertIcon aria-hidden="true" /></EmptyMedia>
        <EmptyTitle>{error}</EmptyTitle>
        <EmptyDescription>The record could not be opened. <Link href={index.href}>Back to {index.label.toLowerCase()}</Link></EmptyDescription>
      </EmptyHeader>
    </EmptyState>}
    {!error && !view && <div className="flex flex-col gap-3" aria-busy="true"><span className="sr-only">Loading…</span><Skeleton className="h-6 w-64" /><Skeleton className="h-32 w-full max-w-4xl" /></div>}
    {view && <div className="flex max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-card px-3 text-xs text-muted-foreground"><KindGlyph className="size-3.5" aria-hidden="true" />{view.kindLabel}</span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-card px-3 text-xs text-muted-foreground">Orders<span className="font-mono font-medium text-foreground tabular-nums">{view.cards.length}</span></span>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{view.title}</h1>
          {view.subtitle && <p className="text-[13px] text-muted-foreground">{view.subtitle}</p>}
        </div>
      </header>
      <section className="flex max-w-4xl flex-col gap-4 rounded-xl border bg-card p-4" aria-label="Details">
        <FactList facts={view.facts} />
        {view.notes.length > 0 && <div className="flex flex-col gap-1 border-t pt-3">{view.notes.map((note) => <p className="max-w-[70ch] text-[13px] text-muted-foreground" key={note}>{note}</p>)}</div>}
        {view.links.length > 0 && <div className="flex flex-wrap gap-2 border-t pt-3">{view.links.map((link) => <Button asChild variant="outline" size="sm" key={link.href}>
          <Link href={link.href} title={link.hint ?? undefined}><LinkIcon aria-hidden="true" />{link.label}</Link>
        </Button>)}</div>}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="flex items-baseline gap-2 text-sm font-semibold">Orders<span className="font-mono text-xs font-normal text-muted-foreground tabular-nums">{view.cards.length}</span></h2>
        {view.cards.length === 0 && <Empty>No order in this snapshot involves this {index.noun}.</Empty>}
        {view.cards.length > 0 && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{view.cards.map((card) => <Card key={card.id} card={card} role={view.roles[card.id] ?? null} />)}</div>}
      </section>
    </div>}
  </AppFrame>
}

export function EntityIndex({ kind }: { kind: EntityKind }) {
  const [list, setList] = useState<EntityList | null>(null)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/entities/${kind}`, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("Could not load the list"); return response.json() as Promise<EntityList> })
      .then((data) => { setList(data); setError("") })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load the list") })
    return () => controller.abort()
  }, [kind])
  const index = INDEX[kind]
  const needle = query.trim().toLowerCase()
  const items = (list?.items ?? []).filter((item) => !needle || item.title.toLowerCase().includes(needle) || (item.subtitle ?? "").toLowerCase().includes(needle))
  const involved = (list?.items ?? []).filter((item) => item.count > 0).length
  return <AppFrame section={SECTION[kind]}>
    <PageHeader title={index.label} description={list ? `${list.items.length} in the snapshot, ${involved} with at least one order.` : undefined}>
      <InputGroup className="w-full sm:w-64">
        <InputGroupAddon><SearchIcon aria-hidden="true" /></InputGroupAddon>
        <InputGroupInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Filter ${index.label.toLowerCase()}`} aria-label="Filter" />
      </InputGroup>
    </PageHeader>
    {error && <p className="text-sm text-danger" role="alert">{error}.</p>}
    {!list && !error && <Skeleton className="h-40 w-full" aria-label="Loading" />}
    {list && items.length === 0 && <EmptyState className="flex-none border py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon"><SearchXIcon aria-hidden="true" /></EmptyMedia>
        <EmptyTitle>Nothing matches “{query}”.</EmptyTitle>
        <EmptyDescription>Change the filter to see more {index.label.toLowerCase()}.</EmptyDescription>
      </EmptyHeader>
    </EmptyState>}
    {list && items.length > 0 && <Table aria-label={index.label}>
      <TableHeader>
        <TableRow>
          <TableHead scope="col" className="h-8">Name</TableHead>
          <TableHead scope="col" className="hidden h-8 md:table-cell">Details</TableHead>
          <TableHead scope="col" className="h-8 text-right">Orders</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{items.map((item) => <TableRow key={item.id}>
        <TableCell className="py-1.5 whitespace-normal">
          <span className="flex items-center gap-2.5">
            <Monogram name={item.title} />
            <span className="min-w-0">
              <Link href={item.href} className="font-medium underline-offset-4 hover:underline">{item.title}</Link>
              {item.subtitle && <span className="block text-xs text-muted-foreground md:hidden">{item.subtitle}</span>}
            </span>
          </span>
        </TableCell>
        <TableCell className="hidden py-1 text-muted-foreground md:table-cell">{item.subtitle}</TableCell>
        <TableCell className={item.count ? "py-1 text-right font-mono tabular-nums" : "py-1 text-right font-mono text-muted-foreground tabular-nums"}>{item.count ? `${item.count} ${item.count === 1 ? "order" : "orders"}` : "no orders"}</TableCell>
      </TableRow>)}</TableBody>
    </Table>}
  </AppFrame>
}
