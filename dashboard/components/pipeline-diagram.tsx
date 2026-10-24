import { Badge } from "@/components/ui/badge";

const STEPS = [
  { name: "Prompt", note: "Anda memilih alur dan topik, atau mengetik /buat-video di chat.", optional: false },
  { name: "Persiapan", note: "Folder proyek dan catatan run dibuat.", optional: false },
  { name: "Naskah", note: "Claude menulis naskah per scene.", optional: false },
  { name: "Aset & Audio", note: "Gambar, suara, atau musik, bila alur memintanya.", optional: true },
  { name: "Komposisi", note: "Tampilan scene disesuaikan dengan brand.", optional: false },
  { name: "Render", note: "Remotion merender video menjadi MP4.", optional: false },
  { name: "Review visual", note: "Frame diperiksa: teks terpotong, elemen bertumpuk, frame kosong.", optional: false },
  { name: "Selesai", note: "Video divalidasi dan dicatat di proyek.", optional: false },
  { name: "Galeri", note: "Video tampil di halaman Video.", optional: false },
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
        </li>
      ))}
    </ol>
  );
}
