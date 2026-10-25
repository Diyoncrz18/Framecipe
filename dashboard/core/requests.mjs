// A video request: the dashboard writes .dashboard/requests/<id>.json and the user pastes `/buat-video req=<id>` into Claude Code.
// The topic and notes only ever go into this file, never into the prompt, so no user text becomes a command argument (NFR-04).
import fs from 'node:fs';
import { isPlainId, loadUsableFlow } from './flows.mjs';
import { newRequestId } from './ids.mjs';
import { readJson, writeJsonAtomic } from './jsonfile.mjs';
import { readRun, requestPath } from './run-store.mjs';
import { readSources } from './uploads.mjs';

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

// `uploads` is the batch folder the upload route made, `files` the stored names in it that the form kept.
/**
 * @param {string} root
 * @param {{ flow?: string, topic?: string, notes?: string, uploads?: string | null, files?: string[] }} [input]
 * @returns {{ ok: true, id: string, prompt: string } | { ok: false, errors: string[] }}
 */
export function createRequest(root, { flow, topic, notes, uploads = null, files = [] } = {}, now = new Date()) {
  const errors = [...(loadUsableFlow(root, flow).errors ?? [])];
  const t = clean(topic);
  const n = clean(notes);
  if (!t) errors.push('Topik wajib diisi.');
  else if (t.length > 200) errors.push('Topik maksimal 200 karakter.');
  if (n.length > 2000) errors.push('Catatan maksimal 2000 karakter.');
  const found = readSources(root, uploads, files);
  if (!found.ok) errors.push(...found.errors);
  if (errors.length) return { ok: false, errors };
  let id;
  do id = newRequestId(); while (fs.existsSync(requestPath(root, id))); // 6 hex chars: a clash is unlikely, but it would overwrite a waiting request
  writeJsonAtomic(requestPath(root, id), {
    id, flow, topic: t, notes: n, uploads: found.sources.length ? uploads : null, sources: found.sources,
    createdAt: now.toISOString(), status: 'baru', runId: null,
  });
  return { ok: true, id, prompt: `/buat-video req=${id}` };
}

export const retryPrompt = (runId) => `/buat-video perbaiki=${runId}`;

// A new request with the flow, topic, notes and source files of an earlier run. It uses the flow as it is now, not the run's snapshot.
export function repeatRequest(root, project, runId, now = new Date()) {
  let r = { ok: false };
  try { if (isPlainId(project) && isPlainId(runId)) r = readRun(root, project, runId); } catch { /* a link out of the repo: same as not found */ }
  if (!r.ok || r.value === null || typeof r.value !== 'object') return { ok: false, errors: [`Run "${runId}" tidak ditemukan.`] };
  // The source files come from the run's own request: its upload folder still holds them (runs copy, never move).
  let req = { ok: false };
  try { if (isPlainId(r.value.request)) req = readJson(requestPath(root, r.value.request)); } catch { /* same as no request */ }
  const { uploads = null, sources = [] } = req.ok && req.value && typeof req.value === 'object' ? req.value : {};
  const files = Array.isArray(sources) ? sources.map((s) => s?.name) : [];
  return createRequest(root, { flow: r.value.flow, topic: r.value.topic, notes: r.value.notes, uploads, files }, now);
}
