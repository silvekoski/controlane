"use client";

import { useState, useTransition } from "react";
import { approve, approveEdited, redoWithNote, reject } from "../../actions";
import type { RejectReason } from "@/lib/types";

type Props = {
  cardId: string;
  description: string;
  costDelta?: number;
  customerDraft?: string;
  blocked: boolean;
  canRedo: boolean;
  reasons: Record<RejectReason, string>;
};

export function Decide({ cardId, description, costDelta, customerDraft, blocked, canRedo, reasons }: Props) {
  const [mode, setMode] = useState<"idle" | "edit" | "reject" | "redo">("idle");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [desc, setDesc] = useState(description);
  const [cost, setCost] = useState(costDelta?.toString() ?? "");
  const [draft, setDraft] = useState(customerDraft ?? "");
  const [reason, setReason] = useState<RejectReason | null>(null);
  const [note, setNote] = useState("");

  const done = (r: { ok: boolean; message?: string } | void) => {
    if (r && !r.ok && r.message) setMsg(r.message);
  };

  if (mode === "edit")
    return (
      <div className="decide" style={{ display: "block" }}>
        <div className="stack">
          <label className="field">
            <span className="field-label">What should happen</span>
            <textarea className="textarea" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </label>
          <label className="field" style={{ maxWidth: 200 }}>
            <span className="field-label">Cost change (€)</span>
            <input className="input" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
          </label>
          {customerDraft !== undefined && (
            <label className="field">
              <span className="field-label">Message to the customer (you send it)</span>
              <textarea className="textarea" value={draft} onChange={(e) => setDraft(e.target.value)} />
            </label>
          )}
          <div className="row">
            <button className="btn btn-primary" disabled={pending || !desc.trim()} onClick={() => start(async () => done(await approveEdited(cardId, { description: desc, costDelta: cost ? Number(cost) : undefined, customerDraft: customerDraft !== undefined ? draft : undefined })))}>
              Approve with changes
            </button>
            <button className="btn btn-ghost" onClick={() => setMode("idle")}>Cancel</button>
          </div>
        </div>
      </div>
    );

  if (mode === "reject")
    return (
      <div className="decide" style={{ display: "block" }}>
        <div className="stack">
          <span className="field-label">Why not?</span>
          <div className="row" style={{ flexWrap: "wrap" }}>
            {(Object.keys(reasons) as RejectReason[]).map((r) => (
              <button key={r} className="btn btn-chip btn-sm" aria-pressed={reason === r} onClick={() => setReason(r)}>{reasons[r]}</button>
            ))}
          </div>
          <label className="field">
            <span className="field-label">How did you know? (optional, it teaches the checks)</span>
            <textarea className="textarea" placeholder="For example: the dealer always sends their own recovery for this make." value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="row">
            <button className="btn" disabled={pending || !reason} onClick={() => start(() => reject(cardId, reason!, note))}>Reject</button>
            <button className="btn btn-ghost" onClick={() => setMode("idle")}>Cancel</button>
          </div>
        </div>
      </div>
    );

  if (mode === "redo")
    return (
      <div className="decide" style={{ display: "block" }}>
        <div className="stack">
          <label className="field">
            <span className="field-label">Tell the agent what to change. It tries again with your note.</span>
            <textarea className="textarea" placeholder="For example: check the train option too before you suggest the ferry." value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="row">
            <button className="btn btn-primary" disabled={pending || !note.trim()} onClick={() => start(() => redoWithNote(cardId, note))}>Send to the agent</button>
            <button className="btn btn-ghost" onClick={() => setMode("idle")}>Cancel</button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="decide">
      {msg && <div className="warnbox" style={{ width: "100%", marginBottom: 8 }}><b>!</b> {msg}</div>}
      <button className="btn btn-primary" disabled={pending || blocked} onClick={() => start(async () => done(await approve(cardId)))}>
        {pending ? "Checking the facts again…" : "Approve"}
      </button>
      <button className="btn" disabled={pending} onClick={() => setMode("edit")}>Edit</button>
      <button className="btn" disabled={pending} onClick={() => setMode("reject")}>Reject</button>
      {canRedo && <button className="btn btn-ghost" disabled={pending} onClick={() => setMode("redo")}>Ask the agent to change it</button>}
      <span className="muted small" style={{ marginLeft: "auto" }}>The system reads the facts again before it acts.</span>
    </div>
  );
}
