import fs from "node:fs";
import path from "node:path";
import { readState } from "../lib/store";

// Write every agent run, with its steps and its card, to traces/ as JSON.
const s = readState();
const dir = path.resolve(process.cwd(), "traces");
fs.mkdirSync(dir, { recursive: true });
for (const run of s.runs) {
  const card = s.cards.find((c) => c.id === run.cardId);
  const file = path.join(dir, `${run.orderRef}-${run.mode}-${run.id}.json`);
  fs.writeFileSync(file, JSON.stringify({ run, card: card ?? null }, null, 2));
}
console.log(`Wrote ${s.runs.length} traces to ${dir}`);
