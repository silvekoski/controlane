import fs from "node:fs";
import path from "node:path";

type SyntheticCase = {
  id: string;
  title: string;
  state: { label: string; value: string; source: string; observedAt?: string }[];
  action: string;
  questionId: string;
  acceptedAnswers: string[];
  split: string;
  template?: string;
  at: string;
  note?: string;
};

let cached: { mtimeMs: number; cases: SyntheticCase[] } | undefined;

function loadCases() {
  const file = path.resolve(process.cwd(), "../control-room/eval/synthetic.json");
  if (!fs.existsSync(file)) throw new Error("Synthetic data is unavailable. Generate it with npm run synth in control-room.");
  const mtimeMs = fs.statSync(file).mtimeMs;
  if (!cached || cached.mtimeMs !== mtimeMs) {
    cached = { mtimeMs, cases: JSON.parse(fs.readFileSync(file, "utf8")) as SyntheticCase[] };
  }
  return cached.cases;
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const query = (params.get("q") ?? "").trim().toLocaleLowerCase();
    const question = params.get("question") ?? "all";
    const split = params.get("split") ?? "all";
    const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(params.get("pageSize") ?? "25", 10) || 25));
    const all = loadCases();
    const questions = [...new Set(all.map((item) => item.questionId))].sort();
    const splits = [...new Set(all.map((item) => item.split))].sort();
    const splitCounts = Object.fromEntries(splits.map((key) => [key, all.filter((item) => item.split === key).length]));
    const filtered = all.filter((item) => {
      if (question !== "all" && item.questionId !== question) return false;
      if (split !== "all" && item.split !== split) return false;
      if (!query) return true;
      const haystack = [item.id, item.title, item.action, item.questionId, item.template, item.note,
        ...item.acceptedAnswers, ...item.state.flatMap((fact) => [fact.label, fact.value, fact.source])]
        .filter(Boolean).join(" ").toLocaleLowerCase();
      return haystack.includes(query);
    });
    const start = (page - 1) * pageSize;
    return Response.json({ total: filtered.length, page, pageSize, questions, splits, splitCounts, cases: filtered.slice(start, start + pageSize) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load synthetic data.";
    return Response.json({ error: message }, { status: 503 });
  }
}
