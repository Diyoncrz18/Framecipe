import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { isAllowedHost, isAllowedOrigin } from "@/core/host-guard.mjs";
import { MAX_SOURCE_BYTES } from "@/core/source-files.mjs";
import { saveUpload } from "@/core/uploads.mjs";
import { ROOT } from "@/lib/root";

export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => Response.json({ ok: false, error }, { status });

// One source file per request, the raw file as the body: POST /api/uploads?name=<file name>[&batch=<folder from the first answer>].
// proxy.ts skips this route so a large body is not cut at 10 MB: the Host check runs here, plus an Origin check,
// because a route handler, unlike a server action, takes a POST from a form on any other site.
export async function POST(request: Request) {
  if (!isAllowedHost(request.headers.get("host")) || !isAllowedOrigin(request.headers.get("origin"))) return fail("Asal permintaan tidak diizinkan.", 403);
  const params = new URL(request.url).searchParams;
  const name = params.get("name") ?? "";
  if (Number(request.headers.get("content-length")) > MAX_SOURCE_BYTES) return fail(`File "${name}" lebih dari 2 GB.`, 413);
  if (!request.body) return fail(`File "${name}" kosong.`, 400);
  try {
    const body = Readable.fromWeb(request.body as unknown as NodeReadableStream);
    return Response.json({ ok: true, ...(await saveUpload(ROOT, { batch: params.get("batch") ?? undefined, name }, body)) });
  } catch (e) {
    const { code, message } = e as { code?: string; message?: string };
    if (code === "TOO_LARGE") return fail(message ?? "File terlalu besar.", 413);
    if (code === "UPLOAD_FAILED") return fail(message ?? "File gagal diunggah.", 500);
    if (code) return fail(message ?? "File ditolak.", 400);
    return fail("File gagal diunggah.", 500);
  }
}
