import fs from "node:fs";
import { CASES } from "../eval/cases";
import { loadCases } from "../lib/benchmark";
import { jevQuestionOf, jevStateOf } from "../lib/checks";
import { question } from "../lib/questions";
import type { EvalCase } from "../lib/types";

// Export eval cases as Laya rows: { id, state, questions, gold }, the format of
// LocalLLaMA/typed-decisions that laya.train.items_from_rows reads.
// Train on the synthetic train + calibration splits only. Test files carry no gold.

function gold(c: EvalCase) {
  const q = question(c.questionId)!;
  const label = c.acceptedAnswers[0];
  if (q.type === "yes_no") {
    const p = label === "yes" ? 0.95 : 0.05; // slightly smoothed hard labels
    return { type: "noul", label: label === "yes" ? "true" : "false", noul: p, probabilities: { true: p, false: 1 - p }, confidence: 0.9 };
  }
  const opts = q.options ?? [];
  const rest = 0.1 / Math.max(1, opts.length - 1);
  return { type: "choice", label, probabilities: Object.fromEntries(opts.map((o) => [o, o === label ? 0.9 : rest])), confidence: 0.85 };
}

function row(c: EvalCase, withGold: boolean) {
  const q = question(c.questionId)!;
  return JSON.stringify({
    id: c.id,
    question_id: c.questionId,
    state: jevStateOf({ at: c.at, state: c.state, action: c.action }),
    questions: { [c.questionId]: jevQuestionOf(q) },
    ...(withGold ? { gold: { [c.questionId]: gold(c) } } : {}),
  });
}

const synthetic = loadCases("synthetic");
// From v6, the in-distribution test split also trains the model. The unseen-template
// set and the hand-labelled set stay out of training and are the real tests.
const train = synthetic.filter((c) => c.split === "train" || c.split === "calibration" || c.split === "test");
const write = (name: string, cases: EvalCase[], withGold: boolean) => {
  fs.writeFileSync(`laya/data/${name}.jsonl`, cases.map((c) => row(c, withGold)).join("\n") + "\n");
  console.log(`laya/data/${name}.jsonl: ${cases.length} rows`);
};
write("train", train, true);
write("test-hand", CASES.filter((c) => c.split === "test"), false);
write("test-synthetic", synthetic.filter((c) => c.split === "test"), false);
write("test-synthetic_ood", loadCases("synthetic_ood"), false);
