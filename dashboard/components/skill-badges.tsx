import { CircleAlert, CircleCheck, CircleX, KeyRound, Wrench, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Ready } from "@/lib/skill-catalog";

const AMBER = "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200";
// Icon plus text, never color alone (NFR-10).
const READY: Record<Ready, { label: string; Icon: LucideIcon; className: string }> = {
  ready: { label: "Siap dipakai", Icon: CircleCheck, className: "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-200" },
  partial: { label: "Sebagian key terisi", Icon: CircleAlert, className: AMBER },
  "needs-key": { label: "Perlu API key", Icon: KeyRound, className: AMBER },
  "needs-setup": { label: "Perlu prasyarat", Icon: Wrench, className: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200" },
  missing: { label: "File tidak ada", Icon: CircleX, className: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200" },
};

export function ReadinessBadge({ ready }: { ready: Ready }) {
  const { label, Icon, className } = READY[ready];
  return <Badge variant="outline" className={`border-transparent ${className}`}><Icon aria-hidden="true" />{label}</Badge>;
}

// Table summary of the API keys an item needs. Only filled or empty is known; the values stay on the server (NFR-03).
export function ApiKeySummary({ envVars, filled }: { envVars: string[]; filled: Set<string> }) {
  if (!envVars.length) return <span className="text-muted-foreground">Tidak perlu</span>;
  const empty = envVars.filter((k) => !filled.has(k)).length;
  return empty ? (
    <span className="flex items-center gap-1 text-amber-900 dark:text-amber-200">
      <KeyRound aria-hidden="true" className="size-3.5 shrink-0" />Perlu · {empty} kosong
    </span>
  ) : (
    <span className="flex items-center gap-1 text-green-800 dark:text-green-300">
      <CircleCheck aria-hidden="true" className="size-3.5 shrink-0" />Perlu · terisi
    </span>
  );
}

export function ApiKeyList({ envVars, filled }: { envVars: string[]; filled: Set<string> }) {
  return (
    <ul className="flex flex-col gap-1">
      {envVars.map((key) =>
        filled.has(key) ? (
          <li key={key} className="flex items-center gap-1.5 text-green-800 dark:text-green-300">
            <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
            <code className="text-xs break-all">{key}</code> terisi
          </li>
        ) : (
          <li key={key} className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
            <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
            <code className="text-xs break-all">{key}</code> kosong
          </li>
        ),
      )}
    </ul>
  );
}
