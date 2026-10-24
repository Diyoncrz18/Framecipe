import { TriangleAlert } from "lucide-react";
import { durationSegments } from "@/core/flow-form.mjs";
import type { Scene } from "./types";

const color = (i: number) => `hsl(${(210 + i * 53) % 360} 50% 32%)`;
const round2 = (n: number) => Math.round(n * 100) / 100;

// One segment per scene, sized by its share of the total. The bar is decoration: the legend carries the same numbers as text.
export function DurationBar({ scenes, target }: { scenes: Scene[]; target: number | "" }) {
  const segments: { label: string; seconds: number; percent: number }[] = durationSegments(scenes);
  const total = round2(segments.reduce((sum, s) => sum + s.seconds, 0));
  const goal = Number(target) || 0;
  // Same rule as flowWarnings in core/contracts.mjs (more than 10% apart); that module needs zod, which the browser bundle should not carry.
  const off = goal > 0 && Math.abs(total - goal) / goal > 0.1;

  return (
    <div className="flex flex-col gap-2">
      <div aria-hidden="true" className="flex h-6 w-full overflow-hidden rounded-md border bg-muted">
        {segments.map((s, i) => (
          <div key={scenes[i].key} className="h-full min-w-0 overflow-hidden px-1 text-xs leading-6 whitespace-nowrap text-white" style={{ width: `${s.percent}%`, backgroundColor: color(i) }}>
            {s.percent >= 12 ? s.label : ""}
          </div>
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {segments.map((s, i) => (
          <li key={scenes[i].key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: color(i) }} />
            {s.label || `Scene ${i + 1}`}: {s.seconds} dtk ({s.percent}%)
          </li>
        ))}
      </ul>
      <p className="text-sm font-medium">Total {total} dtk dari target {goal} dtk</p>
      {/* Always in the page, so a screen reader announces the text when it appears. */}
      <p role="status" className="flex items-center gap-1.5 text-sm text-amber-900 dark:text-amber-200">
        {off && (
          <>
            <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
            Peringatan: total durasi scene selisih lebih dari 10% dari target ({round2(total - goal)} dtk).
          </>
        )}
      </p>
    </div>
  );
}
