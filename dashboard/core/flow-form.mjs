// Pure helpers for the flow editor. No imports: client components use this module too (no zod, no node:fs in the browser bundle).

// .env keys each cloud audio option needs; the editor shows whether they are filled (ALR-08).
export const VOICE_PROVIDER_KEYS = { edge: [], elevenlabs: ['ELEVENLABS_API_KEY'], qwen3: ['RUNPOD_API_KEY'], '60db': ['SIXTYDB_API_KEY'] };

// A new flow for the editor. id and name are for the user to fill; version and updatedAt are left out because saveFlow sets them.
export function defaultFlow(template, brand, { width, height, aspectRatio }) {
  return {
    id: '', name: '', template, brand,
    output: { aspectRatio, width, height, fps: 30, targetDurationSeconds: 30 },
    language: 'id',
    scenes: [{ id: 'pembuka', label: 'Pembuka', goal: '', durationSeconds: 5, rules: [], narration: false }],
    audio: { voiceover: { enabled: false }, music: { enabled: false }, captions: { enabled: false } },
    references: [], skills: [], approval: 'auto',
  };
}

// New array with the scene at `index` swapped with its neighbour; the same array back when there is no neighbour.
export function moveScene(scenes, index, dir) {
  const to = index + dir;
  if (index < 0 || index >= scenes.length || to < 0 || to >= scenes.length) return scenes;
  const next = [...scenes];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

// Share of each scene in the total, for the duration bar. A half-typed duration counts as 0.
export function durationSegments(scenes) {
  const secs = scenes.map((s) => Number(s.durationSeconds) || 0);
  const total = secs.reduce((a, b) => a + b, 0);
  return scenes.map((s, i) => ({ id: s.id, label: s.label, seconds: secs[i], percent: total ? Math.round((secs[i] / total) * 1000) / 10 : 0 }));
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');
const optStr = (v) => (typeof v === 'string' ? v : undefined);
const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
const objects = (v) => (Array.isArray(v) ? v.filter(isObj) : []);
const finite = (v, empty) => (typeof v === 'number' && Number.isFinite(v) ? v : empty); // "" = a number field the user must fill in
const flag = (v) => ({ enabled: v?.enabled === true });

// A hand-edited flow.json can parse yet have wrong types ("rules": "x", "label": null, "skills": {}). The editor must still open it
// (NFR-07), so every field is coerced to the type the form needs: anything unusable becomes empty, and saving reports what is missing.
// Only the fields of the flow schema come back; version and updatedAt are set by saveFlow.
export function coerceDraft(raw) {
  const f = isObj(raw) ? raw : {};
  const output = isObj(f.output) ? f.output : {};
  const style = isObj(f.style) ? f.style : {};
  const audio = isObj(f.audio) ? f.audio : {};
  const voice = isObj(audio.voiceover) ? audio.voiceover : {};
  const music = isObj(audio.music) ? audio.music : {};
  return {
    id: str(f.id), name: str(f.name), description: optStr(f.description), template: str(f.template), brand: str(f.brand),
    output: {
      aspectRatio: str(output.aspectRatio), width: finite(output.width, ''), height: finite(output.height, ''), fps: finite(output.fps, ''),
      targetDurationSeconds: finite(output.targetDurationSeconds, ''),
    },
    language: str(f.language),
    style: { tone: optStr(style.tone), audience: optStr(style.audience), rules: strings(style.rules) },
    scenes: objects(f.scenes).map((s) => ({
      id: str(s.id), label: str(s.label), goal: str(s.goal), durationSeconds: finite(s.durationSeconds, ''), rules: strings(s.rules),
      narration: s.narration === true, visualHint: optStr(s.visualHint), transitionOut: optStr(s.transitionOut),
    })),
    audio: {
      voiceover: { ...flag(voice), provider: optStr(voice.provider), voice: optStr(voice.voice) },
      music: { ...flag(music), preset: optStr(music.preset), prompt: optStr(music.prompt) },
      captions: flag(audio.captions),
    },
    references: objects(f.references).map((r) => ({ kind: str(r.kind), id: optStr(r.id), path: optStr(r.path), url: optStr(r.url), note: optStr(r.note) })),
    skills: strings(f.skills),
    approval: f.approval === 'script-review' ? 'script-review' : 'auto',
    notes: optStr(f.notes),
  };
}
