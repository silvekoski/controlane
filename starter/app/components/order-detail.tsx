"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { RecordView } from "@/lib/present/types"
import { cn } from "@/lib/utils"
import { AgentSection } from "./agent"
import { TONE_TEXT } from "./ui"
import { CarDashboard, DriverCard } from "./record/dashboard"
import { RecordsPanel } from "./record/records"
import { ActivitySection, AttentionPanel, ConversationsSection, DecisionsSection, EvidenceSection, RouteStrip } from "./record/sections"

export type Detail = { order: { id: string; reference: string }; view: RecordView }

/** The order as a car dashboard on top, with the work in tabs below. */
export function OrderPane({ detail }: { detail: Detail }) {
  const { view } = detail
  const tab = "h-full flex-none rounded-none border-0 px-2.5 text-[13px] text-muted-foreground data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none group-data-horizontal/tabs:after:inset-x-1 group-data-horizontal/tabs:after:bottom-0 after:bg-primary data-[state=active]:after:opacity-100"
  return <div className="min-h-0 flex-1 overflow-y-auto">
    <div className="flex max-w-7xl flex-col gap-5 p-4 md:p-6">
      <CarDashboard view={view} />
      <Tabs defaultValue="overview" className="gap-4">
        <TabsList variant="line" className="h-10 w-full justify-start gap-1 overflow-x-auto rounded-none border-b p-0">
          <TabsTrigger value="overview" className={tab}>Overview</TabsTrigger>
          <TabsTrigger value="route" className={tab}>Route</TabsTrigger>
          <TabsTrigger value="conversations" className={tab}>Conversations{view.threads.length > 0 && <span className="ml-1.5 rounded bg-muted px-1.5 font-mono text-[11px] tabular-nums">{view.threads.length}</span>}</TabsTrigger>
          <TabsTrigger value="evidence" className={tab}>Evidence</TabsTrigger>
          <TabsTrigger value="agent" className={tab}>Agent work</TabsTrigger>
          <TabsTrigger value="activity" className={tab} id="activity">Activity</TabsTrigger>
          <TabsTrigger value="records" className={tab}>All records</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 rounded-xl border bg-muted/40 px-4 py-3">
            <p className={cn("text-[15px] font-semibold", TONE_TEXT[view.story.tone])}>{view.story.headline}</p>
            {view.story.detail && <p className="text-[13px] text-muted-foreground">{view.story.detail}</p>}
            <p className="text-xs text-muted-foreground">{view.story.intro}</p>
          </div>
          <DriverCard view={view} />
          <AttentionPanel view={view} />
        </TabsContent>
        <TabsContent value="route"><RouteStrip view={view} /></TabsContent>
        <TabsContent value="conversations"><ConversationsSection view={view} /></TabsContent>
        <TabsContent value="evidence"><EvidenceSection view={view} /></TabsContent>
        <TabsContent value="agent" className="flex flex-col gap-6"><AgentSection orderId={detail.order.id} /><DecisionsSection view={view} /></TabsContent>
        <TabsContent value="activity"><ActivitySection view={view} /></TabsContent>
        <TabsContent value="records"><RecordsPanel view={view} orderId={detail.order.id} /></TabsContent>
      </Tabs>
    </div>
  </div>
}
