// Claude Code hook payload -> event line in .dashboard/events/<sessionId>.jsonl.
// Node built-ins plus paths/jsonfile/run-store only (no zod): hook.mjs runs on every Claude tool call and must stay fast.
import { appendJsonLine } from './jsonfile.mjs';
import { resolveInside, toRepoRelative } from './paths.mjs';
import { readActiveRun, readRun, sessionEventsPath, writeActiveRun, writeRun } from './run-store.mjs';

const FILE_TOOLS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'];
const AGENT_TOOLS = ['Agent', 'Task']; // the sub-agent tool is named Task in other Claude Code versions
// The command Claude runs to begin a run, anchored at the start of the (rtk-stripped) command: an executed
// `node ... run.mjs start`, not text that merely mentions it (grep, echo, cat). The first successful one binds the session to the run.
const START_COMMAND = /^\s*node\s+(?:"[^"]*run\.mjs"|'[^']*run\.mjs'|\S*run\.mjs)\s+start\b/;

// `rtk` (and `rtk proxy`) is only a token-saving wrapper; the dashboard shows the real command.
export const stripRtk = (command) => command.replace(/^\s*rtk\s+(?:proxy\s+)?/, '');

const firstLine = (text) => String(text ?? '').split(/\r?\n/)[0].slice(0, 500);

// What a tool that has finished shows as: the mapping for PostToolUse, which PostToolUseFailure reuses with ok false.
function finished(p, root, input) {
  switch (p.tool_name) {
    case 'Bash':
      return { type: 'command', phase: 'end', toolUseId: p.tool_use_id, summary: stripRtk(String(input.command ?? '')).slice(0, 500), detail: { durationMs: p.duration_ms ?? null } };
    case 'Skill':
      return { type: 'skill', summary: input.skill };
    default: {
      if (AGENT_TOOLS.includes(p.tool_name)) return { type: 'agent', phase: 'end', toolUseId: p.tool_use_id, summary: input.description };
      const file = input.file_path ?? input.notebook_path;
      if (FILE_TOOLS.includes(p.tool_name) && typeof file === 'string') return { type: 'file', summary: toRepoRelative(root, file) ?? file };
      return { type: 'tool', summary: p.tool_name };
    }
  }
}

// null when the payload is not worth a line in the log.
export function toEvent(p, root, now) {
  const input = p.tool_input ?? {};
  const event = (fields) => ({ ts: now.toISOString(), sessionId: p.session_id, runId: null, tool: p.tool_name ?? null, ok: null, ...fields });
  switch (p.hook_event_name) {
    case 'UserPromptSubmit':
      return event({ type: 'prompt', summary: String(p.prompt ?? '').slice(0, 500) });
    case 'PreToolUse':
      if (p.tool_name === 'Bash') return event({ type: 'command', phase: 'start', toolUseId: p.tool_use_id, summary: stripRtk(String(input.command ?? '')).slice(0, 500) });
      if (AGENT_TOOLS.includes(p.tool_name)) return event({ type: 'agent', phase: 'start', toolUseId: p.tool_use_id, summary: input.description });
      return null;
    case 'PostToolUse':
      return event({ ...finished(p, root, input), ok: true });
    case 'PostToolUseFailure':
      return event({ ...finished(p, root, input), ok: false, error: firstLine(p.error) });
    case 'Notification':
      return event({ type: 'notification', summary: p.message, detail: { notificationType: p.notification_type } });
    case 'Stop':
      return event({ type: 'stop', ok: true, detail: { backgroundTasks: p.background_tasks?.length ?? 0 } });
    case 'StopFailure':
      return event({ type: 'stop', ok: false, error: p.error });
    case 'SessionStart':
      return event({ type: 'session-start', detail: { source: p.source } });
    case 'SessionEnd':
      return event({ type: 'session-end', detail: { reason: p.reason } });
    default:
      return null;
  }
}

// run.json first, then the marker: the marker decides which events get the runId, so it only changes once run.json has.
function bindSession(root, active, sessionId) {
  const r = readRun(root, active.project, active.runId);
  if (r.ok) writeRun(root, { ...r.value, sessionId }); // a corrupt run.json is the user's file: leave it alone
  writeActiveRun(root, { ...active, sessionId });
}

function logError(root, now, e) {
  try {
    appendJsonLine(resolveInside(root, '.dashboard', 'hook-errors.log'), { ts: now.toISOString(), error: e?.message ?? String(e) });
  } catch { /* even the log is unwritable (e.g. root gone): nothing left to do */ }
}

// Never throws: a hook that fails must not disturb Claude. Problems go to .dashboard/hook-errors.log instead.
export function hookMain(root, stdinText, now) {
  try {
    const event = toEvent(JSON.parse(stdinText), root, now);
    if (!event) return;
    if (typeof event.sessionId !== 'string' || !event.sessionId) throw new Error('Payload hook tanpa session_id.');
    let active = readActiveRun(root);
    // Only a start that succeeded binds (a failed one made no run), and a failed bind must not cost the event itself.
    if (active?.sessionId === null && event.ok === true && event.type === 'command' && event.phase === 'end' && START_COMMAND.test(event.summary)) {
      try {
        bindSession(root, active, event.sessionId);
        active = { ...active, sessionId: event.sessionId };
      } catch (e) { logError(root, now, e); }
    }
    if (active?.sessionId === event.sessionId) event.runId = active.runId;
    appendJsonLine(sessionEventsPath(root, event.sessionId), event);
  } catch (e) {
    logError(root, now, e);
  }
}
