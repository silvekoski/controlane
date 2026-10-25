"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { carImage } from "@/lib/car-images";

type CaseRow = {
  id: string; title: string; state: { label: string; value: string; source: string; observedAt?: string }[];
  action: string; questionId: string; acceptedAnswers: string[]; split: string; template?: string; at: string; note?: string;
};
type Result = { total: number; page: number; pageSize: number; questions: string[]; splits: string[]; splitCounts: Record<string, number>; cases: CaseRow[] };

const splitLabel = (split: string) => split.replaceAll("_", " ");

export function SyntheticBrowser() {
  const [query, setQuery] = useState("");
  const [question, setQuestion] = useState("all");
  const [split, setSplit] = useState("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const queryString = useMemo(() => new URLSearchParams({ q: query, question, split, page: String(page), pageSize: "100" }).toString(), [query, question, split, page]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/synthetic?${queryString}`, { signal: controller.signal })
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok) throw new Error(body.error ?? "Could not load cases.");
          const next = body as Result;
          setResult((previous) => next.page === 1 ? next : { ...next, cases: [...(previous?.cases ?? []), ...next.cases] });
          setError("");
        })
        .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load cases."); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [queryString]);

  const pages = Math.max(1, Math.ceil((result?.total ?? 0) / 100));
  const allCount = result ? Object.values(result.splitCounts).reduce((sum, count) => sum + count, 0) : 0;
  const setFilter = (kind: "question" | "split", value: string) => {
    if (kind === "question") setQuestion(value); else setSplit(value);
    setPage(1); setOpen(null);
  };

  return <section className="flex flex-col gap-3">
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Synthetic dataset summary">
      <div className="flex items-baseline justify-between rounded-lg border bg-card px-3.5 py-3"><span className="text-xs text-muted-foreground">Cases</span><strong className="font-mono text-lg tabular-nums">{allCount ? allCount.toLocaleString() : "—"}</strong></div>
      {result?.splits.map((item) => <div key={item} className="flex items-center gap-3 rounded-lg border bg-card px-3.5 py-3">
        <span className={`size-2.5 shrink-0 rounded-full ${item.includes("ood") ? "bg-warning" : item === "test" ? "bg-primary" : "bg-muted-foreground/40"}`} aria-hidden="true" />
        <span className="min-w-0 flex-1 text-xs capitalize text-muted-foreground">{splitLabel(item)}</span>
        <span className="font-mono text-sm tabular-nums">{result.splitCounts[item].toLocaleString()}</span>
        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary/70" style={{ width: `${allCount ? (result.splitCounts[item] / allCount) * 100 : 0}%` }} /></span>
      </div>)}
    </div>
    <div className="grid gap-2 rounded-xl border bg-card p-3 md:grid-cols-[minmax(16rem,1fr)_minmax(11rem,0.7fr)_minmax(10rem,0.5fr)]">
      <Input aria-label="Search synthetic cases" placeholder="Search actions, facts, IDs or templates" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); setOpen(null); }} />
      <Select value={question} onValueChange={(value) => setFilter("question", value ?? "all")}>
        <SelectTrigger aria-label="Filter by question" className="w-full"><SelectValue placeholder="All questions" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All questions</SelectItem>{(result?.questions ?? []).map((item) => <SelectItem key={item} value={item}>{item.replaceAll("_", " ")}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={split} onValueChange={(value) => setFilter("split", value ?? "all")}>
        <SelectTrigger aria-label="Filter by split" className="w-full"><SelectValue placeholder="All splits" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All splits</SelectItem>{(result?.splits ?? []).map((item) => <SelectItem key={item} value={item}>{splitLabel(item)}</SelectItem>)}</SelectContent>
      </Select>
    </div>

    <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground" aria-live="polite">
      <span>{loading ? `Loading cases… ${result?.cases.length ?? 0} shown` : error ? error : `${(result?.cases.length ?? 0).toLocaleString()} of ${(result?.total ?? 0).toLocaleString()} cases`}</span>
    </div>

    <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
      {!loading && !error && result?.cases.length === 0 && <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground sm:col-span-2 xl:col-span-4 2xl:col-span-5">No cases match these filters.</p>}
      {result?.cases.map((item) => {
        const expanded = open === item.id;
        const vehicle = item.state.find((fact) => fact.label.toLowerCase() === "car")?.value;
        const image = vehicle ? carImage(vehicle) : null;
        return <article key={item.id} className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : item.id)} className="block w-full text-left hover:bg-muted/20">
            <span className="relative flex h-32 items-center justify-center overflow-hidden bg-muted/50">
              {image ? <><Image src={image} alt={`${vehicle} model illustration`} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-contain p-3" /><span className="absolute right-2 bottom-2 rounded bg-background/90 px-1.5 py-0.5 text-[10px] text-muted-foreground">Model illustration</span></> : <span className="font-mono text-xs tracking-widest text-muted-foreground/60">SYNTHETIC CASE</span>}
            </span>
            <span className="flex flex-col gap-2 p-3.5">
              <span className="flex items-start justify-between gap-2"><span className="line-clamp-2 text-sm leading-snug font-semibold">{item.title}</span><span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{item.id}</span></span>
              <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.action}</span>
              <span className="mt-1 flex flex-wrap gap-1.5"><span className="rounded-md bg-muted px-2 py-1 text-[10px] capitalize">{item.questionId.replaceAll("_", " ")}</span><span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] text-primary">Label: {item.acceptedAnswers.join(" / ")}</span><span className="rounded-md border px-2 py-1 text-[10px] capitalize">{splitLabel(item.split)}</span></span>
            </span>
          </button>
          {expanded && <div className="flex flex-col gap-3 border-t bg-muted/20 p-3.5">
            <div><h2 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Question</h2><p className="text-xs">{item.questionId.replaceAll("_", " ")}</p></div>
            {vehicle && <p className="text-[10px] text-muted-foreground">Vehicle context: {vehicle}. Illustration is shared by model and is not evidence about this specific car.</p>}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]"><dt className="text-muted-foreground">Template</dt><dd className="break-all font-mono">{item.template ?? "—"}</dd><dt className="text-muted-foreground">Facts</dt><dd>{item.state.length} source facts</dd>{item.note && <><dt className="text-muted-foreground">Note</dt><dd>{item.note}</dd></>}</dl>
            <div><h2 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Case facts</h2><ul className="flex max-h-56 flex-col divide-y overflow-y-auto rounded-md border bg-card px-2.5">{item.state.map((fact, index) => <li key={`${fact.label}-${index}`} className="grid grid-cols-[minmax(5rem,0.4fr)_minmax(0,1fr)] gap-2 py-2 text-[11px]"><span className="text-muted-foreground">{fact.label}<span className="block">{fact.source}</span></span><span className="whitespace-pre-wrap">{fact.value}</span></li>)}</ul></div>
          </div>}
        </article>;
      })}
    </div>
    {!error && (result?.cases.length ?? 0) < (result?.total ?? 0) && <button type="button" className="mx-auto rounded-lg border bg-card px-5 py-2.5 text-sm font-medium shadow-xs hover:bg-muted disabled:opacity-50" onClick={() => { setPage((p) => p + 1); setOpen(null); }} disabled={loading}>{loading ? "Loading…" : `Load ${Math.min(100, (result?.total ?? 0) - (result?.cases.length ?? 0))} more cases`}</button>}
  </section>;
}
