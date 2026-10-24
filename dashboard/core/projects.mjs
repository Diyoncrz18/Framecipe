// Reads projects/ for the gallery and the project page. Paths it returns are repo-relative with '/' (they feed mediaUrl).
// A broken file marks that one item "corrupt" and never throws, so the other items still show (NFR-07).
import fs from 'node:fs';
import path from 'node:path';
import { runSchema } from './contracts.mjs';
import { readJson } from './jsonfile.mjs';
import { resolveInside } from './paths.mjs';
import { readRun } from './run-store.mjs';

/** @typedef {{ file: string, runId: string | null, durationSeconds: number | null, width: number | null, height: number | null, fps: number | null, sizeBytes: number | null }} VideoInfo */
/** @typedef {{ slug: string, title: string, flow: string | null, template: string | null, brand: string | null, phase: string | null, updated: string,
 *   latestRunId: string | null, latestStatus: string | null, video: VideoInfo | null, thumbnail: string | null, hasDeps: boolean, corrupt: boolean }} ProjectSummary */

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v) => (typeof v === 'string' && v ? v : null);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const stat = (file) => { try { return fs.statSync(file); } catch { return undefined; } }; // any failure (missing, ENOTDIR, no permission) means "not there"
const ms = (iso) => Date.parse(iso) || 0;

function subdirs(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { return []; }
}

// A file read through resolveInside, so a link that leaves the repo is unreadable instead of followed.
function safeJson(root, ...segments) {
  try { return readJson(resolveInside(root, ...segments)); } catch { return { ok: false, error: 'corrupt' }; }
}

// The project folder, or null when slug is not a plain folder name (it can come from a URL) or the folder is not there.
function projectDir(root, slug) {
  if (typeof slug !== 'string' || !slug || slug.startsWith('.') || /[\\/\0]/.test(slug)) return null;
  try {
    const dir = resolveInside(root, 'projects', slug);
    return stat(dir)?.isDirectory() ? dir : null;
  } catch { return null; }
}

/** @returns {{ runId: string, run: object | null, corrupt: boolean }[]} newest first */
export function listProjectRuns(root, slug) {
  if (!projectDir(root, slug)) return [];
  return subdirs(path.join(root, 'projects', slug, 'runs')).sort().reverse().map((runId) => {
    let parsed = null;
    try { const r = readRun(root, slug, runId); parsed = r.ok ? runSchema.safeParse(r.value) : null; } catch { /* a link out of the repo: counts as corrupt */ }
    return parsed?.success ? { runId, run: parsed.data, corrupt: false } : { runId, run: null, corrupt: true };
  });
}

const videoInfo = (slug, name, runId, o) => ({
  file: `projects/${slug}/out/${name}`, runId,
  durationSeconds: o?.durationSeconds ?? null, width: o?.width ?? null, height: o?.height ?? null, fps: o?.fps ?? null, sizeBytes: o?.sizeBytes ?? null,
});

// The video of a successful run, if its file is still there (out/<runId>.mp4: the path is built from the run folder's name, not from run.json).
function runVideo(dir, slug, { runId, run }) {
  return run?.status === 'success' && stat(path.join(dir, 'out', `${runId}.mp4`))?.isFile() ? videoInfo(slug, `${runId}.mp4`, runId, run.output) : null;
}

// For projects made outside the dashboard: the newest out/*.mp4, nothing else is known about it.
// `skip` holds the file names of this project's own runs: a run that is not a success (finish refused its video) must not pass as the video.
function newestMp4(dir, slug, skip) {
  let best = null;
  try {
    for (const e of fs.readdirSync(path.join(dir, 'out'), { withFileTypes: true })) {
      if (!e.isFile() || !/\.mp4$/i.test(e.name) || skip.has(e.name)) continue;
      const mtime = fs.statSync(path.join(dir, 'out', e.name)).mtimeMs;
      if (!best || mtime > best.mtime) best = { name: e.name, mtime };
    }
  } catch { /* no out/ folder */ }
  return best && videoInfo(slug, best.name, null, null);
}

function load(root, slug) {
  const dir = projectDir(root, slug);
  if (!dir) return null;
  const pj = safeJson(root, 'projects', slug, 'project.json');
  const project = pj.ok && isObject(pj.value) ? pj.value : null; // a missing project.json is flagged too: the folder is there but unusable
  const runs = listProjectRuns(root, slug);
  const fromRuns = runs.map((r) => runVideo(dir, slug, r)).filter(Boolean);
  const fallback = fromRuns.length ? null : newestMp4(dir, slug, new Set(runs.map((r) => `${r.runId}.mp4`)));
  const versions = fallback ? [fallback] : fromRuns;
  const video = versions[0] ?? null;
  const latest = runs[0];
  /** @type {ProjectSummary} */
  const summary = {
    slug,
    title: text(project?.topic) ?? text(project?.name) ?? slug,
    flow: text(project?.flow), template: text(project?.template), brand: text(project?.brand), phase: text(project?.phase),
    updated: text(project?.updated) ?? stat(dir).mtime.toISOString(),
    latestRunId: latest?.runId ?? null, latestStatus: latest?.run?.status ?? null,
    video,
    // The frame belongs to the run the video came from: the first still of a failed run would not match what plays.
    thumbnail: video?.runId && stat(path.join(dir, 'runs', video.runId, 'frames', 'frame-1.jpg'))?.isFile()
      ? `projects/${slug}/runs/${video.runId}/frames/frame-1.jpg` : null,
    hasDeps: stat(path.join(dir, 'node_modules'))?.isDirectory() ?? false,
    corrupt: project === null,
  };
  return { summary, project, runs, versions };
}

/** @returns {ProjectSummary[]} newest `updated` first; folders starting with "." are not projects */
export function listProjects(root) {
  return subdirs(path.join(root, 'projects')).filter((name) => !name.startsWith('.'))
    .map((slug) => load(root, slug)?.summary).filter(Boolean)
    .sort((a, b) => ms(b.updated) - ms(a.updated));
}

// project.json scenes win once Claude has filled them in; before that, the scenes of the latest run's flow snapshot.
export function readProjectDetail(root, slug) {
  const loaded = load(root, slug);
  if (!loaded) return null;
  const { summary, project, runs, versions } = loaded;

  const snap = runs[0] ? safeJson(root, 'projects', slug, 'runs', runs[0].runId, 'flow.json') : null;
  const flowSnapshot = snap?.ok && isObject(snap.value) ? snap.value : null;
  const sceneList = (v) => (Array.isArray(v) ? v.filter((s) => isObject(s) && text(s.id)) : []);
  const own = sceneList(project?.scenes);
  const snapshotScenes = sceneList(flowSnapshot?.scenes);
  const labels = new Map(snapshotScenes.map((s) => [s.id, text(s.label)]));
  const scenes = own.length
    ? own.map((s) => ({ id: s.id, label: text(s.label) ?? labels.get(s.id) ?? s.id, durationSeconds: num(s.durationSeconds), narration: text(s.narration) }))
    : snapshotScenes.map((s) => ({ id: s.id, label: text(s.label) ?? s.id, durationSeconds: num(s.durationSeconds), narration: null })); // the flow only says whether a scene has narration, not its text

  let script = null;
  try { script = fs.readFileSync(resolveInside(root, 'projects', slug, 'VOICEOVER-SCRIPT.md'), 'utf8'); } catch { /* no script yet */ }

  return {
    ...summary,
    script, scenes, flowSnapshot, versions,
    runs: runs.map(({ runId, run }) => ({ runId, status: run?.status ?? null, startedAt: run?.startedAt ?? null, endedAt: run?.endedAt ?? null, retryOf: run?.retryOf ?? null })),
    sessions: (Array.isArray(project?.sessions) ? project.sessions : []).filter(isObject).map((s) => ({ date: text(s.date) ?? '', summary: text(s.summary) ?? '' })),
  };
}
