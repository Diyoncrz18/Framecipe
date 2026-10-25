# AGENTS.md — Framecipe

This file is the single source of project context for any AI agent: Claude Code, Codex, Cursor or others. Read it fully before you change anything. Claude Code also loads `CLAUDE.md`, which imports this file and adds Claude-specific notes plus the toolkit reference (templates, Python tools, timing rules).

## 1. What Framecipe is

Framecipe is a local **AI video editing and motion-graphics studio driven by reusable recipes**. The owner (a solo Indonesian content creator, GitHub `Diyoncrz18`) defines a recipe once in a local dashboard, then asks Claude Code for a video on any topic. Claude writes the script, composes Remotion scenes, adds narration and music, renders the MP4 locally, reviews frames, and files the result in the gallery. The dashboard shows every stage live.

It is built on a Remotion/Python video toolkit (templates, components, transitions, brands, Claude skills, AI tools) plus a Next.js dashboard in `dashboard/`.

### End-to-end flow

```
Recipe (flows/<id>/flow.json)
  → Request (dashboard "Buat prompt" → .dashboard/requests/<id>.json)
  → User pastes "/buat-video req=<id>" into Claude Code (opened at the repo root)
  → Claude follows .claude/commands/buat-video.md and drives every stage via
      node dashboard/bin/run.mjs <subcommand>   (prints JSON)
  → Claude Code hooks (dashboard/bin/hook.mjs) append events to .dashboard/events/<session>.jsonl
  → Project + run state in projects/<slug>/ and projects/<slug>/runs/<runId>/run.json
  → Dashboard (Eksekusi page) shows progress; finished MP4 lands in projects/<slug>/out/<runId>.mp4 and the gallery
```

The dashboard never starts Claude by itself (a one-click "Generate" button is a planned P1 feature). Only one run can be active at a time.

## 2. Repository map

```
.
├── AGENTS.md / CLAUDE.md      # Agent context (this file / Claude-specific + toolkit reference)
├── README.md                  # Public overview (English)
├── dashboard/                 # Framecipe dashboard: Next.js 16 App Router
│   ├── app/                   # Pages (Indonesian UI), server actions, /api/media route, error boundaries
│   ├── components/            # UI components; components/ui = shadcn (base-nova, Base UI)
│   ├── core/                  # Domain logic as plain ESM .mjs + Vitest tests beside each module
│   ├── bin/run.mjs            # Run helper Claude calls at every stage
│   ├── bin/hook.mjs           # Claude Code hook: records events (Node built-ins only)
│   ├── lib/                   # Small TS helpers for the UI (nav, theme, format, media URLs, ...)
│   ├── content/cara-kerja.md  # "How it works" page content (Indonesian)
│   ├── proxy.ts               # Next 16 proxy (was middleware): Host allowlist
│   └── AGENTS.md              # Next.js agent note (auto-maintained by `next dev`; keep it)
├── flows/<id>/flow.json       # Recipes. flows/.archive/ = archived (git-ignored debris, do not commit)
├── projects/<slug>/           # Video projects (git-ignored): template copy, runs/<runId>/, out/<runId>.mp4
├── .dashboard/                # Runtime data (git-ignored): requests, events, active-run.json, shared Chrome
├── .claude/
│   ├── commands/buat-video.md # The production command (Indonesian)
│   ├── commands/*.md          # Toolkit commands (/video, /brand, /template, ...)
│   ├── skills/                # Claude skills (remotion-official folder = skill name remotion-best-practices)
│   └── settings.json          # Project hooks + narrow permission allowlist
├── templates/                 # Remotion templates (sprint-review is the default for recipes)
├── brands/default/            # The only brand profile
├── examples/                  # Reference projects (hello-world, quick-spot, data-viz-chart, sky-blue-short)
├── lib/                       # Shared Remotion components, transitions, theme, project types
├── tools/                     # Python AI tools (run with `uv run tools/<tool>.py`)
├── _internal/                 # toolkit-registry.json (catalog), roadmap, changelog
├── docs/                      # Guides; docs/superpowers/ = PRD, MVP plan, design rulings; docs/images/ = README shots
├── pyproject.toml / uv.lock   # Python deps (managed by uv). Project name: framecipe
└── .env                       # API keys (git-ignored). Never print or commit values.
```

### dashboard/core modules

| Module | Responsibility |
|---|---|
| `contracts.mjs` | zod schemas (flow, request, run, event) and STAGES. The only core module that imports zod. |
| `flows.mjs` | flows/<id>/flow.json: list, read, save, duplicate, archive (archive = move). Corrupt file → item marked corrupt, never throws. |
| `flow-form.mjs` | Pure editor helpers (no imports, browser-safe): defaults, coerceDraft, durations, VOICE_PROVIDER_KEYS. |
| `requests.mjs` | Video requests (.dashboard/requests/<id>.json) behind `/buat-video req=<id>`. |
| `run-ops.mjs` | Run lifecycle behind run.mjs: start, stage, wait, fail, status, audio, install, render, stills, finish. |
| `run-store.mjs` | Paths and reads of run state; Node built-ins only (used by the hook). |
| `runs.mjs` | Effective display status, timeline, summary, skill usage, markRunFailed. |
| `hook-events.mjs` | Claude Code hook payload → event line; binds a session to a run only on a successful `node … run.mjs start`. |
| `projects.mjs` | projects/ for gallery and project pages. |
| `catalog.mjs` | toolkit-registry.json merged with what is really on disk (skills, templates, brands, examples, tools); readiness per item; global skills from `~/.claude` (user skills and enabled plugins). |
| `health.mjs` | Tool versions, hooks/command installed, API keys filled or empty (never values). |
| `remotion.mjs` | Remotion CLI paths, render-script parsing, ffprobe through Remotion, shared Chrome. |
| `http-range.mjs` | What /api/media serves: allowed roots, MIME, Range, download header. |
| `host-guard.mjs` | Host allowlist used by proxy.ts. |
| `paths.mjs` | `resolveInside()` path guard, repo root detection, worktree detection. Node built-ins only. |
| `jsonfile.mjs` | readJson (BOM-safe), writeJsonAtomic (rename retry on Windows), JSON lines. Node built-ins only. |
| `ids.mjs`, `slug.mjs`, `labels.mjs` | Ids/run ids, slugify (browser-safe), Indonesian labels. |
| `test-utils.mjs`, `test-setup.mjs` | Temp repos with spaces in paths, fixtures, fixed clocks, fake deps, cleanup. |

### Dashboard pages (UI is Indonesian)

Beranda `/` (request form, active run, health, latest videos) · Alur `/alur` (recipes, editor `/alur/[id]`, `/alur/baru`) · Video `/video` (gallery, `/video/[slug]`) · Eksekusi `/eksekusi` (runs, live detail `/eksekusi/[slug]/[runId]`) · Referensi Desain `/referensi` · Skill & Tools `/skill` · Cara Kerja `/cara-kerja` · Pengaturan `/pengaturan`. Shell: grouped sidebar, header breadcrumb, Ctrl+K page palette, light/dark/system theme toggle.

## 3. Tech stack

- **Next.js 16.4.3** App Router, Turbopack, React 19.3, TypeScript. This Next has breaking changes vs. older versions: read `dashboard/node_modules/next/dist/docs/` before Next-specific code. `params`/`searchParams` are Promises. Middleware is `proxy.ts`. Every page is `export const dynamic = "force-dynamic"` (root layout).
- **Tailwind CSS 4**, **shadcn/ui base-nova** on **Base UI** (`render` prop, not Radix `asChild`), `cn` from the `cn` package (merges Tailwind classes), lucide-react 1.61 icons.
- **zod 4**, **react-markdown + remark-gfm** (no rehype-raw), **Vitest 5**.
- Templates: **Remotion 4.0.x**. Python 3.10+ via **uv**; voiceover uses `edge-tts` (free) or paid providers.
- Runs on **Windows 11** (paths with spaces, e.g. `C:\MY FOLDER\...`), Node 24, Chrome/Edge.

## 4. Commands

```bash
# Dashboard (from dashboard/)
npm install
npm run dev            # http://127.0.0.1:3210 (dev)
npm run build && npm start   # production, same address
npm test               # Vitest (core/**/*.test.mjs)
npm run lint           # ESLint
npx tsc --noEmit -p .  # Type check

# Python tools (from repo root)
uv sync
uv run tools/voiceover.py --provider edge --scene-dir <dir> --json
uv run python -m py_compile tools/<file>.py
```

### Run helper (`node dashboard/bin/run.mjs <cmd>`, always from the repo root, never in a git worktree)

| Command | Purpose |
|---|---|
| `start --request <id>` / `--flow <id> --topic "<t>"` / `--retry <runId>` | Create project from template, snapshot the recipe, mark run active |
| `stage <name>` | Enter a stage: setup, script, assets, audio, compose, qc, render, review, done |
| `wait --reason "<r>"` | Pause for the user (script review) |
| `audio` | Voiceover from `projects/<p>/public/audio/scenes/<NN>-<scene>.txt` via `tools/voiceover.py` with the recipe's provider, plus `background-music.mp3` from the free library track |
| `install` | npm install in the project |
| `render` | Remotion render to `out/<runId>.mp4` (stale copy deleted first) |
| `stills --count N` | Review frames (also gallery thumbnails) |
| `finish` | Validate MP4 (exists, duration > 0, valid size/fps) and close as success; prunes node_modules |
| `fail --reason "<r>"` | Close as failed |
| `status` | Show the active run |

Each prints JSON on stdout; failures print `{"error":"<CODE>"}` and an Indonesian message on stderr, exit 1.

## 5. Data contracts

- **flow.json** (recipe): `id, name, description, version, updatedAt, template, brand, output{aspectRatio,width,height,fps,targetDurationSeconds}, language, style{tone,audience,rules[]}, scenes[{id,label,goal,durationSeconds,rules[],narration,visualHint?,transitionOut?}], audio{voiceover{enabled,provider: edge|elevenlabs|qwen3|60db, voice?}, music{enabled,preset?,prompt?}, captions{enabled}}, references[{kind,id|path|url}], skills[] (Skill-tool names, e.g. remotion-best-practices), approval: auto|script-review, notes`. `flows/contoh-penjelasan/flow.json` must equal `dashboard/core/fixtures/flow.valid.json`.
- **run.json**: `runId, project, flow, flowVersion, request, topic, notes, trigger, retryOf, sessionId, claudeCodeVersion, status (running|waiting|success|failed|abandoned|cancelled), stage, waitReason, stages[{name,startedAt,endedAt}], startedAt, endedAt, output, warnings[], error: {stage, message} | null`.
- **Display status** (derived in runs.mjs): running, waiting, waiting-permission, stopped, success, failed, cancelled, abandoned. No activity > 15 min → abandoned, except when the last event is a permission prompt (JMB-05). `idle_prompt` notifications never count as status.
- **Events**: `.dashboard/events/<sessionId>.jsonl` lines validated by `eventSchema`; invalid lines are skipped.
- **Active run**: `.dashboard/active-run.json`. Output: `projects/<slug>/out/<runId>.mp4`.

## 6. Hard rules (do not break)

1. Dashboard listens only on `127.0.0.1:3210`; `proxy.ts` rejects any other Host (DNS-rebinding guard).
2. Every file access from UI and core goes through `resolveInside()` (rejects `..`, absolute paths, symlinks/junctions leaving the repo). The media route also checks the real path. One exception: `readGlobalSkills()` (Skill & Tools page) reads, read-only, the SKILL.md frontmatter and plugin lists in Claude Code's folder (`~/.claude` or `CLAUDE_CONFIG_DIR`), still through `resolveInside()` with that folder as the root; a user skill linked in from elsewhere (`~/.claude/skills/x` → `~/.agents/skills/x`) has only its own `SKILL.md` read, with the link target as the root. Recipes can only list project skills.
3. `.env` values never reach the browser; only filled/empty status.
4. Child processes: argument arrays, no shell. Only exception: constant `--version` checks on Windows. **Text the user typed (topic, notes, prompts) never becomes a command argument**; write it to files instead.
5. Markdown via react-markdown without rehype-raw.
6. Corrupt or missing JSON renders as a "Data rusak" item, never an error page.
7. UI text in **Bahasa Indonesia**; code, identifiers, file names, comments in **English**.
8. Accessibility: keyboard-operable, labelled inputs, AA contrast (muted text token is `oklch(0.51 0 0)` for this reason), status = text or icon, not color alone. Every animation has a reduced-motion path.
9. Never permanently delete user data. "Arsip" = move the folder. Only rebuildable files are auto-deleted (project node_modules after success, a run's own stale MP4 before re-render).
10. Existing toolkit commands and behavior stay unchanged unless the task is about them.
11. One active run at a time; stale after 15 min (permission-prompt exception).
12. Live pages refresh at least every 2 s (AutoRefresh on Beranda and Eksekusi).
13. In `dashboard/core/`, only `contracts.mjs` and modules importing it may use zod. `hook.mjs` and its imports (paths, jsonfile, run-store, hook-events) use Node built-ins only and must stay fast.
14. New dependencies need a real reason; prefer what is installed.
15. `run.mjs` refuses to run inside a git worktree; work in the main checkout.
16. Both themes must work: every hard-coded color needs a `dark:` pair (e.g. `bg-black/5 dark:bg-white/10`, `bg-amber-50 dark:bg-amber-950/40`). Prefer theme tokens (`bg-card`, `text-muted-foreground`, `border-border`).

## 7. Coding conventions

- Domain logic belongs in `dashboard/core/*.mjs` with a `*.test.mjs` beside it. Side effects (spawn, probe, clock, random) come in through a `deps` object (`defaultDeps`) so tests inject fakes (`testDeps`, custom `spawnSync`).
- Errors: `coded(CODE, "Indonesian message")`. Server actions validate types at the boundary and return `{ ok: false, errors }` instead of throwing for user mistakes.
- JSON writes: `writeJsonAtomic`. Reads: `readJson` (BOM-safe) → `{ ok, value }`.
- Dynamic `fs` paths in code bundled by Next get `/*turbopackIgnore: true*/` to keep the build warning-free.
- Comments explain *why*, one line, in English. Match the density of surrounding code.
- Client components: no zod, no `node:` imports; use browser-safe modules (`flow-form.mjs`, `slug.mjs`, `labels.mjs`). A `"use client"` module cannot export plain values to server components (they become client references) — put shared constants in `lib/` (see `lib/theme.ts`).
- Windows checkouts use **CRLF**. Scripts that edit files must tolerate `\r\n` (normalize, edit, write back with the original line ending).

## 8. Testing and verification

Before saying a change is done:

1. `npm test` (all pass), `npm run lint`, `npx tsc --noEmit -p .`, and `npm run build` with **zero warnings** (from `dashboard/`).
2. UI changes: check in a browser at desktop and mobile width, in **light and dark** themes, and read the console for errors.
3. Python changes: `uv run python -m py_compile` and a real run of the tool when possible.
4. Pipeline changes: an end-to-end run, from the repo root in Git Bash:
   `MSYS_NO_PATHCONV=1 env -u CLAUDECODE claude -p '/buat-video <flow-id> "<topik>"'`
   (MSYS_NO_PATHCONV stops Git Bash from rewriting `/buat-video` into a path; the workspace must be trusted for hooks and the allowlist to apply). Confirm with `node dashboard/bin/run.mjs status` that no other run is active first.

Report results honestly: say what was verified and what was not.

## 9. Git and GitHub

- Remote: `https://github.com/Diyoncrz18/Framecipe` (public), default branch `main`.
- Conventional commits: `feat(dashboard): …`, `fix(dashboard): …`, `docs: …`, `chore: …`. Imperative subject, body explains why.
- **Never add `Co-Authored-By` or any AI attribution lines** to commits or PR descriptions. The owner does not want an AI listed as contributor.
- Never commit `.env`, `.dashboard/`, `projects/`, `flows/.archive/`, or generated junk. Check `git status` before committing.
- Ask before destructive actions: force-push, history rewrite, deleting branches or user files.
- Only commit or push when asked.

## 10. Audio

- Voice providers (`flow.audio.voiceover.provider`): **edge** (default, free, no key, Indonesian voices `id-ID-GadisNeural` / `id-ID-ArdiNeural`, online Microsoft Edge read-aloud service; commercial use is a gray area), **elevenlabs** (`ELEVENLABS_API_KEY`, supports Indonesian), **60db** (`SIXTYDB_API_KEY`), **qwen3** (self-hosted GPU, no Indonesian).
- Music: the free library track `examples/sky-blue-short/audio/music.mp3` (60 s, ACE-Step) copied to `public/audio/background-music.mp3`. Generated music via ACE-Step (`ACEMUSIC_API_KEY`) is not wired into recipes yet.
- Edge TTS output is constant 48 kbps MP3, so durations come from byte size. `ffmpeg`/`ffprobe` are **not** on PATH on this machine; use Remotion's (`npx remotion ffprobe` inside a project with node_modules) when needed.

## 11. Environment gotchas

- Git Bash rewrites leading-slash args (`/buat-video`) → use `MSYS_NO_PATHCONV=1`.
- Node 24 prints DEP0190 for `shell: true` with args → version checks use one constant command string.
- Each project's node_modules is ~700 MB while rendering; pruned after success. Rendering Chrome is shared in `.dashboard/browser/`.
- The Claude desktop browser pane may swallow Ctrl+K; test the palette in Chrome/Edge or by dispatching the key event.
- The owner's PowerShell profile calls `oh-my-posh`, which is not installed; the error at terminal start is harmless.
- claude-mem may be unavailable; do not depend on it.

## 12. Key documents

- Product spec (Indonesian): `docs/superpowers/specs/2026-10-24-dashboard-video-generation-prd.md`
- MVP plan: `docs/superpowers/plans/2026-10-24-dashboard-video-generation-mvp.md`
- Design rulings and known gaps: `docs/superpowers/plans/2026-10-24-dashboard-video-generation-mvp-rulings.md`
- Production command: `.claude/commands/buat-video.md`; user guide: `dashboard/content/cara-kerja.md`
- Toolkit reference (templates, tools, timing, transitions): `CLAUDE.md`

## 13. Known gaps and roadmap

Deferred on purpose (see rulings R42): `run.mjs start --project <slug>` (JMB-02), tool/command usage on the Skill page (SKL-03), a PRD §14 integration test, NFR-06 performance measurement. Planned (P1): one-click Generate from the dashboard with render progress and cancel, revisions, uploaded inspiration references, generated music in recipes, gallery actions (open folder, Remotion Studio, trash).

## Codex setup

If you're using this repo from Codex, run the migration script once to install the toolkit's skills under `~/.codex/skills/`:

```bash
uv run scripts/migrate_to_codex.py --force
```

The script can also sync `CLAUDE.md` content into a generated block at the end of this file — re-run `--force` after editing `CLAUDE.md` to keep it fresh. Manual content above the generated block is preserved. To uninstall: `uv run scripts/migrate_to_codex.py --reset`. See `docs/codex.md`.
