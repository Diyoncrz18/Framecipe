import { Check } from "lucide-react";
import Link from "next/link";
import { StatusBadge, type DisplayStatus } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STAGE_LABELS } from "@/core/labels.mjs";
import type { readRunDetail } from "@/core/runs.mjs";
import { flowName } from "@/lib/flow-name";
import { formatDuration } from "@/lib/format";

type Detail = NonNullable<ReturnType<typeof readRunDetail>>;

const detailHref = (project: string, runId: string) => `/eksekusi/${encodeURIComponent(project)}/${encodeURIComponent(runId)}`;
const elapsedSeconds = (startedAt: string, endedAt: string | null) => ((endedAt ? Date.parse(endedAt) : Date.now()) - Date.parse(startedAt)) / 1000;

// BRD-01. `detail` is null when the active marker points at a run.json that is missing or broken (NFR-07).
// `children`: extra live detail of a readable run (the stage bar and recent activity on /alur), shown above the link.
export function ActiveRunCard({ active, detail, children }: { active: { project: string; runId: string } | null; detail: Detail | null; children?: React.ReactNode }) {
  const link = active && (
    <Link href={detailHref(active.project, active.runId)} className="w-fit text-sm underline underline-offset-2">Detail</Link>
  );
  let body;
  if (!active) {
    body = <p className="text-muted-foreground">Tidak ada run aktif.</p>;
  } else if (!detail) {
    body = (
      <>
        <p role="alert" className="text-sm text-destructive">Data rusak: run.json untuk {active.project}/{active.runId} tidak bisa dibaca.</p>
        {link}
      </>
    );
  } else {
    const { run, summary } = detail;
    const skills: string[] = summary.skillsUsed;
    body = (
      <>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium break-words">{run.topic || run.runId}</p>
          {/* Only the badge is live: the running time changes on every refresh and would be announced each time. */}
          <div role="status"><StatusBadge status={detail.displayStatus as DisplayStatus} /></div>
        </div>
        <p className="text-sm text-muted-foreground">
          Alur {flowName(run.flow)} v{run.flowVersion} · tahap {STAGE_LABELS[run.stage as keyof typeof STAGE_LABELS]}
          {" · "}berjalan {formatDuration(elapsedSeconds(run.startedAt, run.endedAt))}
        </p>
        {skills.length ? (
          <ul aria-label="Skill dipakai" className="flex flex-wrap gap-1.5">
            {skills.map((s) => (
              <li key={s}><Badge variant="secondary" className="h-auto whitespace-normal break-all"><Check aria-hidden="true" />{s}</Badge></li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Belum ada skill dipakai.</p>}
        {children}
        {link}
      </>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle><h2>Run aktif</h2></CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">{body}</CardContent>
    </Card>
  );
}
