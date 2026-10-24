// Effective status, timeline and summary of runs, derived from run.json plus the bound session's event log (JMB-05, PRD 9.1).
// A run.json, event line or event file that is broken marks that one item corrupt or empty and never throws (NFR-07).
import fs from 'node:fs';
import { STAGES, eventSchema, runSchema } from './contracts.mjs';
import { readJson, readJsonLines, writeJsonAtomic } from './jsonfile.mjs';
import { STAGE_LABELS, STATUS_LABELS } from './labels.mjs';
import { resolveInside } from './paths.mjs';
import { listProjectRuns } from './projects.mjs';
import { clearActiveRun, lastActivityAt, readActiveRun, readRun, runPaths, sessionEventsPath } from './run-store.mjs';

const FAILED_LIKE = new Set(['failed', 'abandoned', 'cancelled']); // display statuses of a run that ended without success: its current stage failed
const READ_TOOLS = new Set(['Read', 'Grep', 'Glob']);
const PYTHON_TOOL = /uv run (?:python )?tools\/([\w-]+)\.py/;
const RENDER_COMMAND = /run\.mjs\s+render/;

const ms = (iso) => Date.parse(iso);
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const unique = (list) => [...new Set(list)];
const attempt = (fn, fallback) => { try { return fn(); } catch { return fallback; } };
// project and runId can come from a URL: only plain folder names pass (same rule as projects.mjs).
const isName = (s) => typeof s === 'string' && s !== '' && !s.startsWith('.') && !/[\\/\0]/.test(s);

// shortcut: re-reads the whole log on every call (like lastActivityAt); add a tail read or a cache if logs ever get big.
function sessionEvents(root, sessionId) {
  if (!sessionId) return [];
  // readJsonLines rethrows anything but ENOENT (a folder, no permission): that log counts as empty.
  // A line that parses as JSON but is not an event (an object summary, an unknown type) is skipped: the views render these fields as text.
  return attempt(() => readJsonLines(sessionEventsPath(root, sessionId)).items.filter((e) => eventSchema.safeParse(e).success), []);
}

// `all`: the session's events. The trigger prompt is the last prompt at or before the run's start; the window ends when the run did, or at `now`.
// The command that ends the run (`run.mjs finish` or `fail`) writes endedAt before its end event is logged, so an end event after the window
// still belongs to it when its start (same toolUseId) is inside.
function windowOf(run, all, now) {
  const start = ms(run.startedAt);
  const trigger = all.findLast((e) => e.type === 'prompt' && ms(e.ts) <= start) ?? null;
  const from = trigger ? ms(trigger.ts) : start;
  const to = run.endedAt ? ms(run.endedAt) : now.getTime();
  const inside = all.filter((e) => ms(e.ts) >= from && ms(e.ts) <= to);
  const started = new Set(inside.filter((e) => e.phase === 'start' && e.toolUseId).map((e) => e.toolUseId));
  return { trigger, events: [...inside, ...all.filter((e) => e.phase === 'end' && started.has(e.toolUseId) && ms(e.ts) > to)] };
}

export const runWindowEvents = (root, run, now) => windowOf(run, sessionEvents(root, run.sessionId), now).events;

// Stored statuses other than "running" are shown as they are (rules 1 and 2: waiting included); only a running run can turn into something else.
// Claude has stopped when its last turn ended with nothing in the background, when the turn failed (StopFailure: ok false) or when the session ended.
export function displayStatus(run, lastEvent, lastActivity, now, staleMs = 900000) {
  if (run.status !== 'running') return run.status;
  if (lastEvent?.type === 'notification' && lastEvent.detail?.notificationType === 'permission_prompt') return 'waiting-permission';
  if (lastEvent?.type === 'session-end' || (lastEvent?.type === 'stop' && (lastEvent.ok === false || lastEvent.detail?.backgroundTasks === 0))) return 'stopped';
  return now - lastActivity > staleMs ? 'abandoned' : 'running';
}

// The event the status rules look at. Claude Code sends an idle_prompt notification about a minute after a turn ends: if it counted as the
// last event it would hide the stop before it, so only a permission_prompt notification does.
const statusEvent = (events) => events.findLast((e) => e.type !== 'notification' || e.detail?.notificationType === 'permission_prompt') ?? null;

// The session log is only read for a running run, the one case that needs it (`events`: already parsed, so it is not read again).
export function effectiveStatus(root, run, now, events) {
  if (run.status !== 'running') return displayStatus(run, null, new Date(run.startedAt), now);
  const all = events ?? sessionEvents(root, run.sessionId);
  return displayStatus(run, statusEvent(all), lastActivityAt(root, run, all), now);
}

export function summarizeRun(events, plannedSkills = []) {
  const ended = events.filter((e) => e.type === 'command' && e.phase === 'end');
  // A failed Skill or file tool call (ok false) did not use the skill or change the file.
  const used = (type) => unique(events.filter((e) => e.type === type && e.ok !== false && typeof e.summary === 'string').map((e) => e.summary));
  const skillsUsed = used('skill');
  const failure = events.findLast((e) => e.ok === false);
  const render = ended.findLast((e) => RENDER_COMMAND.test(e.summary));
  return {
    skillsUsed,
    skillsPlannedNotUsed: plannedSkills.filter((s) => !skillsUsed.includes(s)),
    pythonTools: unique(ended.map((e) => PYTHON_TOOL.exec(e.summary)?.[1]).filter(Boolean)),
    filesChanged: used('file'),
    commandCount: ended.length,
    readCount: events.filter((e) => e.type === 'tool' && READ_TOOLS.has(e.summary)).length,
    renderMs: typeof render?.detail?.durationMs === 'number' ? render.detail.durationMs : null,
    lastError: failure ? { ts: failure.ts, summary: failure.summary ?? '', error: failure.error ?? '' } : null,
  };
}

// Every run folder of every project (folders starting with "." are not projects), as listProjectRuns reports it.
function allRuns(root) {
  const projects = attempt(() => fs.readdirSync(resolveInside(root, 'projects'), { withFileTypes: true }), [])
    .filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name);
  return projects.flatMap((project) => listProjectRuns(root, project).map((r) => ({ project, ...r })));
}

const CORRUPT_FIELDS = { topic: null, flow: null, trigger: null, status: null, displayStatus: null, stage: null, startedAt: null, endedAt: null, durationMs: null, retryOf: null };

/** Newest first; runs whose run.json is broken come last. */
export function listRuns(root, now = new Date()) {
  const items = allRuns(root).map(({ project, runId, run }) => (run ? {
    project, runId, topic: run.topic, flow: run.flow, trigger: run.trigger, status: run.status, displayStatus: effectiveStatus(root, run, now),
    stage: run.stage, startedAt: run.startedAt, endedAt: run.endedAt, durationMs: (run.endedAt ? ms(run.endedAt) : now.getTime()) - ms(run.startedAt),
    retryOf: run.retryOf, corrupt: false,
  } : { project, runId, ...CORRUPT_FIELDS, corrupt: true }));
  const byId = (a, b) => b.runId.localeCompare(a.runId);
  return [
    ...items.filter((i) => !i.corrupt).sort((a, b) => ms(b.startedAt) - ms(a.startedAt) || byId(a, b)),
    ...items.filter((i) => i.corrupt).sort(byId),
  ];
}

// run.json as written (unknown fields kept) once it passes runSchema, else null: missing, corrupt, or names that are not plain folder names.
function loadRun(root, project, runId) {
  if (!isName(project) || !isName(runId)) return null;
  return attempt(() => { // a link out of the repo makes resolveInside throw
    const r = readRun(root, project, runId);
    return r.ok && runSchema.safeParse(r.value).success ? r.value : null;
  }, null);
}

// Every STAGES entry. A stage entered more than once shows its latest entry.
function stageList(run, status, now) {
  const lastEntered = Math.max(-1, ...run.stages.map((s) => STAGES.indexOf(s.name)));
  return STAGES.map((name, i) => {
    const e = run.stages.findLast((s) => s.name === name);
    const current = name === run.stage;
    // Keyed on the display status, so a stale run not swept yet (stored running) looks the same as after the sweep (stored abandoned).
    const state = current && FAILED_LIKE.has(status) ? 'failed' : current && status !== 'success' ? 'active' : e ? 'done' : i < lastEntered ? 'skipped' : 'pending';
    return { name, label: STAGE_LABELS[name], state, startedAt: e?.startedAt ?? null, endedAt: e?.endedAt ?? null,
      durationMs: e ? (e.endedAt ? ms(e.endedAt) : now.getTime()) - ms(e.startedAt) : null };
  });
}

// Frame files of the run, repo-relative with '/', in numeric order (frame-2 before frame-10).
function listFrames(root, project, runId) {
  return attempt(() => fs.readdirSync(runPaths(root, project, runId).framesDir, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.(jpe?g|png)$/i.test(e.name)).map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => `projects/${project}/runs/${runId}/frames/${name}`), []);
}

/** null when the run is missing or its run.json is corrupt. */
export function readRunDetail(root, project, runId, now = new Date()) {
  const run = loadRun(root, project, runId);
  if (!run) return null;
  const all = sessionEvents(root, run.sessionId); // read once for the status and the window
  const status = effectiveStatus(root, run, now, all);
  const { trigger, events } = windowOf(run, all, now);
  const snapshot = attempt(() => readJson(runPaths(root, project, runId).flowFile), null);
  const flowSnapshot = snapshot?.ok && isObject(snapshot.value) ? snapshot.value : null;
  const planned = Array.isArray(flowSnapshot?.skills) ? flowSnapshot.skills.filter((s) => typeof s === 'string') : [];
  const stageItems = run.stages.map((s) => ({ ts: s.startedAt, type: 'stage', summary: STAGE_LABELS[s.name] }));
  return {
    run, flowSnapshot, displayStatus: status, stages: stageList(run, status, now),
    timeline: [...events, ...stageItems].sort((a, b) => ms(a.ts) - ms(b.ts)),
    summary: summarizeRun(events, planned),
    triggerPrompt: trigger?.summary ?? null,
    frames: listFrames(root, project, runId),
    script: run.status === 'waiting' ? attempt(() => fs.readFileSync(resolveInside(root, 'projects', project, 'VOICEOVER-SCRIPT.md'), 'utf8'), null) : null,
  };
}

// Only a run nobody is working on (abandoned) or one Claude stopped (stopped) can be marked failed from the dashboard.
// An already-set endedAt stays: it is when the run really ended, and the event window must not grow past it.
export function markRunFailed(root, project, runId, reason, now) {
  const run = loadRun(root, project, runId);
  if (!run) throw new Error(`Run ${runId} tidak ditemukan atau datanya rusak.`);
  const status = effectiveStatus(root, run, now);
  if (!['abandoned', 'stopped'].includes(status)) throw new Error(`Run ini tidak bisa ditandai gagal karena statusnya ${STATUS_LABELS[status]}.`);
  const iso = now.toISOString();
  // Written to the folder the run was found in, not to run.project: the field can be hand-edited.
  writeJsonAtomic(runPaths(root, project, runId).runFile, {
    ...run, status: 'failed', waitReason: null, error: { stage: run.stage, message: reason }, endedAt: run.endedAt ?? iso,
    stages: run.stages.map((s) => ({ ...s, endedAt: s.endedAt ?? iso })),
  });
  const active = readActiveRun(root);
  if (active?.runId === runId && active.project === project) clearActiveRun(root);
}

/** Per skill: how many runs used it and when it was last used. Skill names come from event text, hence a Map before the plain object. */
export function skillUsage(root, now = new Date()) {
  const usage = new Map();
  for (const { run } of allRuns(root)) {
    if (!run?.sessionId) continue;
    const lastUse = new Map(); // skill -> ts of its latest use in this run
    for (const e of runWindowEvents(root, run, now)) {
      if (e.type === 'skill' && e.ok !== false && typeof e.summary === 'string' && ms(e.ts) >= ms(lastUse.get(e.summary) ?? e.ts)) lastUse.set(e.summary, e.ts);
    }
    for (const [skill, ts] of lastUse) {
      const u = usage.get(skill) ?? { runs: 0, lastUsedAt: ts };
      usage.set(skill, { runs: u.runs + 1, lastUsedAt: ms(ts) > ms(u.lastUsedAt) ? ts : u.lastUsedAt });
    }
  }
  return Object.fromEntries(usage);
}
