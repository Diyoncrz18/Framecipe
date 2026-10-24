import Link from "next/link";
import { ActiveRunCard } from "@/components/active-run-card";
import { AutoRefresh } from "@/components/auto-refresh";
import { CopyButton } from "@/components/copy-button";
import { CreateVideoForm } from "@/components/create-video-form";
import { CoreChecks, Mark } from "@/components/health-checks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VideoCard } from "@/components/video-card";
import { listProjects } from "@/core/projects.mjs";
import { readActiveRun } from "@/core/run-store.mjs";
import { readRunDetail } from "@/core/runs.mjs";
import { flowName } from "@/lib/flow-name";
import { loadFlowOptions } from "@/lib/flow-options";
import { cachedHealth } from "@/lib/health-cache";
import { ROOT } from "@/lib/root";

export default function Home() {
  const health = cachedHealth();
  const latest = listProjects(ROOT).slice(0, 6); // newest first
  const active = readActiveRun(ROOT);
  const detail = active ? readRunDetail(ROOT, active.project, active.runId) : null;

  return (
    <div className="flex flex-col gap-8">
      {/* Always on, not only while a run is live: an idle Beranda must pick up a run that starts later (health is cached, so a refresh is cheap). */}
      <AutoRefresh intervalMs={2000} />
      <h1 className="text-2xl font-semibold">Beranda</h1>

      <ActiveRunCard active={active} detail={detail} />

      <Card>
        <CardHeader><CardTitle><h2>Buat video</h2></CardTitle></CardHeader>
        <CardContent><CreateVideoForm flows={loadFlowOptions()} /></CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle><h2>Mulai</h2></CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p>Buka Claude Code di folder repo utama, bukan worktree.</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="break-all rounded bg-muted px-2 py-1 text-sm">{ROOT}</code>
              <CopyButton text={ROOT} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle><h2>Kesehatan</h2></CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ul className="grid gap-1.5 sm:grid-cols-2">
              <CoreChecks health={health} />
              {health.isWorktree && (
                <li className="sm:col-span-2"><Mark ok={false}>Ini worktree: run.mjs menolak berjalan di sini.</Mark></li>
              )}
            </ul>
            {/* Only the count: keys and values never leave the server (NFR-03). */}
            <p className="text-sm text-muted-foreground">{`API key terisi: ${health.env.filter((k) => k.present).length} dari ${health.env.length}`}</p>
            <Link href="/pengaturan" className="text-sm underline underline-offset-2">Detail di Pengaturan</Link>
          </CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="video-terbaru">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 id="video-terbaru" className="text-lg font-semibold">Video terbaru</h2>
          {latest.length > 0 && <Link href="/video" className="text-sm underline underline-offset-2">Lihat semua</Link>}
        </div>
        {latest.length === 0 ? (
          <p className="text-muted-foreground">Belum ada video.</p>
        ) : (
          <ul className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(16rem,1fr))]">
            {latest.map((p) => (
              <li key={p.slug} className="grid">
                <VideoCard project={p} flowName={p.flow ? flowName(p.flow) : null} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
