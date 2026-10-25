import { allEnvKeys, defaultClaudeDir, envStatus, readCatalog, readGlobalSkills, readiness, type CatalogItem } from "@/core/catalog.mjs";
import { listFlows } from "@/core/flows.mjs";
import { skillUsage } from "@/core/runs.mjs";
import { formatDate } from "@/lib/format";
import { ROOT } from "@/lib/root";

// Data for the Skill & Tools list and its detail pages (server only).
export const TABS = [
  { id: "tool", label: "Tool" },
  { id: "skill", label: "Skill proyek" },
  { id: "command", label: "Command" },
  { id: "global", label: "Skill global" },
] as const;
export type Tab = (typeof TABS)[number]["id"];
export const isTab = (v: string): v is Tab => TABS.some((t) => t.id === v);

// Registry `category` values, in the order their rows are listed.
const CATEGORIES: Record<string, string> = {
  "audio-generation": "Suara & audio",
  "music-generation": "Musik",
  "image-generation": "Gambar AI",
  "image-editing": "Edit gambar",
  "video-generation": "Video AI",
  "video-editing": "Edit video",
  composition: "Komposisi & desain",
  project: "Produksi proyek",
  publishing: "Publikasi",
  setup: "Setup & cloud GPU",
  utility: "Utilitas",
};
const GROUP_ORDER = [...Object.values(CATEGORIES), "Lainnya"];

export type Ready = ReturnType<typeof readiness>;
export type Entry = {
  key: string; // detail page URL segment: the id, or for a global skill its Skill tool name (ids repeat across plugins)
  id: string; call: string; description: string; group: string; ready: Ready; status: string | null; mismatch: string | null;
  envVars: string[]; requires: string | null; path: string | null; used?: string; flows?: string;
  doc: { root: string; path: string | null }; // where readItemDoc finds the item's own explanation
};

export const detailHref = (tab: Tab, e: Entry) => `/skill/${tab}/${encodeURIComponent(e.key)}`;

export function loadSkillCatalog() {
  const catalog = readCatalog(ROOT);
  const claudeDir = defaultClaudeDir();
  const global = readGlobalSkills(claudeDir);
  const keys = envStatus(ROOT, allEnvKeys(catalog));
  const filled = new Set(keys.filter((k) => k.present).map((k) => k.key));
  // SKL-03: usage comes from Skill tool events and flows list skills; both are keyed by the name the Skill tool is invoked with.
  const runs = skillUsage(ROOT);
  const usedText = (name: string) => {
    // hasOwn: runs is a plain object keyed by skill names, so a skill called "constructor" must not find an inherited property.
    const u = Object.hasOwn(runs, name) ? runs[name] : undefined;
    return u ? `${u.runs} run · terakhir ${formatDate(u.lastUsedAt)}` : undefined;
  };
  const flows = new Map<string, string[]>();
  for (const f of listFlows(ROOT)) for (const s of new Set(f.skills)) flows.set(s, [...(flows.get(s) ?? []), f.name]);

  const fromCatalog = (i: CatalogItem, call: string): Entry => ({
    key: i.id, id: i.id, call, description: i.description, group: (i.category && CATEGORIES[i.category]) || "Lainnya",
    ready: readiness(i, filled), status: i.status, mismatch: i.mismatch, envVars: i.envVars, requires: i.requires, path: i.path,
    doc: { root: ROOT, path: i.path },
  });
  const rank = (g: string) => (GROUP_ORDER.includes(g) ? GROUP_ORDER.indexOf(g) : GROUP_ORDER.length);
  const sorted = (list: Entry[]) => list.sort((a, b) => rank(a.group) - rank(b.group) || a.group.localeCompare(b.group) || a.id.localeCompare(b.id));

  const entries: Record<Tab, Entry[]> = {
    tool: sorted(catalog.tools.map((t) => fromCatalog(t, t.usage ?? `uv run tools/${t.id}.py --help`))),
    skill: sorted(catalog.skills.map((s) => ({ ...fromCatalog(s, s.skillName), used: usedText(s.skillName), flows: flows.get(s.skillName)?.join(", ") }))),
    command: sorted(catalog.commands.map((c) => ({ ...fromCatalog(c, `/${c.id}`), group: "Slash command" }))),
    global: sorted(global.skills.map((s) => ({
      key: s.skillName, id: s.id, call: s.skillName, description: s.description, group: s.plugin ? `Plugin ${s.plugin}` : "Skill pengguna",
      ready: "ready", status: null, mismatch: null, envVars: [], requires: null, path: null, used: usedText(s.skillName), doc: s.doc,
    }))),
  };
  return { entries, filled, keyCount: keys.length, registryError: catalog.registryError, globalError: global.error, claudeDir };
}
