import Link from "next/link";
import { Badge } from "@/components/ui/badge";

// `tools`: skills (names as the Skill tool knows them, R14), commands and scripts usually used at the stage. Static text, like the page content.
// `link`: the dashboard page where this stage can be followed or its pieces chosen.
const STEPS = [
  { name: "Prompt", note: "Anda memilih alur dan topik di dashboard, lalu menempel prompt /buat-video di chat Claude Code.", optional: false,
    tools: ["/buat-video"], link: { href: "/alur", label: "Alur" } },
  { name: "Persiapan", note: "Folder proyek dan catatan run dibuat.", optional: false,
    tools: ["run.mjs start"], link: { href: "/eksekusi", label: "Eksekusi" } },
  { name: "Naskah", note: "Claude menulis naskah per scene.", optional: false,
    tools: ["remotion-best-practices", "VOICEOVER-SCRIPT.md"], link: { href: "/skill", label: "Skill & Tools" } },
  { name: "Aset & Audio", note: "Gambar atau musik, bila alur memintanya. MVP ini berjalan tanpa suara.", optional: true,
    tools: ["ideogram4", "acestep"], link: { href: "/skill", label: "Skill & Tools" } },
  { name: "Komposisi", note: "Tampilan scene disesuaikan dengan brand.", optional: false,
    tools: ["frontend-design", "remotion-best-practices"], link: { href: "/referensi", label: "Referensi Desain" } },
  { name: "Render", note: "Remotion merender video menjadi MP4.", optional: false,
    tools: ["run.mjs render", "Remotion"], link: { href: "/eksekusi", label: "Eksekusi" } },
  { name: "Review visual", note: "Frame diperiksa: teks terpotong, elemen bertumpuk, frame kosong.", optional: false,
    tools: ["run.mjs stills"], link: { href: "/eksekusi", label: "Eksekusi" } },
  { name: "Selesai", note: "Video divalidasi dan dicatat di proyek.", optional: false,
    tools: ["run.mjs finish"], link: { href: "/eksekusi", label: "Eksekusi" } },
  { name: "Galeri", note: "Video tampil di halaman Video.", optional: false,
    tools: ["thumbnail dari run.mjs stills"], link: { href: "/video", label: "Video" } },
];

// An ordered list, so the sequence reads in order for screen readers too; the number makes it explicit on screen.
export function PipelineDiagram() {
  return (
    <ol aria-label="Urutan pembuatan video" className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(12rem,1fr))]">
      {STEPS.map((s, i) => (
        <li key={s.name} className="flex flex-col gap-1.5 rounded-lg border bg-card p-3 text-card-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{i + 1}</span>
            <span className="font-semibold">{s.name}</span>
            {s.optional && <Badge variant="outline">Opsional</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{s.note}</p>
          <ul aria-label={`Skill dan tool tahap ${s.name}`} className="flex flex-wrap gap-1">
            {s.tools.map((t) => (
              <li key={t}><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{t}</code></li>
            ))}
          </ul>
          <Link
            href={s.link.href}
            aria-label={`${s.link.label}, terkait tahap ${s.name}`}
            className="mt-auto rounded-sm text-sm underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {s.link.label}
          </Link>
        </li>
      ))}
    </ol>
  );
}
