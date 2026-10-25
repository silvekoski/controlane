// Every number in the video comes from this file.
// Eval values: control-room/eval/results-synthetic_ood.json, run Sun 25 Oct 2026 09:39 UTC
// (4,395 synthetic cases from 203 held-out template families). Training values: training notes, 25 Oct 2026.

export const data = {
  uniqueCases: 15000, // eval/synthetic.json: 6,364 train, 1,054 calibration, 3,187 same-template test, 4,395 unseen-template test
  templateFamilies: 676,
  heldOutFamilies: 203, // never used in training
  heldOutCases: 4395,
  trainingRows: 10605,
  trainingRuns: 7, // Laya v1 to v6, plus one d1-3B LoRA run
}

export const bahnator = {
  name: "bahnator-1.1-pro-preview",
  base: "Liquid d1-3B",
  baseUrl: "https://huggingface.co/LiquidAI/d1-3B",
  method: "LoRA rank 16",
  trainableParams: "24.5 M",
  gpu: "RTX 6000 Ada",
  gpuUsdPerHour: 1.425,
  provider: "Verda, Finland",
  trainMinutes: 24,
  sessionMinutes: 56,
  sessionUsd: 1.33,
  // Fill these in when the weights are published. The end card shows a link only when it is set.
  hfUrl: null as string | null,
}

export const unseen = {
  bahnator: { label: "bahnator-1.1-pro-preview", correct: 0.935, caught: 0.918, falseAlarms: 0.048, ms: 22.4, usdPer1000: 0.0088 },
  jev: { label: "Jev (commercial)", correct: 0.893, caught: 0.919, falseAlarms: 0.125, ms: 229.1, usdPer1000: 0.025 },
  laya: { label: "Laya v6, fine-tuned", correct: 0.883, caught: 0.857, falseAlarms: 0.084 },
}

// Every checker on the 4,395 unseen-template cases (results-synthetic_ood.json). `correct` = share of right answers.
export const allUnseen = [
  { label: "bahnator-1.1-pro-preview", sub: "Liquid d1-3B + my LoRA", correct: 0.935, falseAlarms: 0.048, tone: "accent" },
  { label: "Jev", sub: "commercial checker", correct: 0.893, falseAlarms: 0.125, tone: "dark" },
  { label: "Laya v6", sub: "my fine-tune", correct: 0.883, falseAlarms: 0.084, tone: "mid" },
  { label: "Liquid d1-3B", sub: "as released", correct: 0.649, falseAlarms: 0.327, tone: "light" },
  { label: "Liquid d1-omni-600M", sub: "as released", correct: 0.527, falseAlarms: 0.351, tone: "light" },
  { label: "Laya", sub: "as released", correct: 0.481, falseAlarms: 0.539, tone: "light" },
] as const

// Laya: convaiinnovations/laya, 421M parameters (ModernBERT-large). Runs from control-room/docs/RESULTS.md and the training notes.
export const runs = [
  { name: "Laya v1", note: "2,098 rows · 2 min" },
  { name: "Laya v2", note: "1,564 rows · 1.5 min" },
  { name: "Laya v3", note: "2,971 rows · 4.5 min" },
  { name: "Laya v4", note: "4,456 rows · 7 min" },
  { name: "Laya v5", note: "5,934 rows · 13 min" },
  { name: "Laya v6", note: "10 epochs · RTX PRO 6000" },
  { name: "d1-3B LoRA", note: "10,605 rows · 24 min", winner: true },
]

export const SOURCE_LINE = "Synthetic test: 4,395 cases from 203 held-out template families"

// Live state of the control room when the screens were captured, Sun 25 Oct 2026 11:00 UTC.
export const room = { orders: 100, closed: 23, active: 77, onTrack: 75, decisions: 4 }
