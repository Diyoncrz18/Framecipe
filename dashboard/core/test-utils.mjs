import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// New empty temp folder. The default prefix contains a space, like the real repo path ("MY FOLDER").
export function makeTempRoot(prefix = 'MY FOLDER ') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
