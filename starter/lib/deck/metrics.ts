// Every number on the pitch deck. Change a number here, not on a slide.
// Sources: the Bahn challenge brief, the overview snapshot (21 Oct 09:00 UTC),
// the checks and evals page, and control-room/docs/HANDOFF.md.

export const BRIEF = {
  cars: "25,000+",
  drivers: "1,500+",
  people: "about 50",
  countries: "3",
} as const

/** The overview snapshot that the screenshots show. */
export const SNAPSHOT = {
  label: "21 Oct 09:00 UTC",
  orders: 100,
  active: 77,
  onTrack: 75,
  decisions: 4,
} as const

/** The fine-tuned checker against the commercial checker (Jev) and Laya v6, on unseen template families. */
export const CHECKER = {
  name: "bahnator-1.1-pro-preview",
  base: "Liquid d1-3B + LoRA rank 16",
  trainable: "24.5 M trainable parameters",
  runs: "7 training runs, 2 models",
  correct: [
    { label: "bahnator", value: 93.5, best: true },
    { label: "Jev", value: 89.3 },
    { label: "Laya v6", value: 88 },
  ],
  falseAlarms: [
    { label: "bahnator", value: 5, best: true },
    { label: "Laya v6", value: 8 },
    { label: "Jev", value: 13 },
  ],
  ms: [
    { label: "bahnator", value: 26, best: true },
    { label: "Jev", value: 229 },
  ],
  testCases: "4,395",
  heldOutFamilies: 203,
  cost: "$1.33",
  trainMinutes: 24,
  gpu: "1x RTX 6000 Ada",
  host: "Verda, Finland",
} as const

/** The worked stop on CD-420145. Places are fictional. */
export const STOP = {
  order: "CD-420145",
  places: [
    { name: "Velmarin Fuel", m: 35, angle: -60 },
    { name: "Cafe Tornhaven", m: 90, angle: 205 },
    { name: "Ostervald Car Repair", m: 260, angle: 28 },
  ],
  timeline: [
    { t: "09:47", text: "Car stopped", tone: "grey" },
    { t: "10:08", text: "A: logged quietly", tone: "good" },
    { t: "10:22", text: "B: asked the driver", tone: "warning" },
    { t: "10:27", text: "Reply: warning light, and a photo", tone: "grey" },
    { t: "10:29", text: "C: one card for a person", tone: "critical" },
  ],
} as const

export const LINKS = {
  site: "controlane.bobs.build",
  siteUrl: "https://controlane.bobs.build",
  github: "github.com/silvekoski/controlane",
  bahnator: "huggingface.co/silvekoski/bahnator-1.1-pro-preview",
  laya: "huggingface.co/silvekoski/laya-v6-bahn",
} as const
