import type { CSSProperties, ReactNode } from "react"
import { Easing, interpolate, useCurrentFrame } from "remotion"
import { evolvePath } from "@remotion/paths"
import { BOUNCE, SNAPPY, SOFT, useEase, useExit, usePulse, useSpr } from "./motion"
import { C, CARD_SHADOW, F, TONE, type ToneName } from "./theme"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

// ---------- entrance wrapper ----------
type PopProps = {
  at: number; out?: number; x?: number; y?: number; w?: number; h?: number; from?: "scale" | "up" | "left" | "right" | "flip"
  children?: ReactNode; style?: CSSProperties; config?: typeof SOFT; dim?: number
}
export const Pop = ({ at, out, x, y, w, h, from = "scale", children, style, config = SOFT, dim }: PopProps) => {
  const s = useSpr(at, config)
  const ex = useExit(out)
  const opacity = Math.min(1, Math.max(0, s * 1.4)) * ex * (dim ?? 1)
  const t = {
    scale: `scale(${0.9 + 0.1 * s})`,
    up: `translateY(${(1 - s) * 40}px)`,
    left: `translateX(${(1 - s) * -80}px)`,
    right: `translateX(${(1 - s) * 80}px)`,
    flip: `perspective(1200px) rotateX(${(1 - s) * 70}deg)`,
  }[from]
  const exitShift = out !== undefined ? `translateY(${(1 - ex) * -24}px)` : ""
  return (
    <div style={{ position: x !== undefined ? "absolute" : "relative", left: x, top: y, width: w, height: h, ...style, opacity, transform: `${t} ${exitShift}` }}>
      {children}
    </div>
  )
}

// ---------- primitives ----------
export const Chip = ({ tone = "neutral", children, size = 26 }: { tone?: ToneName; children: ReactNode; size?: number }) => (
  <span style={{ display: "inline-flex", alignItems: "center", height: size * 1.6, padding: `0 ${size * 0.7}px`, borderRadius: 999, fontFamily: F.body, fontWeight: 500, fontSize: size, background: TONE[tone].bg, color: TONE[tone].fg, whiteSpace: "nowrap" }}>
    {children}
  </span>
)
export const Badge = ({ n, size = 72, dark = true }: { n: number | string; size?: number; dark?: boolean }) => (
  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: "50%", background: dark ? C.ink : C.birch, color: dark ? C.birch : C.ink, fontFamily: F.display, fontWeight: 600, fontSize: size * 0.46, flex: "none" }}>{n}</span>
)
export const Card = ({ children, style, tone }: { children?: ReactNode; style?: CSSProperties; tone?: ToneName }) => (
  <div style={{ background: tone ? TONE[tone].bg : C.birch, borderRadius: 24, boxShadow: tone && tone !== "neutral" ? `0 0 0 3px ${TONE[tone].line}` : CARD_SHADOW, padding: 32, fontFamily: F.body, color: C.ink, ...style }}>{children}</div>
)
export const Box = ({ tone = "neutral", children, style }: { tone?: ToneName; children: ReactNode; style?: CSSProperties }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", borderRadius: 18, padding: "18px 26px", fontFamily: F.body, fontWeight: 600, fontSize: 30, background: TONE[tone].bg, color: TONE[tone].fg, ...style }}>{children}</div>
)
export const Caps = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 22, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, ...style }}>{children}</div>
)
export const Txt = ({ children, size = 32, weight = 400, color = C.ink, style }: { children: ReactNode; size?: number; weight?: number; color?: string; style?: CSSProperties }) => (
  <div style={{ fontFamily: F.body, fontSize: size, fontWeight: weight, color, lineHeight: 1.3, ...style }}>{children}</div>
)
export const Disp = ({ children, size = 64, color = C.ink, style }: { children: ReactNode; size?: number; color?: string; style?: CSSProperties }) => (
  <div style={{ fontFamily: F.display, fontWeight: 600, fontSize: size, letterSpacing: "-0.02em", lineHeight: 1.1, color, ...style }}>{children}</div>
)
export const Btn = ({ children, primary, hover }: { children: ReactNode; primary?: boolean; hover?: boolean }) => (
  <span style={{ display: "inline-flex", alignItems: "center", height: 64, padding: "0 32px", borderRadius: 10, fontFamily: F.body, fontWeight: 500, fontSize: 26, background: primary ? C.ink : C.hairSoft, color: primary ? C.birch : C.ink, boxShadow: hover ? `0 0 0 4px ${C.teal}` : undefined }}>{children}</span>
)

/** Headline that enters word by word. */
export const Headline = ({ words, at, size = 96, color = C.ink, gap = 5, style, out }: { words: string[]; at: number; size?: number; color?: string; gap?: number; style?: CSSProperties; out?: number }) => (
  <div style={{ display: "flex", flexWrap: "wrap", columnGap: size * 0.28, rowGap: 0, ...style }}>
    {words.map((w, i) => (
      <Pop key={i} at={at + i * gap} out={out} from="up" config={SNAPPY}>
        <Disp size={size} color={color} style={{ textTransform: "uppercase" }}>{w}</Disp>
      </Pop>
    ))}
  </div>
)

/** Typed text. */
export const Typed = ({ text, at, cps = 28 }: { text: string; at: number; cps?: number }) => {
  const f = useCurrentFrame()
  const n = Math.max(0, Math.min(text.length, Math.floor(((f - at) / 30) * cps)))
  return <>{text.slice(0, n)}{n < text.length && n > 0 ? "▍" : ""}</>
}

/** Rating dots that fill one by one. */
export const Dots = ({ n, at, max = 3, size = 28 }: { n: number; at: number; max?: number; size?: number }) => {
  const f = useCurrentFrame()
  return (
    <span style={{ display: "inline-flex", gap: 10 }}>
      {Array.from({ length: max }, (_, i) => {
        const on = i < n && f >= at + i * 6
        const s = on ? Math.min(1, (f - at - i * 6) / 6) : 0
        return <i key={i} style={{ width: size, height: size, borderRadius: "50%", background: on ? C.ink : C.hair, transform: `scale(${on ? 0.7 + 0.3 * s : 1})` }} />
      })}
    </span>
  )
}
export const CRITERIA = ["Brief fit", "Bahn's pain", "Control room", "Demo with packet", "New idea", "Low risk"]
export const ScoreStrip = ({ scores, at }: { scores: number[]; at: number }) => (
  <Pop at={at} x={96} y={956} w={1728} h={96} from="up">
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", alignItems: "center", height: 96, borderRadius: 20, background: C.tray, boxShadow: CARD_SHADOW, padding: "0 36px" }}>
      {CRITERIA.map((c, i) => (
        <div key={c} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontFamily: F.body, fontSize: 20, color: C.muted }}>{c}</span>
          <Dots n={scores[i]} at={at + 6 + i * 4} />
        </div>
      ))}
    </div>
  </Pop>
)

// ---------- SVG drawing ----------
export const Svg = ({ children }: { children: ReactNode }) => (
  <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", left: 0, top: 0 }}>{children}</svg>
)
/** A line that draws on, from `at`, over `dur` frames. Dashed lines use a draw-on mask. */
export const DrawPath = ({ d, at, dur = 24, stroke = C.sand, width = 6, dashed, arrow, out, id }: { d: string; at: number; dur?: number; stroke?: string; width?: number; dashed?: boolean; arrow?: boolean; out?: number; id: string }) => {
  const f = useCurrentFrame()
  const p = interpolate(f, [at, at + dur], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) })
  const ev = evolvePath(p, d)
  const ex = useExit(out)
  if (f < at) return null
  return (
    <g opacity={ex}>
      {dashed ? (
        <>
          <mask id={`m-${id}`} maskUnits="userSpaceOnUse" x={0} y={0} width={1920} height={1080}><path d={d} fill="none" stroke="white" strokeWidth={width + 8} strokeLinecap="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} /></mask>
          <path d={d} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeDasharray={`2 ${width * 2.4}`} mask={`url(#m-${id})`} />
        </>
      ) : (
        <path d={d} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />
      )}
      {arrow && p > 0.98 && <ArrowHead d={d} stroke={stroke} size={width * 3} />}
    </g>
  )
}
// Arrow head at the end of the path (approximated from the last segment).
const ArrowHead = ({ d, stroke, size }: { d: string; stroke: string; size: number }) => {
  const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number)
  const [x2, y2, x1, y1] = [nums[nums.length - 2], nums[nums.length - 1], nums[nums.length - 4], nums[nums.length - 3]]
  const a = Math.atan2(y2 - y1, x2 - x1)
  const p = (da: number) => `${x2 - size * Math.cos(a + da)},${y2 - size * Math.sin(a + da)}`
  return <polyline points={`${p(0.5)} ${x2},${y2} ${p(-0.5)}`} fill="none" stroke={stroke} strokeWidth={size / 3} strokeLinecap="round" strokeLinejoin="round" />
}
export const Dot = ({ x, y, r = 18, color = C.ink, at, ring }: { x: number; y: number; r?: number; color?: string; at: number; ring?: string }) => {
  const s = useSpr(at, BOUNCE)
  return <circle cx={x} cy={y} r={r * s} fill={color} stroke={ring ?? C.birch} strokeWidth={6} />
}
/** The route line spine: a smooth curve across the screen. */
export const RouteLine = ({ d, at, dur = 40, stroke = C.ink, width = 8, id, out }: { d: string; at: number; dur?: number; stroke?: string; width?: number; id: string; out?: number }) => (
  <Svg><DrawPath d={d} at={at} dur={dur} stroke={stroke} width={width} id={id} out={out} /></Svg>
)

// ---------- characters ----------
export const CarIcon = ({ x, y, scale = 1, rot = 0, color = C.ink, alert }: { x: number; y: number; scale?: number; rot?: number; color?: string; alert?: boolean }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${scale})`}>
    <path d="M-84 24 Q-84 8 -66 4 L-42 -2 Q-32 -34 -4 -36 H28 Q48 -36 58 -10 L80 -2 Q92 2 92 18 V30 H-84 Z" fill={color} />
    <path d="M-32 -6 Q-26 -27 -6 -28 H8 V-6 Z M18 -28 H28 Q40 -28 48 -6 H18 Z" fill={C.birch} opacity={0.92} />
    <circle cx={-48} cy={32} r={19} fill={C.birch} stroke={color} strokeWidth={10} />
    <circle cx={52} cy={32} r={19} fill={C.birch} stroke={color} strokeWidth={10} />
    {alert && <circle cx={4} cy={-52} r={10} fill={C.red} />}
  </g>
)
export const DriverFigure = ({ x, y, scale = 1, color = C.ink }: { x: number; y: number; scale?: number; color?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`} fill={color}>
    <circle cx={0} cy={-46} r={16} />
    <path d="M-22 40 V-10 Q-22 -22 -10 -22 H10 Q22 -22 22 -10 V40 H10 V12 H-10 V40Z" />
  </g>
)
export const PersonIcon = ({ size = 64, color = C.brown }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4.5 4-6 8-6s7 1.5 8 6" /></svg>
)
export const Glyph = ({ kind, size = 56, color = C.brown }: { kind: "search" | "pin" | "chat" | "coin" | "calendar" | "bubble" | "check" | "plane" | "train" | "cup" | "warn" | "pump" | "phone" | "bus" | "taxi" | "scooter" | "signal" | "head" | "ferry" | "stick"; size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {kind === "search" && <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l5 5" /></>}
    {kind === "pin" && <><path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>}
    {kind === "chat" && <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 10h8" /></>}
    {kind === "coin" && <><circle cx="12" cy="12" r="9" /><path d="M15 9.5a3.5 3.5 0 100 5M8 11h5M8 13.5h5" /></>}
    {kind === "calendar" && <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>}
    {kind === "bubble" && <><path d="M4 5h16v11H9l-5 4z" /></>}
    {kind === "check" && <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></>}
    {kind === "plane" && <path d="M2 14l8-2-3-8h2l6 7 6-1.5c1 0 1.5 1.5 0 2L15 15l-3 6h-2l1-6-7-1z" />}
    {kind === "train" && <><rect x="5" y="3" width="14" height="14" rx="3" /><path d="M5 11h14M8 21l2-4M16 21l-2-4" /><circle cx="9" cy="14" r="0.6" /><circle cx="15" cy="14" r="0.6" /></>}
    {kind === "cup" && <><path d="M5 8h11v6a4 4 0 01-4 4H9a4 4 0 01-4-4z" /><path d="M16 9h2a2 2 0 010 5h-2M8 3v2M12 3v2" /></>}
    {kind === "warn" && <><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" /></>}
    {kind === "pump" && <><rect x="5" y="3" width="9" height="18" rx="1.5" /><path d="M5 9h9M14 8l4 2v8a1.5 1.5 0 003 0V9l-3-3" /></>}
    {kind === "phone" && <><rect x="7" y="2" width="10" height="20" rx="2.5" /><path d="M11 18.5h2" /></>}
    {kind === "bus" && <><rect x="4" y="4" width="16" height="13" rx="2.5" /><path d="M4 11h16M7 20v-3M17 20v-3" /></>}
    {kind === "taxi" && <><path d="M3 15l2-6a2 2 0 012-1.5h10A2 2 0 0119 9l2 6v4H3z" /><path d="M9 5h6" /><circle cx="7.5" cy="15.5" r="1" /><circle cx="16.5" cy="15.5" r="1" /></>}
    {kind === "scooter" && <><circle cx="6" cy="18" r="3" /><circle cx="19" cy="18" r="3" /><path d="M9 18h7l-3-12h-3M13 6h4" /></>}
    {kind === "signal" && <path d="M5 19v-3M10 19v-7M15 19v-11M20 19V5" />}
    {kind === "head" && <path d="M7 20v-4C4 14 4 8 8 5s10-1 11 4c0 2-1 3-2 4v3l-3 1v3z" />}
    {kind === "ferry" && <><path d="M3 15l2 5h14l2-5zM6 15V9h12v6M10 9V5h4v4" /></>}
    {kind === "stick" && <><rect x="8" y="2" width="8" height="12" rx="2" /><path d="M10 14v6h4v-6M10 6h4" /></>}
  </svg>
)

export const Lock = ({ x, y, at, size = 72 }: { x: number; y: number; at: number; size?: number }) => {
  const s = useSpr(at, BOUNCE)
  const lift = interpolate(s, [0, 1], [-14, 0], clamp)
  return (
    <svg style={{ position: "absolute", left: x, top: y, opacity: Math.min(1, s * 2) }} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d={`M8 11V8a4 4 0 018 0v3`} transform={`translate(0 ${lift})`} stroke={C.orangeInk} strokeWidth={2} strokeLinecap="round" />
      <rect x="5" y="11" width="14" height="10" rx="2.5" fill={C.orange} />
      <circle cx="12" cy="16" r="1.4" fill={C.birch} />
    </svg>
  )
}

export const Cursor = ({ path, clicks = [] }: { path: { f: number; x: number; y: number }[]; clicks?: number[] }) => {
  const f = useCurrentFrame()
  if (f < path[0].f) return null
  const xs = path.map((p) => p.f)
  const x = interpolate(f, xs, path.map((p) => p.x), { ...clamp, easing: Easing.inOut(Easing.cubic) })
  const y = interpolate(f, xs, path.map((p) => p.y), { ...clamp, easing: Easing.inOut(Easing.cubic) })
  const pop = interpolate(f, [path[0].f, path[0].f + 8], [0, 1], clamp)
  const click = clicks.find((c) => f >= c && f < c + 14)
  return (
    <>
      {click !== undefined && <div style={{ position: "absolute", left: x - 30, top: y - 30, width: 60, height: 60, borderRadius: "50%", border: `4px solid ${C.teal}`, transform: `scale(${(f - click) / 14 + 0.3})`, opacity: 1 - (f - click) / 14 }} />}
      <svg style={{ position: "absolute", left: x, top: y, opacity: pop, transform: `scale(${click !== undefined && f - click < 5 ? 0.85 : 1})`, filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.25))" }} width={44} height={44} viewBox="0 0 24 24">
        <path d="M5 3l14 8-6 1.6L9.6 19z" fill={C.ink} stroke={C.birch} strokeWidth={1.4} strokeLinejoin="round" />
      </svg>
    </>
  )
}

export const PhoneFrame = ({ x, y, w = 340, h = 600, at, out, children }: { x: number; y: number; w?: number; h?: number; at: number; out?: number; children?: ReactNode }) => (
  <Pop at={at} out={out} x={x} y={y} w={w} h={h} from="up">
    <div style={{ width: w, height: h, border: `9px solid ${C.ink}`, borderRadius: 54, background: C.birch, padding: "56px 28px 28px", display: "flex", flexDirection: "column", gap: 20, alignItems: "center", fontFamily: F.body, boxShadow: "0 24px 40px rgba(66,61,51,0.18)" }}>{children}</div>
  </Pop>
)

export const ChatBubble = ({ text, at, x, y, w = 760, side = "left", tone, size = 30, typed = true, out }: { text: string; at: number; x: number; y: number; w?: number; side?: "left" | "right"; tone?: ToneName; size?: number; typed?: boolean; out?: number }) => (
  <Pop at={at} out={out} x={x} y={y} w={w} from={side === "left" ? "left" : "right"}>
    <div style={{ borderRadius: 28, padding: "20px 28px", fontFamily: F.body, fontSize: size, background: TONE[tone ?? (side === "left" ? "teal" : "neutral")].bg, color: TONE[tone ?? (side === "left" ? "teal" : "neutral")].fg, minHeight: size * 2 }}>
      {typed ? <Typed text={text} at={at + 4} cps={40} /> : text}
    </div>
  </Pop>
)

export const QuoteCard = ({ text, tag, at, out, x = 96, y = 820, w = 1000 }: { text: string; tag: string; at: number; out?: number; x?: number; y?: number; w?: number }) => (
  <Pop at={at} out={out} x={x} y={y} w={w} from="left">
    <div style={{ background: C.tealBg, color: C.tealInk, borderRadius: 24, padding: "24px 32px", fontFamily: F.body, fontSize: 30, fontStyle: "italic", lineHeight: 1.35 }}>
      &ldquo;{text}&rdquo;
      <span style={{ display: "block", marginTop: 8, fontFamily: F.mono, fontStyle: "normal", fontSize: 22, fontWeight: 500 }}>What Bahn said · {tag}</span>
    </div>
  </Pop>
)

export const OptionCard = ({ label, time, cost, at, x, y, w = 360, tone, hi, rot = 0 }: { label: string; time: string; cost: string; at: number; x: number; y: number; w?: number; tone?: ToneName; hi?: boolean; rot?: number }) => (
  <Pop at={at} x={x} y={y} w={w} from="up">
    <div style={{ transform: `rotate(${rot}deg)` }}>
      <Card tone={hi ? "teal" : tone} style={{ padding: "26px 30px" }}>
        <Txt size={30} weight={600} color={hi ? C.tealInk : C.ink}>{label}</Txt>
        <Txt size={34} style={{ marginTop: 10 }} color={C.brown}>{time}</Txt>
        <Txt size={34} weight={600} style={{ marginTop: 4 }} color={C.orangeInk}>{cost}</Txt>
      </Card>
    </div>
  </Pop>
)

export const Stopwatch = ({ x, y, at, out, from, to, dur = 45, unit = "min", size = 150 }: { x: number; y: number; at: number; out?: number; from: number; to: number; dur?: number; unit?: string; size?: number }) => {
  const f = useCurrentFrame()
  const v = Math.round(interpolate(f, [at, at + dur], [from, to], { ...clamp, easing: Easing.out(Easing.cubic) }))
  const p = interpolate(f, [at, at + dur], [0, 1], clamp)
  const r = size / 2 - 8
  return (
    <Pop at={at} out={out} x={x} y={y} w={size} h={size}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill={C.birch} stroke={C.hair} strokeWidth={10} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.orange} strokeWidth={10} strokeLinecap="round" strokeDasharray={2 * Math.PI * r} strokeDashoffset={2 * Math.PI * r * (1 - p)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontFamily={F.display} fontWeight={600} fontSize={size * 0.3} fill={C.ink}>{v}</text>
        <text x={size / 2} y={size / 2 + size * 0.22} textAnchor="middle" fontFamily={F.body} fontSize={size * 0.15} fill={C.muted}>{unit}</text>
      </svg>
    </Pop>
  )
}

export const Pin = ({ n, x, y, at, size = 64 }: { n: number | string; x: number; y: number; at: number; size?: number }) => {
  const s = useSpr(at, BOUNCE)
  const drop = (1 - s) * -160
  return (
    <div style={{ position: "absolute", left: x - size / 2, top: y - size / 2 + drop, opacity: Math.min(1, s * 3) }}>
      <Badge n={n} size={size} />
    </div>
  )
}

export type LogLine = { at: number; fn: string; out: string; tone?: ToneName }
/** Technical agent activity: tool calls with their results, newest at the bottom. */
export const AgentLog = ({ at, out, x = 96, y = 726, w = 640, lines, max = 4 }: { at: number; out?: number; x?: number; y?: number; w?: number; lines: LogLine[]; max?: number }) => {
  const f = useCurrentFrame()
  const shown = lines.filter((l) => f >= l.at).slice(-max)
  return (
    <Pop at={at} out={out} x={x} y={y} w={w} from="up">
      <div style={{ background: C.tray, borderRadius: 20, boxShadow: CARD_SHADOW, padding: "16px 22px", height: 56 + max * 38 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: F.body, fontWeight: 600, fontSize: 18, letterSpacing: "0.1em", textTransform: "uppercase", color: C.tealInk }}>
          <i style={{ width: 10, height: 10, borderRadius: "50%", background: C.teal, display: "inline-block" }} />Agent · tool calls
        </div>
        <div style={{ marginTop: 10 }}>
          {shown.map((l) => {
            const done = f >= l.at + 10
            return (
              <div key={l.fn} style={{ display: "flex", gap: 10, height: 38, alignItems: "center", fontFamily: F.mono, fontSize: 20, whiteSpace: "nowrap", opacity: Math.min(1, (f - l.at) / 5) }}>
                <span style={{ color: done ? C.greenInk : C.muted, width: 22 }}>{done ? "✓" : "…"}</span>
                <span style={{ color: C.tealInk }}>{l.fn}</span>
                <span style={{ color: l.tone === "orange" ? C.orangeInk : C.brown, overflow: "hidden", textOverflow: "ellipsis" }}>{done ? `→ ${l.out}` : ""}</span>
              </div>
            )
          })}
        </div>
      </div>
    </Pop>
  )
}

export const DecisionCard = ({ at, out, x, y, w = 900, rows, hover = -1, clickAt, pulse = true, label = "Decision card", extra }: { at: number; out?: number; x: number; y: number; w?: number; rows: [string, string][]; hover?: number; clickAt?: number; pulse?: boolean; label?: string; extra?: ReactNode }) => {
  const f = useCurrentFrame()
  const p = usePulse(pulse && f > at + rows.length * 10 + 20)
  return (
    <Pop at={at} out={out} x={x} y={y} w={w} from="flip">
      <div style={{ transform: `scale(${p})`, transformOrigin: "center" }}>
        <Card style={{ padding: "30px 36px" }}>
          <Caps>{label}</Caps>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map(([k, v], i) => {
              const on = f >= at + 14 + i * 10
              return (
                <div key={k} style={{ opacity: on ? 1 : 0, transform: `translateY(${on ? 0 : 10}px)`, fontFamily: F.body, fontSize: 28, color: C.brown, lineHeight: 1.3 }}>
                  <b style={{ color: C.ink }}>{k}</b> &nbsp;{v}
                </div>
              )
            })}
          </div>
          {extra}
          <div style={{ marginTop: 26, display: "flex", gap: 16, opacity: f >= at + 14 + rows.length * 10 ? 1 : 0 }}>
            <Btn primary hover={hover === 0}>Accept</Btn><Btn hover={hover === 1}>Change</Btn><Btn hover={hover === 2}>Reject + why</Btn>
          </div>
        </Card>
      </div>
    </Pop>
  )
}

/** Title block for the first beat of an idea scene. It slams in, then tucks to the top-left. */
export const IdeaTitle = ({ n, name, tags, sub, tuckAt }: { n: number; name: string; tags: [string, ToneName][]; sub: string; tuckAt: number }) => {
  const s = useSpr(2, SNAPPY)
  const t = useEase(tuckAt, tuckAt + 16)
  const scale = 1 - 0.58 * t
  const top = 360 - 310 * t
  return (
    <div style={{ position: "absolute", left: 96, top, transformOrigin: "top left", transform: `scale(${scale})`, opacity: Math.min(1, s * 2) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 40, transform: `translateX(${(1 - s) * -120}px)` }}>
        <Badge n={n} size={190} />
        <Disp size={104} style={{ textTransform: "uppercase", maxWidth: 1400 }}>{name}</Disp>
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 36 }}>
        {tags.map(([l, tone], i) => <Pop key={l} at={14 + i * 5} from="up"><Chip tone={tone} size={30}>{l}</Chip></Pop>)}
      </div>
      <Pop at={22} from="up">
        <Txt size={40} color={C.muted} style={{ marginTop: 28, opacity: 1 - t }}>{sub}</Txt>
      </Pop>
    </div>
  )
}

/** SVG group that fades in at `at` and out at `out`. */
export const G = ({ at = 0, out, children, opacity = 1 }: { at?: number; out?: number; children: ReactNode; opacity?: number }) => {
  const s = useSpr(at)
  const ex = useExit(out)
  return <g opacity={Math.min(1, s * 2) * ex * opacity}>{children}</g>
}
