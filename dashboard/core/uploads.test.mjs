import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { expect, it } from 'vitest';
import { MAX_SOURCE_FILES, SOURCE_ACCEPT, sourceKind } from './source-files.mjs';
import { copySources, readSources, safeFileName, saveUpload, uploadPath } from './uploads.mjs';
import { makeFixtureRepo, makeTempRoot } from './test-utils.mjs';

const body = (...chunks) => Readable.from(chunks.map((c) => Buffer.from(c)));
const code = async (promise) => { try { await promise; } catch (e) { return e.code; } return null; };
const files = (root, batch) => fs.readdirSync(uploadPath(root, batch)).sort();

it('sourceKind dan SOURCE_ACCEPT mengikuti ekstensi', () => {
  expect(['a.MP4', 'b.mp3', 'c.jpeg', 'd.srt', 'e.exe', 'noext', '.env', ''].map(sourceKind))
    .toEqual(['video', 'audio', 'image', 'text', null, null, null, null]);
  expect(SOURCE_ACCEPT.split(',')).toContain('.mov');
});

it('safeFileName: nama ASCII datar, ekstensi kecil, jenis lain ditolak', () => {
  const cases = {
    'Liburan Bali (1).MOV': 'liburan-bali-1.mov',
    'folder/sub/clip.mp4': 'clip.mp4',
    'C:\\x\\..\\naskah.TXT': 'naskah.txt',
    '../../etc/passwd.txt': 'passwd.txt',
    'música de fondo.mp3': 'musica-de-fondo.mp3',
    '视频.mp4': 'file.mp4',
    'CON.mp4': 'con-file.mp4',
    'a.b.c.png': 'a-b-c.png',
  };
  for (const [input, want] of Object.entries(cases)) expect(safeFileName(input), input).toBe(want);
  expect(['x.exe', 'noext', '.env', 'x.mp4.exe', '', null].map(safeFileName)).toEqual([null, null, null, null, null, null]);
});

it('saveUpload menulis ke folder unggahan baru, lalu ke folder yang sama dengan nama unik', async () => {
  const root = makeFixtureRepo();
  const a = await saveUpload(root, { name: 'Rekaman Asli.MP4' }, body('abc', 'de'));
  expect(a).toEqual({ batch: expect.stringMatching(/^[0-9a-f]{12}$/), name: 'rekaman-asli.mp4', kind: 'video', sizeBytes: 5 });
  expect(fs.readFileSync(uploadPath(root, a.batch, a.name), 'utf8')).toBe('abcde');
  const b = await saveUpload(root, { batch: a.batch, name: 'rekaman asli.mp4' }, body('x'));
  expect(b).toMatchObject({ batch: a.batch, name: 'rekaman-asli-2.mp4', sizeBytes: 1 });
  expect(files(root, a.batch)).toEqual(['rekaman-asli-2.mp4', 'rekaman-asli.mp4']); // nothing overwritten, no .part left
});

it('saveUpload menolak jenis, folder, ukuran, file kosong, dan jumlah yang salah tanpa meninggalkan sisa', async () => {
  const root = makeFixtureRepo();
  const { batch } = await saveUpload(root, { name: 'a.mp3' }, body('a'));
  expect(await code(saveUpload(root, { batch, name: 'x.exe' }, body('a')))).toBe('BAD_TYPE');
  expect(await code(saveUpload(root, { batch: '../x', name: 'a.mp3' }, body('a')))).toBe('BAD_BATCH');
  expect(await code(saveUpload(root, { batch: 'tidakada', name: 'a.mp3' }, body('a')))).toBe('BAD_BATCH');
  expect(await code(saveUpload(root, { batch, name: 'besar.mp4' }, body('12345', '67890'), 6))).toBe('TOO_LARGE');
  expect(await code(saveUpload(root, { batch, name: 'kosong.txt' }, body()))).toBe('EMPTY');
  const broken = new Readable({ read() { this.destroy(new Error('putus')); } });
  expect(await code(saveUpload(root, { batch, name: 'putus.wav' }, broken))).toBe('UPLOAD_FAILED');
  expect(files(root, batch)).toEqual(['a.mp3']);
  for (let i = 1; i < MAX_SOURCE_FILES; i++) fs.writeFileSync(uploadPath(root, batch, `f${i}.png`), 'x');
  expect(await code(saveUpload(root, { batch, name: 'lagi.png' }, body('x')))).toBe('TOO_MANY');
});

it('readSources memeriksa nama dan keberadaan file di folder unggahan', async () => {
  const root = makeFixtureRepo();
  const { batch } = await saveUpload(root, { name: 'clip.mp4' }, body('abc'));
  await saveUpload(root, { batch, name: 'musik.mp3' }, body('ab'));
  expect(readSources(root, null, [])).toEqual({ ok: true, sources: [] });
  expect(readSources(root, batch, ['musik.mp3', 'clip.mp4'])).toEqual({ ok: true, sources: [
    { name: 'musik.mp3', kind: 'audio', sizeBytes: 2 }, { name: 'clip.mp4', kind: 'video', sizeBytes: 3 }] });
  expect(readSources(root, batch, ['clip.mp4', 'hilang.mp4', '../clip.mp4', 'Clip.mp4', 42]).errors).toEqual([
    'File sumber "hilang.mp4" tidak ditemukan di folder unggahan.', 'File sumber "../clip.mp4" tidak ditemukan di folder unggahan.',
    'File sumber "Clip.mp4" tidak ditemukan di folder unggahan.', 'File sumber "42" tidak ditemukan di folder unggahan.']);
  expect(readSources(root, batch, ['clip.mp4', 'clip.mp4']).ok).toBe(false);
  expect(readSources(root, '..', ['clip.mp4']).ok).toBe(false);
  expect(readSources(root, null, ['clip.mp4']).ok).toBe(false);
});

it('copySources menyalin ke public/sources dan membiarkan file unggahan tetap ada', async () => {
  const root = makeFixtureRepo();
  const { batch } = await saveUpload(root, { name: 'clip.mp4' }, body('abc'));
  const project = makeTempRoot();
  copySources(root, batch, readSources(root, batch, ['clip.mp4']).sources, project);
  expect(fs.readFileSync(path.join(project, 'public', 'sources', 'clip.mp4'), 'utf8')).toBe('abc');
  expect(files(root, batch)).toEqual(['clip.mp4']);
});
