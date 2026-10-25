import fs from "node:fs";
import { attachments, imagePath } from "@/lib/vision";

// Serves packet photos and the PNG renders of packet PDFs. Only files listed in
// the attachment manifest are served.
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const file = (await params).path.join("/");
  if (!attachments().some((a) => a.file === file)) return new Response("Not found", { status: 404 });
  const p = imagePath(file);
  if (!fs.existsSync(p)) return new Response("Not rendered", { status: 404 });
  return new Response(fs.readFileSync(p), {
    headers: { "content-type": p.endsWith(".png") ? "image/png" : "image/jpeg", "cache-control": "public, max-age=3600" },
  });
}
