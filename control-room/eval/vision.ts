import { data } from "../lib/data";
import { attachments } from "../lib/vision";
import type { EvalCase, Fact } from "../lib/types";

// Image eval set: typed questions about the packet's 58 photos and scans.
//
// Label sources:
// - Documents and receipts: the dataset records (document kind, order VIN,
//   expense kind and amount). "Mismatch" variants swap in another order's VIN or
//   a changed claim amount, so their label is known by construction.
// - Photos: labelled by looking at each photo (review them in
//   PHOTO_LABELS below). A label is left out where the photo is ambiguous.

const AT = "2026-10-21T09:00:00Z";

type PhotoLabels = { vehicle?: "yes" | "no"; damage?: "yes" | "no"; keys?: "yes" | "no"; matches?: "yes" | "no" };

// Hand labels for the 16 packet photos (file hash prefix -> labels).
const PHOTO_LABELS: Record<string, PhotoLabels> = {
  "f92dbd57": { vehicle: "yes", damage: "no", keys: "no", matches: "yes" }, // Ferrari Roma, front three-quarter
  "d380167c": { keys: "yes", matches: "yes" }, // keys on a counter, the Roma behind
  "45e0a8f3": { vehicle: "yes", damage: "no", keys: "no", matches: "yes" }, // Bentley Continental GT, rear left
  "565e6ac8": { vehicle: "yes", keys: "no", matches: "yes" }, // Bentley indoors, rear; the mark is not clear at this distance
  "c31d2a11": { vehicle: "yes", damage: "yes", keys: "no", matches: "yes" }, // close-up: scrape behind the rear wheel
  "137a4392": { vehicle: "no", keys: "no", matches: "no" }, // empty parking bay 5
  "ae5abcdb": { vehicle: "yes", damage: "no", keys: "no", matches: "yes" }, // Porsche 911, front
  "d9444e8c": { vehicle: "yes", damage: "no", keys: "no", matches: "yes" }, // Porsche 911, rear
  "c743e1a4": { vehicle: "yes", damage: "no", keys: "no", matches: "yes" }, // Ferrari Roma, rear
  "3e98721d": { vehicle: "yes", damage: "no", keys: "no", matches: "yes" }, // Volvo V60 trade-in, front
  "43037bee": { vehicle: "yes", damage: "no", keys: "no", matches: "yes" }, // Volvo V60 trade-in, rear
  "97d47502": { vehicle: "yes", damage: "no", keys: "no", matches: "yes" }, // Audi RS 6, front
  "3103ad50": { vehicle: "yes", damage: "no", keys: "no", matches: "yes" }, // Audi RS 6, rear
  "f09b1339": { keys: "yes", matches: "yes" }, // Ferrari key and 296 GTB door sill
  "06298106": { vehicle: "yes", damage: "no", keys: "no", matches: "no" }, // Mercedes EQE; the order car is an Audi Q8 e-tron
  "69028dd0": { vehicle: "no", keys: "no", matches: "no" }, // empty forecourt
};

const KIND_TO_RECEIPT: Record<string, string> = {
  FUEL: "fuel", CHARGING: "charging", PARKING: "parking", TOLL: "toll", FLIGHT_POSITIONING: "flight", TRAIN_POSITIONING: "train", HOTEL: "hotel",
};

const OTHER_CARS = ["Volvo V60", "Porsche Taycan", "BMW M4", "Mercedes-Benz S-Class", "Toyota Corolla", "Skoda Enyaq", "Audi Q8 e-tron", "Ferrari Roma"];

export function buildVisionCases(): EvalCase[] {
  const d = data();
  const out: EvalCase[] = [];
  const f = (label: string, value: string): Fact => ({ label, value, source: "order", observedAt: AT });
  const add = (id: string, title: string, image: string, questionId: string, answer: string, state: Fact[], labeledBy: EvalCase["labeledBy"], note?: string) =>
    out.push({ id: `vis-${id}-${questionId}`, title, image, questionId, acceptedAnswers: [answer], state, action: "", labeledBy, split: "test", at: AT, note });

  const allVins = d.t.vehicles.map((v) => v.synthetic_vin).filter(Boolean) as string[];

  attachments().forEach((a, n) => {
    const items = d.t.order_items.filter((i) => i.order_id === a.orderId);
    const item = items.find((i) => i.role === (a.kind.startsWith("TRADE_IN") ? "TRADE_IN" : "PRIMARY")) ?? items[0];
    const veh = d.get(item?.vehicle_id);
    const car = veh ? `${veh.make} ${veh.model}` : "unknown";
    const ref = d.get(a.orderId)?.reference ?? a.orderId;
    const hash = a.file.split("file-")[1]?.slice(0, 8) ?? String(n);

    if (a.file.endsWith(".jpg")) {
      const l = PHOTO_LABELS[hash];
      if (!l) return;
      const ctx = [f("Order car", car), f("Photo kind", a.kind.replaceAll("_", " ").toLowerCase())];
      const note = "Labelled by viewing the photo; review PHOTO_LABELS in eval/vision.ts.";
      if (l.vehicle) add(hash, `${ref} ${a.kind}: car is the subject?`, a.file, "photo_vehicle_main", l.vehicle, ctx, "hand", note);
      if (l.damage) add(hash, `${ref} ${a.kind}: damage visible?`, a.file, "photo_damage_visible", l.damage, ctx, "hand", note);
      if (l.keys) add(hash, `${ref} ${a.kind}: keys visible?`, a.file, "photo_keys_visible", l.keys, ctx, "hand", note);
      if (l.matches) add(hash, `${ref} ${a.kind}: order car (${car})?`, a.file, "photo_matches_car", l.matches, ctx, "hand", note);
      // Mismatch variant: the same photo against another car. The answer is "no" by construction.
      if (l.matches === "yes") {
        const other = OTHER_CARS.find((c) => c !== car && !car.includes(c.split(" ")[0])) ?? "Toyota Corolla";
        add(`${hash}-other`, `${ref} ${a.kind}: against ${other}`, a.file, "photo_matches_car", "no", [f("Order car", other), ctx[1]], "synthetic");
      }
      return;
    }

    // Documents and receipts (rendered PDFs).
    if (a.kind === "CMR" || a.kind === "RELEASE_AUTHORITY") {
      const vin = veh?.synthetic_vin ?? "";
      const otherVin = allVins[(allVins.indexOf(vin) + 7) % allVins.length];
      add(hash, `${ref} ${a.kind}: type`, a.file, "doc_type", a.kind === "CMR" ? "cmr" : "collection_authority", [f("Order", ref)], "synthetic", "Label from the document record.");
      add(hash, `${ref} ${a.kind}: VIN matches`, a.file, "doc_vin_matches", "yes", [f("Order VIN", vin)], "synthetic", "Label from the order's vehicle record.");
      add(`${hash}-other`, `${ref} ${a.kind}: another order's VIN`, a.file, "doc_vin_matches", "no", [f("Order VIN", otherVin)], "synthetic", "Another order's VIN: no by construction.");
      if (a.kind === "CMR") {
        const doc = d.get(a.recordId);
        add(hash, `${ref} CMR: receiver signed?`, a.file, "doc_receiver_signed", doc?.signature_scope === "BOTH" ? "yes" : "no", [f("Order", ref)], "synthetic", `signature_scope ${doc?.signature_scope}`);
      }
      return;
    }

    if (a.kind === "EXPENSE_RECEIPT") {
      const e = d.get(a.recordId);
      if (!e) return;
      const amount = (e.amount_cents / 100).toFixed(2);
      add(hash, `${ref} receipt: type`, a.file, "doc_type", "receipt", [f("Order", ref)], "synthetic", "Label from the attachment kind.");
      if (KIND_TO_RECEIPT[e.kind]) add(hash, `${ref} receipt: kind`, a.file, "receipt_kind", KIND_TO_RECEIPT[e.kind], [f("Claimed cost type", "unknown")], "synthetic", `Expense kind ${e.kind}.`);
      add(hash, `${ref} receipt: total matches`, a.file, "receipt_total_matches", "yes", [f("Claimed amount", `${e.currency} ${amount}`)], "synthetic", "Claim amount from the expense record.");
      const wrong = ((e.amount_cents * (n % 2 ? 1.2 : 0.85)) / 100).toFixed(2);
      add(`${hash}-other`, `${ref} receipt: changed claim`, a.file, "receipt_total_matches", "no", [f("Claimed amount", `${e.currency} ${wrong}`)], "synthetic", "Claim changed by 15 to 20%: no by construction.");
    }
  });
  return out;
}
