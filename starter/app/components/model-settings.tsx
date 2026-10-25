"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { BotIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { act, useControl } from "./control"
import { Chip } from "./ui"

/* Model settings in the top bar. An operator turns each decision model on or off for new cards and photos.
   The operator also picks the model for the agent's photo questions.
   The control room keeps the settings. The benchmark always scores every connected model. */

type ModelRow = {
  kind: "text" | "photo"
  model: string
  label: string
  connected: boolean
  on: boolean
  why: string | null
  score: { catchRate: number | null; falseAlarmRate: number | null; msPerCheck: number | null } | null
}
type ModelsView = { models: ModelRow[]; imageModel: "auto" | "jev" | "d1_ft" }

const IMAGE_CHOICES = [
  { id: "auto", label: "Auto", help: "Jev first. If Jev fails, d1-3B fine-tuned." },
  { id: "jev", label: "Jev", help: "Only Jev answers." },
  { id: "d1_ft", label: "d1-3B FT", help: "Only d1-3B fine-tuned answers. Needs the model server." },
] as const

const pct = (value: number | null) => (value === null ? "–" : `${Math.round(value * 100)}%`)

function Score({ score, kind }: { score: ModelRow["score"]; kind: ModelRow["kind"] }) {
  if (!score) return <span className="text-muted-foreground">Not scored</span>
  return <span className="font-mono tabular-nums text-muted-foreground" title={kind === "text" ? "Templates never seen in training" : "Photos and scans from the packet"}>
    {pct(score.catchRate)} caught · {pct(score.falseAlarmRate)} false alarms{score.msPerCheck !== null ? ` · ${Math.round(score.msPerCheck)} ms` : ""}
  </span>
}

function Row({ row, pending, onToggle }: { row: ModelRow; pending: boolean; onToggle: (on: boolean) => void }) {
  return <li className="flex items-start gap-3 py-2">
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-[13px]">
      <span className={cn("font-medium", !row.on && "text-muted-foreground")}>{row.label}</span>
      {row.connected ? <Score score={row.score} kind={row.kind} /> : <span className="text-xs text-muted-foreground">{row.why ?? "Not connected"}</span>}
    </div>
    {row.connected
      ? <Switch checked={row.on} disabled={pending} onCheckedChange={onToggle} aria-label={`${row.label}: ${row.on ? "on" : "off"}`} />
      : <Chip tone="neutral">Not connected</Chip>}
  </li>
}

export function ModelSettings() {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const { data, error } = useControl<ModelsView>(open ? "view=models" : null)

  const send = (body: Record<string, unknown>, done: string) => start(async () => {
    try {
      await act(body)
      toast.success(done)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not save")
    }
  })

  const text = data?.models.filter((row) => row.kind === "text") ?? []
  const photo = data?.models.filter((row) => row.kind === "photo") ?? []
  const toggle = (row: ModelRow) => (on: boolean) => send({ action: "set_checker", model: row.model, on }, `${row.label} is ${on ? "on" : "off"}`)

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button variant="ghost" size="sm" className="text-muted-foreground" aria-label="Decision models"><BotIcon aria-hidden="true" /><span className="hidden md:inline">Models</span></Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-[26rem]">
      <PopoverHeader>
        <PopoverTitle>Decision models</PopoverTitle>
        <PopoverDescription>Turn a model on or off for new cards and photos. Plain code rules always run. Scores are from the honest tests.</PopoverDescription>
      </PopoverHeader>
      {error && <p className="text-xs text-danger">{error}</p>}
      {data && <div className="flex flex-col gap-3">
        <section>
          <h3 className="text-xs font-medium text-muted-foreground">Text checks on each card</h3>
          <ul className="divide-y">{text.map((row) => <Row key={`t-${row.model}`} row={row} pending={pending} onToggle={toggle(row)} />)}</ul>
        </section>
        <section>
          <h3 className="text-xs font-medium text-muted-foreground">Photo checks</h3>
          {photo.some((row) => row.model === "d1_ft") && <p className="text-xs text-muted-foreground">d1-3B fine-tuned is one model for text and photos. Its switch turns both on or off.</p>}
          <ul className="divide-y">{photo.map((row) => <Row key={`p-${row.model}`} row={row} pending={pending} onToggle={toggle(row)} />)}</ul>
        </section>
        <section className="flex flex-col gap-1.5 border-t pt-3">
          <h3 className="text-xs font-medium text-muted-foreground">The agent's photo questions</h3>
          <div className="flex gap-1.5" role="radiogroup" aria-label="Model for the agent's photo questions">
            {IMAGE_CHOICES.map((choice) => <Button key={choice.id} size="sm" role="radio" aria-checked={data.imageModel === choice.id} title={choice.help}
              variant={data.imageModel === choice.id ? "default" : "outline"} disabled={pending}
              onClick={() => send({ action: "image_model", model: choice.id }, `Photo questions: ${choice.label}`)}>{choice.label}</Button>)}
          </div>
          <p className="text-xs text-muted-foreground">{IMAGE_CHOICES.find((choice) => choice.id === data.imageModel)?.help}</p>
        </section>
      </div>}
    </PopoverContent>
  </Popover>
}
