"use client"

import type { ReactNode } from "react"
import {
  ArrowRightIcon, BanIcon, CarIcon, CheckIcon, ChevronRightIcon, CircleCheckIcon, ClipboardCheckIcon, ClockIcon, FilePlusIcon, FileTextIcon,
  FlagIcon, FlagTriangleRightIcon, HistoryIcon, HotelIcon, ImageIcon, InboxIcon, InfoIcon, KeyRoundIcon, MapPinIcon, MessageSquareIcon,
  PlaneIcon, ReceiptIcon, ShipIcon, SparklesIcon, SquareCheckIcon, TagIcon, TrainFrontIcon, TriangleAlertIcon, TruckIcon,
  UserRoundCheckIcon, UserRoundIcon, UsersIcon, WarehouseIcon, type LucideIcon,
} from "@/components/icons"
import { cn } from "@/lib/utils"

/* Icons mark a kind of record. Words carry the meaning. */
export const KIND_ICON: Record<string, LucideIcon> = {
  alert: TriangleAlertIcon, work: SquareCheckIcon, incident: FlagIcon, waiting: ClockIcon, message: MessageSquareIcon, proposal: SparklesIcon,
  key: KeyRoundIcon, note: InfoIcon, inbox: InboxIcon, driver: UserRoundIcon, offer: TagIcon, pin: MapPinIcon, flag: FlagTriangleRightIcon,
  yard: WarehouseIcon, car: CarIcon, ferry: ShipIcon, train: TrainFrontIcon, plane: PlaneIcon, hotel: HotelIcon, file: FileTextIcon,
  photo: ImageIcon, check: CheckIcon, chevron: ChevronRightIcon, arrow: ArrowRightIcon, people: UsersIcon, receipt: ReceiptIcon, history: HistoryIcon,
}

export const LANE_ICON: Record<string, LucideIcon> = {
  intake: FilePlusIcon, ready: ClipboardCheckIcon, market: TagIcon, booked: UserRoundCheckIcon, moving: TruckIcon, delivered: CircleCheckIcon, cancelled: BanIcon,
}

export function KindIcon({ name, className }: { name: string; className?: string }) {
  const Glyph = KIND_ICON[name] ?? InfoIcon
  return <Glyph className={cn("size-3.5 shrink-0", className)} aria-hidden="true" />
}

/** A bordered list of rows, as in Evidline item groups. */
export function Rows({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col divide-y rounded-xl border bg-card", className)}>{children}</div>
}

export function Row({ children, side, className }: { children: ReactNode; side?: ReactNode; className?: string }) {
  return <div className={cn("flex min-w-0 flex-col gap-1 px-3 py-2.5 sm:flex-row sm:gap-4", className)}>
    <div className="flex min-w-0 flex-1 flex-col gap-1">{children}</div>
    {side && <div className="shrink-0 text-xs text-muted-foreground sm:text-right">{side}</div>}
  </div>
}

export function RowTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium", className)}>{children}</div>
}

export function RowSub({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("text-xs text-muted-foreground", className)}>{children}</div>
}

export function RowText({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[13px] text-muted-foreground [&_b]:font-medium [&_b]:text-foreground", className)}>{children}</p>
}

/** Short facts in one line, with a dot between them. */
export function Meta({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("flex flex-wrap gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground [&>*+*]:before:mr-1.5 [&>*+*]:before:content-['·']", className)}>{children}</p>
}

export function SubHead({ children }: { children: ReactNode }) {
  return <h4 className="mt-4 mb-2 text-xs font-medium text-muted-foreground first:mt-0">{children}</h4>
}
