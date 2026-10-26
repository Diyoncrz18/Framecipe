import { StatusBadge, type DisplayStatus } from "@/components/status-badge";
import { EventList, type TimelineEvent } from "@/components/timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { listActiveSessions } from "@/core/runs.mjs";
import { formatDate } from "@/lib/format";

type Session = ReturnType<typeof listActiveSessions>[number];

// Every Claude Code session in this repo with recent activity, video run or not (the hooks log them all).
export function SessionsCard({ sessions }: { sessions: Session[] }) {
  return (
    <Card>
      <CardHeader><CardTitle><h2>Sesi Claude Code</h2></CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">Sesi Claude Code lain di repo ini yang aktif dalam 15 menit terakhir, termasuk pekerjaan selain membuat video.</p>
        {sessions.length === 0 ? (
          <p className="text-muted-foreground">Tidak ada sesi lain yang aktif.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {sessions.map((s) => {
              const activity: TimelineEvent[] = s.activity;
              const name = s.sessionId.slice(0, 8);
              return (
                <li key={s.sessionId} className="flex min-w-0 flex-col gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="font-medium">Sesi {name}</h3>
                    <StatusBadge status={s.status as DisplayStatus} />
                    <span className="text-xs text-muted-foreground">aktivitas terakhir {formatDate(s.lastActivityAt, true)}</span>
                  </div>
                  {s.prompt && (
                    <p className="line-clamp-2 text-sm break-words"><span className="font-medium">Prompt terakhir:</span> {s.prompt}</p>
                  )}
                  {activity.length > 0 && <EventList events={activity} label={`Aktivitas sesi ${name}`} />}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
