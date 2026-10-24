// Node built-ins only: hook.mjs imports this module.
import fs from 'node:fs';
import path from 'node:path';

// Never throws for a bad file: the caller shows a "Data rusak" item, not an error page (NFR-07).
// A file that cannot be read for another reason (a folder, no permission) also counts as corrupt.
// A leading UTF-8 BOM (some Windows editors add one) is dropped: JSON.parse rejects it.
export function readJson(file) {
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) };
  } catch (e) {
    return { ok: false, error: e.code === 'ENOENT' ? 'missing' : 'corrupt', message: e.message };
  }
}

// Windows refuses to rename over a file another process has open at that instant (EPERM/EACCES/EBUSY), e.g. the dashboard
// reading run.json while run.mjs rewrites it. The lock is short-lived, so retry for 1-2 s (50 x ~30 ms) before giving up.
function renameWithRetry(from, to) {
  for (let attempt = 1; ; attempt++) {
    try {
      return fs.renameSync(from, to);
    } catch (e) {
      if (attempt === 50 || !['EPERM', 'EACCES', 'EBUSY'].includes(e.code)) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20); // sleep 20 ms without spinning
    }
  }
}

// Temp file next to the target, then rename: a reader sees the old file or the new one, never half of it.
// shortcut: when the retries run out, the temp file is left behind; add cleanup if stray *.tmp-* files ever show up.
export function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  renameWithRetry(tmp, file);
}

export function appendJsonLine(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(value)}\n`);
}

// A missing file is an empty log. Blank lines are skipped; lines that do not parse (e.g. cut off by a crash) are only counted.
export function readJsonLines(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return { items: [], corruptLines: 0 };
    throw e;
  }
  const items = [];
  let corruptLines = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try { items.push(JSON.parse(line)); } catch { corruptLines++; }
  }
  return { items, corruptLines };
}
