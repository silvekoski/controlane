import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"

export const UI = { damping: 200 } // UI moves
export const DEEP = { damping: 200, mass: 1.4 } // 3D moves, slower
export const POP = { damping: 18, stiffness: 180, mass: 0.7 }

/** 0 to 1 spring that starts at `at` (scene frames). */
export const useSpr = (at: number, config: object = UI, durationInFrames?: number) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - at, fps, config, durationInFrames })
}

/** Clamped ease between two frames. */
export const ease = (frame: number, a: number, b: number, from = 0, to = 1) =>
  interpolate(frame, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.33, 0, 0.2, 1) })

export const useEase = (a: number, b: number, from = 0, to = 1) => ease(useCurrentFrame(), a, b, from, to)

/** Moves through keyframes. Each key starts a spring from the previous value to its own. */
export function keyed<T extends Record<string, number>>(frame: number, fps: number, keys: ({ at: number } & T)[], config: object = UI, durationInFrames = 20): T {
  const sorted = [...keys].sort((a, b) => a.at - b.at)
  let cur = { ...sorted[0] } as T & { at: number }
  for (let i = 1; i < sorted.length; i++) {
    const k = sorted[i]
    if (frame < k.at) break
    const p = spring({ frame: frame - k.at, fps, config, durationInFrames })
    const next = { ...cur }
    for (const key of Object.keys(k)) if (key !== "at") (next as Record<string, number>)[key] = cur[key as keyof T] as number + ((k as Record<string, number>)[key] - (cur[key as keyof T] as number)) * p
    cur = next
  }
  const { at: _at, ...rest } = cur
  return rest as unknown as T
}
