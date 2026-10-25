"use client";

import { CircleAlert, FileImage, FilePlus, FileText, FileVideo, FolderOpen, Music, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { createRequestAction } from "@/app/actions";
import { CopyButton } from "@/components/copy-button";
import { Field } from "@/components/flow-editor/field";
import { FlowSelect, type FlowOption } from "@/components/flow-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SOURCE_KIND_LABELS } from "@/core/labels.mjs";
import { MAX_SOURCE_BYTES, MAX_SOURCE_FILES, SOURCE_ACCEPT, sourceKind } from "@/core/source-files.mjs";
import { formatBytes } from "@/lib/format";

type Kind = "video" | "audio" | "image" | "text";
const KIND_ICONS = { video: FileVideo, audio: Music, image: FileImage, text: FileText };

// A file the user picked; `stored` is its name on the server once uploaded, so a retry after an error skips it.
type Picked = { key: string; file: File; stored?: string };

const shortList = (names: string[]) => (names.length > 5 ? `${names.slice(0, 5).join(", ")}, dan ${names.length - 5} lainnya` : names.join(", "));

// Writes a request file and shows the one line to paste into Claude Code. `defaultFlow` is picked unless that flow cannot be used.
// Source files go first, one at a time, to /api/uploads; the request then names the ones still in the list.
export function CreateVideoForm({ flows, defaultFlow }: { flows: FlowOption[]; defaultFlow?: string }) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const [flow, setFlow] = useState(flows.some((f) => f.id === defaultFlow && f.valid) ? defaultFlow! : "");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [batch, setBatch] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<{ prompt: string; files: number } | null>(null);
  const [pending, setPending] = useState(false);
  const errorBox = useRef<HTMLDivElement>(null);
  const focusErrors = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const pickButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusErrors.current) errorBox.current?.focus();
    focusErrors.current = false;
  }, [errors]);

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = ""; // so the same file can be picked again after it was removed
    const next = [...picked];
    const skipped = { type: [] as string[], size: [] as string[], empty: [] as string[], over: 0 };
    for (const file of chosen) {
      const key = `${file.webkitRelativePath || file.name}|${file.size}|${file.lastModified}`;
      if (next.some((p) => p.key === key)) continue;
      if (!sourceKind(file.name)) skipped.type.push(file.name);
      else if (file.size > MAX_SOURCE_BYTES) skipped.size.push(file.name);
      else if (file.size === 0) skipped.empty.push(file.name);
      else if (next.length >= MAX_SOURCE_FILES) skipped.over++;
      else next.push({ key, file });
    }
    setPicked(next);
    setErrors([
      skipped.type.length ? `Jenis file tidak didukung, dilewati: ${shortList(skipped.type)}.` : "",
      skipped.size.length ? `Lebih dari 2 GB, dilewati: ${shortList(skipped.size)}.` : "",
      skipped.empty.length ? `File kosong, dilewati: ${shortList(skipped.empty)}.` : "",
      skipped.over ? `Maksimal ${MAX_SOURCE_FILES} file: ${skipped.over} file tidak ditambahkan.` : "",
    ].filter(Boolean));
  }

  function remove(key: string) {
    setPicked(picked.filter((p) => p.key !== key));
    pickButton.current?.focus(); // the removed row took the focused button with it
  }

  // Sends the picked files the server does not have yet into one upload folder. Returns an error message at the first failure.
  async function uploadPicked(): Promise<{ batch: string | null; names: string[] } | string> {
    let folder = batch;
    let list = picked;
    for (const [i, p] of picked.entries()) {
      if (p.stored) continue;
      setProgress(`Mengunggah file ${i + 1} dari ${picked.length}: ${p.file.name} (${formatBytes(p.file.size)})…`);
      const query = new URLSearchParams({ name: p.file.name, ...(folder ? { batch: folder } : {}) });
      const r = await fetch(`/api/uploads?${query}`, { method: "POST", body: p.file }).then((res) => res.json()).catch(() => null);
      if (!r?.ok) return r?.error ?? `File "${p.file.name}" gagal diunggah. Coba lagi.`;
      folder = r.batch as string;
      list = list.map((x) => (x.key === p.key ? { ...x, stored: r.name as string } : x));
      setBatch(folder);
      setPicked(list);
    }
    return { batch: folder, names: list.map((p) => p.stored!) };
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    // The server checks everything too; this only keeps an empty pick from reading 'Alur "" tidak ditemukan.'
    const missing = [!flow && "Pilih alur.", !topic.trim() && "Topik wajib diisi."].filter((m) => m !== false);
    if (missing.length) {
      focusErrors.current = true;
      setErrors(missing);
      return;
    }
    setPending(true);
    setResult(null);
    try {
      const sent = await uploadPicked();
      setProgress("Membuat prompt…");
      const r = typeof sent === "string" ? { ok: false as const, errors: [sent] } : await createRequestAction({ flow, topic, notes, uploads: sent.batch, files: sent.names });
      focusErrors.current = !r.ok;
      setErrors(r.ok ? [] : r.errors);
      if (r.ok && typeof sent !== "string") setResult({ prompt: r.prompt, files: sent.names.length });
    } catch {
      focusErrors.current = true;
      setErrors(["Gagal membuat prompt. Coba lagi."]);
    }
    setProgress("");
    setPending(false);
  }

  if (flows.length === 0) {
    return <p className="text-muted-foreground">Belum ada alur. <Link href="/alur/baru" className="underline underline-offset-2">Buat alur dulu</Link>.</p>;
  }
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {errors.length > 0 && (
          <div ref={errorBox} role="alert" tabIndex={-1} className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
              Ada yang perlu diperbaiki:
            </p>
            <ul className="mt-2 list-disc pl-6">{errors.map((m, i) => <li key={i} className="break-words">{m}</li>)}</ul>
          </div>
        )}
        <Field label="Alur" htmlFor={id("flow")}>
          <FlowSelect id={id("flow")} required flows={flows} value={flow} onChange={setFlow} />
        </Field>
        <Field label="Topik" htmlFor={id("topic")}>
          <Input id={id("topic")} required maxLength={200} value={topic} onChange={(e) => setTopic(e.target.value)} />
        </Field>
        <Field label="Catatan" htmlFor={id("notes")}>
          <Textarea id={id("notes")} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <fieldset aria-describedby={id("files-hint")}>
          <legend className="mb-1.5 text-sm leading-none font-medium">File sumber (opsional)</legend>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Button ref={pickButton} type="button" variant="outline" disabled={pending} onClick={() => fileInput.current?.click()}>
                <FilePlus aria-hidden="true" />Pilih file
              </Button>
              <Button type="button" variant="outline" disabled={pending} onClick={() => folderInput.current?.click()}>
                <FolderOpen aria-hidden="true" />Pilih folder
              </Button>
            </div>
            <p id={id("files-hint")} className="text-xs text-muted-foreground">
              Video asli, audio, gambar, atau teks (naskah, subtitle, data). Maksimal 2 GB per file dan {MAX_SOURCE_FILES} file.
              Jelaskan di Catatan cara memakainya, misalnya &quot;potong jadi 30 detik, pakai musik ini sebagai latar&quot;.
            </p>
            {/* Opened by the buttons above; the inputs themselves stay out of the tab order. */}
            <input ref={fileInput} type="file" multiple accept={SOURCE_ACCEPT} hidden tabIndex={-1} onChange={pick} />
            <input ref={folderInput} type="file" hidden tabIndex={-1} onChange={pick} {...{ webkitdirectory: "" }} />
            {picked.length > 0 && (
              <ul className="flex flex-col gap-2" aria-label="File sumber terpilih">
                {picked.map((p) => {
                  const kind = sourceKind(p.file.name) as Kind;
                  const Icon = KIND_ICONS[kind];
                  const label = p.file.webkitRelativePath || p.file.name;
                  return (
                    <li key={p.key} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                      <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm break-all">{label}</p>
                        <p className="text-xs text-muted-foreground">
                          {SOURCE_KIND_LABELS[kind]} · {formatBytes(p.file.size)}{p.stored ? " · terunggah" : ""}
                        </p>
                      </div>
                      <Button type="button" variant="ghost" size="icon-sm" disabled={pending} aria-label={`Hapus ${label} dari daftar`} onClick={() => remove(p.key)}>
                        <X aria-hidden="true" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>{picked.some((p) => !p.stored) ? "Unggah file & buat prompt" : "Buat prompt"}</Button>
          {progress && <p className="text-sm break-all text-muted-foreground">{progress}</p>}
        </div>
      </form>

      {result && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-muted px-2 py-1 text-sm">{result.prompt}</code>
            <CopyButton text={result.prompt} />
          </div>
          <p className="text-sm">
            Tempel di Claude Code yang dibuka di folder repo utama (bukan worktree). Pantau di halaman Eksekusi.
            {result.files > 0 && ` ${result.files} file sumber ikut permintaan ini dan disalin ke proyek saat video dibuat.`}
          </p>
          <Link href="/eksekusi" className="w-fit text-sm underline underline-offset-2">Buka halaman Eksekusi</Link>
        </div>
      )}
      {/* The one live region: always in the accessibility tree (never display:none), outside the result so CopyButton's own live text does not double up. */}
      <p role="status" className="sr-only">{result ? `Prompt siap: ${result.prompt}` : progress}</p>
    </div>
  );
}
