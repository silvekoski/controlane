import fs from "node:fs";
import path from "node:path";
import { buildVisionCases } from "../eval/vision";
import { jevQuestionOf, jevStateOf } from "../lib/checks";
import { question } from "../lib/questions";
import { imagePath } from "../lib/vision";

// d1 reads the same text rows as Laya (copied from laya/data, train split included for the
// fine-tune) plus the image rows.
fs.mkdirSync("d1/data/images", { recursive: true });
for (const f of ["train", "test-hand", "test-synthetic", "test-synthetic_ood"]) fs.copyFileSync(`laya/data/${f}.jsonl`, `d1/data/${f}.jsonl`);
const rows = buildVisionCases().map((c) => {
  const src = imagePath(c.image!);
  const name = path.basename(src);
  if (!fs.existsSync(`d1/data/images/${name}`)) fs.copyFileSync(src, `d1/data/images/${name}`);
  return JSON.stringify({ id: c.id, question_id: c.questionId, state: jevStateOf({ at: c.at, state: c.state, action: c.action }), questions: { [c.questionId]: jevQuestionOf(question(c.questionId)!) }, image: `data/images/${name}` });
});
fs.writeFileSync("d1/data/test-vision.jsonl", rows.join("\n") + "\n");
console.log(`d1/data: text sets copied, ${rows.length} vision rows, ${fs.readdirSync("d1/data/images").length} images`);
