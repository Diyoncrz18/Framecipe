// Run lifecycle behind bin/run.mjs: start, stage, wait, fail, status, install, render, stills, finish.
// Text the user typed (topic, notes) is only ever written to files, never passed as a command argument (NFR-04).
// Programs run through process.execPath with an args array and no shell: npm-cli.js for npm, remotion-cli.js for render/ffmpeg.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { repoContextForValidation } from './catalog.mjs';
import { PHASE_BY_STAGE, STAGES, checkFlowAgainstRepo, parseFlow, requestSchema } from './contracts.mjs';
import { newRunId, randomHex, slugify, uniqueSlug } from './ids.mjs';
import { readJson, writeJsonAtomic } from './jsonfile.mjs';
import { isGitWorktree, resolveInside, toRepoRelative } from './paths.mjs';
import { findBrowserExe, parseRenderScript, probeVideo, remotionCliPath, sharedBrowserDir } from './remotion.mjs';
import { clearActiveRun, lastActivityAt, readActiveRun, readRun, requestPath, runPaths, writeActiveRun, writeRun } from './run-store.mjs';
import { effectiveStatus } from './runs.mjs';

const coded = (code, message) => Object.assign(new Error(message), { code });
const badArgs = (why) => coded('BAD_ARGS', `Argumen tidak lengkap: ${why}.`);
const pad2 = (n) => String(n).padStart(2, '0');
const localDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
// Ids from the command line end up in paths: only plain names pass ('..', '/', '\' do not).
const isPlainId = (id) => typeof id === 'string' && /^[\w-]+$/.test(id);

// Constant command, so the shell the Windows .cmd shim needs is safe here (the one allowed exception to no-shell).
// On Windows it is one string, not command + args: Node 24 prints DEP0190 to stderr for args with shell: true,
// and stderr must stay reserved for run.mjs error messages.
export function detectClaudeVersion() {
  const opts = { encoding: 'utf8', timeout: 5000 };
  const r = process.platform === 'win32' ? spawnSync('claude --version', { ...opts, shell: true }) : spawnSync('claude', ['--version'], opts);
  return /\d+\.\d+\.\d+/.exec(r.stdout ?? '')?.[0] ?? null;
}

export const defaultDeps = {
  now: () => new Date(),
  spawnSync,
  probe: probeVideo,
  claudeVersion: detectClaudeVersion,
  staleMs: 900000,
  rand: () => randomHex(4),
};

// The run the active marker points at, or null when there is no marker, the run file is unreadable, or the run already ended.
function activeRunOrNull(root) {
  const marker = readActiveRun(root);
  if (!marker) return null;
  const r = readRun(root, marker.project, marker.runId);
  return r.ok && ['running', 'waiting'].includes(r.value.status) ? r.value : null;
}

// project and runId come out of run.json, a file people can edit, and end up in paths (and in a recursive delete at finish):
// only plain names pass, so no '..' can aim a write or delete at another folder of the repo.
function requireActive(root) {
  const run = activeRunOrNull(root);
  if (!run) throw coded('NO_ACTIVE_RUN', 'Tidak ada run aktif. Mulai dengan: node dashboard/bin/run.mjs start ...');
  if (!isPlainId(run.project) || !isPlainId(run.runId)) {
    throw coded('RUN_CORRUPT', 'run.json milik run aktif rusak (project atau runId tidak valid). Hapus .dashboard/active-run.json, lalu mulai run baru.');
  }
  return run;
}

const closeOpenStages = (run, iso) => run.stages.forEach((s) => { s.endedAt ??= iso; });

// A missing or corrupt project.json is left alone: it is the user's file, and the run can go on without it.
function updateProject(root, project, change) {
  const file = resolveInside(root, 'projects', project, 'project.json');
  const r = readJson(file);
  if (r.ok) writeJsonAtomic(file, change(r.value));
}

const withSession = (p, now, summary) => ({ ...p, sessions: [...(Array.isArray(p.sessions) ? p.sessions : []), { date: localDate(now), summary }] });

function findRun(root, runId) {
  if (isPlainId(runId)) {
    let dirs = [];
    try { dirs = fs.readdirSync(resolveInside(root, 'projects'), { withFileTypes: true }).filter((e) => e.isDirectory()); } catch { /* no projects yet */ }
    for (const { name } of dirs) {
      const r = readRun(root, name, runId);
      if (r.ok) return { ...r.value, project: name }; // the folder is the truth, not a hand-edited "project" field
    }
  }
  throw badArgs(`run ${runId} tidak ditemukan`);
}

// Retry reads the failed run's own snapshot, a new run reads flows/<id>/flow.json. Returns the file's value (to snapshot) and the parsed flow.
function loadFlow(root, flowId, old) {
  const invalid = (errors) => coded('FLOW_INVALID', `Alur ${flowId} tidak valid:\n- ${errors.join('\n- ')}`);
  const file = old ? runPaths(root, old.project, old.runId).flowFile : isPlainId(flowId) ? resolveInside(root, 'flows', flowId, 'flow.json') : null;
  const r = file ? readJson(file) : { ok: false, error: 'missing' };
  if (!r.ok && r.error === 'missing' && !old) throw coded('FLOW_NOT_FOUND', `Alur ${flowId} tidak ditemukan di flows/.`);
  if (!r.ok) throw invalid([old ? 'snapshot flow.json milik run lama hilang atau rusak' : 'flow.json rusak (bukan JSON yang valid)']);
  const parsed = parseFlow(r.value);
  const errors = parsed.ok ? checkFlowAgainstRepo(parsed.flow, repoContextForValidation(root)) : parsed.errors;
  if (errors.length) throw invalid(errors);
  return { value: r.value, flow: parsed.flow };
}

const TEMPLATE_SKIP = new Set(['node_modules', 'out', '.remotion']);

export function startRun(root, input, deps = defaultDeps) {
  if (isGitWorktree(root)) throw coded('WORKTREE', `Jalankan dari folder repo utama, bukan git worktree (${root}).`);

  const now = deps.now();
  const nowIso = now.toISOString();

  const marker = readActiveRun(root);
  if (marker) {
    const live = activeRunOrNull(root);
    // A run waiting for the user's permission stays alive however long it takes (JMB-05), same rule as the display status.
    if (live && (now - lastActivityAt(root, live) <= deps.staleMs || effectiveStatus(root, live, now) === 'waiting-permission')) {
      // Read by the user, relayed by a second /buat-video session: it must not suggest finish or fail, the run belongs to the other session.
      throw coded('ACTIVE_RUN', `Masih ada run aktif (${live.project}/${live.runId}). Tunggu sampai selesai, tandai gagal dari halaman Eksekusi di dashboard, atau tunggu 15 menit tanpa aktivitas.`);
    }
    if (live) {
      closeOpenStages(live, nowIso); // a terminal run has no open stage, same as failRun
      writeRun(root, { ...live, status: 'abandoned', waitReason: null, endedAt: nowIso, error: { stage: live.stage, message: 'Tidak ada aktivitas lebih dari 15 menit.' } });
    }
    clearActiveRun(root); // also drops a marker whose run is gone or already finished
  }

  const { trigger = 'chat' } = input;
  if (!['chat', 'dashboard'].includes(trigger)) throw badArgs('--trigger harus chat atau dashboard');
  if ([input.request, input.retry, input.flow ?? input.topic].filter((v) => v !== undefined).length !== 1) {
    throw badArgs('pilih salah satu: --request, --flow dengan --topic, atau --retry');
  }
  let flowId, topic, notes, requestId = null, requestValue = null, old = null;
  if (input.retry !== undefined) {
    old = findRun(root, input.retry);
    if (!['failed', 'cancelled', 'abandoned'].includes(old.status)) {
      throw coded('RETRY_NOT_ALLOWED', 'Hanya run yang gagal, dibatalkan, atau terhenti yang bisa diperbaiki.');
    }
    ({ flow: flowId, topic } = old);
    notes = old.notes ?? '';
    requestId = old.request ?? null;
  } else if (input.request !== undefined) {
    const id = input.request;
    const r = isPlainId(id) ? readJson(requestPath(root, id)) : { ok: false };
    const parsed = r.ok ? requestSchema.safeParse(r.value) : null;
    if (!parsed?.success) throw coded('REQUEST_NOT_FOUND', `Permintaan ${id} tidak ditemukan.`);
    if (parsed.data.status === 'diambil') throw coded('REQUEST_TAKEN', `Permintaan ${id} sudah diambil oleh run ${parsed.data.runId}.`);
    ({ flow: flowId, topic, notes } = parsed.data);
    requestId = id;
    requestValue = r.value;
  } else {
    ({ flow: flowId, topic } = input);
    notes = input.notes ?? '';
    if (!flowId || !topic?.trim()) throw badArgs('--flow dan --topic harus diisi bersama');
  }

  const { value: flowValue, flow } = loadFlow(root, flowId, old);

  const project = old?.project ?? uniqueSlug(slugify(topic), (s) => fs.existsSync(resolveInside(root, 'projects', s)));
  const projectDir = resolveInside(root, 'projects', project);
  const runId = newRunId(now, deps.rand());
  const paths = runPaths(root, project, runId);

  if (old) {
    updateProject(root, project, (p) => withSession({ ...p, latestRun: runId, updated: nowIso }, now, `Perbaikan run ${old.runId} menjadi ${runId}`));
  } else {
    const template = resolveInside(root, 'templates', flow.template);
    fs.cpSync(template, projectDir, { recursive: true, filter: (src) => !TEMPLATE_SKIP.has(path.relative(template, src)) });
    writeJsonAtomic(path.join(projectDir, 'project.json'), {
      name: project, template: flow.template, brand: flow.brand, created: nowIso, updated: nowIso, phase: 'planning', scenes: [],
      audio: { voiceover: { file: 'audio/voiceover.mp3', status: flow.audio.voiceover.enabled ? 'needed' : 'optional' } },
      estimates: { totalDurationSeconds: Math.round(flow.scenes.reduce((sum, s) => sum + s.durationSeconds, 0) * 100) / 100 },
      sessions: [{ date: localDate(now), summary: `Dibuat oleh /buat-video (alur ${flowId} v${flow.version})` }],
      flow: flowId, topic, latestRun: runId,
    });
  }

  writeJsonAtomic(paths.flowFile, flowValue);
  writeRun(root, {
    runId, project, flow: flowId, flowVersion: flow.version, request: requestId, topic, notes, trigger, retryOf: old?.runId ?? null,
    sessionId: null, claudeCodeVersion: deps.claudeVersion(), status: 'running', stage: 'setup', waitReason: null,
    stages: [{ name: 'setup', startedAt: nowIso, endedAt: null }], startedAt: nowIso, endedAt: null, output: null, warnings: [], error: null,
  });
  if (requestValue) writeJsonAtomic(requestPath(root, requestId), { ...requestValue, status: 'diambil', runId });
  writeActiveRun(root, { runId, project, sessionId: null, startedAt: nowIso });

  const rel = (p) => toRepoRelative(root, p);
  return { project, runId, projectDir: rel(projectDir), runFile: rel(paths.runFile), flowFile: rel(paths.flowFile) };
}

export function stageRun(root, stage, deps = defaultDeps) {
  if (!stage) throw badArgs('nama tahap wajib diisi');
  if (!STAGES.includes(stage)) throw coded('BAD_STAGE', `Tahap "${stage}" tidak dikenal. Pilihan: ${STAGES.join(', ')}.`);
  const run = requireActive(root);
  const iso = deps.now().toISOString();
  closeOpenStages(run, iso);
  writeRun(root, { ...run, stage, status: 'running', waitReason: null, stages: [...run.stages, { name: stage, startedAt: iso, endedAt: null }] });
  const phase = PHASE_BY_STAGE[stage];
  updateProject(root, run.project, (p) => ({ ...p, phase, updated: iso }));
  return { stage, phase };
}

export function waitRun(root, reason) {
  if (!reason?.trim()) throw badArgs('--reason wajib diisi');
  writeRun(root, { ...requireActive(root), status: 'waiting', waitReason: reason });
  return { status: 'waiting' };
}

// Ends the active run as failed. Leaves the project's files alone, node_modules included: a retry continues from them.
function failActive(root, run, message, deps, stage = run.stage) {
  const iso = deps.now().toISOString();
  closeOpenStages(run, iso);
  writeRun(root, { ...run, status: 'failed', waitReason: null, error: { stage, message }, endedAt: iso });
  clearActiveRun(root);
}

export function failRun(root, reason, deps = defaultDeps) {
  if (!reason?.trim()) throw badArgs('--reason wajib diisi');
  failActive(root, requireActive(root), reason, deps);
  return { status: 'failed' };
}

export function statusRun(root) {
  const run = activeRunOrNull(root);
  return { active: run && { runId: run.runId, project: run.project, stage: run.stage, status: run.status } };
}

export const npmCliPath = () => path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');

const exitCode = (r) => r.status ?? r.error?.message ?? 'tidak diketahui';
const fileStat = (file) => fs.statSync(file, { throwIfNoEntry: false });
const comma = (n) => String(n).replace('.', ',');

// The active run and its project folder: where install, render, stills and finish work.
function activeProject(root) {
  const run = requireActive(root);
  return { run, proj: resolveInside(root, 'projects', run.project) };
}

// Child output goes straight to the terminal (stdio: 'inherit'), so a failure message points at it.
export function installDeps(root, deps = defaultDeps) {
  const { proj } = activeProject(root);
  const r = deps.spawnSync(process.execPath, [npmCliPath(), 'install', '--no-audit', '--no-fund', '--prefer-offline'], { cwd: proj, stdio: 'inherit' });
  if (r.status !== 0) throw coded('INSTALL_FAILED', `npm install gagal (kode ${exitCode(r)}).`);
  return { ok: true };
}

// Renders to out/<runId>.mp4, not the script's own output name: finish must never pick up an older video.
// The run's status stays as it is on failure; the caller decides between retrying and fail.
export function renderVideo(root, deps = defaultDeps) {
  const { run, proj } = activeProject(root);
  const pkg = readJson(path.join(proj, 'package.json'));
  const { entry, compositionId, extraArgs } = parseRenderScript(pkg.ok ? pkg.value?.scripts?.render : undefined);
  const cli = remotionCliPath(proj);
  const shared = findBrowserExe(sharedBrowserDir(root));
  const out = `out/${run.runId}.mp4`;
  fs.rmSync(path.join(proj, out), { force: true }); // an older video of this run must not survive a failed re-render and pass finish
  const args = [cli, 'render', ...(entry ? [entry] : []), compositionId, out, ...extraArgs, ...(shared ? [`--browser-executable=${shared}`] : [])];
  const r = deps.spawnSync(process.execPath, args, { cwd: proj, stdio: 'inherit' });
  if (r.status !== 0) throw coded('RENDER_FAILED', `Render gagal (kode ${exitCode(r)}). Lihat output di atas.`);

  // The first render downloads Chrome into the project, and finish deletes node_modules: keep one copy for every project.
  const downloaded = path.join(proj, 'node_modules', '.remotion', 'chrome-headless-shell');
  if (!shared && fs.existsSync(downloaded)) {
    const dest = resolveInside(root, '.dashboard', 'browser', 'chrome-headless-shell');
    // shortcut: a failed copy is not reported (the video is rendered); the half copy goes, and the next render copies again.
    try { fs.cpSync(downloaded, dest, { recursive: true }); } catch { fs.rmSync(dest, { recursive: true, force: true }); }
  }
  return { output: toRepoRelative(root, path.join(proj, out)) };
}

// One frame from the middle of each of `count` equal segments, for Claude to look at (and for the gallery thumbnail).
// shortcut: frames of an earlier call with a larger count stay behind; same-count calls overwrite them.
export function extractStills(root, count, deps = defaultDeps) {
  if (!Number.isInteger(count) || count < 1) throw badArgs('--count harus bilangan bulat positif');
  const { run, proj } = activeProject(root);
  const cli = remotionCliPath(proj);
  const video = resolveInside(root, 'projects', run.project, 'out', `${run.runId}.mp4`);
  if (!fileStat(video)?.isFile()) throw coded('VIDEO_MISSING', `File video out/${run.runId}.mp4 tidak ada. Jalankan render dulu.`);
  let duration;
  try { duration = deps.probe(proj, video).durationSeconds; } catch (e) { throw coded('PROBE_FAILED', `Video tidak bisa dibaca: ${e.message}`); }
  if (!(duration > 0)) throw coded('PROBE_FAILED', 'Durasi video 0 detik.');

  const { framesDir } = runPaths(root, run.project, run.runId);
  fs.mkdirSync(framesDir, { recursive: true });
  const frames = [];
  for (let i = 0; i < count; i++) {
    const frame = path.join(framesDir, `frame-${i + 1}.jpg`);
    const t = (((i + 0.5) * duration) / count).toFixed(2);
    const r = deps.spawnSync(process.execPath, [cli, 'ffmpeg', '-y', '-loglevel', 'error', '-ss', t, '-i', video, '-frames:v', '1', frame],
      { cwd: proj, encoding: 'utf8', timeout: 120000 });
    if (r.status !== 0) throw coded('STILLS_FAILED', `ffmpeg gagal mengambil frame ${i + 1} (kode ${exitCode(r)}).${r.stderr ? ` ${r.stderr.trim()}` : ''}`);
    frames.push(toRepoRelative(root, frame));
  }
  return { frames };
}

// Validates only out/<runId>.mp4 (never an older file in out/). A bad video fails the run the way failRun does, node_modules kept.
// A good one closes the run, then deletes node_modules (688 MB per project): a retry installs them again.
export function finishRun(root, deps = defaultDeps) {
  const { run, proj } = activeProject(root);
  const file = `out/${run.runId}.mp4`;
  const abs = resolveInside(root, 'projects', run.project, 'out', `${run.runId}.mp4`);
  const fail = (message, stage) => {
    failActive(root, run, message, deps, stage);
    return { status: 'failed', output: null, warnings: [], error: message };
  };

  const stat = fileStat(abs);
  if (!stat?.isFile()) return fail(`File video ${file} tidak ada.`);
  if (stat.size === 0) return fail('File video kosong (0 byte).');
  let probed;
  try { probed = deps.probe(proj, abs); } catch (e) { return fail(`Video tidak bisa dibaca: ${e.message}`); }
  const { durationSeconds, width, height, fps, sizeBytes } = probed;
  if (!(durationSeconds > 0)) return fail('Durasi video 0 detik.');
  // ffprobe output is not trusted: a missing or zero size would write a success run.json that runSchema rejects ("Data rusak").
  const badFields = Object.entries({ width, height, fps }).filter(([, v]) => !(Number.isFinite(v) && v > 0)).map(([k]) => k);
  if (badFields.length) return fail(`Hasil pembacaan video tidak valid: ${badFields.join(', ')} harus berupa angka positif.`, 'render');

  const d = comma(durationSeconds.toFixed(1));
  const warnings = [];
  const snapshot = readJson(runPaths(root, run.project, run.runId).flowFile);
  const parsed = snapshot.ok ? parseFlow(snapshot.value) : null;
  if (!parsed?.ok) {
    warnings.push('Alur run tidak terbaca: durasi dan resolusi tidak dicek.');
  } else {
    const want = parsed.flow.output;
    if (Math.abs(durationSeconds - want.targetDurationSeconds) / want.targetDurationSeconds > 0.1) {
      warnings.push(`Durasi ${d} dtk, target ${comma(want.targetDurationSeconds)} dtk.`);
    }
    if (width !== want.width || height !== want.height) warnings.push(`Resolusi ${width}×${height}, alur meminta ${want.width}×${want.height}.`);
  }

  const now = deps.now();
  const iso = now.toISOString();
  closeOpenStages(run, iso);
  const output = { file, durationSeconds, width, height, fps, sizeBytes };
  const done = { ...run, status: 'success', stage: 'done', waitReason: null, endedAt: iso, output, warnings,
    stages: run.stage === 'done' ? run.stages : [...run.stages, { name: 'done', startedAt: iso, endedAt: iso }] }; // `stage done` already added one
  writeRun(root, done);
  updateProject(root, run.project, (p) => withSession({ ...p, phase: PHASE_BY_STAGE.done, latestRun: run.runId, updated: iso }, now, `Run ${run.runId} sukses (${d} dtk).`));
  clearActiveRun(root);

  try {
    fs.rmSync(path.join(proj, 'node_modules'), { recursive: true, force: true });
  } catch (e) {
    warnings.push(`node_modules tidak bisa dihapus: ${e.message}`);
    writeRun(root, { ...done, warnings });
  }
  return { status: 'success', output, warnings, error: null };
}
