import type Anthropic from "@anthropic-ai/sdk";
import { data, SNAPSHOT_AT } from "./data";
import { applyDriverReply, composeDriverReply } from "./driver";
import { create, hasClaude, MODELS } from "./llm";
import { runCardChecks } from "./checks";
import { canRunAlone, runAlone } from "./decisions";
import { photosForAgent } from "./visual";
import { scenario, type Scenario, type ScriptStep } from "./scenarios";
import { id, nowIso, readState, update, type State } from "./store";
import type { ActionKind, AgentRun, DecisionCard, Fact, FactSource, ProposedAction, TraceStep } from "./types";
import {
  addFix, allFixes, allMessages, estimateArrival, getGps, getOrder, getTravelOptions, imageContext, listAttachments, lookupPlace, orderFingerprint, recordAgentMessage,
} from "./world";
import { askAboutImage, attachments, VISUAL_QUESTIONS, visualQuestion } from "./vision";
import { nearbyPlacesTool, rankStopCauseTool, STOP_RULE_TEXT } from "./stopcheck";
import { scenarioForOrder } from "./scenarios";
import type { CheckResult } from "./types";

// The on-the-road agent. A language model works in a loop with mock tools.
// It does the cheap work first, then either closes the event quietly or brings
// a person one decision card. Without an API key the same tools run from a
// scripted plan per scenario, so the app works from a fresh clone.

const SYSTEM = `You are Bahn's on-the-road agent. Bahn delivers used cars with freelance drivers across Finland, Denmark and Germany.
You handle one on-the-road event at a time: a long stop, a GPS gap, a warning light or breakdown, a ferry at risk, or a late driver with a chained gig.

How you work:
- Do the cheap work first: read the order, check the GPS and its age, look up the place, read the travel options, calculate the arrival. Ask the driver only when the records cannot answer.
- If the facts are fine, call close_quietly. Do not bring a person a case that does not need one.
- If a person must decide, call propose_action with one clear decision.

Rules:
- Never contact a customer. A customer is anyone who pays Bahn (the dealer or buyer). You may draft a customer message in the proposal; a person sends it.
- You may message the driver. Keep it short and kind. Ask if they are safe when something is wrong.
- You change nothing yourself: no booking, date, cost or customer promise. A person approves each change.
- If a photo or scan matters (damage, a warning light, keys), call check_photos. A photo answer shows what the photo shows. It does not prove who took it or when the damage happened. Cite the photo's record_id on the card.
- A quote is not a booking. A booking is not proof of check-in or boarding.
- A GPS fix older than 60 minutes is not the current position. A driver message is not a GPS fix. A home city is not a location. An app ETA is an estimate.
- Missing GPS before about 1 hour before pickup is normal: treat the position as unknown, not as a problem.
- Read earlier agent proposals and operator notes. A person may have replaced an earlier instruction. Follow the latest one.
- When facts conflict, stop and ask (the driver), or put the conflict on the card.

Long stops (the stop rule: ${STOP_RULE_TEXT}):
- Do the cheap checks first: get_gps (is the fix fresh?), nearby_places (what is at the stop?), then rank_stop_cause (Jev ranks the places and the likely cause, and the code policy gives next_step).
- next_step "close_quietly": a normal break at a fuel station, café, rest area or charger, a fresh fix and a safe arrival. Close quietly and do not message the driver.
- next_step "ask_driver": the place is unusual or the position is old. Ask the driver if everything is fine, then call rank_stop_cause again.
- next_step "card": the driver reports a breakdown, the delivery is late, or the driver did not answer. Bring a person one card with the stop place and time, the driver's reply (or that there was none), the arrival impact and one next step.
- A ranked place is a likelihood, not proof. Write "Jev ranks ... first", not "the driver is at ...", until the driver confirms.
- Photos and scans: list_attachments shows them; check_image asks typed questions about one file (a decision model looks at the image). Cite the attachment id as the record_id of a photo fact. A photo shows what it shows at capture time: it does not prove when damage happened or who is at fault.

The decision card is for an operations person, not an engineer:
- summary: one sentence, under 120 characters: what happened and the decision needed, ending in a question.
- facts: 3 to 6 facts. Each has a source and the record_id from the tool output it came from (message ids, fix ids, quote ids, reservation ids, window ids). Use "@last_driver_reply" for the driver's latest reply, "@last_agent_message" for your last chat message, "@latest_fix" for the newest GPS fix and "@stop" for the places lookup and Jev ranking.
- deadline_iso: when a promise breaks if nobody acts (check-in cutoff, pickup start, delivery window end).
- agent_actions: what you already did, in short past-tense lines.
- proposal: kind, a plain description of what happens on approval, cost_delta_eur if money changes, travel_option_id if it rests on a travel option, and customer_draft if the customer needs a message.

Before each tool call, write one short sentence that says why you call it.`;

const TOOLS: Anthropic.Beta.BetaTool[] = [
  { name: "get_order", description: "Read the order, car, customer, driver, assignment, pickup slot, delivery promise, chained gigs, open alerts, incidents, earlier agent proposals and recent messages.", input_schema: { type: "object", properties: { order_ref: { type: "string" } }, required: ["order_ref"] } },
  { name: "get_gps", description: "Get the last GPS fix for the order's car: time of the fix, age, quality, distance remaining. Can be empty before the tracking window.", input_schema: { type: "object", properties: { order_ref: { type: "string" } }, required: ["order_ref"] } },
  { name: "lookup_place", description: "Look up the place type and name for a GPS fix, for example a fuel station or a rest area. Pass a fix id, or '@latest' with the order_ref.", input_schema: { type: "object", properties: { fix_id: { type: "string" }, order_ref: { type: "string" } }, required: ["fix_id"] } },
  { name: "nearby_places", description: "Look up the places around the car's latest GPS fix (Google Places, or simulated places without a key): fuel stations, cafés, rest areas, repair shops, parking. Returns the stop time, the GPS age and the places with their distance. Optional radius_m (default 400).", input_schema: { type: "object", properties: { order_ref: { type: "string" }, radius_m: { type: "number" } }, required: ["order_ref"] } },
  { name: "rank_stop_cause", description: "Jev ranks the nearby places (which one explains the stop) and the cause (normal break, breakdown, traffic, old GPS, unusual), using the stop time, the GPS age, the arrival and the driver chat since the stop. Returns the probabilities and next_step from the code policy: close_quietly, ask_driver or card. Call nearby_places first. Call it again after the driver answers.", input_schema: { type: "object", properties: { order_ref: { type: "string" } }, required: ["order_ref"] } },
  { name: "message_driver", description: "Send a chat message to the order's driver. Returns the driver's reply, or null when the driver does not answer within 15 min. Never use this for customers.", input_schema: { type: "object", properties: { order_ref: { type: "string" }, text: { type: "string" } }, required: ["order_ref", "text"] } },
  { name: "get_travel_options", description: "Ferry and train bookings and quotes for the order. Each row says if it is a BOOKING, a QUOTE_NOT_BOOKED, or SOLD_OUT, with price, times and when it was checked.", input_schema: { type: "object", properties: { order_ref: { type: "string" } }, required: ["order_ref"] } },
  { name: "estimate_arrival", description: "Calculate the new arrival time, minutes late against the delivery promise, and whether a chained gig of the same driver is at risk. Includes charging stops for electric cars. Optional: extra delay minutes, or a travel option id to arrive via.", input_schema: { type: "object", properties: { order_ref: { type: "string" }, extra_delay_minutes: { type: "number" }, via_travel_option_id: { type: "string" }, from_distance_km: { type: "number" } }, required: ["order_ref"] } },
  { name: "check_photos", description: "List the photos for the order (pickup, delivery, message, key and site photos) with the answers of the visual decision models: is the photo clear, is damage visible, which warning light is on, are the keys in view. Each photo has the record_id of the proof or message that owns it.", input_schema: { type: "object", properties: { order_ref: { type: "string" } }, required: ["order_ref"] } },
  {
    name: "propose_action",
    description: "Bring a person one decision card. Ends your work on this event.",
    input_schema: {
      type: "object",
      properties: {
        order_ref: { type: "string" },
        summary: { type: "string" },
        deadline_iso: { type: "string" },
        deadline_label: { type: "string" },
        facts: { type: "array", items: { type: "object", properties: { label: { type: "string" }, value: { type: "string" }, source: { type: "string", enum: ["gps", "driver_chat", "order", "site", "operator", "app", "tool"] }, record_id: { type: "string" } }, required: ["label", "value", "source"] } },
        agent_actions: { type: "array", items: { type: "string" } },
        proposal: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["rebook_ferry", "rebook_train", "change_date", "change_cost", "message_customer", "message_driver", "repost_gig", "call_dealer", "call_driver", "none"] },
            description: { type: "string" },
            cost_delta_eur: { type: "number" },
            travel_option_id: { type: "string" },
            customer_draft: { type: "string" },
          },
          required: ["kind", "description"],
        },
      },
      required: ["order_ref", "summary", "deadline_iso", "facts", "agent_actions", "proposal"],
    },
  },
  { name: "list_attachments", description: "List the photos and scans on the order (pickup and delivery photos, message photos, CMR, collection authority, receipts) with their record status and review notes.", input_schema: { type: "object", properties: { order_ref: { type: "string" } }, required: ["order_ref"] } },
  {
    name: "check_image",
    description: "Ask typed questions about one photo or scan. The order car, VIN and claimed amount are filled in from the records. Questions: " + VISUAL_QUESTIONS.map((q) => `${q.id} (${q.question})`).join("; "),
    input_schema: { type: "object", properties: { attachment_id: { type: "string" }, question_ids: { type: "array", items: { type: "string" } } }, required: ["attachment_id", "question_ids"] },
  },
  { name: "close_quietly", description: "Log the event and close it without a person, because the facts are fine. Ends your work on this event.", input_schema: { type: "object", properties: { order_ref: { type: "string" }, reason: { type: "string" } }, required: ["order_ref", "reason"] } },
];

// ---------- run bookkeeping ----------

function pushStep(runId: string, step: TraceStep) {
  update((s) => {
    const run = s.runs.find((r) => r.id === runId);
    if (run) run.steps.push(step);
  });
}

function trimForModel(v: unknown) {
  const s = JSON.stringify(v);
  return s.length > 7000 ? `${s.slice(0, 7000)}…(truncated)` : s;
}

async function runTool(runId: string, sc: Scenario, name: string, input: Record<string, unknown>): Promise<unknown> {
  const t0 = performance.now();
  let output: unknown;
  let driverStep: TraceStep | undefined;
  if (name === "message_driver") {
    const ref = String(input.order_ref ?? sc.orderRef);
    const order = data().order(ref);
    if (!order) output = { error: `No order ${ref}` };
    else if (order.reference !== sc.orderRef && !data().forOrder("work_assignments", order.id).length) output = { error: "No driver on that order." };
    else {
      update((s) => recordAgentMessage(s, order.id, String(input.text)));
      if (scenarioForOrder(ref)?.driver.silent) {
        // The demo does not wait 15 real minutes: a silent driver's wait is shortened to a moment.
        await pause(1500);
        output = { driver_reply: null, waited_minutes: 15, note: "No answer within 15 min. (Demo: the wait is shortened.)" };
        driverStep = { kind: "driver", at: nowIso(), text: "No answer within 15 min." };
      } else {
        const reply = await composeDriverReply(readState(), ref);
        const msg = update((s) => applyDriverReply(s, ref, reply));
        output = { message_id: msg.id, driver_reply: reply, replied_at: msg.at };
        driverStep = { kind: "driver", at: msg.at, text: reply };
      }
    }
  } else if (name === "nearby_places") {
    output = await nearbyPlacesTool(runId, input as never);
  } else if (name === "rank_stop_cause") {
    output = await rankStopCauseTool(runId, input as never);
  } else if (name === "check_image") {
    output = await checkImage(String(input.attachment_id), (input.question_ids as string[]) ?? []);
  } else {
    output = update((s): unknown => {
      try {
        const i = input as never;
        switch (name) {
          case "get_order": return getOrder(s, i);
          case "get_gps": return getGps(s, i);
          case "lookup_place": return lookupPlace(s, i);
          case "get_travel_options": return getTravelOptions(s, i);
          case "estimate_arrival": return estimateArrival(s, i);
          case "list_attachments": return listAttachments(s, i);
          default: return { error: `Unknown tool ${name}` };
        }
      } catch (e) {
        return { error: (e as Error).message };
      }
    });
  }
  const ms = Math.round(performance.now() - t0);
  pushStep(runId, { kind: "tool", at: nowIso(), tool: name, input, output, ms });
  if (driverStep) pushStep(runId, driverStep);
  update((s) => {
    const o = data().order(String(input.order_ref ?? sc.orderRef));
    s.traces.push({ id: id("trace"), orderId: o?.id ?? "", agent: "on-the-road", state: [], action: { tool: name, input }, createdAt: nowIso(s) });
  });
  return output;
}

// Ask a photo model about one photo or scan. Context values come from the records.
async function checkImage(attachmentId: string, questionIds: string[]) {
  try {
    const { attachment, context } = imageContext(attachmentId);
    const ids = questionIds.filter((q) => visualQuestion(q));
    if (!ids.length) return { error: `Use question ids from: ${VISUAL_QUESTIONS.map((q) => q.id).join(", ")}` };
    const r = await askAboutImage(attachment.file, context, ids);
    return {
      attachment_id: attachment.id,
      file: attachment.file,
      checked_by: r.model === "jev" ? process.env.JEV_MODEL || "typesafe/jev-1.14" : "Liquid d1-3B, fine-tuned (model server)",
      context,
      answers: r.answers.map((a) => ({ question_id: a.questionId, question: visualQuestion(a.questionId)?.question, answer: a.answer, confidence: Math.round(a.confidence * 100) / 100 })),
      ms: Math.round(r.ms),
      cost_usd: r.costUsd,
    };
  } catch (e) {
    return { error: (e as Error).message, not_connected: /not connected/.test((e as Error).message) };
  }
}

type ImageCheck = { attachment_id: string; answers: { question_id: string; answer: string; confidence: number }[]; ms: number; cost_usd?: number };

function imageChecksOf(runId: string): ImageCheck[] {
  const run = readState().runs.find((r) => r.id === runId);
  return (run?.steps ?? [])
    .filter((st) => st.kind === "tool" && st.tool === "check_image" && !(st.output as { error?: string })?.error)
    .map((st) => (st as { output: ImageCheck }).output);
}

// Scripted plans can write a photo fact as { vision: { attachment_id, question_id, yes, no } }:
// the value then comes from Jev's real answer, or says that the check did not run.
function visionFactValue(runId: string, v: { attachment_id: string; question_id: string; yes: string; no: string }) {
  const hit = imageChecksOf(runId)
    .filter((c) => c.attachment_id === v.attachment_id)
    .flatMap((c) => c.answers)
    .find((a) => a.question_id === v.question_id);
  if (!hit) return "Not checked: the photo model is not connected";
  return `${hit.answer === "yes" ? v.yes : v.no} (photo model, ${Math.round(hit.confidence * 100)}% sure)`;
}

// Find the time a cited record was observed, so the card can show its age.
function resolveFact(s: State, orderId: string, f: { label: string; value: string; source: string; record_id?: string }): Fact {
  const d = data();
  let recordId = f.record_id;
  let observedAt: string | undefined;
  if (recordId === "@last_driver_reply") {
    const m = allMessages(s, orderId).filter((x) => x.from === "driver").at(-1);
    recordId = m?.id;
    observedAt = m?.at;
  } else if (recordId === "@latest_fix") {
    const fx = allFixes(s, orderId).at(-1);
    recordId = fx?.id;
    observedAt = fx?.observedAt;
  } else if (recordId === "@last_agent_message") {
    const m = allMessages(s, orderId).filter((x) => x.from === "agent").at(-1);
    recordId = m?.id;
    observedAt = m?.at;
  } else if (recordId === "@stop") {
    const stop = s.runs.filter((r) => r.orderId === orderId && r.stop).at(-1)?.stop;
    recordId = stop ? `sim-stop-${stop.fixId}` : undefined;
    observedAt = stop?.ranking?.rankedAt;
  } else if (recordId === "win-delivery") {
    recordId = d.deliveryPromise(orderId)?.id;
  } else if (recordId === "win-pickup") {
    recordId = d.pickupSlot(orderId)?.id;
  }
  const att = recordId ? attachments().find((a) => a.id === recordId || a.file === recordId) : undefined;
  if (att) {
    return { label: f.label, value: f.value, source: (f.source as FactSource) ?? "app", observedAt: att.capturedAt ?? SNAPSHOT_AT, recordId: att.id, imageFile: att.file };
  }
  if (recordId && !observedAt) {
    const chat = s.chat.find((c) => c.id === recordId);
    const fix = allFixes(s, orderId).find((x) => x.id === recordId) ?? s.fixes.find((x) => x.id === recordId);
    const row = d.get(recordId);
    observedAt =
      chat?.at ?? fix?.observedAt ??
      row?.observed_at ?? row?.authored_at ?? row?.checked_at ?? row?.triggered_at ?? row?.reviewed_at ?? row?.created_at ?? row?.booked_at ?? row?.opened_at ??
      // Records with no time of their own (time windows, plans) date from the order.
      (row ? (d.get(orderId)?.created_at ?? SNAPSHOT_AT) : undefined);
    if (!observedAt && recordId.startsWith("sim-")) observedAt = nowIso(s);
  }
  return { label: f.label, value: f.value, source: (f.source as FactSource) ?? "tool", observedAt: observedAt ?? nowIso(s), recordId };
}

async function finishWithCard(runId: string, sc: Scenario, input: Record<string, any>) {
  const s0 = readState();
  const order = data().order(sc.orderRef)!;
  const p = input.proposal ?? {};
  const proposal: ProposedAction = {
    kind: (p.kind as ActionKind) ?? "none",
    description: String(p.description ?? ""),
    costDelta: typeof p.cost_delta_eur === "number" ? p.cost_delta_eur : undefined,
    needsApproval: true,
    travelOptionId: p.travel_option_id || undefined,
    customerDraft: p.customer_draft || undefined,
  };
  const facts: Fact[] = (input.facts ?? []).map((f: any) =>
    resolveFact(s0, order.id, f.vision ? { ...f, value: visionFactValue(runId, f.vision), record_id: f.vision.attachment_id } : f),
  );
  const at = nowIso(s0);
  // The photo model's answers sit next to the photo they are about.
  const imageResults: CheckResult[] = imageChecksOf(runId).flatMap((c) =>
    c.answers.map((a) => {
      const q = visualQuestion(a.question_id)!;
      // "Different car" adds nothing when the same photo shows no car at all.
      const noCar = c.answers.some((x) => x.question_id === "photo_vehicle_main" && x.answer === "no");
      const flagged = q.trapAnswers.includes(a.answer) && a.confidence >= 0.7 && !(noCar && a.question_id === "photo_matches_car");
      return {
        questionId: a.question_id, questionVersion: q.version, model: "jev" as const, answer: a.answer, confidence: a.confidence,
        ms: c.ms, costUsd: c.cost_usd, flagged,
        message: flagged ? q.warning : `${q.question} ${a.answer === "yes" ? "Yes" : a.answer === "no" ? "No" : a.answer} (${Math.round(a.confidence * 100)}%)`,
        factLabel: facts.find((f) => f.recordId === c.attachment_id)?.label,
      };
    }),
  );
  const checks = await runCardChecks(
    { at, state: facts, action: `${input.summary}\n${proposal.description}${proposal.customerDraft ? `\nCustomer draft (a person sends it): ${proposal.customerDraft}` : ""}`, proposal },
    s0.questions,
    s0.settings.costLimitEur,
  ).then((r) => [...imageResults, ...r]);
  const card: DecisionCard = {
    id: id("card"),
    orderId: order.id,
    orderRef: order.reference,
    runId,
    status: "new",
    summary: String(input.summary),
    deadline: String(input.deadline_iso ?? at),
    deadlineLabel: String(input.deadline_label ?? ""),
    facts,
    agentActions: input.agent_actions ?? [],
    proposal,
    checks,
    createdAt: at,
    fingerprint: "",
    stop: s0.runs.find((r) => r.id === runId)?.stop,
  };
  update((s) => {
    card.fingerprint = orderFingerprint(s, order.id);
    s.cards = s.cards.filter((c) => !(c.orderId === order.id && (c.status === "new" || c.status === "changed")));
    s.cards.push(card);
    s.traces.push({ id: id("trace"), orderId: order.id, agent: "on-the-road", state: facts, action: proposal, createdAt: at });
    const alone = canRunAlone(card, s.settings.costLimitEur, s.questions);
    if (alone) runAlone(s, card);
    else s.timeline.push({ id: id("evt"), orderId: order.id, at, actor: "agent", text: `Agent asks a person: ${card.summary}` });
    const run = s.runs.find((r) => r.id === runId)!;
    run.status = "card";
    run.cardId = card.id;
    run.endedAt = nowIso(s);
    run.steps.push({ kind: "outcome", at, text: alone ? `Acted alone under the €${s.settings.costLimitEur} approval limit: ${card.proposal.description}` : `Decision card for a person: ${card.summary}` });
  });
}

function finishQuietly(runId: string, sc: Scenario, reason: string) {
  update((s) => {
    const order = data().order(sc.orderRef)!;
    const at = nowIso(s);
    s.quietLog.push({ runId, orderRef: sc.orderRef, at, reason });
    s.timeline.push({ id: id("evt"), orderId: order.id, at, actor: "agent", text: `Agent closed the event without a person: ${reason}` });
    const run = s.runs.find((r) => r.id === runId)!;
    run.status = "quiet";
    run.quietReason = reason;
    run.endedAt = at;
    run.steps.push({ kind: "outcome", at, text: `Closed quietly: ${reason}` });
  });
}

function fail(runId: string, err: unknown) {
  update((s) => {
    const run = s.runs.find((r) => r.id === runId);
    if (!run) return;
    run.status = "failed";
    run.error = (err as Error)?.message ?? String(err);
    run.endedAt = nowIso(s);
  });
}

// ---------- the two loops ----------

async function llmLoop(runId: string, sc: Scenario, instruction?: string) {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content:
        `Event (${nowIso()}): ${sc.trigger}\nOrder: ${sc.orderRef}` +
        (instruction ? `\n\nAn operator rejected or edited your earlier card and says: "${instruction}". Take this into account.` : ""),
    },
  ];
  let inTok = 0;
  let outTok = 0;
  for (let turn = 0; turn < 14; turn++) {
    const res = await create({ model: MODELS.agent, max_tokens: 16000, output_config: { effort: "medium" }, system: SYSTEM, tools: TOOLS, messages });
    inTok += res.usage.input_tokens;
    outTok += res.usage.output_tokens;
    update((s) => {
      const r = s.runs.find((x) => x.id === runId);
      if (r) r.usage = { inputTokens: inTok, outputTokens: outTok };
    });
    for (const b of res.content) if (b.type === "text" && b.text.trim()) pushStep(runId, { kind: "thought", at: nowIso(), text: b.text.trim() });
    if (res.stop_reason === "refusal") throw new Error("The model declined this request.");
    messages.push({ role: "assistant", content: res.content });
    const uses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (!uses.length) {
      if (res.stop_reason === "pause_turn") continue;
      throw new Error("The agent stopped without closing the event or making a card.");
    }
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const u of uses) {
      const input = (u.input ?? {}) as Record<string, any>;
      if (u.name === "propose_action") {
        pushStep(runId, { kind: "tool", at: nowIso(), tool: u.name, input, output: { ok: true }, ms: 0 });
        return finishWithCard(runId, sc, input);
      }
      if (u.name === "close_quietly") {
        pushStep(runId, { kind: "tool", at: nowIso(), tool: u.name, input, output: { ok: true }, ms: 0 });
        return finishQuietly(runId, sc, String(input.reason));
      }
      const out = await runTool(runId, sc, u.name, input);
      results.push({ type: "tool_result", tool_use_id: u.id, content: trimForModel(out), is_error: Boolean((out as any)?.error) });
    }
    messages.push({ role: "user", content: results });
  }
  throw new Error("The agent used too many steps.");
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function scriptedLoop(runId: string, sc: Scenario) {
  for (const step of sc.script as ScriptStep[]) {
    await pause(650);
    pushStep(runId, { kind: "thought", at: nowIso(), text: step.thought });
    if ("final" in step) {
      await pause(400);
      pushStep(runId, { kind: "tool", at: nowIso(), tool: step.final, input: step.input, output: { ok: true }, ms: 0 });
      if (step.final === "close_quietly") {
        const v = step.input.reason_vision as Parameters<typeof visionFactValue>[1] | undefined;
        return finishQuietly(runId, sc, v ? `${step.input.reason} ${visionFactValue(runId, v)}.` : String(step.input.reason));
      }
      return finishWithCard(runId, sc, step.input);
    }
    await runTool(runId, sc, step.tool, step.input);
  }
}

export function startRun(scenarioId: string, opts: { instruction?: string; forceScripted?: boolean } = {}): AgentRun {
  const sc = scenario(scenarioId);
  if (!sc) throw new Error(`No scenario ${scenarioId}`);
  const order = data().order(sc.orderRef)!;
  const mode = hasClaude() && !opts.forceScripted ? "llm" : "scripted";
  const run = update((s) => {
    const r: AgentRun = {
      id: id("run"),
      orderId: order.id,
      orderRef: sc.orderRef,
      scenarioId,
      trigger: sc.trigger,
      mode,
      model: mode === "llm" ? MODELS.agent : undefined,
      status: "running",
      startedAt: nowIso(s),
      steps: [],
      operatorInstruction: opts.instruction,
    };
    s.runs.push(r);
    // The event itself can bring a new signal, for example a fix that shows the stop.
    if (sc.extraFix && !s.fixes.some((f) => f.orderId === order.id)) addFix(s, order.id, sc.extraFix);
    s.timeline.push({ id: id("evt"), orderId: order.id, at: r.startedAt, actor: "system", text: `Event: ${sc.title}` });
    return r;
  });
  const loop = mode === "llm" ? llmLoop(run.id, sc, opts.instruction) : scriptedLoop(run.id, sc);
  loop.catch((e) => fail(run.id, e));
  return run;
}

export async function runToEnd(scenarioId: string, opts: { instruction?: string; forceScripted?: boolean } = {}) {
  const run = startRun(scenarioId, opts);
  for (;;) {
    await pause(300);
    const r = readState().runs.find((x) => x.id === run.id)!;
    if (r.status !== "running") return r;
  }
}
