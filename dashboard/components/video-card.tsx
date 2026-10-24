import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, type DisplayStatus } from "@/components/status-badge";
import { PHASE_LABELS, STATUS_LABELS } from "@/core/labels.mjs";
import type { ProjectSummary } from "@/core/projects.mjs";
import { formatDate, formatDuration } from "@/lib/format";
import { mediaUrl } from "@/lib/media";

const PREVIEW = "aspect-video w-full bg-muted object-cover";

function Preview({ project }: { project: ProjectSummary }) {
  if (project.thumbnail) {
    // eslint-disable-next-line @next/next/no-img-element -- served by our own range-aware route, next/image has nothing to optimize
    return <img src={mediaUrl(project.thumbnail)} alt="" className={PREVIEW} />;
  }
  if (project.video) {
    // #t=0.1 makes the browser paint a frame instead of a black box.
    return <video src={`${mediaUrl(project.video.file)}#t=0.1`} preload="metadata" muted playsInline className={PREVIEW} />;
  }
  return <div className={`${PREVIEW} flex items-center justify-center text-sm text-muted-foreground`}>Belum ada video</div>;
}

// A broken project.json shows as a card with its folder name only; the other cards are unaffected (NFR-07).
export function VideoCard({ project, flowName }: { project: ProjectSummary; flowName: string | null }) {
  if (project.corrupt) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader>
          <CardTitle>Data rusak</CardTitle>
          <p className="break-all text-sm text-muted-foreground">Folder: {project.slug}</p>
        </CardHeader>
      </Card>
    );
  }
  const status = project.latestStatus && project.latestStatus in STATUS_LABELS ? (project.latestStatus as DisplayStatus) : null;
  const phase = project.phase ? (PHASE_LABELS as Record<string, string>)[project.phase] ?? project.phase : null;
  return (
    // The title link is stretched over the whole card (after:inset-0), so the card is one keyboard stop.
    <Card className="relative pt-0 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring">
      <Preview project={project} />
      <CardHeader>
        <CardTitle className="break-words">
          <Link href={`/video/${encodeURIComponent(project.slug)}`} className="outline-none after:absolute after:inset-0">
            {project.title}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{project.flow ? flowName ?? project.flow : "Tanpa alur"}</Badge>
          {phase && <Badge variant="outline">{phase}</Badge>}
          {status && <StatusBadge status={status} />}
        </div>
        <p className="text-sm text-muted-foreground">
          {project.video?.durationSeconds != null ? `${formatDuration(project.video.durationSeconds)} · ` : ""}
          <time dateTime={project.updated}>{formatDate(project.updated)}</time>
        </p>
      </CardContent>
    </Card>
  );
}
