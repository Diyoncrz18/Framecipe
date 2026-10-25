# Rencana CI/CD Framecipe

Status: fase 1 sudah ada di `.github/workflows/ci.yml` (belum pernah jalan di GitHub sampai di-push).
Terakhir diperbarui: 2026-10-25.

## Ringkasan

- **Target: level 2** (CI + quality gate + keamanan). Level 3 cukup versi ringan (tag → GitHub Release). Level 4 (deploy otomatis) tidak relevan.
- **Kondisi sekarang: level 0 untuk dashboard, level 1 parsial untuk toolkit Python.** Repo mewarisi 5 workflow dari upstream; yang benar-benar menjaga kode hanya `lint-python.yml`. Dashboard, produk utamanya, belum dicek otomatis sama sekali.
- **Fase 1** menambah `ci.yml`: 4 job paralel (dashboard dan Python, masing-masing di Ubuntu dan Windows), tanpa secret, tanpa render, tanpa API berbayar.

## Level CI/CD

| Level | Isi | Framecipe |
|---|---|---|
| 0 | Tanpa CI | Dashboard sebelum fase 1 |
| 1 | CI dasar: install, test, lint, build otomatis di setiap push/PR | Fase 1 |
| 2 | Level 1 + quality gate wajib lulus, nol warning, action di-pin SHA, pemindaian dependensi/secret, audit workflow | **Target** (fase 2–3) |
| 3 | Rilis terversi otomatis: tag → changelog → GitHub Release | Opsional, versi ringan (fase 4) |
| 4 | Deploy otomatis ke server/lingkungan | Tidak direncanakan |

Kenapa level 2 dan bukan lebih tinggi:

- Dashboard sengaja hanya jalan lokal di `127.0.0.1:3210` (aturan keras #1). Tidak ada server produksi, jadi "deploy" tidak punya tujuan.
- Hasil kerja Framecipe adalah video yang dirender di mesin pemilik. Render butuh Chrome/Remotion, `node_modules` ~700 MB per proyek, dan untuk suara/musik berbayar butuh API key. Itu mahal, lambat, dan berisiko bocor jika dipindah ke CI.
- Pemilik bekerja sendiri dan sering push langsung ke `main`. Yang paling berguna adalah sinyal cepat "ada yang rusak" di setiap push, plus pagar keamanan supply chain. Proses rilis yang berat belum sepadan.

## Apa yang bisa dicek otomatis (dan apa yang tidak)

| Bisa, murah, tanpa secret | Tidak di CI (alasannya) |
|---|---|
| `dashboard/`: Vitest (186 test dengan repo palsu sementara; 1 di-skip karena butuh MP4 dan `node_modules` contoh hello-world), ESLint, `tsc`, `next build` | Render video Remotion: butuh Chrome dan waktu lama. `render-baseline.yml` hanya untuk PR bump Remotion |
| `tools/*.py`: `uv sync --locked`, `py_compile`, ruff untuk nama tak terdefinisi | TTS (Edge, ElevenLabs, 60db), musik ACE-Step, Ideogram, GPU cloud: butuh jaringan/key/biaya |
| `uv.lock` dan `package-lock.json` konsisten dengan manifest | `/buat-video` end-to-end: butuh Claude Code dan sesi interaktif |
| Sintaks dan keamanan workflow (actionlint, zizmor) | Cek visual dashboard di browser (terang/gelap, mobile) tetap manual |

## Inventaris workflow yang sudah ada

Semua workflow lama diimpor dari upstream (`chore: Import claude-code-video-toolkit as project base`). Audit `zizmor --offline` (2026-10-25) menemukan 47 temuan di workflow lama dan **0 di `ci.yml`**.

| Workflow | Pemicu | Izin token | Kondisi | Rekomendasi |
|---|---|---|---|---|
| `lint-python.yml` | push/PR yang mengubah `.py` | `contents: read` | Jalan dan lulus. Action belum di-pin SHA | Pin SHA, lalu gabungkan ke `ci.yml` (fase 2) |
| `render-baseline.yml` | PR yang mengubah `package.json` template/`lib/` | `pull-requests: write` | Gagal di PR Dependabot 24 Okt. 4 template injection, belum di-pin | Pertahankan untuk PR bump Remotion; pin SHA, pindahkan `${{ }}` ke `env:`, selidiki kegagalannya |
| `sync-remotion-skills.yml` | cron tiap Senin 09:00 UTC | `contents: write`, `pull-requests: write` | Aktif. Membuka PR otomatis dari `remotion-dev/skills` | Pemilik memutuskan: pertahankan (pin SHA) atau matikan |
| `docker-build.yml` | push `main` yang mengubah `docker/**` | `packages: write` | Aktif. Push image `video-toolkit-*` ke GHCR, peninggalan upstream (RunPod) | Kemungkinan tidak dipakai; nonaktifkan (`gh workflow disable`) setelah pemilik setuju |
| `release.yml` | tag `v*` | `contents: write` | Belum pernah dipakai | Simpan untuk fase 4; pin SHA, pindahkan `${{ }}` ke `env:` |
| `dependabot.yml` | bulanan | n/a | Hanya Remotion di template/contoh; tanpa cooldown | Tambah `github-actions` dan `dashboard/` (fase 2) |

## Fase 1: CI dasar dashboard dan Python (selesai, belum di-push)

File: `.github/workflows/ci.yml`. Pemicu: push ke `main`, setiap pull request, dan manual (`workflow_dispatch`).

| Job | OS | Langkah |
|---|---|---|
| `dashboard` | ubuntu-latest, windows-latest | `npm ci` → `npm test` → `npm run lint` → `npx tsc --noEmit -p .` → `npm run build` (gagal bila output build memuat warning) |
| `python` | ubuntu-latest, windows-latest | `uv sync --locked` → `uv run python -m py_compile tools/*.py` |

Pagar keamanan:

- `permissions: contents: read` untuk seluruh workflow; tidak ada secret, tidak ada `pull_request_target`.
- Setiap action di-pin ke commit SHA dengan komentar versinya: `actions/checkout` v7.0.1, `actions/setup-node` v7.1.0, `astral-sh/setup-uv` v10.3.0. Versi dipilih yang sudah dirilis minimal 2 minggu (setup-uv v10.3.2 baru 3 hari, jadi dilewati).
- `persist-credentials: false` agar token tidak tertinggal di `.git/config`.
- `concurrency` membatalkan run lama di branch/PR yang sama; `timeout-minutes` 20 dan 15.
- `fail-fast: false` supaya kegagalan di Windows tidak menyembunyikan hasil di Ubuntu, atau sebaliknya.

Kenapa Windows ikut: pemilik memakai Windows 11 dengan checkout CRLF (runner Windows juga `core.autocrlf=true`), dan bug path seperti spasi atau junction hanya muncul di sana. Semua langkah memakai `shell: bash` agar perintahnya sama di kedua OS. Repo publik, jadi menit runner Windows gratis.

Batas yang diketahui:

- Lint masih punya 1 warning lama (`dashboard/core/run-render.test.mjs:117`). ESLint tetap exit 0, jadi belum digerbang; lihat fase 2.
- Cek "nol warning" pada build memakai `grep` kata `warn`/`⚠` di output `next build`. Kasar tapi cukup; kalau suatu saat output normal Next memuat kata itu, polanya perlu dipersempit. Satu baris sengaja dikecualikan: `⚠ No build cache found`, yang selalu muncul di runner baru karena belum ada `.next/cache` (run pertama 2026-10-25 gagal karena baris ini). Menyimpan `.next/cache` dengan `actions/cache` akan mempercepat build, tapi baris itu tetap muncul setiap cache meleset, jadi pengecualiannya tetap perlu.
- `py_compile` hanya menangkap error sintaks, bukan error impor atau logika. Nama tak terdefinisi ditangkap `lint-python.yml`.

Selesai bila keempat job hijau di GitHub pada push pertama.

## Fase 2: quality gate dan keamanan (menuju level 2)

1. Pin SHA di semua workflow lama dan pindahkan ekspresi `${{ github.event.* }}`/`${{ steps.*.outputs.* }}` di blok `run:` ke `env:` (temuan template injection zizmor).
2. Tambah ekosistem `github-actions` ke Dependabot agar pin SHA ikut diperbarui, dengan `cooldown` minimal 7 hari.
3. Perbaiki warning lint lama, lalu ubah skrip lint menjadi `eslint --max-warnings=0`.
4. Gabungkan `lint-python.yml` ke `ci.yml` sebagai langkah di job `python` (`uvx ruff check --select F821,F811,F822,F823 scripts/ tools/`), dan perluas `py_compile` ke `scripts/`.
5. Job kecil `workflow-lint` di `ci.yml`: actionlint dan zizmor untuk `.github/`.
6. Dependabot npm untuk `dashboard/` (bulanan, minor/patch digrup). Next 16 berubah cepat, jadi tiap bump tetap lewat CI.
7. Di pengaturan repo (dikerjakan pemilik): aktifkan secret scanning dan push protection (gratis untuk repo publik), lalu ruleset `main` yang mewajibkan `CI` lulus. Karena pemilik biasa push langsung, beri bypass untuk admin, atau mulai memakai PR untuk perubahan besar.
8. Putuskan nasib `docker-build.yml` dan `sync-remotion-skills.yml`.

## Fase 3: smoke test tanpa biaya (memperdalam level 2)

Masing-masing hanya jika manfaatnya sepadan dengan menit runner:

- `node dashboard/bin/run.mjs status` di checkout bersih harus mencetak `{"active":null}`. Ini membuktikan helper run bisa dimuat tanpa data lokal.
- `uv run tools/<tool>.py --help` untuk tool yang tidak memanggil jaringan saat impor (misalnya `voiceover.py`, `qc.py`, `cutdown.py`), untuk menangkap error impor yang lolos dari `py_compile`.
- `next start` lalu `curl` ke `/` dan `/skill` di Ubuntu: halaman merespons 200 dan tidak memunculkan "Data rusak" pada checkout bersih.
- Typecheck template default (`templates/sprint-review`) hanya bila file template berubah (filter `paths`), karena butuh `npm ci` yang berat.

## Fase 4: rilis ringan (level 3, opsional)

- `release.yml` sudah membuat GitHub Release dari tag `vX.Y.Z` lengkap dengan changelog dari commit.
- Sebelum dipakai: tentukan satu sumber versi. Saat ini `pyproject.toml` 0.21.1, `_internal/toolkit-registry.json` (dibaca `release.yml`), dan `dashboard/package.json` 0.1.0 tidak sinkron.
- Rilis hanya dari commit yang CI-nya hijau. Tidak ada artefak untuk di-deploy; rilis = tag + catatan rilis.

## Tidak direncanakan: level 4

Tidak ada server untuk menerima deploy, dan dashboard memang tidak boleh terbuka ke jaringan. Render dan TTS tetap di mesin pemilik lewat `/buat-video`.

## Menjalankan pemeriksaan yang sama secara lokal

Dari root repo (Git Bash):

```bash
cd dashboard && npm ci && npm test && npm run lint && npx tsc --noEmit -p . && npm run build
```

```bash
uv sync --locked && uv run python -m py_compile tools/*.py
```

```bash
go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12 .github/workflows/*.yml
```

```bash
uvx zizmor --offline .github/workflows/ci.yml
```

Catatan Windows: path terpanjang di repo 123 karakter (di bawah `.claude/skills/remotion-official/`). Klon ke folder yang sangat dalam (path dasar lebih dari ~135 karakter) gagal dengan "Filename too long" kecuali `git config --global core.longpaths true`. Runner GitHub (`D:\a\Framecipe\Framecipe`) dan checkout pemilik aman.
