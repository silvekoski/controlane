import { runToEnd } from "../lib/agent";
import { SCENARIOS } from "../lib/scenarios";
import { readState } from "../lib/store";
import { hasClaude } from "../lib/llm";

// Run the agent on one scenario or on all of them, and print what happened.
// Usage: npm run agent [scenario-id|all] [--scripted]

const arg = process.argv[2] ?? "all";
const forceScripted = process.argv.includes("--scripted");
const ids = arg === "all" ? SCENARIOS.map((s) => s.id) : [arg];

console.log(`Mode: ${hasClaude() && !forceScripted ? "LLM agent" : "scripted replay (no API key or --scripted)"}`);
let quiet = 0;
let cards = 0;
for (const sid of ids) {
  const run = await runToEnd(sid, { forceScripted });
  const expected = SCENARIOS.find((s) => s.id === sid)?.expected;
  const ok = (run.status === "quiet" && expected === "quiet") || (run.status === "card" && expected === "card");
  if (run.status === "quiet") quiet++;
  if (run.status === "card") cards++;
  console.log(`\n${ok ? "PASS" : "FAIL"} ${sid} ${run.orderRef}: ${run.status} (expected ${expected}), ${run.steps.filter((s) => s.kind === "tool").length} tool calls`);
  if (run.error) console.log(`  error: ${run.error}`);
  if (run.quietReason) console.log(`  quiet: ${run.quietReason}`);
  const card = readState().cards.find((c) => c.id === run.cardId);
  if (card) {
    console.log(`  card: ${card.summary}`);
    for (const c of card.checks.filter((x) => x.flagged)) console.log(`  warning [${c.model}] ${c.message}`);
  }
}
console.log(`\nClosed quietly: ${quiet}. Decision cards: ${cards}.`);
