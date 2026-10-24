"use server";

import { redirect } from "next/navigation";
import { archiveFlow, duplicateFlow, saveFlow } from "@/core/flows.mjs";
import { ROOT } from "@/lib/root";

const INVALID = ["Data form tidak valid."];

export async function saveFlowAction(
  json: string,
  mode: "create" | "update",
  expectedVersion?: number,
): Promise<{ ok: true; id: string; version: number } | { ok: false; errors: string[] }> {
  // A server action is a public POST endpoint: check its arguments, not only what our form sends.
  // An update always carries the version the editor loaded, or two editors would overwrite each other.
  if (mode !== "create" && !(mode === "update" && Number.isInteger(expectedVersion))) return { ok: false, errors: INVALID };
  let input: unknown;
  try { input = JSON.parse(json); } catch { return { ok: false, errors: INVALID }; }
  const r = saveFlow(ROOT, input, { mode, expectedVersion: mode === "update" ? expectedVersion : undefined });
  if (!r.ok) return { ok: false, errors: r.errors };
  const { id, version } = r.flow as { id: string; version: number };
  return { ok: true, id, version };
}

export async function duplicateFlowAction(id: string): Promise<void> {
  const r = duplicateFlow(ROOT, id);
  // The list disables Duplikat for flows that cannot be used, so this is a stale page or a hand-made request.
  if (!r.ok) throw new Error(r.errors.join(" "));
  redirect(`/alur/${(r.flow as { id: string }).id}`);
}

export async function archiveFlowAction(id: string): Promise<void> {
  try {
    archiveFlow(ROOT, id);
  } catch (e) {
    // Already archived elsewhere: the list is what the user wanted to see anyway.
    if ((e as { code?: string }).code !== "FLOW_NOT_FOUND") throw e;
  }
  redirect("/alur");
}
