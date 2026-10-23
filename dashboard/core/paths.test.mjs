import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { cliRoot, isGitWorktree, repoRootFromBin, resolveInside, toRepoRelative } from './paths.mjs';
import { makeTempRoot } from './test-utils.mjs';

afterEach(() => vi.unstubAllEnvs());

it('resolveInside menerima path di dalam root berspasi', () => {
  const root = makeTempRoot();
  expect(resolveInside(root, 'flows', 'a', 'flow.json')).toBe(path.join(root, 'flows', 'a', 'flow.json'));
});
it('resolveInside menolak jalan keluar', () => {
  const root = makeTempRoot();
  for (const bad of [['..'], ['..', 'x'], ['flows', '..', '..', 'x'], [path.parse(root).root, 'Windows']])
    expect(() => resolveInside(root, ...bad)).toThrow(expect.objectContaining({ code: 'PATH_OUTSIDE_ROOT' }));
});
it('resolveInside menolak junction ke luar root', () => {
  const root = makeTempRoot(); const outside = makeTempRoot();
  fs.symlinkSync(outside, path.join(root, 'link'), 'junction');
  expect(() => resolveInside(root, 'link', 'file.txt')).toThrow(expect.objectContaining({ code: 'PATH_OUTSIDE_ROOT' }));
});
it('resolveInside menolak junction menggantung ke luar root', () => {
  const root = makeTempRoot(); const outside = makeTempRoot();
  fs.symlinkSync(outside, path.join(root, 'link'), 'junction');
  fs.rmdirSync(outside); // menulis lewat tautan menggantung akan membuat file di luar root
  expect(() => resolveInside(root, 'link', 'file.txt')).toThrow(expect.objectContaining({ code: 'PATH_OUTSIDE_ROOT' }));
});
it('resolveInside menerima nama yang diawali dua titik', () => {
  const root = makeTempRoot();
  expect(resolveInside(root, '..backup', 'x.md')).toBe(path.join(root, '..backup', 'x.md'));
});
it('toRepoRelative memakai / dan null di luar root', () => {
  const root = makeTempRoot();
  expect(toRepoRelative(root, path.join(root, 'projects', 'a', 'x.ts'))).toBe('projects/a/x.ts');
  expect(toRepoRelative(root, path.join(path.dirname(root), 'lain'))).toBeNull();
  if (process.platform === 'win32') expect(toRepoRelative(root, path.join(root.toUpperCase(), 'b.txt'))).toBe('b.txt');
});
it('isGitWorktree membedakan .git folder dan file', () => {
  const a = makeTempRoot(); fs.mkdirSync(path.join(a, '.git'));
  const b = makeTempRoot(); fs.writeFileSync(path.join(b, '.git'), 'gitdir: C:/x/.git/worktrees/b');
  const c = makeTempRoot();
  expect([isGitWorktree(a), isGitWorktree(b), isGitWorktree(c)]).toEqual([false, true, false]);
});
it('repoRootFromBin naik dua tingkat dari dashboard/bin', () => {
  const root = makeTempRoot();
  expect(repoRootFromBin(pathToFileURL(path.join(root, 'dashboard', 'bin', 'run.mjs')).href)).toBe(root);
});
it('cliRoot memakai VIDEO_REPO_ROOT bila ada, jika tidak naik dari dashboard/bin', () => {
  const root = makeTempRoot();
  const bin = pathToFileURL(path.join(root, 'dashboard', 'bin', 'run.mjs')).href;
  vi.stubEnv('VIDEO_REPO_ROOT', undefined);
  expect(cliRoot(bin)).toBe(root);
  vi.stubEnv('VIDEO_REPO_ROOT', path.join(root, 'override'));
  expect(cliRoot(bin)).toBe(path.join(root, 'override'));
});
