import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { repoContextForValidation } from './catalog.mjs';
import { checkFlowAgainstRepo, parseFlow } from './contracts.mjs';
import { readJson } from './jsonfile.mjs';

// The real repo: these tests check the files that wire /buat-video into Claude Code.
const real = path.resolve(import.meta.dirname, '..', '..');

it('alur contoh di repo valid terhadap repo asli', () => {
  const flow = readJson(path.join(real, 'flows', 'contoh-penjelasan', 'flow.json')).value;
  expect(parseFlow(flow).ok).toBe(true);
  expect(checkFlowAgainstRepo(flow, repoContextForValidation(real))).toEqual([]);
});
it('settings proyek memasang hook dan izin', () => {
  const s = readJson(path.join(real, '.claude', 'settings.json')).value;
  expect(s.permissions.allow).toEqual(expect.arrayContaining(['Bash(node dashboard/bin/run.mjs *)', 'Edit(/projects/**)']));
  for (const ev of ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'Notification', 'Stop', 'StopFailure', 'SessionStart', 'SessionEnd'])
    expect(JSON.stringify(s.hooks[ev])).toContain('dashboard/bin/hook.mjs');
});
it('command /buat-video memuat aturan inti', () => {
  const t = fs.readFileSync(path.join(real, '.claude', 'commands', 'buat-video.md'), 'utf8');
  for (const s of ['$ARGUMENTS', 'run.mjs start --request', 'run.mjs start --retry', 'run.mjs finish', 'run.mjs fail', 'jangan memulai brainstorming'])
    expect(t).toContain(s);
});
