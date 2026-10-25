import { runDiscovery } from "../lib/discovery";

const out = await runDiscovery();
console.log(`Sampled ${out.sampledRuns} runs and ${out.rejectedCards} rejected or edited cards.`);
for (const q of out.added) console.log(`New question (proposed): ${q.id}: ${q.question}`);
if (!out.added.length) console.log("No new failure type found.");
