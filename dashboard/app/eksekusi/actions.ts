"use server";

import { repeatRequest } from "@/core/requests.mjs";
import { markRunFailed } from "@/core/runs.mjs";
import { ROOT } from "@/lib/root";

type Failure = { ok: false; errors: string[] };
const INVALID: Failure = { ok: false, errors: ["Data tidak valid."] };

export async function markFailedAction(project: string, runId: string): Promise<{ ok: true } | Failure> {
  // A server action is a public POST endpoint: check the types here; markRunFailed checks the names and the run's status.
  if (typeof project !== "string" || typeof runId !== "string") return INVALID;
  try {
    markRunFailed(ROOT, project, runId, "Ditandai gagal dari dashboard.", new Date());
  } catch (e) {
    // markRunFailed refuses with a plain Indonesian Error (not found, wrong status). A file system error carries a `code`: that one is a real failure.
    if (e instanceof Error && !("code" in e)) return { ok: false, errors: [e.message] };
    throw e;
  }
  return { ok: true };
}

export async function repeatRequestAction(project: string, runId: string): Promise<{ ok: true; prompt: string } | Failure> {
  if (typeof project !== "string" || typeof runId !== "string") return INVALID;
  const r = repeatRequest(ROOT, project, runId);
  return "prompt" in r ? { ok: true, prompt: r.prompt } : { ok: false, errors: r.errors };
}
