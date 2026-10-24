# Dashboard Video Generation

Dashboard lokal untuk membuat dan memantau video dengan toolkit ini. Anda memesan video di dashboard, Claude Code mengerjakannya lewat `/buat-video`, dan dashboard menampilkan prosesnya serta hasilnya di galeri. Semua berjalan di komputer Anda: server hanya mendengarkan `127.0.0.1:3210` dan menolak permintaan dengan Host lain. Tidak ada deploy ke layanan hosting.

Next.js 16 (App Router), TypeScript, Tailwind 4, dan Vitest. Logika inti ada di `core/` (ESM `.mjs`, tes di sampingnya).

## Menjalankan

```bash
cd dashboard
npm install
npm run dev          # mode pengembangan di http://127.0.0.1:3210
```

Untuk mode produksi:

```bash
npm run build
npm start            # http://127.0.0.1:3210
```

## Tes

```bash
npm test             # vitest run
```

## Dokumentasi lain

- Aturan `/buat-video` dan `run.mjs`: bagian "Dashboard & /buat-video" di `CLAUDE.md` pada root repo.
- Spesifikasi produk: `docs/superpowers/specs/2026-10-24-dashboard-video-generation-prd.md`.
- Catatan versi Next.js: lihat `AGENTS.md` di folder ini.
