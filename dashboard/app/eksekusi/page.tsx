import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { StatusBadge, type DisplayStatus } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listRuns } from "@/core/runs.mjs";
import { flowName } from "@/lib/flow-name";
import { formatDate, formatDuration } from "@/lib/format";
import { isLive } from "@/lib/run-status";
import { ROOT } from "@/lib/root";

const DASH = "—";
const WRAP = "whitespace-normal align-top";
const HEADERS = ["Status", "Topik", "Alur", "Proyek", "Mulai", "Durasi", "Pemicu", "Perbaikan dari"];
const TRIGGERS: Record<string, string> = { chat: "Chat", dashboard: "Dashboard" };

const detailHref = (project: string, runId: string) => `/eksekusi/${encodeURIComponent(project)}/${encodeURIComponent(runId)}`;

export default function Page() {
  const runs = listRuns(ROOT);
  const names = new Map<string, string>(); // one flow.json read per flow, not per row

  return (
    <div className="flex flex-col gap-6">
      {runs.some((r) => isLive(r.displayStatus)) && <AutoRefresh intervalMs={2000} />}
      <h1 className="text-2xl font-semibold">Eksekusi</h1>

      {runs.length === 0 ? (
        <p className="text-muted-foreground">Belum ada eksekusi.</p>
      ) : (
        <Table aria-label="Daftar eksekusi">
          <TableHeader>
            <TableRow>{HEADERS.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((r) => {
              const link = detailHref(r.project, r.runId);
              // A broken run.json is one "Data rusak" row; the other rows are unaffected (NFR-07).
              if (r.corrupt) {
                return (
                  <TableRow key={`${r.project}/${r.runId}`}>
                    <TableCell className={WRAP}><Badge variant="destructive">Data rusak</Badge></TableCell>
                    <TableCell className={WRAP}><Link href={link} className="underline underline-offset-2">{r.runId}</Link></TableCell>
                    <TableCell className={WRAP}>{DASH}</TableCell>
                    <TableCell className={WRAP}><Link href={`/video/${encodeURIComponent(r.project)}`} className="underline underline-offset-2">{r.project}</Link></TableCell>
                    <TableCell className={WRAP} colSpan={4}>run.json tidak bisa dibaca. Perbaiki file itu secara manual.</TableCell>
                  </TableRow>
                );
              }
              if (r.flow && !names.has(r.flow)) names.set(r.flow, flowName(r.flow));
              return (
                <TableRow key={`${r.project}/${r.runId}`}>
                  <TableCell className={WRAP}><StatusBadge status={r.displayStatus as DisplayStatus} /></TableCell>
                  <TableCell className={`${WRAP} font-medium`}>
                    <Link href={link} className="underline underline-offset-2">{r.topic || r.runId}</Link>
                  </TableCell>
                  <TableCell className={WRAP}>{r.flow ? names.get(r.flow) : DASH}</TableCell>
                  <TableCell className={WRAP}>
                    <Link href={`/video/${encodeURIComponent(r.project)}`} className="underline underline-offset-2">{r.project}</Link>
                  </TableCell>
                  <TableCell className={WRAP}><time dateTime={r.startedAt ?? undefined}>{formatDate(r.startedAt, true)}</time></TableCell>
                  {/* An unfinished run that is not live (terhenti) has no end and no meaningful length. */}
                  <TableCell className={WRAP}>
                    {r.endedAt ? formatDuration((r.durationMs ?? 0) / 1000) : isLive(r.displayStatus) ? "berjalan" : DASH}
                  </TableCell>
                  <TableCell className={WRAP}>{TRIGGERS[r.trigger ?? ""] ?? r.trigger ?? DASH}</TableCell>
                  <TableCell className={WRAP}>
                    {r.retryOf
                      ? <Link href={detailHref(r.project, r.retryOf)} className="underline underline-offset-2">{r.retryOf}</Link>
                      : DASH}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
