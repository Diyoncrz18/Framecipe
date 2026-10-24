"use server";

import { loadEditorData } from "@/app/alur/editor-data";
import { addReference, readFlow } from "@/core/flows.mjs";
import { ROOT } from "@/lib/root";

type Result = { ok: true; version: number; added: boolean } | { ok: false; errors: string[] };

export async function addReferenceAction(flowId: string, ref: { kind: string; id: string }): Promise<Result> {
  // A server action is a public POST endpoint: check the arguments, and only take `kind` and `id` from `ref`.
  const { kind, id } = (ref ?? {}) as Record<string, unknown>;
  if (typeof flowId !== "string" || typeof kind !== "string" || typeof id !== "string" || id.length > 200) return { ok: false, errors: ["Data form tidak valid."] };
  // The same ids the flow editor offers: what sits on disk (or in the registry for transitions and components).
  const known = loadEditorData().references;
  if (!Object.hasOwn(known, kind) || !known[kind as keyof typeof known].includes(id)) return { ok: false, errors: [`Referensi ${kind} "${id}" tidak ditemukan.`] };
  const before = (readFlow(ROOT, flowId)?.flow as { version?: number } | null | undefined)?.version;
  const r = addReference(ROOT, flowId, { kind, id });
  if (!r.ok) return { ok: false, errors: r.errors };
  const version = (r.flow as { version: number }).version;
  return { ok: true, version, added: version !== before }; // addReference writes nothing when the flow already has it
}
