// Colours converted from the oklch tokens in starter/app/globals.css (light theme), so the video matches the app.
export const C = {
  canvas: "#f9f9fa", // --background
  card: "#ffffff",
  ink: "#18181b", // --foreground
  muted: "#6b6b71", // --muted-foreground
  secondary: "#f4f4f5",
  border: "#e7e7ea",
  input: "#e1e1e4",
  accent: "#5c62d2", // --primary, also the lane in the logo
  accentTop: "#727ad8", // top of the button gradient
  accentSoft: "#ececfa",
  danger: "#e7000b",
  dangerSoft: "#fdecec",
  warning: "#d97706",
  warningSoft: "#fdf3e6",
  ok: "#1baf7a", // --checker-laya-ft, the green the app uses for "fine"
  okSoft: "#e8f7f1",
  teal: "#009494", // --chart-2, decided
  info: "#2a78d6", // --checker-jev
  grey: "#a1a1aa",
  greySoft: "#e4e4e7",
  logoInk: "#14151d",
}

// Bahn's own colours, from the challenge brief. Scene 1 and the end card only.
export const BAHN = { paper: "#fffef7", ink: "#12110e", muted: "#726958", hair: "#e6e1d6" }

export const F = {
  sans: '"Inter Variable", Inter, system-ui, sans-serif',
  mono: '"JetBrains Mono Variable", "JetBrains Mono", monospace',
}

export const W = 1920
export const H = 1080
export const FPS = 30

// Every UI capture is a 1440 x 900 viewport. It sits centred, with the scene label in the left gutter and captions below.
export const WIN = { x: 240, y: 34, w: 1440, h: 900 }
