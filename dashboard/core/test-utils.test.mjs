import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { cleanupTempRoots, makeTempRoot } from './test-utils.mjs';

it('cleanupTempRoots menghapus folder sementara tanpa mengikuti junction ke targetnya', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'junction target ')); // sengaja tidak dilacak: cleanup tidak boleh menyentuhnya
  try {
    fs.writeFileSync(path.join(target, 'keep.txt'), 'x');
    const root = makeTempRoot();
    fs.symlinkSync(target, path.join(root, 'link'), 'junction');
    cleanupTempRoots();
    expect(fs.existsSync(root)).toBe(false);
    expect(fs.readFileSync(path.join(target, 'keep.txt'), 'utf8')).toBe('x');
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});
