import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { addReference, archiveFlow, duplicateFlow, listFlows, readFlow, saveFlow } from './flows.mjs';
import { startRun } from './run-ops.mjs';
import { at, fixtureFlow, makeFixtureRepo, testDeps } from './test-utils.mjs';

const flowFile = (root, id) => path.join(root, 'flows', id, 'flow.json');

it('create lalu update menaikkan versi; versi basi ditolak', () => {
  const root = makeFixtureRepo(); const f = fixtureFlow({ id: 'baru', name: 'Baru' });
  expect(saveFlow(root, f, { mode: 'create' }, at('2026-10-24T03:00:00')).flow.version).toBe(1);
  const u = saveFlow(root, { ...f, name: 'Baru 2' }, { mode: 'update', expectedVersion: 1 }, at('2026-10-24T03:01:00Z'));
  expect(u.flow).toMatchObject({ version: 2, updatedAt: '2026-10-24T03:01:00.000Z' });
  expect(saveFlow(root, f, { mode: 'update', expectedVersion: 1 }).errors)
    .toEqual(['Alur sudah diubah di tempat lain (sekarang versi 2). Muat ulang halaman.']);
  expect(saveFlow(root, f, { mode: 'create' }).errors).toEqual(['ID alur "baru" sudah dipakai.']);
});

it('alur tidak valid tidak disimpan', () => {
  const root = makeFixtureRepo(); const before = fs.readFileSync(flowFile(root, 'contoh-penjelasan'), 'utf8');
  const r = saveFlow(root, fixtureFlow({ template: 'pyt' }), { mode: 'update' });
  expect(r.ok).toBe(false);
  expect(fs.readFileSync(flowFile(root, 'contoh-penjelasan'), 'utf8')).toBe(before);
});

it('saveFlow: id tidak aman, alur hilang, file rusak, dan field asing', () => {
  const root = makeFixtureRepo();
  const bad = saveFlow(root, fixtureFlow({ id: '../luar' }), { mode: 'create' });
  expect(bad.ok).toBe(false);
  expect(fs.existsSync(path.join(root, 'luar'))).toBe(false);
  expect(saveFlow(root, fixtureFlow({ id: 'hilang' }), { mode: 'update' }).errors).toEqual(['Alur "hilang" tidak ditemukan.']);
  expect(saveFlow(root, 'bukan objek', { mode: 'create' }).ok).toBe(false);
  fs.mkdirSync(path.join(root, 'flows', 'rusak')); fs.writeFileSync(flowFile(root, 'rusak'), '{');
  expect(saveFlow(root, fixtureFlow({ id: 'rusak' }), { mode: 'update' }).ok).toBe(false); // a cut-off file is not silently overwritten
  expect(fs.readFileSync(flowFile(root, 'rusak'), 'utf8')).toBe('{');
  saveFlow(root, { ...fixtureFlow({ id: 'typo' }), nama: 'salah ketik' }, { mode: 'create' });
  expect(JSON.parse(fs.readFileSync(flowFile(root, 'typo'), 'utf8'))).not.toHaveProperty('nama');
});

it('duplikat dan arsip tanpa hapus permanen', () => {
  const root = makeFixtureRepo();
  expect(duplicateFlow(root, 'contoh-penjelasan').flow).toMatchObject({ id: 'contoh-penjelasan-salinan', version: 1, name: 'Contoh Penjelasan (salinan)' });
  expect(duplicateFlow(root, 'contoh-penjelasan').flow.id).toBe('contoh-penjelasan-salinan-2');
  expect(duplicateFlow(root, 'tidak-ada').errors).toEqual(['Alur "tidak-ada" tidak ditemukan.']);
  fs.mkdirSync(path.join(root, 'flows', 'rusak')); fs.writeFileSync(flowFile(root, 'rusak'), '{');
  expect(duplicateFlow(root, 'rusak').ok).toBe(false);
  const { archivedTo } = archiveFlow(root, 'contoh-penjelasan-salinan', at('2026-10-24T03:02:03'));
  expect(archivedTo).toBe('flows/.archive/contoh-penjelasan-salinan-20261024030203');
  expect(fs.existsSync(path.join(root, archivedTo, 'flow.json'))).toBe(true);
  expect(listFlows(root).map(f => f.id)).toEqual(['contoh-penjelasan', 'contoh-penjelasan-salinan-2', 'rusak']);
  expect(() => archiveFlow(root, 'contoh-penjelasan-salinan')).toThrow('tidak ditemukan');
  expect(() => archiveFlow(root, '../flows')).toThrow();
});

it('addReference tidak menggandakan; listFlows menghitung video dan menandai rusak', () => {
  const root = makeFixtureRepo();
  addReference(root, 'contoh-penjelasan', { kind: 'transition', id: 'zoomBlur' });
  expect(readFlow(root, 'contoh-penjelasan').flow.references.filter(r => r.id === 'zoomBlur')).toHaveLength(1);
  startRun(root, { flow: 'contoh-penjelasan', topic: 'A' }, testDeps());
  fs.mkdirSync(path.join(root, 'flows', 'rusak')); fs.writeFileSync(path.join(root, 'flows', 'rusak', 'flow.json'), '{');
  const list = listFlows(root);
  expect(list.find(f => f.id === 'contoh-penjelasan').videoCount).toBe(1);
  expect(list.find(f => f.id === 'rusak').corrupt).toBe(true);
});

it('addReference menambah referensi baru dan menaikkan versi; duplikat tidak mengubah file', () => {
  const root = makeFixtureRepo();
  const dup = addReference(root, 'contoh-penjelasan', { kind: 'example', id: 'hello-world' });
  expect(dup).toMatchObject({ ok: true, flow: { version: 1 } });
  const added = addReference(root, 'contoh-penjelasan', { kind: 'link', url: 'https://a.test' }, at('2026-10-24T04:00:00Z'));
  expect(added.flow).toMatchObject({ version: 2, updatedAt: '2026-10-24T04:00:00.000Z' });
  expect(addReference(root, 'contoh-penjelasan', { kind: 'link', url: 'https://a.test', note: 'lagi' }).flow.version).toBe(2);
  expect(addReference(root, 'contoh-penjelasan', { kind: 'brand' }).ok).toBe(false); // brand needs an id
  expect(addReference(root, 'tidak-ada', { kind: 'brand', id: 'default' }).errors).toEqual(['Alur "tidak-ada" tidak ditemukan.']);
});

it('readFlow: tidak ada, rusak, tidak valid, dan id yang tidak aman', () => {
  const root = makeFixtureRepo();
  expect(readFlow(root, 'tidak-ada')).toBeNull();
  expect(readFlow(root, '../flows')).toBeNull();
  expect(readFlow(root, '.archive')).toBeNull();
  fs.mkdirSync(path.join(root, 'flows', 'rusak')); fs.writeFileSync(flowFile(root, 'rusak'), '{');
  expect(readFlow(root, 'rusak')).toMatchObject({ flow: null, corrupt: true });
  fs.mkdirSync(path.join(root, 'flows', 'kosong')); // folder without flow.json
  expect(readFlow(root, 'kosong')).toMatchObject({ flow: null, corrupt: true });
  fs.mkdirSync(path.join(root, 'flows', 'salah')); fs.writeFileSync(flowFile(root, 'salah'), JSON.stringify({ ...fixtureFlow({ id: 'salah' }), template: 'pyt' }));
  const bad = readFlow(root, 'salah');
  expect(bad).toMatchObject({ corrupt: false, flow: { id: 'salah' } });
  expect(bad.errors).toEqual(['Template "pyt" berbasis Python dan belum bisa dipakai di alur v1.']);
  fs.mkdirSync(path.join(root, 'flows', 'beda')); fs.writeFileSync(flowFile(root, 'beda'), JSON.stringify(fixtureFlow({ id: 'lain' })));
  expect(readFlow(root, 'beda').errors).toEqual(['id: ID di flow.json ("lain") tidak sama dengan nama folder ("beda").']);
  const ok = readFlow(root, 'contoh-penjelasan');
  expect(ok).toMatchObject({ corrupt: false, errors: [], warnings: [], flow: { id: 'contoh-penjelasan', version: 1 } });
});

it('listFlows: ringkasan, peringatan durasi, tanpa folder titik, dan lastUsedAt', () => {
  const root = makeFixtureRepo();
  fs.mkdirSync(path.join(root, 'flows', '.archive', 'lama-1'), { recursive: true });
  fs.mkdirSync(path.join(root, 'flows', '.git-ish'));
  fs.writeFileSync(path.join(root, 'flows', 'berkas.txt'), 'bukan folder');
  saveFlow(root, fixtureFlow({ id: 'pendek', output: { ...fixtureFlow().output, targetDurationSeconds: 60 } }), { mode: 'create' }, at('2026-10-24T05:00:00Z'));
  const list = listFlows(root);
  expect(list.map(f => f.id)).toEqual(['contoh-penjelasan', 'pendek']);
  expect(list[0]).toEqual({ id: 'contoh-penjelasan', name: 'Contoh Penjelasan', template: 'rem', brand: 'default', aspectRatio: '16:9', sceneCount: 4,
    totalSeconds: 28, targetSeconds: 30, version: 1, updatedAt: '2026-10-24T00:00:00.000Z', skills: ['remotion-best-practices'], videoCount: 0, lastUsedAt: null, errors: [], warnings: [], corrupt: false });
  expect(list[1].warnings).toHaveLength(1);
  startRun(root, { flow: 'pendek', topic: 'A' }, testDeps());
  const used = listFlows(root).find(f => f.id === 'pendek');
  expect(used).toMatchObject({ videoCount: 1, lastUsedAt: new Date(2026, 9, 24, 1, 53).toISOString() });
});
