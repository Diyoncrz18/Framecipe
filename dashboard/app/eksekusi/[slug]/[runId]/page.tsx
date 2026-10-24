import { Check } from "lucide-react";
import fs from "node:fs";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { Markdown } from "@/components/markdown";
import { RunPanel } from "@/components/run-panels";
import { StageBar, type Stage } from "@/components/stage-bar";
import { StatusBadge, type DisplayStatus } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Timeline, type TimelineEvent } from "@/components/timeline";
import { resolveInside } from "@/core/paths.mjs";
import { retryPrompt } from "@/core/requests.mjs";
import { listRuns, readRunDetail } from "@/core/runs.mjs";
import { formatDuration } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { isLive } from "@/lib/run-status";
import { ROOT } from "@/lib/root";

type Params = { slug: string; runId: string };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

// A group of chips with its own heading; `check` marks what happened (a tick, not only a color).
function Chips({ title, items, check }: { title: string; items: string[]; check?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {items.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((s) => (
            <li key={s}><Badge variant="secondary" className="h-auto whitespace-normal break-all">{check && <Check aria-hidden="true" />}{s}</Badge></li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted-foreground">—</p>}
    </div>
  );
}

// The run's file only counts when it is really there: finish never leaves a success without it, but the folder can be edited by hand.
function videoOf(project: string, runId: string): string | null {
  try {
    return fs.statSync(resolveInside(ROOT, "projects", project, "out", `${runId}.mp4`)).isFile() ? `projects/${project}/out/${runId}.mp4` : null;
  } catch {
    return null;
  }
}

const elapsedMs = (startedAt: string, endedAt: string | null) => (endedAt ? Date.parse(endedAt) : Date.now()) - Date.parse(startedAt);

export default async function Page({ params }: { params: Promise<Params> }) {
  const { slug, runId } = await params;
  const d = readRunDetail(ROOT, slug, runId);

  if (!d) {
    // readRunDetail says null for a missing and for a broken run.json: only the second is a run the user can fix.
    if (!listRuns(ROOT).some((r) => r.corrupt && r.project === slug && r.runId === runId)) notFound();
    return (
      <div className="flex flex-col gap-2">
        <Link href="/eksekusi" className="text-sm text-muted-foreground underline underline-offset-4">← Semua eksekusi</Link>
        <h1 className="text-2xl font-semibold">Data rusak</h1>
        <p role="alert" className="max-w-prose rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          Data rusak: run.json untuk {slug}/{runId} tidak bisa dibaca. Perbaiki file itu secara manual.
        </p>
      </div>
    );
  }

  const { run, summary } = d;
  const frames: string[] = d.frames;
  const status = d.displayStatus as DisplayStatus;
  const ended = new Set(d.timeline.filter((e) => e.phase === "end" && e.toolUseId).map((e) => e.toolUseId));
  // A command logs a start and an end event; once it has ended, the end row (with its length) stands for both.
  const events: TimelineEvent[] = d.timeline
    .filter((e) => !(e.phase === "start" && ended.has(e.toolUseId)))
    .map((e) => ({
      ts: e.ts, type: e.type, summary: e.summary ?? "", ok: e.ok ?? null, error: e.error,
      durationMs: typeof e.detail?.durationMs === "number" ? e.detail.durationMs : undefined,
    }));

  return (
    <div className="flex flex-col gap-8">
      {isLive(status) && <AutoRefresh intervalMs={2000} />}

      <div className="flex flex-col gap-2">
        <Link href="/eksekusi" className="text-sm text-muted-foreground underline underline-offset-4">← Semua eksekusi</Link>
        <h1 className="text-2xl font-semibold break-words">{run.topic || run.runId}</h1>
        {/* Stays in the page when the status changes, so a screen reader announces the new one. */}
        <div role="status"><StatusBadge status={status} /></div>
        <p className="text-sm text-muted-foreground">
          Alur {run.flow} v{run.flowVersion} · pemicu {run.trigger} · proyek{" "}
          <Link href={`/video/${encodeURIComponent(slug)}`} className="underline underline-offset-4">{slug}</Link>
          {" · "}berjalan {formatDuration(elapsedMs(run.startedAt, run.endedAt) / 1000)}
        </p>
      </div>

      <StageBar stages={d.stages as Stage[]} />

      <RunPanel
        status={status}
        stored={run.status}
        project={slug}
        runId={runId}
        waitReason={run.waitReason}
        error={run.error}
        lastError={summary.lastError}
        retryPrompt={retryPrompt(runId)}
        videoFile={status === "success" ? videoOf(slug, runId) : null}
      >
        {d.script?.trim() ? <Markdown source={d.script} /> : null}
      </RunPanel>

      <Section title="Ringkasan">
        <div className="flex flex-col gap-4">
          <Chips title="Skill dipakai" items={summary.skillsUsed} check />
          <Chips title="Direncanakan, belum dipakai" items={summary.skillsPlannedNotUsed} />
          <Chips title="Tool Python" items={summary.pythonTools} />
          {summary.filesChanged.length ? (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">File diubah ({summary.filesChanged.length})</summary>
              <ul className="mt-2 flex flex-col gap-1 font-mono text-xs">
                {summary.filesChanged.map((f) => <li key={f} className="break-all">{f}</li>)}
              </ul>
            </details>
          ) : <p className="text-sm font-medium">File diubah (0)</p>}
          <p className="text-sm">
            Perintah: {summary.commandCount} · File dibaca: {summary.readCount} · Render: {summary.renderMs != null ? formatDuration(summary.renderMs / 1000) : "—"}
          </p>
        </div>
      </Section>

      <Section title="Prompt pemicu">
        {d.triggerPrompt
          ? <pre className="max-w-3xl overflow-x-auto rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap break-words"><code>{d.triggerPrompt}</code></pre>
          : <p className="text-muted-foreground">Prompt pemicu tidak tercatat.</p>}
      </Section>

      <Section title="Frame review">
        {frames.length ? (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {frames.map((f, i) => (
              <li key={f}>
                {/* eslint-disable-next-line @next/next/no-img-element -- served by our own range-aware route, next/image has nothing to optimize */}
                <img src={mediaUrl(f)} alt={`Frame review ${i + 1}`} className="aspect-video w-full rounded-lg border bg-muted object-cover" />
              </li>
            ))}
          </ul>
        ) : <p className="text-muted-foreground">Belum ada frame review.</p>}
      </Section>

      <Section title="Linimasa">
        <Timeline events={events} />
      </Section>
    </div>
  );
}
