// Where run state lives and how to read it. Node built-ins plus paths.mjs/jsonfile.mjs only (no zod):
// hook.mjs imports this module and must stay fast and dependency-free.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { readJson, readJsonLines, writeJsonAtomic } from './jsonfile.mjs';
import { resolveInside } from './paths.mjs';

export const activeRunPath = (root) => resolveInside(root, '.dashboard', 'active-run.json');

// A missing, corrupt or malformed marker counts as "no active run".
export function readActiveRun(root) {
  const r = readJson(activeRunPath(root));
  return r.ok && typeof r.value?.runId === 'string' && typeof r.value.project === 'string' ? r.value : null;
}

export const writeActiveRun = (root, active) => writeJsonAtomic(activeRunPath(root), active);

export const clearActiveRun = (root) => fs.rmSync(activeRunPath(root), { force: true });

export function runPaths(root, project, runId) {
  const at = (...rest) => resolveInside(root, 'projects', project, 'runs', runId, ...rest);
  return { dir: at(), runFile: at('run.json'), flowFile: at('flow.json'), framesDir: at('frames') };
}

export const readRun = (root, project, runId) => readJson(runPaths(root, project, runId).runFile);

export const writeRun = (root, run) => writeJsonAtomic(runPaths(root, run.project, run.runId).runFile, run);

export const requestPath = (root, id) => resolveInside(root, '.dashboard', 'requests', `${id}.json`);

// Session ids come from Claude Code, so never trust them as a file name: anything outside [A-Za-z0-9_-] is hashed.
export function safeSessionId(id) {
  const s = String(id);
  return /^[A-Za-z0-9_-]+$/.test(s) ? s : createHash('sha1').update(s).digest('hex').slice(0, 16);
}

export const sessionEventsPath = (root, sessionId) => resolveInside(root, '.dashboard', 'events', `${safeSessionId(sessionId)}.jsonl`);

// Latest of: run start, every stage start, and the last event of the bound session.
// shortcut: reads the whole session log to get its last line; add a tail read if logs ever get big.
export function lastActivityAt(root, run) {
  const times = [run.startedAt, ...(run.stages ?? []).map((s) => s.startedAt)];
  if (run.sessionId) {
    try {
      const last = readJsonLines(sessionEventsPath(root, run.sessionId)).items.at(-1);
      if (last?.ts) times.push(last.ts);
    } catch { /* unreadable log (readJsonLines rethrows non-ENOENT): fall back to the run's own timestamps */ }
  }
  return new Date(Math.max(...times.map((t) => new Date(t).getTime()).filter(Number.isFinite)));
}
