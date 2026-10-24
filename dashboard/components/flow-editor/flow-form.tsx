"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { saveFlowAction } from "@/app/alur/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VOICE_PROVIDER_KEYS, coerceDraft } from "@/core/flow-form.mjs";
import { slugify } from "@/core/slug.mjs";
import { DurationBar } from "./duration-bar";
import { Field, NativeSelect } from "./field";
import { ReferencesField } from "./references-field";
import { SceneList } from "./scene-list";
import { SkillsField } from "./skills-field";
import type { EditorData, FlowDraft, Scene } from "./types";

const PROVIDERS = [
  { value: "", label: "Pilih provider" },
  { value: "edge", label: "Edge TTS (gratis)" },
  { value: "elevenlabs", label: "ElevenLabs" },
  { value: "qwen3", label: "Qwen3-TTS" },
  { value: "60db", label: "60db" },
];
const LANGUAGES = [{ value: "id", label: "Indonesia" }, { value: "en", label: "Inggris" }];
const APPROVALS = [{ value: "auto", label: "Otomatis" }, { value: "script-review", label: "Review naskah dulu" }];

// `raw` is a flow.json, possibly hand-edited into wrong types (coerceDraft makes it fit the form), or defaultFlow().
// Scene keys go by position, so the server render and hydration give a scene the same key. A flow.json without an id is saved into
// the folder it was opened from.
function toDraft(raw: unknown, folderId?: string): FlowDraft {
  const d = coerceDraft(raw) as Omit<FlowDraft, "scenes"> & { scenes: Omit<Scene, "key">[] };
  return { ...d, id: d.id || folderId || "", scenes: d.scenes.map((s, i) => ({ ...s, key: `loaded-${i}` })) };
}

const trimmed = (s?: string) => s?.trim() || undefined; // undefined keys are dropped by JSON.stringify
const lines = (l?: string[]) => (l ?? []).map((x) => x.trim()).filter(Boolean);

// The JSON sent to the server: no editor-only keys, no empty optional fields, one rule per non-blank line.
function toPayload(f: FlowDraft) {
  const style = { tone: trimmed(f.style?.tone), audience: trimmed(f.style?.audience), rules: lines(f.style?.rules) };
  const { voiceover, music } = f.audio;
  return {
    ...f,
    id: f.id.trim(), name: f.name.trim(), description: trimmed(f.description), notes: trimmed(f.notes),
    style: style.tone || style.audience || style.rules.length ? style : undefined,
    scenes: f.scenes.map((s) => ({
      ...s, key: undefined, id: s.id.trim(), label: s.label.trim(), goal: s.goal.trim(), rules: lines(s.rules),
      visualHint: trimmed(s.visualHint), transitionOut: s.transitionOut || undefined,
    })),
    audio: { ...f.audio, voiceover: { ...voiceover, provider: voiceover.provider || undefined }, music },
  };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle><h2 className="text-lg">{title}</h2></CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

function KeyStatus({ name, filled }: { name: string; filled: boolean }) {
  const Icon = filled ? CircleCheck : CircleAlert;
  return (
    <li className={`flex items-center gap-1.5 ${filled ? "text-green-800 dark:text-green-300" : "text-amber-900 dark:text-amber-200"}`}>
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <code className="text-xs">{name}</code> {filled ? "terisi" : "kosong"}
    </li>
  );
}

export function FlowForm({ mode, initial, folderId, version = 0, initialErrors = [], data }: { mode: "create" | "update"; initial: unknown; folderId?: string; version?: number; initialErrors?: string[]; data: EditorData }) {
  const router = useRouter();
  const uid = useId();
  const [flow, setFlow] = useState(() => toDraft(initial, folderId));
  const [customId, setCustomId] = useState(false); // the user typed an id: stop deriving it from the name
  const [errors, setErrors] = useState(initialErrors);
  const [saved, setSaved] = useState<number | null>(null);
  const [current, setCurrent] = useState(version); // the version on disk as far as this editor knows: what the next save expects
  const [pending, setPending] = useState(false);
  const errorBox = useRef<HTMLDivElement>(null);
  const focusErrors = useRef(false);
  useEffect(() => {
    if (focusErrors.current) errorBox.current?.focus();
    focusErrors.current = false;
  }, [errors]);

  const patch = (p: Partial<FlowDraft>) => {
    setFlow((f) => ({ ...f, ...p }));
    setSaved(null);
  };
  const { output, audio } = flow;
  const { voiceover: vo, music } = audio;
  const brand = data.brands.find((b) => b.id === flow.brand);
  const cloudKeys = [...(vo.enabled && vo.provider ? (VOICE_PROVIDER_KEYS as Record<string, string[]>)[vo.provider] ?? [] : [])];
  const id = (name: string) => `${uid}-${name}`;
  const num = (v: string) => (v === "" ? "" : Number(v));
  // The id in flow.json names another folder: saving would write flows/<that id>, over a flow that is not the one being edited.
  const mismatch = mode === "update" && folderId !== undefined && flow.id !== folderId;

  function pickTemplate(templateId: string) {
    const t = data.templates.find((x) => x.id === templateId);
    patch({ template: templateId, output: { ...output, aspectRatio: t?.aspectRatio ?? output.aspectRatio, width: t?.width ?? output.width, height: t?.height ?? output.height } });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mismatch) return;
    setPending(true);
    setSaved(null);
    try {
      const r = await saveFlowAction(JSON.stringify(toPayload(flow)), mode, mode === "update" ? current : undefined);
      if (!r.ok) {
        focusErrors.current = true;
        setErrors(r.errors);
      } else if (mode === "create") {
        router.push(`/alur/${r.id}`);
        return; // stay "pending" until the new page replaces this one
      } else {
        setErrors([]);
        setCurrent(r.version);
        setSaved(r.version);
      }
    } catch {
      focusErrors.current = true;
      setErrors(["Gagal menyimpan. Coba lagi."]);
    }
    setPending(false);
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-3xl flex-col gap-6">
      {errors.length > 0 && (
        <div ref={errorBox} role="alert" tabIndex={-1} className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <p className="flex items-center gap-2 font-medium text-destructive">
            <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
            Ada yang perlu diperbaiki:
          </p>
          <ul className="mt-2 list-disc pl-6">{errors.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}

      <Section title="Info">
        <Field label="Nama" htmlFor={id("name")}>
          <Input
            id={id("name")} required value={flow.name}
            onChange={(e) => patch({ name: e.target.value, ...(mode === "create" && !customId && { id: e.target.value.trim() ? slugify(e.target.value) : "" }) })}
          />
        </Field>
        {mode === "create" ? (
          <Field label="ID" htmlFor={id("id")} hint="Nama folder alur: huruf kecil, angka, dan tanda hubung. Otomatis dari nama, bisa diubah.">
            <Input id={id("id")} aria-describedby={`${id("id")}-hint`} required value={flow.id} onChange={(e) => { setCustomId(e.target.value !== ""); patch({ id: e.target.value }); }} />
          </Field>
        ) : (
          <p className="text-sm">ID: <code>{flow.id}</code> (tidak bisa diubah)</p>
        )}
        <Field label="Deskripsi" htmlFor={id("desc")}>
          <Input id={id("desc")} value={flow.description ?? ""} onChange={(e) => patch({ description: e.target.value })} />
        </Field>
      </Section>

      <Section title="Template & brand">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Template" htmlFor={id("template")}>
            <NativeSelect
              id={id("template")} value={flow.template} onChange={pickTemplate}
              options={data.templates.map((t) => ({ value: t.id, label: t.engine === "remotion" ? t.id : `${t.id} (belum didukung)`, disabled: t.engine !== "remotion" }))}
            />
          </Field>
          <Field label="Brand" htmlFor={id("brand")}>
            <NativeSelect id={id("brand")} value={flow.brand} onChange={(b) => patch({ brand: b })} options={data.brands.map((b) => ({ value: b.id, label: b.id }))} />
          </Field>
        </div>
        {brand && (
          <ul aria-label="Warna brand" className="flex flex-wrap gap-x-4 gap-y-2">
            {Object.entries(brand.colors).map(([k, color]) => (
              <li key={k} className="flex items-center gap-2 text-xs">
                <span aria-hidden="true" className="size-6 shrink-0 rounded border" style={{ backgroundColor: color }} />
                <span><span className="block font-medium">{k}</span><span className="block font-mono text-muted-foreground">{color}</span></span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Format output">
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div><dt className="text-muted-foreground">Rasio</dt><dd>{output.aspectRatio}</dd></div>
          <div><dt className="text-muted-foreground">Ukuran</dt><dd>{output.width}×{output.height} px</dd></div>
          <div><dt className="text-muted-foreground">FPS</dt><dd>{output.fps}</dd></div>
        </dl>
        <p className="text-xs text-muted-foreground">Rasio, ukuran, dan FPS mengikuti template dan tidak bisa diubah di sini.</p>
        <Field label="Target durasi (detik)" htmlFor={id("target")} className="max-w-48">
          <Input id={id("target")} type="number" step="any" required value={output.targetDurationSeconds} onChange={(e) => patch({ output: { ...output, targetDurationSeconds: num(e.target.value) } })} />
        </Field>
      </Section>

      <Section title="Susunan scene">
        <DurationBar scenes={flow.scenes} target={output.targetDurationSeconds} />
        <SceneList scenes={flow.scenes} transitions={data.transitions} onChange={(scenes) => patch({ scenes })} />
      </Section>

      <Section title="Gaya & bahasa">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bahasa" htmlFor={id("lang")}>
            <NativeSelect id={id("lang")} value={flow.language} options={LANGUAGES} onChange={(language) => patch({ language })} />
          </Field>
          <Field label="Nada" htmlFor={id("tone")}>
            <Input id={id("tone")} value={flow.style?.tone ?? ""} onChange={(e) => patch({ style: { ...flow.style, tone: e.target.value } })} />
          </Field>
          <Field label="Audiens" htmlFor={id("audience")} className="sm:col-span-2">
            <Input id={id("audience")} value={flow.style?.audience ?? ""} onChange={(e) => patch({ style: { ...flow.style, audience: e.target.value } })} />
          </Field>
          <Field label="Aturan global" htmlFor={id("rules")} hint="Satu aturan per baris." className="sm:col-span-2">
            <Textarea id={id("rules")} aria-describedby={`${id("rules")}-hint`} value={(flow.style?.rules ?? []).join("\n")} onChange={(e) => patch({ style: { ...flow.style, rules: e.target.value.split("\n") } })} />
          </Field>
        </div>
      </Section>

      <Section title="Audio">
        <Label className="w-fit">
          <Checkbox
            checked={vo.enabled}
            onCheckedChange={(enabled) => patch({ audio: { ...audio, voiceover: { ...vo, enabled, provider: vo.provider || "edge" } } })}
          />
          Suara
        </Label>
        <Field label="Provider suara" htmlFor={id("provider")} hint="Edge TTS gratis tanpa API key dan mendukung Bahasa Indonesia. Qwen3-TTS tidak mendukung Bahasa Indonesia." className="max-w-xs">
          <NativeSelect
            id={id("provider")} aria-describedby={`${id("provider")}-hint`} disabled={!vo.enabled} value={vo.provider ?? ""} options={PROVIDERS}
            onChange={(provider) => patch({ audio: { ...audio, voiceover: { ...vo, provider } } })}
          />
        </Field>
        <Label className="w-fit">
          <Checkbox checked={music.enabled} onCheckedChange={(enabled) => patch({ audio: { ...audio, music: { ...music, enabled } } })} />
          Musik latar (trek gratis bawaan, 60 detik)
        </Label>
        <Label className="w-fit">
          <Checkbox checked={audio.captions.enabled} onCheckedChange={(enabled) => patch({ audio: { ...audio, captions: { enabled } } })} />
          Teks/caption
        </Label>
        {cloudKeys.length > 0 && (
          <div className="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-200">Butuh layanan cloud/berbayar</p>
            <ul aria-label="API key yang dibutuhkan" className="mt-1 flex flex-col gap-1">
              {cloudKeys.map((k) => <KeyStatus key={k} name={k} filled={!!data.env[k]} />)}
            </ul>
          </div>
        )}
      </Section>

      <Section title="Referensi">
        <ReferencesField references={flow.references} options={data.references} onChange={(references) => patch({ references })} />
      </Section>

      <Section title="Skill">
        <SkillsField skills={data.skills} selected={flow.skills} onChange={(skills) => patch({ skills })} />
      </Section>

      <Section title="Persetujuan">
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Mode persetujuan</legend>
          {APPROVALS.map((a) => (
            <label key={a.value} className="flex items-center gap-2 text-sm">
              <input type="radio" name={id("approval")} className="size-4" checked={flow.approval === a.value} onChange={() => patch({ approval: a.value as FlowDraft["approval"] })} />
              {a.label}
            </label>
          ))}
        </fieldset>
      </Section>

      <Section title="Catatan untuk Claude">
        <Textarea aria-label="Catatan untuk Claude" value={flow.notes ?? ""} onChange={(e) => patch({ notes: e.target.value })} />
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || mismatch} aria-describedby={mismatch ? id("mismatch") : undefined}>Simpan</Button>
        <p role="status" className="flex items-center gap-1.5 text-sm text-green-800 dark:text-green-300">
          {saved !== null && (
            <>
              <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
              Tersimpan (versi {saved})
            </>
          )}
        </p>
      </div>
      {mismatch && (
        <p id={id("mismatch")} className="flex max-w-prose items-start gap-2 text-sm text-destructive">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Simpan dinonaktifkan: ID di flow.json ({flow.id ? `"${flow.id}"` : "kosong"}) tidak sama dengan nama folder ({`"${folderId}"`}), jadi penyimpanan bisa menimpa alur lain. Perbaiki flow.json dengan editor teks, atau arsipkan alur ini.
        </p>
      )}
    </form>
  );
}
