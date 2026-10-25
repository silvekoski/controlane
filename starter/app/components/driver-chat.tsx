"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { SendIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { act, useControl, type ChatView } from "./control"
import { SectionHead } from "./ui"

const WHO: Record<ChatView["messages"][number]["from"], string> = { agent: "Agent", driver: "Driver", operator: "Ops", customer: "Customer", system: "System" }

/** The driver chat for one order. Ops can write to the driver here. On the event orders a simulated driver answers. */
export function DriverChat({ orderId }: { orderId: string }) {
  const { data, error } = useControl<ChatView>(`view=chat&order=${encodeURIComponent(orderId)}`)
  const [draft, setDraft] = useState("")
  const [pending, start] = useTransition()
  if (error || !data) return null

  const send = () => start(async () => {
    try {
      await act({ action: "message_driver", orderRef: data.orderRef, text: draft })
      setDraft("")
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not send") }
  })

  return <section className="flex flex-col gap-3" id="driver-chat">
    <SectionHead title={`Driver chat with ${data.driver}`} count={data.messages.length || null} note={data.simulatedDriver ? "Simulated driver: nothing is sent" : "Fictional data: nothing is sent"} />
    <ol className="flex max-h-96 flex-col gap-2 overflow-y-auto rounded-xl border p-3">
      {data.messages.length === 0 && <li className="text-sm text-muted-foreground">No driver messages yet.</li>}
      {data.messages.map((message) => {
        const ours = message.from === "agent" || message.from === "operator"
        return <li key={message.id} className={cn("flex max-w-[85%] flex-col gap-0.5", ours ? "self-end items-end" : "self-start")}>
          <span className="text-[11px] text-muted-foreground">{WHO[message.from]} · <span title={message.at}>{message.age}</span>{message.simulated ? " · simulated" : ""}</span>
          <span className={cn("rounded-lg px-3 py-2 text-[13px] whitespace-pre-line", ours ? "bg-primary text-primary-foreground" : "bg-muted")}>{message.text}</span>
        </li>
      })}
      {pending && <li className="self-start text-xs text-muted-foreground">The driver writes…</li>}
    </ol>
    <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); if (draft.trim()) send() }}>
      <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} placeholder={`Message ${data.driver}…`} aria-label={`Message ${data.driver}`} className="min-h-10 text-[13px]"
        onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (draft.trim()) send() } }} />
      <Button type="submit" size="sm" disabled={pending || !draft.trim()}>Send<SendIcon aria-hidden="true" /></Button>
    </form>
  </section>
}
