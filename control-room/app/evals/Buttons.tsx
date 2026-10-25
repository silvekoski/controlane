"use client";

import { useState, useTransition } from "react";
import { benchmark, discover, makeLive, retire } from "../actions";

export function EvalButtons({ canDiscover }: { canDiscover: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="row">
      {err && <span className="small" style={{ color: "var(--critical)" }}>{err}</span>}
      <button className="btn btn-sm" disabled={pending || !canDiscover} title={canDiscover ? "" : "Needs ANTHROPIC_API_KEY or OPENROUTER_API_KEY"} onClick={() => start(async () => setErr((await discover()).error))}>
        Run discovery agent
      </button>
      <button className="btn btn-sm btn-primary" disabled={pending} onClick={() => start(() => benchmark())}>
        {pending ? "Running…" : "Run benchmark"}
      </button>
    </div>
  );
}

export function QuestionButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <span className="row">
      <button className="btn btn-sm btn-primary" disabled={pending} onClick={() => start(() => makeLive(id))}>Make live</button>
      <button className="btn btn-sm btn-ghost" disabled={pending} onClick={() => start(() => retire(id))}>Drop</button>
    </span>
  );
}
