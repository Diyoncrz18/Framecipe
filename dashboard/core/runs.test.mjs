import fs from 'node:fs';
import path from 'node:path';
import { expect, it, vi } from 'vitest';
import { appendJsonLine, writeJsonAtomic } from './jsonfile.mjs';
import { displayStatus, listRuns, markRunFailed, readRunDetail, runWindowEvents, skillUsage, summarizeRun } from './runs.mjs';
import { readActiveRun, readRun, runPaths, sessionEventsPath, writeActiveRun, writeRun } from './run-store.mjs';
import { fixtureFlow, makeFixtureRepo } from './test-utils.mjs';

// A fixture repo with one run (project "alpha") built from opts. Everything is on 2026-10-24 UTC.
//   root (add the run to an existing repo), status, stage, stagesEntered (default [stage]; every entered stage is closed except the current one of a running/waiting run),
//   startedAt (default 01:53; `lastActivity` is an alias, the stages start one minute apart from there), endedAt (default 02:00 unless running/waiting),
//   sessionId, active (writes the active-run marker),
//   events: { <session>: [[ 'HH:MM:SS', type, summary, extra? ], ...] } (extra: fields merged into the event, e.g. { detail }, { phase, toolUseId }, { ok: false }).
function seedRun(o = {}) {
  const root = o.root ?? makeFixtureRepo();
  const project = o.project ?? 'alpha', runId = o.runId ?? '20261024-0153-a1b2';
  const status = o.status ?? 'running', stage = o.stage ?? 'setup';
  const open = ['running', 'waiting'].includes(status);
  const startedAt = o.startedAt ?? o.lastActivity ?? '2026-10-24T01:53:00.000Z';
  const minute = (k) => new Date(Date.parse(startedAt) + k * 60000).toISOString();
  const stages = (o.stagesEntered ?? [stage]).map((name, i) => ({ name, startedAt: minute(i), endedAt: open && name === stage ? null : minute(i + 1) }));
  const run = {
    runId, project, flow: 'contoh-penjelasan', flowVersion: 1, request: null, topic: o.topic ?? 'Alpha', notes: '', trigger: 'chat', retryOf: null,
    sessionId: o.sessionId ?? null, claudeCodeVersion: '2.1.303', status, stage, waitReason: status === 'waiting' ? 'Naskah menunggu persetujuan' : null,
    stages, startedAt, endedAt: o.endedAt ?? (open ? null : '2026-10-24T02:00:00.000Z'), output: null, warnings: [],
    error: status === 'failed' ? { stage, message: 'x' } : null,
  };
  writeRun(root, run);
  writeJsonAtomic(runPaths(root, project, runId).flowFile, fixtureFlow());
  for (const [sid, events] of Object.entries(o.events ?? {})) {
    for (const [hms, type, summary, extra] of events) {
      appendJsonLine(sessionEventsPath(root, sid), { ts: `2026-10-24T${hms}.000Z`, sessionId: sid, runId: null, type, tool: null, summary, ok: true, ...extra });
    }
  }
  if (o.active) writeActiveRun(root, { runId, project, sessionId: run.sessionId, startedAt });
  return { root, project, runId };
}

const NOW = new Date('2026-10-24T02:00:00Z');

it('displayStatus mengikuti aturan berurutan', () => {
  const now = new Date('2026-10-24T02:10:00Z'); const recent = new Date('2026-10-24T02:09:00Z'); const run = { status: 'running' };
  expect(displayStatus({ status: 'success' }, null, recent, now)).toBe('success');
  expect(displayStatus({ status: 'waiting' }, null, recent, now)).toBe('waiting');
  expect(displayStatus(run, { type: 'notification', detail: { notificationType: 'permission_prompt' } }, recent, now)).toBe('waiting-permission');
  expect(displayStatus(run, { type: 'stop', detail: { backgroundTasks: 0 } }, recent, now)).toBe('stopped');
  expect(displayStatus(run, { type: 'stop', detail: { backgroundTasks: 1 } }, recent, now)).toBe('running');
  expect(displayStatus(run, { type: 'command' }, new Date('2026-10-24T01:54:59Z'), now)).toBe('abandoned');
  expect(displayStatus(run, { type: 'command' }, new Date('2026-10-24T01:56:00Z'), now)).toBe('running');
});
it('timeline: prompt pemicu masuk, event sesi lain dan setelah selesai tidak', () => {
  const { root, project, runId } = seedRun({ startedAt: '2026-10-24T01:53:00.000Z', endedAt: '2026-10-24T02:00:00.000Z', status: 'success', sessionId: 's1',
    events: { s1: [['01:50:00', 'prompt', 'lama'], ['01:52:59', 'prompt', '/buat-video req=7f3a'], ['01:55:00', 'skill', 'remotion-official'], ['02:05:00', 'prompt', 'sesudah']],
              s2: [['01:56:00', 'skill', 'lain']] } });
  const d = readRunDetail(root, project, runId);
  expect(d.triggerPrompt).toBe('/buat-video req=7f3a');
  expect(d.timeline.filter(t => t.type !== 'stage').map(t => t.summary)).toEqual(['/buat-video req=7f3a', 'remotion-official']);
});
it('summarizeRun', () => {
  const ev = [
    { type: 'skill', summary: 'remotion-official', ok: true },
    { type: 'command', phase: 'end', summary: 'uv run tools/voiceover.py --scene-dir x', ok: true },
    { type: 'command', phase: 'end', summary: 'node dashboard/bin/run.mjs render', ok: true, detail: { durationMs: 65000 } },
    { type: 'file', summary: 'projects/a/VOICEOVER-SCRIPT.md', ok: true },
    { type: 'tool', summary: 'Read', ok: true }, { type: 'tool', summary: 'Grep', ok: true },
    { ts: 't9', type: 'command', phase: 'end', summary: 'node dashboard/bin/run.mjs install', ok: false, error: 'Exit code 1' },
  ];
  expect(summarizeRun(ev, ['remotion-official', 'frontend-design'])).toEqual({
    skillsUsed: ['remotion-official'], skillsPlannedNotUsed: ['frontend-design'], pythonTools: ['voiceover'],
    filesChanged: ['projects/a/VOICEOVER-SCRIPT.md'], commandCount: 3, readCount: 2, renderMs: 65000,
    lastError: { ts: 't9', summary: 'node dashboard/bin/run.mjs install', error: 'Exit code 1' } });
});
it('listRuns menandai run.json rusak tanpa menjatuhkan yang lain', () => {
  const { root, project } = seedRun({ status: 'success' });
  fs.mkdirSync(path.join(root, 'projects', project, 'runs', 'rusak')); fs.writeFileSync(path.join(root, 'projects', project, 'runs', 'rusak', 'run.json'), '{');
  const list = listRuns(root);
  expect(list).toHaveLength(2); expect(list.at(-1)).toMatchObject({ runId: 'rusak', corrupt: true });
});
it('readRunDetail: tahap selesai, aktif, dilewati, dan gagal', () => {
  const { root, project, runId } = seedRun({ status: 'running', stage: 'render', stagesEntered: ['setup', 'script', 'compose', 'render'] });
  expect(readRunDetail(root, project, runId, NOW).stages.map(s => s.state))
    .toEqual(['done', 'done', 'skipped', 'skipped', 'done', 'skipped', 'active', 'pending', 'pending']);
  const f = seedRun({ status: 'failed', stage: 'render', stagesEntered: ['setup', 'render'] });
  expect(readRunDetail(f.root, f.project, f.runId, NOW).stages.find(s => s.name === 'render').state).toBe('failed');
});
it('markRunFailed hanya untuk run terhenti atau berhenti dan membersihkan penanda aktif', () => {
  const { root, project, runId } = seedRun({ status: 'running', lastActivity: '2026-10-24T01:00:00.000Z', active: true });
  markRunFailed(root, project, runId, 'Ditandai gagal dari dashboard.', new Date('2026-10-24T02:00:00Z'));
  expect(readRun(root, project, runId).value).toMatchObject({ status: 'failed', error: { message: 'Ditandai gagal dari dashboard.' } });
  expect(readActiveRun(root)).toBeNull();
  const ok = seedRun({ status: 'success' });
  expect(() => markRunFailed(ok.root, ok.project, ok.runId, 'x', new Date())).toThrow('statusnya Sukses');
});
it('skillUsage menghitung run', () => {
  const { root } = seedRun({ status: 'success', sessionId: 's1', events: { s1: [['01:55:00', 'skill', 'remotion-official']] } });
  expect(skillUsage(root)['remotion-official'].runs).toBe(1);
});

it('runWindowEvents: tanpa prompt pemicu jendela mulai di startedAt; run berjalan berakhir di now; tanpa sesi kosong', () => {
  const events = { s1: [['01:52:00', 'skill', 'sebelum'], ['01:55:00', 'skill', 'dalam'], ['02:30:00', 'skill', 'setelah now']] };
  const { root, project, runId } = seedRun({ status: 'running', sessionId: 's1', events });
  const run = readRun(root, project, runId).value;
  expect(runWindowEvents(root, run, NOW).map(e => e.summary)).toEqual(['dalam']);
  expect(runWindowEvents(root, { ...run, sessionId: null }, NOW)).toEqual([]);
});
it('log sesi rusak atau tak terbaca tidak menjatuhkan listRuns, readRunDetail, dan skillUsage', () => {
  const { root, project, runId } = seedRun({ status: 'running', sessionId: 's1' });
  const log = sessionEventsPath(root, 's1');
  fs.mkdirSync(log, { recursive: true }); // a folder where the log should be: readJsonLines rethrows EISDIR
  expect(listRuns(root, NOW)[0]).toMatchObject({ runId, displayStatus: 'running' });
  expect(readRunDetail(root, project, runId, NOW)).toMatchObject({ timeline: expect.any(Array), summary: { commandCount: 0 } });
  expect(skillUsage(root)).toEqual({});
  fs.rmSync(log, { recursive: true });
  fs.writeFileSync(log, `{"ts":"2026-10-24T01:55:00.000Z","sessionId":"s1","runId":null,"type":"skill","tool":null,"summary":"ok","ok":true}\n{rusak\n`);
  expect(readRunDetail(root, project, runId, NOW).summary.skillsUsed).toEqual(['ok']);
});
// A line that is JSON but has the wrong shape (here an object summary) used to reach the Timeline and RunPanel and crash them into error.tsx.
it('baris event yang bentuknya salah dilewati, event hook tanpa summary tetap dibaca', () => {
  const { root, project, runId } = seedRun({ status: 'running', sessionId: 's1', events: { s1: [['01:55:00', 'skill', 'ok']] } });
  const log = sessionEventsPath(root, 's1');
  const line = { ts: '2026-10-24T01:56:00.000Z', sessionId: 's1', runId: null, type: 'skill', tool: null, ok: true };
  appendJsonLine(log, { ...line, summary: { nama: 'objek' } });
  appendJsonLine(log, { ...line, type: 'bukan-tipe', summary: 'x' });
  appendJsonLine(log, { ...line, ts: 'kemarin', summary: 'y' });
  const run = readRun(root, project, runId).value;
  expect(runWindowEvents(root, run, NOW).map(e => e.summary)).toEqual(['ok']);
  expect(readRunDetail(root, project, runId, NOW).timeline.filter(e => e.type === 'skill').map(e => e.summary)).toEqual(['ok']);
  expect(skillUsage(root, NOW)).toEqual({ ok: { runs: 1, lastUsedAt: '2026-10-24T01:55:00.000Z' } });
  // The hook writes stop, session-start and session-end events without a summary: they must not be dropped with the bad lines.
  appendJsonLine(log, { ts: '2026-10-24T01:57:00.000Z', sessionId: 's1', runId: null, type: 'stop', tool: null, ok: true, detail: { backgroundTasks: 0 } });
  expect(listRuns(root, NOW)[0].displayStatus).toBe('stopped');
});
it('listRuns: urut startedAt menurun dan status efektif memakai now', () => {
  const root = makeFixtureRepo();
  const seed = (runId, startedAt, status) => {
    const run = { runId, project: 'alpha', flow: 'contoh-penjelasan', flowVersion: 1, request: null, topic: 'T', notes: '', trigger: 'chat', retryOf: null, sessionId: null,
      claudeCodeVersion: null, status, stage: 'setup', waitReason: null, stages: [{ name: 'setup', startedAt, endedAt: null }], startedAt, endedAt: null, output: null, warnings: [], error: null };
    writeRun(root, run);
  };
  seed('lama', '2026-10-24T00:00:00.000Z', 'running'); seed('baru', '2026-10-24T01:55:00.000Z', 'running');
  const list = listRuns(root, NOW);
  expect(list.map(r => [r.runId, r.displayStatus])).toEqual([['baru', 'running'], ['lama', 'abandoned']]);
  expect(list[0]).toMatchObject({ project: 'alpha', topic: 'T', flow: 'contoh-penjelasan', trigger: 'chat', stage: 'setup', corrupt: false, durationMs: 5 * 60000 });
});
it('readRunDetail: naskah saat menunggu, frame berurutan, run hilang atau rusak atau id berbahaya jadi null', () => {
  const { root, project, runId } = seedRun({ status: 'waiting', stage: 'script' });
  fs.writeFileSync(path.join(root, 'projects', project, 'VOICEOVER-SCRIPT.md'), '# Naskah');
  const { framesDir } = runPaths(root, project, runId);
  fs.mkdirSync(framesDir, { recursive: true });
  for (const n of ['frame-10.jpg', 'frame-2.jpg', 'frame-1.jpg', 'catatan.txt']) fs.writeFileSync(path.join(framesDir, n), 'x');
  const d = readRunDetail(root, project, runId, NOW);
  expect(d).toMatchObject({ displayStatus: 'waiting', script: '# Naskah', flowSnapshot: { id: 'contoh-penjelasan' }, run: { runId } });
  expect(d.frames).toEqual([1, 2, 10].map(n => `projects/${project}/runs/${runId}/frames/frame-${n}.jpg`));
  expect(d.summary.skillsPlannedNotUsed).toEqual(['remotion-best-practices']);
  expect(readRunDetail(root, project, 'tidak-ada', NOW)).toBeNull();
  expect(readRunDetail(root, project, '..', NOW)).toBeNull();
  expect(readRunDetail(root, '../..', runId, NOW)).toBeNull();
  fs.writeFileSync(runPaths(root, project, runId).runFile, '{');
  expect(readRunDetail(root, project, runId, NOW)).toBeNull();
  const running = seedRun({ status: 'running', stage: 'script' });
  expect(readRunDetail(running.root, running.project, running.runId, NOW)).toMatchObject({ script: null, frames: [] });
});
it('markRunFailed: Claude berhenti boleh, menutup tahap terbuka, dan tidak menyentuh penanda run lain', () => {
  const { root, project, runId } = seedRun({ status: 'running', stage: 'render', stagesEntered: ['setup', 'render'], sessionId: 's1', active: true,
    events: { s1: [['01:54:00', 'stop', '', { detail: { backgroundTasks: 0 } }]] } });
  markRunFailed(root, project, runId, 'Ditandai gagal.', NOW);
  const run = readRun(root, project, runId).value;
  expect(run).toMatchObject({ status: 'failed', endedAt: NOW.toISOString(), waitReason: null, error: { stage: 'render', message: 'Ditandai gagal.' } });
  expect(run.stages.every(s => s.endedAt)).toBe(true);
  expect(readActiveRun(root)).toBeNull();

  const other = seedRun({ status: 'running', lastActivity: '2026-10-24T01:00:00.000Z' });
  writeActiveRun(other.root, { runId: 'run-lain', project: 'alpha', sessionId: null, startedAt: '2026-10-24T01:00:00.000Z' });
  markRunFailed(other.root, other.project, other.runId, 'x', NOW);
  expect(readActiveRun(other.root)).toMatchObject({ runId: 'run-lain' });

  const live = seedRun({ status: 'running', startedAt: '2026-10-24T01:55:00.000Z' });
  expect(() => markRunFailed(live.root, live.project, live.runId, 'x', NOW)).toThrow('Run ini tidak bisa ditandai gagal karena statusnya Berjalan.');
  expect(() => markRunFailed(live.root, live.project, 'tidak-ada', 'x', NOW)).toThrow('tidak ditemukan');
});
it('skillUsage: hitung run per skill, lastUsedAt terbaru, event di luar jendela tidak dihitung', () => {
  const { root } = seedRun({ status: 'success', sessionId: 's1',
    events: { s1: [['01:55:00', 'skill', 'a'], ['01:56:00', 'skill', 'a'], ['01:57:00', 'skill', 'b'], ['02:30:00', 'skill', 'c']] } });
  seedRun({ root, project: 'beta', runId: '20261024-0200-c3d4', status: 'success', sessionId: 's2', startedAt: '2026-10-24T01:57:30.000Z', events: { s2: [['01:58:00', 'skill', 'a']] } });
  expect(skillUsage(root)).toEqual({ a: { runs: 2, lastUsedAt: '2026-10-24T01:58:00.000Z' }, b: { runs: 1, lastUsedAt: '2026-10-24T01:57:00.000Z' } });
});

const STOP = ['01:54:00', 'stop', '', { detail: { backgroundTasks: 0 } }];
const IDLE = ['01:55:00', 'notification', 'Claude is waiting for your input', { detail: { notificationType: 'idle_prompt' } }];
const PERMISSION = ['01:56:00', 'notification', 'Claude needs your permission', { detail: { notificationType: 'permission_prompt' } }];

it('displayStatus: StopFailure dan akhir sesi berarti Claude berhenti', () => {
  const now = new Date('2026-10-24T02:10:00Z'); const recent = new Date('2026-10-24T02:09:00Z'); const run = { status: 'running' };
  expect(displayStatus(run, { type: 'stop', ok: false, error: 'rate_limit' }, recent, now)).toBe('stopped');
  expect(displayStatus(run, { type: 'session-end', detail: { reason: 'logout' } }, recent, now)).toBe('stopped');
  expect(displayStatus(run, { type: 'stop', ok: true }, recent, now)).toBe('running'); // a stop that says nothing about background work
});
it('notifikasi idle_prompt setelah berhenti tidak menutupi status berhenti, permission_prompt tetap menunggu izin', () => {
  const status = (events) => {
    const { root, project, runId } = seedRun({ status: 'running', sessionId: 's1', events: { s1: events } });
    return { root, project, runId, shown: listRuns(root, NOW)[0].displayStatus, detail: readRunDetail(root, project, runId, NOW).displayStatus };
  };
  const stopped = status([STOP, IDLE]);
  expect([stopped.shown, stopped.detail]).toEqual(['stopped', 'stopped']);
  markRunFailed(stopped.root, stopped.project, stopped.runId, 'Ditandai gagal.', NOW); // not refused until the 15-minute stale rule
  expect(readRun(stopped.root, stopped.project, stopped.runId).value.status).toBe('failed');
  expect(status([STOP, PERMISSION, IDLE]).shown).toBe('waiting-permission'); // the permission prompt is still the last event that counts
  expect(status([STOP, IDLE, ['01:57:00', 'tool', 'Read']]).shown).toBe('running'); // Claude went on after the stop
  expect(status([['01:54:00', 'session-end', '', { detail: { reason: 'other' } }], IDLE]).shown).toBe('stopped');
  expect(status([['01:54:00', 'stop', '', { ok: false, detail: undefined }], IDLE]).shown).toBe('stopped');
});
// A permission prompt keeps a run alive past 15 minutes (JMB-05), so if Claude Code died at the prompt this is the only way out.
it('markRunFailed: run yang menunggu izin boleh ditandai gagal, juga lewat dari 15 menit', () => {
  const later = new Date('2026-10-24T03:00:00Z');
  const { root, project, runId } = seedRun({ status: 'running', sessionId: 's1', active: true, events: { s1: [PERMISSION] } });
  expect(listRuns(root, later)[0].displayStatus).toBe('waiting-permission');
  markRunFailed(root, project, runId, 'Ditandai gagal.', later);
  expect(readRun(root, project, runId).value).toMatchObject({ status: 'failed', error: { message: 'Ditandai gagal.' } });
  expect(readActiveRun(root)).toBeNull();
});
it('tahap saat ini gagal pada run yang berakhir tanpa sukses, sama untuk yang sudah dan belum disapu', () => {
  const states = (o) => { const r = seedRun({ stage: 'render', stagesEntered: ['setup', 'render'], ...o }); return readRunDetail(r.root, r.project, r.runId, NOW).stages.map(s => s.state); };
  const failed = ['done', 'skipped', 'skipped', 'skipped', 'skipped', 'skipped', 'failed', 'pending', 'pending'];
  expect(states({ status: 'abandoned' })).toEqual(failed); // swept: every stage closed
  expect(states({ status: 'cancelled' })).toEqual(failed);
  expect(states({ status: 'running', startedAt: '2026-10-24T01:00:00.000Z' })).toEqual(failed); // not swept yet: stored running, display abandoned
  expect(states({ status: 'running' })[6]).toBe('active');
  expect(states({ status: 'running', sessionId: 's1', events: { s1: [STOP] } })[6]).toBe('active'); // Claude stopped, the run can still go on
  expect(states({ status: 'success', stage: 'done', stagesEntered: ['setup', 'render', 'done'] })[8]).toBe('done');
});
it('jendela run memuat event akhir perintah yang menutup run, bukan event akhir lain di luar jendela', () => {
  const { root, project, runId } = seedRun({ status: 'success', sessionId: 's1', endedAt: '2026-10-24T02:00:00.000Z', events: { s1: [
    ['01:58:00', 'command', 'node dashboard/bin/run.mjs render', { phase: 'start', toolUseId: 't0' }],
    ['01:59:00', 'command', 'node dashboard/bin/run.mjs render', { phase: 'end', toolUseId: 't0', detail: { durationMs: 60000 } }],
    ['01:59:55', 'command', 'node dashboard/bin/run.mjs finish', { phase: 'start', toolUseId: 't1' }],
    ['02:00:05', 'command', 'node dashboard/bin/run.mjs finish', { phase: 'end', toolUseId: 't1' }], // run.json says endedAt 02:00:00 by now
    ['02:00:06', 'command', 'npm test', { phase: 'end', toolUseId: 't9' }], // its start is not in the window
    ['02:00:07', 'skill', 'sesudah'],
  ] } });
  const d = readRunDetail(root, project, runId);
  expect(d.timeline.filter(t => t.type !== 'stage').map(t => [t.summary.split(' ').at(-1), t.phase])).toEqual([
    ['render', 'start'], ['render', 'end'], ['finish', 'start'], ['finish', 'end']]);
  expect(d.summary).toMatchObject({ commandCount: 2, renderMs: 60000 });
  expect(runWindowEvents(root, d.run, NOW)).toHaveLength(4);
});
it('log sesi dibaca sekali per readRunDetail', () => {
  const { root, project, runId } = seedRun({ status: 'running', sessionId: 's1', events: { s1: [STOP, IDLE] } });
  const log = sessionEventsPath(root, 's1');
  const spy = vi.spyOn(fs, 'readFileSync');
  try {
    readRunDetail(root, project, runId, NOW);
    expect(spy.mock.calls.filter(([file]) => file === log)).toHaveLength(1);
    spy.mockClear();
    listRuns(root, NOW);
    expect(spy.mock.calls.filter(([file]) => file === log)).toHaveLength(1);
  } finally { spy.mockRestore(); }
});
