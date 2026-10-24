import { CircleAlert, CircleCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { ArchiveButton } from "@/components/flow-editor/archive-button";
import { DuplicateButton } from "@/components/flow-editor/duplicate-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listFlows } from "@/core/flows.mjs";
import { formatDate } from "@/lib/format";
import { ROOT } from "@/lib/root";
import { duplicateFlowAction } from "./actions";

type Flow = ReturnType<typeof listFlows>[number];

const DASH = "—";
const WRAP = "whitespace-normal align-top";
const HEADERS = ["Nama", "Template", "Brand", "Format", "Scene", "Durasi (total/target)", "Video dibuat", "Terakhir dipakai", "Status", "Aksi"];

// Every status has an icon and text, never color alone (NFR-10). A broken file wins over the rest: nothing else can be said about it.
function status(f: Flow): { label: string; icon: LucideIcon; className: string; detail?: string } {
  if (f.corrupt) return { label: "Data rusak", icon: CircleAlert, className: "bg-red-100 dark:bg-red-900/40 text-red-900 dark:text-red-300", detail: f.errors[0] };
  if (f.errors.length) return { label: "Tidak valid", icon: CircleAlert, className: "bg-red-100 dark:bg-red-900/40 text-red-900 dark:text-red-300", detail: f.errors[0] };
  if (f.warnings.length) return { label: "Peringatan", icon: TriangleAlert, className: "bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200", detail: f.warnings[0] };
  return { label: "Valid", icon: CircleCheck, className: "bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-300" };
}

export default function Page() {
  const flows = listFlows(ROOT);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Alur</h1>
        <Link href="/alur/baru" className={buttonVariants()}>Buat alur</Link>
      </div>

      {flows.length === 0 ? (
        <p className="text-muted-foreground">Belum ada alur. Buat alur pertama dengan tombol Buat alur.</p>
      ) : (
        <Table aria-label="Daftar alur">
          <TableHeader>
            <TableRow>{HEADERS.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {flows.map((f) => {
              const s = status(f);
              const Icon = s.icon;
              return (
                <TableRow key={f.id}>
                  <TableCell className={`${WRAP} font-medium`}>
                    <Link href={`/alur/${encodeURIComponent(f.id)}`} className="underline underline-offset-2">{f.name}</Link>
                    {f.name !== f.id && <span className="block text-xs font-normal text-muted-foreground">{f.id}</span>}
                  </TableCell>
                  <TableCell className={WRAP}>{f.template ?? DASH}</TableCell>
                  <TableCell className={WRAP}>{f.brand ?? DASH}</TableCell>
                  <TableCell className={WRAP}>{f.aspectRatio ?? DASH}</TableCell>
                  <TableCell className={WRAP}>{f.corrupt ? DASH : f.sceneCount}</TableCell>
                  <TableCell className={WRAP}>{f.corrupt ? DASH : `${f.totalSeconds}/${f.targetSeconds} dtk`}</TableCell>
                  <TableCell className={WRAP}>{f.videoCount}</TableCell>
                  <TableCell className={WRAP}>{formatDate(f.lastUsedAt, true)}</TableCell>
                  <TableCell className={`${WRAP} min-w-40`}>
                    <div className="flex flex-col items-start gap-1">
                      <Badge variant="outline" className={`border-transparent ${s.className}`}>
                        <Icon aria-hidden="true" />
                        {s.label}
                      </Badge>
                      {s.detail && <span className="max-w-64 text-xs text-muted-foreground">{s.detail}</span>}
                    </div>
                  </TableCell>
                  <TableCell className={WRAP}>
                    <div className="flex gap-2">
                      {/* A flow with errors cannot be copied (duplicateFlow needs a usable one); it can still be fixed or archived. */}
                      <form action={duplicateFlowAction.bind(null, f.id)}>
                        <DuplicateButton name={f.name} disabled={f.errors.length > 0} />
                      </form>
                      <ArchiveButton id={f.id} name={f.name} />
                    </div>
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
