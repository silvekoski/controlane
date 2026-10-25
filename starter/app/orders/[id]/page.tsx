"use client"

import Link from "next/link"
import { use, useEffect, useState } from "react"
import { CircleAlertIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { AppFrame } from "../../components/app-frame"
import { OrderPane, type Detail } from "../../components/order-detail"

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/orders/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error(response.status === 404 ? "Order not found" : "Could not load order"); return response.json() as Promise<Detail> })
      .then((data) => { setDetail(data); setError("") })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load order") })
    return () => controller.abort()
  }, [id])

  useEffect(() => {
    if (detail) document.title = `${detail.view.header.reference} · ${detail.view.header.vehicle?.title ?? "Order"} · Controlane`
  }, [detail])

  return <AppFrame section="board" board snapshotAt={detail?.view.snapshotAt ?? null} crumbs={[{ label: detail?.view.header.reference ?? "Record" }]}>
    {detail && <OrderPane detail={detail} />}
    {!detail && <main className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-6 overflow-y-auto px-6 py-8">
      {error && <Empty className="border" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon"><CircleAlertIcon aria-hidden="true" /></EmptyMedia>
          <EmptyTitle><h1>{error}</h1></EmptyTitle>
          <EmptyDescription>The record could not be opened.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent><Button asChild variant="outline" size="sm"><Link href="/orders">Back to orders</Link></Button></EmptyContent>
      </Empty>}
      {!error && !detail && <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-96" />
        <p className="text-sm text-muted-foreground">Loading order…</p>
      </div>}
    </main>}
  </AppFrame>
}
