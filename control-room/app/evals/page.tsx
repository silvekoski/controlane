import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { EvalButtons, QuestionButtons } from "./Buttons";
import { EVAL_SETS, loadCases, type EvalSet } from "@/lib/benchmark";
import { LIVE_QUESTIONS } from "@/lib/questions";
import { readState, type Benchmark } from "@/lib/store";
import { fmtTime, system } from "@/lib/view";
import type { BenchmarkRow } from "@/lib/types";

export const dynamic = "force-dynamic";

function lastBenchmark(set: EvalSet): Benchmark | undefined {
  const s = readState();
  if (s.benchmarks?.[set]) return s.benchmarks[set];
  const file = path.resolve(process.cwd(), `eval/results-${set}.json`);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Benchmark) : undefined;
}

function caseCounts(set: EvalSet) {
  try {
    const all = loadCases(set);
    return { test: all.filter((c) => c.split === "test").length, other: all.filter((c) => c.split !== "test").length };
  } catch {
    return null;
  }
}

const pct = (v?: number) => (v === undefined ? "–" : `${Math.round(v * 100)}%`);

function Row({ r }: { r: BenchmarkRow }) {
  if (r.status !== "measured")
    return (
      <tr>
        <td>{r.label}</td>
        <td colSpan={5} className="muted">{r.status === "not_configured" ? `Not connected. ${r.note}.` : `Failed: ${r.note}`}</td>
      </tr>
    );
  return (
    <tr className={r.model === "jev" ? "row-jev" : undefined}>
      <td>
        {r.label}
        {r.model === "jev" && <div className="muted small">Checks every card in the live queue</div>}
        {r.model === "code" && <div className="muted small">Answers only what logic can calculate</div>}
      </td>
      <td className="n"><div className="row" style={{ justifyContent: "flex-end" }}>{pct(r.catchRate)}<div className="bar" style={{ width: 70 }}><span style={{ width: pct(r.catchRate) }} /></div></div></td>
      <td className="n">{pct(r.falseAlarmRate)}</td>
      <td className="n">{r.calibrationError === undefined ? "–" : r.calibrationError.toFixed(2)}</td>
      <td className="n">{r.costPer1000 === undefined ? "–" : `$${r.costPer1000.toFixed(r.costPer1000 < 1 ? 3 : 2)}`}</td>
      <td className="n">{r.msPerCheck === undefined ? "–" : r.msPerCheck < 1 ? "<1 ms" : `${Math.round(r.msPerCheck)} ms`}</td>
    </tr>
  );
}

// Jev against the large LLM judge, on the hand-labelled set when it has a result.
function JevSummary() {
  const set = (Object.keys(EVAL_SETS) as EvalSet[]).find((x) => lastBenchmark(x)?.rows.some((r) => r.model === "jev" && r.status === "measured"));
  const rows = set ? lastBenchmark(set)!.rows : [];
  const jev = rows.find((r) => r.model === "jev" && r.status === "measured");
  const judge = rows.find((r) => r.model === "llm_judge" && r.status === "measured");
  return (
    <section className="jev">
      <div className="jev-head">
        <span className="jev-badge">Jev</span>
        <div>
          <h2 className="h3">What Jev does</h2>
          <p className="small muted">
            Jev is a fast decision model. Before a card reaches the queue, Jev reads the facts and the agent action. It answers each typed question below
            with yes or no and a confidence. At 70% or more, a trap answer becomes a warning on the card.
          </p>
        </div>
      </div>
      {jev && set ? (
        <p className="small">
          On the {set === "hand" ? "hand-labelled" : "synthetic"} set, Jev catches <b>{pct(jev.catchRate)}</b> of traps with <b>{pct(jev.falseAlarmRate)}</b> false alarms, at{" "}
          <b>{jev.costPer1000 === undefined ? "–" : `$${jev.costPer1000.toFixed(3)}`}</b> per 1,000 checks and{" "}
          <b>{jev.msPerCheck === undefined ? "–" : `${Math.round(jev.msPerCheck)} ms`}</b> per check.
          {judge ? ` The large LLM judge catches ${pct(judge.catchRate)} at $${judge.costPer1000?.toFixed(2) ?? "–"} per 1,000 checks.` : " The large LLM judge is not measured yet."}
        </p>
      ) : (
        <p className="small muted">Jev has no benchmark result yet. Run the benchmark below.</p>
      )}
    </section>
  );
}

export default function EvalsPage() {
  const s = readState();
  const sys = system();
  const proposed = s.questions.filter((q) => q.status === "proposed");
  const extraLive = s.questions.filter((q) => q.status === "live");
  const unlabeled = s.candidates.filter((c) => !c.label).length;
  const labeled = s.candidates.filter((c) => c.label).length;
  const allQ = [...LIVE_QUESTIONS, ...extraLive];

  return (
    <main className="page stack-lg">
      <header className="stack">
        <h1 className="h1">Checks and evals</h1>
        <p className="lede" style={{ maxWidth: "70ch" }}>
          Before a card reaches the queue, plain code checks the hard rules and small decision models answer typed questions about the agent&apos;s
          proposal. Each new type of mistake becomes a question and eval cases. This page is for the Bahn engineer and the ops lead, not for the daily queue.
        </p>
      </header>

      <JevSummary />

      {(Object.keys(EVAL_SETS) as EvalSet[]).map((set, i) => {
        const b = lastBenchmark(set);
        const counts = caseCounts(set);
        return (
          <section key={set} className="panel">
            <div className="panel-head">
              <div>
                <h2 className="h3">Benchmark: {EVAL_SETS[set]}</h2>
                <p className="muted small">
                  {counts ? `${counts.test} test cases, ${counts.other} more for training and calibration (not scored). ` : "Not generated yet: run npm run synth. "}
                  Same input, questions and options for every checker.
                  {b ? ` Last run ${fmtTime(b.ranAt)} (real time).` : " Not run yet."}
                </p>
              </div>
              {i === 0 && <EvalButtons canDiscover={sys.claude} />}
            </div>
            <table className="table">
              <thead>
                <tr><th>Checker</th><th className="n">Catch rate</th><th className="n">False alarms</th><th className="n">Calibration error</th><th className="n">Cost per 1,000 checks</th><th className="n">Time per check</th></tr>
              </thead>
              <tbody>{b ? b.rows.map((r) => <Row key={r.model} r={r} />) : <tr><td colSpan={6} className="muted">Run the benchmark to fill this table.</td></tr>}</tbody>
            </table>
            {b && (
              <details className="raw panel-body">
                <summary>Results for each question</summary>
                <table className="table" style={{ marginTop: 8 }}>
                  <thead><tr><th>Checker</th><th>Question</th><th className="n">Correct</th><th className="n">Traps caught</th><th className="n">False alarms</th></tr></thead>
                  <tbody>
                    {b.rows.flatMap((r) =>
                      Object.entries(r.perQuestion).map(([q, p]) => (
                        <tr key={r.model + q}>
                          <td>{r.label}</td><td>{allQ.find((x) => x.id === q)?.question ?? q}</td>
                          <td className="n">{p.correct}/{p.n}</td><td className="n">{p.caught}/{p.traps}</td><td className="n">{p.falseAlarms}/{p.negatives}</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
                <p className="muted small" style={{ marginTop: 8 }}>
                  Calibration error: the gap between confidence and accuracy (0 is perfect). A case can accept more than one answer; a checker is correct if it picks any accepted one.
                  {set === "synthetic" ? " Synthetic labels come from the templates that built each case: good for volume on known traps, weaker than hand labels for real agent mistakes." : ""}
                </p>
              </details>
            )}
          </section>
        );
      })}

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><h2 className="h3">Live questions</h2><span className="muted small">{allQ.length} in use</span></div>
          <table className="table">
            <tbody>
              {allQ.map((q) => (
                <tr key={q.id}>
                  <td>
                    {q.question}
                    <div className="muted small">{q.source} · v{q.version} · approved by {q.approvedBy}</div>
                  </td>
                  <td><span className="pill pill-calm">{q.modelChecked ? "Model" : "Code only"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="stack-lg">
          <section className="panel">
            <div className="panel-head"><h2 className="h3">Found by the discovery agent</h2></div>
            {proposed.length ? (
              <ul className="quiet-list">
                {proposed.map((q) => (
                  <li key={q.id} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                    <span>{q.question}<div className="muted small">{q.source}</div></span>
                    <QuestionButtons id={q.id} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="panel-body muted small">
                No proposed questions yet. {sys.claude ? "Run the discovery agent on the sampled traces." : "The discovery agent needs ANTHROPIC_API_KEY or OPENROUTER_API_KEY."}
              </div>
            )}
          </section>

          <section className="panel panel-pad stack">
            <h2 className="h3">Eval candidates</h2>
            <p className="small">
              {unlabeled ? <><b>{unlabeled}</b> waiting for an area expert. </> : "No eval candidates yet. "}
              {labeled ? `${labeled} labelled.` : ""} Each rejected card and each discovery case lands here.
            </p>
            <Link href="/label" className="btn btn-sm" style={{ alignSelf: "flex-start" }}>Open labeling</Link>
          </section>

          <section className="panel panel-pad stack">
            <h2 className="h3">Autonomy ladder</h2>
            <p className="small">
              Approval limit: <b>€{s.settings.costLimitEur}</b>. Every booking, date, cost and customer message needs a person. Next step: let an action type
              (for example ferry rebooks under €100) run without a person when its eval pass rate stays above a set limit.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
