"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createRequestAction } from "@/app/actions";
import { CopyButton } from "@/components/copy-button";
import { Field } from "@/components/flow-editor/field";
import { FlowSelect, type FlowOption } from "@/components/flow-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Writes a request file and shows the one line to paste into Claude Code. `defaultFlow` is picked unless that flow cannot be used.
export function CreateVideoForm({ flows, defaultFlow }: { flows: FlowOption[]; defaultFlow?: string }) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const [flow, setFlow] = useState(flows.some((f) => f.id === defaultFlow && f.valid) ? defaultFlow! : "");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const errorBox = useRef<HTMLDivElement>(null);
  const focusErrors = useRef(false);
  useEffect(() => {
    if (focusErrors.current) errorBox.current?.focus();
    focusErrors.current = false;
  }, [errors]);

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
    setPrompt(null);
    try {
      const r = await createRequestAction({ flow, topic, notes });
      focusErrors.current = !r.ok;
      setErrors(r.ok ? [] : r.errors);
      if (r.ok) setPrompt(r.prompt);
    } catch {
      focusErrors.current = true;
      setErrors(["Gagal membuat prompt. Coba lagi."]);
    }
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
            <ul className="mt-2 list-disc pl-6">{errors.map((m, i) => <li key={i}>{m}</li>)}</ul>
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
        <div><Button type="submit" disabled={pending}>Buat prompt</Button></div>
      </form>

      {prompt && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-muted px-2 py-1 text-sm">{prompt}</code>
            <CopyButton text={prompt} />
          </div>
          <p className="text-sm">Tempel di Claude Code yang dibuka di folder repo utama (bukan worktree). Pantau di halaman Eksekusi.</p>
          <Link href="/eksekusi" className="w-fit text-sm underline underline-offset-2">Buka halaman Eksekusi</Link>
        </div>
      )}
      {/* The one live region: always in the accessibility tree (never display:none), outside the result so CopyButton's own live text does not double up. */}
      <p role="status" className="sr-only">{prompt ? `Prompt siap: ${prompt}` : ""}</p>
    </div>
  );
}
