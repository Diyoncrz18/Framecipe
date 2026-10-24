// Health of the local setup for Beranda and Pengaturan. Versions come from short child processes (5 s limit each);
// API keys are reported as filled or empty only, never their values (NFR-03).
import { spawnSync as nodeSpawnSync } from 'node:child_process';
import fs from 'node:fs';
import { allEnvKeys, envStatus, readCatalog } from './catalog.mjs';
import { isGitWorktree, resolveInside } from './paths.mjs';
import { findBrowserExe, sharedBrowserDir } from './remotion.mjs';
import { npmCliPath } from './run-ops.mjs';

const OPTS = { encoding: 'utf8', timeout: 5000 };

// First x.y.z in stdout, or null when the tool is missing, failed or printed no version.
function versionOf(r) {
  return !r.error && r.status === 0 ? /\d+\.\d+\.\d+/.exec(r.stdout ?? '')?.[0] ?? null : null;
}

// Windows resolves uv and claude through cmd shims, so they need a shell. The command is one constant string with no args
// array: that avoids Node 24's DEP0190 warning, and no user text ever reaches it (NFR-04).
function toolVersion(spawnSync, tool) {
  return versionOf(process.platform === 'win32'
    ? spawnSync(tool === 'uv' ? 'uv --version' : 'claude --version', { ...OPTS, shell: true })
    : spawnSync(tool, ['--version'], OPTS));
}

// Absolute path inside root, or null when it leaves the root or the root is unusable (NFR-02).
function inside(root, ...segs) {
  try { return resolveInside(root, ...segs); } catch { return null; }
}

function hookInstalled(root) {
  const file = inside(root, '.claude', 'settings.json');
  try { return !!file && fs.readFileSync(/*turbopackIgnore: true*/ file, 'utf8').includes('dashboard/bin/hook.mjs'); } catch { return false; }
}

function commandInstalled(root) {
  const file = inside(root, '.claude', 'commands', 'buat-video.md');
  return !!file && fs.existsSync(/*turbopackIgnore: true*/ file);
}

/** @typedef {{ node: string, npm: string | null, uv: string | null, claude: string | null, hooksInstalled: boolean, commandInstalled: boolean,
 *   isWorktree: boolean, sharedBrowser: boolean, env: { key: string, present: boolean }[] }} Health */

/** @param {string} root @returns {Health} */
export function checkHealth(root, deps = { spawnSync: nodeSpawnSync }) {
  const { spawnSync } = deps;
  return {
    node: process.versions.node,
    npm: versionOf(spawnSync(process.execPath, [npmCliPath(), '--version'], OPTS)),
    uv: toolVersion(spawnSync, 'uv'),
    claude: toolVersion(spawnSync, 'claude'),
    hooksInstalled: hookInstalled(root),
    commandInstalled: commandInstalled(root),
    isWorktree: isGitWorktree(root),
    sharedBrowser: findBrowserExe(sharedBrowserDir(root)) !== null,
    env: envStatus(root, allEnvKeys(readCatalog(root))),
  };
}
