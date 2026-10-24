import { envStatus, readCatalog } from "@/core/catalog.mjs";
import { VOICE_PROVIDER_KEYS } from "@/core/flow-form.mjs";
import type { EditorData } from "@/components/flow-editor/types";
import { ROOT } from "@/lib/root";

const COLORS = ["primary", "primaryLight", "textDark", "bgLight", "bgDark"];

// What the editor may pick from. Only what sits on disk is usable (the registry alone is not enough), and the browser gets
// which .env keys are filled, never their values (NFR-03).
export function loadEditorData(): EditorData {
  const c = readCatalog(ROOT);
  const onDisk = <T extends { source: string }>(items: T[]) => items.filter((i) => i.source !== "registry");
  const ids = (items: { id: string }[]) => items.map((i) => i.id);
  const keys = [...new Set(Object.values(VOICE_PROVIDER_KEYS).flat())];
  return {
    templates: onDisk(c.templates).map(({ id, engine, aspectRatio, width, height }) => ({ id, engine, aspectRatio, width, height })),
    brands: onDisk(c.brands).map((b) => {
      const colors = (b.brand?.colors ?? {}) as Record<string, unknown>;
      return { id: b.id, colors: Object.fromEntries(COLORS.flatMap((k) => (typeof colors[k] === "string" ? [[k, colors[k]]] : []))) };
    }),
    transitions: ids(c.transitions),
    references: {
      example: ids(onDisk(c.examples)), template: ids(onDisk(c.templates)), brand: ids(onDisk(c.brands)),
      transition: ids(c.transitions), component: ids(c.components),
    },
    skills: onDisk(c.skills).map((s) => ({ id: s.id, skillName: s.skillName, description: s.description })),
    env: Object.fromEntries(envStatus(ROOT, keys).map((k) => [k.key, k.present])),
  };
}
