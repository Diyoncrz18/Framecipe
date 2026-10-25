import fs from 'node:fs';
import path from 'node:path';
import { expect, it, vi } from 'vitest';
import { runSchema } from './contracts.mjs';
import { readJson, writeJsonAtomic } from './jsonfile.mjs';
import { findBrowserExe, sharedBrowserDir } from './remotion.mjs';
import { defaultDeps, extractStills, failRun, finishRun, installDeps, npmCliPath, renderVideo, stageRun, startRun } from './run-ops.mjs';
import { readActiveRun, readRun, runPaths } from './run-store.mjs';
import { at, makeFixtureRepo } from './test-utils.mjs';

const projAbs = (root) => path.join(root, 'projects', 'halo');
const cliAbs = (root) => path.join(projAbs(root), 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
const exeName = process.platform === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell';
function placeExe(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const exe = path.join(dir, exeName); fs.writeFileSync(exe, '');
  return exe;
}
function writeVideo(root, runId, content) {
  fs.mkdirSync(path.join(projAbs(root), 'out'), { recursive: true });
  fs.writeFileSync(path.join(projAbs(root), 'out', `${runId}.mp4`), content);
}

// Fake spawnSync records every call and answers { status }; fake probe answers `probe` (or throws when none is given).
function setup({ spawnStatus = 0, probe } = {}) {
  const root = makeFixtureRepo(); const calls = [];
  const d = { ...defaultDeps, now: () => at('2026-10-24T01:53:00'), claudeVersion: () => '2.1.303', rand: () => 'a1b2',
    spawnSync: (cmd, args, opts) => { calls.push({ cmd, args, cwd: opts?.cwd, opts }); return { status: spawnStatus }; },
    probe: () => { if (!probe) throw new Error('probe tidak diatur'); return probe; } };
  const { runId } = startRun(root, { flow: 'contoh-penjelasan', topic: 'Halo' }, d);
  fs.mkdirSync(path.dirname(cliAbs(root)), { recursive: true }); fs.writeFileSync(cliAbs(root), '');
  return { root, calls, d, runId };
}
const code = (fn) => { try { fn(); } catch (e) { return e.code; } return null; };
const GOOD = { durationSeconds: 28, width: 1920, height: 1080, fps: 30, sizeBytes: 1000 };

it('install memanggil npm-cli dengan argumen tetap', () => {
  const { root, calls, d } = setup({ spawnStatus: 0 });
  installDeps(root, d);
  expect(calls[0]).toMatchObject({ cmd: process.execPath, args: [npmCliPath(), 'install', '--no-audit', '--no-fund', '--prefer-offline'], cwd: projAbs(root) });
  expect(() => installDeps(root, { ...d, spawnSync: () => ({ status: 1 }) })).toThrow(expect.objectContaining({ code: 'INSTALL_FAILED' }));
});
it('install melaporkan durasi video dan audio sumber; file yang tidak terbaca jadi error, bukan kegagalan', () => {
  const { root, d, runId } = setup({ spawnStatus: 0 });
  expect(installDeps(root, d)).toEqual({ ok: true, sources: [] });
  const run = readRun(root, 'halo', runId).value;
  writeJsonAtomic(runPaths(root, 'halo', runId).runFile, { ...run, sources: [
    { name: 'rekaman.mp4', kind: 'video', sizeBytes: 9 }, { name: 'logo.png', kind: 'image', sizeBytes: 9 },
    { name: 'rusak.mp3', kind: 'audio', sizeBytes: 9 }, { name: '../../../x.mp3', kind: 'audio', sizeBytes: 9 }] });
  const probed = [];
  const probeMedia = (proj, file) => {
    probed.push(path.relative(proj, file));
    if (file.endsWith('rusak.mp3')) throw new Error('ffprobe gagal: rusak');
    return { durationSeconds: 12.5, width: 1920, height: 1080, fps: 30 };
  };
  expect(installDeps(root, { ...d, probeMedia }).sources).toEqual([
    { name: 'rekaman.mp4', durationSeconds: 12.5, width: 1920, height: 1080, fps: 30 },
    { name: 'rusak.mp3', error: 'ffprobe gagal: rusak' },
    { name: '../../../x.mp3', error: expect.stringContaining('outside') }]);
  expect(probed).toEqual([path.join('public', 'sources', 'rekaman.mp4'), path.join('public', 'sources', 'rusak.mp3')]);
});
it('render menyusun argumen dari script template dan memakai browser bersama', () => {
  const { root, calls, d, runId } = setup({ spawnStatus: 0 });
  renderVideo(root, d);
  expect(calls[0].args).toEqual([cliAbs(root), 'render', 'src/index.ts', 'Rem', `out/${runId}.mp4`]);
  const exe = placeExe(path.join(root, '.dashboard', 'browser', 'chrome-headless-shell', 'win64', 'x'));
  renderVideo(root, d);
  expect(calls[1].args.at(-1)).toBe(`--browser-executable=${exe}`);
});
it('render pertama menyalin browser ke folder bersama', () => {
  const { root, d } = setup({ spawnStatus: 0 });
  placeExe(path.join(projAbs(root), 'node_modules', '.remotion', 'chrome-headless-shell', 'win64', 'x'));
  renderVideo(root, d);
  expect(findBrowserExe(sharedBrowserDir(root))).not.toBeNull();
});
it('render gagal tidak mengubah status run', () => {
  const { root, d, runId } = setup({ spawnStatus: 1 });
  expect(() => renderVideo(root, d)).toThrow(expect.objectContaining({ code: 'RENDER_FAILED' }));
  expect(readRun(root, 'halo', runId).value.status).toBe('running');
});
it('stills mengambil frame di tengah tiap segmen', () => {
  const { root, calls, d, runId } = setup({ spawnStatus: 0, probe: { durationSeconds: 20, width: 1920, height: 1080, fps: 30, sizeBytes: 9 } });
  writeVideo(root, runId, 'xx');
  const r = extractStills(root, 4, d);
  expect(calls.map(c => c.args[c.args.indexOf('-ss') + 1])).toEqual(['2.50', '7.50', '12.50', '17.50']);
  expect(r.frames).toEqual([1, 2, 3, 4].map(n => `projects/halo/runs/${runId}/frames/frame-${n}.jpg`));
});
it('finish sukses menulis output, menutup run, dan menghapus node_modules', () => {
  const { root, d, runId } = setup({ probe: { durationSeconds: 28, width: 1920, height: 1080, fps: 30, sizeBytes: 1000 } });
  writeVideo(root, runId, 'data');
  expect(finishRun(root, d)).toMatchObject({ status: 'success', warnings: [], error: null });
  const run = readRun(root, 'halo', runId).value;
  expect(run).toMatchObject({ status: 'success', stage: 'done', output: { file: `out/${runId}.mp4`, durationSeconds: 28 } });
  expect(readJson(path.join(projAbs(root), 'project.json')).value).toMatchObject({ phase: 'complete', latestRun: runId });
  expect(readActiveRun(root)).toBeNull();
  expect(fs.existsSync(path.join(projAbs(root), 'node_modules'))).toBe(false);
});
it('finish menolak file lama/kosong', () => {
  const { root, d, runId } = setup({ probe: { durationSeconds: 28, width: 1920, height: 1080, fps: 30, sizeBytes: 1 } });
  fs.mkdirSync(path.join(projAbs(root), 'out'), { recursive: true }); fs.writeFileSync(path.join(projAbs(root), 'out', 'rem.mp4'), 'lama');
  expect(finishRun(root, d)).toMatchObject({ status: 'failed', error: `File video out/${runId}.mp4 tidak ada.` });
  const { root: r2, d: d2, runId: id2 } = setup({});
  writeVideo(r2, id2, '');
  expect(finishRun(r2, d2)).toMatchObject({ status: 'failed', error: 'File video kosong (0 byte).' });
});
it('finish memberi peringatan durasi dan resolusi', () => {
  const { root, d, runId } = setup({ probe: { durationSeconds: 20, width: 1280, height: 720, fps: 30, sizeBytes: 5 } });
  writeVideo(root, runId, 'data');
  expect(finishRun(root, d)).toMatchObject({ status: 'success',
    warnings: ['Durasi 20,0 dtk, target 30 dtk.', 'Resolusi 1280×720, alur meminta 1920×1080.'] });
});

// --- Beyond the brief: what the cases above leave open ---

it('finish gagal: run.json valid {stage, message}, tahap tertutup, penanda dihapus, node_modules tetap', () => {
  const { root, d, runId } = setup({});
  fs.mkdirSync(path.join(projAbs(root), 'node_modules', 'x'), { recursive: true });
  writeVideo(root, runId, '');
  const r = finishRun(root, d);
  expect(r).toEqual({ status: 'failed', output: null, warnings: [], error: 'File video kosong (0 byte).' });
  const run = readRun(root, 'halo', runId).value;
  expect(runSchema.safeParse(run).success).toBe(true);
  expect(run).toMatchObject({ status: 'failed', waitReason: null, endedAt: at('2026-10-24T01:53:00').toISOString(),
    error: { stage: 'setup', message: 'File video kosong (0 byte).' } });
  expect(run.stages.every(s => s.endedAt === run.endedAt)).toBe(true);
  expect(readActiveRun(root)).toBeNull();
  expect(fs.existsSync(path.join(projAbs(root), 'node_modules', 'x'))).toBe(true); // a retry continues from them
});
it('finish gagal bila video tidak terbaca atau durasinya 0', () => {
  const a = setup({}); writeVideo(a.root, a.runId, 'data'); // the fake probe throws
  expect(finishRun(a.root, a.d)).toMatchObject({ status: 'failed', error: 'Video tidak bisa dibaca: probe tidak diatur' });
  const b = setup({ probe: { ...GOOD, durationSeconds: 0 } }); writeVideo(b.root, b.runId, 'data');
  expect(finishRun(b.root, b.d)).toMatchObject({ status: 'failed', error: 'Durasi video 0 detik.' });
});
it('finish gagal (tahap render) bila hasil probe tanpa lebar, tinggi, atau fps positif, bukan run.json sukses yang melanggar skema', () => {
  const { width, ...noWidth } = GOOD;
  for (const probe of [noWidth, { ...GOOD, fps: 0 }, { ...GOOD, height: NaN }]) {
    const { root, d, runId } = setup({ probe }); writeVideo(root, runId, 'data');
    const r = finishRun(root, d);
    expect(r).toMatchObject({ status: 'failed', output: null, error: expect.stringMatching(/^Hasil pembacaan video tidak valid: .+ harus berupa angka positif\.$/) });
    const run = readRun(root, 'halo', runId).value;
    expect(runSchema.safeParse(run).success).toBe(true);
    expect(run).toMatchObject({ status: 'failed', output: null, error: { stage: 'render', message: r.error } });
    expect(readActiveRun(root)).toBeNull();
  }
});
it('finish sukses: run.json valid, sesi proyek bertambah, peringatan tanpa peringatan di batas 10%', () => {
  const { root, d, runId } = setup({ probe: { ...GOOD, durationSeconds: 27 } }); // exactly 10% off: not a warning
  writeVideo(root, runId, 'data');
  const r = finishRun(root, d);
  expect(r).toMatchObject({ status: 'success', warnings: [], output: { file: `out/${runId}.mp4`, durationSeconds: 27, width: 1920, height: 1080, fps: 30, sizeBytes: 1000 } });
  const run = readRun(root, 'halo', runId).value;
  expect(runSchema.safeParse(run).success).toBe(true);
  expect(run).toMatchObject({ error: null, endedAt: at('2026-10-24T01:53:00').toISOString(), waitReason: null });
  expect(run.stages.map(s => [s.name, s.endedAt !== null])).toEqual([['setup', true], ['done', true]]);
  const project = readJson(path.join(projAbs(root), 'project.json')).value;
  expect(project.sessions.at(-1)).toEqual({ date: '2026-10-24', summary: `Run ${runId} sukses (27,0 dtk).` });
  expect(project.updated).toBe(at('2026-10-24T01:53:00').toISOString());
});
it('finish: node_modules yang tidak bisa dihapus menjadi peringatan di hasil dan run.json', () => {
  const { root, d, runId } = setup({ probe: GOOD }); writeVideo(root, runId, 'data');
  const real = fs.rmSync;
  const spy = vi.spyOn(fs, 'rmSync').mockImplementation((p, o) => { if (String(p).endsWith('node_modules')) throw new Error('EBUSY'); return real(p, o); });
  try {
    const r = finishRun(root, d);
    expect(r).toMatchObject({ status: 'success', warnings: ['node_modules tidak bisa dihapus: EBUSY'] });
    expect(readRun(root, 'halo', runId).value.warnings).toEqual(r.warnings);
  } finally { spy.mockRestore(); }
});
it('finish: alur snapshot hilang menjadi peringatan, bukan kegagalan', () => {
  const { root, d, runId } = setup({ probe: GOOD }); writeVideo(root, runId, 'data');
  fs.rmSync(path.join(projAbs(root), 'runs', runId, 'flow.json'));
  expect(finishRun(root, d)).toMatchObject({ status: 'success', warnings: ['Alur run tidak terbaca: durasi dan resolusi tidak dicek.'] });
});
it('install, render, stills, finish tanpa run aktif; render tanpa dependensi', () => {
  const { root, d, runId } = setup({ probe: GOOD });
  fs.rmSync(cliAbs(root));
  expect(code(() => renderVideo(root, d))).toBe('DEPS_MISSING');
  expect(code(() => extractStills(root, 4, d))).toBe('DEPS_MISSING');
  writeVideo(root, runId, 'data'); finishRun(root, d);
  expect([code(() => installDeps(root, d)), code(() => renderVideo(root, d)), code(() => extractStills(root, 4, d)), code(() => finishRun(root, d))])
    .toEqual(['NO_ACTIVE_RUN', 'NO_ACTIVE_RUN', 'NO_ACTIVE_RUN', 'NO_ACTIVE_RUN']);
});
it('render menolak script template yang tidak dikenal; browser bersama tidak ditimpa', () => {
  const { root, calls, d } = setup({});
  const pkg = path.join(projAbs(root), 'package.json');
  const before = fs.readFileSync(pkg, 'utf8');
  fs.writeFileSync(pkg, JSON.stringify({ scripts: { render: 'python build.py' } }));
  expect(code(() => renderVideo(root, d))).toBe('RENDER_SCRIPT_UNKNOWN');
  expect(calls).toHaveLength(0);
  fs.writeFileSync(pkg, before);
  const shared = placeExe(path.join(root, '.dashboard', 'browser', 'chrome-headless-shell', 'win64', 'x'));
  const fromProject = placeExe(path.join(projAbs(root), 'node_modules', '.remotion', 'chrome-headless-shell', 'win64', 'other'));
  renderVideo(root, d);
  expect(findBrowserExe(sharedBrowserDir(root))).toBe(shared); // the project's copy is not copied over it
  expect(fs.existsSync(fromProject)).toBe(true);
});
it('stills: jumlah tidak valid, video belum ada, ffmpeg gagal', () => {
  const { root, d, runId } = setup({ probe: { ...GOOD, durationSeconds: 20 } });
  expect([0, -1, 2.5, NaN, '4'].map(n => code(() => extractStills(root, n, d)))).toEqual(Array(5).fill('BAD_ARGS'));
  expect(code(() => extractStills(root, 4, d))).toBe('VIDEO_MISSING');
  writeVideo(root, runId, 'xx');
  expect(code(() => extractStills(root, 4, { ...d, spawnSync: () => ({ status: 1, stderr: 'boom' }) }))).toBe('STILLS_FAILED');
  expect(code(() => extractStills(root, 4, { ...d, probe: () => ({ ...GOOD, durationSeconds: 0 }) }))).toBe('PROBE_FAILED');
});
it('stills memakai remotion ffmpeg dengan argumen tetap dan folder frames di run', () => {
  const { root, calls, d, runId } = setup({ probe: { ...GOOD, durationSeconds: 10 } });
  writeVideo(root, runId, 'xx');
  extractStills(root, 2, d);
  const video = path.join(projAbs(root), 'out', `${runId}.mp4`);
  const frame = (n) => path.join(projAbs(root), 'runs', runId, 'frames', `frame-${n}.jpg`);
  expect(calls[0]).toMatchObject({ cmd: process.execPath, cwd: projAbs(root),
    args: [cliAbs(root), 'ffmpeg', '-y', '-loglevel', 'error', '-ss', '2.50', '-i', video, '-frames:v', '1', frame(1)] });
  expect(calls[1].args.at(-1)).toBe(frame(2));
  expect(fs.existsSync(path.dirname(frame(1)))).toBe(true);
});

// --- Fix round 1 (R22): data safety ---

it('run.json dengan project atau runId di luar folder proyek ditolak; tidak ada yang dihapus di luar proyek', () => {
  const { root, d, runId } = setup({ probe: GOOD });
  const keep = path.join(root, 'dashboard', 'node_modules', 'keep.txt');
  fs.mkdirSync(path.dirname(keep), { recursive: true }); fs.writeFileSync(keep, 'x');
  writeVideo(root, runId, 'data');
  fs.mkdirSync(path.join(root, 'dashboard', 'out'), { recursive: true }); // a valid video where the bad project would point: finish would succeed there
  fs.writeFileSync(path.join(root, 'dashboard', 'out', `${runId}.mp4`), 'data');
  const { runFile } = runPaths(root, 'halo', runId);
  const good = readRun(root, 'halo', runId).value;
  for (const bad of [{ project: '../dashboard' }, { runId: '../x' }, { project: 'a/b' }, { runId: '' }]) {
    writeJsonAtomic(runFile, { ...good, ...bad }); // not writeRun: it would write to the bad path
    const codes = [() => finishRun(root, d), () => renderVideo(root, d), () => extractStills(root, 4, d), () => installDeps(root, d),
      () => stageRun(root, 'script', d), () => failRun(root, 'x', d)].map(code);
    expect(codes).toEqual(Array(6).fill('RUN_CORRUPT'));
  }
  expect(fs.existsSync(keep)).toBe(true);
  expect(fs.existsSync(path.join(projAbs(root), 'node_modules'))).toBe(true);
  expect(fs.existsSync(path.join(root, 'dashboard', 'runs'))).toBe(false); // nothing was written outside the project either
  expect(readActiveRun(root)).not.toBeNull();
});
it('render menghapus video lama run ini sebelum render, sehingga render gagal tidak meninggalkan file lama', () => {
  const { root, d, runId } = setup({ spawnStatus: 1, probe: GOOD });
  writeVideo(root, runId, 'dari render sebelumnya');
  expect(() => renderVideo(root, d)).toThrow(expect.objectContaining({ code: 'RENDER_FAILED' }));
  const video = path.join(projAbs(root), 'out', `${runId}.mp4`);
  expect(fs.existsSync(video)).toBe(false);
  expect(finishRun(root, d)).toMatchObject({ status: 'failed', error: `File video out/${runId}.mp4 tidak ada.` });
  // the video of another run in out/ is not touched
  const other = path.join(projAbs(root), 'out', 'rem.mp4'); fs.writeFileSync(other, 'lama');
  const b = setup({ spawnStatus: 1 }); fs.mkdirSync(path.join(projAbs(b.root), 'out'), { recursive: true });
  fs.writeFileSync(path.join(projAbs(b.root), 'out', 'rem.mp4'), 'lama');
  expect(() => renderVideo(b.root, b.d)).toThrow(expect.objectContaining({ code: 'RENDER_FAILED' }));
  expect(fs.existsSync(path.join(projAbs(b.root), 'out', 'rem.mp4'))).toBe(true);
});
it('render tanpa dependensi tidak menghapus video lama', () => {
  const { root, d, runId } = setup({});
  writeVideo(root, runId, 'lama'); fs.rmSync(cliAbs(root));
  expect(code(() => renderVideo(root, d))).toBe('DEPS_MISSING');
  expect(fs.existsSync(path.join(projAbs(root), 'out', `${runId}.mp4`))).toBe(true);
});
it('stage done lalu finish mencatat satu tahap done', () => {
  const { root, d, runId } = setup({ probe: GOOD });
  stageRun(root, 'done', d); writeVideo(root, runId, 'data');
  expect(finishRun(root, d)).toMatchObject({ status: 'success' });
  const run = readRun(root, 'halo', runId).value;
  expect(run.stages.map(s => [s.name, s.endedAt !== null])).toEqual([['setup', true], ['done', true]]);
  expect(run).toMatchObject({ stage: 'done', status: 'success', endedAt: at('2026-10-24T01:53:00').toISOString() });
  expect(runSchema.safeParse(run).success).toBe(true);
});
