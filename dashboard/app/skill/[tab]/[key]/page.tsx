import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { Markdown } from "@/components/markdown";
import { MismatchBadge } from "@/components/mismatch-badge";
import { ApiKeyList, ReadinessBadge } from "@/components/skill-badges";
import { Badge } from "@/components/ui/badge";
import { readItemDoc } from "@/core/catalog.mjs";
import { isTab, loadSkillCatalog, TABS, type Tab } from "@/lib/skill-catalog";

const DASH = "—";
const HOW: Record<Tab, string> = {
  tool: "Jalankan dari folder root proyek:",
  skill: "Claude memuatnya lewat Skill tool dengan nama:",
  command: "Ketik di Claude Code:",
  global: "Claude memuatnya lewat Skill tool dengan nama:",
};
const DOC_SOURCE: Record<Tab, string> = { tool: "docstring", skill: "SKILL.md", command: "file command", global: "SKILL.md" };

function decode(s: string) {
  try { return decodeURIComponent(s); } catch { return s; } // a malformed %-sequence matches nothing, then 404
}

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={id && `${id}-judul`} className="flex scroll-mt-20 flex-col gap-3">
      <h2 id={id && `${id}-judul`} className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function Page({ params }: { params: Promise<{ tab: string; key: string }> }) {
  const { tab, key } = await params;
  if (!isTab(tab)) notFound();
  const { entries, filled, claudeDir } = loadSkillCatalog();
  const name = decode(key);
  const e = entries[tab].find((x) => x.key === name);
  if (!e) notFound();
  const doc = readItemDoc(e.doc.root, e.doc.path);

  const kind = TABS.find((t) => t.id === tab)?.label ?? tab;
  const facts: [string, React.ReactNode][] = [
    ["Jenis", kind],
    [tab === "global" ? "Sumber" : "Kategori", e.group],
    ["Versi", e.status ?? DASH],
    ["Lokasi", tab === "global" ? <>Folder Claude Code (<code className="text-xs break-all">{claudeDir}</code>)</> : e.path ? <code className="text-xs break-all">{e.path}</code> : DASH],
    ...(tab === "skill" || tab === "global" ? [["Dipakai", e.used ?? "Belum dipakai"] as [string, React.ReactNode]] : []),
    ...(tab === "skill" ? [["Dicantumkan di alur", e.flows ?? DASH] as [string, React.ReactNode]] : []),
  ];

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href={`/skill?tab=${tab}`} className="text-sm text-muted-foreground underline underline-offset-4">← Skill & Tools</Link>
        <h1 className="text-2xl font-semibold break-words">{e.id}</h1>
        <div className="flex flex-wrap items-center gap-1.5">
          <ReadinessBadge ready={e.ready} />
          <Badge variant="outline">{kind}</Badge>
          <MismatchBadge mismatch={e.mismatch} />
        </div>
      </div>

      <Section title="Fungsi">
        <p>{e.description || "Belum ada ringkasan fungsi untuk item ini."}</p>
        {doc && (
          <p className="text-sm text-muted-foreground">
            Penjelasan lengkap dari {DOC_SOURCE[tab]} ada di <a href="#penjelasan" className="underline underline-offset-4">bagian bawah</a>.
          </p>
        )}
      </Section>

      <Section title="Cara pakai">
        <p className="text-sm">{HOW[tab]}</p>
        <div className="flex flex-wrap items-start gap-2">
          <pre className="min-w-0 flex-1 rounded-md bg-muted px-3 py-2 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]"><code>{e.call}</code></pre>
          <CopyButton text={e.call} />
        </div>
      </Section>

      <Section title="API key & prasyarat">
        {e.envVars.length ? (
          <>
            <ApiKeyList envVars={e.envVars} filled={filled} />
            {e.envVars.some((k) => !filled.has(k)) && (
              <p className="text-sm text-muted-foreground">Isi key yang kosong di file <code className="text-xs">.env</code> di folder root proyek, lalu muat ulang halaman ini.</p>
            )}
          </>
        ) : (
          <p className="text-sm">Tidak perlu API key.</p>
        )}
        {e.requires && <p className="text-sm">Prasyarat: {e.requires}</p>}
      </Section>

      <Section title="Info">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {facts.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="font-medium text-muted-foreground">{label}</dt>
              <dd className="min-w-0">{value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="penjelasan" title="Penjelasan lengkap">
        {doc ? (
          <>
            <p className="text-sm text-muted-foreground">
              Ditampilkan apa adanya dari <code className="text-xs break-all">{doc.file}</code>.
            </p>
            <div className="rounded-lg border border-border p-4">
              {doc.format === "markdown"
                ? <Markdown source={doc.text} embedded />
                : <pre className="text-sm whitespace-pre-wrap break-words">{doc.text}</pre>}
            </div>
          </>
        ) : (
          <p className="text-sm">Belum ada penjelasan lengkap untuk item ini.</p>
        )}
      </Section>
    </div>
  );
}
