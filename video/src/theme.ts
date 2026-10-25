// Tokens copied from starter/app/globals.css, same as the slideshow.
export const C = {
  birch: "#fffef7", canvas: "#f5f3ec", tray: "#faf8f2", hair: "#e6e1d6", hairSoft: "#eeeae1", sand: "#ccc6ba",
  ink: "#12110e", brown: "#423d33", muted: "#726958", subtle: "#8a7f6b",
  red: "#fd4a61", redInk: "#b42c42", redBg: "#fff0f2",
  orange: "#fd6a31", orangeInk: "#b04617", orangeBg: "#fff1ea",
  teal: "#43afc1", tealInk: "#1f6f7b", tealBg: "#e9f5f7",
  green: "#29af77", greenInk: "#1b7a52", greenBg: "#e9f6ef",
}
export const F = {
  body: '"Poppins", Arial, Helvetica, sans-serif',
  display: '"Unbounded", Arial, Helvetica, sans-serif',
  mono: '"Reddit Mono", Menlo, monospace',
}
export type ToneName = "neutral" | "teal" | "orange" | "red" | "green" | "ink"
export const TONE: Record<ToneName, { bg: string; fg: string; line: string }> = {
  neutral: { bg: C.hairSoft, fg: C.brown, line: C.hair },
  teal: { bg: C.tealBg, fg: C.tealInk, line: C.teal },
  orange: { bg: C.orangeBg, fg: C.orangeInk, line: C.orange },
  red: { bg: C.redBg, fg: C.redInk, line: C.red },
  green: { bg: C.greenBg, fg: C.greenInk, line: C.green },
  ink: { bg: C.ink, fg: C.birch, line: C.ink },
}
export const W = 1920
export const H = 1080
export const FPS = 30
export const CARD_SHADOW = `0 0 0 2px ${C.hair}, 0 2px 4px rgba(66,61,51,0.06)`
