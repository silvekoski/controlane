"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { startRun } from "@/lib/agent";
import { runBenchmark } from "@/lib/benchmark";
import { approveCard, rejectCard } from "@/lib/decisions";
import { approveQuestion, labelCandidate, retireQuestion, runDiscovery } from "@/lib/discovery";
import { readState, setClock, update } from "@/lib/store";
import type { RejectReason } from "@/lib/types";
import { checkOrderPhotos } from "@/lib/visual";

// Set the clock: back to the real time, or travel to a moment.
export async function setClockAction(next: { mode: "live" } | { mode: "travel"; at: string }) {
  setClock(next);
  revalidatePath("/", "layout");
}

export async function approve(cardId: string) {
  const r = approveCard(cardId);
  revalidatePath("/", "layout");
  return r;
}

export async function approveEdited(cardId: string, form: { description: string; costDelta?: number; customerDraft?: string; note?: string }) {
  const r = approveCard(cardId, form);
  revalidatePath("/", "layout");
  return r;
}

export async function reject(cardId: string, reason: RejectReason, note: string) {
  rejectCard(cardId, reason, note || undefined);
  revalidatePath("/", "layout");
}

// The operator tells the agent what to change, and the agent tries again.
export async function redoWithNote(cardId: string, note: string) {
  const s = readState();
  const card = s.cards.find((c) => c.id === cardId);
  const run = s.runs.find((r) => r.id === card?.runId);
  if (!card || !run) return;
  rejectCard(cardId, "other", note);
  const next = startRun(run.scenarioId, { instruction: note });
  redirect(`/orders/${next.orderRef}?run=${next.id}`);
}

export async function benchmark() {
  await runBenchmark("hand");
  try {
    await runBenchmark("synthetic");
  } catch {
    // No synthetic set generated yet.
  }
  revalidatePath("/evals");
}

export async function discover() {
  try {
    await runDiscovery();
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/evals");
  return { error: null };
}

export async function makeLive(questionId: string) {
  approveQuestion(questionId, readState().settings.operator);
  revalidatePath("/evals");
}

export async function retire(questionId: string) {
  retireQuestion(questionId);
  revalidatePath("/evals");
}

export async function label(candidateId: string, answer: string, note: string) {
  labelCandidate(candidateId, answer, note || undefined, readState().settings.operator);
  revalidatePath("/label");
  revalidatePath("/evals");
}

export async function setCostLimit(eur: number) {
  update((s) => {
    s.settings.costLimitEur = Math.max(0, eur);
  });
  revalidatePath("/", "layout");
}

export async function checkPhotos(orderRef: string) {
  await checkOrderPhotos(orderRef, { fresh: true });
  revalidatePath(`/orders/${orderRef}`);
}
