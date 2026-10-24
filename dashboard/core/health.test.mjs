import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { checkHealth } from './health.mjs';
import { makeFixtureRepo } from './test-utils.mjs';

// win32 passes one command string ("uv --version"), other platforms pass (cmd, ['--version']); the first word names the tool either way.
const fakeSpawn = (answers) => (cmd) => answers[String(cmd).split(' ')[0]] ?? { status: 0, stdout: '11.16.0\n' };

it('checkHealth dengan alat yang hilang', () => {
  const root = makeFixtureRepo();
  const spawnSync = fakeSpawn({ uv: { status: 0, stdout: 'uv 0.11.8 (abc 2026-04-27)' }, claude: { error: new Error('ENOENT') } });
  expect(checkHealth(root, { spawnSync })).toMatchObject({ node: process.versions.node, npm: '11.16.0', uv: '0.11.8',
    claude: null, hooksInstalled: false, commandInstalled: false, isWorktree: false, sharedBrowser: false });
});

// R19: win32 passes uv/claude as one constant string with shell:true and no args array (an array plus a shell prints Node's DEP0190 warning);
// other platforms pass (cmd, ['--version']) without a shell. npm never uses a shell.
it('versi uv dan claude: bentuk pemanggilan spawnSync per platform', () => {
  const calls = [];
  const spawnSync = (...args) => { calls.push(args); return { status: 0, stdout: '1.2.3' }; };
  checkHealth(makeFixtureRepo(), { spawnSync });

  const npm = calls.find(([cmd]) => cmd === process.execPath);
  expect(npm[1]).toEqual([expect.stringMatching(/npm-cli\.js$/), '--version']);
  expect(npm[2].shell).toBeUndefined();

  const tools = calls.filter(([cmd]) => ['uv', 'claude'].includes(String(cmd).split(' ')[0]));
  if (process.platform === 'win32') {
    expect(tools.map((c) => c.length)).toEqual([2, 2]); // (command, options), no args array
    expect(tools.map(([cmd, opts]) => [cmd, opts.shell])).toEqual([['uv --version', true], ['claude --version', true]]);
  } else {
    expect(tools.map(([cmd, args, opts]) => [cmd, args, opts.shell])).toEqual([['uv', ['--version'], undefined], ['claude', ['--version'], undefined]]);
  }
});

it('checkHealth: hook, command, worktree, browser bersama, dan status API key (tanpa nilainya)', () => {
  const root = makeFixtureRepo();
  const put = (rel, text) => { const f = path.join(root, ...rel.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
  put('.claude/settings.json', '{"hooks":{"Stop":[{"hooks":[{"command":"node","args":["${CLAUDE_PROJECT_DIR}/dashboard/bin/hook.mjs"]}]}]}}');
  put('.claude/commands/buat-video.md', '# buat-video');
  put('.dashboard/browser/x/chrome-headless-shell.exe', 'x');
  put('.dashboard/browser/x/chrome-headless-shell', 'x');
  fs.rmSync(path.join(root, '.git'), { recursive: true });
  put('.git', 'gitdir: ../elsewhere');
  const spawnSync = fakeSpawn({ uv: { status: 1, stdout: '', stderr: 'boom' }, claude: { status: 0, stdout: '2.1.303 (Claude Code)\n' } });
  const h = checkHealth(root, { spawnSync });
  expect(h).toMatchObject({ uv: null, claude: '2.1.303', hooksInstalled: true, commandInstalled: true, isWorktree: true, sharedBrowser: true });
  expect(h.env).toEqual([{ key: 'ELEVENLABS_API_KEY', present: true }, { key: 'RUNPOD_API_KEY', present: false }]);
  expect(JSON.stringify(h)).not.toContain('abc'); // the fixture's key value never appears (NFR-03)
});
