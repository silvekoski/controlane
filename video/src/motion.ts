import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"

export const SOFT = { damping: 16, stiffness: 120, mass: 0.8 }
export const SNAPPY = { damping: 14, stiffness: 200, mass: 0.7 }
export const BOUNCE = { damping: 9, stiffness: 160, mass: 0.7 }

/** 0 to 1 spring that starts at `at` (scene frames). */
export const useSpr = (at: number, config = SOFT) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - at, fps, config })
}
/** Clamped ease from `a` to `b` frames, mapped to `from` to `to`. */
export const useEase = (a: number, b: number, from = 0, to = 1) => {
  const frame = useCurrentFrame()
  return interpolate(frame, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })
}
/** 1 until `out`, then fades to 0 in 8 frames. */
export const useExit = (out?: number) => {
  const frame = useCurrentFrame()
  if (out === undefined) return 1
  return interpolate(frame, [out, out + 8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
}
export const useCount = (at: number, dur: number, from: number, to: number) => {
  const v = useEase(at, at + dur, from, to)
  return Math.round(v)
}
/** Gentle 1 second pulse, for anything that needs a person. */
export const usePulse = (on = true) => {
  const frame = useCurrentFrame()
  return on ? 1 + 0.03 * (1 + Math.sin((frame / 30) * Math.PI * 2 - Math.PI / 2)) : 1
}
