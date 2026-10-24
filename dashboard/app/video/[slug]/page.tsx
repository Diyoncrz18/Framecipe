import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { StatusBadge, type DisplayStatus } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PHASE_LABELS, STATUS_LABELS } from "@/core/labels.mjs";
import { readProjectDetail } from "@/core/projects.mjs";
import { formatDate, formatDuration } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { ROOT } from "@/lib/root";

const DASH = "—";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = readProjectDetail(ROOT, slug);
  if (!p) notFound();

  const { video, flowSnapshot } = p;
  const versions = p.versions.flatMap((v) => (v ? [v] : [])); // the inferred type of versions allows null, the data never has it
  // "Lama proses" belongs to the run that made the video shown above; with no video, to the latest run.
  const run = p.runs.find((r) => r.runId === video?.runId) ?? p.runs[0];
  const took = run?.startedAt && run.endedAt ? (Date.parse(run.endedAt) - Date.parse(run.startedAt)) / 1000 : NaN;
  const flowLabel = typeof flowSnapshot?.name === "string" ? flowSnapshot.name : p.flow;
  const phase = p.phase ? (PHASE_LABELS as Record<string, string>)[p.phase] ?? p.phase : null;

  const facts: [string, React.ReactNode][] = [
    ["Resolusi", video?.width && video.height ? `${video.width}×${video.height}` : DASH],
    ["Durasi", video?.durationSeconds != null ? formatDuration(video.durationSeconds) : DASH],
    ["FPS", video?.fps ?? DASH],
    ["Ukuran", video?.sizeBytes != null ? `${(video.sizeBytes / 1024 / 1024).toFixed(1)} MB` : DASH],
    ["Template", p.template ?? DASH],
    ["Brand", p.brand ?? DASH],
    ["Alur", p.flow
      ? <Link href={`/alur/${encodeURIComponent(p.flow)}`} className="underline underline-offset-4">
          {flowLabel}{typeof flowSnapshot?.version === "number" ? ` v${flowSnapshot.version}` : ""}
        </Link>
      : "Tanpa alur"],
    ["Lama proses", Number.isFinite(took) && took >= 0 ? formatDuration(took) : DASH],
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href="/video" className="text-sm text-muted-foreground underline underline-offset-4">← Semua video</Link>
        <h1 className="text-2xl font-semibold break-words">{p.title}</h1>
        <div className="flex flex-wrap items-center gap-1.5">
          {phase && <Badge variant="outline">{phase}</Badge>}
          {p.latestStatus && p.latestStatus in STATUS_LABELS && <StatusBadge status={p.latestStatus as DisplayStatus} />}
        </div>
        {p.corrupt && (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            Data rusak: project.json proyek ini tidak bisa dibaca, jadi sebagian informasi di bawah kosong. Perbaiki file itu secara manual.
          </p>
        )}
      </div>

      {video ? (
        <div className="flex flex-col items-start gap-3">
          <video
            controls
            preload="metadata"
            src={mediaUrl(video.file)}
            poster={p.thumbnail ? mediaUrl(p.thumbnail) : undefined}
            className="max-h-[70vh] w-full max-w-3xl rounded-lg bg-black"
          />
          <a href={mediaUrl(video.file, { download: true })} className={buttonVariants({ variant: "outline", size: "sm" })}>Unduh</a>
        </div>
      ) : (
        <p className="text-muted-foreground">Belum ada video.</p>
      )}

      <dl className="grid max-w-3xl grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="font-medium text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <Section title="Naskah">
        {p.script?.trim() ? <Markdown source={p.script} /> : <p className="text-muted-foreground">Naskah belum ada.</p>}
      </Section>

      <Section title="Scene">
        {p.scenes.length ? (
          <Table>
            <TableHeader>
              <TableRow><TableHead>#</TableHead><TableHead>Label</TableHead><TableHead>Durasi</TableHead><TableHead>Narasi</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {p.scenes.map((s, i) => (
                <TableRow key={s.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{s.label}</TableCell>
                  <TableCell>{s.durationSeconds != null ? formatDuration(s.durationSeconds) : DASH}</TableCell>
                  <TableCell className="whitespace-normal">{s.narration ?? DASH}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <p className="text-muted-foreground">Belum ada scene.</p>}
      </Section>

      <Section title="Versi">
        {versions.length ? (
          <ul className="flex flex-col gap-1 text-sm">
            {versions.map((v) => {
              const r = p.runs.find((x) => x.runId === v.runId);
              return (
                <li key={v.file} className="flex flex-wrap items-center gap-x-3">
                  <time dateTime={r?.endedAt ?? undefined}>{formatDate(r?.endedAt, true)}</time>
                  <a href={mediaUrl(v.file)} className="underline underline-offset-4">{v.file.split("/").at(-1)}</a>
                  {v === versions[0] && <Badge variant="secondary">Terbaru</Badge>}
                </li>
              );
            })}
          </ul>
        ) : <p className="text-muted-foreground">Belum ada video sukses.</p>}
      </Section>

      <Section title="Riwayat run">
        {p.runs.length ? (
          <ul className="flex flex-col gap-2 text-sm">
            {p.runs.map((r) => (
              <li key={r.runId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {r.status && r.status in STATUS_LABELS ? <StatusBadge status={r.status as DisplayStatus} /> : <Badge variant="destructive">Data rusak</Badge>}
                <time dateTime={r.startedAt ?? undefined}>{formatDate(r.startedAt, true)}</time>
                <Link href={`/eksekusi/${encodeURIComponent(p.slug)}/${encodeURIComponent(r.runId)}`} className="underline underline-offset-4">{r.runId}</Link>
              </li>
            ))}
          </ul>
        ) : <p className="text-muted-foreground">Belum ada run.</p>}
      </Section>

      <Section title="Riwayat sesi">
        {p.sessions.length ? (
          <ul className="flex flex-col gap-1 text-sm">
            {p.sessions.map((s: { date: string; summary: string }, i: number) => (
              <li key={i}>
                <span className="text-muted-foreground">{s.date || DASH}</span> · {s.summary || DASH}
              </li>
            ))}
          </ul>
        ) : <p className="text-muted-foreground">Belum ada riwayat sesi.</p>}
      </Section>
    </div>
  );
}
