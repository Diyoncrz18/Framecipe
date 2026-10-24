// The flow as the editor holds it (a flow.json plus editor-only bits). Text lists stay as typed lines until saving.
export type Scene = {
  key: string; // editor only: a stable React key, because the scene id is editable. Not saved.
  id: string;
  label: string;
  goal: string;
  durationSeconds: number | ""; // "" while the field is empty
  rules: string[];
  narration: boolean;
  visualHint?: string;
  transitionOut?: string;
};

export type Reference = { kind: string; id?: string; path?: string; url?: string; note?: string };

export type FlowDraft = {
  id: string;
  name: string;
  description?: string;
  template: string;
  brand: string;
  output: { aspectRatio: string; width: number | ""; height: number | ""; fps: number | ""; targetDurationSeconds: number | "" };
  language: string;
  style?: { tone?: string; audience?: string; rules?: string[] };
  scenes: Scene[];
  audio: {
    voiceover: { enabled: boolean; provider?: string; voice?: string };
    music: { enabled: boolean; preset?: string; prompt?: string };
    captions: { enabled: boolean };
  };
  references: Reference[];
  skills: string[];
  approval: "auto" | "script-review";
  notes?: string;
};

// What the editor may pick from. Built on the server (see app/alur/editor-data.ts); nothing from .env but filled/empty.
export type EditorData = {
  templates: { id: string; engine: string; aspectRatio: string; width: number | null; height: number | null }[];
  brands: { id: string; colors: Record<string, string> }[];
  transitions: string[];
  references: Record<"example" | "template" | "brand" | "transition" | "component", string[]>;
  skills: { id: string; skillName: string; description: string }[];
  env: Record<string, boolean>;
};
