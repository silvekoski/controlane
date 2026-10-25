"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { CarIcon } from "@/components/icons"
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import type { Overview } from "@/lib/present/types"
import { SCREENS } from "./app-frame"

export function useCommandPalette() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  return { open, setOpen }
}

/** Jump to a screen or to an order by reference, car, customer or city. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const [orders, setOrders] = useState<Overview["visible"] | null>(null)
  useEffect(() => {
    if (!open || orders) return
    fetch("/api/overview").then((response) => response.ok ? response.json() as Promise<Overview> : null).then((data) => { if (data) setOrders(data.visible) }).catch(() => {})
  }, [open, orders])
  const go = (href: string) => { onOpenChange(false); router.push(href) }
  return <CommandDialog open={open} onOpenChange={onOpenChange} title="Jump to" description="Find a screen or an order">
    <Command>
    <CommandInput placeholder="Screen, reference, car, customer or city" />
    <CommandList>
      <CommandEmpty>No match.</CommandEmpty>
      <CommandGroup heading="Screens">
        {SCREENS.flatMap((group) => group.links).map(({ href, label, icon: Icon }) => <CommandItem key={href} value={`screen ${label}`} onSelect={() => go(href)}><Icon aria-hidden="true" />{label}</CommandItem>)}
      </CommandGroup>
      <CommandGroup heading="Orders">
        {(orders ?? []).map((card) => <CommandItem key={card.id} value={`${card.reference} ${card.vehicle} ${card.customer} ${card.from.city} ${card.to.city}`} onSelect={() => go(`/orders/${card.id}`)}>
          <CarIcon aria-hidden="true" />
          <span className="font-mono text-xs">{card.reference}</span>
          <span className="truncate">{card.vehicle}</span>
          <span className="ml-auto truncate text-xs text-muted-foreground">{card.customer}</span>
        </CommandItem>)}
      </CommandGroup>
    </CommandList>
    </Command>
  </CommandDialog>
}
