import type { FlowOption } from "@/components/flow-select";
import { listFlows } from "@/core/flows.mjs";
import { ROOT } from "@/lib/root";

// `valid` is false for a broken or invalid flow: it stays in the list (so the user sees it) but cannot be picked.
export function loadFlowOptions(): FlowOption[] {
  return listFlows(ROOT).map((f) => ({ id: f.id, name: f.name, valid: !f.corrupt && f.errors.length === 0 }));
}
