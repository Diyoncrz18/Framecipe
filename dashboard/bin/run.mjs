#!/usr/bin/env node
// The command Claude runs at every stage of a video run. Success: the result as JSON on stdout.
// Failure: the message on stderr, {"error":"<code>"} on stdout, exit code 1.
// install and render let npm and Remotion write straight to the terminal, so their JSON is the last line of stdout.
// finish also exits 1 when it fails the run: its JSON then carries status "failed" and the reason as the message.
import { parseArgs } from 'node:util';
import { cliRoot, isGitWorktree } from '../core/paths.mjs';

const root = cliRoot(import.meta.url);
const coded = (code, message) => Object.assign(new Error(message), { code });

const OPTIONS = {
  request: { type: 'string' }, flow: { type: 'string' }, topic: { type: 'string' }, notes: { type: 'string' },
  retry: { type: 'string' }, trigger: { type: 'string' }, reason: { type: 'string' }, count: { type: 'string' },
};

// Each command gets run-ops, the parsed options and the positional arguments after the command name.
const COMMANDS = {
  start: (ops, v) => ops.startRun(root, { request: v.request, flow: v.flow, topic: v.topic, notes: v.notes, retry: v.retry, trigger: v.trigger }),
  stage: (ops, v, args) => ops.stageRun(root, args[0]),
  wait: (ops, v) => ops.waitRun(root, v.reason),
  fail: (ops, v) => ops.failRun(root, v.reason),
  status: (ops) => ops.statusRun(root),
  install: (ops) => ops.installDeps(root),
  render: (ops) => ops.renderVideo(root),
  stills: (ops, v) => ops.extractStills(root, v.count === undefined ? 4 : Number(v.count)),
  finish: (ops) => {
    const result = ops.finishRun(root);
    if (result.status === 'failed') process.exitCode = 1; // the result (with the reason) still goes to stdout as JSON
    return result;
  },
};

async function main() {
  // Before run-ops is loaded: a git worktree may have no node_modules, and run-ops needs zod. (Same message as run-ops.startRun.)
  if (isGitWorktree(root)) throw coded('WORKTREE', `Jalankan dari folder repo utama, bukan git worktree (${root}).`);
  let parsed;
  try {
    parsed = parseArgs({ allowPositionals: true, options: OPTIONS });
  } catch (e) {
    throw coded('BAD_ARGS', `Argumen tidak lengkap: ${e.message}`);
  }
  const [command, ...args] = parsed.positionals;
  if (!Object.hasOwn(COMMANDS, command ?? '')) {
    throw coded('BAD_ARGS', `Argumen tidak lengkap: subperintah ${command ? `"${command}" tidak dikenal` : 'wajib diisi'}. Pilihan: ${Object.keys(COMMANDS).join(', ')}.`);
  }
  return COMMANDS[command](await import('../core/run-ops.mjs'), parsed.values, args);
}

try {
  console.log(JSON.stringify(await main()));
} catch (e) {
  console.error(e.message);
  console.log(JSON.stringify({ error: e.code ?? 'INTERNAL' }));
  process.exitCode = 1; // not process.exit(): it can cut off output still waiting in the pipe
}
