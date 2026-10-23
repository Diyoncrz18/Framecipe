import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { hookMain, stripRtk, toEvent } from './hook-events.mjs';
import { readJsonLines } from './jsonfile.mjs';
import { readActiveRun, readRun, sessionEventsPath } from './run-store.mjs';
import { defaultDeps, startRun } from './run-ops.mjs';
import { makeFixtureRepo, makeTempRoot } from './test-utils.mjs';

const hookBin = path.join(import.meta.dirname, '..', 'bin', 'hook.mjs');
const now = new Date('2026-10-24T01:53:05.120Z');
const ev = (payload, root = '/r') => toEvent({ session_id: 's1', ...payload }, root, now);
const base = { ts: now.toISOString(), sessionId: 's1', runId: null, tool: null, ok: null };

describe('stripRtk', () => {
  it('membuang awalan rtk dan rtk proxy, hanya di awal', () => {
    expect(stripRtk('rtk npm test')).toBe('npm test');
    expect(stripRtk('rtk proxy git log')).toBe('git log');
    expect(stripRtk('npm test')).toBe('npm test');
    expect(stripRtk('rtkfoo x')).toBe('rtkfoo x');
    expect(stripRtk('echo rtk x')).toBe('echo rtk x');
  });
});

describe('toEvent: tabel pemetaan', () => {
  it('UserPromptSubmit', () => {
    expect(ev({ hook_event_name: 'UserPromptSubmit', prompt: 'halo' })).toEqual({ ...base, type: 'prompt', summary: 'halo' });
  });
  it('UserPromptSubmit dipotong 500 karakter', () => {
    expect(toEvent({ hook_event_name: 'UserPromptSubmit', session_id: 's1', prompt: 'x'.repeat(2000) }, '/r', now).summary).toHaveLength(500);
  });
  it('PreToolUse Bash', () => {
    expect(ev({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_use_id: 't1', tool_input: { command: 'ls' } }))
      .toEqual({ ...base, tool: 'Bash', type: 'command', phase: 'start', toolUseId: 't1', summary: 'ls' });
  });
  it('perintah Bash membuang awalan rtk', () => {
    expect(toEvent({ hook_event_name: 'PreToolUse', session_id: 's1', tool_name: 'Bash', tool_use_id: 't1',
      tool_input: { command: 'rtk npm run render' } }, '/r', now)).toMatchObject({ type: 'command', phase: 'start', summary: 'npm run render', toolUseId: 't1' });
  });
  it('PreToolUse Agent', () => {
    expect(ev({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: 't2', tool_input: { description: 'Cari berkas' } }))
      .toEqual({ ...base, tool: 'Agent', type: 'agent', phase: 'start', toolUseId: 't2', summary: 'Cari berkas' });
  });
  it('PreToolUse lainnya: null', () => {
    expect(ev({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'a' } })).toBeNull();
  });
  it('PostToolUse Bash', () => {
    expect(ev({ hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_use_id: 't1', duration_ms: 1200, tool_input: { command: 'rtk ls' } }))
      .toEqual({ ...base, tool: 'Bash', type: 'command', phase: 'end', ok: true, toolUseId: 't1', summary: 'ls', detail: { durationMs: 1200 } });
  });
  it('PostToolUse Skill', () => {
    expect(ev({ hook_event_name: 'PostToolUse', tool_name: 'Skill', tool_input: { skill: 'remotion-best-practices' } }))
      .toEqual({ ...base, tool: 'Skill', type: 'skill', ok: true, summary: 'remotion-best-practices' });
  });
  it('event file memakai path relatif dengan /', () => {
    const root = makeTempRoot();
    expect(toEvent({ hook_event_name: 'PostToolUse', session_id: 's1', tool_name: 'Write',
      tool_input: { file_path: path.join(root, 'projects', 'a', 'VOICEOVER-SCRIPT.md') } }, root, now))
      .toMatchObject({ type: 'file', summary: 'projects/a/VOICEOVER-SCRIPT.md', ok: true });
  });
  it('event file: Edit, MultiEdit, NotebookEdit; path di luar root apa adanya', () => {
    const root = makeTempRoot();
    const inRoot = path.join(root, 'a b', 'c.ts');
    for (const [tool, input] of [['Edit', { file_path: inRoot }], ['MultiEdit', { file_path: inRoot }], ['NotebookEdit', { notebook_path: inRoot }]]) {
      expect(ev({ hook_event_name: 'PostToolUse', tool_name: tool, tool_input: input }, root)).toMatchObject({ type: 'file', tool, summary: 'a b/c.ts', ok: true });
    }
    const outside = path.join(path.dirname(root), 'elsewhere.txt');
    expect(ev({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: outside } }, root).summary).toBe(outside);
  });
  it('PostToolUse Agent', () => {
    expect(ev({ hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_use_id: 't2', tool_input: { description: 'Cari berkas' } }))
      .toEqual({ ...base, tool: 'Agent', type: 'agent', phase: 'end', ok: true, toolUseId: 't2', summary: 'Cari berkas' });
  });
  it('PostToolUse lainnya', () => {
    expect(ev({ hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: 'a' } }))
      .toEqual({ ...base, tool: 'Read', type: 'tool', ok: true, summary: 'Read' });
  });
  it('kegagalan tool memakai baris pertama error', () => {
    expect(toEvent({ hook_event_name: 'PostToolUseFailure', session_id: 's1', tool_name: 'Bash',
      tool_input: { command: 'npm test' }, error: 'Exit code 1\nError: x' }, '/r', now)).toMatchObject({ type: 'command', ok: false, error: 'Exit code 1' });
  });
  it('PostToolUseFailure untuk tool lain mengikuti pemetaan PostToolUse', () => {
    expect(ev({ hook_event_name: 'PostToolUseFailure', tool_name: 'Read', tool_input: {}, error: 'File not found\nmore' }))
      .toEqual({ ...base, tool: 'Read', type: 'tool', ok: false, summary: 'Read', error: 'File not found' });
    expect(ev({ hook_event_name: 'PostToolUseFailure', tool_name: 'Write', tool_input: { file_path: 'x' }, error: 'denied' }))
      .toMatchObject({ type: 'file', ok: false, error: 'denied' });
  });
  it('Notification', () => {
    expect(ev({ hook_event_name: 'Notification', message: 'Claude butuh izin', notification_type: 'permission_prompt' }))
      .toEqual({ ...base, type: 'notification', summary: 'Claude butuh izin', detail: { notificationType: 'permission_prompt' } });
  });
  it('Stop menghitung background_tasks', () => {
    expect(ev({ hook_event_name: 'Stop', background_tasks: [{}, {}] })).toEqual({ ...base, type: 'stop', ok: true, detail: { backgroundTasks: 2 } });
    expect(ev({ hook_event_name: 'Stop' }).detail).toEqual({ backgroundTasks: 0 });
  });
  it('StopFailure', () => {
    expect(ev({ hook_event_name: 'StopFailure', error: 'rate_limit' })).toEqual({ ...base, type: 'stop', ok: false, error: 'rate_limit' });
  });
  it('SessionStart dan SessionEnd', () => {
    expect(ev({ hook_event_name: 'SessionStart', source: 'startup' })).toEqual({ ...base, type: 'session-start', detail: { source: 'startup' } });
    expect(ev({ hook_event_name: 'SessionEnd', reason: 'clear' })).toEqual({ ...base, type: 'session-end', detail: { reason: 'clear' } });
  });
  it('event lain: null', () => {
    expect(ev({ hook_event_name: 'PreCompact' })).toBeNull();
  });
});

describe('hookMain', () => {
  it('hookMain mengikat sesi ke run aktif lewat perintah start', () => {
    const root = makeFixtureRepo();
    const r = startRun(root, { flow: 'contoh-penjelasan', topic: 'Halo' }, { ...defaultDeps, claudeVersion: () => null });
    hookMain(root, JSON.stringify({ hook_event_name: 'PostToolUse', session_id: 's1', tool_name: 'Bash',
      tool_input: { command: 'node dashboard/bin/run.mjs start --request abc' } }), now);
    expect(readActiveRun(root).sessionId).toBe('s1');
    expect(readRun(root, 'halo', r.runId).value.sessionId).toBe('s1');
    expect(readJsonLines(sessionEventsPath(root, 's1')).items[0]).toMatchObject({ runId: r.runId, type: 'command' });
    hookMain(root, JSON.stringify({ hook_event_name: 'PostToolUse', session_id: 's2', tool_name: 'Read' }), now);
    expect(readActiveRun(root).sessionId).toBe('s1');
    expect(readJsonLines(sessionEventsPath(root, 's2')).items[0].runId).toBeNull();
  });
  it('sesi yang sudah terikat tidak diganti, dan event berikutnya membawa runId', () => {
    const root = makeFixtureRepo();
    const r = startRun(root, { flow: 'contoh-penjelasan', topic: 'Halo' }, { ...defaultDeps, claudeVersion: () => null });
    const post = (session_id, command) => hookMain(root, JSON.stringify({ hook_event_name: 'PostToolUse', session_id, tool_name: 'Bash', tool_input: { command } }), now);
    post('s1', 'rtk node "dashboard/bin/run.mjs" start --request abc');
    post('s2', 'node dashboard/bin/run.mjs start --request def');
    post('s1', 'npm run render');
    expect(readActiveRun(root).sessionId).toBe('s1');
    expect(readJsonLines(sessionEventsPath(root, 's1')).items.map((e) => e.runId)).toEqual([r.runId, r.runId]);
    expect(readJsonLines(sessionEventsPath(root, 's2')).items[0].runId).toBeNull();
  });
  it('tanpa run aktif: event dicatat, event null dilewati, tanpa session_id masuk log galat', () => {
    const root = makeFixtureRepo();
    hookMain(root, JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 's1', prompt: 'hai' }), now);
    hookMain(root, JSON.stringify({ hook_event_name: 'PreToolUse', session_id: 's1', tool_name: 'Read' }), now);
    expect(readJsonLines(sessionEventsPath(root, 's1')).items).toMatchObject([{ type: 'prompt', runId: null }]);
    hookMain(root, JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: 'tanpa sesi' }), now);
    expect(fs.readdirSync(path.join(root, '.dashboard', 'events'))).toEqual(['s1.jsonl']);
    expect(fs.readFileSync(path.join(root, '.dashboard', 'hook-errors.log'), 'utf8')).toContain('session_id');
  });
  it('hookMain tidak pernah melempar dan bin/hook.mjs selalu keluar 0', () => {
    const root = makeFixtureRepo();
    expect(() => hookMain(root, '{bukan json', now)).not.toThrow();
    expect(fs.existsSync(path.join(root, '.dashboard', 'hook-errors.log'))).toBe(true);
    const r = spawnSync(process.execPath, [hookBin], { input: 'sampah', env: { ...process.env, VIDEO_REPO_ROOT: root } });
    expect(r.status).toBe(0);
  });
  it('bin/hook.mjs mencatat event dari stdin', () => {
    const root = makeFixtureRepo();
    const input = JSON.stringify({ hook_event_name: 'SessionStart', session_id: 's9', source: 'startup' });
    const r = spawnSync(process.execPath, [hookBin], { input, env: { ...process.env, VIDEO_REPO_ROOT: root } });
    expect(r.status).toBe(0);
    expect(readJsonLines(sessionEventsPath(root, 's9')).items).toMatchObject([{ type: 'session-start', detail: { source: 'startup' } }]);
  });
});
