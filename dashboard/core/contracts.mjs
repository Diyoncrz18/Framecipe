// The only core module that imports zod. Others that need validation import this one.
import { z } from 'zod';

export const STAGES = ['setup', 'script', 'assets', 'audio', 'compose', 'qc', 'render', 'review', 'done'];
export const PHASE_BY_STAGE = {
  setup: 'planning', script: 'planning', assets: 'assets', audio: 'audio',
  compose: 'editing', qc: 'editing', render: 'rendering', review: 'rendering', done: 'complete',
};
export const RUN_STATUSES = ['running', 'waiting', 'success', 'failed', 'cancelled', 'abandoned'];
export const EVENT_TYPES = ['prompt', 'skill', 'command', 'file', 'agent', 'tool', 'notification', 'stop', 'session-start', 'session-end'];
export const QWEN3_LANGUAGES = ['en', 'zh', 'fr', 'de', 'it', 'ja', 'ko', 'pt', 'ru', 'es'];

// --- Shared building blocks. Messages in `error` are user-facing (flow editor), so Indonesian. ---

// Missing field -> "wajib diisi", wrong type/value -> "tidak valid".
const bad = (label) => ({ error: (iss) => (iss.input === undefined ? `${label} wajib diisi.` : `${label} tidak valid.`) });
const text = (label) => z.string(bad(label)).min(1, { error: `${label} wajib diisi.` });
const optText = (label) => z.string(bad(label)).optional();
const num = (label) => z.number(bad(label));
const posInt = (label) => num(label).int({ error: `${label} harus bilangan bulat.` }).positive({ error: `${label} harus lebih dari 0.` });
const time = (label) => z.iso.datetime({ offset: true, error: `${label} harus berformat waktu ISO 8601.` });
const textList = (label) => z.array(z.string(bad(label)), bad(label)).optional();

const SLUG_ERROR = 'ID alur hanya boleh huruf kecil, angka, dan tanda hubung.';
// No leading hyphen: the id ends up in run.mjs arguments and folder names.
const slug = z.string({ error: SLUG_ERROR }).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: SLUG_ERROR });

// --- flow.json (PRD 9.2) ---

const sceneSchema = z.object({
  id: text('ID scene'),
  label: text('Label scene'),
  goal: text('Tujuan scene'),
  durationSeconds: num('Durasi').positive({ error: 'Durasi harus lebih dari 0.' }),
  rules: textList('Aturan scene'),
  narration: z.boolean(bad('Narasi')),
  visualHint: optText('Petunjuk visual'),
  transitionOut: optText('Transisi'),
});

const voiceoverSchema = z.object({
  enabled: z.boolean(bad('Suara')),
  provider: z.enum(['elevenlabs', 'qwen3', '60db'], { error: 'Provider suara tidak dikenal.' }).optional(),
  voice: optText('Suara'),
}, bad('Suara')).superRefine((v, ctx) => {
  if (v.enabled && !v.provider) ctx.addIssue({ code: 'custom', path: ['provider'], message: 'Pilih provider suara.' });
});

const REFERENCE_KINDS = ['example', 'template', 'transition', 'component', 'brand', 'project', 'upload', 'link'];
const REFERENCE_FIELD = { upload: 'path', link: 'url' }; // every other kind needs `id`

const referenceSchema = z.object({
  kind: z.enum(REFERENCE_KINDS, { error: 'Jenis referensi tidak dikenal.' }),
  id: optText('ID referensi'),
  path: optText('Path referensi'),
  url: optText('URL referensi'),
  note: optText('Catatan referensi'),
});

export const flowSchema = z.object({
  id: slug,
  name: text('Nama alur'),
  description: optText('Deskripsi'),
  version: num('Versi').int({ error: 'Versi harus bilangan bulat.' }).nonnegative({ error: 'Versi tidak boleh negatif.' }),
  updatedAt: time('Waktu ubah'),
  template: text('Template'),
  brand: text('Brand'),
  output: z.object({
    aspectRatio: z.enum(['16:9', '9:16', '1:1'], { error: 'Rasio harus 16:9, 9:16, atau 1:1.' }),
    width: posInt('Lebar'),
    height: posInt('Tinggi'),
    fps: posInt('FPS'),
    targetDurationSeconds: num('Target durasi').positive({ error: 'Target durasi harus lebih dari 0.' }),
  }, bad('Output')),
  language: text('Bahasa'),
  style: z.object({ tone: optText('Gaya bicara'), audience: optText('Audiens'), rules: textList('Aturan gaya') }, bad('Gaya')).optional(),
  scenes: z.array(sceneSchema, bad('Scene')).min(1, { error: 'Alur butuh minimal 1 scene.' }),
  audio: z.object({
    voiceover: voiceoverSchema,
    music: z.object({ enabled: z.boolean(bad('Musik')), preset: optText('Preset musik'), prompt: optText('Prompt musik') }, bad('Musik')),
    captions: z.object({ enabled: z.boolean(bad('Teks')) }, bad('Teks')),
  }, bad('Audio')),
  references: z.array(referenceSchema, bad('Referensi')).superRefine((refs, ctx) => {
    refs.forEach((r, i) => {
      const field = REFERENCE_FIELD[r.kind] ?? 'id';
      if (!r[field]) ctx.addIssue({ code: 'custom', path: [i, field], message: `Referensi #${i + 1} (${r.kind}) butuh ${field}.` });
    });
  }).optional(),
  skills: textList('Skill'),
  approval: z.enum(['auto', 'script-review'], { error: 'Mode persetujuan harus auto atau script-review.' }),
  notes: optText('Catatan'),
}, bad('Alur')).superRefine((flow, ctx) => {
  const seen = new Set();
  flow.scenes.forEach((s, i) => {
    if (seen.has(s.id)) ctx.addIssue({ code: 'custom', path: ['scenes', i, 'id'], message: `ID scene "${s.id}" dipakai lebih dari sekali.` });
    seen.add(s.id);
  });
});

// --- Request, run, event (PRD 9.3-9.5). Read by code, not shown to users, so default zod messages. ---

export const requestSchema = z.object({
  id: z.string().min(1),
  flow: z.string().min(1),
  topic: z.string(),
  notes: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
  status: z.enum(['baru', 'diambil']),
  runId: z.string().nullable(),
});

const iso = z.iso.datetime({ offset: true });

export const runSchema = z.object({
  runId: z.string().min(1),
  project: z.string().min(1),
  flow: z.string().min(1),
  flowVersion: z.number().int(),
  request: z.string().nullable(),
  topic: z.string(),
  notes: z.string().optional(),
  trigger: z.string(),
  retryOf: z.string().nullable(),
  sessionId: z.string().nullable(),
  claudeCodeVersion: z.string().nullable(),
  status: z.enum(RUN_STATUSES),
  stage: z.enum(STAGES),
  waitReason: z.string().nullable(),
  stages: z.array(z.object({ name: z.enum(STAGES), startedAt: iso, endedAt: iso.nullable() })),
  startedAt: iso,
  endedAt: iso.nullable(),
  lastActivityAt: iso.optional(), // intentionally optional: run-store.lastActivityAt computes it from stages and session events, run.json need not store it
  output: z.object({
    file: z.string(), durationSeconds: z.number(), width: z.number(), height: z.number(), fps: z.number(), sizeBytes: z.number(),
  }).nullable(),
  warnings: z.array(z.string()),
  error: z.object({ stage: z.enum(STAGES), message: z.string() }).nullable(), // set by fail and by the stale-run sweep
});

export const eventSchema = z.object({
  ts: iso,
  sessionId: z.string(),
  runId: z.string().nullable(),
  type: z.enum(EVENT_TYPES),
  tool: z.string().nullable(),
  summary: z.string(),
  detail: z.record(z.string(), z.unknown()).optional(),
  ok: z.boolean().nullable(),
  toolUseId: z.string().optional(),
  phase: z.enum(['start', 'end']).optional(),
  error: z.string().optional(),
});

// --- Validation entry points ---

export function parseFlow(value) {
  const r = flowSchema.safeParse(value);
  if (r.success) return { ok: true, flow: r.data };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join('.') || 'alur'}: ${i.message}`) };
}

// ctx.templates: id -> { engine, aspectRatio }. Returns Indonesian messages in a fixed order; [] means the flow fits the repo.
export function checkFlowAgainstRepo(flow, ctx) {
  const errors = [];
  const t = Object.hasOwn(ctx.templates, flow.template) ? ctx.templates[flow.template] : null;
  if (!t) errors.push(`Template "${flow.template}" tidak ditemukan di templates/.`);
  else if (t.engine === 'python') errors.push(`Template "${flow.template}" berbasis Python dan belum bisa dipakai di alur v1.`);
  else if (t.aspectRatio !== flow.output.aspectRatio) {
    errors.push(`Rasio ${flow.output.aspectRatio} tidak didukung template "${flow.template}" (rasio template ${t.aspectRatio}).`);
  }
  if (!ctx.brands.includes(flow.brand)) errors.push(`Brand "${flow.brand}" tidak ditemukan di brands/.`);
  for (const s of flow.scenes) {
    if (s.transitionOut && !ctx.transitions.includes(s.transitionOut)) {
      errors.push(`Transisi "${s.transitionOut}" di scene "${s.id}" tidak ada di registry.`);
    }
  }
  const vo = flow.audio.voiceover;
  if (vo.enabled && vo.provider === 'qwen3' && !QWEN3_LANGUAGES.includes(flow.language.split('-')[0].toLowerCase())) {
    errors.push(`Qwen3-TTS tidak mendukung bahasa "${flow.language}". Pilih ElevenLabs atau matikan suara.`);
  }
  return errors;
}

export function flowWarnings(flow) {
  const sum = Math.round(flow.scenes.reduce((a, s) => a + s.durationSeconds, 0) * 100) / 100; // rounds float noise like 0.1+0.2
  const target = flow.output.targetDurationSeconds;
  return Math.abs(sum - target) / target > 0.1
    ? [`Total durasi scene ${sum} dtk, target ${target} dtk (selisih lebih dari 10%).`]
    : [];
}
