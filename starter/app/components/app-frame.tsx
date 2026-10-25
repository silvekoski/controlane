"use client"

import Link from "next/link"
import { Fragment, useEffect, useState, type ReactNode } from "react"
import { BotIcon, Building2Icon, CarIcon, CircleDotIcon, EuroIcon, InboxIcon, MapPinIcon, MoonIcon, SearchIcon, ShieldCheckIcon, SquareCheckIcon, SunIcon, TagIcon, UserRoundIcon, UsersIcon, type LucideIcon } from "@/components/icons"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail, SidebarTrigger,
} from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { fmtDateTime } from "@/lib/present/time"
import { cn } from "@/lib/utils"
import { CommandPalette, useCommandPalette } from "./command-palette"
import { BahnLogo, ControlaneLogo, ControlaneSymbol } from "./brand"
import { ClockBar } from "./clock-bar"
import { ModelSettings } from "./model-settings"

export type Section = "overview" | "decisions" | "live" | "board" | "inbox" | "traces" | "finances" | "evals" | "synthetic" | "label" | "customers" | "drivers" | "sites"
export type Crumb = { label: string; href?: string }

export const SCREENS: { label: string; links: { section: Section; href: string; label: string; icon: LucideIcon }[] }[] = [
  { label: "At a glance", links: [
    { section: "overview", href: "/overview", label: "Overview", icon: CircleDotIcon },
  ] },
  { label: "Work", links: [
    { section: "decisions", href: "/decisions", label: "Decisions", icon: SquareCheckIcon },
    { section: "live", href: "/live", label: "Live map", icon: MapPinIcon },
    { section: "board", href: "/orders", label: "Orders", icon: CarIcon },
    { section: "inbox", href: "/inbox", label: "Inbox", icon: InboxIcon },
    { section: "traces", href: "/traces", label: "Agent traces", icon: BotIcon },
    { section: "finances", href: "/finances", label: "Finances", icon: EuroIcon },
  ] },
  { label: "Teach the checks", links: [
    { section: "evals", href: "/evals", label: "Checks and evals", icon: ShieldCheckIcon },
    { section: "label", href: "/label", label: "Labeling", icon: TagIcon },
  ] },
  { label: "People and places", links: [
    { section: "customers", href: "/customers", label: "Customers", icon: UsersIcon },
    { section: "drivers", href: "/drivers", label: "Drivers", icon: UserRoundIcon },
    { section: "sites", href: "/sites", label: "Places", icon: Building2Icon },
  ] },
]

const SECTION_LABEL = Object.fromEntries([
  ...SCREENS.flatMap((group) => group.links.map((link) => [link.section, link] as const)),
  ["synthetic", { section: "synthetic", href: "/synthetic", label: "Synthetic data", icon: ShieldCheckIcon }],
]) as unknown as Record<Section, { href: string; label: string; icon: LucideIcon }>

function ThemeToggle() {
  const [dark, setDark] = useState(false)
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), [])
  const flip = () => {
    const next = !dark
    document.documentElement.classList.toggle("dark", next)
    try { localStorage.setItem("theme", next ? "dark" : "light") } catch {}
    setDark(next)
  }
  return <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon-sm" onClick={flip} aria-label={dark ? "Use the light theme" : "Use the dark theme"}>
        {dark ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}
      </Button>
    </TooltipTrigger>
    <TooltipContent>{dark ? "Light theme" : "Dark theme"}</TooltipContent>
  </Tooltip>
}

/** The app shell: a quiet sidebar, an inset main panel, and a slim header with breadcrumbs and page actions. */
export function AppFrame({ children, section, snapshotAt, board = false, crumbs, actions }: { children: ReactNode; section: Section; snapshotAt?: string | null; board?: boolean; crumbs?: Crumb[]; actions?: ReactNode }) {
  const palette = useCommandPalette()
  const root = SECTION_LABEL[section]
  const RootIcon = root.icon
  const trail: Crumb[] = crumbs ?? [{ label: root.label }]
  return <TooltipProvider delayDuration={300}><SidebarProvider>
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="gap-1.5">
        <SidebarMenu>
          <SidebarMenuItem className="flex flex-col items-start gap-1.5 px-2 pt-2 pb-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
            <ControlaneLogo className="h-7 group-data-[collapsible=icon]:hidden" />
            <ControlaneSymbol className="hidden size-4 shrink-0 group-data-[collapsible=icon]:block" />
            <span className="flex items-center gap-2 text-[13px] leading-none text-muted-foreground group-data-[collapsible=icon]:hidden">
              <BahnLogo className="h-3 w-auto" />hackathon project
            </span>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Search" onClick={() => palette.setOpen(true)} className="border bg-background/40 text-[13px] text-muted-foreground shadow-xs hover:text-sidebar-accent-foreground">
              <SearchIcon aria-hidden="true" />
              <span>Search</span>
              <Kbd className="ml-auto group-data-[collapsible=icon]:hidden">⌘K</Kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {SCREENS.map((group, index) => <SidebarGroup key={group.label} className={cn("py-1", index > 0 && "mt-1 border-t border-dashed border-sidebar-border pt-2")}>
          <SidebarGroupLabel className="h-7 text-[10.5px] font-medium tracking-wider uppercase">{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-px">
              {group.links.map(({ section: key, href, label, icon: Icon }) => <SidebarMenuItem key={key}>
                <SidebarMenuButton asChild isActive={section === key} tooltip={label} className="h-7 text-[13px] data-[active=true]:font-medium">
                  <Link href={href} aria-current={section === key ? "page" : undefined}><Icon aria-hidden="true" /><span>{label}</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>)}
      </SidebarContent>
      <SidebarFooter>
        <p className="px-2 pb-1 text-[11px] leading-relaxed text-muted-foreground group-data-[collapsible=icon]:hidden">
          {snapshotAt ? `Snapshot ${fmtDateTime(snapshotAt)}` : "Fictional snapshot"}<br />Fictional data · every action is simulated
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
    <SidebarInset className="min-w-0 overflow-hidden md:h-[calc(100svh-1rem)] md:border md:shadow-none">
      <header className="sticky top-0 z-10 flex h-11 shrink-0 items-center gap-2 border-b bg-background px-3">
        <SidebarTrigger className="text-muted-foreground" />
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap text-[13px]">
            {crumbs && <><BreadcrumbItem><BreadcrumbLink asChild><Link href={root.href} className="flex items-center gap-1.5"><RootIcon className="size-3.5" aria-hidden="true" />{root.label}</Link></BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /></>}
            {trail.map((crumb, index) => <Fragment key={`${crumb.label}-${index}`}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem className="min-w-0">
                {crumb.href && index < trail.length - 1
                  ? <BreadcrumbLink asChild><Link href={crumb.href}>{crumb.label}</Link></BreadcrumbLink>
                  : <BreadcrumbPage className="flex min-w-0 items-center gap-1.5 truncate font-medium">{!crumbs && <RootIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}{crumb.label}</BreadcrumbPage>}
              </BreadcrumbItem>
            </Fragment>)}
          </BreadcrumbList>
        </Breadcrumb>
        <Button asChild size="sm" variant={section === "synthetic" ? "secondary" : "outline"} className="px-2 sm:px-2.5">
          <Link href="/synthetic" aria-label="Synthetic data explorer" aria-current={section === "synthetic" ? "page" : undefined}>
            <ShieldCheckIcon aria-hidden="true" /><span className="hidden sm:inline">Synthetic data</span>
          </Link>
        </Button>
        <div className="ml-auto flex items-center gap-1.5">
          {actions}
          <ClockBar />
          <ModelSettings />
          <ThemeToggle />
        </div>
      </header>
      <div className={board ? "flex min-h-0 flex-1 flex-col" : "min-h-0 flex-1 overflow-y-auto p-4 md:p-6"}>{children}</div>
    </SidebarInset>
    <CommandPalette open={palette.open} onOpenChange={palette.setOpen} />
    <Toaster position="bottom-right" />
  </SidebarProvider></TooltipProvider>
}
