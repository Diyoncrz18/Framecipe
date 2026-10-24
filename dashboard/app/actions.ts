"use server";

import { createRequest } from "@/core/requests.mjs";
import { ROOT } from "@/lib/root";

export async function createRequestAction(
  input: { flow: string; topic: string; notes: string },
): Promise<{ ok: true; id: string; prompt: string } | { ok: false; errors: string[] }> {
  // A server action is a public POST endpoint: check the types here; createRequest checks the lengths and the flow.
  const { flow, topic, notes } = (input ?? {}) as Record<string, unknown>;
  if (typeof flow !== "string" || typeof topic !== "string" || typeof notes !== "string") return { ok: false, errors: ["Data form tidak valid."] };
  return createRequest(ROOT, { flow, topic, notes });
}
