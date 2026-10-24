import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { readJson, writeJsonAtomic } from './jsonfile.mjs';
import { listProjectRuns, listProjects, readProjectDetail } from './projects.mjs';
import { finishRun, startRun } from './run-ops.mjs';
import { readRun, runPaths, writeRun } from './run-store.mjs';
import { makeFixtureRepo, placeFrame, testDeps, writeVideo } from './test-utils.mjs';

const PROBE = { durationSeconds: 28, width: 1920, height: 1080, fps: 30, sizeBytes: 4 };

// A project "alpha" with one successful run, plus a newer failed run and a newest run whose run.json is cut off.
function alphaWithThreeRuns() {
  const root = makeFixtureRepo(); const d = testDeps({ probe: PROBE });
  const a = startRun(root, { flow: 'contoh-penjelasan', topic: 'Alpha' }, d);
  writeVideo(root, 'alpha', a.runId, 'data'); finishRun(root, d);
  const failedId = '20261024-0300-f00d';
  writeRun(root, { ...readRun(root, 'alpha', a.runId).value, runId: failedId, status: 'failed', output: null, retryOf: a.runId,
    error: { stage: 'render', message: 'x' }, startedAt: '2026-10-24T03:00:00.000Z', endedAt: '2026-10-24T03:05:00.000Z' });
  writeVideo(root, 'alpha', failedId, 'render ok, finish gagal'); // a failed run can leave its mp4 behind; it is not "the video"
  const brokenId = '20261024-0400-bad0';
  fs.mkdirSync(runPaths(root, 'alpha', brokenId).dir, { recursive: true });
  fs.writeFileSync(runPaths(root, 'alpha', brokenId).runFile, '{"runId":');
  return { root, okId: a.runId, failedId, brokenId };
}

it('listProjects: alur, tanpa alur, dan rusak', () => {
  const root = makeFixtureRepo(); const d = testDeps({ probe: { durationSeconds: 28, width: 1920, height: 1080, fps: 30, sizeBytes: 4 } });
  const a = startRun(root, { flow: 'contoh-penjelasan', topic: 'Alpha' }, d);
  writeVideo(root, 'alpha', a.runId, 'data'); placeFrame(root, 'alpha', a.runId); finishRun(root, d);
  writeJsonAtomic(path.join(root, 'projects', 'beta', 'project.json'), { name: 'beta', template: 'sprint-review', brand: 'default', phase: 'complete', updated: '2026-10-01T00:00:00.000Z', scenes: [], sessions: [] });
  fs.mkdirSync(path.join(root, 'projects', 'beta', 'out')); fs.writeFileSync(path.join(root, 'projects', 'beta', 'out', 'x.mp4'), 'v');
  fs.mkdirSync(path.join(root, 'projects', 'gamma')); fs.writeFileSync(path.join(root, 'projects', 'gamma', 'project.json'), '{');
  fs.mkdirSync(path.join(root, 'projects', '.trash'));
  const list = listProjects(root);
  expect(list.map(p => p.slug).sort()).toEqual(['alpha', 'beta', 'gamma']);
  expect(list.find(p => p.slug === 'alpha')).toMatchObject({ title: 'Alpha', flow: 'contoh-penjelasan', latestStatus: 'success',
    video: { file: `projects/alpha/out/${a.runId}.mp4`, durationSeconds: 28 }, thumbnail: `projects/alpha/runs/${a.runId}/frames/frame-1.jpg` });
  expect(list.find(p => p.slug === 'beta')).toMatchObject({ flow: null, video: { file: 'projects/beta/out/x.mp4', runId: null } });
  expect(list.find(p => p.slug === 'gamma').corrupt).toBe(true);
});
it('listProjects: field ringkasan, urutan updated, folder tanpa project.json, dan root tanpa projects/', () => {
  const root = makeFixtureRepo();
  expect(listProjects(root)).toEqual([]);
  const d = testDeps({ probe: PROBE });
  const a = startRun(root, { flow: 'contoh-penjelasan', topic: 'Alpha' }, d);
  writeVideo(root, 'alpha', a.runId, 'data'); finishRun(root, d);
  fs.mkdirSync(path.join(root, 'projects', 'alpha', 'node_modules'));
  writeJsonAtomic(path.join(root, 'projects', 'beta', 'project.json'), { name: 'beta', updated: '2099-01-01T00:00:00.000Z' });
  fs.mkdirSync(path.join(root, 'projects', 'kosong'));
  fs.writeFileSync(path.join(root, 'projects', 'catatan.txt'), 'bukan proyek');
  const list = listProjects(root);
  expect(list.map(p => p.slug).sort()).toEqual(['alpha', 'beta', 'kosong']);
  expect(list[0].slug).toBe('beta');
  expect(list.map(p => p.updated)).toEqual(list.map(p => p.updated).sort().reverse());
  expect(list[0]).toMatchObject({ title: 'beta', latestRunId: null, latestStatus: null, video: null, thumbnail: null, hasDeps: false, corrupt: false });
  expect(list.find(p => p.slug === 'alpha')).toMatchObject({ template: 'rem', brand: 'default', phase: 'complete', latestRunId: a.runId, hasDeps: true, corrupt: false,
    video: { runId: a.runId, width: 1920, height: 1080, fps: 30, sizeBytes: 4 }, thumbnail: null });
  expect(list.find(p => p.slug === 'kosong')).toMatchObject({ title: 'kosong', corrupt: true }); // flagged, not hidden
});
it('listProjectRuns: urut runId menurun dan run.json rusak ditandai', () => {
  const { root, okId, failedId, brokenId } = alphaWithThreeRuns();
  const runs = listProjectRuns(root, 'alpha');
  expect(runs.map(r => r.runId)).toEqual([brokenId, failedId, okId]);
  expect(runs.map(r => r.corrupt)).toEqual([true, false, false]);
  expect(runs[0].run).toBeNull();
  expect(runs[1].run).toMatchObject({ status: 'failed', retryOf: okId });
  expect(listProjectRuns(root, 'tidak-ada')).toEqual([]);
});
it('video proyek tetap run sukses terbaru walau run lebih baru gagal atau rusak; file hilang berarti tanpa video', () => {
  const { root, okId, failedId, brokenId } = alphaWithThreeRuns();
  expect(listProjects(root)[0]).toMatchObject({ latestRunId: brokenId, latestStatus: null, corrupt: false,
    video: { file: `projects/alpha/out/${okId}.mp4`, runId: okId } });
  const detail = readProjectDetail(root, 'alpha');
  expect(detail.versions.map(v => v.runId)).toEqual([okId]);
  expect(detail.runs).toEqual([
    { runId: brokenId, status: null, startedAt: null, endedAt: null, retryOf: null },
    { runId: failedId, status: 'failed', startedAt: '2026-10-24T03:00:00.000Z', endedAt: '2026-10-24T03:05:00.000Z', retryOf: okId },
    { runId: okId, status: 'success', startedAt: expect.any(String), endedAt: expect.any(String), retryOf: null }]);
  fs.rmSync(path.join(root, 'projects', 'alpha', 'out', `${okId}.mp4`)); // the failed run's mp4 is still there, and is not picked up either
  expect(listProjects(root)[0].video).toBeNull();
  expect(readProjectDetail(root, 'alpha').versions).toEqual([]);
});
it('readProjectDetail memakai scene snapshot bila project.json kosong', () => {
  const root = makeFixtureRepo(); startRun(root, { flow: 'contoh-penjelasan', topic: 'Alpha' }, testDeps());
  expect(readProjectDetail(root, 'alpha').scenes.map(s => s.id)).toEqual(['hook', 'poin', 'fakta', 'penutup']);
  expect(readProjectDetail(root, 'tidak-ada')).toBeNull();
});
it('readProjectDetail: scene project.json menang, naskah, sesi, snapshot alur, dan versi tanpa run', () => {
  const root = makeFixtureRepo(); const d = testDeps({ probe: PROBE });
  startRun(root, { flow: 'contoh-penjelasan', topic: 'Alpha' }, d);
  const file = path.join(root, 'projects', 'alpha', 'project.json');
  writeJsonAtomic(file, { ...readJson(file).value, scenes: [
    { id: 'hook', type: 'title', durationSeconds: 4, narration: 'Halo semua', status: 'ready' },
    { id: 'tambahan', durationSeconds: 2, narration: null }] });
  fs.writeFileSync(path.join(root, 'projects', 'alpha', 'VOICEOVER-SCRIPT.md'), '# Naskah\n');
  const detail = readProjectDetail(root, 'alpha');
  expect(detail.scenes).toEqual([
    { id: 'hook', label: 'Hook', durationSeconds: 4, narration: 'Halo semua' }, // label comes from the flow snapshot
    { id: 'tambahan', label: 'tambahan', durationSeconds: 2, narration: null }]);
  expect(detail).toMatchObject({ slug: 'alpha', title: 'Alpha', script: '# Naskah\n', flowSnapshot: { id: 'contoh-penjelasan', version: 1 },
    sessions: [{ date: '2026-10-24', summary: 'Dibuat oleh /buat-video (alur contoh-penjelasan v1)' }], versions: [], video: null });

  fs.mkdirSync(path.join(root, 'projects', 'alpha', 'out'));
  fs.writeFileSync(path.join(root, 'projects', 'alpha', 'out', 'lama.mp4'), 'v');
  expect(readProjectDetail(root, 'alpha').versions).toEqual([expect.objectContaining({ file: 'projects/alpha/out/lama.mp4', runId: null })]);
});
it('readProjectDetail: project.json rusak tetap menghasilkan detail; slug berbahaya ditolak', () => {
  const root = makeFixtureRepo(); startRun(root, { flow: 'contoh-penjelasan', topic: 'Alpha' }, testDeps());
  fs.writeFileSync(path.join(root, 'projects', 'alpha', 'project.json'), '{');
  const detail = readProjectDetail(root, 'alpha');
  expect(detail).toMatchObject({ corrupt: true, title: 'alpha', script: null, sessions: [] });
  expect(detail.scenes.map(s => s.id)).toEqual(['hook', 'poin', 'fakta', 'penutup']);
  fs.mkdirSync(path.join(root, 'projects', '.trash'));
  for (const bad of ['..', '.', '.trash', 'alpha/runs', 'alpha\\runs', '../projects', '', 'a\0b']) expect(readProjectDetail(root, bad), JSON.stringify(bad)).toBeNull();
  expect(readProjectDetail(root, 'alpha/../alpha')).toBeNull();
});
