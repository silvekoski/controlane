import fs from "node:fs";
import { buildSynthetic } from "../eval/synthetic";

// Usage: npm run synth [perQuestion=500] [seed=42]
const perQuestion = Number(process.argv[2] ?? 500);
const seed = Number(process.argv[3] ?? 42);
const cases = buildSynthetic(seed, perQuestion);
fs.writeFileSync(new URL("../eval/synthetic.json", import.meta.url), JSON.stringify(cases));

const count = (k: (c: (typeof cases)[number]) => string) => cases.reduce<Record<string, number>>((a, c) => ((a[k(c)] = (a[k(c)] ?? 0) + 1), a), {});
console.log(`Wrote ${cases.length} synthetic cases (seed ${seed}) to eval/synthetic.json`);
console.log("By split:", count((c) => c.split));
console.log(`Template families: ${new Set(cases.map((c) => c.template)).size}, held out from training: ${new Set(cases.filter((c) => c.split === "test_ood").map((c) => c.template)).size}`);
console.log("\nQuestion                 cases  labels                                    test  unseen  unique actions  unique fact sets");
for (const q of [...new Set(cases.map((c) => c.questionId))]) {
  const cs = cases.filter((c) => c.questionId === q);
  const labels = count((c) => (c.questionId === q ? c.acceptedAnswers.join("|") : "_"));
  delete labels._;
  const actions = new Set(cs.map((c) => c.action)).size;
  const facts = new Set(cs.map((c) => c.state.map((f) => `${f.label}=${f.value}`).sort().join(";"))).size;
  console.log(`${q.padEnd(24)} ${String(cs.length).padStart(5)}  ${JSON.stringify(labels).padEnd(40)} ${String(cs.filter((c) => c.split === "test").length).padStart(4)}  ${String(cs.filter((c) => c.split === "test_ood").length).padStart(6)}  ${String(actions).padStart(14)}  ${String(facts).padStart(16)}`);
}
