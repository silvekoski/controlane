import fs from "node:fs";
import path from "node:path";
import { CASES } from "../eval/cases";
import { buildVisionCases } from "../eval/vision";
import { codeAnswer, modelCheckers, type Answer, type CheckInput } from "./checks";
import { question } from "./questions";
import { update, type Benchmark } from "./store";
import type { BenchmarkRow, CheckerModel, EvalCase } from "./types";

// Run every checker on the same labelled test cases, with the same typed
// questions and options. Report per question, not only the average.

export const EVAL_SETS = {
  hand: "Hand-labelled decisions",
  synthetic: "Synthetic set (labels by construction)",
  synthetic_ood: "Synthetic set, templates never seen in training",
  vision: "Photos and scans from the packet",
} as const;
export type EvalSet = keyof typeof EVAL_SETS;

const SYNTHETIC_FILE = path.resolve(process.cwd(), "eval/synthetic.json");

export function loadCases(set: EvalSet): EvalCase[] {
  if (set === "hand") return CASES;
  if (set === "vision") return buildVisionCases();
  if (!fs.existsSync(SYNTHETIC_FILE)) throw new Error("No eval/synthetic.json. Run npm run synth first.");
  const all = JSON.parse(fs.readFileSync(SYNTHETIC_FILE, "utf8")) as EvalCase[];
  // The unseen-template set scores the held-out families as its test split.
  if (set === "synthetic_ood") return all.filter((c) => c.split === "test_ood").map((c) => ({ ...c, split: "test" as const }));
  return all.filter((c) => c.split !== "test_ood");
}

const LABELS: Record<string, string> = {
  code: "Plain code rules",
  laya: "Laya, as released",
  laya_ft: "Laya, fine-tuned",
  jev: "Jev",
  llm_judge: "Large LLM judge",
};

function inputOf(c: EvalCase): CheckInput {
  return { at: c.at, state: c.state, action: c.action, image: c.image };
}

function isTrapCase(c: EvalCase) {
  const q = question(c.questionId);
  return Boolean(q && c.acceptedAnswers.every((a) => q.trapAnswers.includes(a)));
}

function isCleanCase(c: EvalCase) {
  const q = question(c.questionId);
  return Boolean(q && c.acceptedAnswers.every((a) => !q.trapAnswers.includes(a)));
}

// Expected calibration error over 5 confidence bins.
function calibrationError(points: { confidence: number; correct: boolean }[]) {
  if (!points.length) return undefined;
  let err = 0;
  for (let b = 0; b < 5; b++) {
    const bin = points.filter((p) => Math.min(4, Math.floor(p.confidence * 5)) === b);
    if (!bin.length) continue;
    const conf = bin.reduce((a, p) => a + p.confidence, 0) / bin.length;
    const acc = bin.filter((p) => p.correct).length / bin.length;
    err += (bin.length / points.length) * Math.abs(conf - acc);
  }
  return err;
}

async function score(model: CheckerModel, label: string, cases: EvalCase[], run: (c: EvalCase) => Promise<Answer | null>): Promise<BenchmarkRow> {
  const row: BenchmarkRow = { model, label, status: "measured", perQuestion: {} };
  const points: { confidence: number; correct: boolean }[] = [];
  let ms = 0;
  let cost = 0;
  let costN = 0;
  let n = 0;
  let errors = 0;
  // Ask in parallel (8 at a time). Time per check is still each request's own latency.
  const answers: (Answer | null | Error)[] = new Array(cases.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: model === "code" ? 1 : 8 }, async () => {
      while (next < cases.length) {
        const i = next++;
        try {
          answers[i] = await run(cases[i]);
        } catch (e) {
          answers[i] = e as Error;
        }
      }
    }),
  );
  cases.forEach((c, i) => {
    const q = question(c.questionId);
    const a = answers[i];
    if (!q || a === null) return; // this checker does not answer this question
    if (a instanceof Error) {
      errors++;
      row.note = a.message;
      return;
    }
    const pq = (row.perQuestion[c.questionId] ??= { n: 0, correct: 0, caught: 0, traps: 0, falseAlarms: 0, negatives: 0 });
    const correct = c.acceptedAnswers.includes(a.answer);
    const flagged = q.trapAnswers.includes(a.answer);
    pq.n++;
    if (correct) pq.correct++;
    if (isTrapCase(c)) {
      pq.traps++;
      if (flagged) pq.caught++;
    }
    if (isCleanCase(c)) {
      pq.negatives++;
      if (flagged) pq.falseAlarms++;
    }
    points.push({ confidence: a.confidence, correct });
    ms += a.ms;
    n++;
    if (a.costUsd !== undefined) {
      cost += a.costUsd;
      costN++;
    }
  });
  const sum = (k: "caught" | "traps" | "falseAlarms" | "negatives") => Object.values(row.perQuestion).reduce((x, p) => x + p[k], 0);
  row.catchRate = sum("traps") ? sum("caught") / sum("traps") : undefined;
  row.falseAlarmRate = sum("negatives") ? sum("falseAlarms") / sum("negatives") : undefined;
  row.calibrationError = calibrationError(points);
  row.msPerCheck = n ? ms / n : undefined;
  row.costPer1000 = model === "code" ? 0 : costN ? (cost / costN) * 1000 : undefined;
  row.ranAt = new Date().toISOString();
  if (errors) row.note = `${errors} request(s) failed. Last error: ${row.note}`;
  if (!n) {
    row.status = "failed";
    row.note ??= "No answers";
  }
  return row;
}

export async function runBenchmark(set: EvalSet = "hand", log: (s: string) => void = () => {}): Promise<Benchmark> {
  const all = loadCases(set);
  const cases = all.filter((c) => c.split === "test");
  const rows: BenchmarkRow[] = [];
  log(`${EVAL_SETS[set]}: ${cases.length} test cases (${all.length - cases.length} more in train and calibration, not scored).`);

  if (set !== "vision") {
    log("Running plain code rules…");
    rows.push(await score("code", LABELS.code, cases, async (c) => codeAnswer(c.questionId, inputOf(c))));
  }

  const { configured, missing } = modelCheckers();
  for (const m of configured) {
    // The fine-tuned models on the model server have prediction files from the GPU run (below).
    // Scoring both would add the same model twice; BENCH_LIVE=1 scores the live server instead.
    if ((m.model === "d1_ft" || m.model === "laya_ft") && process.env.BENCH_LIVE !== "1") continue;
    if (set === "vision" && !m.vision) {
      rows.push({ model: m.model, label: m.label, status: "not_configured", note: "No image input in this adapter yet", perQuestion: {} });
      continue;
    }
    log(`Running ${m.label}…`);
    rows.push(
      await score(m.model, m.label, cases, async (c) => {
        const q = question(c.questionId);
        if (!q?.modelChecked) return null;
        return m.run(q, inputOf(c));
      }),
    );
  }
  // Laya runs on our own GPU (laya/predict_laya.py on Verda); its predictions come from files.
  // Cost per check is GPU time: an RTX 6000 Ada at $1.425 per hour.
  const GPU_USD_PER_HOUR = 1.425;
  const fromFile: CheckerModel[] = [];
  for (const [model, label, dir] of [
    ["laya", "Laya, as released", "laya"],
    ["laya_ft", "Laya, fine-tuned (synthetic train split)", "laya"],
    ["d1", "Liquid d1-3B, as released", "d1"],
    ["d1_omni", "Liquid d1-omni-600M, as released", "d1"],
    ["d1_ft", "Liquid d1-3B, fine-tuned (LoRA, synthetic train split)", "d1"],
  ] as const) {
    const file = path.resolve(process.cwd(), `${dir}/predictions/${model}-${set}.json`);
    if (!fs.existsSync(file) || rows.some((r) => r.model === model)) continue;
    const preds = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, { answer: string; confidence: number; ms: number }>;
    log(`Scoring ${label} from ${path.basename(file)}…`);
    const row = await score(model, label, cases, async (c) => (preds[c.id] ? { ...preds[c.id], ms: preds[c.id].ms ?? 0, costUsd: (GPU_USD_PER_HOUR / 3600) * ((preds[c.id].ms ?? 0) / 1000) } : null));
    row.note = `Run on 1× RTX 6000 Ada (Verda). Cost is GPU time at $${GPU_USD_PER_HOUR}/h.`;
    rows.push(row);
    fromFile.push(model);
  }
  for (const m of missing) if (!fromFile.includes(m.model)) rows.push({ model: m.model, label: m.label, status: "not_configured", note: m.why, perQuestion: {} });

  const b: Benchmark = { set, ranAt: new Date().toISOString(), rows, testCases: cases.length };
  update((s) => {
    s.benchmarks = { ...(s.benchmarks ?? {}), [set]: b };
  });
  fs.writeFileSync(path.resolve(process.cwd(), `eval/results-${set}.json`), JSON.stringify(b, null, 2));
  return b;
}
