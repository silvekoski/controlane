"use client";

import { useState, useTransition } from "react";
import { label } from "../actions";

const NICE: Record<string, string> = { yes: "Yes", no: "No", right: "Right", too_low: "Too low", too_high: "Too high", wrong_facts: "Wrong facts", too_early: "Too early", wrong_action: "Wrong action" };

export function LabelForm({ id, question, options, suggested }: { id: string; question: string; options: string[]; suggested?: string }) {
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="stack">
      <p className="h2">{question}</p>
      {suggested && <p className="muted small">Suggested: {NICE[suggested] ?? suggested}. Tap the answer you believe.</p>}
      <div className="row" style={{ flexWrap: "wrap" }}>
        {options.map((o) => (
          <button key={o} className="btn" disabled={pending} onClick={() => start(() => label(id, o, note))}>{NICE[o] ?? o.replaceAll("_", " ")}</button>
        ))}
      </div>
      <label className="field">
        <span className="field-label">How did you know? (optional)</span>
        <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
    </div>
  );
}
