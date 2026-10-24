// Pure helpers for the flow editor. No imports: client components use this module too (no zod, no node:fs in the browser bundle).

// .env keys each cloud audio option needs; the editor shows whether they are filled (ALR-08).
export const VOICE_PROVIDER_KEYS = { elevenlabs: ['ELEVENLABS_API_KEY'], qwen3: ['RUNPOD_API_KEY'], '60db': ['SIXTYDB_API_KEY'] };
export const MUSIC_KEYS = ['ACEMUSIC_API_KEY'];

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
