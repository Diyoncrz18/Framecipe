import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { findBrowserExe, parseFfprobeJson, parseRenderScript, probeVideo, remotionCliPath } from './remotion.mjs';
import { makeTempRoot } from './test-utils.mjs';

const real = path.resolve(import.meta.dirname, '..', '..');
const helloDir = path.join(real, 'examples', 'hello-world'); const helloMp4 = path.join(helloDir, 'out', 'video.mp4');
it('parseRenderScript mengenali bentuk script template', () => {
  expect(parseRenderScript('npx remotion render src/index.ts SprintReview out/sprint-review.mp4'))
    .toEqual({ entry: 'src/index.ts', compositionId: 'SprintReview', output: 'out/sprint-review.mp4', extraArgs: [] });
  expect(parseRenderScript('remotion render ProductDemo out/product-demo.mp4'))
    .toEqual({ entry: null, compositionId: 'ProductDemo', output: 'out/product-demo.mp4', extraArgs: [] });
  expect(parseRenderScript('npx remotion render src/index.ts X out/x.mp4 --codec=h264').extraArgs).toEqual(['--codec=h264']);
  expect(() => parseRenderScript('python build.py')).toThrow(expect.objectContaining({ code: 'RENDER_SCRIPT_UNKNOWN' }));
});
it('semua template Remotion di repo bisa diurai', () => {
  for (const id of ['sprint-review', 'sprint-review-v2', 'product-demo', 'ai-engineering-review']) {
    const pkg = JSON.parse(fs.readFileSync(path.join(real, 'templates', id, 'package.json'), 'utf8'));
    expect(() => parseRenderScript(pkg.scripts.render)).not.toThrow();
  }
});
it('parseFfprobeJson', () => {
  const json = JSON.stringify({ format: { duration: '25.000000' }, streams: [{ codec_type: 'audio' },
    { codec_type: 'video', width: 1920, height: 1080, r_frame_rate: '30/1' }] });
  expect(parseFfprobeJson(json)).toEqual({ durationSeconds: 25, width: 1920, height: 1080, fps: 30 });
  expect(() => parseFfprobeJson(JSON.stringify({ format: { duration: '1' }, streams: [] }))).toThrow('Tidak ada stream video.');
});
it('findBrowserExe menemukan exe bersarang', () => {
  const root = makeTempRoot(); const name = process.platform === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell';
  const dir = path.join(root, 'chrome-headless-shell', 'win64', 'chs'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), '');
  expect(findBrowserExe(root)).toBe(path.join(dir, name));
  expect(findBrowserExe(makeTempRoot())).toBeNull();
});
it.skipIf(!fs.existsSync(helloMp4) || !fs.existsSync(path.join(helloDir, 'node_modules')))(
  'probeVideo membaca video hello-world', () => {
    expect(probeVideo(helloDir, helloMp4)).toMatchObject({ durationSeconds: 25, width: 1920, height: 1080, fps: 30 });
  }, 60000); // cold first run of the Remotion CLI can exceed the 20 s default
it('remotionCliPath dan probeVideo gagal dengan pesan jelas', () => {
  const project = makeTempRoot();
  expect(() => remotionCliPath(project)).toThrow(expect.objectContaining({ code: 'DEPS_MISSING' }));
  const cli = path.join(project, 'node_modules', '@remotion', 'cli', 'remotion-cli.js'); fs.mkdirSync(path.dirname(cli), { recursive: true });
  fs.writeFileSync(cli, '');
  expect(remotionCliPath(project)).toBe(cli);
  expect(() => probeVideo(project, path.join(project, 'x.mp4'), () => ({ status: 1, stderr: 'boom\n' }))).toThrow('ffprobe gagal: boom');
});
