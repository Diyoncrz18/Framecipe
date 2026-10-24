# Dashboard Video Generation: Rencana Implementasi MVP (M0–M3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun MVP dashboard lokal (semua kebutuhan P0 di PRD) beserta jembatannya ke Claude Code, sehingga video bisa dipesan dari sebuah alur, dibuat Claude lewat `/buat-video`, dipantau prosesnya, lalu ditonton di dashboard.

**Architecture:** Satu paket `dashboard/` berisi aplikasi Next.js (UI) dan modul inti JavaScript murni di `dashboard/core/`. Modul inti dipakai bersama oleh UI, oleh CLI `dashboard/bin/run.mjs` (dipanggil Claude di setiap tahap), dan oleh `dashboard/bin/hook.mjs` (dipanggil hook Claude Code untuk mencatat event). Semua data disimpan sebagai file di repo (`flows/`, `projects/`, `.dashboard/`). Tidak ada database, dan server hanya mendengarkan 127.0.0.1.

**Tech Stack:** Node 24, Next.js 16.4.3 (App Router, TypeScript, Turbopack), React 19, Tailwind CSS 4, shadcn 4.22.1, zod 4, react-markdown + remark-gfm, Vitest 5, Remotion 4.0.529 (milik template), Claude Code 2.1.303 (hook, custom command, `claude -p`).

**Spec:** `docs/superpowers/specs/2026-10-24-dashboard-video-generation-prd.md` (v0.3, disetujui 24 Oktober 2026).

## Global Constraints

- Kerjakan di checkout utama repo pada branch `feat/dashboard-mvp`. **Jangan memakai git worktree.** `run.mjs` sengaja menolak berjalan di worktree (JMB-09), jadi uji end-to-end akan gagal di sana.
- Cakupan rencana ini hanya kebutuhan P0. P1 dan P2 di luar cakupan.
- Server dashboard: host `127.0.0.1`, port `3210` (NFR-01, §12).
- Semua akses file dari UI dan modul inti lewat `resolveInside()`. Tolak `..`, path absolut, serta symlink/junction yang keluar dari root repo (NFR-02).
- Nilai di `.env` tidak pernah dikirim ke browser. Yang dikirim hanya status terisi atau kosong (NFR-03).
- Proses anak dijalankan dengan argumen array tanpa shell. Satu-satunya pengecualian: pengecekan versi dengan argumen konstan `--version` di Windows. Teks dari pengguna (topik, catatan) tidak pernah menjadi argumen perintah (NFR-04).
- Markdown dirender dengan `react-markdown`, tanpa `rehype-raw` (NFR-05).
- JSON yang rusak atau hilang ditampilkan sebagai item "Data rusak", bukan halaman error (NFR-07).
- Harus berjalan di Windows 11 dengan path berspasi (`C:\MY FOLDER\...`), Node 24, dan Chrome/Edge (NFR-08).
- Teks antarmuka dalam Bahasa Indonesia. Kode, nama file, dan identifier dalam bahasa Inggris (NFR-09).
- Aksesibilitas dasar: semua aksi bisa dilakukan dengan keyboard, setiap input punya label, kontras minimal AA, dan status selalu punya teks atau ikon, bukan hanya warna (NFR-10).
- Dashboard tidak pernah menghapus permanen data pengguna. "Arsip" berarti memindahkan folder (NFR-11).
- Command dan perilaku toolkit yang sudah ada tidak berubah (NFR-12).
- Hanya satu run aktif pada satu waktu. Run tanpa aktivitas lebih dari 15 menit dianggap terhenti (JMB-05).
- Halaman yang menampilkan data langsung diperbarui paling lambat setiap 2 detik (EKS-05).
- Dependensi baru dibatasi pada `zod`, `react-markdown`, `remark-gfm`, `vitest`, ditambah yang dibawa create-next-app dan komponen shadcn.
- Di `dashboard/core/`, hanya `contracts.mjs` dan modul yang mengimpornya yang boleh memakai `zod`. `hook.mjs` dan semua yang diimpornya (`paths`, `jsonfile`, `run-store`, `hook-events`) hanya memakai modul bawaan Node.
- Next.js 16: `params` dan `searchParams` di page dan route handler berupa Promise (`const { slug } = await params`).

## Review Focus

1. **Topik tidak biasa.** Topik berisi emoji, aksara non-Latin, hanya tanda baca, atau sangat panjang (misalnya "Kopi ☕ & Teh!!!", "???", 300 karakter) harus tetap menghasilkan slug proyek yang valid dan unik, sementara judul aslinya tetap tampil apa adanya. Diuji di Task 2 (`slugify topik umum dan khusus`) dan Task 6 (`start dengan topik khusus menghasilkan slug aman`).
2. **Path Windows.** Path dengan spasi dan backslash (`C:\MY FOLDER\...\projects\a\file.md`) harus berfungsi, dan path di event serta UI tampil relatif dengan `/`. Diuji di Task 1 (`resolveInside menerima path di dalam root berspasi`) dan Task 8 (`event file memakai path relatif dengan /`).
3. **Run yang ditinggalkan.** Sesi Claude ditutup atau berhenti di tengah run tanpa `finish`/`fail`. Dashboard harus menampilkan "Terhenti" atau "Claude berhenti", run baru tetap bisa dimulai, dan run lama bisa ditandai gagal. Diuji di Task 6 (`start setelah run basi menandai run lama abandoned`) dan Task 18 (`displayStatus mengikuti aturan berurutan`, `markRunFailed ...`).
4. **JSON rusak.** File JSON terpotong atau rusak karena diedit tangan (flow.json, run.json, project.json, baris JSONL). Item yang rusak ditandai, item lain tetap tampil, dan penulisan selalu atomik. Diuji di Task 2 (`readJson membedakan hilang dan rusak`, `readJsonLines melewati baris rusak`), Task 11 (`listProjects: alur, tanpa alur, dan rusak`), dan Task 18 (`listRuns menandai run.json rusak ...`).
5. **Video hasil yang salah.** Render menghasilkan file 0 byte, render gagal, atau `out/` masih berisi MP4 lama. `finish` tidak boleh sukses dan tidak boleh mengambil file lama. Diuji di Task 7 (`finish menolak file lama/kosong`).

## Keputusan rencana yang menyempurnakan PRD

Keputusan ini hasil verifikasi saat menyusun rencana (24 Oktober 2026). Isinya detail implementasi; tujuan dan cakupan PRD tidak berubah.

1. **Dependensi proyek.** Dependensi tetap dipasang per proyek dengan `npm install`, sesuai cara toolkit. Template mengimpor `lib/` lewat path relatif, jadi berbagi satu `node_modules` antar proyek berisiko merusak resolusi modul. Masalahnya, `node_modules` hello-world berukuran 688 MB, dan 270 MB di antaranya browser render. Solusinya:
   - Browser render disalin sekali ke `.dashboard/browser/` lalu dipakai ulang lewat `--browser-executable`.
   - `node_modules` proyek dihapus otomatis setelah run sukses tervalidasi, dan bisa dipasang ulang dengan `run.mjs install`.
2. **Satu pintu perintah.** Setiap langkah yang menjalankan program (install, render, ffprobe, ffmpeg) lewat `node dashboard/bin/run.mjs <subperintah>`, sehingga cukup satu aturan izin. ffprobe dan ffmpeg memakai Remotion CLI milik proyek, bukan PATH. JMB-03 menyebut "dependensi dashboard"; yang dipakai sekarang dependensi proyek.
3. **Event run tidak disalin per run.** Hook hanya menulis `.dashboard/events/<sessionId>.jsonl`. Linimasa run disusun dari event sesi yang terikat ke run, dalam rentang waktu run, ditambah penanda tahap dari `run.json`. File `runs/<runId>/events.jsonl` di PRD §9.1 tidak dibuat.
4. **QC di MVP.** `qc.py` belum dijalankan karena MVP tanpa audio. Sebagai gantinya, `finish` memvalidasi file dan memberi peringatan bila durasi meleset lebih dari 10% dari target atau resolusi tidak sesuai alur.
5. **Frame review.** Frame dari `run.mjs stills` disimpan di `runs/<runId>/frames/` dan sekaligus menjadi thumbnail galeri.
6. **Hook memakai exec form** (`"command": "node"` + `args`), supaya path berspasi tidak perlu dikutip.
7. **`.claude/launch.json`** (P1 di PRD) dibuat di Task 10, karena kecil dan memudahkan verifikasi UI di panel browser aplikasi Claude.
8. **Uji end-to-end memakai `claude -p`** dari root repo, sehingga memakai kuota langganan Claude pemilik repo.

## Peta file

```
dashboard/                              aplikasi Next.js (create-next-app) + core + bin
  package.json                          scripts dev/start di 127.0.0.1:3210, test
  vitest.config.mts
  core/                                 JavaScript ESM murni; dipakai bin/ dan app/
    paths.mjs            T1             root, resolveInside, toRepoRelative, isGitWorktree
    test-utils.mjs       T1, T4         makeTempRoot, makeFixtureRepo, fixtureFlow
    ids.mjs              T2             slugify, uniqueSlug, newRunId, newRequestId
    jsonfile.mjs         T2             readJson, writeJsonAtomic, appendJsonLine, readJsonLines
    contracts.mjs        T3             skema zod, konstanta tahap/status, validasi alur
    fixtures/flow.valid.json  T3        alur contoh (sama dengan flows/contoh-penjelasan)
    catalog.mjs          T4             registry + isi folder, info template, status .env
    remotion.mjs         T5             script render, ffprobe, browser bersama
    run-store.mjs        T6             lokasi & baca/tulis run, run aktif, file event sesi
    run-ops.mjs          T6, T7         start/stage/wait/fail/status/install/render/stills/finish
    hook-events.mjs      T8             payload hook → event
    labels.mjs           T10            label Bahasa Indonesia untuk status/tahap/fase/event
    http-range.mjs       T11            header Range dan content-type
    projects.mjs         T11            daftar & detail proyek
    health.mjs           T14            kesehatan sistem
    flows.mjs            T15            simpan/duplikat/arsip alur, tambah referensi
    flow-form.mjs        T15            helper murni editor alur
    requests.mjs         T15            permintaan video dan prompt
    runs.mjs             T18            status efektif, linimasa, ringkasan run
  bin/run.mjs            T6, T7         CLI untuk Claude
  bin/hook.mjs           T8             dipanggil hook Claude Code
  content/cara-kerja.md  T14
  lib/root.ts, lib/media.ts             T10
  components/…                          T10–T20
  app/…                                 T10–T20
flows/contoh-penjelasan/flow.json       T9
.claude/commands/buat-video.md          T9
.claude/settings.json                   T9  (sebelumnya {})
.claude/launch.json                     T10
CLAUDE.md                               T9  (tambah satu bagian)
lib/project/types.ts                    T9  (tambah tiga field opsional)
.gitignore                              T1  (tambah .dashboard/)
```

## Menjalankan tes

Dari `dashboard/`: jalankan `npx vitest run` untuk semua tes, atau `npx vitest run core/<nama>.test.mjs` untuk satu file. Tes membangun repo tiruan di folder sementara yang namanya mengandung spasi. Beberapa tes membaca repo asli dan dilewati bila filenya tidak ada.

---

## M0: Kontrak & jembatan

### Task 1: Paket dashboard dan penjaga path

**Files:**
- Create: `dashboard/` (create-next-app), `dashboard/vitest.config.mts`, `dashboard/core/paths.mjs`, `dashboard/core/test-utils.mjs`
- Modify: `dashboard/package.json` (scripts), `.gitignore` (root)
- Test: `dashboard/core/paths.test.mjs`

**Interfaces:**
- Produces:
  - `resolveInside(root: string, ...segments: string[]): string` returns an absolute path. Throws `Error` with `code === 'PATH_OUTSIDE_ROOT'`.
  - `toRepoRelative(root: string, absPath: string): string | null` uses `/` separators, is case-insensitive on win32, and returns `null` when the path is outside root.
  - `isGitWorktree(root: string): boolean` returns `true` when `<root>/.git` is a file.
  - `repoRootFromBin(binFileUrl: string): string` returns the folder two levels above `dashboard/bin/`.
  - `cliRoot(binFileUrl: string): string` returns `process.env.VIDEO_REPO_ROOT ?? repoRootFromBin(binFileUrl)`.
  - In `test-utils.mjs`: `makeTempRoot(prefix = 'MY FOLDER '): string` creates a new temporary folder.

- [ ] **Step 1: Buat branch dan scaffold aplikasi** (dari root repo)

```bash
git switch -c feat/dashboard-mvp
npx create-next-app@16.4.3 dashboard --ts --tailwind --eslint --app --import-alias "@/*" --use-npm --disable-git --yes --no-agent-feedback
cd dashboard && npm install zod@4 react-markdown remark-gfm && npm install -D vitest@5
```

Hasil yang diharapkan: `dashboard/package.json` memuat `next` 16.4.3, dan tidak ada folder `src/`. Bila ada flag yang ditolak, periksa `npx create-next-app@16.4.3 --help`.

- [ ] **Step 2: Atur scripts dan tes**

Scripts di `dashboard/package.json` (scripts `build` dan `lint` tetap):
- `"dev": "next dev -H 127.0.0.1 -p 3210"`
- `"start": "next start -H 127.0.0.1 -p 3210"`
- `"test": "vitest run"`

`dashboard/vitest.config.mts`: `environment: 'node'`, `include: ['core/**/*.test.mjs']`, `testTimeout: 20000`. Tambahkan baris `.dashboard/` ke `.gitignore` di root repo.

- [ ] **Step 3: Tulis tes yang gagal** di `dashboard/core/paths.test.mjs`

```js
it('resolveInside menerima path di dalam root berspasi', () => {
  const root = makeTempRoot();
  expect(resolveInside(root, 'flows', 'a', 'flow.json')).toBe(path.join(root, 'flows', 'a', 'flow.json'));
});
it('resolveInside menolak jalan keluar', () => {
  const root = makeTempRoot();
  for (const bad of [['..'], ['..', 'x'], ['flows', '..', '..', 'x'], [path.parse(root).root, 'Windows']])
    expect(() => resolveInside(root, ...bad)).toThrow(expect.objectContaining({ code: 'PATH_OUTSIDE_ROOT' }));
});
it('resolveInside menolak junction ke luar root', () => {
  const root = makeTempRoot(); const outside = makeTempRoot();
  fs.symlinkSync(outside, path.join(root, 'link'), 'junction');
  expect(() => resolveInside(root, 'link', 'file.txt')).toThrow(expect.objectContaining({ code: 'PATH_OUTSIDE_ROOT' }));
});
it('toRepoRelative memakai / dan null di luar root', () => {
  const root = makeTempRoot();
  expect(toRepoRelative(root, path.join(root, 'projects', 'a', 'x.ts'))).toBe('projects/a/x.ts');
  expect(toRepoRelative(root, path.join(path.dirname(root), 'lain'))).toBeNull();
  if (process.platform === 'win32') expect(toRepoRelative(root, path.join(root.toUpperCase(), 'b.txt'))).toBe('b.txt');
});
it('isGitWorktree membedakan .git folder dan file', () => {
  const a = makeTempRoot(); fs.mkdirSync(path.join(a, '.git'));
  const b = makeTempRoot(); fs.writeFileSync(path.join(b, '.git'), 'gitdir: C:/x/.git/worktrees/b');
  const c = makeTempRoot();
  expect([isGitWorktree(a), isGitWorktree(b), isGitWorktree(c)]).toEqual([false, true, false]);
});
it('repoRootFromBin naik dua tingkat dari dashboard/bin', () => {
  const root = makeTempRoot();
  expect(repoRootFromBin(pathToFileURL(path.join(root, 'dashboard', 'bin', 'run.mjs')).href)).toBe(root);
});
```

- [ ] **Step 4: Jalankan tes, pastikan gagal.** Run: `npx vitest run core/paths.test.mjs`. Expected: FAIL (module not found).

- [ ] **Step 5: Implementasi `core/paths.mjs` dan `core/test-utils.mjs`**

- `resolveInside`: hitung `path.resolve(root, ...segments)`. Tolak bila `path.relative(root, p)` diawali `..` atau berupa path absolut. Lalu cari leluhur terdekat yang sudah ada; bila `fs.realpathSync.native` leluhur itu berada di luar `realpathSync.native(root)`, tolak juga.
- `makeTempRoot`: `fs.mkdtempSync(path.join(os.tmpdir(), prefix))`.

- [ ] **Step 6: Jalankan tes, pastikan lulus.** Run: `npx vitest run core/paths.test.mjs`. Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add .gitignore dashboard
git commit -m "feat(dashboard): Scaffold dashboard package and path guard"
```

### Task 2: ID, slug, dan file JSON

**Files:**
- Create: `dashboard/core/ids.mjs`, `dashboard/core/jsonfile.mjs`
- Test: `dashboard/core/ids.test.mjs`, `dashboard/core/jsonfile.test.mjs`

**Interfaces:**
- Produces (ids.mjs):
  - `slugify(text: string): string`: lowercase, strip diacritics (NFKD + remove `\p{M}`), replace every char outside `[a-z0-9]` with `-`, collapse repeated `-`, cut to at most 48 chars with no `-` at either end. Empty result → `'video'`.
  - `uniqueSlug(base: string, taken: (slug: string) => boolean): string` tries `base`, then `base-2`, `base-3`, and so on.
  - `randomHex(chars: number): string`
  - `newRunId(now: Date, suffix: string): string` formats local time as `YYYYMMDD-HHmm-<suffix>`.
  - `newRequestId(): string` returns 6 hex chars.
- Produces (jsonfile.mjs, Node built-ins only):
  - `readJson(file): { ok: true, value } | { ok: false, error: 'missing' | 'corrupt', message: string }`
  - `writeJsonAtomic(file, value): void` creates parent folders, writes `<file>.tmp-<pid>` with 2-space indent and a trailing newline, then `renameSync`.
  - `appendJsonLine(file, value): void` creates parent folders and appends one JSON line plus `\n`.
  - `readJsonLines(file): { items: any[], corruptLines: number }`. A missing file returns `{ items: [], corruptLines: 0 }`.

- [ ] **Step 1: Tulis tes yang gagal**

```js
it('slugify topik umum dan khusus', () => {
  expect(slugify('Cara kerja pelangi')).toBe('cara-kerja-pelangi');
  expect(slugify('Kopi ☕ & Teh!!!')).toBe('kopi-teh');
  expect(slugify('Évolution de l’IA')).toBe('evolution-de-l-ia');
  expect(slugify('  Halo   Dunia  ')).toBe('halo-dunia');
  expect(slugify('???')).toBe('video');
  expect(slugify('日本語のタイトル')).toBe('video');
  const long = slugify('a b '.repeat(150));
  expect(long.length).toBeLessThanOrEqual(48); expect(long.endsWith('-')).toBe(false);
});
it('uniqueSlug menambah akhiran', () => {
  expect(uniqueSlug('x', s => ['x', 'x-2'].includes(s))).toBe('x-3');
  expect(uniqueSlug('y', () => false)).toBe('y');
});
it('newRunId dan newRequestId', () => {
  expect(newRunId(new Date(2026, 9, 24, 1, 53), 'a1b2')).toBe('20261024-0153-a1b2');
  expect(newRequestId()).toMatch(/^[0-9a-f]{6}$/);
});
it('writeJsonAtomic lalu readJson, tanpa sisa .tmp', () => {
  const dir = path.join(makeTempRoot(), 'a b'); const f = path.join(dir, 'x.json');
  writeJsonAtomic(f, { a: 1 });
  expect(readJson(f)).toEqual({ ok: true, value: { a: 1 } });
  expect(fs.readdirSync(dir)).toEqual(['x.json']);
});
it('readJson membedakan hilang dan rusak', () => {
  const root = makeTempRoot(); const f = path.join(root, 'r.json'); fs.writeFileSync(f, '{"a":');
  expect(readJson(path.join(root, 'nope.json'))).toMatchObject({ ok: false, error: 'missing' });
  expect(readJson(f)).toMatchObject({ ok: false, error: 'corrupt' });
});
it('readJsonLines melewati baris rusak', () => {
  const f = path.join(makeTempRoot(), 'e.jsonl');
  appendJsonLine(f, { n: 1 }); appendJsonLine(f, { n: 2 }); fs.appendFileSync(f, '{"n":3');
  expect(readJsonLines(f)).toEqual({ items: [{ n: 1 }, { n: 2 }], corruptLines: 1 });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal.** Run: `npx vitest run core/ids.test.mjs core/jsonfile.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implementasi `ids.mjs` dan `jsonfile.mjs`** sesuai signature di atas.
- [ ] **Step 4: Jalankan tes, pastikan lulus.** Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat(dashboard): Add id, slug and atomic JSON helpers"`

### Task 3: Skema kontrak dan validasi alur

**Files:**
- Create: `dashboard/core/contracts.mjs`, `dashboard/core/fixtures/flow.valid.json`
- Test: `dashboard/core/contracts.test.mjs`

**Interfaces:**
- Produces:
  - `STAGES = ['setup','script','assets','audio','compose','qc','render','review','done']`
  - `PHASE_BY_STAGE = { setup:'planning', script:'planning', assets:'assets', audio:'audio', compose:'editing', qc:'editing', render:'rendering', review:'rendering', done:'complete' }`
  - `RUN_STATUSES = ['running','waiting','success','failed','cancelled','abandoned']`
  - `EVENT_TYPES = ['prompt','skill','command','file','agent','tool','notification','stop','session-start','session-end']`
  - `QWEN3_LANGUAGES = ['en','zh','fr','de','it','ja','ko','pt','ru','es']`
  - zod v4 `flowSchema`, `requestSchema`, `runSchema`, `eventSchema`. Fields follow PRD §9.2–9.5, with these changes:
    - run adds `notes?: string`, `warnings: string[]`, `waitReason: string | null`, `claudeCodeVersion: string | null`, `retryOf: string | null`; `request` is `string | null`; `stages[].endedAt` is `string | null`.
    - event adds `toolUseId?: string`, `phase?: 'start' | 'end'`, `error?: string`, `detail?: object`, `tool: string | null`, `ok: boolean | null`; `type` is one of `EVENT_TYPES`.
  - `parseFlow(value: unknown): { ok: true, flow } | { ok: false, errors: string[] }`. Each error is `<field path>: <Indonesian message>`, e.g. `scenes.1.durationSeconds: Durasi harus lebih dari 0.`
  - `checkFlowAgainstRepo(flow, ctx: { templates: Record<string, { engine: 'remotion' | 'python', aspectRatio: string }>, brands: string[], transitions: string[] }): string[]`. Checks run in this order: template, aspect ratio (skipped for python templates), brand, transitions (in scene order), voice.
  - `flowWarnings(flow): string[]`
- Exact messages:
  - `ID alur hanya boleh huruf kecil, angka, dan tanda hubung.`
  - `ID scene "${id}" dipakai lebih dari sekali.`
  - `Pilih provider suara.` (when `audio.voiceover.enabled` is true and there is no provider)
  - `Referensi #${n} (${kind}) butuh ${field}.` (kinds `example|template|transition|component|brand|project` need `id`, `upload` needs `path`, `link` needs `url`)
  - `Template "${t}" tidak ditemukan di templates/.`
  - `Template "${t}" berbasis Python dan belum bisa dipakai di alur v1.`
  - `Rasio ${r} tidak didukung template "${t}" (rasio template ${tr}).`
  - `Brand "${b}" tidak ditemukan di brands/.`
  - `Transisi "${x}" di scene "${id}" tidak ada di registry.`
  - `Qwen3-TTS tidak mendukung bahasa "${lang}". Pilih ElevenLabs atau matikan suara.`
  - Warning: `Total durasi scene ${sum} dtk, target ${target} dtk (selisih lebih dari 10%).`
- Fixture `flow.valid.json`. Task 9 copies this content to `flows/contoh-penjelasan/flow.json`:

```json
{
  "id": "contoh-penjelasan",
  "name": "Contoh Penjelasan",
  "description": "Penjelasan singkat 16:9 tanpa suara, render lokal gratis",
  "version": 1,
  "updatedAt": "2026-10-24T00:00:00.000Z",
  "template": "sprint-review",
  "brand": "default",
  "output": { "aspectRatio": "16:9", "width": 1920, "height": 1080, "fps": 30, "targetDurationSeconds": 30 },
  "language": "id",
  "style": { "tone": "santai dan jelas", "audience": "umum", "rules": ["kalimat pendek", "tanpa emoji"] },
  "scenes": [
    { "id": "hook", "label": "Hook", "goal": "Judul berupa pertanyaan yang memancing rasa penasaran", "durationSeconds": 4, "rules": ["maksimal 8 kata"], "narration": false, "visualHint": "judul besar di tengah" },
    { "id": "poin", "label": "Poin-poin", "goal": "Tiga poin penjelasan inti", "durationSeconds": 12, "rules": ["tepat 3 poin", "maksimal 8 kata per poin"], "narration": false, "transitionOut": "zoomBlur" },
    { "id": "fakta", "label": "Fakta", "goal": "Tiga angka atau fakta singkat yang menguatkan penjelasan", "durationSeconds": 7, "rules": ["tepat 3 angka"], "narration": false },
    { "id": "penutup", "label": "Penutup", "goal": "Kalimat penutup dan ajakan singkat", "durationSeconds": 5, "rules": [], "narration": false }
  ],
  "audio": { "voiceover": { "enabled": false }, "music": { "enabled": false }, "captions": { "enabled": false } },
  "references": [ { "kind": "example", "id": "hello-world" }, { "kind": "transition", "id": "zoomBlur" } ],
  "skills": ["remotion-official"],
  "approval": "auto",
  "notes": "Ikuti struktur contoh hello-world: judul, poin, angka, penutup."
}
```

- [ ] **Step 1: Tulis tes yang gagal**

```js
const valid = JSON.parse(fs.readFileSync(new URL('./fixtures/flow.valid.json', import.meta.url), 'utf8'));
const ctx = { templates: { 'sprint-review': { engine: 'remotion', aspectRatio: '16:9' },
  'concept-explainer-short': { engine: 'python', aspectRatio: 'unknown' } }, brands: ['default'], transitions: ['zoomBlur'] };
it('alur contoh valid', () => {
  expect(parseFlow(valid).ok).toBe(true);
  expect(checkFlowAgainstRepo(valid, ctx)).toEqual([]);
  expect(flowWarnings(valid)).toEqual([]);
});
it('menolak id bukan slug dan scene ganda', () => {
  const r = parseFlow({ ...valid, id: 'Contoh Penjelasan', scenes: [valid.scenes[0], valid.scenes[0]] });
  expect(r.ok).toBe(false);
  expect(r.errors.join('\n')).toContain('ID alur hanya boleh huruf kecil, angka, dan tanda hubung.');
  expect(r.errors.join('\n')).toContain('ID scene "hook" dipakai lebih dari sekali.');
});
it('suara aktif wajib provider, referensi wajib field', () => {
  const r = parseFlow({ ...valid, audio: { ...valid.audio, voiceover: { enabled: true } }, references: [{ kind: 'link' }] });
  expect(r.errors.join('\n')).toContain('Pilih provider suara.');
  expect(r.errors.join('\n')).toContain('Referensi #1 (link) butuh url.');
});
it('cek repo: python, brand, transisi, qwen3 + id', () => {
  const f = { ...valid, template: 'concept-explainer-short', brand: 'nope', language: 'id',
    audio: { ...valid.audio, voiceover: { enabled: true, provider: 'qwen3' } },
    scenes: [{ ...valid.scenes[0], transitionOut: 'wipe' }] };
  expect(checkFlowAgainstRepo(f, ctx)).toEqual([
    'Template "concept-explainer-short" berbasis Python dan belum bisa dipakai di alur v1.',
    'Brand "nope" tidak ditemukan di brands/.',
    'Transisi "wipe" di scene "hook" tidak ada di registry.',
    'Qwen3-TTS tidak mendukung bahasa "id". Pilih ElevenLabs atau matikan suara.',
  ]);
  expect(checkFlowAgainstRepo({ ...valid, output: { ...valid.output, aspectRatio: '9:16' } }, ctx))
    .toEqual(['Rasio 9:16 tidak didukung template "sprint-review" (rasio template 16:9).']);
});
it('peringatan durasi lebih dari 10%', () => {
  expect(flowWarnings({ ...valid, scenes: [{ ...valid.scenes[0], durationSeconds: 20 }] }))
    .toEqual(['Total durasi scene 20 dtk, target 30 dtk (selisih lebih dari 10%).']);
});
it('runSchema dan eventSchema', () => {
  const run = { runId: '20261024-0153-a1b2', project: 'cara-kerja-pelangi', flow: 'contoh-penjelasan', flowVersion: 1,
    request: null, topic: 'Cara kerja pelangi', notes: '', trigger: 'chat', retryOf: null, sessionId: null,
    claudeCodeVersion: '2.1.303', status: 'running', stage: 'setup', waitReason: null,
    stages: [{ name: 'setup', startedAt: '2026-10-24T01:53:00.000Z', endedAt: null }],
    startedAt: '2026-10-24T01:53:00.000Z', endedAt: null, output: null, warnings: [], error: null };
  expect(runSchema.safeParse(run).success).toBe(true);
  expect(runSchema.safeParse({ ...run, status: 'done' }).success).toBe(false);
  expect(eventSchema.safeParse({ ts: '2026-10-24T01:53:05.120Z', sessionId: 's1', runId: null, type: 'skill',
    tool: 'Skill', summary: 'remotion-official', ok: true }).success).toBe(true);
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal.** Run: `npx vitest run core/contracts.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implementasi `contracts.mjs` dengan zod v4.** Gunakan `{ error: '...' }` untuk pesan dan `z.iso.datetime()` untuk waktu. Validasi lintas-field (scene ganda, provider suara, field referensi) memakai `superRefine`.
- [ ] **Step 4: Jalankan tes, pastikan lulus.** Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat(dashboard): Add data contracts and flow validation"`

### Task 4: Katalog repo

**Files:**
- Create: `dashboard/core/catalog.mjs`
- Modify: `dashboard/core/test-utils.mjs` (tambah `makeFixtureRepo`, `fixtureFlow`)
- Test: `dashboard/core/catalog.test.mjs`

**Interfaces:**
- Consumes: `readJson` (T2), `fixtures/flow.valid.json` (T3).
- Produces:
  - `readCatalog(root): Catalog` with shape `{ registryError: string | null, skills, commands, tools, templates, examples, transitions, components, brands, cloudProviders }`. Each array holds `Item`s.
    - `Item = { id, description, status: string | null, path: string | null, source: 'registry' | 'folder' | 'both', mismatch: null | 'missing-folder' | 'unregistered', envVars: string[], requires: string | null, options: unknown, bestFor: string | null }`
    - `TemplateItem = Item & { engine: 'remotion' | 'python', aspectRatio: string, width: number | null, height: number | null }`. engine is `remotion` when `package.json` lists `remotion`. aspectRatio comes from the first `width:`/`height:` in `src/config/*.ts`, reduced to `16:9`, `9:16`, `1:1`, or `w:h`; `'unknown'` when not found.
    - `ExampleItem = Item & { template: string | null, complexity: string | null, renderedVideo: string | null }`. renderedVideo is the repo-relative path of the newest `out/*.mp4`.
    - `BrandItem = Item & { brand: object | null, corrupt: boolean, logo: string | null }`. logo is the repo-relative path of `assets/logo.*`.
    - Folder scans: skills from `.claude/skills/*/SKILL.md` (frontmatter `name`, `description`), commands from `.claude/commands/*.md` (frontmatter `description`), tools from `tools/*.py`, and the folders `templates/*/`, `examples/*/`, `brands/*/brand.json`. Transitions and components come from the registry only; their `path` is checked to set `missing-folder`.
  - `templateInfo(root, id): { engine, aspectRatio, width, height } | null`
  - `repoContextForValidation(root): { templates: Record<string, { engine, aspectRatio }>, brands: string[], transitions: string[] }`
  - `envStatus(root, keys: string[]): { key: string, present: boolean }[]` reads only `<root>/.env` and ignores comments and empty values.
  - `allEnvKeys(catalog): string[]` returns the sorted union of `envVars` from tools and cloudProviders.
  - In `test-utils.mjs`:
    - `fixtureFlow(overrides = {})` returns `{ ...flow.valid.json, template: 'rem', ...overrides }`.
    - `makeFixtureRepo(): string` creates:
      - a `.git/` folder;
      - a registry (skills `foo`; commands `video`; tools `voiceover` with `envVars: ['ELEVENLABS_API_KEY']`; templates `rem`, `pyt`; examples `ex-a`, `ghost`; transitions `zoomBlur`; components `Cmp`; brands `default`; cloudProviders `runpod` with `envVars: ['RUNPOD_API_KEY']`);
      - `templates/rem/` containing `package.json` (with `dependencies.remotion` and `scripts.render: "npx remotion render src/index.ts Rem out/rem.mp4"`), `src/config/video.ts` (`width: 1920, height: 1080`), `node_modules/x.txt`, and `out/old.mp4`;
      - `templates/pyt/build.py`;
      - `brands/default/brand.json` and `brands/other/brand.json`;
      - `examples/ex-a/out/v.mp4` and an empty folder `examples/unreg/`;
      - `.claude/skills/foo/SKILL.md` and `.claude/skills/bar/SKILL.md`;
      - `.env` with `ELEVENLABS_API_KEY=abc`, `RUNPOD_API_KEY=`, and `# IDEOGRAM_API_KEY=x`;
      - `flows/contoh-penjelasan/flow.json` = `fixtureFlow()`.

- [ ] **Step 1: Tulis tes yang gagal**

```js
it('menggabungkan registry dan folder', () => {
  const c = readCatalog(makeFixtureRepo());
  expect(c.templates.find(t => t.id === 'rem')).toMatchObject({ engine: 'remotion', aspectRatio: '16:9', width: 1920, height: 1080, source: 'both' });
  expect(c.templates.find(t => t.id === 'pyt').engine).toBe('python');
  expect(c.examples.find(e => e.id === 'ghost').mismatch).toBe('missing-folder');
  expect(c.examples.find(e => e.id === 'unreg').mismatch).toBe('unregistered');
  expect(c.examples.find(e => e.id === 'ex-a').renderedVideo).toBe('examples/ex-a/out/v.mp4');
  expect(c.skills.find(s => s.id === 'bar')).toMatchObject({ source: 'folder', mismatch: 'unregistered' });
  expect(c.brands.find(b => b.id === 'other').mismatch).toBe('unregistered');
});
it('registry rusak tidak menjatuhkan katalog', () => {
  const root = makeFixtureRepo(); fs.writeFileSync(path.join(root, '_internal', 'toolkit-registry.json'), '{');
  const c = readCatalog(root);
  expect(c.registryError).toMatch(/toolkit-registry\.json/);
  expect(c.templates.map(t => t.id).sort()).toEqual(['pyt', 'rem']);
});
it('envStatus hanya melaporkan terisi atau kosong', () => {
  const root = makeFixtureRepo();
  expect(envStatus(root, ['ELEVENLABS_API_KEY', 'RUNPOD_API_KEY', 'IDEOGRAM_API_KEY'])).toEqual([
    { key: 'ELEVENLABS_API_KEY', present: true }, { key: 'RUNPOD_API_KEY', present: false }, { key: 'IDEOGRAM_API_KEY', present: false }]);
  expect(allEnvKeys(readCatalog(root))).toEqual(['ELEVENLABS_API_KEY', 'RUNPOD_API_KEY']);
});
it('repo asli: fakta Lampiran A PRD', () => {
  const c = readCatalog(path.resolve(import.meta.dirname, '..', '..'));
  expect(c.templates.find(t => t.id === 'sprint-review')).toMatchObject({ engine: 'remotion', aspectRatio: '16:9' });
  expect(c.templates.find(t => t.id === 'concept-explainer-short').engine).toBe('python');
  expect(c.templates.find(t => t.id === 'ai-engineering-review').mismatch).toBe('unregistered');
  expect(c.examples.find(e => e.id === 'the-space-between').mismatch).toBe('missing-folder');
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal.** Run: `npx vitest run core/catalog.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implementasi `catalog.mjs` dan `makeFixtureRepo`/`fixtureFlow`.**
- [ ] **Step 4: Jalankan tes, pastikan lulus.** Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat(dashboard): Read toolkit catalog from registry and folders"`

### Task 5: Helper Remotion

**Files:**
- Create: `dashboard/core/remotion.mjs`
- Test: `dashboard/core/remotion.test.mjs`

**Interfaces:**
- Produces:
  - `parseRenderScript(script: string): { entry: string | null, compositionId: string, output: string, extraArgs: string[] }` accepts `[npx ]remotion render [<entry>] <CompositionId> <output.mp4> [flags…]`. `entry` is the token ending in `.ts|.tsx|.js|.jsx`. Throws `code === 'RENDER_SCRIPT_UNKNOWN'` with message `Script render tidak dikenali: "<script>".`
  - `remotionCliPath(projectDir): string` returns `<projectDir>/node_modules/@remotion/cli/remotion-cli.js`. Throws `code === 'DEPS_MISSING'` with message `Dependensi proyek belum terpasang. Jalankan: node dashboard/bin/run.mjs install`.
  - `parseFfprobeJson(text: string): { durationSeconds, width, height, fps }` throws `Tidak ada stream video.`
  - `probeVideo(projectDir, fileAbs, spawnSync = child_process.spawnSync): { durationSeconds, width, height, fps, sizeBytes }` runs `process.execPath [cli, 'ffprobe', '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', fileAbs]` with `cwd: projectDir`.
  - `findBrowserExe(dir): string | null` searches for `chrome-headless-shell.exe` on win32 (`chrome-headless-shell` elsewhere) to a maximum depth of 6.
  - `sharedBrowserDir(root): string` returns `<root>/.dashboard/browser`.

- [ ] **Step 1: Tulis tes yang gagal**

```js
const real = path.resolve(import.meta.dirname, '..', '..');
const helloDir = path.join(real, 'examples', 'hello-world'); const helloMp4 = path.join(helloDir, 'out', 'video.mp4');
it('parseRenderScript mengenali bentuk script template', () => {
  expect(parseRenderScript('npx remotion render src/index.ts SprintReview out/sprint-review.mp4'))
    .toEqual({ entry: 'src/index.ts', compositionId: 'SprintReview', output: 'out/sprint-review.mp4', extraArgs: [] });
  expect(parseRenderScript('remotion render ProductDemo out/product-demo.mp4'))
    .toEqual({ entry: null, compositionId: 'ProductDemo', output: 'out/product-demo.mp4', extraArgs: [] });
  expect(parseRenderScript('npx remotion render src/index.ts X out/x.mp4 --codec=h264').extraArgs).toEqual(['--codec=h264']);
  expect(() => parseRenderScript('python build.py')).toThrow(expect.objectContaining({ code: 'RENDER_SCRIPT_UNKNOWN' }));
});
it('semua template Remotion di repo bisa diurai', () => {
  for (const id of ['sprint-review', 'sprint-review-v2', 'product-demo', 'ai-engineering-review']) {
    const pkg = JSON.parse(fs.readFileSync(path.join(real, 'templates', id, 'package.json'), 'utf8'));
    expect(() => parseRenderScript(pkg.scripts.render)).not.toThrow();
  }
});
it('parseFfprobeJson', () => {
  const json = JSON.stringify({ format: { duration: '25.000000' }, streams: [{ codec_type: 'audio' },
    { codec_type: 'video', width: 1920, height: 1080, r_frame_rate: '30/1' }] });
  expect(parseFfprobeJson(json)).toEqual({ durationSeconds: 25, width: 1920, height: 1080, fps: 30 });
  expect(() => parseFfprobeJson(JSON.stringify({ format: { duration: '1' }, streams: [] }))).toThrow('Tidak ada stream video.');
});
it('findBrowserExe menemukan exe bersarang', () => {
  const root = makeTempRoot(); const name = process.platform === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell';
  const dir = path.join(root, 'chrome-headless-shell', 'win64', 'chs'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), '');
  expect(findBrowserExe(root)).toBe(path.join(dir, name));
  expect(findBrowserExe(makeTempRoot())).toBeNull();
});
it.skipIf(!fs.existsSync(helloMp4) || !fs.existsSync(path.join(helloDir, 'node_modules')))(
  'probeVideo membaca video hello-world', () => {
    expect(probeVideo(helloDir, helloMp4)).toMatchObject({ durationSeconds: 25, width: 1920, height: 1080, fps: 30 });
  });
```

- [ ] **Step 2: Jalankan tes, pastikan gagal.** Run: `npx vitest run core/remotion.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implementasi `remotion.mjs`.**
- [ ] **Step 4: Jalankan tes, pastikan lulus.** Expected: PASS (tes hello-world boleh dilewati bila filenya tidak ada).
- [ ] **Step 5: Commit:** `git commit -m "feat(dashboard): Add Remotion script parser, probe and browser lookup"`

### Task 6: Siklus run: start, stage, wait, fail, status

**Files:**
- Create: `dashboard/core/run-store.mjs`, `dashboard/core/run-ops.mjs`, `dashboard/bin/run.mjs`
- Test: `dashboard/core/run-ops.test.mjs`, `dashboard/core/cli.test.mjs`

**Interfaces:**
- Consumes: T1–T4.
- Produces (`run-store.mjs`, Node built-ins only):
  - `activeRunPath(root)` returns `.dashboard/active-run.json`.
  - `readActiveRun(root): { runId, project, sessionId: string | null, startedAt } | null`, `writeActiveRun(root, active)`, `clearActiveRun(root)`.
  - `runPaths(root, project, runId): { dir, runFile, flowFile, framesDir }` (`projects/<project>/runs/<runId>/`, `run.json`, `flow.json`, `frames/`).
  - `readRun(root, project, runId)` returns a `readJson` result. `writeRun(root, run)` writes atomically.
  - `requestPath(root, id)` returns `.dashboard/requests/<id>.json`.
  - `sessionEventsPath(root, sessionId)` returns `.dashboard/events/<safeSessionId>.jsonl`.
  - `safeSessionId(id): string` keeps `[A-Za-z0-9_-]`; anything else becomes the first 16 chars of the sha1 hex.
  - `lastActivityAt(root, run): Date` is the latest of `startedAt`, every `stages[].startedAt`, and the `ts` of the last event in the session file (when `run.sessionId` is set).
- Produces (`test-utils.mjs`): `at(iso: string): Date` returns `new Date(iso)`. Without `Z` the time is local (used when a runId or archive name is asserted); with `Z` it is UTC (used when an ISO string is asserted).
- Produces (`run-ops.mjs`):
  - `defaultDeps = { now: () => new Date(), spawnSync, probe: probeVideo, claudeVersion: detectClaudeVersion, staleMs: 900000, rand: () => randomHex(4) }`
  - `detectClaudeVersion(): string | null` runs `spawnSync('claude', ['--version'], { shell: process.platform === 'win32', encoding: 'utf8', timeout: 5000 })` and returns the first `\d+\.\d+\.\d+`.
  - `startRun(root, input: { request?, flow?, topic?, notes?, retry?, trigger?: 'chat' | 'dashboard' }, deps): { project, runId, projectDir, runFile, flowFile }`. Paths are repo-relative with `/`.
  - `stageRun(root, stage, deps): { stage, phase }`
  - `waitRun(root, reason, deps): { status: 'waiting' }`
  - `failRun(root, reason, deps): { status: 'failed' }`
  - `statusRun(root): { active: { runId, project, stage, status } | null }`
  - Errors are `Error` objects with a `code` and an exact message:
    - `WORKTREE`: `Jalankan dari folder repo utama, bukan git worktree (${root}).`
    - `ACTIVE_RUN`: `Masih ada run aktif ${runId} (proyek ${project}). Selesaikan dengan finish atau fail, atau tunggu 15 menit tanpa aktivitas.`
    - `NO_ACTIVE_RUN`: `Tidak ada run aktif. Mulai dengan: node dashboard/bin/run.mjs start ...`
    - `REQUEST_NOT_FOUND`: `Permintaan ${id} tidak ditemukan.`
    - `REQUEST_TAKEN`: `Permintaan ${id} sudah diambil oleh run ${runId}.`
    - `FLOW_NOT_FOUND`: `Alur ${id} tidak ditemukan di flows/.`
    - `FLOW_INVALID`: `Alur ${id} tidak valid:\n- ` + errors.join('\n- ')
    - `RETRY_NOT_ALLOWED`: `Hanya run yang gagal, dibatalkan, atau terhenti yang bisa diperbaiki.`
    - `BAD_STAGE`: `Tahap "${s}" tidak dikenal. Pilihan: ${STAGES.join(', ')}.`
    - `BAD_ARGS`: `Argumen tidak lengkap: <penjelasan>.`
- `startRun` order (fixed):
  1. Worktree check.
  2. Active-run check. A stale run (`now − lastActivityAt > staleMs`) is set to `status: 'abandoned'`, `endedAt: now`, `error: { stage, message: 'Tidak ada aktivitas lebih dari 15 menit.' }`, then processing continues.
  3. Resolve the input.
  4. Load the flow, then run `parseFlow` + `checkFlowAgainstRepo(repoContextForValidation(root))`.
  5. Slug = `uniqueSlug(slugify(topic), s => exists(projects/s))`. A retry reuses the old project.
  6. Copy `templates/<template>` to `projects/<slug>` except `node_modules`, `out`, and `.remotion`. Skipped on retry.
  7. Write `project.json` in toolkit shape: `name`, `template`, `brand`, `created`, `updated`, `phase: 'planning'`, `scenes: []`, `audio.voiceover: { file: 'audio/voiceover.mp3', status: enabled ? 'needed' : 'optional' }`, `estimates.totalDurationSeconds` = total scene duration, `sessions: [{ date: 'YYYY-MM-DD', summary: 'Dibuat oleh /buat-video (alur <id> v<version>)' }]`, plus `flow`, `topic`, `latestRun`. On retry, update only `latestRun` and `updated`, and add the session `Perbaikan run <runIdLama> menjadi <runIdBaru>`.
  8. Write the snapshot to `runs/<runId>/flow.json`. A retry copies the failed run's snapshot.
  9. Write `run.json` (runSchema-valid): `status: 'running'`, `stage: 'setup'`, `stages: [{ name: 'setup', startedAt, endedAt: null }]`, `trigger` defaults to `'chat'`, `claudeCodeVersion: deps.claudeVersion()`, `retryOf`.
  10. Set the request to `status: 'diambil'` with its `runId`.
  11. `writeActiveRun({ runId, project, sessionId: null, startedAt })`.
- `stageRun` closes the open stage (`endedAt`), appends the new stage, sets `status: 'running'` and `waitReason: null`, and updates `project.json` (`phase = PHASE_BY_STAGE[stage]`, `updated`).
- `failRun` closes the open stage, sets `status: 'failed'`, `error: { stage, message: reason }`, and `endedAt`, then clears the active run. It does **not** delete `node_modules`.
- `bin/run.mjs`:
  - `const root = cliRoot(import.meta.url)`. Check `isGitWorktree(root)` **before** `await import('../core/run-ops.mjs')`, because a worktree may not have `zod` installed.
  - Parse arguments with `node:util` `parseArgs` (`allowPositionals: true`).
  - On success, print the result as JSON to stdout. On error, print `message` to stderr and `{"error":"<code>"}` to stdout, then exit 1.
  - Subcommands in this task: `start [--request id | --flow id --topic text [--notes text] | --retry runId] [--trigger chat|dashboard]`, `stage <name>`, `wait --reason text`, `fail --reason text`, `status`.

- [ ] **Step 1: Tulis tes yang gagal** di `run-ops.test.mjs`. Helper: `at(iso)` dari `test-utils.mjs`, dan helper lokal `deps(clock)` returns `{ ...defaultDeps, now: () => clock, claudeVersion: () => '2.1.303', rand: () => 'a1b2' }`.

```js
it('start membuat proyek, snapshot, run, dan penanda aktif', () => {
  const root = makeFixtureRepo();
  const r = startRun(root, { flow: 'contoh-penjelasan', topic: 'Cara kerja pelangi' }, deps(at('2026-10-24T01:53:00')));
  expect(r).toMatchObject({ project: 'cara-kerja-pelangi', runId: '20261024-0153-a1b2', projectDir: 'projects/cara-kerja-pelangi' });
  const p = path.join(root, 'projects', 'cara-kerja-pelangi');
  expect(fs.existsSync(path.join(p, 'package.json'))).toBe(true);
  expect([fs.existsSync(path.join(p, 'node_modules')), fs.existsSync(path.join(p, 'out'))]).toEqual([false, false]);
  expect(readJson(path.join(p, 'project.json')).value).toMatchObject({ name: 'cara-kerja-pelangi', template: 'rem',
    brand: 'default', phase: 'planning', flow: 'contoh-penjelasan', topic: 'Cara kerja pelangi', latestRun: r.runId });
  const run = readJson(path.join(p, 'runs', r.runId, 'run.json')).value;
  expect(runSchema.safeParse(run).success).toBe(true);
  expect(run).toMatchObject({ status: 'running', stage: 'setup', claudeCodeVersion: '2.1.303', trigger: 'chat', retryOf: null });
  expect(readJson(path.join(p, 'runs', r.runId, 'flow.json')).value).toEqual(fixtureFlow());
  expect(readActiveRun(root)).toMatchObject({ runId: r.runId, project: 'cara-kerja-pelangi', sessionId: null });
});
it('start dengan topik khusus menghasilkan slug aman', () => {
  const root = makeFixtureRepo(); const d = deps(at('2026-10-24T01:53:00'));
  expect(startRun(root, { flow: 'contoh-penjelasan', topic: 'Kopi ☕ & Teh!!!' }, d).project).toBe('kopi-teh');
  failRun(root, 'x', d);
  expect(startRun(root, { flow: 'contoh-penjelasan', topic: '???' }, d).project).toBe('video');
});
it('start ditolak saat ada run aktif yang masih hidup', () => {
  const root = makeFixtureRepo(); startRun(root, { flow: 'contoh-penjelasan', topic: 'A' }, deps(at('2026-10-24T01:53:00')));
  expect(() => startRun(root, { flow: 'contoh-penjelasan', topic: 'B' }, deps(at('2026-10-24T02:00:00'))))
    .toThrow(expect.objectContaining({ code: 'ACTIVE_RUN' }));
});
it('start setelah run basi menandai run lama abandoned', () => {
  const root = makeFixtureRepo(); const a = startRun(root, { flow: 'contoh-penjelasan', topic: 'A' }, deps(at('2026-10-24T01:53:00')));
  startRun(root, { flow: 'contoh-penjelasan', topic: 'B' }, deps(at('2026-10-24T02:09:01')));
  expect(readRun(root, 'a', a.runId).value).toMatchObject({ status: 'abandoned', error: { message: 'Tidak ada aktivitas lebih dari 15 menit.' } });
});
it('start dari permintaan menandai permintaan diambil', () => {
  const root = makeFixtureRepo();
  writeJsonAtomic(requestPath(root, 'abc123'), { id: 'abc123', flow: 'contoh-penjelasan', topic: 'Halo', notes: 'catatan',
    createdAt: '2026-10-24T01:50:00.000Z', status: 'baru', runId: null });
  const r = startRun(root, { request: 'abc123' }, deps(at('2026-10-24T01:53:00')));
  expect(readJson(requestPath(root, 'abc123')).value).toMatchObject({ status: 'diambil', runId: r.runId });
  expect(readRun(root, 'halo', r.runId).value.notes).toBe('catatan');
  failRun(root, 'x', deps(at('2026-10-24T01:54:00')));
  expect(() => startRun(root, { request: 'abc123' }, deps(at('2026-10-24T01:55:00')))).toThrow(expect.objectContaining({ code: 'REQUEST_TAKEN' }));
});
it('topik sama memberi proyek -2; alur tidak valid dan worktree ditolak', () => {
  const root = makeFixtureRepo(); const d = deps(at('2026-10-24T01:53:00'));
  startRun(root, { flow: 'contoh-penjelasan', topic: 'Halo' }, d); failRun(root, 'x', d);
  expect(startRun(root, { flow: 'contoh-penjelasan', topic: 'Halo' }, d).project).toBe('halo-2'); failRun(root, 'x', d);
  writeJsonAtomic(path.join(root, 'flows', 'py', 'flow.json'), fixtureFlow({ id: 'py', template: 'pyt' }));
  expect(() => startRun(root, { flow: 'py', topic: 'X' }, d)).toThrow(/berbasis Python/);
  fs.rmSync(path.join(root, '.git'), { recursive: true }); fs.writeFileSync(path.join(root, '.git'), 'gitdir: x');
  expect(() => startRun(root, { flow: 'contoh-penjelasan', topic: 'Y' }, d)).toThrow(expect.objectContaining({ code: 'WORKTREE' }));
});
it('stage memperbarui tahap dan fase proyek; wait lalu stage kembali running', () => {
  const root = makeFixtureRepo(); const d = deps(at('2026-10-24T01:53:00'));
  const r = startRun(root, { flow: 'contoh-penjelasan', topic: 'Halo' }, d);
  expect(stageRun(root, 'script', d)).toEqual({ stage: 'script', phase: 'planning' });
  waitRun(root, 'review naskah', d);
  expect(readRun(root, 'halo', r.runId).value).toMatchObject({ status: 'waiting', waitReason: 'review naskah' });
  expect(stageRun(root, 'render', d)).toEqual({ stage: 'render', phase: 'rendering' });
  const run = readRun(root, 'halo', r.runId).value;
  expect(run).toMatchObject({ status: 'running', waitReason: null, stage: 'render' });
  expect(run.stages.map(s => [s.name, s.endedAt !== null])).toEqual([['setup', true], ['script', true], ['render', false]]);
  expect(readJson(path.join(root, 'projects', 'halo', 'project.json')).value.phase).toBe('rendering');
  expect(() => stageRun(root, 'bogus', d)).toThrow(expect.objectContaining({ code: 'BAD_STAGE' }));
});
it('fail menutup run tanpa menghapus dependensi; perbaiki membuat run baru di proyek sama', () => {
  const root = makeFixtureRepo();
  const a = startRun(root, { flow: 'contoh-penjelasan', topic: 'Halo' }, deps(at('2026-10-24T01:53:00')));
  fs.mkdirSync(path.join(root, 'projects', 'halo', 'node_modules')); 
  failRun(root, 'render gagal', deps(at('2026-10-24T01:58:00')));
  expect(fs.existsSync(path.join(root, 'projects', 'halo', 'node_modules'))).toBe(true);
  expect(readRun(root, 'halo', a.runId).value).toMatchObject({ status: 'failed', error: { stage: 'setup', message: 'render gagal' } });
  expect(readActiveRun(root)).toBeNull();
  const b = startRun(root, { retry: a.runId }, { ...deps(at('2026-10-24T02:00:00')), rand: () => 'c3d4' });
  expect(b).toMatchObject({ project: 'halo', runId: '20261024-0200-c3d4' });
  expect(readRun(root, 'halo', b.runId).value.retryOf).toBe(a.runId);
  failRun(root, 'x', deps(at('2026-10-24T02:01:00')));
  writeRun(root, { ...readRun(root, 'halo', b.runId).value, status: 'success' });
  expect(() => startRun(root, { retry: b.runId }, deps(at('2026-10-24T02:02:00')))).toThrow(expect.objectContaining({ code: 'RETRY_NOT_ALLOWED' }));
});
```

Lalu `cli.test.mjs` (`bin` = path absolut `dashboard/bin/run.mjs`):

```js
it('CLI start, stage, status dengan VIDEO_REPO_ROOT', () => {
  const root = makeFixtureRepo(); const env = { ...process.env, VIDEO_REPO_ROOT: root };
  const run = (...a) => spawnSync(process.execPath, [bin, ...a], { env, encoding: 'utf8' });
  const s = run('start', '--flow', 'contoh-penjelasan', '--topic', 'Halo Dunia');
  expect(s.status).toBe(0); expect(JSON.parse(s.stdout).project).toBe('halo-dunia');
  const bad = run('stage', 'nope');
  expect(bad.status).toBe(1); expect(bad.stderr).toContain('Tahap "nope" tidak dikenal.');
  expect(JSON.parse(run('status').stdout).active.project).toBe('halo-dunia');
});
it('CLI menolak worktree sebelum memuat modul lain', () => {
  const root = makeTempRoot(); fs.writeFileSync(path.join(root, '.git'), 'gitdir: x');
  const r = spawnSync(process.execPath, [bin, 'status'], { env: { ...process.env, VIDEO_REPO_ROOT: root }, encoding: 'utf8' });
  expect(r.status).toBe(1); expect(r.stderr).toContain('bukan git worktree');
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal.** Run: `npx vitest run core/run-ops.test.mjs core/cli.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implementasi `run-store.mjs`, `run-ops.mjs` (start/stage/wait/fail/status), dan `bin/run.mjs`** sesuai urutan dan pesan di atas.
- [ ] **Step 4: Jalankan tes, pastikan lulus.** Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat(dashboard): Add run lifecycle CLI (start, stage, wait, fail, status)"`

### Task 7: install, render, stills, finish

**Files:**
- Modify: `dashboard/core/run-ops.mjs`, `dashboard/bin/run.mjs`
- Test: `dashboard/core/run-render.test.mjs`

**Interfaces:**
- Consumes: `remotion.mjs` (T5), `run-store.mjs` and `startRun` (T6).
- Produces:
  - `npmCliPath(): string` returns `path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')`.
  - `installDeps(root, deps): { ok: true }` calls `deps.spawnSync(process.execPath, [npmCliPath(), 'install', '--no-audit', '--no-fund', '--prefer-offline'], { cwd: <project abs>, stdio: 'inherit' })`. A non-zero status throws `INSTALL_FAILED` with message `npm install gagal (kode ${status}).`
  - `renderVideo(root, deps): { output: string }`.
    - Arguments: `[remotionCliPath(proj), 'render', ...(entry ? [entry] : []), compositionId, 'out/<runId>.mp4', ...extraArgs, ...(shared ? ['--browser-executable=' + shared] : [])]`, run with `cwd` = project and `stdio: 'inherit'`.
    - A non-zero status throws `RENDER_FAILED` with message `Render gagal (kode ${status}). Lihat output di atas.` The run status is left unchanged.
    - After a successful render, if `findBrowserExe(sharedBrowserDir(root))` is null and `<proj>/node_modules/.remotion/chrome-headless-shell` exists, copy that folder recursively to `<root>/.dashboard/browser/chrome-headless-shell`.
  - `extractStills(root, count, deps): { frames: string[] }`.
    - Duration comes from `deps.probe`. Timestamps are `((i + 0.5) * duration / count).toFixed(2)`.
    - For each frame: `[cli, 'ffmpeg', '-y', '-loglevel', 'error', '-ss', t, '-i', <video abs>, '-frames:v', '1', <frame abs>]`.
    - Files are `runs/<runId>/frames/frame-<n>.jpg` (n starts at 1). Returns repo-relative paths.
  - `finishRun(root, deps): { status: 'success' | 'failed', output, warnings: string[], error: string | null }`. Only the file `out/<runId>.mp4` is checked.
    - Failure cases, which go through the same path as `failRun` (without pruning):
      - missing file → `File video out/${runId}.mp4 tidak ada.`
      - size 0 → `File video kosong (0 byte).`
      - probe error → `Video tidak bisa dibaca: ${message}`
      - duration ≤ 0 → `Durasi video 0 detik.`
    - On success:
      - Warnings: `Durasi ${d} dtk, target ${t} dtk.` when `|d − t| / t > 0.1`, where `d = durationSeconds.toFixed(1)` with `.` replaced by `,`. Also `Resolusi ${w}×${h}, alur meminta ${W}×${H}.`
      - `run.output = { file: 'out/<runId>.mp4', durationSeconds, width, height, fps, sizeBytes }`.
      - Close the open stage, append `done` (already closed), set `status: 'success'` and `endedAt`.
      - Update `project.json`: `phase: 'complete'`, `latestRun`, `updated`, plus the session `Run ${runId} sukses (${d} dtk).`
      - Clear the active run.
      - Finally `fs.rmSync(<proj>/node_modules, { recursive: true, force: true })`. If that fails, add the warning `node_modules tidak bisa dihapus: ${message}`.
  - CLI adds `install`, `render`, `stills [--count N]` (default 4), and `finish`. `finish` exits 1 when the status is `failed`.

- [ ] **Step 1: Tulis tes yang gagal.** Fake `spawnSync` mencatat panggilan dan mengembalikan `{ status }` yang diatur. Fake `probe` mengembalikan nilai yang diatur. Setiap tes memulai run lewat `startRun` di `makeFixtureRepo()` dan membuat `projects/<slug>/node_modules/@remotion/cli/remotion-cli.js` kosong.

```js
it('install memanggil npm-cli dengan argumen tetap', () => {
  const { root, calls, d } = setup({ spawnStatus: 0 });
  installDeps(root, d);
  expect(calls[0]).toMatchObject({ cmd: process.execPath, args: [npmCliPath(), 'install', '--no-audit', '--no-fund', '--prefer-offline'], cwd: projAbs(root) });
  expect(() => installDeps(root, { ...d, spawnSync: () => ({ status: 1 }) })).toThrow(expect.objectContaining({ code: 'INSTALL_FAILED' }));
});
it('render menyusun argumen dari script template dan memakai browser bersama', () => {
  const { root, calls, d, runId } = setup({ spawnStatus: 0 });
  renderVideo(root, d);
  expect(calls[0].args).toEqual([cliAbs(root), 'render', 'src/index.ts', 'Rem', `out/${runId}.mp4`]);
  const exe = placeExe(path.join(root, '.dashboard', 'browser', 'chrome-headless-shell', 'win64', 'x'));
  renderVideo(root, d);
  expect(calls[1].args.at(-1)).toBe(`--browser-executable=${exe}`);
});
it('render pertama menyalin browser ke folder bersama', () => {
  const { root, d } = setup({ spawnStatus: 0 });
  placeExe(path.join(projAbs(root), 'node_modules', '.remotion', 'chrome-headless-shell', 'win64', 'x'));
  renderVideo(root, d);
  expect(findBrowserExe(sharedBrowserDir(root))).not.toBeNull();
});
it('render gagal tidak mengubah status run', () => {
  const { root, d, runId } = setup({ spawnStatus: 1 });
  expect(() => renderVideo(root, d)).toThrow(expect.objectContaining({ code: 'RENDER_FAILED' }));
  expect(readRun(root, 'halo', runId).value.status).toBe('running');
});
it('stills mengambil frame di tengah tiap segmen', () => {
  const { root, calls, d, runId } = setup({ spawnStatus: 0, probe: { durationSeconds: 20, width: 1920, height: 1080, fps: 30, sizeBytes: 9 } });
  writeVideo(root, runId, 'xx');
  const r = extractStills(root, 4, d);
  expect(calls.map(c => c.args[c.args.indexOf('-ss') + 1])).toEqual(['2.50', '7.50', '12.50', '17.50']);
  expect(r.frames).toEqual([1, 2, 3, 4].map(n => `projects/halo/runs/${runId}/frames/frame-${n}.jpg`));
});
it('finish sukses menulis output, menutup run, dan menghapus node_modules', () => {
  const { root, d, runId } = setup({ probe: { durationSeconds: 28, width: 1920, height: 1080, fps: 30, sizeBytes: 1000 } });
  writeVideo(root, runId, 'data');
  expect(finishRun(root, d)).toMatchObject({ status: 'success', warnings: [], error: null });
  const run = readRun(root, 'halo', runId).value;
  expect(run).toMatchObject({ status: 'success', stage: 'done', output: { file: `out/${runId}.mp4`, durationSeconds: 28 } });
  expect(readJson(path.join(projAbs(root), 'project.json')).value).toMatchObject({ phase: 'complete', latestRun: runId });
  expect(readActiveRun(root)).toBeNull();
  expect(fs.existsSync(path.join(projAbs(root), 'node_modules'))).toBe(false);
});
it('finish menolak file lama/kosong', () => {
  const { root, d, runId } = setup({ probe: { durationSeconds: 28, width: 1920, height: 1080, fps: 30, sizeBytes: 1 } });
  fs.mkdirSync(path.join(projAbs(root), 'out'), { recursive: true }); fs.writeFileSync(path.join(projAbs(root), 'out', 'rem.mp4'), 'lama');
  expect(finishRun(root, d)).toMatchObject({ status: 'failed', error: `File video out/${runId}.mp4 tidak ada.` });
  const { root: r2, d: d2, runId: id2 } = setup({});
  writeVideo(r2, id2, '');
  expect(finishRun(r2, d2)).toMatchObject({ status: 'failed', error: 'File video kosong (0 byte).' });
});
it('finish memberi peringatan durasi dan resolusi', () => {
  const { root, d, runId } = setup({ probe: { durationSeconds: 20, width: 1280, height: 720, fps: 30, sizeBytes: 5 } });
  writeVideo(root, runId, 'data');
  expect(finishRun(root, d)).toMatchObject({ status: 'success',
    warnings: ['Durasi 20,0 dtk, target 30 dtk.', 'Resolusi 1280×720, alur meminta 1920×1080.'] });
});
```

Helper lokal di file tes: `setup({ spawnStatus, probe })` starts a run with topic `'Halo'` and returns `{ root, calls, d, runId }`. `projAbs(root)` returns `projects/halo`, `cliAbs(root)` returns the remotion-cli.js path, `placeExe(dir)` creates the browser exe, and `writeVideo(root, runId, content)` writes `out/<runId>.mp4`.

- [ ] **Step 2: Jalankan tes, pastikan gagal.** Run: `npx vitest run core/run-render.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implementasi** `npmCliPath`, `installDeps`, `renderVideo`, `extractStills`, `finishRun`, dan subperintah CLI-nya.
- [ ] **Step 4: Jalankan semua tes, pastikan lulus.** Run: `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat(dashboard): Add install, render, stills and finish to run CLI"`

### Task 8: Hook pencatat event

**Files:**
- Create: `dashboard/core/hook-events.mjs`, `dashboard/bin/hook.mjs`
- Test: `dashboard/core/hook-events.test.mjs`

**Interfaces:**
- Consumes: `toRepoRelative`, `cliRoot` (T1); `appendJsonLine`, `readJson`, `writeJsonAtomic` (T2); `readActiveRun`, `writeActiveRun`, `readRun`, `writeRun`, `sessionEventsPath` (T6). Node built-ins only.
- Produces:
  - `stripRtk(command: string): string` removes a leading `rtk ` or `rtk proxy `.
  - `toEvent(payload, root, now): Event | null`. Every event has `ts: now.toISOString()`, `sessionId: session_id`, `runId: null`, `tool: tool_name ?? null`, and `ok: null` unless the table says otherwise. Mapping (fixed):

| `hook_event_name` | Tool | Event |
|---|---|---|
| UserPromptSubmit | – | `{ type: 'prompt', summary: prompt.slice(0, 500) }` |
| PreToolUse | Bash | `{ type: 'command', phase: 'start', toolUseId, summary: stripRtk(command).slice(0, 500) }` |
| PreToolUse | Agent | `{ type: 'agent', phase: 'start', toolUseId, summary: description }` |
| PreToolUse | lainnya | `null` |
| PostToolUse | Bash | `{ type: 'command', phase: 'end', ok: true, toolUseId, summary, detail: { durationMs: duration_ms } }` |
| PostToolUse | Skill | `{ type: 'skill', ok: true, summary: tool_input.skill }` |
| PostToolUse | Write, Edit, MultiEdit, NotebookEdit | `{ type: 'file', ok: true, summary: toRepoRelative(root, file_path ?? notebook_path) ?? file_path }` |
| PostToolUse | Agent | `{ type: 'agent', phase: 'end', ok: true, toolUseId, summary: description }` |
| PostToolUse | lainnya | `{ type: 'tool', ok: true, summary: tool_name }` |
| PostToolUseFailure | apa saja | same as PostToolUse, but with `ok: false` and `error` = first line of `error` |
| Notification | – | `{ type: 'notification', summary: message, detail: { notificationType: notification_type } }` |
| Stop | – | `{ type: 'stop', ok: true, detail: { backgroundTasks: background_tasks?.length ?? 0 } }` |
| StopFailure | – | `{ type: 'stop', ok: false, error }` |
| SessionStart / SessionEnd | – | `{ type: 'session-start', detail: { source } }` / `{ type: 'session-end', detail: { reason } }` |
| lainnya | – | `null` |

  - `hookMain(root, stdinText, now): void` never throws. Invalid JSON or any other error is appended as one line to `.dashboard/hook-errors.log`.
    - Binding rule: the active run exists, `active.sessionId === null`, and the event has `type === 'command'`, `phase === 'end'`, and `summary` matching `/run\.mjs["']?\s+start\b/`. Then `active.sessionId` and `run.json.sessionId` are set to the event's sessionId.
    - The event gets `runId = active.runId` when the active run is bound to the same session (including binding that just happened).
    - The event is appended to `sessionEventsPath(root, sessionId)`.
  - `bin/hook.mjs` reads all of stdin, calls `hookMain(cliRoot(import.meta.url), text, new Date())`, then always `process.exit(0)`.

- [ ] **Step 1: Tulis tes yang gagal.** Buat satu tes per baris tabel pemetaan dengan payload minimal, plus tes di bawah ini (`hookBin` = path absolut `dashboard/bin/hook.mjs`):

```js
const now = new Date('2026-10-24T01:53:05.120Z');
it('UserPromptSubmit dipotong 500 karakter', () => {
  expect(toEvent({ hook_event_name: 'UserPromptSubmit', session_id: 's1', prompt: 'x'.repeat(2000) }, '/r', now).summary).toHaveLength(500);
});
it('perintah Bash membuang awalan rtk', () => {
  expect(toEvent({ hook_event_name: 'PreToolUse', session_id: 's1', tool_name: 'Bash', tool_use_id: 't1',
    tool_input: { command: 'rtk npm run render' } }, '/r', now)).toMatchObject({ type: 'command', phase: 'start', summary: 'npm run render', toolUseId: 't1' });
});
it('kegagalan tool memakai baris pertama error', () => {
  expect(toEvent({ hook_event_name: 'PostToolUseFailure', session_id: 's1', tool_name: 'Bash',
    tool_input: { command: 'npm test' }, error: 'Exit code 1\nError: x' }, '/r', now)).toMatchObject({ type: 'command', ok: false, error: 'Exit code 1' });
});
it('event file memakai path relatif dengan /', () => {
  const root = makeTempRoot();
  expect(toEvent({ hook_event_name: 'PostToolUse', session_id: 's1', tool_name: 'Write',
    tool_input: { file_path: path.join(root, 'projects', 'a', 'VOICEOVER-SCRIPT.md') } }, root, now))
    .toMatchObject({ type: 'file', summary: 'projects/a/VOICEOVER-SCRIPT.md', ok: true });
});
it('hookMain mengikat sesi ke run aktif lewat perintah start', () => {
  const root = makeFixtureRepo();
  const r = startRun(root, { flow: 'contoh-penjelasan', topic: 'Halo' }, { ...defaultDeps, claudeVersion: () => null });
  hookMain(root, JSON.stringify({ hook_event_name: 'PostToolUse', session_id: 's1', tool_name: 'Bash',
    tool_input: { command: 'node dashboard/bin/run.mjs start --request abc' } }), now);
  expect(readActiveRun(root).sessionId).toBe('s1');
  expect(readRun(root, 'halo', r.runId).value.sessionId).toBe('s1');
  expect(readJsonLines(sessionEventsPath(root, 's1')).items[0]).toMatchObject({ runId: r.runId, type: 'command' });
  hookMain(root, JSON.stringify({ hook_event_name: 'PostToolUse', session_id: 's2', tool_name: 'Read' }), now);
  expect(readActiveRun(root).sessionId).toBe('s1');
  expect(readJsonLines(sessionEventsPath(root, 's2')).items[0].runId).toBeNull();
});
it('hookMain tidak pernah melempar dan bin/hook.mjs selalu keluar 0', () => {
  const root = makeFixtureRepo();
  expect(() => hookMain(root, '{bukan json', now)).not.toThrow();
  expect(fs.existsSync(path.join(root, '.dashboard', 'hook-errors.log'))).toBe(true);
  const r = spawnSync(process.execPath, [hookBin], { input: 'sampah', env: { ...process.env, VIDEO_REPO_ROOT: root } });
  expect(r.status).toBe(0);
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal.** Run: `npx vitest run core/hook-events.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implementasi `hook-events.mjs` dan `bin/hook.mjs`.**
- [ ] **Step 4: Jalankan tes, pastikan lulus.** Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat(dashboard): Log Claude Code hook events per session"`

### Task 9: Integrasi Claude Code dan uji end-to-end M0

**Files:**
- Create: `flows/contoh-penjelasan/flow.json` (isinya sama persis dengan `dashboard/core/fixtures/flow.valid.json`), `.claude/commands/buat-video.md`
- Modify: `.claude/settings.json` (sebelumnya `{}`), `CLAUDE.md`, `lib/project/types.ts`
- Test: `dashboard/core/integration.test.mjs`

**Interfaces:**
- Consumes: semua CLI dari T6–T8 dan `parseFlow`/`checkFlowAgainstRepo`/`repoContextForValidation`.
- Produces: command `/buat-video` serta hook dan izin proyek yang dipakai di task-task berikutnya.

- [ ] **Step 1: Tulis tes yang gagal** (`real` = root repo asli)

```js
it('alur contoh di repo valid terhadap repo asli', () => {
  const flow = readJson(path.join(real, 'flows', 'contoh-penjelasan', 'flow.json')).value;
  expect(parseFlow(flow).ok).toBe(true);
  expect(checkFlowAgainstRepo(flow, repoContextForValidation(real))).toEqual([]);
});
it('settings proyek memasang hook dan izin', () => {
  const s = readJson(path.join(real, '.claude', 'settings.json')).value;
  expect(s.permissions.allow).toEqual(expect.arrayContaining(['Bash(node dashboard/bin/run.mjs *)', 'Edit(/projects/**)']));
  for (const ev of ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'Notification', 'Stop', 'StopFailure', 'SessionStart', 'SessionEnd'])
    expect(JSON.stringify(s.hooks[ev])).toContain('dashboard/bin/hook.mjs');
});
it('command /buat-video memuat aturan inti', () => {
  const t = fs.readFileSync(path.join(real, '.claude', 'commands', 'buat-video.md'), 'utf8');
  for (const s of ['$ARGUMENTS', 'run.mjs start --request', 'run.mjs start --retry', 'run.mjs finish', 'run.mjs fail', 'jangan memulai brainstorming'])
    expect(t).toContain(s);
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal.** Run: `npx vitest run core/integration.test.mjs`. Expected: FAIL.

- [ ] **Step 3: Tulis `.claude/settings.json`** (isi persis)

```json
{
  "permissions": {
    "allow": [
      "Bash(node dashboard/bin/run.mjs *)",
      "Bash(rtk node dashboard/bin/run.mjs *)",
      "Edit(/projects/**)"
    ]
  },
  "hooks": {
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/dashboard/bin/hook.mjs"], "timeout": 10 }] }],
    "PreToolUse": [{ "matcher": "Bash|Agent", "hooks": [{ "type": "command", "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/dashboard/bin/hook.mjs"], "timeout": 10 }] }],
    "PostToolUse": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/dashboard/bin/hook.mjs"], "timeout": 10 }] }],
    "PostToolUseFailure": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/dashboard/bin/hook.mjs"], "timeout": 10 }] }],
    "Notification": [{ "hooks": [{ "type": "command", "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/dashboard/bin/hook.mjs"], "timeout": 10 }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/dashboard/bin/hook.mjs"], "timeout": 10 }] }],
    "StopFailure": [{ "hooks": [{ "type": "command", "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/dashboard/bin/hook.mjs"], "timeout": 10 }] }],
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/dashboard/bin/hook.mjs"], "timeout": 10 }] }],
    "SessionEnd": [{ "hooks": [{ "type": "command", "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/dashboard/bin/hook.mjs"], "timeout": 10 }] }]
  }
}
```

- [ ] **Step 4: Tulis `.claude/commands/buat-video.md`** (isi persis)

````markdown
---
description: Buat video dari alur dashboard (req=<id>, perbaiki=<runId>, atau <id-alur> "<topik>")
argument-hint: req=<id> | perbaiki=<runId> | <id-alur> "<topik>"
---

# /buat-video

Argumen: $ARGUMENTS

Kamu menjalankan **alur yang sudah disetujui pemiliknya** di dashboard. Ini bukan sesi brainstorming: jangan memulai brainstorming, jangan mengajukan pertanyaan klarifikasi, dan jangan meminta konfirmasi rencana. Satu-satunya jeda yang diizinkan adalah review naskah bila alur memintanya (`approval: "script-review"`). Laporkan semuanya dalam Bahasa Indonesia.

## Aturan wajib
- Jalankan semua perintah dari root repo. Setiap langkah pipeline lewat `node dashboard/bin/run.mjs <subperintah>`. Jangan memanggil `npm`, `npx`, atau `remotion` langsung, dan jangan menambahkan prefix apa pun (termasuk `rtk`) di depan `node`.
- Awali setiap tahap dengan `node dashboard/bin/run.mjs stage <tahap>`.
- Ubah file hanya di dalam `projects/<project>/`. Jangan mengubah `templates/`, `lib/`, `brands/`, `flows/`, atau `examples/`.
- Jika sebuah langkah gagal dan tidak bisa kamu perbaiki dalam 2 percobaan, jalankan `node dashboard/bin/run.mjs fail --reason "<penjelasan singkat>"` lalu berhenti. Jangan pernah berhenti tanpa `finish` atau `fail`.
- Untuk `install` dan `render`, beri perintah Bash timeout 600000 ms.

## Langkah
1. Mulai run sesuai argumen:
   - `req=<id>`: `node dashboard/bin/run.mjs start --request <id>`
   - `perbaiki=<runId>`: `node dashboard/bin/run.mjs start --retry <runId>`. Baca juga `error` di `run.json` milik run yang gagal, lalu lanjutkan dari file proyek yang sudah ada.
   - selain itu: `node dashboard/bin/run.mjs start --flow <id-alur> --topic "<topik>"`

   Simpan `project` dan `runId` dari output JSON. Baca `projects/<project>/runs/<runId>/run.json` (topik, catatan) dan `projects/<project>/runs/<runId>/flow.json` (alur yang berlaku).
2. Muat setiap skill di `flow.skills` dengan tool Skill.
3. Pelajari `flow.references`:
   - `example` atau `project`: baca sumbernya (`examples/<id>/src`, `projects/<id>/src`).
   - `template`: baca `templates/<id>`.
   - `transition` atau `component`: cari di `_internal/toolkit-registry.json`.
   - `brand`: baca `brands/<id>/brand.json`.
   - `link`: anggap sebagai catatan saja, jangan dibuka.
4. `stage script`:
   - Tulis `projects/<project>/VOICEOVER-SCRIPT.md` berisi naskah per scene sesuai `flow.scenes` (label, goal, rules, durationSeconds, narration), `flow.style`, `flow.language`, dan catatan permintaan.
   - Isi config template sesuai naskah. Untuk `sprint-review`, isi `src/config/sprint-config.ts` dengan `demos: []` bila tidak ada aset demo, dan buat durasi total sama dengan jumlah durasi scene.
   - Isi `scenes` di `project.json` sesuai format toolkit (`lib/project/types.ts`).
5. Bila `flow.approval` adalah `script-review`: jalankan `node dashboard/bin/run.mjs wait --reason "review naskah"`, tampilkan ringkasan naskah di chat, minta persetujuan, lalu tunggu. Setelah disetujui, lanjutkan.
6. `stage assets` dan `stage audio` hanya bila alur meminta aset, atau bila ada `flow.audio.*.enabled` yang bernilai true.
7. `stage compose`: sesuaikan komponen dan tema di salinan proyek dengan brand `flow.brand`, `visualHint`, dan `transitionOut` tiap scene.
8. `node dashboard/bin/run.mjs install`
9. `stage render`, lalu `node dashboard/bin/run.mjs render`.
10. `stage review`, lalu `node dashboard/bin/run.mjs stills --count 4`. Lihat setiap gambar yang dihasilkan. Bila ada teks terpotong, elemen bertumpuk, atau frame kosong, perbaiki lalu ulangi langkah 9–10 (maksimal 2 kali).
11. `node dashboard/bin/run.mjs finish`. Laporkan path video, durasi, dan peringatan.
````

- [ ] **Step 5: Tambah bagian ke `CLAUDE.md`** (isi persis, di akhir file)

```markdown
## Dashboard & /buat-video

Dashboard lokal ada di `dashboard/`. Jalankan `cd dashboard && npm run dev`, lalu buka http://127.0.0.1:3210. Video dari alur dibuat dengan `/buat-video`; aturan lengkapnya ada di `.claude/commands/buat-video.md`. Setiap langkah pipeline lewat `node dashboard/bin/run.mjs <start|stage|wait|install|render|stills|finish|fail|status>`, dan jalankan dari folder repo utama, bukan worktree. Data runtime ada di `.dashboard/` (diabaikan git). Spesifikasi: `docs/superpowers/specs/2026-10-24-dashboard-video-generation-prd.md`.
```

- [ ] **Step 6: Tambah field opsional di `lib/project/types.ts`** di dalam `interface VideoProject`, setelah `sessions`:

```ts
  /** Alur dashboard yang dipakai (flows/<id>), bila dibuat lewat /buat-video */
  flow?: string;
  /** Topik dari permintaan dashboard */
  topic?: string;
  /** Run terakhir di projects/<name>/runs/ */
  latestRun?: string;
```

- [ ] **Step 7: Salin alur contoh lalu jalankan tes.** Salin `dashboard/core/fixtures/flow.valid.json` ke `flows/contoh-penjelasan/flow.json`. Run: `npx vitest run`. Expected: PASS.

- [ ] **Step 8: Uji end-to-end lewat Claude** (dari root repo; jalankan di latar belakang dengan batas waktu 15 menit)

```bash
claude -p '/buat-video contoh-penjelasan "Cara kerja pelangi"' --output-format json --permission-prompts none > .dashboard/e2e-1.json
```

Hasil yang diharapkan:
- `.dashboard/e2e-1.json` berisi `"is_error": false` dan `permission_denials` kosong (JMB-10). Bila ada denial, tambahkan aturan izin minimal yang cocok di `.claude/settings.json`, lalu ulangi.
- `projects/cara-kerja-pelangi/runs/<runId>/run.json` berstatus `success`, dengan `output.durationSeconds` antara 25 dan 33 dan `output.width` 1920.
- `projects/cara-kerja-pelangi/out/<runId>.mp4` ada, sedangkan `projects/cara-kerja-pelangi/node_modules` tidak ada.
- `.dashboard/browser/` berisi `chrome-headless-shell`.
- `.dashboard/events/<sessionId>.jsonl` memuat event `skill` `remotion-official`, event `command` yang summary-nya mengandung `run.mjs render`, dan event `stop`. `run.json.sessionId` sama dengan `<sessionId>`.
- Bila file event tidak muncul sama sekali, ganti setiap entri hook ke shell form `"command": "node \"${CLAUDE_PROJECT_DIR}/dashboard/bin/hook.mjs\""` (tanpa `args`), lalu ulangi.

- [ ] **Step 9: Uji perbaikan** (JMB-08)

```bash
node dashboard/bin/run.mjs start --flow contoh-penjelasan --topic "Uji perbaikan"
node dashboard/bin/run.mjs fail --reason "uji paksa gagal"
claude -p '/buat-video perbaiki=<runId dari output start>' --output-format json --permission-prompts none > .dashboard/e2e-2.json
```

Hasil yang diharapkan: proyek `uji-perbaikan` punya dua run. Run pertama `failed`, run kedua `success` dengan `retryOf` sama dengan runId pertama.

- [ ] **Step 10: Commit:** `git add flows .claude CLAUDE.md lib/project/types.ts dashboard && git commit -m "feat(dashboard): Wire /buat-video command, hooks and permissions"`

---

## M1: Kerangka & tampilan baca

### Task 10: Kerangka aplikasi dan label

**Files:**
- Create: `dashboard/core/labels.mjs`, `dashboard/lib/root.ts`, `dashboard/lib/media.ts`, `dashboard/components/{app-nav,auto-refresh,status-badge,copy-button,markdown}.tsx`, placeholder `page.tsx` untuk `app/{alur,video,eksekusi,referensi,skill,cara-kerja,pengaturan}`, `.claude/launch.json`
- Modify: `dashboard/app/layout.tsx`, `dashboard/app/page.tsx`
- Test: `dashboard/core/labels.test.mjs`

**Interfaces:**
- Produces:
  - `DISPLAY_STATUSES = ['running','waiting','waiting-permission','stopped','success','failed','cancelled','abandoned']`
  - `STATUS_LABELS = { running: 'Berjalan', waiting: 'Menunggu Anda', 'waiting-permission': 'Menunggu izin Anda', stopped: 'Claude berhenti', success: 'Sukses', failed: 'Gagal', cancelled: 'Dibatalkan', abandoned: 'Terhenti' }`
  - `STAGE_LABELS = { setup: 'Persiapan', script: 'Naskah', assets: 'Aset', audio: 'Audio', compose: 'Komposisi', qc: 'QC', render: 'Render', review: 'Review visual', done: 'Selesai' }`
  - `PHASE_LABELS = { planning: 'Perencanaan', assets: 'Aset', audio: 'Audio', editing: 'Penyuntingan', rendering: 'Render', complete: 'Selesai' }`
  - `EVENT_LABELS = { prompt: 'Prompt', skill: 'Skill', command: 'Perintah', file: 'File', agent: 'Subagent', tool: 'Tool', notification: 'Notifikasi', stop: 'Berhenti', 'session-start': 'Sesi mulai', 'session-end': 'Sesi selesai', stage: 'Tahap' }`
  - `ROOT: string` (`lib/root.ts`) = `process.env.VIDEO_REPO_ROOT ?? path.resolve(process.cwd(), '..')`
  - `mediaUrl(repoRelPath: string, opts?: { download?: boolean }): string` returns `/api/media/` + each segment through `encodeURIComponent`, joined with `/`, plus `?download=1` when requested.
  - `<AutoRefresh intervalMs={2000} />` (client) calls `router.refresh()` only while `document.visibilityState === 'visible'`.
  - `<StatusBadge status={DisplayStatus} />` shows icon + label. Colors: running blue; waiting, waiting-permission, and stopped amber; success green; failed and abandoned red; cancelled gray.
  - `<CopyButton text={string} label="Salin" />` uses `navigator.clipboard.writeText` and announces "Tersalin" through `aria-live="polite"`.
  - `<Markdown source={string} />` renders with react-markdown + remark-gfm, without raw HTML.
  - Navigation (order, label, route): Beranda `/`, Alur `/alur`, Video `/video`, Eksekusi `/eksekusi`, Referensi Desain `/referensi`, Skill & Tools `/skill`, Cara Kerja `/cara-kerja`, Pengaturan `/pengaturan`. The active page is marked with `aria-current="page"`.

- [ ] **Step 1: Tulis tes yang gagal**

```js
it('setiap status, tahap, fase, dan jenis event punya label', () => {
  expect(Object.keys(STATUS_LABELS).sort()).toEqual([...DISPLAY_STATUSES].sort());
  for (const s of STAGES) expect(STAGE_LABELS[s]).toBeTruthy();
  for (const p of Object.values(PHASE_BY_STAGE)) expect(PHASE_LABELS[p]).toBeTruthy();
  for (const t of [...EVENT_TYPES, 'stage']) expect(EVENT_LABELS[t]).toBeTruthy();
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal.** Lalu implementasi `labels.mjs`, dan jalankan lagi sampai PASS.
- [ ] **Step 3: Pasang shadcn**

```bash
cd dashboard
npx shadcn@4.22.1 init --defaults --yes
npx shadcn@4.22.1 add button card badge tabs input textarea select table dialog label checkbox separator --yes
```

- [ ] **Step 4: Buat layout dan komponen.**
  - `app/layout.tsx`: `<html lang="id">`, sidebar `AppNav`, judul "Dashboard Video", dan `export const dynamic = 'force-dynamic'`.
  - Pastikan `tsconfig.json` memuat `"allowJs": true`.
  - Halaman placeholder berisi `<h1>` sesuai label menu.
- [ ] **Step 5: Tulis `.claude/launch.json`**

```json
{ "version": "0.0.1", "configurations": [ { "name": "dashboard", "runtimeExecutable": "npm", "runtimeArgs": ["--prefix", "dashboard", "run", "dev"], "port": 3210 } ] }
```

- [ ] **Step 6: Verifikasi**
  - `npm run build` keluar dengan kode 0.
  - Jalankan `npm run dev`, lalu `curl -s http://127.0.0.1:3210/` mengandung "Referensi Desain".
  - `netstat -ano | findstr :3210` hanya menampilkan `127.0.0.1:3210` LISTENING (NFR-01).
- [ ] **Step 7: Commit:** `git commit -m "feat(dashboard): Add app shell, navigation and shared UI pieces"`

### Task 11: Data proyek dan endpoint media

**Files:**
- Create: `dashboard/core/projects.mjs`, `dashboard/core/http-range.mjs`, `dashboard/app/api/media/[...path]/route.ts`
- Test: `dashboard/core/projects.test.mjs`, `dashboard/core/http-range.test.mjs`

**Interfaces:**
- Consumes: `readJson`, `runPaths`, `readRun`, `resolveInside`, `ROOT`.
- Produces:
  - `parseRange(header: string | null, size: number): { start, end } | null | 'invalid'`
  - `contentTypeFor(file): string | null`: `mp4`→`video/mp4`, `webm`→`video/webm`, `jpg`/`jpeg`→`image/jpeg`, `png`→`image/png`, `webp`→`image/webp`, `gif`→`image/gif`, `svg`→`image/svg+xml`; anything else → null.
  - `MEDIA_ROOTS = ['projects', 'examples', 'brands', 'flows', 'references']`
  - `listProjectRuns(root, slug): { runId, run: object | null, corrupt: boolean }[]`, sorted by runId descending.
  - `listProjects(root): ProjectSummary[]`, where `ProjectSummary = { slug, title, flow: string | null, template, brand, phase, updated, latestRunId: string | null, latestStatus: string | null, video: VideoInfo | null, thumbnail: string | null, hasDeps: boolean, corrupt: boolean }` and `VideoInfo = { file, runId: string | null, durationSeconds, width, height, fps, sizeBytes }` (numbers may be `null`).
    - `title` = `topic ?? name ?? slug`.
    - `video` = output of the newest successful run (`projects/<slug>/out/<runId>.mp4`); otherwise the newest `out/*.mp4` by mtime with null metadata.
    - `thumbnail` = `projects/<slug>/runs/<runId>/frames/frame-1.jpg` when it exists.
    - Folders whose names start with `.` are skipped. Sorted by `updated` descending.
  - `readProjectDetail(root, slug): ProjectDetail | null` = ProjectSummary + `{ script: string | null, scenes: { id, label, durationSeconds, narration }[], flowSnapshot: object | null, versions: VideoInfo[], runs: { runId, status, startedAt, endedAt, retryOf }[], sessions: { date, summary }[] }`. `scenes` comes from `project.json` when it is non-empty, otherwise from the latest run's flow snapshot.
  - Route `GET /api/media/[...path]` (Next 16: `params` is a Promise):
    - Return 404 when the first segment is not in `MEDIA_ROOTS`, when `resolveInside` throws, when `contentTypeFor` is null, or when the file does not exist.
    - `'invalid'` → 416 with `Content-Range: bytes */<size>`. A valid range → 206 with `Content-Range` and `Content-Length`. No range header → 200.
    - Always send `Accept-Ranges: bytes`. `?download=1` adds `Content-Disposition: attachment; filename="<basename>"`.
    - Body: `Readable.toWeb(fs.createReadStream(file, { start, end }))`.

- [ ] **Step 1: Tulis tes yang gagal**

```js
it('parseRange', () => {
  expect(parseRange(null, 1000)).toBeNull();
  expect(parseRange('bytes=0-', 1000)).toEqual({ start: 0, end: 999 });
  expect(parseRange('bytes=100-199', 1000)).toEqual({ start: 100, end: 199 });
  expect(parseRange('bytes=-200', 1000)).toEqual({ start: 800, end: 999 });
  expect(parseRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 });
  for (const bad of ['bytes=1000-', 'bytes=0-1,5-6', 'items=0-1']) expect(parseRange(bad, 1000)).toBe('invalid');
});
it('listProjects: alur, tanpa alur, dan rusak', () => {
  const root = makeFixtureRepo(); const d = testDeps({ probe: { durationSeconds: 28, width: 1920, height: 1080, fps: 30, sizeBytes: 4 } });
  const a = startRun(root, { flow: 'contoh-penjelasan', topic: 'Alpha' }, d);
  writeVideo(root, 'alpha', a.runId, 'data'); placeFrame(root, 'alpha', a.runId); finishRun(root, d);
  writeJsonAtomic(path.join(root, 'projects', 'beta', 'project.json'), { name: 'beta', template: 'sprint-review', brand: 'default', phase: 'complete', updated: '2026-10-01T00:00:00.000Z', scenes: [], sessions: [] });
  fs.mkdirSync(path.join(root, 'projects', 'beta', 'out')); fs.writeFileSync(path.join(root, 'projects', 'beta', 'out', 'x.mp4'), 'v');
  fs.mkdirSync(path.join(root, 'projects', 'gamma')); fs.writeFileSync(path.join(root, 'projects', 'gamma', 'project.json'), '{');
  fs.mkdirSync(path.join(root, 'projects', '.trash'));
  const list = listProjects(root);
  expect(list.map(p => p.slug).sort()).toEqual(['alpha', 'beta', 'gamma']);
  expect(list.find(p => p.slug === 'alpha')).toMatchObject({ title: 'Alpha', flow: 'contoh-penjelasan', latestStatus: 'success',
    video: { file: `projects/alpha/out/${a.runId}.mp4`, durationSeconds: 28 }, thumbnail: `projects/alpha/runs/${a.runId}/frames/frame-1.jpg` });
  expect(list.find(p => p.slug === 'beta')).toMatchObject({ flow: null, video: { file: 'projects/beta/out/x.mp4', runId: null } });
  expect(list.find(p => p.slug === 'gamma').corrupt).toBe(true);
});
it('readProjectDetail memakai scene snapshot bila project.json kosong', () => {
  const root = makeFixtureRepo(); startRun(root, { flow: 'contoh-penjelasan', topic: 'Alpha' }, testDeps());
  expect(readProjectDetail(root, 'alpha').scenes.map(s => s.id)).toEqual(['hook', 'poin', 'fakta', 'penutup']);
  expect(readProjectDetail(root, 'tidak-ada')).toBeNull();
});
```

Tambahkan helper ini ke `test-utils.mjs` (dipakai lagi di Task 15 dan 18; helper lokal di tes Task 7 boleh tetap):
- `testDeps({ probe, spawnStatus = 0 } = {})` returns `{ ...defaultDeps, now: () => new Date(2026, 9, 24, 1, 53), claudeVersion: () => '2.1.303', rand: () => 'a1b2', spawnSync: () => ({ status: spawnStatus }), probe: () => probe }`.
- `writeVideo(root, slug, runId, content)` writes `projects/<slug>/out/<runId>.mp4`.
- `placeFrame(root, slug, runId)` creates `projects/<slug>/runs/<runId>/frames/frame-1.jpg`.

- [ ] **Step 2: Jalankan tes, pastikan gagal.** Expected: FAIL.
- [ ] **Step 3: Implementasi** `http-range.mjs`, `projects.mjs`, dan route media.
- [ ] **Step 4: Jalankan tes, pastikan lulus.** Expected: PASS.
- [ ] **Step 5: Verifikasi route** (dev server menyala, proyek `cara-kerja-pelangi` dari Task 9 ada)
  - `curl -s -o NUL -w "%{http_code}" -H "Range: bytes=0-99" "http://127.0.0.1:3210/api/media/projects/cara-kerja-pelangi/out/<runId>.mp4"` mengembalikan `206`.
  - `.../api/media/..%2F.env` dan `.../api/media/.dashboard/active-run.json` mengembalikan `404`.
- [ ] **Step 6: Commit:** `git commit -m "feat(dashboard): Add project listing and ranged media endpoint"`

### Task 12: Halaman Video

**Files:**
- Create: `dashboard/components/video-card.tsx`, `dashboard/app/video/page.tsx`, `dashboard/app/video/[slug]/page.tsx`

**Interfaces:**
- Consumes: `listProjects`, `readProjectDetail` (T11), `mediaUrl`, `StatusBadge`, `Markdown`, `PHASE_LABELS` (T10).

- [ ] **Step 1: Halaman `/video`**
  - Judul "Video".
  - Filter GET `?alur=<id|tanpa>` dan `?status=<status>` berupa dua `<select>` berlabel ditambah tombol "Terapkan".
  - Grid `VideoCard`:
    - Pratinjau: thumbnail `<img alt="">` bila ada; bila tidak, `<video preload="metadata" muted>`; bila tidak ada video, kotak "Belum ada video".
    - Judul, lencana nama alur atau "Tanpa alur", label fase, status terakhir.
    - Durasi `m:ss` dan tanggal dalam format `id-ID`.
    - Item rusak tampil sebagai kartu "Data rusak" dengan slug-nya.
  - Keadaan kosong: "Belum ada video. Buat dari Beranda atau halaman Alur."
- [ ] **Step 2: Halaman `/video/[slug]`**
  - `notFound()` bila datanya null.
  - `<video controls preload="metadata">` dan tautan "Unduh" (`mediaUrl(file, { download: true })`).
  - `<dl>` berisi: Resolusi, Durasi, FPS, Ukuran (MB, 1 desimal), Template, Brand, Alur + versi (tautan ke `/alur/<id>`), dan Lama proses (`endedAt − startedAt` dari run terakhir).
  - Bagian "Naskah": Markdown, atau "Naskah belum ada." bila kosong.
  - Bagian "Scene": tabel #, Label, Durasi, Narasi.
  - Bagian "Versi": daftar video sukses beserta tanggalnya.
  - Bagian "Riwayat run": StatusBadge, waktu mulai, tautan ke `/eksekusi/<slug>/<runId>`.
  - Bagian "Riwayat sesi".
- [ ] **Step 3: Verifikasi**
  - `npm run build` lulus.
  - `/video` menampilkan kartu "Cara kerja pelangi" dengan thumbnail.
  - `/video/cara-kerja-pelangi` bisa diputar dan di-seek (tab network menunjukkan respons 206).
  - Buat sementara `projects/rusak/project.json` berisi `{`: halaman menampilkan "Data rusak" dan halaman lain tetap jalan. Hapus folder uji itu setelahnya.
- [ ] **Step 4: Commit:** `git commit -m "feat(dashboard): Add video gallery and detail pages"`

### Task 13: Referensi Desain dan Skill & Tools

**Files:**
- Create: `dashboard/components/brand-preview.tsx`, `dashboard/app/referensi/page.tsx`, `dashboard/app/skill/page.tsx`

**Interfaces:**
- Consumes: `readCatalog`, `envStatus`, `allEnvKeys` (T4), `mediaUrl`, `CopyButton` (T10).

- [ ] **Step 1: `/referensi?tab=contoh|template|brand|transisi|komponen`** (bawaan `contoh`). Tab berupa tautan dengan `aria-current`.
  - **Contoh:** deskripsi, template, kompleksitas, dan lencana selisih registry ("Terdaftar, folder tidak ada" atau "Belum terdaftar di registry"). Bila `renderedVideo` ada, tampilkan `<video controls preload="metadata">`. Bila tidak, tampilkan "Belum di-render" + `CopyButton` berisi `cd examples/<id> && npm install && npm run render`.
  - **Template:** deskripsi, status, engine ("Remotion"/"Python"), rasio, dan ukuran. Template Python diberi lencana "Belum bisa dipakai di alur v1".
  - **Brand:** `BrandPreview` menampilkan swatch tiap `colors` dengan teks hex, daftar font, contoh tipografi h1/h2/h3/body/label pada ukuran ×0,5, dan logo `<img>` bila ada.
  - **Transisi:** deskripsi, opsi, "Cocok untuk". **Komponen:** deskripsi, path.
- [ ] **Step 2: `/skill`**
  - Ringkasan di atas: "API key terisi: X dari Y" (dari `envStatus(ROOT, allEnvKeys(catalog))`).
  - Tiga tabel (Skill, Command, Tool) dengan kolom: Nama, Deskripsi, Status, Sumber ("Registry", "Folder", atau "Keduanya", plus lencana selisih), Kebutuhan (tiap envVar dengan teks "terisi" atau "kosong" ditambah ikon, serta teks `requires`), dan Dipakai (sementara "—", diisi di Task 20).
- [ ] **Step 3: Verifikasi**
  - `npm run build` lulus.
  - `/referensi?tab=template` menampilkan `concept-explainer-short` dengan lencana "Belum bisa dipakai di alur v1".
  - `/referensi` (tab contoh) menampilkan `the-space-between` dengan "Terdaftar, folder tidak ada", plus pemutar hello-world.
  - `/skill` mendaftar 13 skill toolkit.
  - Bila `.env` ada, HTML halaman tidak mengandung satu pun nilainya (cek salah satu nilai dengan grep).
- [ ] **Step 4: Commit:** `git commit -m "feat(dashboard): Add design references and skills catalog pages"`

### Task 14: Cara Kerja, Pengaturan, dan Beranda (baca)

**Files:**
- Create: `dashboard/core/health.mjs`, `dashboard/content/cara-kerja.md`, `dashboard/components/pipeline-diagram.tsx`, `dashboard/app/cara-kerja/page.tsx`, `dashboard/app/pengaturan/page.tsx`
- Modify: `dashboard/app/page.tsx`
- Test: `dashboard/core/health.test.mjs`

**Interfaces:**
- Consumes: `readCatalog`, `envStatus`, `allEnvKeys` (T4), `npmCliPath` (T7), `isGitWorktree` (T1), `findBrowserExe`, `sharedBrowserDir` (T5), `listProjects` (T11).
- Produces: `checkHealth(root, deps = { spawnSync }): Health`, where `Health = { node: string, npm: string | null, uv: string | null, claude: string | null, hooksInstalled: boolean, commandInstalled: boolean, isWorktree: boolean, sharedBrowser: boolean, env: { key, present }[] }`.
  - `uv` and `claude` versions come from `spawnSync(cmd, ['--version'], { shell: process.platform === 'win32', encoding: 'utf8', timeout: 5000 })`.
  - npm comes from `spawnSync(process.execPath, [npmCliPath(), '--version'], …)`.
  - Each version is the first `\d+\.\d+\.\d+` match; failure → null.
  - `hooksInstalled` is true when `.claude/settings.json` contains `dashboard/bin/hook.mjs`. `commandInstalled` is true when `.claude/commands/buat-video.md` exists.

- [ ] **Step 1: Tulis tes yang gagal**

```js
it('checkHealth dengan alat yang hilang', () => {
  const root = makeFixtureRepo();
  const spawnSync = (cmd, args) => cmd === 'uv' ? { status: 0, stdout: 'uv 0.11.8 (abc 2026-04-27)' }
    : cmd === 'claude' ? { error: new Error('ENOENT') } : { status: 0, stdout: '11.16.0\n' };
  expect(checkHealth(root, { spawnSync })).toMatchObject({ node: process.versions.node, npm: '11.16.0', uv: '0.11.8',
    claude: null, hooksInstalled: false, commandInstalled: false, isWorktree: false, sharedBrowser: false });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal.** Lalu implementasi `health.mjs` sampai PASS.
- [ ] **Step 3: Tulis `content/cara-kerja.md`** (Bahasa Indonesia) dengan bagian berikut, dalam urutan ini:
  1. "Gambaran": dashboard memesan, Claude membuat, dashboard menampilkan.
  2. "Syarat": buka Claude Code di folder repo utama (bukan worktree), dan jalankan dashboard dengan `cd dashboard && npm run dev`.
  3. "Tahap pipeline": tabel Tahap | Yang terjadi | Skill/tool, dengan baris:
     - Persiapan → `run.mjs start`
     - Naskah → skill `remotion-official`, `VOICEOVER-SCRIPT.md`
     - Aset & audio → opsional, tool `voiceover`/`music_gen` (butuh API key)
     - Komposisi → opsional skill `frontend-design`
     - Install → `run.mjs install`
     - Render → `run.mjs render` (Remotion, browser bersama)
     - Review visual → `run.mjs stills`
     - Selesai → `run.mjs finish` (validasi, hapus `node_modules`)
  4. "Cara memicu": mode chat aktif; tombol Generate menyusul.
  5. "Biaya": gratis dan lokal, kecuali layanan cloud ElevenLabs, Modal, RunPod, dan Ideogram. MVP berjalan tanpa suara.
  6. "Ruang disk": ±690 MB per proyek selama proses berjalan, dihapus otomatis setelah sukses; browser render 270 MB dipakai bersama.
  7. "Arti status": Berjalan, Menunggu Anda, Menunggu izin Anda, Claude berhenti, Terhenti, Gagal, Sukses.
- [ ] **Step 4: Halaman**
  - `/cara-kerja`: `PipelineDiagram` (daftar berurutan: Prompt → Persiapan → Naskah → Aset & Audio (opsional) → Komposisi → Render → Review visual → Selesai → Galeri, tiap langkah dengan keterangan pendek), lalu `<Markdown>` dari file konten.
  - `/pengaturan`:
    - Bagian "Lokasi": root repo (`ROOT`), `flows/`, `projects/`, `.dashboard/`.
    - Bagian "Kesehatan": versi Node, npm, uv, Claude, ✓/✗ dengan teks untuk hook dan command, status worktree, browser bersama, dan daftar API key terisi/kosong. Tautan "Periksa ulang" memuat ulang halaman.
    - Teks "Halaman langsung diperbarui otomatis setiap 2 detik."
  - Beranda:
    - Kartu "Mulai": "Buka Claude Code di folder repo utama, bukan worktree", path `ROOT`, dan `CopyButton`.
    - Kartu kesehatan ringkas.
    - "Video terbaru": 6 `VideoCard`.
- [ ] **Step 5: Verifikasi**
  - `npm run build` lulus.
  - Beranda menampilkan Node v24, uv 0.11.8, Claude 2.1.303, serta hook dan command ✓.
  - `/cara-kerja` menampilkan tabel tahap.
- [ ] **Step 6: Commit:** `git commit -m "feat(dashboard): Add how-it-works, settings and read-only home"`

---

## M2: Editor alur & buat video

### Task 15: Penyimpanan alur dan permintaan

**Files:**
- Create: `dashboard/core/flows.mjs`, `dashboard/core/flow-form.mjs`, `dashboard/core/requests.mjs`
- Test: `dashboard/core/flows.test.mjs`, `dashboard/core/flow-form.test.mjs`, `dashboard/core/requests.test.mjs`

**Interfaces:**
- Consumes: `parseFlow`, `checkFlowAgainstRepo`, `flowWarnings` (T3), `repoContextForValidation` (T4), `uniqueSlug`, `newRequestId` (T2), `writeJsonAtomic`, `readJson`, `requestPath`, `readRun` (T6), `listProjects` (T11).
- Produces (flows.mjs):
  - `listFlows(root): FlowSummary[]`, where `FlowSummary = { id, name, template, brand, aspectRatio, sceneCount, totalSeconds, targetSeconds, version, updatedAt, videoCount, lastUsedAt: string | null, errors: string[], warnings: string[], corrupt: boolean }`. Skips `.archive`.
  - `readFlow(root, id): { flow: object | null, errors: string[], warnings: string[], corrupt: boolean } | null`
  - `saveFlow(root, input: unknown, opts: { mode: 'create' | 'update', expectedVersion?: number }, now = new Date()): { ok: true, flow } | { ok: false, errors: string[] }`.
    - Messages: `ID alur "${id}" sudah dipakai.`, `Alur "${id}" tidak ditemukan.`, `Alur sudah diubah di tempat lain (sekarang versi ${v}). Muat ulang halaman.`
    - Sets `version` (create = 1, update = current + 1) and `updatedAt`. Validates with schema + repo check. Writes atomically.
  - `duplicateFlow(root, id, now): { ok: true, flow }` uses id `uniqueSlug(id + '-salinan')`, name `${name} (salinan)`, version 1.
  - `archiveFlow(root, id, now): { archivedTo: string }` moves the folder to `flows/.archive/${id}-${YYYYMMDDHHmmss}`.
  - `addReference(root, flowId, ref, now): { ok: true, flow } | { ok: false, errors }` skips duplicates (same `kind` plus same `id`, `path`, or `url`), then calls `saveFlow` with mode `update`.
- Produces (flow-form.mjs, pure, also used by client components):
  - `defaultFlow(template: string, brand: string, info: { width, height, aspectRatio }): object` returns a flow with one scene `{ id: 'pembuka', label: 'Pembuka', goal: '', durationSeconds: 5, rules: [], narration: false }`, target 30, language `'id'`, approval `'auto'`, all audio disabled, `references: []`, `skills: []`.
  - `moveScene(scenes, index, dir: -1 | 1): object[]` returns a new array; out-of-range moves return the input unchanged.
  - `durationSegments(scenes): { id, label, seconds, percent }[]`, with `percent` rounded to 1 decimal.
  - `VOICE_PROVIDER_KEYS = { elevenlabs: ['ELEVENLABS_API_KEY'], qwen3: ['RUNPOD_API_KEY'], '60db': ['SIXTYDB_API_KEY'] }`, `MUSIC_KEYS = ['ACEMUSIC_API_KEY']`.
- Produces (requests.mjs):
  - `createRequest(root, { flow, topic, notes }, now = new Date()): { ok: true, id, prompt } | { ok: false, errors }`.
    - Messages: `Alur "${id}" tidak ditemukan.` / `Alur "${id}" tidak valid.` (plus its error list), `Topik wajib diisi.`, `Topik maksimal 200 karakter.`, `Catatan maksimal 2000 karakter.`
    - Writes `{ id, flow, topic, notes, createdAt, status: 'baru', runId: null }`.
    - `prompt` = `/buat-video req=${id}`.
  - `retryPrompt(runId): string` returns `/buat-video perbaiki=${runId}`.
  - `repeatRequest(root, project, runId, now): ReturnType<createRequest>` creates a new request with the run's flow, topic, and notes.

- [ ] **Step 1: Tulis tes yang gagal**

```js
it('create lalu update menaikkan versi; versi basi ditolak', () => {
  const root = makeFixtureRepo(); const f = fixtureFlow({ id: 'baru', name: 'Baru' });
  expect(saveFlow(root, f, { mode: 'create' }, at('2026-10-24T03:00:00')).flow.version).toBe(1);
  const u = saveFlow(root, { ...f, name: 'Baru 2' }, { mode: 'update', expectedVersion: 1 }, at('2026-10-24T03:01:00Z'));
  expect(u.flow).toMatchObject({ version: 2, updatedAt: '2026-10-24T03:01:00.000Z' });
  expect(saveFlow(root, f, { mode: 'update', expectedVersion: 1 }).errors)
    .toEqual(['Alur sudah diubah di tempat lain (sekarang versi 2). Muat ulang halaman.']);
  expect(saveFlow(root, f, { mode: 'create' }).errors).toEqual(['ID alur "baru" sudah dipakai.']);
});
it('alur tidak valid tidak disimpan', () => {
  const root = makeFixtureRepo(); const before = fs.readFileSync(path.join(root, 'flows', 'contoh-penjelasan', 'flow.json'), 'utf8');
  const r = saveFlow(root, fixtureFlow({ template: 'pyt' }), { mode: 'update' });
  expect(r.ok).toBe(false);
  expect(fs.readFileSync(path.join(root, 'flows', 'contoh-penjelasan', 'flow.json'), 'utf8')).toBe(before);
});
it('duplikat dan arsip tanpa hapus permanen', () => {
  const root = makeFixtureRepo();
  expect(duplicateFlow(root, 'contoh-penjelasan').flow).toMatchObject({ id: 'contoh-penjelasan-salinan', version: 1, name: 'Contoh Penjelasan (salinan)' });
  const { archivedTo } = archiveFlow(root, 'contoh-penjelasan-salinan', at('2026-10-24T03:02:03'));
  expect(archivedTo).toBe('flows/.archive/contoh-penjelasan-salinan-20261024030203');
  expect(fs.existsSync(path.join(root, archivedTo, 'flow.json'))).toBe(true);
  expect(listFlows(root).map(f => f.id)).toEqual(['contoh-penjelasan']);
});
it('addReference tidak menggandakan; listFlows menghitung video dan menandai rusak', () => {
  const root = makeFixtureRepo();
  addReference(root, 'contoh-penjelasan', { kind: 'transition', id: 'zoomBlur' });
  expect(readFlow(root, 'contoh-penjelasan').flow.references.filter(r => r.id === 'zoomBlur')).toHaveLength(1);
  startRun(root, { flow: 'contoh-penjelasan', topic: 'A' }, testDeps());
  fs.mkdirSync(path.join(root, 'flows', 'rusak')); fs.writeFileSync(path.join(root, 'flows', 'rusak', 'flow.json'), '{');
  const list = listFlows(root);
  expect(list.find(f => f.id === 'contoh-penjelasan').videoCount).toBe(1);
  expect(list.find(f => f.id === 'rusak').corrupt).toBe(true);
});
it('moveScene dan durationSegments', () => {
  const s = ['a', 'b', 'c'].map(id => ({ id }));
  expect(moveScene(s, 0, -1)).toBe(s);
  expect(moveScene(s, 1, -1).map(x => x.id)).toEqual(['b', 'a', 'c']);
  expect(durationSegments(fixtureFlow().scenes).map(x => x.percent)).toEqual([14.3, 42.9, 25, 17.9]);
});
it('createRequest memvalidasi dan menulis permintaan', () => {
  const root = makeFixtureRepo();
  expect(createRequest(root, { flow: 'contoh-penjelasan', topic: '  ', notes: '' }).errors).toEqual(['Topik wajib diisi.']);
  const r = createRequest(root, { flow: 'contoh-penjelasan', topic: 'Halo', notes: 'n' });
  expect(r.id).toMatch(/^[0-9a-f]{6}$/); expect(r.prompt).toBe(`/buat-video req=${r.id}`);
  expect(readJson(requestPath(root, r.id)).value).toMatchObject({ flow: 'contoh-penjelasan', topic: 'Halo', status: 'baru', runId: null });
  expect(retryPrompt('20261024-0153-a1b2')).toBe('/buat-video perbaiki=20261024-0153-a1b2');
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal.** Expected: FAIL.
- [ ] **Step 3: Implementasi** `flows.mjs`, `flow-form.mjs`, dan `requests.mjs`.
- [ ] **Step 4: Jalankan tes, pastikan lulus.** Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat(dashboard): Add flow storage, form helpers and video requests"`

### Task 16: Editor alur

**Files:**
- Create: `dashboard/app/alur/page.tsx`, `dashboard/app/alur/baru/page.tsx`, `dashboard/app/alur/[id]/page.tsx`, `dashboard/app/alur/actions.ts`, `dashboard/components/flow-editor/{flow-form,scene-list,duration-bar,references-field,skills-field}.tsx`

**Interfaces:**
- Consumes: T15 (semua), `readCatalog`, `templateInfo`, `envStatus` (T4), `flowWarnings` (T3).
- Produces (server actions, `'use server'`):
  - `saveFlowAction(json: string, mode: 'create' | 'update', expectedVersion?: number): Promise<{ ok: true, id: string, version: number } | { ok: false, errors: string[] }>`. Invalid JSON → `['Data form tidak valid.']`.
  - `duplicateFlowAction(id: string)` redirects to `/alur/<idBaru>`.
  - `archiveFlowAction(id: string)` redirects to `/alur`.

- [ ] **Step 1: Halaman `/alur`**
  - Judul "Alur", tombol "Buat alur" ke `/alur/baru`.
  - Tabel: Nama (tautan), Template, Brand, Format, Scene, Durasi (total/target), Video dibuat, Terakhir dipakai, Status ("Tidak valid" dengan ikon bila ada error, "Peringatan" bila ada warning, "Data rusak" bila corrupt).
  - Aksi: "Duplikat" dan "Arsipkan". Arsipkan membuka Dialog konfirmasi: "Arsipkan alur <nama>? File dipindah ke flows/.archive/ dan tidak dihapus."
- [ ] **Step 2: `FlowForm` (client)** menyimpan seluruh objek alur di `useState`, lalu mengirimnya sebagai JSON ke `saveFlowAction`. Bagian, sesuai urutan:
  1. **Info:** Nama; ID (hanya saat membuat; otomatis dari `slugify(nama)`, bisa diedit); Deskripsi.
  2. **Template & brand:** select template berisi template Remotion saja (template Python tampil disabled dengan "(belum didukung)"); select brand + swatch `primary`, `primaryLight`, `textDark`, `bgLight`, `bgDark`.
  3. **Format output:** rasio, lebar×tinggi, dan fps dari `templateInfo` (hanya baca); Target durasi (angka).
  4. **Susunan scene:**
     - `DurationBar`: segmen proporsional dari `durationSegments`, teks "Total X dtk dari target Y dtk", dan peringatan `role="status"` bila selisih lebih dari 10%.
     - `SceneList`: per scene ada Label, ID, Tujuan, Durasi, Aturan (textarea satu aturan per baris), Narasi (checkbox), Petunjuk visual, dan Transisi keluar (select transisi registry + "Tidak ada").
     - Tombol Naik/Turun/Hapus dengan `aria-label` "Naikkan scene <label>", "Turunkan scene <label>", "Hapus scene <label>", serta tombol "Tambah scene".
  5. **Gaya & bahasa:** Bahasa (Indonesia/Inggris), Nada, Audiens, Aturan global.
  6. **Audio:**
     - Suara: checkbox + select provider (aktif hanya bila dicentang) + catatan "Qwen3-TTS tidak mendukung Bahasa Indonesia."
     - Musik dan Teks/caption: checkbox.
     - Bila ada audio yang aktif, tampilkan "Butuh layanan cloud/berbayar" beserta daftar key dari `VOICE_PROVIDER_KEYS`/`MUSIC_KEYS` dengan status terisi/kosong (ALR-08).
  7. **Referensi:** daftar dengan tombol hapus. Untuk menambah, pilih jenis (contoh, template, brand, transisi, komponen) + id dari katalog, atau isi URL tautan + catatan.
  8. **Skill:** checkbox untuk tiap skill di katalog.
  9. **Persetujuan:** radio "Otomatis" / "Review naskah dulu".
  10. **Catatan untuk Claude:** textarea.

  Tombol "Simpan". Error ditampilkan di atas sebagai daftar `role="alert"`. Setelah membuat, arahkan ke `/alur/<id>`. Setelah update, tampilkan "Tersimpan (versi N)". `expectedVersion` diambil dari versi saat halaman dimuat.
- [ ] **Step 3: `/alur/baru`** memakai `defaultFlow` dari template Remotion pertama dan brand `default`. **`/alur/[id]`** memakai `readFlow`; bila hasilnya null, `notFound()`.
- [ ] **Step 4: Verifikasi**
  - `npm run build` lulus.
  - Buat alur "Uji Alur": muncul `flows/uji-alur/flow.json` versi 1. Ubah target durasinya: versi menjadi 2.
  - Aktifkan suara dengan Qwen3 dan bahasa Indonesia: penyimpanan ditolak dengan pesan `Qwen3-TTS tidak mendukung bahasa "id". Pilih ElevenLabs atau matikan suara.`
  - Seluruh form bisa diisi dan disimpan hanya dengan keyboard.
  - Arsipkan "Uji Alur": foldernya pindah ke `flows/.archive/`.
- [ ] **Step 5: Commit:** `git commit -m "feat(dashboard): Add flow list and editor"`

### Task 17: Buat video dan "Pakai di alur"

**Files:**
- Create: `dashboard/components/create-video-form.tsx`, `dashboard/components/use-in-flow.tsx`, `dashboard/app/actions.ts`, `dashboard/app/referensi/actions.ts`
- Modify: `dashboard/app/page.tsx`, `dashboard/app/alur/[id]/page.tsx`, `dashboard/app/referensi/page.tsx`

**Interfaces:**
- Consumes: `createRequest`, `addReference`, `listFlows` (T15), `CopyButton` (T10).
- Produces:
  - `createRequestAction(input: { flow: string, topic: string, notes: string }): Promise<{ ok: true, id: string, prompt: string } | { ok: false, errors: string[] }>`
  - `addReferenceAction(flowId: string, ref: { kind: string, id: string }): Promise<{ ok: true, version: number } | { ok: false, errors: string[] }>`

- [ ] **Step 1: `CreateVideoForm`**
  - Select alur (yang tidak valid tampil disabled dengan "(tidak valid)"), input Topik (`maxLength` 200), textarea Catatan (`maxLength` 2000), tombol "Buat prompt".
  - Hasil: `<code>` berisi prompt + `CopyButton` + teks "Tempel di Claude Code yang dibuka di folder repo utama (bukan worktree). Pantau di halaman Eksekusi." + tautan `/eksekusi`.
  - Dipasang di Beranda, dan di `/alur/[id]` dengan alur itu sudah terpilih.
- [ ] **Step 2: `UseInFlow`** dipasang di item contoh, template, brand, transisi, dan komponen di `/referensi`: select alur + tombol "Pakai di alur". Bila berhasil, tampilkan "Ditambahkan ke <nama> (versi N)".
- [ ] **Step 3: Verifikasi**
  - `npm run build` lulus.
  - Buat prompt dari Beranda: `.dashboard/requests/<id>.json` muncul berstatus `baru`, dan tombol salin bekerja.
  - "Pakai di alur" untuk transisi `zoomBlur` pada alur yang belum memilikinya menaikkan versi alur tersebut.
- [ ] **Step 4: Commit:** `git commit -m "feat(dashboard): Add create-video prompt and use-in-flow actions"`

---

## M3: Eksekusi langsung

### Task 18: Status dan ringkasan run

**Files:**
- Create: `dashboard/core/runs.mjs`
- Test: `dashboard/core/runs.test.mjs`

**Interfaces:**
- Consumes: `readJson`, `readJsonLines` (T2), `STAGES`, `RUN_STATUSES` (T3), `run-store` (T6), `STAGE_LABELS`, `DISPLAY_STATUSES` (T10).
- Produces:
  - `runWindowEvents(root, run, now): Event[]` returns the session events (`run.sessionId`) with `ts` in `[triggerTs, run.endedAt ?? now]`. `triggerTs` is the `ts` of the last `prompt` event at or before `run.startedAt`, or `run.startedAt` when there is none.
  - `displayStatus(run, lastEvent: Event | null, lastActivity: Date, now: Date, staleMs = 900000): DisplayStatus`. Rules, checked in this order:
    1. Stored status `success`, `failed`, `cancelled`, or `abandoned` → that same status.
    2. `waiting` → `'waiting'`.
    3. lastEvent is a `notification` with `notificationType === 'permission_prompt'` → `'waiting-permission'`.
    4. lastEvent is a `stop` with `backgroundTasks === 0` → `'stopped'`.
    5. `now − lastActivity > staleMs` → `'abandoned'`.
    6. Otherwise → `'running'`.
  - `summarizeRun(events, plannedSkills): { skillsUsed, skillsPlannedNotUsed, pythonTools, filesChanged, commandCount, readCount, renderMs: number | null, lastError: { ts, summary, error } | null }`.
    - `commandCount` counts `command` events with `phase === 'end'` (including failures).
    - `readCount` counts `tool` events whose summary is `Read`, `Grep`, or `Glob`.
    - `pythonTools` come from `/uv run (?:python )?tools\/([\w-]+)\.py/`.
    - `renderMs` is the `detail.durationMs` of the last `command` end event whose summary matches `/run\.mjs\s+render/`.
  - `listRuns(root, now = new Date()): RunListItem[]` with `{ project, runId, topic, flow, trigger, status, displayStatus, stage, startedAt, endedAt, durationMs, retryOf, corrupt }`, sorted by `startedAt` descending, with corrupt runs at the end.
  - `readRunDetail(root, project, runId, now = new Date()): RunDetail | null` with `{ run, flowSnapshot, displayStatus, stages, timeline, summary, triggerPrompt: string | null, frames: string[], script: string | null }`.
    - `stages` = every `STAGES` entry as `{ name, label, state: 'done' | 'active' | 'skipped' | 'failed' | 'pending', startedAt, endedAt, durationMs }`. State rules: the current stage is `failed` when the status is `failed`; `active` when the display status is not final; a stage with `endedAt` is `done`; a stage that was never entered but has a later stage entered is `skipped`; everything else is `pending`.
    - `timeline` = events plus stage items `{ ts, type: 'stage', summary: label }`, sorted by `ts`.
    - `script` is `VOICEOVER-SCRIPT.md` when the status is `waiting`.
  - `markRunFailed(root, project, runId, reason, now): void` is allowed only when the display status is `abandoned` or `stopped`. Otherwise it throws `Run ini tidak bisa ditandai gagal karena statusnya ${STATUS_LABELS[s]}.` It sets `status: 'failed'`, `error`, `endedAt`, closes the open stage, and clears the active run when it points to this run.
  - `skillUsage(root): Record<string, { runs: number, lastUsedAt: string }>`

- [ ] **Step 1: Tulis tes yang gagal**

```js
it('displayStatus mengikuti aturan berurutan', () => {
  const now = new Date('2026-10-24T02:10:00Z'); const recent = new Date('2026-10-24T02:09:00Z'); const run = { status: 'running' };
  expect(displayStatus({ status: 'success' }, null, recent, now)).toBe('success');
  expect(displayStatus({ status: 'waiting' }, null, recent, now)).toBe('waiting');
  expect(displayStatus(run, { type: 'notification', detail: { notificationType: 'permission_prompt' } }, recent, now)).toBe('waiting-permission');
  expect(displayStatus(run, { type: 'stop', detail: { backgroundTasks: 0 } }, recent, now)).toBe('stopped');
  expect(displayStatus(run, { type: 'stop', detail: { backgroundTasks: 1 } }, recent, now)).toBe('running');
  expect(displayStatus(run, { type: 'command' }, new Date('2026-10-24T01:54:59Z'), now)).toBe('abandoned');
  expect(displayStatus(run, { type: 'command' }, new Date('2026-10-24T01:56:00Z'), now)).toBe('running');
});
it('timeline: prompt pemicu masuk, event sesi lain dan setelah selesai tidak', () => {
  const { root, project, runId } = seedRun({ startedAt: '2026-10-24T01:53:00.000Z', endedAt: '2026-10-24T02:00:00.000Z', status: 'success', sessionId: 's1',
    events: { s1: [['01:50:00', 'prompt', 'lama'], ['01:52:59', 'prompt', '/buat-video req=7f3a'], ['01:55:00', 'skill', 'remotion-official'], ['02:05:00', 'prompt', 'sesudah']],
              s2: [['01:56:00', 'skill', 'lain']] } });
  const d = readRunDetail(root, project, runId);
  expect(d.triggerPrompt).toBe('/buat-video req=7f3a');
  expect(d.timeline.filter(t => t.type !== 'stage').map(t => t.summary)).toEqual(['/buat-video req=7f3a', 'remotion-official']);
});
it('summarizeRun', () => {
  const ev = [
    { type: 'skill', summary: 'remotion-official', ok: true },
    { type: 'command', phase: 'end', summary: 'uv run tools/voiceover.py --scene-dir x', ok: true },
    { type: 'command', phase: 'end', summary: 'node dashboard/bin/run.mjs render', ok: true, detail: { durationMs: 65000 } },
    { type: 'file', summary: 'projects/a/VOICEOVER-SCRIPT.md', ok: true },
    { type: 'tool', summary: 'Read', ok: true }, { type: 'tool', summary: 'Grep', ok: true },
    { ts: 't9', type: 'command', phase: 'end', summary: 'node dashboard/bin/run.mjs install', ok: false, error: 'Exit code 1' },
  ];
  expect(summarizeRun(ev, ['remotion-official', 'frontend-design'])).toEqual({
    skillsUsed: ['remotion-official'], skillsPlannedNotUsed: ['frontend-design'], pythonTools: ['voiceover'],
    filesChanged: ['projects/a/VOICEOVER-SCRIPT.md'], commandCount: 3, readCount: 2, renderMs: 65000,
    lastError: { ts: 't9', summary: 'node dashboard/bin/run.mjs install', error: 'Exit code 1' } });
});
it('listRuns menandai run.json rusak tanpa menjatuhkan yang lain', () => {
  const { root, project } = seedRun({ status: 'success' });
  fs.mkdirSync(path.join(root, 'projects', project, 'runs', 'rusak')); fs.writeFileSync(path.join(root, 'projects', project, 'runs', 'rusak', 'run.json'), '{');
  const list = listRuns(root);
  expect(list).toHaveLength(2); expect(list.at(-1)).toMatchObject({ runId: 'rusak', corrupt: true });
});
it('readRunDetail: tahap selesai, aktif, dilewati, dan gagal', () => {
  const { root, project, runId } = seedRun({ status: 'running', stage: 'render', stagesEntered: ['setup', 'script', 'compose', 'render'] });
  expect(readRunDetail(root, project, runId).stages.map(s => s.state))
    .toEqual(['done', 'done', 'skipped', 'skipped', 'done', 'skipped', 'active', 'pending', 'pending']);
  const f = seedRun({ status: 'failed', stage: 'render', stagesEntered: ['setup', 'render'] });
  expect(readRunDetail(f.root, f.project, f.runId).stages.find(s => s.name === 'render').state).toBe('failed');
});
it('markRunFailed hanya untuk run terhenti atau berhenti dan membersihkan penanda aktif', () => {
  const { root, project, runId } = seedRun({ status: 'running', lastActivity: '2026-10-24T01:00:00.000Z', active: true });
  markRunFailed(root, project, runId, 'Ditandai gagal dari dashboard.', new Date('2026-10-24T02:00:00Z'));
  expect(readRun(root, project, runId).value).toMatchObject({ status: 'failed', error: { message: 'Ditandai gagal dari dashboard.' } });
  expect(readActiveRun(root)).toBeNull();
  const ok = seedRun({ status: 'success' });
  expect(() => markRunFailed(ok.root, ok.project, ok.runId, 'x', new Date())).toThrow('statusnya Sukses');
});
it('skillUsage menghitung run', () => {
  const { root } = seedRun({ status: 'success', sessionId: 's1', events: { s1: [['01:55:00', 'skill', 'remotion-official']] } });
  expect(skillUsage(root)['remotion-official'].runs).toBe(1);
});
```

`seedRun(opts)` adalah helper di file tes yang membangun `makeFixtureRepo()`, run.json, dan file event sesi dari opsi yang diberikan. Event berbentuk `[jam, type, summary]` pada tanggal 2026-10-24 UTC.

- [ ] **Step 2: Jalankan tes, pastikan gagal.** Expected: FAIL.
- [ ] **Step 3: Implementasi `runs.mjs`.**
- [ ] **Step 4: Jalankan tes, pastikan lulus.** Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat(dashboard): Derive run status, timeline and summary"`

### Task 19: Halaman Eksekusi

**Files:**
- Create: `dashboard/app/eksekusi/page.tsx`, `dashboard/app/eksekusi/[slug]/[runId]/page.tsx`, `dashboard/app/eksekusi/actions.ts`, `dashboard/components/{stage-bar,timeline,run-panels}.tsx`

**Interfaces:**
- Consumes: `listRuns`, `readRunDetail`, `markRunFailed` (T18), `retryPrompt`, `repeatRequest` (T15), `AutoRefresh`, `StatusBadge`, `CopyButton`, `Markdown`, `mediaUrl`, labels (T10).
- Produces: `markFailedAction(project, runId)` (alasan tetap `Ditandai gagal dari dashboard.`) and `repeatRequestAction(project, runId): Promise<{ ok: true, prompt } | { ok: false, errors }>`.

- [ ] **Step 1: Halaman `/eksekusi`**
  - Judul "Eksekusi".
  - Tabel: Status (`StatusBadge`), Topik (tautan ke detail), Alur, Proyek (tautan `/video/<slug>`), Mulai, Durasi (`m:ss` atau "berjalan"), Pemicu ("Chat"/"Dashboard"), Perbaikan dari (tautan ke `retryOf`).
  - `AutoRefresh` aktif bila ada run dengan display status `running`, `waiting`, `waiting-permission`, atau `stopped`.
  - Keadaan kosong: "Belum ada eksekusi."
- [ ] **Step 2: Halaman detail `/eksekusi/[slug]/[runId]`**
  - **Kepala:** topik, `StatusBadge`, "Alur <id> v<versi> · pemicu <chat|dashboard> · proyek <slug>", dan lama berjalan.
  - **`StageBar`:** daftar tahap berisi label, teks keadaan ("selesai", "aktif", "dilewati", "gagal", "menunggu") + ikon, dan durasi.
  - **Panel sesuai status:**
    - `waiting`: "Claude menunggu persetujuan Anda: <waitReason>. Balas di chat Claude Code." + `Markdown(script)`.
    - `waiting-permission`: "Claude menunggu izin. Buka Claude Code, lalu setujui atau tolak permintaannya."
    - `stopped`: "Claude berhenti, tetapi run belum selesai. Cek chat Claude Code." + tombol "Tandai gagal" (dengan Dialog konfirmasi).
    - `abandoned` (tampilan): "Tidak ada aktivitas lebih dari 15 menit." + tombol "Tandai gagal".
    - `failed` atau `abandoned` (tersimpan): Tahap, Pesan, event terakhir sebelum gagal; `CopyButton` "Salin prompt perbaikan" (`retryPrompt`); tombol "Ulang dengan topik sama" yang menampilkan prompt baru + `CopyButton`.
    - `success`: pemutar video + tautan `/video/<slug>`.
  - **Ringkasan:** chip "Skill dipakai" (✓), chip "Direncanakan, belum dipakai", "Tool Python", "File diubah (N)" berupa `<details>`, dan "Perintah: N · File dibaca: N · Render: m:ss".
  - **Prompt pemicu:** blok kode.
  - **Frame review:** grid gambar dengan `alt` "Frame review <n>".
  - **Linimasa (client):** select filter "Semua jenis" ditambah tiap `EVENT_LABELS`; secara bawaan jenis `tool` disembunyikan. Tiap baris berisi jam `HH:mm:ss`, label + ikon jenis, summary (monospace untuk perintah), teks "gagal" + error bila `ok === false`, dan durasi.
  - `AutoRefresh` aktif selama display status belum final.
- [ ] **Step 3: Verifikasi dengan simulasi tanpa Claude** (dashboard menyala, buka halaman detail setelah langkah ke-2)

```bash
echo '{"hook_event_name":"UserPromptSubmit","session_id":"sim1","prompt":"/buat-video contoh-penjelasan \"Simulasi dashboard\""}' | node dashboard/bin/hook.mjs
node dashboard/bin/run.mjs start --flow contoh-penjelasan --topic "Simulasi dashboard"
echo '{"hook_event_name":"PostToolUse","session_id":"sim1","tool_name":"Bash","tool_input":{"command":"node dashboard/bin/run.mjs start --flow contoh-penjelasan"}}' | node dashboard/bin/hook.mjs
echo '{"hook_event_name":"PostToolUse","session_id":"sim1","tool_name":"Skill","tool_input":{"skill":"remotion-official"}}' | node dashboard/bin/hook.mjs
node dashboard/bin/run.mjs stage script
echo '{"hook_event_name":"Notification","session_id":"sim1","message":"Claude needs your permission","notification_type":"permission_prompt"}' | node dashboard/bin/hook.mjs
node dashboard/bin/run.mjs fail --reason "simulasi"
```

Hasil yang diharapkan, masing-masing muncul dalam 2 detik tanpa reload:
- Status Berjalan, Persiapan selesai, Naskah aktif, chip `remotion-official`, dan prompt pemicu.
- Setelah notifikasi: panel "Claude menunggu izin".
- Setelah `fail`: status Gagal, panel error, dan prompt `/buat-video perbaiki=<runId>`.
- [ ] **Step 4: Commit:** `git commit -m "feat(dashboard): Add live execution list and detail pages"`

### Task 20: Beranda langsung, pemakaian skill, dan uji terima MVP

**Files:**
- Create: `dashboard/components/active-run-card.tsx`
- Modify: `dashboard/app/page.tsx`, `dashboard/app/skill/page.tsx`

**Interfaces:**
- Consumes: `readActiveRun` (T6), `readRunDetail`, `skillUsage` (T18), `listFlows` (T15).

- [ ] **Step 1: `ActiveRunCard` di Beranda**
  - Bila ada run aktif: topik, `StatusBadge`, label tahap aktif, waktu berjalan, chip skill yang sudah dipakai, dan tautan "Detail".
  - Bila tidak ada: "Tidak ada run aktif."
  - Beranda memasang `AutoRefresh` selama ada run aktif.
- [ ] **Step 2: `/skill`**
  - Kolom "Dipakai": `N run · terakhir <tanggal id-ID>`, atau "Belum dipakai".
  - Kolom "Dicantumkan di alur": nama-nama alur yang `skills`-nya memuat id tersebut.
- [ ] **Step 3: Jalankan semua tes dan build.** Run: `npx vitest run && npm run build`. Expected: semua PASS, build berhasil.
- [ ] **Step 4: Uji terima MVP** sesuai PRD §14 langkah 1–12. Langkah chat (4–7 dan 11) dijalankan lewat Claude Code yang dibuka di folder repo, atau lewat `claude -p` seperti di Task 9. Untuk langkah 12:

```bash
git worktree add --detach ../vg-wt
node ../vg-wt/dashboard/bin/run.mjs status
git worktree remove ../vg-wt
```

Hasil yang diharapkan untuk langkah 12: exit 1 dengan pesan yang mengandung `bukan git worktree`. Catat hasil lulus/gagal setiap langkah di laporan akhir.
- [ ] **Step 5: Commit:** `git commit -m "feat(dashboard): Show live active run on home and skill usage"`

---

## Cakupan PRD → task

| PRD | Task |
|---|---|
| JMB-01, JMB-10 | 9 |
| JMB-02, JMB-05, JMB-09 | 6 (JMB-05 juga 18; JMB-09 juga 20) |
| JMB-03, JMB-06 | 7 |
| JMB-04 | 8, 9 |
| JMB-07 | 11, 12 |
| JMB-08 | 6, 15, 19 |
| BRD-01 | 20 |
| BRD-02 | 17 |
| BRD-03, BRD-04, BRD-05 | 14 |
| ALR-01, ALR-02, ALR-03, ALR-08 | 16 |
| ALR-04 | 15, 16 |
| ALR-05 | 3, 15 |
| ALR-06 | 15, 16 |
| ALR-07 | 6, 15 |
| GAL-01 | 12 |
| GAL-02 | 11, 12 |
| EKS-01, EKS-04 | 19 |
| EKS-02, EKS-03, EKS-06, EKS-07, EKS-08 | 18, 19 |
| EKS-05 | 10, 19 |
| REF-01, REF-02, REF-03, REF-04 | 13 |
| REF-05 | 17 |
| SKL-01, SKL-02 | 13 |
| SKL-03 | 20 |
| CK-01, CK-02, CK-03 | 14 |
| SET-01, SET-02 | 14 |
| NFR-01 | 10 |
| NFR-02 | 1, 11 |
| NFR-03 | 4, 13 |
| NFR-04 | 7, 14 |
| NFR-05 | 10 |
| NFR-06 | 11 (galeri memuat metadata, bukan file video) |
| NFR-07 | 2, 11, 18 |
| NFR-10 | 10, 16, 19 |
| NFR-11 | 15, 16 |
| NFR-12 | 9 (hanya menambah; `/video` tidak diubah) |
| Uji terima §14 | 9, 20 |
