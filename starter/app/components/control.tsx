"use client"

import { useCallback, useEffect, useState } from "react"
import { BotIcon, CircleAlertIcon, CircleCheckIcon, ClockIcon, UserRoundIcon, UsersIcon } from "@/components/icons"
import { Empty as EmptyState, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import type { Tone } from "@/lib/present/types"
import { Chip } from "./ui"

/* Client access to the control room: the decision queue, one decision card, evals, labeling and
   the driver chat. Reads and writes go through /api/control, which passes them to the control room app. */

export type Left = { text: string; tone: "critical" | "warn" | "calm" }
export type Escalation = { level: "agent" | "ops" | "outside"; text: string }

export type CardRow = {
  id: string; orderId: string; orderRef: string; status: string; summary: string; deadline: string; deadlineLabel: string
  left: Left; age: string; car: string; customer: string; driver: string
  kind: { kind: string; label: string }; escalation: Escalation
  warnings: number; blocked: boolean; jev: { checked: boolean; traps: number }
  decidedBy: string | null; decidedAt: string | null; outcome: string | null
  proposal: { kind: string; description: string; costDelta: number | null }
}

export type Missing = { model: string; label: string; why: string }

export type QueueView = {
  now: string
  settings: { costLimitEur: number; operator: string }
  system: { claude: boolean; provider?: "anthropic" | "openrouter" | null; checkers: string[]; missing: Missing[] }
  open: CardRow[]; decided: CardRow[]
  running: { id: string; orderId: string; orderRef: string; started: string; line: string }[]
  quiet: { runId: string; orderRef: string; orderId: string | null; at: string; reason: string }[]
  failed: { id: string; orderRef: string; error: string }[]
  onTrack: number; activeOrders: number; deliveredOrDone: number
  scenarios: { id: string; title: string; orderRef: string; status: string | null }[]
}

export type ModelAnswer = { model: string; label: string; answer: string; confidence: number; ms: number; mark: "trap" | "unsure" | "ok"; message: string }

export type CardView = {
  now: string
  row: CardRow
  context: { customer: string; driver: string; car: string; position: string; eta: string; late: string; chained: string }
  facts: { label: string; value: string; source: string; age: string; imageFile: string | null; warnings: { flagged: boolean; message: string; model: string }[] }[]
  agentActions: string[]
  proposal: { kind: string; description: string; costDelta?: number; needsApproval: boolean; travelOptionId?: string; customerDraft?: string }
  general: { message: string; model: string; blocking: boolean }[]
  answers: { questionId: string; question: string; byModel: ModelAnswer[] }[]
  run: { id: string; mode: "llm" | "scripted"; model: string | null } | null
  changeMsg: { text: string; age: string } | null
  rejectReason: string | null; rejectNote: string | null
  rejectReasons: Record<string, string>
  canRedo: boolean
  checkers: string[]; missingCheckers: Missing[]
  stop?: StopView | null
}

/* The GPS stop check: the rule, the places around the stop, and how Jev ranked them. */
export type StopPlace = { id: string; name: string; type: string; typeLabel: string; lat: number; lng: number; distanceM: number; openNow: boolean | null; probability: number | null }
export type Ranked = { id: string; label: string; probability: number }
export type StopStep = { at: string; time: string; kind: "rule" | "places" | "ranking" | "ask" | "reply" | "outcome"; text: string; detail?: unknown }
export type StopView = {
  orderRef: string; fixId: string; lat: number; lng: number; stoppedSince: string; stoppedMinutes: number; gpsAgeMinutes: number
  rule: string; provider: "google" | "simulated"; places: StopPlace[]
  ranking: null | {
    model: string; byJev: boolean; places: Ranked[]; causes: Ranked[]; ms: number; costUsd?: number; rankedAt: string; driverReplySeen: boolean
    others?: SecondOpinion[]
  }
  steps?: StopStep[]
}

export type SecondOpinion = { model: string; label: string; places: Ranked[]; causes: Ranked[]; ms: number; costUsd?: number; error?: string }
export type CardCheck = { model: string; label: string; answered: number; traps: number; ms: number; warnings: string[] }
export type StopModel = { label: string; role: string; connected: boolean }

export type LatLng = [number, number]
export type TrackedCar = {
  orderId: string; orderRef: string; driver: string; car: string; customer: string
  from: { city: string; at: LatLng }; to: { city: string; at: LatLng }; path: LatLng[]; at: LatLng
  status: "moving" | "stopped" | "signal_lost" | "arrived"
  gpsAgeMin: number; gpsAge: string; stoppedSince?: string; stoppedMinutes?: number; stoppedFor: string | null; ruleFired?: boolean; eta?: string | null
  event: null | {
    scenarioId: string; title: string; kind: string; runId?: string; runStatus?: "running" | "quiet" | "card" | "failed"; cardId?: string; quietReason?: string
    stop: StopView | null; steps: StopStep[]
    feed: { state: "upcoming" | "due" | "running" | "card" | "closed" | "failed" | "missed"; label: string; at: string } | null
    checks: CardCheck[]
  }
}
export type TrackingView = { now: string; rule: string; models: StopModel[]; counts: { moving: number; stopped: number; signalLost: number; arrived: number }; cars: TrackedCar[] }

export type BenchRow = {
  model: string; label: string; status: "measured" | "not_configured" | "failed"; note?: string
  perQuestion: Record<string, { n: number; correct: number; caught: number; traps: number; falseAlarms: number; negatives: number }>
  catchRate?: number; falseAlarmRate?: number; calibrationError?: number; costPer1000?: number; msPerCheck?: number
}

export type EvalsView = {
  settings: { costLimitEur: number; operator: string }
  canDiscover: boolean
  sets: { id: string; label: string; counts: { test: number; other: number } | null; ranAt: string | null; rows: BenchRow[] }[]
  questionText: Record<string, string>
  live: { id: string; question: string; source: string; version: number; approvedBy: string | null; modelChecked: boolean }[]
  proposed: { id: string; question: string; source: string }[]
  unlabeled: number; labeled: number
}

export type LabelView = {
  left: number
  candidate: null | {
    id: string; source: "operator_reject" | "discovery_agent"; orderRef: string; question: string; options: string[]
    suggested: string | null; action: string; state: { label: string; value: string; source: string; age: string }[]
  }
  /** Unlabelled cases, newest first. Optional, so older control room answers still type-check. */
  waiting?: { id: string; source: LabelSource; orderRef: string; questionId: string; question: string; suggested: string | null; createdAt: string; age: string }[]
  /** The last 20 labelled cases, newest first. */
  recent?: {
    id: string; source: LabelSource; orderRef: string; questionId: string; question: string; suggested: string | null
    label: string; note: string | null; labeledAt: string | null; labeledAge: string | null; labeledBy: string | null
  }[]
  byQuestion?: { questionId: string; question: string; waiting: number; labeled: number; agreed: number }[]
  bySource?: { source: LabelSource; waiting: number; labeled: number }[]
  /** Labelled cases with a suggestion, and how many of them have the suggested label. */
  agreement?: { agreed: number; total: number }
}

type LabelSource = "operator_reject" | "discovery_agent"

export type ChatView = {
  orderRef: string; driver: string; simulatedDriver: boolean
  messages: { id: string; from: "agent" | "driver" | "operator" | "customer" | "system"; text: string; at: string; age: string; simulated: boolean }[]
}

type Loaded<T> = { data: T | null; error: string; offline: boolean; reload: () => void }

/** Reads one control room view. With `poll`, it reads again every 1.5 s, for example while the agent works. */
export function useControl<T>(query: string | null, poll = false): Loaded<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState("")
  const [offline, setOffline] = useState(false)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((value) => value + 1), [])

  useEffect(() => {
    if (!query) return
    const controller = new AbortController()
    fetch(`/api/control?${query}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) { setOffline(Boolean(body.offline)); throw new Error(body.error ?? "Could not load the control room") }
        setData(body as T); setError(""); setOffline(false)
      })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load the control room") })
    return () => controller.abort()
  }, [query, tick])

  // Any action in this tab reads every open view again.
  useEffect(() => {
    window.addEventListener("control-changed", reload)
    return () => window.removeEventListener("control-changed", reload)
  }, [reload])

  useEffect(() => {
    if (!poll) return
    const timer = setInterval(reload, 1500)
    return () => clearInterval(timer)
  }, [poll, reload])

  return { data, error, offline, reload }
}

/** Sends one action to the control room. It throws with the control room's own words when the action fails. */
export async function act<T = { ok: boolean }>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  const out = await response.json()
  if (!response.ok) throw new Error(out.error ?? "The action failed")
  window.dispatchEvent(new Event("control-changed"))
  return out as T
}

const LEFT_TONE: Record<Left["tone"], Tone> = { critical: "danger", warn: "warn", calm: "ok" }

/** Time left before a promise breaks. */
export function LeftChip({ left }: { left: Left }) {
  return <Chip tone={LEFT_TONE[left.tone]} className="shrink-0 tabular-nums"><ClockIcon aria-hidden="true" />{left.text}</Chip>
}

const ESCALATION_ICON = { agent: BotIcon, ops: UserRoundIcon, outside: UsersIcon }

/** Who must answer before the case can move: the agent alone, ops, or the dealer or customer. */
export function EscalationChip({ escalation }: { escalation: Escalation }) {
  const Icon = ESCALATION_ICON[escalation.level]
  return <Chip tone={escalation.level === "outside" ? "warn" : "neutral"} className="shrink-0"><Icon aria-hidden="true" />{escalation.text}</Chip>
}

/** Shown when the control room app does not answer or a view fails to load. */
export function ControlError({ error, offline }: { error: string; offline: boolean }) {
  return <EmptyState className="border py-12">
    <EmptyHeader>
      <EmptyMedia variant="icon"><CircleAlertIcon aria-hidden="true" /></EmptyMedia>
      <EmptyTitle>{offline ? "The control room is not running" : "Could not load this view"}</EmptyTitle>
      <EmptyDescription>{error}</EmptyDescription>
    </EmptyHeader>
  </EmptyState>
}

/** How a decided card ended: approved by a person, run by the agent alone, or rejected. */
export function DecidedChip({ card }: { card: CardRow }) {
  if (card.status === "rejected") return <Chip tone="neutral">Rejected</Chip>
  if (card.escalation.level === "agent") return <Chip tone="ok" className="text-foreground"><BotIcon aria-hidden="true" />Agent acted alone</Chip>
  return <Chip tone="ok" className="text-foreground"><CircleCheckIcon aria-hidden="true" />{card.status === "edited" ? "Edited and approved" : "Approved"}</Chip>
}
