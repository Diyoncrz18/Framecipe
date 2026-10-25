// Source files of a video request: the owner's footage, sound, images or notes. The upload route streams each one into
// .dashboard/uploads/<batch>/, createRequest records the ones the form kept, and run.mjs start copies those into the project.
// Nothing here deletes an upload; only the half-written .part of a failed one goes.
import fs from 'node:fs';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { randomHex, slugify, uniqueSlug } from './ids.mjs';
import { resolveInside } from './paths.mjs';
import { MAX_SOURCE_BYTES, MAX_SOURCE_FILES, sourceKind } from './source-files.mjs';

const coded = (code, message) => Object.assign(new Error(message), { code });
const isPlainId = (id) => typeof id === 'string' && /^[\w-]+$/.test(id);
// What safeFileName gives out, also after uniqueSlug's "-2": no separators, no dots but the extension's.
const STORED_NAME = /^[a-z0-9]+(-[a-z0-9]+)*\.[a-z0-9]+$/;
// Windows refuses these names whatever the extension.
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/;

export const uploadPath = (root, batch, ...rest) => resolveInside(root, '.dashboard', 'uploads', batch, ...rest);

// A plain ASCII name with the extension lowercased ("Liburan Bali (1).MOV" -> "liburan-bali-1.mov"), or null for a type
// a request does not take. Folder parts are dropped: a folder upload lands flat in one folder.
export function safeFileName(name) {
  const base = String(name ?? '').split(/[\\/]/).pop();
  const dot = base.lastIndexOf('.');
  if (dot < 0 || !sourceKind(base)) return null;
  const raw = base.slice(0, dot);
  const stem = /[a-z0-9]/i.test(raw.normalize('NFKD')) ? slugify(raw) : 'file'; // slugify falls back to "video", wrong for an mp3
  return `${RESERVED.test(stem) ? `${stem}-file` : stem}.${base.slice(dot + 1).toLowerCase()}`;
}

// Streams one file into the batch (a new batch when none is given) and returns where it went. `maxBytes` is there for tests.
// shortcut: two uploads of one name at the same moment could pick the same stored name; the form sends one file at a time.
export async function saveUpload(root, { batch, name }, body, maxBytes = MAX_SOURCE_BYTES) {
  const safe = safeFileName(name);
  if (!safe) throw coded('BAD_TYPE', `Jenis file "${name}" tidak didukung.`);
  if (batch !== undefined && !isPlainId(batch)) throw coded('BAD_BATCH', 'Folder unggahan tidak ditemukan. Pilih file lagi.');
  const id = batch ?? randomHex(12);
  const dir = uploadPath(root, id);
  if (batch === undefined) fs.mkdirSync(dir, { recursive: true });
  else if (!fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory()) throw coded('BAD_BATCH', 'Folder unggahan tidak ditemukan. Pilih file lagi.');
  if (fs.readdirSync(dir).filter((f) => !f.endsWith('.part')).length >= MAX_SOURCE_FILES) {
    throw coded('TOO_MANY', `Maksimal ${MAX_SOURCE_FILES} file sumber per permintaan.`);
  }

  const part = path.join(dir, `${randomHex(8)}.part`);
  let bytes = 0;
  const limit = new Transform({
    transform(chunk, _encoding, done) {
      bytes += chunk.length;
      done(bytes > maxBytes ? coded('TOO_LARGE', `File "${name}" lebih dari 2 GB.`) : null, chunk);
    },
  });
  try {
    await pipeline(body, limit, fs.createWriteStream(part, { flags: 'wx' }));
    if (bytes === 0) throw coded('EMPTY', `File "${name}" kosong.`);
  } catch (e) {
    fs.rmSync(part, { force: true });
    throw ['TOO_LARGE', 'EMPTY'].includes(e.code) ? e : coded('UPLOAD_FAILED', `File "${name}" gagal diunggah: ${e.message}`);
  }

  const dot = safe.lastIndexOf('.');
  const ext = safe.slice(dot);
  const stored = `${uniqueSlug(safe.slice(0, dot), (s) => fs.existsSync(path.join(dir, `${s}${ext}`)))}${ext}`;
  fs.renameSync(part, path.join(dir, stored));
  return { batch: id, name: stored, kind: sourceKind(stored), sizeBytes: bytes };
}

// The stored files a request names, checked against its batch folder: a name the upload route never gives out, a repeat,
// or a file that is gone is an error. Sources come back as { name, kind, sizeBytes } in the order given.
export function readSources(root, batch, names) {
  if (!names.length) return { ok: true, sources: [] };
  const fail = (message) => ({ ok: false, errors: [message] });
  if (!isPlainId(batch)) return fail('Folder unggahan file sumber tidak ditemukan. Pilih file lagi.');
  if (names.length > MAX_SOURCE_FILES) return fail(`Maksimal ${MAX_SOURCE_FILES} file sumber per permintaan.`);
  if (new Set(names).size !== names.length) return fail('Ada file sumber yang tercantum dua kali.');
  const sources = [];
  const errors = [];
  for (const name of names) {
    const kind = typeof name === 'string' && STORED_NAME.test(name) ? sourceKind(name) : null;
    let stat;
    try { stat = kind && fs.statSync(uploadPath(root, batch, name), { throwIfNoEntry: false }); } catch { /* a link out of the repo: same as missing */ }
    if (stat?.isFile()) sources.push({ name, kind, sizeBytes: stat.size });
    else errors.push(`File sumber "${name}" tidak ditemukan di folder unggahan.`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, sources };
}

// Copies, never moves: the upload stays, so "Ulangi" can make a new request with the same files.
export function copySources(root, batch, sources, projectDir) {
  const dest = path.join(projectDir, 'public', 'sources');
  fs.mkdirSync(dest, { recursive: true });
  for (const { name } of sources) fs.copyFileSync(uploadPath(root, batch, name), path.join(dest, name));
}
