import { create, hasClaude, MODELS, parseJson, textOf } from "./llm";
import { LIVE_QUESTIONS } from "./questions";
import { id, nowIso, readState, update } from "./store";
import type { EvalCandidate, Fact, TypedQuestion } from "./types";

// The discovery agent. A large model reads sampled traces and rejected cards,
// finds failure types that the live questions do not cover, and writes typed
// question drafts with labelled cases. A person makes a question live.

type Found = {
  failure_types: {
    question_id: string;
    question: string;
    options: string[];
    trap_answers: string[];
    warning: string;
    why: string;
    cases: { order_ref: string; action: string; facts: { label: string; value: string; source: string }[]; suggested_answer: string }[];
  }[];
};

export async function runDiscovery(sample = 12) {
  if (!hasClaude()) throw new Error("The discovery agent needs ANTHROPIC_API_KEY or OPENROUTER_API_KEY.");
  const s = readState();
  const runs = s.runs.filter((r) => r.status !== "running").slice(-sample);
  const rejected = s.cards.filter((c) => c.status === "rejected" || c.status === "edited");
  const existing = [...LIVE_QUESTIONS, ...s.questions];

  const traceText = runs
    .map((r) => {
      const steps = r.steps
        .map((st) => (st.kind === "tool" ? `TOOL ${st.tool} ${JSON.stringify(st.input)} -> ${JSON.stringify(st.output).slice(0, 600)}` : `${st.kind.toUpperCase()}: ${st.text}`))
        .join("\n");
      return `=== Run ${r.id} on ${r.orderRef} (${r.status})\nEvent: ${r.trigger}\n${steps}`;
    })
    .join("\n\n");
  const rejectText = rejected
    .map((c) => `=== Card on ${c.orderRef}, ${c.status}: ${c.summary}\nProposal: ${c.proposal.description}\nReason: ${c.rejectReason ?? "edited"}. Operator note: ${c.rejectNote ?? c.editNote ?? "none"}\nFacts: ${c.facts.map((f) => `${f.label}: ${f.value} [${f.source}]`).join("; ")}`)
    .join("\n\n");

  const res = await create({
    model: MODELS.judge,
    max_tokens: 16000,
    output_config: {
      effort: "high",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["failure_types"],
          properties: {
            failure_types: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["question_id", "question", "options", "trap_answers", "warning", "why", "cases"],
                properties: {
                  question_id: { type: "string" },
                  question: { type: "string" },
                  options: { type: "array", items: { type: "string" } },
                  trap_answers: { type: "array", items: { type: "string" } },
                  warning: { type: "string" },
                  why: { type: "string" },
                  cases: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["order_ref", "action", "facts", "suggested_answer"],
                      properties: {
                        order_ref: { type: "string" },
                        action: { type: "string" },
                        suggested_answer: { type: "string" },
                        facts: { type: "array", items: { type: "object", additionalProperties: false, required: ["label", "value", "source"], properties: { label: { type: "string" }, value: { type: "string" }, source: { type: "string" } } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    system:
      "You review the work of a car delivery operations agent. You look for types of failure that the current typed questions do not cover yet. " +
      "A typed question must be answerable by a small decision model from the state at the decision moment and the agent action alone. " +
      "Prefer judgement questions over facts that plain code can calculate. Each question needs fixed options. " +
      "For each failure type, write 2 to 4 cases from the traces: include good and bad agent actions, and suggest the answer for each. " +
      "Use plain operations language. Return at most 3 failure types. Return none if the traces show no new failure type.",
    messages: [
      {
        role: "user",
        content:
          `Current live questions:\n${existing.map((q) => `- ${q.id}: ${q.question} (${(q.options ?? []).join("/")})`).join("\n")}\n\n` +
          `Sampled agent traces:\n${traceText || "(none)"}\n\nRejected or edited cards with the operator's reason:\n${rejectText || "(none)"}`,
      },
    ],
  });
  const found = parseJson<Found>(textOf(res));
  if (!found) throw new Error("The discovery agent returned no usable JSON.");

  const at = nowIso();
  return update((st) => {
    const added: TypedQuestion[] = [];
    for (const ft of found.failure_types) {
      if ([...LIVE_QUESTIONS, ...st.questions].some((q) => q.id === ft.question_id)) continue;
      const q: TypedQuestion = {
        id: ft.question_id,
        question: ft.question,
        type: ft.options.length === 2 ? "yes_no" : "choice",
        options: ft.options,
        trapAnswers: ft.trap_answers,
        warning: ft.warning,
        source: `Discovery agent: ${ft.why}`,
        version: 1,
        status: "proposed",
        modelChecked: true,
      };
      st.questions.push(q);
      added.push(q);
      for (const c of ft.cases) {
        const cand: EvalCandidate = {
          id: id("cand"),
          createdAt: at,
          source: "discovery_agent",
          orderRef: c.order_ref,
          questionId: q.id,
          question: q.question,
          options: q.options ?? [],
          state: c.facts.map((f): Fact => ({ label: f.label, value: f.value, source: (f.source as Fact["source"]) || "tool", observedAt: at })),
          action: c.action,
          suggestedAnswer: c.suggested_answer,
        };
        st.candidates.push(cand);
      }
    }
    return { added, sampledRuns: runs.length, rejectedCards: rejected.length };
  });
}

export function approveQuestion(qid: string, by: string) {
  return update((s) => {
    const q = s.questions.find((x) => x.id === qid);
    if (!q) throw new Error("No such question");
    q.status = "live";
    q.approvedBy = by;
    return q;
  });
}

export function retireQuestion(qid: string) {
  return update((s) => {
    const q = s.questions.find((x) => x.id === qid);
    if (q) q.status = "retired";
  });
}

export function labelCandidate(cid: string, label: string, note: string | undefined, by: string) {
  return update((s) => {
    const c = s.candidates.find((x) => x.id === cid);
    if (!c) throw new Error("No such case");
    c.label = label;
    c.labelNote = note;
    c.labeledBy = by;
    c.labeledAt = nowIso(s);
    return c;
  });
}
