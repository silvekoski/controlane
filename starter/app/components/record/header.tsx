"use client"

import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowRightIcon, InfoIcon, RepeatIcon, UsersIcon } from "@/components/icons"
import { Card } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { RecordView, Tile } from "@/lib/present/types"
import { cn } from "@/lib/utils"
import { TONE_TEXT } from "../ui"
import { LaneIcon } from "../status-icons"

export function RecordHero({ view }: { view: RecordView }) {
  const { header, story } = view
  return <header className="flex flex-col gap-3">
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <LaneIcon lane={header.lane} /><span>{header.laneLabel}</span><span aria-hidden="true">·</span><span className="font-mono">{header.reference}</span>
    </div>
    <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight">{header.vehicle ? header.vehicle.title : "Vehicle not linked"}</h1>
    <p className="max-w-[75ch] text-[13px] text-muted-foreground">{story.intro}</p>
    <div className="flex flex-col gap-1 rounded-lg border bg-muted/40 px-3.5 py-3">
      <p className={cn("text-sm font-medium", TONE_TEXT[story.tone])}>{story.headline}</p>
      {story.detail && <p className="max-w-[75ch] text-[13px] text-muted-foreground">{story.detail}</p>}
    </div>
  </header>
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-3 py-1.5 text-[13px]">
    <dt className="pt-px text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words">{children}</dd>
  </div>
}

/** The right-hand panel: the model illustration, then the order's properties and key dates. */
export function PropertiesPanel({ view }: { view: RecordView }) {
  const { header, journey, tiles } = view
  const vehicle = header.vehicle
  return <aside className="flex shrink-0 flex-col gap-5 border-t px-4 py-6 lg:w-80 lg:overflow-y-auto lg:border-t-0 lg:border-l lg:px-5" aria-label="Order properties">
    {vehicle?.illustrationSlug && <figure className="relative aspect-[16/9] overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
      <Image className="object-cover" src={`/car-images/${vehicle.illustrationSlug}.webp`} alt={`Illustration of a ${vehicle.title}`} fill sizes="320px" priority />
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="absolute right-2 bottom-2 grid size-6 place-items-center rounded-full bg-background/80 text-muted-foreground ring-1 ring-foreground/15 backdrop-blur-md hover:text-foreground" aria-label="About this image">
            <InfoIcon className="size-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-64">Model illustration. Orders with the same model share it. It is not a photo or evidence of this car.</TooltipContent>
      </Tooltip>
    </figure>}
    <section>
      <h2 className="mb-1 text-xs font-medium text-muted-foreground">Properties</h2>
      <dl>
        <Property label="Lane"><span className="inline-flex items-center gap-1.5"><LaneIcon lane={header.lane} />{header.laneLabel}</span></Property>
        <Property label="Reference"><span className="font-mono">{header.reference}</span></Property>
        <Property label="Customer"><Link href={`/customers/${header.customer.id}`} className="inline-flex items-center gap-1.5 hover:underline"><UsersIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />{header.customer.name}</Link></Property>
        <Property label="Route"><span className="inline-flex items-center gap-1.5"><ArrowRightIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />{header.routeKindLabel}{journey.distanceKm ? ` · ${journey.distanceKm} km` : ""}</span></Property>
        <Property label="Plate"><span className={cn(vehicle?.plate ? "font-mono" : "text-muted-foreground")}>{vehicle?.plate ?? "No plate"}</span></Property>
        <Property label="VIN"><span className={cn("text-xs", vehicle?.vin ? "font-mono" : "text-muted-foreground")} title="Synthetic VIN">{vehicle?.vin ?? "No VIN"}</span></Property>
        {header.tradeIn && <Property label="Trade-in"><span className="inline-flex items-center gap-1.5"><RepeatIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />{header.tradeIn.title}</span></Property>}
      </dl>
    </section>
    {tiles.length > 0 && <section className="border-t pt-4">
      <h2 className="mb-1 text-xs font-medium text-muted-foreground">Key dates and people</h2>
      <dl>{tiles.map((tile) => {
        const warn = tile.tone === "danger" || tile.tone === "warn"
        const value = <>
          <span className={cn("font-medium", warn && TONE_TEXT[tile.tone])}>{tile.value}</span>
          {tile.hint && <span className={cn("block text-xs", warn ? TONE_TEXT[tile.tone] : "text-muted-foreground")}>{tile.hint}</span>}
        </>
        return <Property key={tile.label} label={tile.label}>{tile.href ? <Link href={tile.href} className="hover:underline">{value}</Link> : value}</Property>
      })}</dl>
    </section>}
  </aside>
}

/** Kept for other screens: the tiles as a small grid of cards. */
export function Tiles({ tiles }: { tiles: Tile[] }) {
  if (!tiles.length) return null
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{tiles.map((tile) => {
    const body = <>
      <div className="text-xs text-muted-foreground">{tile.label}</div>
      <div className={cn("text-base leading-snug font-medium break-words", (tile.tone === "danger" || tile.tone === "warn") && TONE_TEXT[tile.tone])}>{tile.value}</div>
      {tile.hint && <div className={cn("text-xs", tile.tone === "danger" || tile.tone === "warn" ? TONE_TEXT[tile.tone] : "text-muted-foreground")}>{tile.hint}</div>}
    </>
    const card = <Card size="sm" className={cn("h-full gap-1 px-3", tile.href && "transition-colors group-hover/tile:bg-muted/40 group-hover/tile:ring-foreground/25")}>{body}</Card>
    return tile.href
      ? <Link className="group/tile min-w-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50" href={tile.href} key={tile.label}>{card}</Link>
      : <div className="min-w-0" key={tile.label}>{card}</div>
  })}</div>
}
