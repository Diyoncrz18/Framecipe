"use client";

import { Bell, Bot, CircleX, FileText, Flag, LogIn, LogOut, MessageSquare, Sparkles, Square, Terminal, Wrench, type LucideIcon } from "lucide-react";
import { useId, useState } from "react";
import { EVENT_LABELS } from "@/core/labels.mjs";
import { formatMs } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TimelineEvent = { ts: string; type: string; summary: string; ok: boolean | null; error?: string; durationMs?: number };

const ICONS: Record<string, LucideIcon> = {
  prompt: MessageSquare, skill: Sparkles, command: Terminal, file: FileText, agent: Bot, tool: Wrench,
  notification: Bell, stop: Square, "session-start": LogIn, "session-end": LogOut, stage: Flag,
};
const SELECT = "h-8 rounded-lg border border-input bg-transparent px-2 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
const ALL = "all";

// 24-hour clock, fixed format (id-ID would print 13.53.08). The server and the browser share a machine, but the time zone is not worth a hydration warning.
function clock(ts: string) {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("en-GB", { hour12: false });
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  const id = useId();
  const [kind, setKind] = useState(ALL);
  // "Semua jenis" leaves out the tool events (every Read, Grep and Glob): they bury the rest. Picking Tool shows them.
  const shown = events.filter((e) => (kind === ALL ? e.type !== "tool" : e.type === kind));
  const hiddenTools = kind === ALL ? events.length - shown.length : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={id} className="text-sm font-medium">Jenis event</label>
          <select id={id} value={kind} onChange={(e) => setKind(e.target.value)} className={SELECT}>
            <option value={ALL}>Semua jenis</option>
            {Object.entries(EVENT_LABELS).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
          </select>
        </div>
        {hiddenTools > 0 && <p className="text-sm text-muted-foreground">{hiddenTools} event Tool disembunyikan. Pilih jenis Tool untuk melihatnya.</p>}
      </div>

      {shown.length === 0 ? (
        <p className="text-muted-foreground">{events.length === 0 ? "Belum ada event." : "Tidak ada event untuk jenis ini."}</p>
      ) : (
        <ol aria-label="Linimasa eksekusi" className="flex flex-col text-sm">
          {shown.map((e, i) => {
            const Icon = ICONS[e.type] ?? Flag;
            return (
              <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b py-1.5 last:border-0">
                <time dateTime={e.ts} suppressHydrationWarning className="tabular-nums text-muted-foreground">{clock(e.ts)}</time>
                <span className="flex w-32 shrink-0 items-center gap-1.5 font-medium">
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  {(EVENT_LABELS as Record<string, string>)[e.type] ?? e.type}
                </span>
                <span className={cn("min-w-0 flex-1 break-words", e.type === "command" && "font-mono text-xs")}>
                  {e.summary}
                  {e.ok === false && (
                    <span className="mt-0.5 flex items-start gap-1.5 font-sans text-sm text-destructive">
                      <CircleX aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                      <span><span className="font-medium">gagal</span>{e.error ? `: ${e.error}` : ""}</span>
                    </span>
                  )}
                </span>
                {e.durationMs != null && <span className="tabular-nums text-muted-foreground">{formatMs(e.durationMs)}</span>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
