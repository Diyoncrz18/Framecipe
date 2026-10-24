import {
  Ban, CircleCheck, CirclePause, CircleX, Hourglass, LoaderCircle, ShieldAlert, TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/core/labels.mjs";
import { cn } from "@/lib/utils";

export type DisplayStatus = keyof typeof STATUS_LABELS;

const AMBER = "bg-amber-100 text-amber-900";
const RED = "bg-red-100 text-red-900";

// Every status carries an icon and a text label, never color alone (NFR-10).
const STYLES: Record<DisplayStatus, { icon: LucideIcon; className: string }> = {
  running: { icon: LoaderCircle, className: "bg-blue-100 text-blue-900" },
  waiting: { icon: Hourglass, className: AMBER },
  "waiting-permission": { icon: ShieldAlert, className: AMBER },
  stopped: { icon: CirclePause, className: AMBER },
  success: { icon: CircleCheck, className: "bg-green-100 text-green-900" },
  failed: { icon: CircleX, className: RED },
  cancelled: { icon: Ban, className: "bg-gray-100 text-gray-800" },
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
