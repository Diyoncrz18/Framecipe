// Node built-ins only: hook.mjs imports this module.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Path from root to p, or null when p lies outside root (path.relative ignores case on win32).
// A bare '..' prefix test would wrongly reject names like '..backup', so match '..' as a whole segment.
function relInside(root, p) {
  const rel = path.relative(root, p);
  return rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel) ? null : rel;
}

// Real path of the closest ancestor of p that exists. lstat, not exists: a dangling link still counts
// as existing and returns null (unresolvable, so rejected), because writing through it would create
// the target outside the root.
function realAncestor(p) {
  let cur = p;
  while (!fs.lstatSync(cur, { throwIfNoEntry: false })) cur = path.dirname(cur);
  try { return fs.realpathSync.native(cur); } catch { return null; }
}

export function resolveInside(root, ...segments) {
  const p = path.resolve(root, ...segments);
  const outside = () => Object.assign(new Error(`Path is outside the repo root: ${segments.join('/')}`), { code: 'PATH_OUTSIDE_ROOT' });
  if (relInside(root, p) === null) throw outside();
  const realRoot = fs.realpathSync.native(root); // throws ENOENT for a missing root: a config error, not a traversal
  const real = realAncestor(p);
  if (real === null || relInside(realRoot, real) === null) throw outside();
  return p;
}

export function toRepoRelative(root, absPath) {
  return relInside(root, absPath)?.split(path.sep).join('/') ?? null;
}

export function isGitWorktree(root) {
  return fs.statSync(path.join(root, '.git'), { throwIfNoEntry: false })?.isFile() ?? false;
}

export function repoRootFromBin(binFileUrl) {
  return path.resolve(path.dirname(fileURLToPath(binFileUrl)), '..', '..');
}

export function cliRoot(binFileUrl) {
  return process.env.VIDEO_REPO_ROOT ?? repoRootFromBin(binFileUrl);
}
