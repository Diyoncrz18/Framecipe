"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { moveScene } from "@/core/flow-form.mjs";
import { Field, NativeSelect } from "./field";
import type { Scene } from "./types";

let counter = 0; // only used after hydration (a scene added in the browser), never during the server render
const newSceneKey = () => `added-${counter++}`;

export function SceneList({ scenes, transitions, onChange }: { scenes: Scene[]; transitions: string[]; onChange: (scenes: Scene[]) => void }) {
  const uid = useId();
  const addButton = useRef<HTMLButtonElement>(null);
  // Element to focus after the next render: a moved or added scene must not leave the keyboard user at the top of the page.
  const focusId = useRef<string | null>(null);
  useEffect(() => {
    if (focusId.current) document.getElementById(focusId.current)?.focus();
    focusId.current = null;
  }, [scenes]);

  const set = (i: number, patch: Partial<Scene>) => onChange(scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const options = [{ value: "", label: "Tidak ada" }, ...transitions.map((t) => ({ value: t, label: t }))];

  function add() {
    let n = scenes.length + 1;
    while (scenes.some((s) => s.id === `scene-${n}`)) n++;
    const key = newSceneKey();
    focusId.current = `${uid}-${key}-label`;
    onChange([...scenes, { key, id: `scene-${n}`, label: `Scene ${n}`, goal: "", durationSeconds: 5, rules: [], narration: false }]);
  }

  function move(i: number, dir: -1 | 1) {
    const to = i + dir;
    if (to < 0 || to >= scenes.length) return;
    // The button just used is disabled when the scene reaches an end of the list: focus the opposite one then.
    const atEnd = to === 0 || to === scenes.length - 1;
    focusId.current = `${uid}-${scenes[i].key}-${(dir === -1) === atEnd ? "down" : "up"}`;
    onChange(moveScene(scenes, i, dir));
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-4">
        {scenes.map((s, i) => {
          const p = `${uid}-${s.key}`;
          const name = s.label.trim() || `nomor ${i + 1}`;
          return (
            <li key={s.key} className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">Scene {i + 1}</h3>
                <div className="flex gap-1">
                  <Button id={`${p}-up`} type="button" variant="outline" size="icon-sm" disabled={i === 0} aria-label={`Naikkan scene ${name}`} title={`Naikkan scene ${name}`} onClick={() => move(i, -1)}>
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button id={`${p}-down`} type="button" variant="outline" size="icon-sm" disabled={i === scenes.length - 1} aria-label={`Turunkan scene ${name}`} title={`Turunkan scene ${name}`} onClick={() => move(i, 1)}>
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button
                    type="button" variant="destructive" size="icon-sm" disabled={scenes.length === 1}
                    aria-label={`Hapus scene ${name}`} title={`Hapus scene ${name}`}
                    onClick={() => { onChange(scenes.filter((_, j) => j !== i)); addButton.current?.focus(); }}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Label" htmlFor={`${p}-label`}>
                  <Input id={`${p}-label`} required value={s.label} onChange={(e) => set(i, { label: e.target.value })} />
                </Field>
                <Field label="ID" htmlFor={`${p}-id`}>
                  <Input id={`${p}-id`} required value={s.id} onChange={(e) => set(i, { id: e.target.value })} />
                </Field>
                <Field label="Tujuan" htmlFor={`${p}-goal`} className="sm:col-span-2">
                  <Textarea id={`${p}-goal`} required value={s.goal} onChange={(e) => set(i, { goal: e.target.value })} />
                </Field>
                <Field label="Durasi (detik)" htmlFor={`${p}-dur`}>
                  <Input id={`${p}-dur`} type="number" step="any" required value={s.durationSeconds} onChange={(e) => set(i, { durationSeconds: e.target.value === "" ? "" : Number(e.target.value) })} />
                </Field>
                <Field label="Transisi keluar" htmlFor={`${p}-trans`}>
                  <NativeSelect id={`${p}-trans`} value={s.transitionOut ?? ""} options={options} onChange={(v) => set(i, { transitionOut: v })} />
                </Field>
                <Field label="Aturan" htmlFor={`${p}-rules`} hint="Satu aturan per baris." className="sm:col-span-2">
                  <Textarea id={`${p}-rules`} aria-describedby={`${p}-rules-hint`} value={s.rules.join("\n")} onChange={(e) => set(i, { rules: e.target.value.split("\n") })} />
                </Field>
                <Field label="Petunjuk visual" htmlFor={`${p}-visual`} className="sm:col-span-2">
                  <Input id={`${p}-visual`} value={s.visualHint ?? ""} onChange={(e) => set(i, { visualHint: e.target.value })} />
                </Field>
                <Label className="w-fit sm:col-span-2">
                  <Checkbox checked={s.narration} onCheckedChange={(narration) => set(i, { narration })} />
                  Narasi
                </Label>
              </div>
            </li>
          );
        })}
      </ol>
      <Button ref={addButton} type="button" variant="outline" className="self-start" onClick={add}>
        <Plus aria-hidden="true" />
        Tambah scene
      </Button>
    </div>
  );
}
