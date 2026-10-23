import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { runSchema } from './contracts.mjs';
import { readJson, writeJsonAtomic } from './jsonfile.mjs';
import { defaultDeps, failRun, startRun, stageRun, statusRun, waitRun } from './run-ops.mjs';
import { readActiveRun, readRun, requestPath, writeRun } from './run-store.mjs';
import { at, fixtureFlow, makeFixtureRepo } from './test-utils.mjs';

const deps = (clock) => ({ ...defaultDeps, now: () => clock, claudeVersion: () => '2.1.303', rand: () => 'a1b2' });

it('start membuat proyek, snapshot, run, dan penanda aktif', () => {
  const root = makeFixtureRepo();
  const r = startRun(root, { flow: 'contoh-penjelasan', topic: 'Cara kerja pelangi' }, deps(at('2026-10-24T01:53:00')));
  expect(r).toMatchObject({ project: 'cara-kerja-pelangi', runId: '20261024-0153-a1b2', projectDir: 'projects/cara-kerja-pelangi' });
  expect(r.runFile).toBe('projects/cara-kerja-pelangi/runs/20261024-0153-a1b2/run.json');
  expect(r.flowFile).toBe('projects/cara-kerja-pelangi/runs/20261024-0153-a1b2/flow.json');
  const p = path.join(root, 'projects', 'cara-kerja-pelangi');
  expect(fs.existsSync(path.join(p, 'package.json'))).toBe(true);
  expect([fs.existsSync(path.join(p, 'node_modules')), fs.existsSync(path.join(p, 'out'))]).toEqual([false, false]);
  expect(readJson(path.join(p, 'project.json')).value).toMatchObject({ name: 'cara-kerja-pelangi', template: 'rem',
    brand: 'default', phase: 'planning', flow: 'contoh-penjelasan', topic: 'Cara kerja pelangi', latestRun: r.runId,
    scenes: [], audio: { voiceover: { file: 'audio/voiceover.mp3', status: 'optional' } }, estimates: { totalDurationSeconds: 28 },
    sessions: [{ date: '2026-10-24', summary: 'Dibuat oleh /buat-video (alur contoh-penjelasan v1)' }] });
  const run = readJson(path.join(p, 'runs', r.runId, 'run.json')).value;
  expect(runSchema.safeParse(run).success).toBe(true);
  expect(run).toMatchObject({ status: 'running', stage: 'setup', claudeCodeVersion: '2.1.303', trigger: 'chat', retryOf: null });
  expect(readJson(path.join(p, 'runs', r.runId, 'flow.json')).value).toEqual(fixtureFlow());
  expect(readActiveRun(root)).toMatchObject({ runId: r.runId, project: 'cara-kerja-pelangi', sessionId: null });
});
it('start dengan topik khusus menghasilkan slug aman', () => {
  const root = makeFixtureRepo(); const d = deps(at('2026-10-24T01:53:00'));
  expect(startRun(root, { flow: 'contoh-penjelasan', topic: 'Kopi ☕ & Teh!!!' }, d).project).toBe('kopi-teh');
  failRun(root, 'x', d);
  expect(startRun(root, { flow: 'contoh-penjelasan', topic: '???' }, d).project).toBe('video');
});
it('start ditolak saat ada run aktif yang masih hidup', () => {
  const root = makeFixtureRepo(); startRun(root, { flow: 'contoh-penjelasan', topic: 'A' }, deps(at('2026-10-24T01:53:00')));
  expect(() => startRun(root, { flow: 'contoh-penjelasan', topic: 'B' }, deps(at('2026-10-24T02:00:00'))))
    .toThrow(expect.objectContaining({ code: 'ACTIVE_RUN' }));
});
it('start setelah run basi menandai run lama abandoned', () => {
  const root = makeFixtureRepo(); const a = startRun(root, { flow: 'contoh-penjelasan', topic: 'A' }, deps(at('2026-10-24T01:53:00')));
  startRun(root, { flow: 'contoh-penjelasan', topic: 'B' }, deps(at('2026-10-24T02:09:01')));
  expect(readRun(root, 'a', a.runId).value).toMatchObject({ status: 'abandoned', error: { message: 'Tidak ada aktivitas lebih dari 15 menit.' } });
});
it('start dari permintaan menandai permintaan diambil', () => {
  const root = makeFixtureRepo();
  writeJsonAtomic(requestPath(root, 'abc123'), { id: 'abc123', flow: 'contoh-penjelasan', topic: 'Halo', notes: 'catatan',
    createdAt: '2026-10-24T01:50:00.000Z', status: 'baru', runId: null });
  const r = startRun(root, { request: 'abc123' }, deps(at('2026-10-24T01:53:00')));
  expect(readJson(requestPath(root, 'abc123')).value).toMatchObject({ status: 'diambil', runId: r.runId });
  expect(readRun(root, 'halo', r.runId).value.notes).toBe('catatan');
  failRun(root, 'x', deps(at('2026-10-24T01:54:00')));
  expect(() => startRun(root, { request: 'abc123' }, deps(at('2026-10-24T01:55:00')))).toThrow(expect.objectContaining({ code: 'REQUEST_TAKEN' }));
});
it('topik sama memberi proyek -2; alur tidak valid dan worktree ditolak', () => {
  const root = makeFixtureRepo(); const d = deps(at('2026-10-24T01:53:00'));
  startRun(root, { flow: 'contoh-penjelasan', topic: 'Halo' }, d); failRun(root, 'x', d);
  expect(startRun(root, { flow: 'contoh-penjelasan', topic: 'Halo' }, d).project).toBe('halo-2'); failRun(root, 'x', d);
  writeJsonAtomic(path.join(root, 'flows', 'py', 'flow.json'), fixtureFlow({ id: 'py', template: 'pyt' }));
  expect(() => startRun(root, { flow: 'py', topic: 'X' }, d)).toThrow(/berbasis Python/);
  fs.rmSync(path.join(root, '.git'), { recursive: true }); fs.writeFileSync(path.join(root, '.git'), 'gitdir: x');
  expect(() => startRun(root, { flow: 'contoh-penjelasan', topic: 'Y' }, d)).toThrow(expect.objectContaining({ code: 'WORKTREE' }));
});
it('stage memperbarui tahap dan fase proyek; wait lalu stage kembali running', () => {
  const root = makeFixtureRepo(); const d = deps(at('2026-10-24T01:53:00'));
  const r = startRun(root, { flow: 'contoh-penjelasan', topic: 'Halo' }, d);
  expect(stageRun(root, 'script', d)).toEqual({ stage: 'script', phase: 'planning' });
  waitRun(root, 'review naskah', d);
  expect(readRun(root, 'halo', r.runId).value).toMatchObject({ status: 'waiting', waitReason: 'review naskah' });
  expect(stageRun(root, 'render', d)).toEqual({ stage: 'render', phase: 'rendering' });
  const run = readRun(root, 'halo', r.runId).value;
  expect(run).toMatchObject({ status: 'running', waitReason: null, stage: 'render' });
  expect(run.stages.map(s => [s.name, s.endedAt !== null])).toEqual([['setup', true], ['script', true], ['render', false]]);
  expect(readJson(path.join(root, 'projects', 'halo', 'project.json')).value.phase).toBe('rendering');
  expect(() => stageRun(root, 'bogus', d)).toThrow(expect.objectContaining({ code: 'BAD_STAGE' }));
});
it('fail menutup run tanpa menghapus dependensi; perbaiki membuat run baru di proyek sama', () => {
  const root = makeFixtureRepo();
  const a = startRun(root, { flow: 'contoh-penjelasan', topic: 'Halo' }, deps(at('2026-10-24T01:53:00')));
  fs.mkdirSync(path.join(root, 'projects', 'halo', 'node_modules'));
  failRun(root, 'render gagal', deps(at('2026-10-24T01:58:00')));
  expect(fs.existsSync(path.join(root, 'projects', 'halo', 'node_modules'))).toBe(true);
  expect(readRun(root, 'halo', a.runId).value).toMatchObject({ status: 'failed', error: { stage: 'setup', message: 'render gagal' } });
  expect(readActiveRun(root)).toBeNull();
  const b = startRun(root, { retry: a.runId }, { ...deps(at('2026-10-24T02:00:00')), rand: () => 'c3d4' });
  expect(b).toMatchObject({ project: 'halo', runId: '20261024-0200-c3d4' });
  expect(readRun(root, 'halo', b.runId).value.retryOf).toBe(a.runId);
  failRun(root, 'x', deps(at('2026-10-24T02:01:00')));
  writeRun(root, { ...readRun(root, 'halo', b.runId).value, status: 'success' });
  expect(() => startRun(root, { retry: b.runId }, deps(at('2026-10-24T02:02:00')))).toThrow(expect.objectContaining({ code: 'RETRY_NOT_ALLOWED' }));
});

// --- Beyond the plan: what the cases above leave open ---

it('perbaiki memakai ulang proyek: hanya latestRun, updated, dan sesi yang berubah; template tidak disalin lagi', () => {
  const root = makeFixtureRepo();
  const a = startRun(root, { flow: 'contoh-penjelasan', topic: 'Halo' }, deps(at('2026-10-24T01:53:00')));
  failRun(root, 'x', deps(at('2026-10-24T01:58:00')));
  const proj = path.join(root, 'projects', 'halo');
  fs.rmSync(path.join(proj, 'package.json')); // a template copy on retry would bring it back
  const before = readJson(path.join(proj, 'project.json')).value;
  const b = startRun(root, { retry: a.runId }, { ...deps(at('2026-10-24T02:00:00')), rand: () => 'c3d4' });
  expect(fs.existsSync(path.join(proj, 'package.json'))).toBe(false);
  const after = readJson(path.join(proj, 'project.json')).value;
  expect(after).toEqual({ ...before, latestRun: b.runId, updated: at('2026-10-24T02:00:00').toISOString(),
    sessions: [...before.sessions, { date: '2026-10-24', summary: `Perbaikan run ${a.runId} menjadi ${b.runId}` }] });
  expect(readJson(path.join(proj, 'runs', b.runId, 'flow.json')).value).toEqual(fixtureFlow());
  expect(readRun(root, 'halo', b.runId).value).toMatchObject({ topic: 'Halo', retryOf: a.runId, status: 'running' });
});
it('argumen salah ditolak dan id tidak boleh keluar dari folder yang dituju', () => {
  const root = makeFixtureRepo(); const d = deps(at('2026-10-24T01:53:00'));
  const code = (input) => { try { startRun(root, input, d); } catch (e) { return e.code; } return null; };
  expect(code({})).toBe('BAD_ARGS');
  expect(code({ flow: 'contoh-penjelasan' })).toBe('BAD_ARGS');
  expect(code({ flow: 'contoh-penjelasan', topic: 'A', trigger: 'cron' })).toBe('BAD_ARGS');
  expect(code({ request: 'zzz' })).toBe('REQUEST_NOT_FOUND');
  expect(code({ request: '../../x' })).toBe('REQUEST_NOT_FOUND');
  expect(code({ flow: 'nope', topic: 'A' })).toBe('FLOW_NOT_FOUND');
  expect(code({ flow: '../flows/contoh-penjelasan', topic: 'A' })).toBe('FLOW_NOT_FOUND');
  expect(code({ retry: '../..' })).toBe('BAD_ARGS');
  expect(code({ retry: 'tidak-ada' })).toBe('BAD_ARGS');
  expect(fs.existsSync(path.join(root, 'projects'))).toBe(false); // the failed attempts created nothing
});
it('alur rusak ditolak dengan daftar kesalahan', () => {
  const root = makeFixtureRepo(); const d = deps(at('2026-10-24T01:53:00'));
  writeJsonAtomic(path.join(root, 'flows', 'jelek', 'flow.json'), { ...fixtureFlow({ id: 'jelek' }), brand: 'tidak-ada', scenes: [] });
  expect(() => startRun(root, { flow: 'jelek', topic: 'X' }, d)).toThrow(/^Alur jelek tidak valid:\n- /);
  fs.writeFileSync(path.join(root, 'flows', 'jelek', 'flow.json'), '{ rusak');
  expect(() => startRun(root, { flow: 'jelek', topic: 'X' }, d)).toThrow(expect.objectContaining({ code: 'FLOW_INVALID' }));
});
it('stage, wait, fail tanpa run aktif; status mengikuti run aktif', () => {
  const root = makeFixtureRepo(); const d = deps(at('2026-10-24T01:53:00'));
  const code = (fn) => { try { fn(); } catch (e) { return e.code; } return null; };
  expect([code(() => stageRun(root, 'script', d)), code(() => waitRun(root, 'x', d)), code(() => failRun(root, 'x', d))])
    .toEqual(['NO_ACTIVE_RUN', 'NO_ACTIVE_RUN', 'NO_ACTIVE_RUN']);
  expect(statusRun(root)).toEqual({ active: null });
  const r = startRun(root, { flow: 'contoh-penjelasan', topic: 'Halo' }, d);
  stageRun(root, 'script', d); waitRun(root, 'review', d);
  expect(statusRun(root)).toEqual({ active: { runId: r.runId, project: 'halo', stage: 'script', status: 'waiting' } });
  expect(code(() => waitRun(root, '', d))).toBe('BAD_ARGS');
  expect(code(() => failRun(root, '  ', d))).toBe('BAD_ARGS');
  failRun(root, 'x', d);
  expect(statusRun(root)).toEqual({ active: null });
});
it('penanda aktif yang run-nya sudah selesai atau hilang tidak menghalangi start', () => {
  const root = makeFixtureRepo(); const d = deps(at('2026-10-24T01:53:00'));
  const a = startRun(root, { flow: 'contoh-penjelasan', topic: 'A' }, d);
  writeRun(root, { ...readRun(root, 'a', a.runId).value, status: 'success' }); // finished, marker left behind by a crash
  expect(startRun(root, { flow: 'contoh-penjelasan', topic: 'B' }, d).project).toBe('b');
  fs.rmSync(path.join(root, 'projects', 'b', 'runs'), { recursive: true }); // marker now points at nothing
  expect(startRun(root, { flow: 'contoh-penjelasan', topic: 'C' }, d).project).toBe('c');
});
it('run.json valid menurut runSchema di setiap status: berjalan, menunggu, gagal, terhenti', () => {
  const root = makeFixtureRepo(); const d = deps(at('2026-10-24T01:53:00'));
  const valid = (project, runId) => runSchema.safeParse(readRun(root, project, runId).value).success;
  const a = startRun(root, { flow: 'contoh-penjelasan', topic: 'A' }, d);
  stageRun(root, 'script', d);
  expect(valid('a', a.runId)).toBe(true);
  waitRun(root, 'review naskah', d);
  expect(valid('a', a.runId)).toBe(true);
  failRun(root, 'x', d);
  expect(valid('a', a.runId)).toBe(true);
  const b = startRun(root, { flow: 'contoh-penjelasan', topic: 'B' }, d);
  startRun(root, { flow: 'contoh-penjelasan', topic: 'C' }, deps(at('2026-10-24T02:30:00')));
  expect(readRun(root, 'b', b.runId).value.status).toBe('abandoned');
  expect(valid('b', b.runId)).toBe(true);
});
