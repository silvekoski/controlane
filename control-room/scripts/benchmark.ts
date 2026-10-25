import { EVAL_SETS, runBenchmark, type EvalSet } from "../lib/benchmark";
import { question } from "../lib/questions";

// Usage: npm run bench [hand|synthetic|all]
const arg = process.argv[2] ?? "hand";
const sets = (arg === "all" ? Object.keys(EVAL_SETS) : [arg]) as EvalSet[];
const pct = (v?: number) => (v === undefined ? "–" : `${Math.round(v * 100)}%`);

for (const set of sets) {
  const b = await runBenchmark(set, (s) => console.log(s));
  console.log(`\nResults: ${EVAL_SETS[set]}, written to eval/results-${set}.json`);
  for (const r of b.rows) {
    console.log(
      `${r.label.padEnd(30)} ${r.status.padEnd(15)} catch ${pct(r.catchRate).padStart(5)}  false alarms ${pct(r.falseAlarmRate).padStart(5)}  ` +
        `ECE ${r.calibrationError?.toFixed(2) ?? "–"}  ms ${r.msPerCheck?.toFixed(0) ?? "–"}  $/1000 ${r.costPer1000?.toFixed(4) ?? "–"}  ${r.note ?? ""}`,
    );
    for (const [q, p] of Object.entries(r.perQuestion))
      console.log(`    ${(question(q)?.id ?? q).padEnd(22)} ${p.correct}/${p.n} correct, caught ${p.caught}/${p.traps}, false alarms ${p.falseAlarms}/${p.negatives}`);
  }
  console.log("");
}
