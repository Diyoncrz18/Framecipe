import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { MEDIA_ROOTS, contentDisposition, contentTypeFor, parseRange } from "@/core/http-range.mjs";
import { resolveInside, toRepoRelative } from "@/core/paths.mjs";
import { ROOT } from "@/lib/root";

export const dynamic = "force-dynamic";

const notFound = () => new Response("Tidak ditemukan", { status: 404 });

// The file for a URL path, or null. Every failure (outside the repo, a link leaving it, a NUL byte, no such file, a folder) is the
// same answer: the caller sends 404 and never says which one it was.
function locate(segments: string[]) {
  try {
    const file = resolveInside(ROOT, ...segments);
    const stat = fs.statSync(file);
    // A later ".." can leave the allowed folder yet stay inside the repo (projects/../.dashboard/x.png): check where the path ended up.
    const top = toRepoRelative(ROOT, file)?.split("/")[0] ?? "";
    return MEDIA_ROOTS.includes(top) && stat.isFile() ? { file, size: stat.size } : null;
  } catch {
    return null;
  }
}

// Serves images and videos of the repo, with Range so <video> can seek.
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const type = contentTypeFor(segments.at(-1) ?? "");
  const found = MEDIA_ROOTS.includes(segments[0]) && type ? locate(segments) : null;
  if (!found || !type) return notFound();
  const { file, size } = found;

  const headers: Record<string, string> = { "Content-Type": type, "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff" };
  if (type === "image/svg+xml") headers["Content-Security-Policy"] = "sandbox"; // an SVG opened on its own must not run its scripts here
  if (new URL(request.url).searchParams.get("download") === "1") headers["Content-Disposition"] = contentDisposition(path.basename(file));

  const range = parseRange(request.headers.get("range"), size);
  if (range === "invalid") return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });

  const body = Readable.toWeb(fs.createReadStream(file, range ?? undefined)) as unknown as ReadableStream;
  if (!range) return new Response(body, { headers: { ...headers, "Content-Length": String(size) } });
  return new Response(body, {
    status: 206,
    headers: { ...headers, "Content-Range": `bytes ${range.start}-${range.end}/${size}`, "Content-Length": String(range.end - range.start + 1) },
  });
}
