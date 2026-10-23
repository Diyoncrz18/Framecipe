import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { appendJsonLine } from './jsonfile.mjs';
import { activeRunPath, clearActiveRun, lastActivityAt, readActiveRun, requestPath, runPaths, safeSessionId,
  sessionEventsPath, writeActiveRun } from './run-store.mjs';
import { makeTempRoot } from './test-utils.mjs';

it('lokasi file di dalam repo, dengan path berspasi', () => {
  const root = makeTempRoot();
  expect(activeRunPath(root)).toBe(path.join(root, '.dashboard', 'active-run.json'));
  expect(requestPath(root, 'abc')).toBe(path.join(root, '.dashboard', 'requests', 'abc.json'));
  const dir = path.join(root, 'projects', 'p', 'runs', 'r1');
  expect(runPaths(root, 'p', 'r1')).toEqual({ dir, runFile: path.join(dir, 'run.json'), flowFile: path.join(dir, 'flow.json'), framesDir: path.join(dir, 'frames') });
});
it('run aktif: tulis, baca, hapus; file hilang atau rusak dibaca sebagai tidak ada', () => {
  const root = makeTempRoot();
  expect(readActiveRun(root)).toBeNull();
  writeActiveRun(root, { runId: 'r1', project: 'p', sessionId: null, startedAt: '2026-10-24T01:53:00.000Z' });
  expect(readActiveRun(root)).toMatchObject({ runId: 'r1', project: 'p', sessionId: null });
  fs.writeFileSync(activeRunPath(root), '{ rusak');
  expect(readActiveRun(root)).toBeNull();
  writeActiveRun(root, { runId: 'r1', project: 'p', sessionId: null, startedAt: 'x' });
  clearActiveRun(root); clearActiveRun(root); // clearing twice is fine
  expect(readActiveRun(root)).toBeNull();
});
it('safeSessionId menjaga id aman dan meng-hash sisanya', () => {
  expect(safeSessionId('abc-DEF_123')).toBe('abc-DEF_123');
  const hashed = safeSessionId('../../etc/passwd');
  expect(hashed).toMatch(/^[0-9a-f]{16}$/);
  expect(safeSessionId('../../etc/passwd')).toBe(hashed);
  expect(safeSessionId('a b')).not.toBe(hashed);
  expect(sessionEventsPath(makeTempRoot(), 'a/b')).toMatch(/events[\\/][0-9a-f]{16}\.jsonl$/);
});
it('lastActivityAt: terbaru dari mulai run, tahap, dan event terakhir sesi', () => {
  const root = makeTempRoot();
  const run = { sessionId: 's1', startedAt: '2026-10-24T01:53:00.000Z',
    stages: [{ name: 'setup', startedAt: '2026-10-24T01:53:00.000Z', endedAt: '2026-10-24T01:55:00.000Z' }, { name: 'script', startedAt: '2026-10-24T01:55:00.000Z', endedAt: null }] };
  expect(lastActivityAt(root, run).toISOString()).toBe('2026-10-24T01:55:00.000Z'); // no event file yet
  appendJsonLine(sessionEventsPath(root, 's1'), { ts: '2026-10-24T01:58:30.000Z' });
  appendJsonLine(sessionEventsPath(root, 's1'), { ts: '2026-10-24T02:01:10.000Z' });
  expect(lastActivityAt(root, run).toISOString()).toBe('2026-10-24T02:01:10.000Z');
  expect(lastActivityAt(root, { ...run, sessionId: null }).toISOString()).toBe('2026-10-24T01:55:00.000Z');
  fs.rmSync(sessionEventsPath(root, 's1')); fs.mkdirSync(sessionEventsPath(root, 's1')); // unreadable log (a folder): readJsonLines throws EISDIR
  expect(lastActivityAt(root, run).toISOString()).toBe('2026-10-24T01:55:00.000Z');
});
