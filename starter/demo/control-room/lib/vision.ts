import fs from "node:fs";
import path from "node:path";
import { ATTACHMENTS_DIR, data } from "./data";
import type { TypedQuestion } from "./types";

// Visual checks: typed questions about photos and scans. Jev reads PNG or JPEG
// as base64, 256 to 1,568 px a side. The packet's PDFs are pre-rendered to PNG
// in eval/images/ (see README), because Jev does not read PDFs.

const RENDER_DIR = path.resolve(process.cwd(), "eval/images");

export type Attachment = {
  id: string;
  orderId: string;
  kind: string; // PICKUP_PHOTOS, DELIVERY_PHOTOS, MESSAGE_PHOTO, CMR, RELEASE_AUTHORITY, EXPENSE_RECEIPT, ...
  file: string; // packet path, for example photos/file-x.jpg
  status: string;
  recordType: string;
  recordId: string;
  capturedAt?: string;
  note?: string;
};

let manifest: Attachment[] | null = null;
export function attachments(): Attachment[] {
  if (manifest) return manifest;
  const raw = JSON.parse(fs.readFileSync(path.join(ATTACHMENTS_DIR, "manifest.json"), "utf8")) as Record<string, string>[];
  manifest = raw.map((x) => ({
    id: x.id,
    orderId: x.order_id,
    kind: x.kind,
    file: x.file_name,
    status: x.status,
    recordType: x.related_record_type,
    recordId: x.related_record_id,
    capturedAt: x.captured_at,
    note: x.evidence_note,
  }));
  return manifest;
}

export function attachmentsFor(orderRef: string) {
  const o = data().order(orderRef);
  return o ? attachments().filter((a) => a.orderId === o.id) : [];
}

export function isPhoto(file: string) {
  return file.endsWith(".jpg") || file.endsWith(".jpeg") || file.endsWith(".png");
}

// The image file Jev and the UI use: the photo itself, or the PNG render of a PDF.
export function imagePath(file: string): string {
  if (isPhoto(file)) return path.join(ATTACHMENTS_DIR, file);
  return path.join(RENDER_DIR, `${path.basename(file, path.extname(file))}.png`);
}

export function imageUrl(file: string) {
  return `/api/files/${file}`;
}

export function imageDataUrl(file: string): string {
  const p = imagePath(file);
  if (!fs.existsSync(p)) throw new Error(`No image for ${file}. Run the PDF render step in the README.`);
  const type = p.endsWith(".png") ? "image/png" : "image/jpeg";
  return `data:${type};base64,${fs.readFileSync(p).toString("base64")}`;
}

const yesNo = (id: string, question: string, yes: string, no: string, trapAnswers: string[], warning: string): TypedQuestion => ({
  id, question, type: "yes_no", options: ["yes", "no"], criteria: { yes, no }, trapAnswers, warning,
  source: "PRD: visual checks", approvedBy: "Ops lead", version: 1, status: "live", modelChecked: true,
});

export const VISUAL_QUESTIONS: TypedQuestion[] = [
  yesNo("photo_vehicle_main", "Is a vehicle the main subject of this photo?", "A car is the main subject, or a clearly visible part of it is.", "The photo shows an empty bay, a building, a forecourt or other things; any cars are only in the background.", ["no"], "The photo does not show the car."),
  yesNo("photo_matches_car", "Is the car in this photo the same make and model as the order car named in the state?", "The make and model in the photo match the order car.", "The photo shows a different make or model, or no car.", ["no"], "The photo shows a different car than the order."),
  yesNo("photo_damage_visible", "Is damage visible on the car, such as a scratch, scrape, dent or crack?", "There is visible damage on the car body, glass or wheels.", "No damage is visible.", ["yes"], "Damage is visible in this photo."),
  yesNo("photo_keys_visible", "Are car keys visible in this photo?", "One or more car keys or key fobs are visible.", "No keys are visible.", [], "Keys are visible."),
  {
    id: "doc_type", question: "What kind of document is this?", type: "choice", options: ["cmr", "collection_authority", "receipt", "other"],
    criteria: { cmr: "A road consignment note (CMR) for a vehicle.", collection_authority: "A permission to collect or release a named vehicle.", receipt: "A payment receipt.", other: "Anything else." },
    trapAnswers: [], warning: "", source: "PRD: visual checks", approvedBy: "Ops lead", version: 1, status: "live", modelChecked: true,
  },
  yesNo("doc_vin_matches", "Does the vehicle reference (VIN) in the document match the order VIN given in the state?", "The reference in the document is the same as the order VIN.", "The reference is different, or missing.", ["no"], "The VIN in the document does not match the order."),
  yesNo("doc_receiver_signed", "Does the document show a receiver signature or delivery acknowledgement?", "The receiver signed or acknowledged the delivery.", "There is no receiver signature or acknowledgement; only collection is signed, or it is pending.", ["no"], "No receiver signature on this document."),
  {
    id: "receipt_kind", question: "What kind of cost is on this receipt?", type: "choice",
    options: ["fuel", "charging", "parking", "toll", "flight", "train", "hotel", "other"],
    criteria: { fuel: "Fuel for a car.", charging: "Electric car charging.", parking: "Parking.", toll: "A road, bridge or tunnel toll.", flight: "A flight.", train: "A train ticket.", hotel: "A hotel or lodging.", other: "Something else." },
    trapAnswers: [], warning: "", source: "PRD: visual checks", approvedBy: "Ops lead", version: 1, status: "live", modelChecked: true,
  },
  yesNo("receipt_total_matches", "Does the total on the receipt match the claimed amount given in the state?", "The receipt total equals the claimed amount and currency.", "The total or the currency is different.", ["no"], "The receipt total does not match the claim."),
];

export function visualQuestion(id: string) {
  return VISUAL_QUESTIONS.find((q) => q.id === id);
}

export function jevConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export type VisionAnswer = { questionId: string; answer: string; confidence: number; probabilities?: Record<string, number> };

// One Jev request: the context text, the image, and several typed questions.
export async function askJevAboutImage(file: string, context: Record<string, unknown>, questionIds: string[]) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("Jev is not connected. Set OPENROUTER_API_KEY.");
  const { jevQuestionOf, readJevAnswer } = await import("./checks");
  const qs = questionIds.map((id) => visualQuestion(id)).filter((q): q is TypedQuestion => Boolean(q));
  const t0 = performance.now();
  const res = await fetch("https://openrouter.ai/api/alpha/decisions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.JEV_MODEL || "typesafe/jev-1.14",
      state: [JSON.stringify(context), { type: "image_url", image_url: { url: imageDataUrl(file) } }],
      questions: Object.fromEntries(qs.map((q) => [q.id, jevQuestionOf(q)])),
    }),
  });
  if (!res.ok) throw new Error(`Jev returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { answers: Record<string, never>; usage?: { cost?: number } };
  const answers: VisionAnswer[] = qs.map((q) => {
    const a = body.answers[q.id];
    return a ? { questionId: q.id, ...readJevAnswer(q, a) } : { questionId: q.id, answer: "error", confidence: 0 };
  });
  return { answers, ms: performance.now() - t0, costUsd: body.usage?.cost };
}
