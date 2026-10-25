"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { CheckIcon, ChevronRightIcon } from "@/components/icons"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { fmtDateTime, fmtLong, fmtRange, relativeTo } from "@/lib/present/time"
import type { Actor, Fact, OrderRef, Tone } from "@/lib/present/types"
import { cn } from "@/lib/utils"

/* Tones: amber (warning) for what needs a person, red for danger, outline for the rest. Words carry the status, not colour alone. */
export const TONE_BADGE: Record<Tone, string> = {
  danger: "border-danger/40 bg-danger/15 text-danger",
  warn: "border-warning/40 bg-warning/15 text-warning",
  accent: "border-border bg-transparent text-foreground",
  ok: "border-border bg-transparent text-muted-foreground",
  neutral: "border-transparent bg-secondary text-secondary-foreground",
}

export const TONE_TEXT: Record<Tone, string> = {
  danger: "text-danger",
  warn: "text-warning",
  accent: "text-foreground",
  ok: "text-muted-foreground",
  neutral: "text-muted-foreground",
}

export function Chip({ tone = "neutral", children, dot = false, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return <Badge variant="outline" className={cn("font-normal", TONE_BADGE[tone], className)}>
    {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}{children}
  </Badge>
}

export function PageHeader({ title, description, children }: { title: string; description?: ReactNode; children?: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
    <div className="flex flex-col">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
    </div>
    {children && <div className="flex items-center gap-2">{children}</div>}
  </div>
}

/** A timestamp in the record's zone, with the full UTC time on hover. */
export function When({ at, zone, snapshotAt, relative = false, withZone = true }: { at: string | null | undefined; zone?: string | null; snapshotAt?: string | null; relative?: boolean; withZone?: boolean }) {
  if (!at) return null
  const rel = relative ? relativeTo(at, snapshotAt) : null
  return <time dateTime={at} title={fmtLong(at)} className="tabular-nums">{fmtDateTime(at, zone, withZone)}{rel ? ` (${rel.text})` : ""}</time>
}

export function Range({ start, end, zone }: { start: string | null | undefined; end: string | null | undefined; zone?: string | null }) {
  if (!start) return null
  return <time dateTime={start} title={`${fmtLong(start)}${end ? ` to ${fmtLong(end)}` : ""}`} className="tabular-nums">{end ? fmtRange(start, end, zone) : fmtDateTime(start, zone)}</time>
}

/** Where a person or place has its own page. Operators and agents are roles, not records. */
export function actorHref(actor: Actor): string | null {
  if (!actor.id) return null
  if (actor.kind === "driver") return `/drivers/${actor.id}`
  if (actor.kind === "customer") return `/customers/${actor.id}`
  if (actor.kind === "site_contact") return `/sites/${actor.id}`
  return null
}

const nameLink = "underline decoration-border underline-offset-4 hover:decoration-foreground"

export function ActorName({ actor }: { actor: Actor }) {
  const href = actorHref(actor)
  return href ? <Link className={nameLink} href={href}>{actor.name}</Link> : <>{actor.name}</>
}

export function OrderLink({ order }: { order: OrderRef }) {
  return <Link className={cn("font-mono text-[0.95em]", nameLink)} href={`/orders/${order.id}`}>{order.reference}</Link>
}

export function OrderLinks({ orders }: { orders: OrderRef[] }) {
  return <>{orders.map((order, index) => <span key={order.id}>{index > 0 ? ", " : ""}<OrderLink order={order} /></span>)}</>
}

export function FactList({ facts }: { facts: Fact[] }) {
  return <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{facts.map((fact) => <div className="flex min-w-0 flex-col gap-0.5" key={fact.label}>
    <dt className="text-xs text-muted-foreground">{fact.label}</dt>
    <dd className={cn("text-[13px]", fact.mono && "font-mono", fact.tone && TONE_TEXT[fact.tone])}>
      {fact.href ? <Link className={nameLink} href={fact.href}>{fact.value}</Link> : fact.value}
      {fact.hint && <small className="block text-xs text-muted-foreground">{fact.hint}</small>}
    </dd>
  </div>)}</dl>
}

export function SectionHead({ title, count, note }: { title: string; count?: number | null; note?: ReactNode }) {
  return <div className="mb-3 flex items-baseline gap-2">
    <h2 className="text-sm font-semibold">{title}</h2>
    {count != null && count > 0 && <span className="font-mono text-xs text-muted-foreground tabular-nums">{count}</span>}
    {note && <span className="ml-auto text-right text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4">{note}</span>}
  </div>
}

export function Empty({ children, quiet = false, small }: { children: ReactNode; quiet?: boolean; small?: ReactNode }) {
  if (quiet) return <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
    <CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
    <span>{children}{small && <small className="block text-xs">{small}</small>}</span>
  </p>
  return <p className="max-w-[70ch] text-[13px] text-muted-foreground">{children}</p>
}

export function More({ label, children, open = false }: { label: string; children: ReactNode; open?: boolean }) {
  return <Collapsible defaultOpen={open} className="group/more">
    <CollapsibleTrigger className="flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground hover:text-foreground">
      <ChevronRightIcon className="size-3.5 transition-transform group-data-[state=open]/more:rotate-90" aria-hidden="true" />{label}
    </CollapsibleTrigger>
    <CollapsibleContent className="pt-2">{children}</CollapsibleContent>
  </Collapsible>
}

/** A small avatar with initials, as Linear shows the assignee. The colour comes from the name. A photo replaces the initials. */
export function Monogram({ name, photo, className }: { name: string; photo?: string | null; className?: string }) {
  if (photo) return <img src={photo} alt="" title={name} loading="lazy" className={cn("size-5 shrink-0 rounded-full bg-muted object-cover", className)} />
  const words = name.split(/\s+/).filter(Boolean)
  const initials = ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase()
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return <span className={cn("grid size-5 shrink-0 place-items-center rounded-full text-[9px] font-semibold text-white", className)} style={{ background: `oklch(0.55 0.12 ${hash})` }} title={name} aria-hidden="true">{initials}</span>
}
