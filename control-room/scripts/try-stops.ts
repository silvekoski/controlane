import { runToEnd } from "../lib/agent";
import { SCENARIOS } from "../lib/scenarios";
import { readState, resetState, setClock } from "../lib/store";

// Runs the long-stop events at their own times and prints the stop check of each run.
// Usage: STATE_DIR=<folder> npx tsx scripts/try-stops.ts [--llm]
if (!process.env.ONLY) resetState(false);
for (const sc of SCENARIOS.filter((s) => s.kind === "long_stop" && (!process.env.ONLY || s.id === process.env.ONLY))) {
  setClock({ mode: "travel", at: sc.at });
  const run = await runToEnd(sc.id, { forceScripted: !process.argv.includes("--llm") });
  console.log(`\n== ${sc.id} ${run.status} (expected ${sc.expected === "quiet" ? "quiet" : "card"})${run.error ? " ERROR " + run.error : ""}`);
  for (const st of run.steps) {
    if (st.kind === "tool" && (st.tool === "nearby_places" || st.tool === "rank_stop_cause" || st.tool === "message_driver")) {
      const o = st.output as any;
      if (st.tool === "nearby_places") console.log("  places:", o.places.map((p: any) => `${p.name} ${p.distance_m}m`).join(" | "));
      if (st.tool === "rank_stop_cause") console.log(`  ${o.ranked_by}: places ${o.places.map((p: any) => `${p.name} ${Math.round(p.probability * 100)}%`).join(", ")}\n    causes ${o.causes.map((c: any) => `${c.cause} ${Math.round(c.probability * 100)}%`).join(", ")}\n    next_step ${o.next_step}: ${o.why}`);
      if (st.tool === "message_driver") console.log("  driver:", o.driver_reply ?? o.note);
    }
  }
  if (run.quietReason) console.log("  quiet:", run.quietReason);
  const card = readState().cards.find((c) => c.id === run.cardId);
  if (card) {
    console.log("  card:", card.summary);
    for (const c of card.checks.filter((x) => x.flagged)) console.log(`  warning [${c.model}] ${c.message}`);
  }
}
