"use server";

import { createRequest } from "@/core/requests.mjs";
import { ROOT } from "@/lib/root";

export async function createRequestAction(
  input: { flow: string; topic: string; notes: string; uploads: string | null; files: string[] },
): Promise<{ ok: true; id: string; prompt: string } | { ok: false; errors: string[] }> {
  // A server action is a public POST endpoint: check the types here; createRequest checks the lengths, the flow and the files.
  const { flow, topic, notes, uploads, files } = (input ?? {}) as Record<string, unknown>;
  const fileList = Array.isArray(files) && files.every((f) => typeof f === "string") ? (files as string[]) : null;
  if (typeof flow !== "string" || typeof topic !== "string" || typeof notes !== "string" || (uploads !== null && typeof uploads !== "string") || !fileList) {
    return { ok: false, errors: ["Data form tidak valid."] };
  }
  return createRequest(ROOT, { flow, topic, notes, uploads, files: fileList });
}
