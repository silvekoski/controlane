"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { setClockAction } from "../actions";

// The clock in the top bar. The server sends the mode and the offset from the real time.
// The clock moves with real time. It refreshes the page when the next event is due.
const SNAPSHOT_PRESET = "2026-10-21T08:55:00Z";

const fmt = (t: number) => {
  const d = new Date(t);
  return `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;
};

export function Clock({ mode, offsetMs, nextEventAt }: { mode: "live" | "travel"; offsetMs: number; nextEventAt: string | null }) {
  const [t, setT] = useState<number | null>(null);
  const [at, setAt] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  useEffect(() => {
    const tick = () => setT(Date.now() + offsetMs);
    tick();
    const i = setInterval(tick, 10_000);
    return () => clearInterval(i);
  }, [offsetMs]);
  useEffect(() => {
    if (!nextEventAt) return;
    const wait = Date.parse(nextEventAt) - (Date.now() + offsetMs) + 1000;
    if (wait > 2 ** 31 - 1) return;
    const i = setTimeout(() => router.refresh(), Math.max(1000, wait));
    return () => clearTimeout(i);
  }, [nextEventAt, offsetMs, router]);
  const go = (next: { mode: "live" } | { mode: "travel"; at: string }) => start(() => setClockAction(next));
  return (
    <span className="clock-bar">
      {mode === "travel" && t !== null ? (
        <span className="clock-travel" title="The clock shows an earlier time. It moves with real time.">Viewing {fmt(t)} (time travel)</span>
      ) : (
        <span className="clock" title="Real time">{t === null ? "" : fmt(t)}</span>
      )}
      {mode === "travel" && (
        <button className="btn btn-sm" disabled={pending} onClick={() => go({ mode: "live" })}>Back to now</button>
      )}
      <details>
        <summary>Go to a time</summary>
        <div className="clock-pop">
          <label className="small">
            Date and time (UTC)
            <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
          </label>
          <button className="btn btn-sm" disabled={pending || !at} onClick={() => go({ mode: "travel", at: `${at}:00Z` })}>Go to this time</button>
          <button className="btn btn-sm" disabled={pending} onClick={() => go({ mode: "travel", at: SNAPSHOT_PRESET })}>Packet snapshot, 21 Oct 08:55 UTC</button>
        </div>
      </details>
    </span>
  );
}
