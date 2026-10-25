"use client"

import Link from "next/link"
import {
  ArrowRightIcon, ClockIcon, FlagIcon, InfoIcon, KeyRoundIcon, MessageSquareIcon, SparklesIcon, SquareCheckIcon, TagIcon,
  TriangleAlertIcon, UserRoundIcon, type LucideIcon,
} from "@/components/icons"
import { laneLabel } from "@/lib/present/labels"
import { fmtDateTime, fmtRange, fmtWeekday } from "@/lib/present/time"
import type { AgentCard } from "@/lib/agent-state"
import type { BoardCard, Tone } from "@/lib/present/types"
import { cn } from "@/lib/utils"
import { JevChip } from "./agent"
import { TONE_TEXT } from "./ui"

export const MARK_ICON: Record<string, string> = {
  alert: "alert", owned_alert: "alert", work: "work", incident: "incident", waiting: "waiting", conversation: "message",
  proposal: "proposal", claim: "alert", custody: "key", check: "note", inbox: "message",
}

const ICONS: Record<string, LucideIcon> = {
  alert: TriangleAlertIcon, work: SquareCheckIcon, incident: FlagIcon, waiting: ClockIcon, message: MessageSquareIcon,
  proposal: SparklesIcon, key: KeyRoundIcon, note: InfoIcon, driver: UserRoundIcon, offer: TagIcon,
}

function KindIcon({ name, className }: { name: string; className?: string }) {
  const Glyph = ICONS[name] ?? InfoIcon
  return <Glyph className={cn("size-3.5 shrink-0", className)} aria-hidden="true" />
}

/** One order on a board or in a list: car, reference, customer, route, the decisive date and the work tray. */
export function Card({ card, role, agent }: { card: BoardCard; role?: string | null; agent?: AgentCard }) {
  const marks = uniqueMarks(card)
  const date = card.decisive
  return <div className="min-w-0">
    {role && <div className="mb-1.5 ml-0.5 text-xs text-muted-foreground">{role}</div>}
    <Link
      className="block overflow-hidden rounded-xl border bg-card text-sm text-card-foreground transition-colors outline-none hover:border-foreground/25 hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
      href={`/orders/${card.id}`} aria-label={`${card.vehicle}, ${card.reference}, ${laneLabel(card.displayLane)}`}
    >
      <div className="flex flex-col gap-1 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-medium">{card.vehicle}</span>
          {marks.length > 0 && <span className="flex shrink-0 gap-1" aria-hidden="true">{marks.map(([kind, tone]) => <KindIcon key={kind} name={MARK_ICON[kind] ?? "note"} className={TONE_TEXT[tone]} />)}</span>}
        </div>
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className="shrink-0 font-mono text-muted-foreground">{card.reference}</span>
          <span className="min-w-0 flex-1 truncate text-right text-muted-foreground" title={card.customer}>{card.customer}</span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate" title={card.origin}>{card.from.city}{card.from.country ? `, ${card.from.country}` : ""}</span>
          <ArrowRightIcon className="size-3 shrink-0 opacity-60" aria-hidden="true" />
          <span className="truncate" title={card.destination}>{card.to.city}{card.to.country ? `, ${card.to.country}` : ""}</span>
        </div>
        {date && <div className={cn("mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-xs", TONE_TEXT[date.tone])}>
          <span className="text-muted-foreground">{date.label}</span>
          <span className="whitespace-nowrap tabular-nums" title={date.end ? fmtRange(date.start, date.end, date.zone) : fmtDateTime(date.start, date.zone)}>{dateText(date.start, date.end, date.zone)}</span>
          {date.note && <span className="min-w-0 max-w-full truncate" title={date.note}>· {date.note}</span>}
        </div>}
      </div>
      {agent && <div className="flex min-w-0 items-center gap-2 border-t px-3 py-1.5 text-xs text-muted-foreground">
        <JevChip card={agent} /><span className="min-w-0 truncate" title={agent.summary}>{agent.summary}</span>
      </div>}
      {card.work.length > 0 && <div className="flex flex-col gap-1 border-t bg-muted/30 px-3 py-2">
        {card.work.map((line, index) => <div className={cn("flex min-w-0 items-center gap-1.5 text-xs", TONE_TEXT[line.tone])} key={index}>
          <KindIcon name={line.icon} /><span className="min-w-0 truncate" title={line.text}>{line.text}</span>
        </div>)}
      </div>}
    </Link>
  </div>
}

function dateText(start: string, end: string | null, zone: string | null): string {
  const day = fmtWeekday(start, zone)
  const from = fmtDateTime(start, zone, false).split(" ").pop() ?? ""
  if (!end) return `${day} ${from}`
  const to = fmtDateTime(end, zone, false).split(" ").pop() ?? ""
  const sameDay = fmtWeekday(end, zone) === day
  return sameDay ? `${day} ${from}–${to}` : `${day} ${from} – ${fmtWeekday(end, zone)} ${to}`
}

function uniqueMarks(card: BoardCard): [string, Tone][] {
  const seen = new Map<string, Tone>()
  for (const item of card.attention) {
    const key = MARK_ICON[item.kind] ?? "note"
    if (!seen.has(key)) seen.set(key, item.tone)
  }
  return [...seen.entries()].slice(0, 3).map(([key, tone]) => [Object.keys(MARK_ICON).find((kind) => MARK_ICON[kind] === key) ?? key, tone])
}
