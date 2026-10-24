"use client";

import { CircleAlert, Hourglass, ShieldAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { markFailedAction, repeatRequestAction } from "@/app/eksekusi/actions";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { STAGE_LABELS } from "@/core/labels.mjs";
import { mediaUrl } from "@/lib/media";

const BOX = "flex flex-col gap-3 rounded-lg border p-4 text-sm";
const PROMPT = "break-all rounded bg-muted px-2 py-1 text-sm";

function ErrorList({ errors }: { errors: string[] }) {
  return (
    <div role="alert" className="text-sm text-destructive">
      {errors.map((m, i) => <p key={i} className="flex items-start gap-1.5"><CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{m}</p>)}
    </div>
  );
}

// Closes a run nobody is working on (stopped or abandoned) as failed. The server refuses any other status.
function MarkFailedButton({ project, runId }: { project: string; runId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function confirm() {
    setPending(true);
    setErrors([]);
    try {
      const r = await markFailedAction(project, runId);
      if (r.ok) {
        setOpen(false);
        router.refresh(); // an abandoned run is not auto-refreshed
      } else {
        setErrors(r.errors);
      }
    } catch {
      setErrors(["Gagal menandai run. Coba lagi."]);
    }
    setPending(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setErrors([]); }}>
      <DialogTrigger render={<Button variant="outline" className="w-fit" />}>Tandai gagal</DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Tandai run ini gagal?</DialogTitle>
          <DialogDescription>Run ditutup dengan status Gagal. Tidak ada file yang dihapus, dan Anda tetap bisa memperbaikinya dengan prompt perbaikan.</DialogDescription>
        </DialogHeader>
        {errors.length > 0 && <ErrorList errors={errors} />}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
          <Button disabled={pending} onClick={confirm}>Tandai gagal</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// A new request with the topic of this run, shown as the line to paste into Claude Code.
function RepeatButton({ project, runId }: { project: string; runId: string }) {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [prompt, setPrompt] = useState<string | null>(null);

  async function repeat() {
    setPending(true);
    setErrors([]);
    setPrompt(null);
    try {
      const r = await repeatRequestAction(project, runId);
      if (r.ok) setPrompt(r.prompt);
      else setErrors(r.errors);
    } catch {
      setErrors(["Gagal membuat prompt. Coba lagi."]);
    }
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" className="w-fit" disabled={pending} onClick={repeat}>Ulang dengan topik sama</Button>
      {errors.length > 0 && <ErrorList errors={errors} />}
      {prompt && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <code className={PROMPT}>{prompt}</code>
            <CopyButton text={prompt} />
          </div>
          <p>Tempel di Claude Code yang dibuka di folder repo utama (bukan worktree).</p>
        </div>
      )}
      <p role="status" className="sr-only">{prompt ? `Prompt siap: ${prompt}` : ""}</p>
    </div>
  );
}

function Notice({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return <p className="flex items-start gap-2"><Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{children}</p>;
}

export type RunPanelProps = {
  status: string; // display status
  stored: string; // status in run.json: a stale run that was not swept yet is still "running" there
  project: string;
  runId: string;
  waitReason: string | null;
  error: { stage: string; message: string } | null;
  lastError: { ts: string; summary: string; error: string } | null;
  retryPrompt: string;
  videoFile: string | null; // repo-relative, only when the run succeeded and the file exists
  children?: ReactNode; // the voice-over script, already rendered on the server, for the waiting panel
};

/** The panel that goes with the run's status. Nothing for running and cancelled: the stage bar and the timeline say enough. */
export function RunPanel({ status, stored, project, runId, waitReason, error, lastError, retryPrompt, videoFile, children }: RunPanelProps) {
  const amber = `${BOX} border-amber-300 bg-amber-50 text-amber-950`;

  if (status === "waiting") {
    return (
      <div className={amber}>
        <Notice icon={Hourglass}>Claude menunggu persetujuan Anda{waitReason ? `: ${waitReason}` : ""}. Balas di chat Claude Code.</Notice>
        {children && <div className="rounded-lg bg-background p-3 text-foreground">{children}</div>}
      </div>
    );
  }
  if (status === "waiting-permission") {
    return <div className={amber}><Notice icon={ShieldAlert}>Claude menunggu izin. Buka Claude Code, lalu setujui atau tolak permintaannya.</Notice></div>;
  }
  if (status === "stopped") {
    return (
      <div className={amber}>
        <Notice icon={TriangleAlert}>Claude berhenti, tetapi run belum selesai. Cek chat Claude Code.</Notice>
        <MarkFailedButton project={project} runId={runId} />
      </div>
    );
  }
  if (status === "abandoned" && stored === "running") {
    return (
      <div className={amber}>
        <Notice icon={TriangleAlert}>Tidak ada aktivitas lebih dari 15 menit.</Notice>
        <MarkFailedButton project={project} runId={runId} />
      </div>
    );
  }
  if (status === "failed" || status === "abandoned") {
    return (
      <div className={`${BOX} border-destructive/40 bg-destructive/5`}>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-destructive">
          <CircleAlert aria-hidden="true" className="size-5 shrink-0" />
          {status === "failed" ? "Run gagal" : "Run terhenti"}
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
          <dt className="font-medium text-muted-foreground">Tahap</dt>
          <dd>{(STAGE_LABELS as Record<string, string>)[error?.stage ?? ""] ?? error?.stage ?? "—"}</dd>
          <dt className="font-medium text-muted-foreground">Pesan</dt>
          <dd className="break-words">{error?.message || "—"}</dd>
          <dt className="font-medium text-muted-foreground">Event terakhir sebelum gagal</dt>
          <dd className="break-words">{lastError ? <>{lastError.summary}{lastError.error ? ` (${lastError.error})` : ""}</> : "—"}</dd>
        </dl>
        <div className="flex flex-wrap items-center gap-2">
          <code className={PROMPT}>{retryPrompt}</code>
          <CopyButton text={retryPrompt} label="Salin prompt perbaikan" />
        </div>
        <RepeatButton project={project} runId={runId} />
      </div>
    );
  }
  if (status === "success") {
    return (
      <div className="flex flex-col items-start gap-3">
        {videoFile
          ? <video controls preload="metadata" src={mediaUrl(videoFile)} className="max-h-[70vh] w-full max-w-3xl rounded-lg bg-black" />
          : <p className="text-muted-foreground">Berkas video run ini tidak ditemukan.</p>}
        <Link href={`/video/${encodeURIComponent(project)}`} className="text-sm underline underline-offset-4">Buka halaman video</Link>
      </div>
    );
  }
  return null;
}
