import { photo, photoBytes } from "@/lib/visual";

// Serves one packet photo by its attachment id. Read-only, manifest files only.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = photo((await params).id);
  if (!p) return new Response("No such photo", { status: 404 });
  return new Response(new Uint8Array(photoBytes(p)), {
    headers: { "content-type": p.format === "png" ? "image/png" : "image/jpeg", "cache-control": "private, max-age=3600" },
  });
}
