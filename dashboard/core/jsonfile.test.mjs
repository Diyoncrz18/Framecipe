import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { appendJsonLine, readJson, readJsonLines, writeJsonAtomic } from './jsonfile.mjs';
import { makeTempRoot } from './test-utils.mjs';

it('writeJsonAtomic lalu readJson, tanpa sisa .tmp', () => {
  const dir = path.join(makeTempRoot(), 'a b'); const f = path.join(dir, 'x.json');
  writeJsonAtomic(f, { a: 1 });
  expect(readJson(f)).toEqual({ ok: true, value: { a: 1 } });
  expect(fs.readdirSync(dir)).toEqual(['x.json']);
});
it('writeJsonAtomic menimpa file lama dengan indent 2 spasi dan newline akhir', () => {
  const dir = makeTempRoot(); const f = path.join(dir, 'x.json');
  writeJsonAtomic(f, { old: true }); writeJsonAtomic(f, { a: 1, b: [2] });
  expect(fs.readFileSync(f, 'utf8')).toBe('{\n  "a": 1,\n  "b": [\n    2\n  ]\n}\n');
  expect(fs.readdirSync(dir)).toEqual(['x.json']);
});
it('writeJsonAtomic mencoba ulang saat file tujuan sedang dibuka proses lain', async () => {
  // Windows menolak rename ke file yang sedang dibuka (EPERM); di sini proses lain menahannya 150 ms.
  const dir = makeTempRoot(); const f = path.join(dir, 'x.json');
  writeJsonAtomic(f, { old: true });
  const hold = 'const fs = require("node:fs"); const fd = fs.openSync(process.argv[1], "r"); console.log("open"); setTimeout(() => fs.closeSync(fd), 150);';
  const holder = spawn(process.execPath, ['-e', hold, f], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve) => holder.stdout.once('data', resolve));
  writeJsonAtomic(f, { a: 1 });
  expect(readJson(f)).toEqual({ ok: true, value: { a: 1 } });
  expect(fs.readdirSync(dir)).toEqual(['x.json']);
});
it('readJson membedakan hilang dan rusak', () => {
  const root = makeTempRoot(); const f = path.join(root, 'r.json'); fs.writeFileSync(f, '{"a":');
  expect(readJson(path.join(root, 'nope.json'))).toMatchObject({ ok: false, error: 'missing' });
  expect(readJson(f)).toMatchObject({ ok: false, error: 'corrupt' });
});
it('readJson menerima file JSON berawalan BOM UTF-8 (Notepad lama menyimpannya begitu)', () => {
  const f = path.join(makeTempRoot(), 'bom.json'); fs.writeFileSync(f, '\uFEFF{"a":1}');
  expect(readJson(f)).toEqual({ ok: true, value: { a: 1 } });
});
it('readJsonLines melewati baris rusak', () => {
  const f = path.join(makeTempRoot(), 'e.jsonl');
  appendJsonLine(f, { n: 1 }); appendJsonLine(f, { n: 2 }); fs.appendFileSync(f, '{"n":3');
  expect(readJsonLines(f)).toEqual({ items: [{ n: 1 }, { n: 2 }], corruptLines: 1 });
});
it('readJsonLines: file hilang atau bersih tidak dihitung rusak', () => {
  const f = path.join(makeTempRoot(), 'baru', 'e.jsonl');
  expect(readJsonLines(f)).toEqual({ items: [], corruptLines: 0 });
  appendJsonLine(f, { n: 1 }); fs.appendFileSync(f, '\r\n\n{"n":2}\r\n'); // folder dibuat otomatis; baris kosong dan CRLF aman
  expect(readJsonLines(f)).toEqual({ items: [{ n: 1 }, { n: 2 }], corruptLines: 0 });
});
