#!/usr/bin/env node
// Called by Claude Code hooks (payload as JSON on stdin) to log what Claude does. Always exits 0 and prints nothing:
// a logging hook must never block or confuse Claude. Errors end up in .dashboard/hook-errors.log (see hook-events.mjs).
import { hookMain } from '../core/hook-events.mjs';
import { cliRoot } from '../core/paths.mjs';

try {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  hookMain(cliRoot(import.meta.url), Buffer.concat(chunks).toString('utf8'), new Date());
} finally {
  process.exit(0); // also when reading stdin failed
}
