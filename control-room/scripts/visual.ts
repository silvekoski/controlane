import { data } from "../lib/data";
import { allPhotos, checkPhoto, PHOTO_KIND_LABEL, visualCheckers } from "../lib/visual";

// Usage: npm run visual [order ref | all] [--fresh]
// Runs the visual decision models on the packet photos and stores the answers.
const args = process.argv.slice(2);
const fresh = args.includes("--fresh");
const target = args.find((a) => !a.startsWith("--")) ?? "all";
const photos = target === "all" ? allPhotos() : allPhotos().filter((p) => data().order(p.orderId)?.reference === target);

const { configured, missing } = visualCheckers();
console.log(`Visual checkers: ${configured.map((c) => c.label).join(", ") || "none"}`);
for (const m of missing) console.log(`Not connected: ${m.label}. ${m.why}.`);
if (!photos.length) console.log(`No photos for ${target}.`);

for (const p of photos) {
  const checks = await checkPhoto(p, { fresh });
  console.log(`\n${data().order(p.orderId)?.reference} · ${PHOTO_KIND_LABEL[p.kind] ?? p.kind} · ${p.file} (${p.status.toLowerCase()})`);
  for (const c of checks)
    console.log(`  ${c.flagged ? "!" : c.unsure ? "?" : " "} ${c.model.padEnd(17)} ${c.questionId.padEnd(15)} ${c.answer.padEnd(8)} ${Math.round(c.confidence * 100)}%  ${Math.round(c.ms)} ms  ${c.answer === "error" ? c.message : ""}`);
}
