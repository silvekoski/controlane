import fs from "node:fs";
import { EVAL_SETS, type EvalSet } from "../lib/benchmark";
import { question } from "../lib/questions";
import type { Benchmark } from "../lib/store";

// Render the latest benchmark results (eval/results-<set>.json) as markdown and put
// them between the markers in docs/RESULTS.md. Usage: npm run report
const pct = (v?: number) => (v === undefined ? "–" : `${Math.round(v * 100)}%`);
const lines: string[] = [];

for (const set of Object.keys(EVAL_SETS) as EvalSet[]) {
  const file = `eval/results-${set}.json`;
  if (!fs.existsSync(file)) continue;
  const b = JSON.parse(fs.readFileSync(file, "utf8")) as Benchmark;
  lines.push(`### ${EVAL_SETS[set]}`, "", `${b.testCases} test cases. Run ${b.ranAt.slice(0, 16).replace("T", " ")} UTC.`, "");
  lines.push("| Checker | Catch rate | False alarms | Calibration error | Time per check | Cost per 1,000 checks |", "| --- | --- | --- | --- | --- | --- |");
  for (const r of b.rows) {
    if (r.status !== "measured") {
      lines.push(`| ${r.label} | not run: ${r.note ?? r.status} | | | | |`);
      continue;
    }
    lines.push(`| ${r.label} | ${pct(r.catchRate)} | ${pct(r.falseAlarmRate)} | ${r.calibrationError?.toFixed(2) ?? "–"} | ${r.msPerCheck === undefined ? "–" : r.msPerCheck < 1 ? "<1 ms" : `${Math.round(r.msPerCheck)} ms`} | ${r.costPer1000 === undefined ? "–" : `$${r.costPer1000.toFixed(4)}`} |`);
  }
  const measured = b.rows.filter((r) => r.status === "measured");
  const qids = [...new Set(measured.flatMap((r) => Object.keys(r.perQuestion)))];
  lines.push("", "Correct answers per question:", "", `| Question | ${measured.map((r) => r.label).join(" | ")} |`, `| --- | ${measured.map(() => "---").join(" | ")} |`);
  for (const q of qids) {
    lines.push(`| ${question(q)?.id ?? q} | ${measured.map((r) => (r.perQuestion[q] ? `${r.perQuestion[q].correct}/${r.perQuestion[q].n}` : "–")).join(" | ")} |`);
  }
  lines.push("");
}

const doc = "docs/RESULTS.md";
const start = "<!-- results:start -->";
const end = "<!-- results:end -->";
const text = fs.existsSync(doc) ? fs.readFileSync(doc, "utf8") : `${start}\n${end}\n`;
const out = text.replace(new RegExp(`${start}[\\s\\S]*${end}`), `${start}\n${lines.join("\n")}\n${end}`);
fs.writeFileSync(doc, out);
console.log(`Updated ${doc} with ${Object.keys(EVAL_SETS).length} sets.`);
