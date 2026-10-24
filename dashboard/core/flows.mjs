// flows/<id>/flow.json: list, read, save, duplicate, archive. A broken file marks that one flow "corrupt" and never throws (NFR-07).
// "Archive" moves the folder to flows/.archive/, nothing is ever deleted (NFR-11).
import fs from 'node:fs';
import path from 'node:path';
import { repoContextForValidation } from './catalog.mjs';
import { checkFlowAgainstRepo, flowWarnings, parseFlow } from './contracts.mjs';
import { uniqueSlug } from './ids.mjs';
import { readJson, writeJsonAtomic } from './jsonfile.mjs';
import { resolveInside } from './paths.mjs';
import { listProjects } from './projects.mjs';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v) => (typeof v === 'string' && v ? v : null);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const ms = (iso) => Date.parse(iso) || 0;
const pad2 = (n) => String(n).padStart(2, '0');
const notFound = (id) => `Alur "${id}" tidak ditemukan.`;

// Ids from callers (a URL, a form) end up in paths: only plain names pass ('..', '/', '\' and a leading '.' do not).
export const isPlainId = (id) => typeof id === 'string' && /^[\w-]+$/.test(id);

// The flow folder, or null when id is not a plain name, the folder is not there, or a link leads out of the repo.
function flowDir(root, id) {
  if (!isPlainId(id)) return null;
  try {
    const dir = resolveInside(root, 'flows', id);
    return fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory() ? dir : null;
  } catch { return null; }
}

// Reads flows/<id>/flow.json. `flow` is the parsed flow (unknown keys dropped) when it validates, the raw object when it parses but does
// not validate (the editor can still open it), and null when the file is missing, cut off or not an object.
function inspect(root, id, ctx) {
  let r;
  try { r = readJson(resolveInside(root, 'flows', id, 'flow.json')); } catch { r = { ok: false }; } // a link out of the repo counts as corrupt
  if (!r.ok || !isObject(r.value)) {
    const why = r.ok ? 'flow.json bukan objek JSON.' : r.error === 'missing' ? 'flow.json tidak ditemukan.' : 'flow.json rusak (bukan JSON yang valid).';
    return { flow: null, errors: [why], warnings: [], corrupt: true };
  }
  const parsed = parseFlow(r.value);
  const errors = parsed.ok ? checkFlowAgainstRepo(parsed.flow, ctx) : parsed.errors;
  // The folder is the truth: saving a flow whose id differs would write to another folder.
  if (typeof r.value.id === 'string' && r.value.id !== id) errors.push(`id: ID di flow.json ("${r.value.id}") tidak sama dengan nama folder ("${id}").`);
  return { flow: parsed.ok ? parsed.flow : r.value, errors, warnings: parsed.ok ? flowWarnings(parsed.flow) : [], corrupt: false };
}

/** @returns {{ flow: object | null, errors: string[], warnings: string[], corrupt: boolean } | null} null when there is no such flow folder */
export function readFlow(root, id) {
  return flowDir(root, id) ? inspect(root, id, repoContextForValidation(root)) : null;
}

// The flow, or the reasons it cannot be used: missing, corrupt, or not valid for this repo.
export function loadUsableFlow(root, id) {
  const cur = readFlow(root, id);
  if (!cur) return { errors: [notFound(id)] };
  if (!cur.flow || cur.errors.length) return { errors: [`Alur "${id}" tidak valid.`, ...cur.errors] };
  return { flow: cur.flow };
}

// lastUsedAt is the newest `updated` of the flow's projects (project.json), not the start time of its newest run.
function usageByFlow(root) {
  const usage = new Map();
  for (const p of listProjects(root)) {
    if (!p.flow) continue;
    const u = usage.get(p.flow) ?? { count: 0, last: null };
    u.count++;
    if (!u.last || ms(p.updated) > ms(u.last)) u.last = p.updated;
    usage.set(p.flow, u);
  }
  return usage;
}

/** @returns {{ id: string, name: string, template: string | null, brand: string | null, aspectRatio: string | null, sceneCount: number, totalSeconds: number,
 *   targetSeconds: number, version: number, updatedAt: string | null, videoCount: number, lastUsedAt: string | null, errors: string[], warnings: string[], corrupt: boolean }[]} */
export function listFlows(root) {
  let ids = [];
  try {
    ids = fs.readdirSync(resolveInside(root, 'flows'), { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name).sort();
  } catch { /* no flows/ folder yet */ }
  const ctx = repoContextForValidation(root);
  const usage = usageByFlow(root);
  return ids.map((id) => {
    const r = inspect(root, id, ctx);
    const f = r.flow ?? {};
    const scenes = Array.isArray(f.scenes) ? f.scenes : [];
    return {
      id, name: text(f.name) ?? id, template: text(f.template), brand: text(f.brand), aspectRatio: text(f.output?.aspectRatio),
      sceneCount: scenes.length,
      totalSeconds: Math.round(scenes.reduce((sum, s) => sum + num(s?.durationSeconds), 0) * 100) / 100,
      targetSeconds: num(f.output?.targetDurationSeconds),
      version: Number.isInteger(f.version) ? f.version : 0, updatedAt: text(f.updatedAt),
      videoCount: usage.get(id)?.count ?? 0, lastUsedAt: usage.get(id)?.last ?? null,
      errors: r.errors, warnings: r.warnings, corrupt: r.corrupt,
    };
  });
}

/**
 * Validates (schema, then the repo) and writes flows/<id>/flow.json. The version and updatedAt are set here, not taken from `input`.
 * `expectedVersion` (update only) is the version the editor loaded; a different version on disk means someone else saved in between.
 * @returns {{ ok: true, flow: object } | { ok: false, errors: string[] }}
 */
export function saveFlow(root, input, { mode, expectedVersion } = {}, now = new Date()) {
  // Parsing first also proves the id is a plain slug before it is used in a path. The version here is a placeholder.
  const parsed = parseFlow(isObject(input) ? { ...input, version: 1, updatedAt: now.toISOString() } : input);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const id = parsed.flow.id;
  const dir = resolveInside(root, 'flows', id);
  let version = 1;
  if (mode === 'create') {
    if (fs.existsSync(dir)) return { ok: false, errors: [`ID alur "${id}" sudah dipakai.`] };
  } else {
    const cur = readJson(path.join(dir, 'flow.json'));
    if (!cur.ok && cur.error === 'missing') return { ok: false, errors: [notFound(id)] };
    // A cut-off file is not overwritten: the editor cannot have loaded it, so this save did not start from its content.
    if (!cur.ok || !isObject(cur.value)) return { ok: false, errors: [`Alur "${id}" rusak dan tidak bisa diperbarui. Perbaiki flow.json-nya atau arsipkan alurnya.`] };
    const current = Number.isInteger(cur.value.version) ? cur.value.version : 0;
    if (expectedVersion !== undefined && expectedVersion !== current) {
      return { ok: false, errors: [`Alur sudah diubah di tempat lain (sekarang versi ${current}). Muat ulang halaman.`] };
    }
    version = current + 1;
  }
  const errors = checkFlowAgainstRepo(parsed.flow, repoContextForValidation(root));
  if (errors.length) return { ok: false, errors };
  const flow = { ...parsed.flow, version }; // the parsed flow, so a mistyped field name is not written to disk
  writeJsonAtomic(path.join(dir, 'flow.json'), flow);
  return { ok: true, flow };
}

/** @returns {{ ok: true, flow: object } | { ok: false, errors: string[] }} */
export function duplicateFlow(root, id, now = new Date()) {
  const { flow, errors } = loadUsableFlow(root, id);
  if (errors) return { ok: false, errors };
  const newId = uniqueSlug(`${id}-salinan`, (s) => fs.existsSync(resolveInside(root, 'flows', s)));
  return saveFlow(root, { ...flow, id: newId, name: `${flow.name} (salinan)` }, { mode: 'create' }, now);
}

// Moves the folder, never deletes it. Throws when the flow is not there (the caller checked the list a moment ago, so this is a stale page).
// shortcut: two archives of the same id in the same second collide and the second rename fails; add a counter suffix if that ever happens.
export function archiveFlow(root, id, now = new Date()) {
  const dir = flowDir(root, id);
  if (!dir) throw Object.assign(new Error(notFound(id)), { code: 'FLOW_NOT_FOUND' });
  const local = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  const target = resolveInside(root, 'flows', '.archive', `${id}-${local}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.renameSync(dir, target);
  return { archivedTo: `flows/.archive/${id}-${local}` };
}

// Adds ref unless the flow already has one of the same kind with the same id, path or url (then nothing is written).
/** @returns {{ ok: true, flow: object } | { ok: false, errors: string[] }} */
export function addReference(root, flowId, ref, now = new Date()) {
  const { flow, errors } = loadUsableFlow(root, flowId);
  if (errors) return { ok: false, errors };
  const refs = flow.references ?? [];
  if (refs.some((r) => r.kind === ref?.kind && ['id', 'path', 'url'].some((k) => ref[k] && r[k] === ref[k]))) return { ok: true, flow };
  return saveFlow(root, { ...flow, references: [...refs, ref] }, { mode: 'update', expectedVersion: flow.version }, now);
}
