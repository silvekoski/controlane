"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { TriangleAlertIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { act, type CardView } from "./control"

type Mode = "idle" | "edit" | "reject" | "redo"

const field = "flex flex-col gap-1.5 text-xs font-medium text-muted-foreground"

/** Approve, edit, reject or send back to the agent. The control room reads the facts again before it acts. */
export function Decide({ view }: { view: CardView }) {
  const { row, proposal } = view
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("idle")
  const [pending, start] = useTransition()
  const [changed, setChanged] = useState<string | null>(null)
  const [description, setDescription] = useState(proposal.description)
  const [cost, setCost] = useState(proposal.costDelta?.toString() ?? "")
  const [draft, setDraft] = useState(proposal.customerDraft ?? "")
  const [reason, setReason] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const blocked = view.general.some((warning) => warning.blocking)

  const approve = (edits?: Record<string, unknown>) => start(async () => {
    try {
      const out = await act<{ ok: boolean; outcome?: string; message?: string }>({ action: "approve", cardId: row.id, edits })
      if (!out.ok) { setChanged(out.message ?? "A fact changed. Read the facts again."); setMode("idle"); return }
      toast.success(edits ? "Edited and approved" : "Approved", { description: out.outcome })
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not approve") }
  })

  const reject = () => start(async () => {
    try {
      await act({ action: "reject", cardId: row.id, reason, note })
      toast.success("Rejected", { description: "The case went to the labeling queue as an eval case." })
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not reject") }
  })

  const redo = () => start(async () => {
    try {
      const out = await act<{ orderId: string }>({ action: "redo", cardId: row.id, note })
      toast.success("Sent to the agent", { description: "It tries again with your note." })
      router.push(`/orders/${out.orderId}#agent`)
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not send to the agent") }
  })

  if (mode === "edit") return <div className="flex flex-col gap-3 border-t p-4">
    <label className={field}>What should happen<Textarea value={description} onChange={(event) => setDescription(event.target.value)} className="text-sm font-normal text-foreground" /></label>
    <label className={cn(field, "max-w-48")}>Cost change (€)<Input inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} className="font-normal text-foreground" /></label>
    {proposal.customerDraft !== undefined && <label className={field}>Message to the customer (you send it)<Textarea value={draft} onChange={(event) => setDraft(event.target.value)} className="text-sm font-normal text-foreground" /></label>}
    <div className="flex gap-2">
      <Button disabled={pending || !description.trim()} onClick={() => approve({ description, costDelta: cost ? Number(cost) : undefined, customerDraft: proposal.customerDraft !== undefined ? draft : undefined })}>Approve with changes</Button>
      <Button variant="ghost" onClick={() => setMode("idle")}>Cancel</Button>
    </div>
  </div>

  if (mode === "reject") return <div className="flex flex-col gap-3 border-t p-4">
    <span className={field}>Why not?</span>
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Reason">
      {Object.entries(view.rejectReasons).map(([key, label]) => <Button key={key} size="sm" variant={reason === key ? "default" : "outline"} role="radio" aria-checked={reason === key} onClick={() => setReason(key)}>{label}</Button>)}
    </div>
    <label className={field}>How did you know? (optional, it teaches the checks)
      <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="For example: the dealer always sends their own recovery for this make." className="text-sm font-normal text-foreground" />
    </label>
    <div className="flex gap-2">
      <Button variant="outline" disabled={pending || !reason} onClick={reject}>Reject</Button>
      <Button variant="ghost" onClick={() => setMode("idle")}>Cancel</Button>
    </div>
  </div>

  if (mode === "redo") return <div className="flex flex-col gap-3 border-t p-4">
    <label className={field}>Tell the agent what to change. It tries again with your note.
      <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="For example: check the train option too before you suggest the ferry." className="text-sm font-normal text-foreground" />
    </label>
    <div className="flex gap-2">
      <Button disabled={pending || !note.trim()} onClick={redo}>Send to the agent</Button>
      <Button variant="ghost" onClick={() => setMode("idle")}>Cancel</Button>
    </div>
  </div>

  return <div className="flex flex-col gap-3 border-t p-4">
    {changed && <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning" role="alert"><TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{changed}</p>}
    <div className="flex flex-wrap items-center gap-2">
      <Button disabled={pending || blocked} onClick={() => approve()} title={blocked ? "A hard rule blocks this action" : undefined}>{pending ? "Checking the facts again…" : "Approve"}</Button>
      <Button variant="outline" disabled={pending} onClick={() => setMode("edit")}>Edit</Button>
      <Button variant="outline" disabled={pending} onClick={() => setMode("reject")}>Reject</Button>
      {view.canRedo && <Button variant="ghost" disabled={pending} onClick={() => setMode("redo")}>Ask the agent to change it</Button>}
    </div>
    <p className="text-xs text-muted-foreground">The system reads the facts again before it acts. Nothing real is booked or sent.</p>
  </div>
}
