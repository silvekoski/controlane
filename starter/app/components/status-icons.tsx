import type { Tone } from "@/lib/present/types"
import { cn } from "@/lib/utils"

/* Linear-style status rings: the fill grows as the order moves through the lanes. */
const LANE_RING: Record<string, { fill: number; color: string; dashed?: boolean; done?: "check" | "cross" }> = {
  intake: { fill: 0, color: "text-muted-foreground", dashed: true },
  ready: { fill: 0, color: "text-muted-foreground" },
  market: { fill: 0.25, color: "text-warning" },
  booked: { fill: 0.5, color: "text-primary" },
  moving: { fill: 0.75, color: "text-[oklch(0.72_0.15_155)]" },
  delivered: { fill: 1, color: "text-primary", done: "check" },
  cancelled: { fill: 1, color: "text-muted-foreground", done: "cross" },
}

export function LaneIcon({ lane, className }: { lane: string; className?: string }) {
  const ring = LANE_RING[lane] ?? LANE_RING.ready
  const r = 3.5
  const length = 2 * Math.PI * r
  return <svg viewBox="0 0 14 14" className={cn("size-3.5 shrink-0", ring.color, className)} aria-hidden="true">
    {ring.done
      ? <>
        <circle cx="7" cy="7" r="6" fill="currentColor" />
        {ring.done === "check"
          ? <path d="M4.4 7.2 6.2 9l3.4-3.8" fill="none" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          : <path d="m4.8 4.8 4.4 4.4m0-4.4-4.4 4.4" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" />}
      </>
      : <>
        <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={ring.dashed ? "1.6 1.6" : undefined} />
        {ring.fill > 0 && <circle cx="7" cy="7" r={r / 2} fill="none" stroke="currentColor" strokeWidth={r} strokeDasharray={`${length * ring.fill / 2} ${length}`} transform="rotate(-90 7 7)" />}
      </>}
  </svg>
}

/* Linear-style priority: a filled mark for danger, bars for the rest, dots when nothing waits. */
export function PriorityIcon({ tone, waiting, className }: { tone: Tone; waiting: number; className?: string }) {
  const label = waiting === 0 ? "Nothing waits on a person" : `${waiting} ${waiting === 1 ? "item needs" : "items need"} a person`
  if (waiting > 0 && tone === "danger") return <svg viewBox="0 0 14 14" className={cn("size-3.5 shrink-0 text-danger", className)} role="img" aria-label={label}>
    <rect x="1" y="1" width="12" height="12" rx="3" fill="currentColor" />
    <path d="M7 3.8v3.6" stroke="var(--background)" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="7" cy="9.9" r="0.95" fill="var(--background)" />
  </svg>
  if (waiting === 0) return <svg viewBox="0 0 14 14" className={cn("size-3.5 shrink-0 text-muted-foreground/60", className)} role="img" aria-label={label}>
    {[3, 7, 11].map((x) => <circle key={x} cx={x} cy="7" r="0.9" fill="currentColor" />)}
  </svg>
  const level = tone === "warn" ? 3 : tone === "accent" ? 2 : 1
  return <svg viewBox="0 0 14 14" className={cn("size-3.5 shrink-0 text-foreground/80", className)} role="img" aria-label={label}>
    {[0, 1, 2].map((index) => <rect key={index} x={2 + index * 4} y={9 - index * 3} width="2.2" height={3 + index * 3} rx="0.6" fill="currentColor" opacity={index < level ? 1 : 0.3} />)}
  </svg>
}

export const TONE_DOT: Record<Tone, string> = {
  danger: "bg-danger",
  warn: "bg-warning",
  accent: "bg-primary",
  ok: "bg-[oklch(0.72_0.15_155)]",
  neutral: "bg-muted-foreground/60",
}
