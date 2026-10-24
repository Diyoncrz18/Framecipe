import { CircleAlert, CircleCheck } from "lucide-react";
import { MismatchBadge } from "@/components/mismatch-badge";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { allEnvKeys, envStatus, readCatalog, type CatalogItem } from "@/core/catalog.mjs";
import { listFlows } from "@/core/flows.mjs";
import { skillUsage } from "@/core/runs.mjs";
import { formatDate } from "@/lib/format";
import { ROOT } from "@/lib/root";

const DASH = "—";
const SOURCES = { registry: "Registry", folder: "Folder", both: "Keduanya" };
const WRAP = "whitespace-normal align-top";

// SKL-03, for skills only: usage comes from Skill tool events, and flows list skills. Both are keyed by the Skill tool name (skillName).
type SkillUse = { runs: Record<string, { runs: number; lastUsedAt: string }>; flows: Map<string, string[]> };

// Only filled or empty is known here; the values stay on the server (NFR-03).
function Needs({ item, filled }: { item: CatalogItem; filled: Map<string, boolean> }) {
  if (!item.envVars.length && !item.requires) return DASH;
  return (
    <div className="flex flex-col gap-1">
      {item.envVars.map((key) =>
        filled.get(key) ? (
          <span key={key} className="flex items-center gap-1 text-green-800">
            <CircleCheck aria-hidden="true" className="size-3.5 shrink-0" />
            <code className="text-xs">{key}</code> terisi
          </span>
        ) : (
          <span key={key} className="flex items-center gap-1 text-amber-900">
            <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
            <code className="text-xs">{key}</code> kosong
          </span>
        ),
      )}
      {item.requires && <span className="text-muted-foreground">{item.requires}</span>}
    </div>
  );
}

function CatalogTable({ id, title, items, filled, use }: {
  id: string; title: string; items: (CatalogItem & { skillName?: string })[]; filled: Map<string, boolean>; use?: SkillUse;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 id={id} className="text-lg font-semibold">{title} ({items.length})</h2>
      <Table aria-labelledby={id}>
        <TableHeader>
          <TableRow>
            {["Nama", "Deskripsi", "Status", "Sumber", "Kebutuhan", "Dipakai", ...(use ? ["Dicantumkan di alur"] : [])].map((h) => <TableHead key={h}>{h}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((i) => {
            const name = i.skillName ?? i.id;
            // hasOwn: runs is a plain object keyed by skill names, so a skill called "constructor" must not find an inherited property.
            const used = use && Object.hasOwn(use.runs, name) ? use.runs[name] : undefined;
            return (
              <TableRow key={i.id}>
                <TableCell className={`${WRAP} font-medium`}>
                  <span>{i.id}</span>
                  {i.skillName && i.skillName !== i.id && <span className="block text-xs font-normal text-muted-foreground">dipanggil sebagai {i.skillName}</span>}
                </TableCell>
                <TableCell className={`${WRAP} min-w-64`}>{i.description || DASH}</TableCell>
                <TableCell className={WRAP}>{i.status ? <Badge variant="outline">{i.status}</Badge> : DASH}</TableCell>
                <TableCell className={WRAP}>
                  <div className="flex flex-col items-start gap-1">
                    {SOURCES[i.source]}
                    <MismatchBadge mismatch={i.mismatch} />
                  </div>
                </TableCell>
                <TableCell className={`${WRAP} min-w-48`}><Needs item={i} filled={filled} /></TableCell>
                <TableCell className={WRAP}>{!use ? DASH : used ? `${used.runs} run · terakhir ${formatDate(used.lastUsedAt)}` : "Belum dipakai"}</TableCell>
                {use && <TableCell className={WRAP}>{use.flows.get(name)?.join(", ") || DASH}</TableCell>}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}

export default function Page() {
  const catalog = readCatalog(ROOT);
  const keys = envStatus(ROOT, allEnvKeys(catalog));
  const filled = new Map(keys.map((k) => [k.key, k.present]));
  const flows = new Map<string, string[]>();
  for (const f of listFlows(ROOT)) for (const s of new Set(f.skills)) flows.set(s, [...(flows.get(s) ?? []), f.name]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Skill & Tools</h1>
      {catalog.registryError && <p role="alert" className="text-sm text-destructive">Registry bermasalah: {catalog.registryError}</p>}
      <p>API key terisi: {keys.filter((k) => k.present).length} dari {keys.length}</p>
      <CatalogTable id="tabel-skill" title="Skill" items={catalog.skills} filled={filled} use={{ runs: skillUsage(ROOT), flows }} />
      <CatalogTable id="tabel-command" title="Command" items={catalog.commands} filled={filled} />
      <CatalogTable id="tabel-tool" title="Tool" items={catalog.tools} filled={filled} />
    </div>
  );
}
