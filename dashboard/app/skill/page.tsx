import Link from "next/link";
import { Eye, Search } from "lucide-react";
import { ApiKeySummary, ReadinessBadge } from "@/components/skill-badges";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { detailHref, loadSkillCatalog, TABS, type Entry, type Tab } from "@/lib/skill-catalog";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const href = (tab: Tab, q: string) => `/skill?${new URLSearchParams(q ? { tab, q } : { tab })}`;
const GROUP_HEADING: Record<Tab, string | null> = { tool: "Kategori", skill: "Kategori", command: null, global: "Sumber" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const requested = first(sp.tab);
  const tab: Tab = TABS.find((t) => t.id === requested)?.id ?? "tool";
  const q = first(sp.q).trim();
  const { entries, filled, keyCount, registryError, globalError } = loadSkillCatalog();

  const needle = q.toLowerCase();
  const shown = Object.fromEntries(TABS.map(({ id }) => [id, entries[id].filter((e: Entry) =>
    [e.id, e.call, e.description, e.group].some((s) => s.toLowerCase().includes(needle)))])) as Record<Tab, Entry[]>;
  const rows = shown[tab];
  const groupHeading = GROUP_HEADING[tab];
  const tabLabel = TABS.find((t) => t.id === tab)?.label;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Skill & Tools</h1>
        <p className="text-muted-foreground">Semua skill, command, dan tool yang bisa dipakai Claude untuk membuat video. Klik ikon mata di kolom Aksi untuk melihat fungsi dan cara pakainya.</p>
        <p className="text-sm">
          Tool siap dipakai: {entries.tool.filter((t) => t.ready === "ready").length} dari {entries.tool.length} · API key terisi: {filled.size} dari {keyCount}
        </p>
      </div>
      {registryError && <p role="alert" className="text-sm text-destructive">Registry bermasalah: {registryError}</p>}
      {globalError && <p role="alert" className="text-sm text-destructive">Skill global bermasalah: {globalError}</p>}

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
          Skill yang terpasang di Claude Code di luar proyek ini: skill pengguna dan skill dari plugin. Hanya ditampilkan di sini; resep di Alur hanya bisa memakai skill proyek.
        </p>
      )}

      {rows.length ? (
        <Table aria-label={`Daftar ${tabLabel}`}>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              {/* Hidden on phones so API key and Status fit without scrolling; the detail page repeats it. */}
              {groupHeading && <TableHead className="hidden sm:table-cell">{groupHeading}</TableHead>}
              <TableHead>API key</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={`${e.group}|${e.id}`}>
                <TableCell className="font-medium whitespace-normal [overflow-wrap:anywhere]">{e.id}</TableCell>
                {groupHeading && <TableCell className="hidden text-muted-foreground sm:table-cell">{e.group}</TableCell>}
                <TableCell className="whitespace-normal"><ApiKeySummary envVars={e.envVars} filled={filled} /></TableCell>
                <TableCell><ReadinessBadge ready={e.ready} /></TableCell>
                <TableCell className="text-right">
                  <Link href={detailHref(tab, e)} aria-label={`Lihat detail ${e.id}`} title="Lihat detail" className={buttonVariants({ variant: "ghost", size: "icon-sm" })}>
                    <Eye aria-hidden="true" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p>
          {q ? `Tidak ada yang cocok dengan “${q}” di ${tabLabel}.` : "Belum ada item."}
          {TABS.filter((t) => shown[t.id].length).map((t) => (
            <span key={t.id}> <Link href={href(t.id, q)} className="underline underline-offset-4">Lihat {shown[t.id].length} di {t.label}</Link>.</span>
          ))}
        </p>
      )}
    </div>
  );
}
