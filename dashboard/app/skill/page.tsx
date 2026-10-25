import Link from "next/link";
import { CircleAlert, CircleCheck, CircleX, KeyRound, Search, Wrench, type LucideIcon } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { MismatchBadge } from "@/components/mismatch-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { allEnvKeys, defaultClaudeDir, envStatus, readCatalog, readGlobalSkills, readiness, type CatalogItem } from "@/core/catalog.mjs";
import { listFlows } from "@/core/flows.mjs";
import { skillUsage } from "@/core/runs.mjs";
import { formatDate } from "@/lib/format";
import { ROOT } from "@/lib/root";

const TABS = [
  { id: "tool", label: "Tool" },
  { id: "skill", label: "Skill proyek" },
  { id: "command", label: "Command" },
  { id: "global", label: "Skill global" },
] as const;
type Tab = (typeof TABS)[number]["id"];

// Registry `category` values, in the order their groups are listed.
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

type Ready = ReturnType<typeof readiness>;
const AMBER = "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200";
// Icon plus text, never color alone (NFR-10).
const READY: Record<Ready, { label: string; Icon: LucideIcon; className: string }> = {
  ready: { label: "Siap dipakai", Icon: CircleCheck, className: "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-200" },
  partial: { label: "Sebagian key terisi", Icon: CircleAlert, className: AMBER },
  "needs-key": { label: "Perlu API key", Icon: KeyRound, className: AMBER },
  "needs-setup": { label: "Perlu prasyarat", Icon: Wrench, className: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200" },
  missing: { label: "File tidak ada", Icon: CircleX, className: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200" },
};

type Entry = {
  id: string; call: string; copy: boolean; description: string; group: string; ready: Ready; status: string | null; mismatch: string | null;
  envVars: string[]; requires: string | null; used?: string; flows?: string;
};

const GRID = "grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,20rem),1fr))]";
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const category = (i: CatalogItem) => (i.category && CATEGORIES[i.category]) || "Lainnya";
const href = (tab: Tab, q: string) => `/skill?${new URLSearchParams(q ? { tab, q } : { tab })}`;

// Only filled or empty is known here; the values stay on the server (NFR-03).
function Needs({ entry, filled }: { entry: Entry; filled: Set<string> }) {
  if (!entry.envVars.length && !entry.requires) return null;
  return (
    <div className="flex flex-col gap-1">
      {entry.envVars.map((key) =>
        filled.has(key) ? (
          <span key={key} className="flex items-center gap-1 text-green-800 dark:text-green-300">
            <CircleCheck aria-hidden="true" className="size-3.5 shrink-0" />
            <code className="text-xs">{key}</code> terisi
          </span>
        ) : (
          <span key={key} className="flex items-center gap-1 text-amber-900 dark:text-amber-200">
            <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
            <code className="text-xs">{key}</code> kosong
          </span>
        ),
      )}
      {entry.requires && <span className="text-muted-foreground">Prasyarat: {entry.requires}</span>}
    </div>
  );
}

function Item({ entry, filled }: { entry: Entry; filled: Set<string> }) {
  const { label, Icon, className } = READY[entry.ready];
  return (
    <li className="grid">
      <Card>
        <CardHeader className="gap-2">
          <CardTitle className="break-words">{entry.id}</CardTitle>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={`border-transparent ${className}`}><Icon aria-hidden="true" />{label}</Badge>
            {entry.status && <Badge variant="outline">{entry.status}</Badge>}
            <MismatchBadge mismatch={entry.mismatch} />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {entry.description && <p className="line-clamp-3 text-muted-foreground">{entry.description}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs break-all">{entry.call}</code>
            {entry.copy && <CopyButton text={entry.call} />}
          </div>
          <Needs entry={entry} filled={filled} />
          {entry.used && <p>Dipakai: {entry.used}</p>}
          {entry.flows && <p>Dicantumkan di alur: {entry.flows}</p>}
        </CardContent>
      </Card>
    </li>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const requested = first(sp.tab);
  const tab: Tab = TABS.find((t) => t.id === requested)?.id ?? "tool";
  const q = first(sp.q).trim();

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

  const fromCatalog = (i: CatalogItem, group: string, call: string) => ({
    id: i.id, call, copy: false, description: i.description, group, ready: readiness(i, filled), status: i.status, mismatch: i.mismatch,
    envVars: i.envVars, requires: i.requires,
  });
  const entries: Record<Tab, Entry[]> = {
    tool: catalog.tools.map((t) => ({ ...fromCatalog(t, category(t), t.usage ?? `uv run tools/${t.id}.py --help`), copy: true })),
    skill: catalog.skills.map((s) => ({
      ...fromCatalog(s, category(s), s.skillName), used: usedText(s.skillName), flows: flows.get(s.skillName)?.join(", "),
    })),
    command: catalog.commands.map((c) => fromCatalog(c, "Slash command", `/${c.id}`)),
    global: global.skills.map((s) => ({
      id: s.id, call: s.skillName, copy: false, description: s.description, group: s.plugin ? `Plugin ${s.plugin}` : "Skill pengguna (~/.claude/skills)",
      ready: "ready", status: null, mismatch: null, envVars: [], requires: null, used: usedText(s.skillName),
    })),
  };

  const needle = q.toLowerCase();
  const shown = Object.fromEntries(TABS.map(({ id }) => [id, entries[id].filter((e) =>
    [e.id, e.call, e.description, e.group].some((s) => s.toLowerCase().includes(needle)))])) as Record<Tab, Entry[]>;
  const rank = (g: string) => (GROUP_ORDER.includes(g) ? GROUP_ORDER.indexOf(g) : GROUP_ORDER.length);
  const groups = new Map<string, Entry[]>();
  for (const e of [...shown[tab]].sort((a, b) => rank(a.group) - rank(b.group) || a.group.localeCompare(b.group))) {
    groups.set(e.group, [...(groups.get(e.group) ?? []), e]);
  }
  const readyTools = entries.tool.filter((t) => t.ready === "ready").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Skill & Tools</h1>
        <p className="text-muted-foreground">Semua skill, command, dan tool yang bisa dipakai Claude untuk membuat video, beserta yang perlu disiapkan.</p>
        <p className="text-sm">
          Tool siap dipakai: {readyTools} dari {entries.tool.length} · API key terisi: {filled.size} dari {keys.length} · Skill global: {entries.global.length}
        </p>
      </div>
      {catalog.registryError && <p role="alert" className="text-sm text-destructive">Registry bermasalah: {catalog.registryError}</p>}
      {global.error && <p role="alert" className="text-sm text-destructive">Skill global bermasalah: {global.error}</p>}

      <form role="search" action="/skill" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value={tab} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-md">
          <Label htmlFor="cari-skill">Cari skill atau tool</Label>
          <Input id="cari-skill" name="q" type="search" defaultValue={q} placeholder="mis. suara, hyperframes, gambar" />
        </div>
        <Button type="submit"><Search aria-hidden="true" />Cari</Button>
        {q && <Link href={href(tab, "")} className="py-1.5 text-sm underline underline-offset-4">Hapus pencarian</Link>}
      </form>

      <nav aria-label="Jenis katalog">
        <ul className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <li key={t.id}>
              <Link
                href={href(t.id, q)}
                aria-current={t.id === tab ? "page" : undefined}
                className="block rounded-md px-3 py-1.5 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-muted aria-[current=page]:font-semibold"
              >
                {t.label} ({shown[t.id].length})
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "global" && (
        <p className="text-sm text-muted-foreground">
          Skill yang terpasang di Claude Code di luar proyek ini (<code className="text-xs break-all">{claudeDir}</code>): skill pengguna dan skill dari plugin.
          Hanya ditampilkan di sini; resep di Alur hanya bisa memakai skill proyek.
        </p>
      )}

      {!groups.size && (
        <p>
          {q ? `Tidak ada yang cocok dengan “${q}” di ${TABS.find((t) => t.id === tab)?.label}.` : "Belum ada item."}
          {TABS.filter((t) => shown[t.id].length).map((t) => (
            <span key={t.id}> <Link href={href(t.id, q)} className="underline underline-offset-4">Lihat {shown[t.id].length} di {t.label}</Link>.</span>
          ))}
        </p>
      )}
      {[...groups].map(([group, items], n) => (
        <section key={group} aria-labelledby={`grup-${n}`} className="flex flex-col gap-3">
          <h2 id={`grup-${n}`} className="text-lg font-semibold">{group} ({items.length})</h2>
          <ul className={GRID}>
            {items.map((e) => <Item key={`${e.id}|${e.call}`} entry={e} filled={filled} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}
