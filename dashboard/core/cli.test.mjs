import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { makeFixtureRepo, makeTempRoot } from './test-utils.mjs';

const bin = path.join(import.meta.dirname, '..', 'bin', 'run.mjs');

it('CLI start, stage, status dengan VIDEO_REPO_ROOT', () => {
  const root = makeFixtureRepo(); const env = { ...process.env, VIDEO_REPO_ROOT: root };
  const run = (...a) => spawnSync(process.execPath, [bin, ...a], { env, encoding: 'utf8' });
  const s = run('start', '--flow', 'contoh-penjelasan', '--topic', 'Halo Dunia');
  expect(s.status).toBe(0); expect(JSON.parse(s.stdout).project).toBe('halo-dunia');
  expect(s.stderr).toBe(''); // stderr is reserved for error messages: no Node DEP0190 warning from the claude version probe
  const bad = run('stage', 'nope');
  expect(bad.status).toBe(1); expect(bad.stderr).toContain('Tahap "nope" tidak dikenal.');
  expect(JSON.parse(run('status').stdout).active.project).toBe('halo-dunia');
});
it('CLI menolak worktree sebelum memuat modul lain', () => {
  const root = makeTempRoot(); fs.writeFileSync(path.join(root, '.git'), 'gitdir: x');
  const r = spawnSync(process.execPath, [bin, 'status'], { env: { ...process.env, VIDEO_REPO_ROOT: root }, encoding: 'utf8' });
  expect(r.status).toBe(1); expect(r.stderr).toContain('bukan git worktree');
});
it('CLI: kode error di stdout, wait dan fail lewat --reason, topik dengan karakter shell tetap utuh', () => {
  const root = makeFixtureRepo(); const env = { ...process.env, VIDEO_REPO_ROOT: root };
  const run = (...a) => spawnSync(process.execPath, [bin, ...a], { env, encoding: 'utf8' });
  expect(JSON.parse(run('status').stdout)).toEqual({ active: null });
  const none = run('wait', '--reason', 'x');
  expect([none.status, JSON.parse(none.stdout)]).toEqual([1, { error: 'NO_ACTIVE_RUN' }]);
  expect(JSON.parse(run('bogus').stdout)).toEqual({ error: 'BAD_ARGS' });
  expect(JSON.parse(run('start', '--nope').stdout)).toEqual({ error: 'BAD_ARGS' });
  const topic = '$(echo hi) & "kutip"';
  const s = JSON.parse(run('start', '--flow', 'contoh-penjelasan', '--topic', topic).stdout);
  expect(JSON.parse(fs.readFileSync(path.join(root, s.runFile), 'utf8')).topic).toBe(topic);
  expect(JSON.parse(run('wait', '--reason', 'review naskah').stdout)).toEqual({ status: 'waiting' });
  expect(JSON.parse(run('fail', '--reason', 'selesai uji').stdout)).toEqual({ status: 'failed' });
  expect(JSON.parse(run('status').stdout)).toEqual({ active: null });
});
