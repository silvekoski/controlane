import { data } from "./data";
import { applyDriverReply, composeDriverReply } from "./driver";
import { id, nowIso, readState, update, type State } from "./store";
import { LIVE_QUESTIONS } from "./questions";
import type { DecisionCard, RejectReason, TypedQuestion } from "./types";
import { VISUAL_QUESTIONS } from "./vision";
import { orderFingerprint } from "./world";

// What happens after a person decides. Every executed action is simulated:
// nothing real is booked, called or sent.

export const REJECT_REASONS: Record<RejectReason, string> = {
  wrong_info: "Wrong facts",
  too_early: "Too early, wait",
  ask_customer: "Ask the customer first",
  other: "Other",
};

export const EFFECT: Record<string, string> = {
  rebook_ferry: "Ferry rebooking sent to the carrier (simulated). The old booking stays until the carrier confirms.",
  rebook_train: "Train rebooking sent (simulated).",
  change_date: "Delivery date change recorded (simulated).",
  change_cost: "Cost change recorded (simulated).",
  message_customer: "Customer message sent by the operator (simulated).",
  message_driver: "Driver message sent (simulated).",
  repost_gig: "Gig offered to nearby drivers (simulated). The current driver stays booked until a replacement accepts.",
  call_dealer: "Call task opened for the operator. The agent waits for the dealer's answer.",
  call_driver: "Call task opened for the operator: phone the driver now. The agent keeps watching the GPS.",
  none: "No action.",
};

function card(s: State, cardId: string): DecisionCard {
  const c = s.cards.find((x) => x.id === cardId);
  if (!c) throw new Error("No such card");
  if (c.status !== "new" && c.status !== "changed") throw new Error("This card is already decided");
  return c;
}

export type ApproveResult = { ok: true; outcome: string } | { ok: false; changed: true; message: string };

// Check the facts again just before acting. If a fact changed, the action does
// not run and the card goes back to the queue marked "Changed since approval".
export function approveCard(cardId: string, edits?: { description?: string; costDelta?: number; customerDraft?: string; note?: string }): ApproveResult {
  return update((s): ApproveResult => {
    const c = card(s, cardId);
    const by = s.settings.operator;
    const now = nowIso(s);
    const current = orderFingerprint(s, c.orderId);
    if (current !== c.fingerprint) {
      c.status = "changed";
      c.fingerprint = current;
      s.timeline.push({ id: id("evt"), orderId: c.orderId, at: now, actor: "system", text: "Approval stopped: a fact changed since the card was made. The card is back in the queue." });
      return { ok: false, changed: true, message: "A fact changed since this card was made. Read the new facts, then decide again." };
    }
    const edited = Boolean(edits && (edits.description !== undefined || edits.costDelta !== undefined || edits.customerDraft !== undefined));
    if (edits?.description !== undefined) c.proposal.description = edits.description;
    if (edits?.costDelta !== undefined) c.proposal.costDelta = edits.costDelta;
    if (edits?.customerDraft !== undefined) c.proposal.customerDraft = edits.customerDraft;
    c.status = edited ? "edited" : "approved";
    c.editNote = edits?.note;
    c.decidedBy = by;
    c.decidedAt = now;
    const parts = [EFFECT[c.proposal.kind] ?? "Action recorded (simulated)."];
    if (c.proposal.customerDraft) parts.push("Customer message sent by the operator (simulated).");
    c.outcome = parts.join(" ");
    s.timeline.push({ id: id("evt"), orderId: c.orderId, at: now, actor: "operator", text: `${by} ${edited ? "edited and approved" : "approved"}: ${c.proposal.description}` });
    s.timeline.push({ id: id("evt"), orderId: c.orderId, at: now, actor: "system", text: c.outcome });
    return { ok: true, outcome: c.outcome };
  });
}

export function rejectCard(cardId: string, reason: RejectReason, note?: string) {
  return update((s) => {
    const c = card(s, cardId);
    const now = nowIso(s);
    c.status = "rejected";
    c.rejectReason = reason;
    c.rejectNote = note;
    c.decidedBy = s.settings.operator;
    c.decidedAt = now;
    c.outcome = "Nothing runs. The agent keeps watching the order.";
    s.timeline.push({ id: id("evt"), orderId: c.orderId, at: now, actor: "operator", text: `${c.decidedBy} rejected the card: ${REJECT_REASONS[reason]}${note ? `. "${note}"` : ""}` });
    // Each reject becomes an eval candidate for an area expert to label.
    s.candidates.push({
      id: id("cand"),
      createdAt: now,
      source: "operator_reject",
      cardId: c.id,
      orderRef: c.orderRef,
      questionId: "escalation_level",
      question: "Was this the right decision to bring to a person, with the right proposal?",
      options: ["right", "wrong_facts", "too_early", "wrong_action"],
      state: c.facts,
      action: `${c.summary}\n${c.proposal.description}`,
      suggestedAnswer: reason === "wrong_info" ? "wrong_facts" : reason === "too_early" ? "too_early" : "wrong_action",
    });
    return c;
  });
}

// The autonomy ladder. Below the approval limit, the agent runs a booking or cost change
// alone, as Bahn's agents already book most flights and ask a person only for an expensive one.
// A customer message, a blocked rule, a trap answer or an unsure model still goes to a person.
const SURE_ENOUGH = 0.8;
const AUTO_KINDS = new Set(["rebook_ferry", "rebook_train", "change_cost", "repost_gig"]);

export function canRunAlone(c: DecisionCard, limitEur: number, extra: TypedQuestion[] = []): boolean {
  const p = c.proposal;
  if (limitEur <= 0 || !AUTO_KINDS.has(p.kind) || p.customerDraft) return false;
  if ((p.costDelta ?? 0) > limitEur) return false;
  // Without a decision model, nothing checked the judgement questions.
  if (!c.checks.some((x) => x.model !== "code")) return false;
  const questions = [...LIVE_QUESTIONS, ...extra, ...VISUAL_QUESTIONS];
  return !c.checks.some((x) => {
    if (x.blocking) return true;
    // The code check marks every quote. Booking the quote is the action itself, so only
    // a model that says the proposal treats a quote as already booked stops it.
    if (x.model === "code") return x.flagged && x.questionId !== "quote_as_booking";
    // A model trap answer stops it even below the warning level, and so does a "no trap" answer
    // below 80%: a guess is not safe enough to act without a person.
    const q = questions.find((y) => y.id === x.questionId);
    return x.flagged || !q || q.trapAnswers.includes(x.answer) || x.confidence < SURE_ENOUGH;
  });
}

// Marks a fresh card as run by the agent. Call inside update().
export function runAlone(s: State, c: DecisionCard) {
  const now = nowIso(s);
  c.status = "approved";
  c.decidedBy = `Agent, under the €${s.settings.costLimitEur} limit`;
  c.decidedAt = now;
  c.proposal.needsApproval = false;
  c.outcome = EFFECT[c.proposal.kind] ?? "Action recorded (simulated).";
  s.timeline.push({ id: id("evt"), orderId: c.orderId, at: now, actor: "agent", text: `Agent acted alone (cost under the €${s.settings.costLimitEur} limit): ${c.proposal.description}` });
  s.timeline.push({ id: id("evt"), orderId: c.orderId, at: now, actor: "system", text: c.outcome });
}

// An ops person writes to the driver. The simulated driver answers after a moment.
export async function operatorMessageDriver(orderRef: string, text: string) {
  const o = data().order(orderRef);
  if (!o) throw new Error("No order");
  update((s) => {
    s.chat.push({ id: id("chat"), orderId: o.id, at: nowIso(s), from: "operator", channel: "driver_chat", text });
  });
  const reply = await composeDriverReply(readState(), orderRef);
  update((s) => applyDriverReply(s, orderRef, reply));
}

// Test hook (API action change_fact): something changes in the world after the card was made.
export function simulateWorldChange(orderRef: string, text: string) {
  return update((s) => {
    const o = data().order(orderRef);
    if (!o) throw new Error("No order");
    const at = nowIso(s);
    s.chat.push({ id: id("chat"), orderId: o.id, at, from: "driver", channel: "driver_chat", text });
    s.timeline.push({ id: id("evt"), orderId: o.id, at, actor: "driver", text: `World change: driver wrote "${text}"` });
  });
}
