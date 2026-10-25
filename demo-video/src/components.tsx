import "@fontsource-variable/inter"
import "@fontsource-variable/jetbrains-mono"
import React from "react"
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion"
import { C, F, H, W, WIN } from "./lib/tokens"
import { captions } from "./lib/timing"
import { ease, keyed, UI } from "./lib/motion"
import { GLYPHS } from "./lib/logo-glyphs"

export type Cam = { at: number; z?: number; cx?: number; cy?: number; sy?: number }
export type Spot = { at: number; x?: number; y?: number; w?: number; h?: number; o?: number }
export type Pointer = { at: number; x: number; y: number }

const fillCam = (keys: Cam[]) => {
  const out: Required<Cam>[] = []
  let prev: Required<Cam> = { at: 0, z: 1, cx: 720, cy: 450, sy: 0 }
  for (const k of [...keys].sort((a, b) => a.at - b.at)) out.push((prev = { ...prev, ...k }))
  return out.length ? out : [prev]
}
const fillSpot = (keys: Spot[]) => {
  const out: Required<Spot>[] = []
  let prev: Required<Spot> = { at: 0, x: 0, y: 0, w: 1440, h: 900, o: 0 }
  for (const k of [...keys].sort((a, b) => a.at - b.at)) out.push((prev = { ...prev, o: 1, ...k }))
  return out.length ? out : [prev]
}

/**
 * One UI capture in a window frame. The camera zooms on a point of the capture, at most 1.5x.
 * The spotlight dims everything outside one rectangle. The cursor moves in capture coordinates.
 * `imgH` is the capture height in CSS px.
 */
export const Shot: React.FC<{
  src: string; imgH?: number; cam?: Cam[]; spot?: Spot[]; pointer?: Pointer[]; clicks?: number[]
  style?: React.CSSProperties; children?: React.ReactNode; dark?: boolean
}> = ({ src, imgH = 900, cam = [], spot = [], pointer, clicks = [], style, children, dark }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const c = keyed(frame, fps, fillCam(cam) as never[], UI) as Required<Omit<Cam, "at">>
  const s = keyed(frame, fps, fillSpot(spot) as never[], UI) as Required<Omit<Spot, "at">>
  const z = Math.min(1.5, c.z)
  const tx = Math.min(0, Math.max(WIN.w - WIN.w * z, WIN.w / 2 - c.cx * z))
  const ty = Math.min(0, Math.max(WIN.h - WIN.h * z, WIN.h / 2 - (c.cy - c.sy) * z))
  const p = pointer ? keyed(frame, fps, pointer.map((k) => ({ ...k })) as never[], { damping: 200 }, 40) as { x: number; y: number } : null
  const toScreen = (x: number, y: number) => ({ x: tx + x * z, y: ty + (y - c.sy) * z })
  return (
    <div style={{ position: "absolute", left: WIN.x, top: WIN.y, width: WIN.w, height: WIN.h, ...style }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 14, overflow: "hidden", background: dark ? "#171719" : C.canvas, boxShadow: `0 0 0 1px ${dark ? "#2a2a2e" : C.border}, 0 24px 60px -24px rgba(24,24,27,0.18), 0 2px 6px rgba(24,24,27,0.05)` }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: WIN.w, height: WIN.h, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${z})` }}>
          <div style={{ position: "absolute", left: 0, top: -c.sy, width: WIN.w, height: imgH }}>
            <Img src={staticFile(src)} style={{ width: WIN.w, height: imgH, display: "block" }} />
          </div>
          {/* On a tall capture the sidebar and the top bar stay still while the page scrolls, as in the app. */}
          {imgH > WIN.h && <>
            <Crop src={src} imgH={imgH} x={0} y={0} w={SIDEBAR} h={WIN.h - FOOTER} />
            <Crop src={src} imgH={imgH} x={0} y={imgH - FOOTER} w={SIDEBAR} h={FOOTER} top={WIN.h - FOOTER} />
            <Crop src={src} imgH={imgH} x={SIDEBAR} y={0} w={WIN.w - SIDEBAR} h={TOPBAR} />
          </>}
          <div style={{ position: "absolute", left: 0, top: -c.sy, width: WIN.w, height: imgH }}>
            {s.o > 0.001 && (
              <div style={{ position: "absolute", left: s.x, top: s.y, width: s.w, height: s.h, borderRadius: 8, opacity: s.o,
                boxShadow: `0 0 0 ${2 / z}px ${C.accent}, 0 0 0 5000px rgba(249,249,250,0.62)` }} />
            )}
            {children}
          </div>
        </div>
      </div>
      {p && <Cursor {...toScreen(p.x, p.y)} clicks={clicks} />}
    </div>
  )
}

const SIDEBAR = 257
const TOPBAR = 53
const FOOTER = 64

/** A part of a capture, shown at its own place (or at `top`). */
export const Crop: React.FC<{ src: string; imgH: number; x: number; y: number; w: number; h: number; top?: number; left?: number; scale?: number; style?: React.CSSProperties }> = ({ src, imgH, x, y, w, h, top = y, left = x, scale = 1, style }) => (
  <div style={{ position: "absolute", left, top, width: w * scale, height: h * scale, overflow: "hidden", ...style }}>
    <Img src={staticFile(src)} style={{ position: "absolute", left: -x * scale, top: -y * scale, width: WIN.w * scale, height: imgH * scale, maxWidth: "none" }} />
  </div>
)

/** A slow cursor with a soft ripple on each click frame. */
export const Cursor: React.FC<{ x: number; y: number; clicks: number[] }> = ({ x, y, clicks }) => {
  const frame = useCurrentFrame()
  const last = [...clicks].reverse().find((c) => frame >= c)
  const t = last === undefined ? 99 : frame - last
  const press = t < 6 ? 1 - 0.12 * Math.sin((t / 6) * Math.PI) : 1
  return (
    <div style={{ position: "absolute", left: x, top: y, pointerEvents: "none" }}>
      {t < 22 && <div style={{ position: "absolute", left: -28, top: -28, width: 56, height: 56, borderRadius: 99, border: `2px solid ${C.accent}`,
        opacity: interpolate(t, [0, 22], [0.7, 0]), transform: `scale(${interpolate(t, [0, 22], [0.3, 1.3])})` }} />}
      <svg width="30" height="34" viewBox="0 0 30 34" style={{ transform: `scale(${press})`, transformOrigin: "0 0", filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.25))" }}>
        <path d="M2 2 L2 27 L8.5 21 L13 31 L17.5 29 L13 19.5 L22 19.5 Z" fill="#18181b" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

/** Burned-in captions under the window. Real spellings, one chunk at a time. */
export const Captions: React.FC<{ id: string }> = ({ id }) => {
  const frame = useCurrentFrame()
  const chunks = captions(id)
  const i = chunks.findIndex((c, k) => frame >= c.from - 3 && frame < (chunks[k + 1]?.from ?? c.to + 18) - 3)
  if (i < 0) return null
  const c = chunks[i]
  const o = Math.min(ease(frame, c.from - 3, c.from + 3), i === chunks.length - 1 ? ease(frame, c.to + 10, c.to + 18, 1, 0) : 1)
  return (
    <div style={{ position: "absolute", left: 160, right: 160, top: 944, height: 128, display: "flex", alignItems: "center", justifyContent: "center", opacity: o }}>
      <div style={{ fontFamily: F.sans, fontSize: 44, lineHeight: 1.22, fontWeight: 500, letterSpacing: "-0.01em", color: C.ink, textAlign: "center", textWrap: "balance" as never, maxWidth: 1560 }}>{c.text}</div>
    </div>
  )
}

/** The idea of the scene, in the judges' words, in the left gutter. */
export const SceneLabel: React.FC<{ n: number; text: string; children?: React.ReactNode; light?: boolean }> = ({ n, text, children, light }) => {
  const frame = useCurrentFrame()
  const o = ease(frame, 6, 20)
  return (
    <div style={{ position: "absolute", left: 40, top: 40, width: 176, opacity: o, transform: `translateY(${(1 - o) * 8}px)` }}>
      <div style={{ fontFamily: F.mono, fontSize: 15, color: light ? "rgba(255,255,255,0.6)" : C.muted, letterSpacing: "0.04em" }}>{String(n).padStart(2, "0")}</div>
      <div style={{ marginTop: 6, fontFamily: F.sans, fontSize: 22, lineHeight: 1.2, fontWeight: 600, color: light ? "#fff" : C.ink, letterSpacing: "-0.01em" }}>{text}</div>
      {children}
    </div>
  )
}

/** App-style chip. */
export const Chip: React.FC<{ tone?: "neutral" | "warn" | "danger" | "ok" | "accent" | "info"; children: React.ReactNode; style?: React.CSSProperties; size?: number }> = ({ tone = "neutral", children, style, size = 22 }) => {
  const t = { neutral: [C.secondary, C.ink, C.border], warn: [C.warningSoft, "#b45309", "#f6d7ad"], danger: [C.dangerSoft, "#c1000a", "#f7c3c5"], ok: [C.okSoft, "#0f7a53", "#bfe8d8"], accent: [C.accentSoft, "#3f45b0", "#d3d5f5"], info: ["#eaf2fc", "#1d5fae", "#c6dbf5"] }[tone]
  return <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.4, padding: `${size * 0.22}px ${size * 0.5}px`, borderRadius: size * 0.36, background: t[0], color: t[1], boxShadow: `inset 0 0 0 1px ${t[2]}`, fontFamily: F.sans, fontSize: size, fontWeight: 500, lineHeight: 1.2, whiteSpace: "nowrap", ...style }}>{children}</span>
}

/** A card in the app's style. */
export const Card: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => (
  <div style={{ background: C.card, borderRadius: 12, boxShadow: `0 0 0 1px ${C.border}, 0 12px 32px -16px rgba(24,24,27,0.16)`, ...style }}>{children}</div>
)

export const CornerBug: React.FC = () => (
  <div style={{ position: "absolute", right: 44, top: 42, width: 34, opacity: 0.9 }}><ControlaneSymbol size={34} /></div>
)

const LANE_PATHS = [
  { d: "M 64 48 L 108 4 C 110.7 1.3 113.3 0 117.5 0 L 216 0 Q 220 0 220 4 L 220 40 Q 220 44 216 44 L 132 44 C 128 44 125.5 45.5 123 48 L 94 76 Z", lane: false },
  { d: "M 4 59 L 56 59 C 62 59 65 60.7 69.5 64.5 L 129 109 C 131.5 111 133.5 112 136.5 112 L 216 112 Q 220 112 220 116 L 220 152 Q 220 156 216 156 L 129 156 C 124 156 121.5 154 117.5 151 L 58.7 105.5 C 56.8 104 54 103 51 103 L 4 103 Q 0 103 0 99 L 0 63 Q 0 59 4 59 Z", lane: true },
  { d: "M 4 114 L 51 114 C 55 114 57 115.2 60 117.6 L 116 163 C 120 166.5 124 168 130 168 L 216 168 Q 220 168 220 172 L 220 206 Q 220 210 216 210 L 115 210 C 111 210 108.3 209 105.4 206.5 L 53 163 C 50.6 161 48.5 160 45 160 L 4 160 Q 0 160 0 156 L 0 118 Q 0 114 4 114 Z", lane: false },
]

/** The Controlane lane symbol, from starter/public/brand. `shift` slides each lane in from the left (0 = in place). */
export const ControlaneSymbol: React.FC<{ size: number; shift?: number[]; ink?: string; lane?: string; style?: React.CSSProperties }> = ({ size, shift = [0, 0, 0], ink = C.logoInk, lane = C.accent, style }) => (
  <svg width={size} height={(size * 210) / 220} viewBox="0 0 220 210" style={{ overflow: "visible", ...style }}>
    {LANE_PATHS.map((p, i) => <path key={i} d={p.d} fill={p.lane ? lane : ink} transform={`translate(${shift[i] ?? 0} 0)`} opacity={Math.max(0, 1 - Math.abs(shift[i] ?? 0) / 260)} />)}
  </svg>
)

export const ControlaneLogo: React.FC<{ height: number; dark?: boolean; style?: React.CSSProperties }> = ({ height, dark, style }) => (
  <Img src={staticFile(`logos/controlane-logo-${dark ? "dark" : "light"}.svg`)} style={{ height, width: (height * 1048) / 210, display: "block", ...style }} />
)

/** The Bahn wordmark, traced from the challenge brief (same paths as starter/app/components/brand.tsx). */
export const BahnLogo: React.FC<{ height: number; color?: string }> = ({ height, color = "#12110e" }) => (
  <svg height={height} width={(height * 107) / 24} viewBox="0 0 107 24" fill={color} role="img" aria-label="Bahn">
    <path d="M15.0639 0C18.1124 0 20.5837 2.47173 20.5837 5.52025 20.5836 8.56867 18.1123 11.0401 15.0639 11.0401H5.52439C5.05539 11.0401 4.67519 11.4203 4.67519 11.8893 4.6753 12.3582 5.05546 12.7385 5.52439 12.7385H18.2484C21.2969 12.7385 23.7682 15.2098 23.7682 18.2583 23.7681 21.3068 21.2968 23.7782 18.2484 23.7782H0V19.1075H18.2484C18.7173 19.1075 19.0975 18.7272 19.0976 18.2583 19.0976 17.789299 18.7174 17.4091 18.2484 17.4091H5.52439C2.47594 17.4091 .0046732097 14.9377 .00456116 11.8893 .00456116 8.84077 2.4758802 6.36945 5.52439 6.36945H15.0639C15.5328 6.36945 15.9129 5.98916 15.9131 5.52025 15.9131 5.05125 15.5329 4.67104 15.0639 4.67104H.00124395V0H15.0639Z" />
    <path fillRule="evenodd" d="M36.5034 7.87754C37.9939 6.62935 39.7606 6.10868 41.6774 6.18535 46.4064 6.49007 49.6706 10.5669 49.6706 15.0829 49.6712 19.8787 45.7092 23.9036 40.9265 23.9975 39.1905 23.9583 37.7757 23.3533 36.5034 22.2879V23.7885H31.8328V.0132688H36.5034V7.87754ZM40.7556 10.8373C38.4121 10.8374 36.511 12.7388 36.5113 15.0838 36.5117 17.4283 38.4126 19.3293 40.7556 19.3294 43.0995 19.3294 45.0007 17.4271 45 15.0817 44.9991 12.7375 43.0984 10.8373 40.7556 10.8373Z" />
    <path fillRule="evenodd" d="M59.4381 6.16669C64.3612 6.16669 68.3513 10.1584 68.3531 15.08 68.354 17.9881 68.3524 20.8968 68.3556 23.8051L63.685 23.8047V22.2925C62.3701 23.392 60.9028 24 59.0861 24 54.0516 23.9999 50.5233 19.779 50.5231 15.0838 50.5225 10.2309 54.5793 6.16673 59.4381 6.16669ZM59.4381 10.8373C57.0946 10.8374 55.1935 12.7388 55.1938 15.0838 55.1942 17.4283 57.0951 19.3293 59.4381 19.3294 61.782 19.3294 63.6832 17.4271 63.6825 15.0817 63.6816 12.7375 61.7809 10.8373 59.4381 10.8373Z" />
    <path d="M74.7296 7.67395C76.2792 6.72849 78.0273 6.16669 79.6644 6.16669 83.9793 6.16674 87.4773 9.66501 87.4768 13.98L87.4756 23.7881 82.805 23.7873 82.8008 14.6612C82.6932 12.5313 80.9321 10.8374 78.7754 10.8373 76.5483 10.8373 74.7424 12.6423 74.7417 14.8694L74.7392 23.7885 74.7296 23.7881V23.791H70.059V.0132688H74.7296V7.67395Z" />
    <path d="M98.7578 6.16669C103.073 6.16674 106.571 9.66501 106.57 13.98L106.569 23.7881 101.898 23.7873 101.894 14.6612C101.787 12.5313 100.026 10.8374 97.8688 10.8373 95.6418 10.8373 93.8358 12.6423 93.8351 14.8694L93.8343 23.8047 89.1637 23.8051V23.7869H89.162L89.1637 6.38065 93.8343 6.38023V7.66731C95.381 6.7259399 97.1246 6.16669 98.7578 6.16669Z" />
  </svg>
)

/** A brand mark from public/logos (Simple Icons, taken from each brand's own assets), in one colour, unmodified. */
export const BrandMark: React.FC<{ name: string; size: number; color?: string }> = ({ name, size, color = C.ink }) => (
  <div style={{ width: size, height: size, background: color, WebkitMaskImage: `url(${staticFile(`logos/${name}.svg`)})`, WebkitMaskSize: "contain", WebkitMaskRepeat: "no-repeat", WebkitMaskPosition: "center" }} />
)

/**
 * The signature transition. Three lanes in accent tints sweep in from the left and cover the cut.
 * Then they sweep out to the right. `at` is the cut frame, global.
 */
export const LaneWipe: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame()
  if (frame < at - 16 || frame > at + 16) return null
  const tints = [C.accent, C.accentTop, "#9ca1e8"]
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {tints.map((t, i) => {
        const inP = ease(frame, at - 15 + i * 2, at - 3 + i * 2 - 2)
        const outP = ease(frame, at + i * 2, at + 13 + i * 2)
        const x = frame < at ? (inP - 1) * (W + 200) : outP * (W + 200)
        return <div key={i} style={{ position: "absolute", left: x - 100, top: (H / 3) * i - 2, width: W + 200, height: H / 3 + 4, background: t, borderRadius: 40 }} />
      })}
    </AbsoluteFill>
  )
}

/** Plain-text credit in the style of a logo row, for brands without a logo file here. */
export const Wordmark: React.FC<{ text: string; size: number; color?: string; weight?: number }> = ({ text, size, color = C.ink, weight = 600 }) => (
  <span style={{ fontFamily: F.sans, fontSize: size, fontWeight: weight, color, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{text}</span>
)

/**
 * The Controlane logo, animated. Three light streaks fly in along the lanes and each lane fills behind its streak.
 * The accent lane glows once as it locks. Then the letters of the wordmark rise in, one after the other.
 * `at` is the start frame. The full logo is 1048 x 210 units, drawn at `height` px.
 */
export const AnimatedLogo: React.FC<{ at?: number; height: number; style?: React.CSSProperties }> = ({ at = 0, height, style }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const f = frame - at
  // Lane order: bottom ink, top ink, then the accent lane last.
  const order = [1, 2, 0]
  const laneY = [22, 81, 137]
  const reveal = (i: number) => ease(f, 4 + order[i] * 6, 22 + order[i] * 6)
  const lock = spring({ frame: f - 32, fps, config: { damping: 14, stiffness: 160, mass: 0.6 } })
  const glow = ease(f, 30, 40) * ease(f, 44, 70, 1, 0)
  const scale = 1.04 - 0.04 * lock
  const id = `logo-${at}`
  return (
    <svg height={height} width={(height * 1048) / 210} viewBox="0 0 1048 210" style={{ overflow: "visible", ...style }}>
      <defs>
        {LANE_PATHS.map((_, i) => <clipPath key={i} id={`${id}-c${i}`}><rect x={-10} y={-10} width={240 * reveal(i)} height={230} /></clipPath>)}
        <linearGradient id={`${id}-streak`} x1="0" x2="1"><stop offset="0" stopColor={C.accent} stopOpacity="0" /><stop offset="1" stopColor={C.accentTop} stopOpacity="1" /></linearGradient>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10" /></filter>
      </defs>
      <g transform={`translate(110 105) scale(${scale}) translate(-110 -105)`}>
        {/* The streaks: a bright head with a fading tail, running ahead of each lane. */}
        {LANE_PATHS.map((_, i) => {
          const r = reveal(i)
          if (r <= 0 || r >= 1) return null
          const head = -60 + r * 300
          return <rect key={`s${i}`} x={head - 260} y={laneY[i] - 3} width={260} height={6} rx={3} fill={`url(#${id}-streak)`} opacity={1 - r * 0.6} />
        })}
        {LANE_PATHS.map((p, i) => p.lane && <path key={`g${i}`} d={p.d} fill={C.accent} filter={`url(#${id}-glow)`} opacity={glow * 0.9} />)}
        {LANE_PATHS.map((p, i) => <path key={i} d={p.d} fill={p.lane ? C.accent : C.logoInk} clipPath={`url(#${id}-c${i})`} />)}
      </g>
      {GLYPHS.map((g, i) => {
        const t = spring({ frame: f - 34 - i * 2.5, fps, config: { damping: 18, stiffness: 140, mass: 0.7 } })
        return <path key={i} d={g.d} fill={C.logoInk} opacity={Math.min(1, t * 1.4)}
          transform={`translate(${g.x} ${g.y + (1 - t) * 40}) scale(${g.s} ${-g.s})`} />
      })}
    </svg>
  )
}
