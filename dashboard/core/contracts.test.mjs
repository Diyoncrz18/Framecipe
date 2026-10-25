import fs from 'node:fs';
import { expect, it } from 'vitest';
import { checkFlowAgainstRepo, eventSchema, flowWarnings, parseFlow, requestSchema, runSchema } from './contracts.mjs';

const valid = JSON.parse(fs.readFileSync(new URL('./fixtures/flow.valid.json', import.meta.url), 'utf8'));
const ctx = { templates: { 'sprint-review': { engine: 'remotion', aspectRatio: '16:9' },
  'concept-explainer-short': { engine: 'python', aspectRatio: 'unknown' } }, brands: ['default'], transitions: ['zoomBlur'] };
it('alur contoh valid', () => {
  expect(parseFlow(valid).ok).toBe(true);
  expect(checkFlowAgainstRepo(valid, ctx)).toEqual([]);
  expect(flowWarnings(valid)).toEqual([]);
});
it('menolak id bukan slug dan scene ganda', () => {
  const r = parseFlow({ ...valid, id: 'Contoh Penjelasan', scenes: [valid.scenes[0], valid.scenes[0]] });
  expect(r.ok).toBe(false);
  expect(r.errors.join('\n')).toContain('ID alur hanya boleh huruf kecil, angka, dan tanda hubung.');
  expect(r.errors.join('\n')).toContain('ID scene "hook" dipakai lebih dari sekali.');
});
it('suara aktif wajib provider, referensi wajib field', () => {
  const r = parseFlow({ ...valid, audio: { ...valid.audio, voiceover: { enabled: true } }, references: [{ kind: 'link' }] });
  expect(r.errors.join('\n')).toContain('Pilih provider suara.');
  expect(r.errors.join('\n')).toContain('Referensi #1 (link) butuh url.');
});
it('pesan error memuat path field dalam Bahasa Indonesia', () => {
  const r = parseFlow({ ...valid, scenes: [valid.scenes[0], { ...valid.scenes[1], durationSeconds: 0 }] });
  expect(r.errors).toEqual(['scenes.1.durationSeconds: Durasi harus lebih dari 0.']);
  expect(parseFlow({ ...valid, name: undefined }).errors).toEqual(['name: Nama alur wajib diisi.']);
  expect(parseFlow(null).errors).toEqual(['alur: Alur tidak valid.']);
  expect(parseFlow({ ...valid, audio: { ...valid.audio, voiceover: undefined } }).errors).toEqual(['audio.voiceover: Suara wajib diisi.']);
});
it('cek repo: python, brand, transisi, qwen3 + id', () => {
  const f = { ...valid, template: 'concept-explainer-short', brand: 'nope', language: 'id',
    audio: { ...valid.audio, voiceover: { enabled: true, provider: 'qwen3' } },
    scenes: [{ ...valid.scenes[0], transitionOut: 'wipe' }] };
  expect(checkFlowAgainstRepo(f, ctx)).toEqual([
    'Template "concept-explainer-short" berbasis Python dan belum bisa dipakai di alur v1.',
    'Brand "nope" tidak ditemukan di brands/.',
    'Transisi "wipe" di scene "hook" tidak ada di registry.',
    'Qwen3-TTS tidak mendukung bahasa "id". Pilih ElevenLabs atau matikan suara.',
  ]);
  expect(checkFlowAgainstRepo({ ...valid, output: { ...valid.output, aspectRatio: '9:16' } }, ctx))
    .toEqual(['Rasio 9:16 tidak didukung template "sprint-review" (rasio template 16:9).']);
  expect(checkFlowAgainstRepo({ ...valid, template: 'constructor' }, ctx))
    .toEqual(['Template "constructor" tidak ditemukan di templates/.']);
});
it('peringatan durasi lebih dari 10%', () => {
  expect(flowWarnings({ ...valid, scenes: [{ ...valid.scenes[0], durationSeconds: 20 }] }))
    .toEqual(['Total durasi scene 20 dtk, target 30 dtk (selisih lebih dari 10%).']);
});
it('runSchema dan eventSchema', () => {
  const run = { runId: '20261024-0153-a1b2', project: 'cara-kerja-pelangi', flow: 'contoh-penjelasan', flowVersion: 1,
    request: null, topic: 'Cara kerja pelangi', notes: '', trigger: 'chat', retryOf: null, sessionId: null,
    claudeCodeVersion: '2.1.303', status: 'running', stage: 'setup', waitReason: null,
    stages: [{ name: 'setup', startedAt: '2026-10-24T01:53:00.000Z', endedAt: null }],
    startedAt: '2026-10-24T01:53:00.000Z', endedAt: null, output: null, warnings: [], error: null };
  expect(runSchema.safeParse(run).success).toBe(true);
  expect(runSchema.safeParse({ ...run, status: 'done' }).success).toBe(false);
  expect(runSchema.safeParse({ ...run, status: 'failed', error: { stage: 'render', message: 'render gagal' } }).success).toBe(true);
  expect(runSchema.safeParse({ ...run, status: 'failed', error: 'render gagal' }).success).toBe(false);
  expect(runSchema.safeParse({ ...run, sources: [{ name: 'musik.mp3', kind: 'audio', sizeBytes: 9 }] }).success).toBe(true);
  expect(runSchema.safeParse({ ...run, sources: [{ name: 'musik.mp3', kind: 'audio' }] }).success).toBe(false);
  expect(eventSchema.safeParse({ ts: '2026-10-24T01:53:05.120Z', sessionId: 's1', runId: null, type: 'skill',
    tool: 'Skill', summary: 'remotion-official', ok: true }).success).toBe(true);
  // The hook writes stop, session-start and session-end events with no summary; only a summary that is not a string is a bad shape.
  const bare = { ts: '2026-10-24T01:53:05.120Z', sessionId: 's1', runId: null, type: 'stop', tool: null, ok: true };
  expect([eventSchema.safeParse(bare).success, eventSchema.safeParse({ ...bare, summary: { a: 1 } }).success]).toEqual([true, false]);
});
it('requestSchema', () => {
  const req = { id: '7f3a', flow: 'contoh-penjelasan', topic: 'Cara kerja pelangi', notes: '',
    createdAt: '2026-10-24T01:52:40.000Z', status: 'baru', runId: null };
  expect(requestSchema.safeParse(req).success).toBe(true);
  expect(requestSchema.safeParse({ ...req, status: 'selesai' }).success).toBe(false);
  const withSources = { ...req, uploads: 'a1b2c3', sources: [{ name: 'rekaman.mp4', kind: 'video', sizeBytes: 1024 }] };
  expect(requestSchema.safeParse(withSources).success).toBe(true);
  expect(requestSchema.safeParse({ ...withSources, sources: [{ name: 'x.exe', kind: 'program', sizeBytes: 1 }] }).success).toBe(false);
  expect(requestSchema.safeParse({ ...withSources, sources: [{ name: 'x.mp4', kind: 'video', sizeBytes: -1 }] }).success).toBe(false);
});
