import { readFile } from "node:fs/promises"
import { NextResponse } from "next/server"
import { attachmentPath, readAttachmentManifest } from "@/lib/attachments"

export const runtime = "nodejs"

/** One attachment file from the local attachments/ folder. */
export async function GET(_request: Request, context: { params: Promise<{ id: string; attachmentId: string }> }) {
  const { id, attachmentId } = await context.params
  const attachment = (await readAttachmentManifest()).find((row) => row.id === attachmentId && row.order_id === id)
  if (!attachment) return NextResponse.json({ error: "Attachment not found" }, { status: 404 })
  return new NextResponse(await readFile(attachmentPath(attachment)), {
    headers: { "content-type": attachment.content_type, "content-disposition": "inline", "cache-control": "public, max-age=3600" },
  })
}
