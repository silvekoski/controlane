import fs from "node:fs";
import path from "node:path";
import { ATTACHMENTS_DIR, data } from "./data";
import { jevQuestionOf, readJevAnswer, WARN_CONFIDENCE, type Answer } from "./checks";
import { costUsd, create, hasClaude, MODELS, parseJson, textOf } from "./llm";
import { nowIso, readState, update } from "./store";
import type { CheckerModel, CheckResult, Fact, Photo, PhotoCheck, TypedQuestion } from "./types";

// Visual checks. Drivers and sites send photos. A visual decision model answers
// typed questions about each photo, the same way Jev answers questions about text.
// Answers are stored by photo, so a photo is checked once per model, not once per card.

export type VisualQuestion = TypedQuestion & { kinds: string[] }; // the photo kinds the question applies to

const CAR_PHOTOS = ["PICKUP_PHOTOS", "DELIVERY_PHOTOS", "TRADE_IN_PICKUP_PHOTOS", "TRADE_IN_DELIVERY_PHOTOS", "MESSAGE_PHOTO"];
const ALL_PHOTOS = [...CAR_PHOTOS, "SITE_VISIT_PHOTO", "KEY_PICKUP_PHOTOS", "DASHBOARD_PHOTO"];

const vq = (q: Omit<VisualQuestion, "version" | "status" | "modelChecked" | "approvedBy">): VisualQuestion => ({
  ...q, version: 1, status: "live", modelChecked: true, approvedBy: "Ops lead",
});

export const VISUAL_QUESTIONS: VisualQuestion[] = [
  vq({
    id: "photo_clear",
    question: "Is `photo` clear enough to judge what it shows?",
    type: "choice",
    options: ["clear", "unclear"],
    criteria: { clear: "Sharp and well lit. The car, part or document is in view.", unclear: "Blurred, too dark, cut off, or the subject is not in view." },
    trapAnswers: ["unclear"],
    warning: "This photo is not clear enough to judge. Ask for a new photo.",
    source: "PRD visual checks: handover photo",
    kinds: ALL_PHOTOS,
  }),
  vq({
    id: "damage_visible",
    question: "Is damage visible on the car in `photo`, for example a scratch, dent, crack or mark?",
    type: "yes_no",
    options: ["yes", "no"],
    criteria: { yes: "A scratch, dent, crack, scuff or other mark on the car is visible.", no: "No damage is visible on the parts of the car in view." },
    trapAnswers: ["yes"],
    warning: "Damage may show in this photo. Compare it with the pickup photos before you decide.",
    source: "PRD visual checks: handover photo",
    kinds: CAR_PHOTOS,
  }),
  vq({
    id: "warning_light",
    question: "Which warning light is on in the dashboard in `photo`?",
    type: "choice",
    options: ["red", "amber", "none"],
    criteria: { red: "A red warning light is on.", amber: "An amber or yellow warning light is on, and no red one.", none: "No warning light is on." },
    trapAnswers: ["red", "amber"],
    warning: "A warning light is on in the dashboard photo.",
    source: "PRD visual checks: dashboard photo from the driver",
    kinds: ["DASHBOARD_PHOTO"],
  }),
  vq({
    id: "keys_visible",
    question: "Does `photo` show the car keys?",
    type: "yes_no",
    options: ["yes", "no"],
    criteria: { yes: "One or more car keys are in view.", no: "No car key is in view." },
    trapAnswers: ["no"],
    warning: "No key shows in this key photo.",
    source: "Packet: key pickup proof",
    kinds: ["KEY_PICKUP_PHOTOS"],
  }),
];

export function visualQuestion(id: string) {
  return VISUAL_QUESTIONS.find((q) => q.id === id);
}

export function questionsFor(photo: Photo) {
  return VISUAL_QUESTIONS.filter((q) => q.kinds.includes(photo.kind));
}

// ---------- Photos from the attachment manifest ----------

let photosCache: Photo[] | null = null;

export function allPhotos(): Photo[] {
  if (photosCache) return photosCache;
  const file = path.join(ATTACHMENTS_DIR, "manifest.json");
  const rows = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, string>[]) : [];
  // Jev reads PNG and JPEG only. PDFs (CMRs, receipts) need a page render first: not built.
  photosCache = rows
    .filter((r) => r.content_type === "image/jpeg" || r.content_type === "image/png")
    .map((r) => ({
      id: r.id,
      orderId: r.order_id,
      kind: r.kind,
      file: r.file_name,
      format: r.content_type === "image/png" ? "png" : "jpg",
      recordType: r.related_record_type,
      recordId: r.related_record_id,
      status: r.status,
      capturedAt: r.captured_at,
    }));
  return photosCache;
}

export function photo(id: string) {
  return allPhotos().find((p) => p.id === id);
}

export function photosForOrder(refOrId: string) {
  const o = data().order(refOrId);
  return o ? allPhotos().filter((p) => p.orderId === o.id) : [];
}

export function photosForRecord(recordId: string) {
  return allPhotos().filter((p) => p.recordId === recordId);
}

export function photoBytes(p: Photo) {
  const file = path.resolve(ATTACHMENTS_DIR, p.file);
  if (!file.startsWith(ATTACHMENTS_DIR + path.sep)) throw new Error("Photo path is outside the attachments folder");
  return fs.readFileSync(file);
}

export const PHOTO_KIND_LABEL: Record<string, string> = {
  PICKUP_PHOTOS: "Pickup photo",
  DELIVERY_PHOTOS: "Delivery photo",
  TRADE_IN_PICKUP_PHOTOS: "Trade-in pickup photo",
  TRADE_IN_DELIVERY_PHOTOS: "Trade-in delivery photo",
  MESSAGE_PHOTO: "Photo in a message",
  SITE_VISIT_PHOTO: "Site visit photo",
  KEY_PICKUP_PHOTOS: "Key pickup photo",
  DASHBOARD_PHOTO: "Dashboard photo",
};

// ---------- Visual decision models ----------

type VisualRunner = {
  model: CheckerModel;
  label: string;
  run: (qs: VisualQuestion[], p: Photo) => Promise<{ answers: Record<string, Omit<Answer, "ms" | "costUsd">>; ms: number; costUsd?: number }>;
};

// The Jev image request: the photo goes in "assets", the state cites it by key,
// and the questions point to it with `photo`. TypeSafe needs the danger-zone header.
export function jevImageRequest(model: string, qs: VisualQuestion[], p: Photo, b64: string) {
  const ref = `img-${p.id}`;
  return {
    model,
    state: { photo: ref, photo_kind: PHOTO_KIND_LABEL[p.kind] ?? p.kind, captured_at: p.capturedAt ?? null },
    assets: { [ref]: { type: "image", format: p.format, data_base64: b64 } },
    questions: Object.fromEntries(qs.map((q) => [q.id, jevQuestionOf(q)])),
  };
}

// Jev 1.14 on OpenRouter or TypeSafe, and SelfJev-4B Vision or Liquid d1 behind the same request shape.
function jevStyle(model: CheckerModel, label: string, url: string, key: string | undefined, modelName: string): VisualRunner {
  return {
    model,
    label,
    run: async (qs, p) => {
      const t0 = performance.now();
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "TypeSafe-Danger-Zone-Images": "true",
          ...(key ? { authorization: `Bearer ${key}` } : {}),
        },
        body: JSON.stringify(jevImageRequest(modelName, qs, p, photoBytes(p).toString("base64"))),
      });
      if (!res.ok) throw new Error(`${label} returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as { answers: Record<string, Parameters<typeof readJevAnswer>[1]>; usage?: { cost?: number } };
      const answers = Object.fromEntries(
        qs.filter((q) => body.answers?.[q.id]).map((q) => [q.id, readJevAnswer(q, body.answers[q.id])]),
      );
      return { answers, ms: performance.now() - t0, costUsd: body.usage?.cost };
    },
  };
}

// Jev through OpenRouter's Decisions API: the context as text, then the image, in one state list.
function openRouterJevVision(modelName: string, key: string): VisualRunner {
  return {
    model: "jev_vision",
    label: `Jev with images (${modelName}, OpenRouter)`,
    run: async (qs, p) => {
      const t0 = performance.now();
      const context = JSON.stringify({ photo: "the image below", photo_kind: PHOTO_KIND_LABEL[p.kind] ?? p.kind, captured_at: p.capturedAt ?? null });
      const res = await fetch("https://openrouter.ai/api/alpha/decisions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: modelName,
          state: [context, { type: "image_url", image_url: { url: `data:image/${p.format === "png" ? "png" : "jpeg"};base64,${photoBytes(p).toString("base64")}` } }],
          questions: Object.fromEntries(qs.map((q) => [q.id, jevQuestionOf(q)])),
        }),
      });
      if (!res.ok) throw new Error(`Jev returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as { answers: Record<string, Parameters<typeof readJevAnswer>[1]>; usage?: { cost?: number } };
      const answers = Object.fromEntries(qs.filter((q) => body.answers?.[q.id]).map((q) => [q.id, readJevAnswer(q, body.answers[q.id])]));
      return { answers, ms: performance.now() - t0, costUsd: body.usage?.cost };
    },
  };
}

const visionJudge: VisualRunner = {
  model: "llm_judge_vision",
  label: `Large LLM judge with vision (${MODELS.judge})`,
  run: async (qs, p) => {
    const t0 = performance.now();
    const res = await create({
      model: MODELS.judge,
      max_tokens: 2000,
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: Object.fromEntries(
              qs.map((q) => [q.id, {
                type: "object",
                properties: { answer: { type: "string", enum: q.options ?? ["yes", "no"] }, confidence: { type: "number" } },
                required: ["answer", "confidence"],
                additionalProperties: false,
              }]),
            ),
            required: qs.map((q) => q.id),
            additionalProperties: false,
          },
        },
      },
      system:
        "You check a photo for a car delivery operations team. Answer each typed question about the photo only from what you can see. " +
        "If the photo does not show it, say so through the answer and a low confidence. Give confidence from 0 to 1 that each answer is correct.",
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: p.format === "png" ? "image/png" : "image/jpeg", data: photoBytes(p).toString("base64") } },
          { type: "text", text: `This is \`photo\`: ${PHOTO_KIND_LABEL[p.kind] ?? p.kind}.\n\n${qs.map((q) => `${q.id}: ${q.question} Options: ${(q.options ?? []).map((o) => `${o} (${q.criteria?.[o] ?? o})`).join("; ")}`).join("\n")}` },
        ],
      }],
    });
    const out = parseJson<Record<string, { answer: string; confidence: number }>>(textOf(res));
    if (!out) throw new Error("Judge returned no JSON");
    const answers = Object.fromEntries(
      qs.filter((q) => out[q.id]).map((q) => [q.id, { answer: out[q.id].answer, confidence: Math.max(0, Math.min(1, out[q.id].confidence)) }]),
    );
    return { answers, ms: performance.now() - t0, costUsd: costUsd(MODELS.judge, res.usage) };
  },
};

export function visualCheckers(): { configured: VisualRunner[]; missing: { model: CheckerModel; label: string; why: string }[] } {
  const configured: VisualRunner[] = [];
  const missing: { model: CheckerModel; label: string; why: string }[] = [];
  const jevModel = process.env.JEV_VISION_MODEL;
  // OpenRouter drops an "assets" field, but it passes an image given inside the
  // state list as { type: "image_url" }. Control test, 25 Oct 2026, one receipt:
  // with the image P(match) was 0.99 / 0.01 / 0.01 for the true and two wrong
  // claims (about 4,250 more input tokens); without it, 0.47 / 0.49 / 0.48.
  if (process.env.TYPESAFE_API_KEY)
    configured.push(jevStyle("jev_vision", "Jev with images", "https://api.typesafe.ai/v1/systemone", process.env.TYPESAFE_API_KEY, jevModel || "jev-1.14"));
  else if (process.env.OPENROUTER_API_KEY)
    configured.push(openRouterJevVision(jevModel || process.env.JEV_MODEL || "typesafe/jev-1.14", process.env.OPENROUTER_API_KEY));
  else missing.push({ model: "jev_vision", label: "Jev with images", why: "Set OPENROUTER_API_KEY or TYPESAFE_API_KEY" });
  const add = (model: CheckerModel, label: string, env: string) =>
    process.env[`${env}_URL`]
      ? configured.push(jevStyle(model, label, process.env[`${env}_URL`]!, process.env[`${env}_API_KEY`], process.env[`${env}_MODEL`] || model))
      : missing.push({ model, label, why: `Set ${env}_URL` });
  add("selfjev", "SelfJev-4B Vision", "SELFJEV");
  add("d1", "Liquid d1-3B", "D1");
  if (hasClaude()) configured.push(visionJudge);
  else missing.push({ model: "llm_judge_vision", label: "Large LLM judge with vision", why: "Set ANTHROPIC_API_KEY" });
  return { configured, missing };
}

// ---------- Running the checks ----------

export function toPhotoCheck(q: TypedQuestion, model: CheckerModel, p: Photo, a: { answer: string; confidence: number }, ms: number, cost: number | undefined, at: string): PhotoCheck {
  const trap = q.trapAnswers.includes(a.answer);
  const sure = a.confidence >= WARN_CONFIDENCE;
  return {
    photoId: p.id, questionId: q.id, model, answer: a.answer, confidence: a.confidence, ms, costUsd: cost, checkedAt: at,
    flagged: trap && sure,
    unsure: !sure,
    message: !sure
      ? `Not sure (${Math.round(a.confidence * 100)}%) about: ${q.question.replace("`photo`", "this photo")} Look at the photo yourself.`
      : trap ? q.warning : `${q.question.replace("`photo`", "the photo")} ${a.answer}`,
  };
}

// Checks one photo with every configured visual model. Reuses stored answers unless fresh is true.
export async function checkPhoto(p: Photo, opts: { fresh?: boolean } = {}): Promise<PhotoCheck[]> {
  const qs = questionsFor(p);
  if (!qs.length) return [];
  const stored = readState().photoChecks?.[p.id] ?? [];
  const out: PhotoCheck[] = [];
  const { configured } = visualCheckers();
  await Promise.all(configured.map(async (m) => {
    const have = stored.filter((c) => c.model === m.model && c.answer !== "error");
    if (!opts.fresh && qs.every((q) => have.some((c) => c.questionId === q.id))) {
      out.push(...have.filter((c) => qs.some((q) => q.id === c.questionId)));
      return;
    }
    const at = nowIso();
    try {
      const r = await m.run(qs, p);
      // One request answers every question, so its time and cost are split across them.
      const n = Object.keys(r.answers).length || 1;
      for (const q of qs) {
        const a = r.answers[q.id];
        out.push(a
          ? toPhotoCheck(q, m.model, p, a, r.ms / n, r.costUsd === undefined ? undefined : r.costUsd / n, at)
          : { photoId: p.id, questionId: q.id, model: m.model, answer: "error", confidence: 0, ms: 0, flagged: false, unsure: true, checkedAt: at, message: `${m.label} gave no answer.` });
      }
    } catch (e) {
      for (const q of qs)
        out.push({ photoId: p.id, questionId: q.id, model: m.model, answer: "error", confidence: 0, ms: 0, flagged: false, unsure: true, checkedAt: at, message: `${m.label} failed: ${(e as Error).message}` });
    }
  }));
  update((s) => {
    s.photoChecks ??= {};
    const models = new Set(out.map((c) => c.model));
    s.photoChecks[p.id] = [...(s.photoChecks[p.id] ?? []).filter((c) => !models.has(c.model)), ...out];
  });
  return out;
}

export async function checkOrderPhotos(ref: string, opts: { fresh?: boolean } = {}) {
  const out: PhotoCheck[] = [];
  for (const p of photosForOrder(ref)) out.push(...(await checkPhoto(p, opts)));
  return out;
}

// Card checks for the photos behind the cited facts. A warning sits next to the fact it questions.
export async function photoCardChecks(facts: Fact[]): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  for (const f of facts) {
    if (!f.recordId) continue;
    for (const p of photosForRecord(f.recordId)) {
      for (const c of await checkPhoto(p)) {
        out.push({
          questionId: c.questionId, questionVersion: 1, model: c.model, answer: c.answer, confidence: c.confidence, ms: c.ms, costUsd: c.costUsd,
          // A low-confidence answer shows as a note next to the fact that asks a person to look.
          flagged: c.flagged,
          message: c.message, factLabel: f.label, photoId: p.id,
        });
      }
    }
  }
  return out;
}

// What the agent sees from its check_photos tool.
export async function photosForAgent(ref: string) {
  const photos = photosForOrder(ref);
  if (!photos.length) return { photos: [], note: "No photos or scans for this order in the packet." };
  const { configured, missing } = visualCheckers();
  const checks = await checkOrderPhotos(ref);
  return {
    checkers: configured.map((c) => c.label),
    not_connected: missing.map((m) => m.label),
    photos: photos.map((p) => ({
      photo_id: p.id,
      kind: PHOTO_KIND_LABEL[p.kind] ?? p.kind,
      record_id: p.recordId,
      status: p.status,
      captured_at: p.capturedAt,
      answers: checks.filter((c) => c.photoId === p.id).map((c) => ({ question: c.questionId, model: c.model, answer: c.answer, confidence: Math.round(c.confidence * 100) / 100 })),
    })),
    note: "A photo answer is evidence of what the photo shows, not proof of who took it, when the damage happened, or a signature.",
  };
}
