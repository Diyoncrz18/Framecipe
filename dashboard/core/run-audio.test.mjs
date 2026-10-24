import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { readJson, writeJsonAtomic } from './jsonfile.mjs';
import { defaultDeps, generateAudio, startRun } from './run-ops.mjs';
import { runPaths } from './run-store.mjs';
import { at, makeFixtureRepo } from './test-utils.mjs';

// A started run whose flow snapshot asks for `audio`; spawnSync is faked by `voiceover` (args, opts) => result.
function setup(audio, voiceover = () => ({ status: 0, stdout: '{}' })) {
  const root = makeFixtureRepo(); const calls = [];
  const d = { ...defaultDeps, now: () => at('2026-10-24T01:53:00'), claudeVersion: () => '2.1.303', rand: () => 'a1b2',
    spawnSync: (cmd, args, opts) => { calls.push({ cmd, args, opts }); return voiceover(args, opts); } };
  const { project, runId } = startRun(root, { flow: 'contoh-penjelasan', topic: 'Halo' }, d);
  const { flowFile } = runPaths(root, project, runId);
  const flow = readJson(flowFile).value;
  writeJsonAtomic(flowFile, { ...flow, audio: { ...flow.audio, ...audio } });
  const audioDir = path.join(root, 'projects', project, 'public', 'audio');
  return { root, d, calls, audioDir };
}
const code = (fn) => { try { fn(); } catch (e) { return e.code; } return null; };
const writeScript = (audioDir, name) => {
  fs.mkdirSync(path.join(audioDir, 'scenes'), { recursive: true });
  fs.writeFileSync(path.join(audioDir, 'scenes', name), 'Halo.');
};

it('audio: voiceover lewat uv dengan provider alur, hasil relatif ke public/audio; musik dari trek bawaan', () => {
  const { root, d, calls, audioDir } = setup({ voiceover: { enabled: true, provider: 'edge' }, music: { enabled: true } }, (args) => {
    const sceneDir = args[args.indexOf('--scene-dir') + 1];
    return { status: 0, stdout: JSON.stringify({ total_duration_seconds: 2.5, scenes: [{ success: true, output: path.join(sceneDir, '01-hook.mp3'), duration_seconds: 2.5 }] }) };
  });
  writeScript(audioDir, '01-hook.txt');
  fs.mkdirSync(path.join(root, 'examples', 'sky-blue-short', 'audio'), { recursive: true });
  fs.writeFileSync(path.join(root, 'examples', 'sky-blue-short', 'audio', 'music.mp3'), 'mp3');

  expect(generateAudio(root, d)).toEqual({
    voiceover: { provider: 'edge', files: [{ file: 'scenes/01-hook.mp3', durationSeconds: 2.5 }], totalSeconds: 2.5 },
    music: { source: 'library', file: 'background-music.mp3', durationSeconds: 60 },
  });
  expect(calls[0]).toMatchObject({ cmd: 'uv', args: ['run', 'tools/voiceover.py', '--provider', 'edge', '--scene-dir', path.join(audioDir, 'scenes'), '--json'] });
  expect(calls[0].opts.cwd).toBe(root);
  expect(fs.readFileSync(path.join(audioDir, 'background-music.mp3'), 'utf8')).toBe('mp3');
});

it('audio: menolak alur tanpa audio, naskah yang belum ditulis, voiceover gagal, dan musik bawaan yang hilang', () => {
  expect(code(() => { const s = setup({}); generateAudio(s.root, s.d); })).toBe('NO_AUDIO');

  const noScript = setup({ voiceover: { enabled: true, provider: 'edge' } });
  expect(code(() => generateAudio(noScript.root, noScript.d))).toBe('NO_SCRIPT');
  expect(noScript.calls).toHaveLength(0);

  const failing = setup({ voiceover: { enabled: true, provider: 'edge' } }, () => ({ status: 1, stderr: 'baris 1\nkoneksi putus' }));
  writeScript(failing.audioDir, '01-hook.txt');
  expect(() => generateAudio(failing.root, failing.d)).toThrow('Voiceover gagal (kode 1): baris 1 koneksi putus');

  const partly = setup({ voiceover: { enabled: true, provider: 'edge' } }, () => ({ status: 0, stdout: JSON.stringify({ scenes: [{ success: false, error: 'timeout' }] }) }));
  writeScript(partly.audioDir, '01-hook.txt');
  expect(() => generateAudio(partly.root, partly.d)).toThrow('Voiceover gagal untuk 1 scene: timeout');

  const noTrack = setup({ music: { enabled: true } });
  expect(code(() => generateAudio(noTrack.root, noTrack.d))).toBe('MUSIC_MISSING');
});
