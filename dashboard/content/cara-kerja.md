## Gambaran

Dashboard ini memesan, Claude membuat, dan dashboard menampilkan hasilnya. Anda memilih alur dan topik, Claude Code mengerjakan video tahap demi tahap di folder repo, lalu dashboard memantau prosesnya dan memajang video jadi di galeri. Render video dan semua filenya berjalan lokal di komputer Anda.

## Syarat

- Buka Claude Code di folder repo utama, bukan di worktree. Perintah `run.mjs` sengaja menolak berjalan di worktree.
- Jalankan dashboard dengan `cd dashboard && npm run dev`, lalu buka http://127.0.0.1:3210.

## Tahap pipeline

| Tahap | Yang terjadi | Skill/tool |
| --- | --- | --- |
| Persiapan | Folder proyek dibuat dari template dan run dicatat. | `run.mjs start` |
| Naskah | Claude menulis naskah per scene dan mengisi konfigurasi template. | skill `remotion-official`, `VOICEOVER-SCRIPT.md` |
| Aset & audio | Opsional. Hanya berjalan bila alur memintanya. | tool `voiceover`/`music_gen` (butuh API key) |
| Komposisi | Claude menyesuaikan komponen dan tema scene dengan brand. Tahap ini selalu berjalan. | skill `frontend-design` (opsional) |
| Install | Dependensi proyek dipasang dengan `npm install`. | `run.mjs install` |
| Render | Video dirender dengan Remotion, memakai browser bersama. | `run.mjs render` (Remotion, browser bersama) |
| Review visual | Beberapa frame diambil dan diperiksa Claude. Frame ini juga menjadi thumbnail galeri. | `run.mjs stills` |
| Selesai | File video divalidasi, lalu `node_modules` proyek dihapus. | `run.mjs finish` (validasi, hapus `node_modules`) |

## Cara memicu

Saat ini video dipicu lewat chat: di Claude Code, jalankan `/buat-video <id-alur> "<topik>"`. Tombol Generate di dashboard menyusul.

## Biaya

Claude Code berjalan di cloud Anthropic dan memakai kuota langganan Claude Anda. Render dengan Remotion, penyimpanan file, dan dashboard ini gratis dan berjalan lokal. Layanan cloud ElevenLabs, Modal, RunPod, dan Ideogram butuh akun sendiri (umumnya berbayar) dan API key, dan hanya dipakai bila Anda mengisi API key-nya dan alur memintanya. Versi MVP ini berjalan tanpa suara.

## Ruang disk

Setiap proyek memakai sekitar 690 MB selama proses berjalan, dan folder `node_modules` dihapus otomatis setelah run sukses. Browser render sebesar 270 MB dipakai bersama oleh semua proyek.

## Arti status

- **Berjalan**: Claude sedang mengerjakan video.
- **Menunggu Anda**: Claude menunggu balasan Anda di chat, misalnya persetujuan naskah.
- **Menunggu izin Anda**: Claude tertahan oleh prompt izin di Claude Code. Jawab prompt itu di sana.
- **Claude berhenti**: Claude sudah berhenti membalas, tetapi run belum ditutup dengan selesai atau gagal. Lanjutkan lewat chat.
- **Terhenti**: tidak ada aktivitas lebih dari 15 menit, biasanya karena sesi Claude ditutup. Lanjutkan dengan `/buat-video perbaiki=<runId>`, atau tandai gagal.
- **Gagal**: ada langkah yang tidak bisa diperbaiki. Alasannya tampil di detail eksekusi.
- **Sukses**: video lolos validasi dan sudah ada di galeri.
