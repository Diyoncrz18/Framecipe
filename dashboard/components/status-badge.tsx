import {
  Ban, CircleCheck, CirclePause, CircleX, Hourglass, LoaderCircle, ShieldAlert, TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/core/labels.mjs";
import { cn } from "@/lib/utils";

export type DisplayStatus = keyof typeof STATUS_LABELS;

const AMBER = "bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200";
const RED = "bg-red-100 dark:bg-red-900/40 text-red-900 dark:text-red-300";

// Every status carries an icon and a text label, never color alone (NFR-10).
const STYLES: Record<DisplayStatus, { icon: LucideIcon; className: string }> = {
  running: { icon: LoaderCircle, className: "bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200" },
  waiting: { icon: Hourglass, className: AMBER },
  "waiting-permission": { icon: ShieldAlert, className: AMBER },
  stopped: { icon: CirclePause, className: AMBER },
  success: { icon: CircleCheck, className: "bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-300" },
  failed: { icon: CircleX, className: RED },
  cancelled: { icon: Ban, className: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200" },
  abandoned: { icon: TriangleAlert, className: RED },
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const { icon: Icon, className } = STYLES[status];
  return (
    <Badge variant="outline" className={cn("border-transparent", className)}>
      <Icon aria-hidden="true" className={status === "running" ? "motion-safe:animate-spin" : undefined} />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
