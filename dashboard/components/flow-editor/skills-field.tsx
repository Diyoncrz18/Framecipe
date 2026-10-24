"use client";

import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { EditorData } from "./types";

function Item({ name, note, description, checked, onChange }: { name: string; note?: ReactNode; description?: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <li className="flex flex-col gap-0.5">
      <Label className="w-fit items-start leading-snug">
        <Checkbox className="mt-0.5" checked={checked} onCheckedChange={onChange} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="break-words">{name}</span>
          {note && <span className="text-xs font-normal text-muted-foreground">{note}</span>}
        </span>
      </Label>
      {/* Outside the label, so it is not read as part of the checkbox's name. */}
      {description && <p className="line-clamp-2 pl-6 text-xs text-muted-foreground">{description}</p>}
    </li>
  );
}

// The flow stores the skill's skillName (what the Skill tool is invoked with), not its folder id (ruling R14).
export function SkillsField({ skills, selected, onChange }: { skills: EditorData["skills"]; selected: string[]; onChange: (selected: string[]) => void }) {
  const toggle = (name: string, on: boolean) => onChange(on ? [...selected, name] : selected.filter((s) => s !== name));
  // A skill a hand-edited flow lists but the catalog no longer has stays visible, so saving does not drop it silently.
  const unknown = selected.filter((name) => !skills.some((s) => s.skillName === name));

  return (
    <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(16rem,1fr))]">
      {skills.map((s) => (
        <Item
          key={s.id} name={s.id} description={s.description} checked={selected.includes(s.skillName)} onChange={(on) => toggle(s.skillName, on)}
          note={s.skillName !== s.id ? `dipanggil sebagai ${s.skillName}` : undefined}
        />
      ))}
      {unknown.map((name) => <Item key={name} name={name} note="tidak ditemukan di katalog" checked onChange={(on) => toggle(name, on)} />)}
    </ul>
  );
}
