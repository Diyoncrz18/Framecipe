import { spawnSync as nodeSpawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const coded = (code, message) => Object.assign(new Error(message), { code });

// "[npx ]remotion render [<entry>] <CompositionId> <output.mp4> [flags…]". No quoting support: template scripts have none.
export function parseRenderScript(script) {
  const unknown = () => coded('RENDER_SCRIPT_UNKNOWN', `Script render tidak dikenali: "${script}".`);
  const tokens = String(script ?? '').trim().split(/\s+/);
  if (tokens[0] === 'npx') tokens.shift();
  if (tokens.shift() !== 'remotion' || tokens.shift() !== 'render') throw unknown();
  const entry = /\.(ts|tsx|js|jsx)$/.test(tokens[0] ?? '') ? tokens.shift() : null;
  const [compositionId, output, ...extraArgs] = tokens;
  if (!compositionId || !output) throw unknown();
  return { entry, compositionId, output, extraArgs };
}

export function remotionCliPath(projectDir) {
  const cli = path.join(projectDir, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
  if (!fs.existsSync(cli)) {
    throw coded('DEPS_MISSING', 'Dependensi proyek belum terpasang. Jalankan: node dashboard/bin/run.mjs install');
  }
  return cli;
}

export function parseFfprobeJson(text) {
  const data = JSON.parse(text);
  const video = (data.streams ?? []).find(s => s.codec_type === 'video');
  if (!video) throw new Error('Tidak ada stream video.');
  const [num, den] = String(video.r_frame_rate).split('/').map(Number);
  const fps = den ? Math.round((num / den) * 100) / 100 : 0; // 30000/1001 -> 29.97
  return { durationSeconds: Number(data.format?.duration), width: video.width, height: video.height, fps };
}

// ffprobe ships inside the project's Remotion CLI, so nothing needs to be on PATH. No shell: args are an array.
export function probeVideo(projectDir, fileAbs, spawnSync = nodeSpawnSync) {
  const args = [remotionCliPath(projectDir), 'ffprobe', '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', fileAbs];
  const r = spawnSync(process.execPath, args, { cwd: projectDir, encoding: 'utf8', timeout: 120000 });
  if (r.error || r.status !== 0) throw new Error(`ffprobe gagal: ${r.error?.message || r.stderr?.trim() || `kode ${r.status}`}`);
  return { ...parseFfprobeJson(r.stdout), sizeBytes: fs.statSync(fileAbs).size };
}

const MAX_BROWSER_DEPTH = 6;

export function findBrowserExe(dir) {
  const name = process.platform === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell';
  const walk = (current, depth) => {
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return null; }
    const hit = entries.find(e => e.isFile() && e.name === name);
    if (hit) return path.join(current, hit.name);
    if (depth >= MAX_BROWSER_DEPTH) return null;
    for (const e of entries) {
      if (e.isDirectory()) {
        const found = walk(path.join(current, e.name), depth + 1);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(dir, 0);
}

export const sharedBrowserDir = root => path.join(root, '.dashboard', 'browser');
