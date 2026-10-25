import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { Readable } from 'node:stream';
import { readJson } from './jsonfile.mjs';
import { createRequest, repeatRequest, retryPrompt } from './requests.mjs';
import { startRun } from './run-ops.mjs';
import { readRun, requestPath } from './run-store.mjs';
import { saveUpload } from './uploads.mjs';
import { at, makeFixtureRepo, testDeps } from './test-utils.mjs';

it('createRequest memvalidasi dan menulis permintaan', () => {
  const root = makeFixtureRepo();
  expect(createRequest(root, { flow: 'contoh-penjelasan', topic: '  ', notes: '' }).errors).toEqual(['Topik wajib diisi.']);
  const r = createRequest(root, { flow: 'contoh-penjelasan', topic: 'Halo', notes: 'n' });
  expect(r.id).toMatch(/^[0-9a-f]{6}$/); expect(r.prompt).toBe(`/buat-video req=${r.id}`);
  expect(readJson(requestPath(root, r.id)).value).toMatchObject({ flow: 'contoh-penjelasan', topic: 'Halo', status: 'baru', runId: null });
  expect(retryPrompt('20261024-0153-a1b2')).toBe('/buat-video perbaiki=20261024-0153-a1b2');
});

it('createRequest: batas panjang, alur hilang atau tidak valid, dan isi file', () => {
  const root = makeFixtureRepo();
  const ok = { flow: 'contoh-penjelasan', topic: 'x'.repeat(200), notes: 'y'.repeat(2000) };
  expect(createRequest(root, ok).ok).toBe(true);
  expect(createRequest(root, { ...ok, topic: 'x'.repeat(201), notes: 'y'.repeat(2001) }).errors)
    .toEqual(['Topik maksimal 200 karakter.', 'Catatan maksimal 2000 karakter.']);
  expect(createRequest(root, { ...ok, topic: undefined }).errors).toEqual(['Topik wajib diisi.']);
  expect(createRequest(root, { ...ok, flow: 'tidak-ada' }).errors).toEqual(['Alur "tidak-ada" tidak ditemukan.']);
  expect(createRequest(root, { ...ok, flow: '../x' }).errors).toEqual(['Alur "../x" tidak ditemukan.']);
  fs.mkdirSync(path.join(root, 'flows', 'rusak')); fs.writeFileSync(path.join(root, 'flows', 'rusak', 'flow.json'), '{');
  expect(createRequest(root, { ...ok, flow: 'rusak' }).errors[0]).toBe('Alur "rusak" tidak valid.');
  fs.mkdirSync(path.join(root, 'flows', 'salah'));
  fs.writeFileSync(path.join(root, 'flows', 'salah', 'flow.json'),
    JSON.stringify({ ...JSON.parse(fs.readFileSync(path.join(root, 'flows', 'contoh-penjelasan', 'flow.json'), 'utf8')), id: 'salah', template: 'pyt' }));
  expect(createRequest(root, { ...ok, flow: 'salah' }).errors)
    .toEqual(['Alur "salah" tidak valid.', 'Template "pyt" berbasis Python dan belum bisa dipakai di alur v1.']);
  const made = createRequest(root, { flow: 'contoh-penjelasan', topic: '  Halo  ', notes: ' n ' }, at('2026-10-24T03:00:00Z'));
  expect(readJson(requestPath(root, made.id)).value)
    .toEqual({ id: made.id, flow: 'contoh-penjelasan', topic: 'Halo', notes: 'n', uploads: null, sources: [], createdAt: '2026-10-24T03:00:00.000Z', status: 'baru', runId: null });
});

it('repeatRequest membuat permintaan baru dari run lama', () => {
  const root = makeFixtureRepo();
  const run = startRun(root, { flow: 'contoh-penjelasan', topic: 'Kopi & Teh', notes: 'santai' }, testDeps());
  const r = repeatRequest(root, run.project, run.runId);
  expect(r.ok).toBe(true);
  expect(readJson(requestPath(root, r.id)).value).toMatchObject({ flow: 'contoh-penjelasan', topic: 'Kopi & Teh', notes: 'santai', status: 'baru', runId: null });
  expect(repeatRequest(root, run.project, '20990101-0000-zzzz').errors).toEqual(['Run "20990101-0000-zzzz" tidak ditemukan.']);
  expect(repeatRequest(root, '..', run.runId).ok).toBe(false);
});

it('createRequest mencatat file sumber yang dipilih, repeatRequest membawanya lagi', async () => {
  const root = makeFixtureRepo();
  const up = await saveUpload(root, { name: 'Rekaman.mp4' }, Readable.from([Buffer.from('abc')]));
  const base = { flow: 'contoh-penjelasan', topic: 'Edit rekaman', notes: '' };
  expect(createRequest(root, { ...base, uploads: up.batch, files: ['hilang.mp4'] }).errors)
    .toEqual(['File sumber "hilang.mp4" tidak ditemukan di folder unggahan.']);
  const r = createRequest(root, { ...base, uploads: up.batch, files: [up.name] });
  const sources = [{ name: 'rekaman.mp4', kind: 'video', sizeBytes: 3 }];
  expect(readJson(requestPath(root, r.id)).value).toMatchObject({ uploads: up.batch, sources });
  const run = startRun(root, { request: r.id }, testDeps());
  expect(readRun(root, run.project, run.runId).value.sources).toEqual(sources);
  const again = repeatRequest(root, run.project, run.runId);
  expect(readJson(requestPath(root, again.id)).value).toMatchObject({ topic: 'Edit rekaman', uploads: up.batch, sources });
});
