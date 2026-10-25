"use client"

import { useEffect, useState } from "react"
import { FileTextIcon } from "@/components/icons"
import { label } from "@/lib/present/labels"

type CaseFile = {
  id: string; kind: string; status: string; content_type: string; file_name: string; url: string
  related_record_type: string; evidence_note?: string
}

/** Sample files from the local object store, as a grid. Signed links expire after 15 minutes. */
export function OrderFiles({ orderId }: { orderId: string }) {
  const [files, setFiles] = useState<CaseFile[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/orders/${orderId}/attachments`, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("Could not load files"); return response.json() as Promise<{ attachments: CaseFile[] }> })
      .then((data) => { setFiles(data.attachments); setFailed(false) })
      .catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => controller.abort()
  }, [orderId])
  if (failed) return <p className="text-[13px] text-muted-foreground">Sample files are unavailable. Check that the local object store is running and seeded.</p>
  if (!files?.length) return null
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">{files.map((file) => <a
    key={file.id} href={file.url} target="_blank" rel="noopener noreferrer" title={file.evidence_note ?? undefined}
    className="group/file flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card text-[13px] transition-colors outline-none hover:border-foreground/25 focus-visible:ring-3 focus-visible:ring-ring/50"
  >
    <span className="grid aspect-[4/3] place-items-center overflow-hidden border-b bg-muted text-muted-foreground">{file.content_type === "image/jpeg"
      // eslint-disable-next-line @next/next/no-img-element -- signed local object-store URL
      ? <img className="size-full object-cover" src={file.url} alt={file.evidence_note ?? `${label(file.kind)} case photo`} />
      : <FileTextIcon className="size-6" aria-hidden="true" />}</span>
    <span className="flex min-w-0 flex-col gap-0.5 px-2 py-1.5">
      <b className="truncate font-medium">{label(file.kind)}</b>
      <small className="truncate text-xs text-muted-foreground">{file.content_type === "application/pdf" ? "PDF" : "Photo"} · {label(file.status).toLowerCase()}</small>
    </span>
  </a>)}</div>
}
