import { Circle, CircleCheck, CircleX, LoaderCircle, SkipForward, type LucideIcon } from "lucide-react";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Stage = { name: string; label: string; state: "done" | "active" | "skipped" | "failed" | "pending"; durationMs: number | null };

// Every state has an icon and a word, never color alone (NFR-10).
const STATES: Record<Stage["state"], { icon: LucideIcon; text: string; className: string }> = {
  done: { icon: CircleCheck, text: "selesai", className: "text-green-800" },
  active: { icon: LoaderCircle, text: "aktif", className: "border-blue-300 bg-blue-50 text-blue-900" },
  skipped: { icon: SkipForward, text: "dilewati", className: "text-muted-foreground" },
  failed: { icon: CircleX, text: "gagal", className: "border-red-300 bg-red-50 text-red-900" },
  pending: { icon: Circle, text: "menunggu", className: "text-muted-foreground" },
};

export function StageBar({ stages }: { stages: Stage[] }) {
  return (
    <ol aria-label="Tahap eksekusi" className="flex flex-wrap gap-2">
      {stages.map((s) => {
        const { icon: Icon, text, className } = STATES[s.state];
        return (
          <li key={s.name} aria-current={s.state === "active" ? "step" : undefined} className={cn("flex min-w-28 flex-1 flex-col gap-0.5 rounded-lg border p-2 text-sm", className)}>
            <span className="font-medium">{s.label}</span>
            <span className="flex items-center gap-1 text-xs">
              <Icon aria-hidden="true" className={cn("size-3.5 shrink-0", s.state === "active" && "motion-safe:animate-spin")} />
              {text}
            </span>
            <span className="text-xs tabular-nums">{s.durationMs != null ? formatDuration(s.durationMs / 1000) : "—"}</span>
          </li>
        );
      })}
    </ol>
  );
}
