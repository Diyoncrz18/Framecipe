"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "./field";
import type { EditorData, Reference } from "./types";

const KINDS = [
  { value: "example", label: "Contoh" },
  { value: "template", label: "Template" },
  { value: "brand", label: "Brand" },
  { value: "transition", label: "Transisi" },
  { value: "component", label: "Komponen" },
  { value: "link", label: "Tautan" },
];
// Kinds a hand-edited flow may hold that the picker cannot add.
const KIND_LABELS: Record<string, string> = { ...Object.fromEntries(KINDS.map((k) => [k.value, k.label])), project: "Proyek", upload: "Berkas" };

export function ReferencesField({ references, options, onChange }: { references: Reference[]; options: EditorData["references"]; onChange: (references: Reference[]) => void }) {
  const uid = useId();
  const [kind, setKind] = useState("example");
  const [value, setValue] = useState(""); // an id from the catalog, or the URL of a link
  const [note, setNote] = useState("");
  const isLink = kind === "link";
  const ids = options[kind as keyof typeof options] ?? [];

  function add() {
    const v = value.trim();
    if (!v) return;
    const target = isLink ? { url: v } : { id: v };
    if (!references.some((r) => r.kind === kind && (r.id ?? r.url) === v)) onChange([...references, { kind, ...target, ...(note.trim() && { note: note.trim() }) }]);
    setValue("");
    setNote("");
  }

  // Enter in these two inputs adds the reference, not the whole flow form.
  const onEnter = (e: KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    add();
  };

  return (
    <div className="flex flex-col gap-4">
      {references.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada referensi.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {references.map((r, i) => {
            const what = `${KIND_LABELS[r.kind] ?? r.kind} ${r.id ?? r.path ?? r.url ?? ""}`.trim();
            return (
              <li key={i} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <span className="min-w-0 break-words">
                  {KIND_LABELS[r.kind] ?? r.kind}: <code className="text-xs">{r.id ?? r.path ?? r.url}</code>
                  {r.note && <span className="text-muted-foreground"> ({r.note})</span>}
                </span>
                <Button type="button" variant="outline" size="sm" aria-label={`Hapus referensi ${what}`} onClick={() => onChange(references.filter((_, j) => j !== i))}>
                  <Trash2 aria-hidden="true" />
                  Hapus
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <div role="group" aria-label="Tambah referensi" className="grid gap-3 sm:grid-cols-2">
        <Field label="Jenis" htmlFor={`${uid}-kind`}>
          <NativeSelect id={`${uid}-kind`} value={kind} options={KINDS} onChange={(k) => { setKind(k); setValue(""); }} />
        </Field>
        {isLink ? (
          <Field label="URL tautan" htmlFor={`${uid}-value`}>
            <Input id={`${uid}-value`} type="url" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={onEnter} />
          </Field>
        ) : (
          <Field label="ID dari katalog" htmlFor={`${uid}-value`}>
            <NativeSelect id={`${uid}-value`} value={value} options={[{ value: "", label: "Pilih…" }, ...ids.map((id) => ({ value: id, label: id }))]} onChange={setValue} />
          </Field>
        )}
        <Field label="Catatan (opsional)" htmlFor={`${uid}-note`} className="sm:col-span-2">
          <Input id={`${uid}-note`} value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={onEnter} />
        </Field>
        <Button type="button" variant="outline" className="self-start" disabled={!value.trim()} onClick={add}>
          <Plus aria-hidden="true" />
          Tambah referensi
        </Button>
      </div>
    </div>
  );
}
