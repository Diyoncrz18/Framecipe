import { readJson } from "@/core/jsonfile.mjs";
import { resolveInside } from "@/core/paths.mjs";
import { ROOT } from "@/lib/root";

// The flow's display name, or its id when flow.json is missing or broken.
export function flowName(id: string): string {
  try {
    const r = readJson(resolveInside(ROOT, "flows", id, "flow.json"));
    if (r.ok && typeof r.value?.name === "string" && r.value.name) return r.value.name;
  } catch { /* an id that is not a plain folder name */ }
  return id;
}
