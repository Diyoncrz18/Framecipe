import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveButton } from "@/components/flow-editor/archive-button";
import { FlowForm } from "@/components/flow-editor/flow-form";
import { readFlow } from "@/core/flows.mjs";
import { ROOT } from "@/lib/root";
import { loadEditorData } from "../editor-data";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = readFlow(ROOT, id);
  if (!r) notFound();
  const back = <Link href="/alur" className="text-sm underline underline-offset-2">Kembali ke daftar alur</Link>;

  // A file that cannot be read has nothing to edit: say what is wrong and offer the way out (NFR-07).
  if (!r.flow) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <h1 className="text-2xl font-semibold">Data rusak</h1>
        <div role="alert" className="flex max-w-prose flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium text-destructive"><CircleAlert aria-hidden="true" className="size-4 shrink-0" />Alur {id} tidak bisa dibuka.</p>
          <ul className="list-disc pl-6">{r.errors.map((m) => <li key={m}>{m}</li>)}</ul>
          <p>Perbaiki file <code>flows/{id}/flow.json</code> dengan editor teks, atau arsipkan alur ini.</p>
        </div>
        <div><ArchiveButton id={id} name={id} /></div>
      </div>
    );
  }

  // The file may be valid JSON with wrong types (hand-edited): FlowForm coerces it, and `r.errors` says what is wrong.
  const flow = r.flow as { name?: unknown; version?: unknown };
  const version = Number.isInteger(flow.version) ? (flow.version as number) : 0;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        {back}
        <h1 className="text-2xl font-semibold">Ubah alur</h1>
        <p className="text-sm text-muted-foreground">{typeof flow.name === "string" && flow.name ? flow.name : id}</p>
      </div>
      {/* key: a different flow or version is a new form, not an edit of the old state */}
      <FlowForm key={`${id}@${version}`} mode="update" initial={flow} folderId={id} data={loadEditorData()} version={version} initialErrors={r.errors} />
    </div>
  );
}
