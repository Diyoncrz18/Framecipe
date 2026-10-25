## Gambaran

Dashboard ini memesan, Claude membuat, dan dashboard menampilkan hasilnya. Anda memilih alur dan topik, Claude Code mengerjakan video tahap demi tahap di folder repo, lalu dashboard memantau prosesnya dan memajang video jadi di galeri. Render video dan semua filenya berjalan lokal di komputer Anda.

## Syarat

- Buka Claude Code di folder repo utama, bukan di worktree. Perintah `run.mjs` sengaja menolak berjalan di worktree.
- Jalankan dashboard dengan `cd dashboard && npm run dev`, lalu buka http://127.0.0.1:3210.

## Tahap pipeline

| Tahap | Yang terjadi | Skill/tool |
| --- | --- | --- |
| Persiapan | Folder proyek dibuat dari template dan run dicatat. | `run.mjs start` |
| Naskah | Claude menulis naskah per scene dan mengisi konfigurasi template. | skill `remotion-best-practices`, `VOICEOVER-SCRIPT.md` |
| Aset & audio | Opsional. Hanya berjalan bila alur memintanya. Narasi per scene memakai Edge TTS (gratis, suara Bahasa Indonesia) atau provider lain yang dipilih di alur, dan musik latar memakai trek gratis bawaan. | `run.mjs audio` (tool `voiceover`) |
| Komposisi | Claude menyesuaikan komponen dan tema scene dengan brand. Tahap ini selalu berjalan. | skill `frontend-design` (opsional) |
| Install | Dependensi proyek dipasang dengan `npm install`. | `run.mjs install` |
| Render | Video dirender dengan Remotion, memakai browser bersama. | `run.mjs render` (Remotion, browser bersama) |
| Review visual | Beberapa frame diambil dan diperiksa Claude. Frame ini juga menjadi thumbnail galeri. | `run.mjs stills` |
| Selesai | File video divalidasi, lalu `node_modules` proyek dihapus. | `run.mjs finish` (validasi, hapus `node_modules`) |

## Cara memicu

Cara utama lewat dashboard:

1. Di Beranda, pilih alur, isi topik dan catatan, lalu klik **Buat prompt**. Dashboard menyimpan permintaan Anda dan menampilkan prompt `/buat-video req=<id>`.

   Bila ingin menyunting bahan Anda sendiri, lampirkan **File sumber** lewat **Pilih file** atau **Pilih folder**: video asli, audio (musik atau suara), gambar, atau teks seperti naskah, subtitle, dan data. Maksimal 2 GB per file dan 20 file. File diunggah ke `.dashboard/uploads/` saat Anda membuat prompt, lalu disalin ke `public/sources/` milik proyek saat video dibuat; file aslinya tidak pernah dihapus. Tulis di Catatan cara memakainya, misalnya "potong jadi 30 detik dan pakai musik ini sebagai latar".
2. Salin prompt itu, lalu tempel di chat Claude Code yang dibuka di folder repo utama.
3. Claude mengambil permintaan itu, memulai run, dan mengerjakan video tahap demi tahap. Pantau di halaman Eksekusi.

Cara lain, langsung di chat Claude Code:

- `/buat-video <id-alur> "<topik>"`: langsung memakai alur dan topik tanpa membuat permintaan di dashboard.
- `/buat-video perbaiki=<runId>`: melanjutkan run yang gagal, dibatalkan, atau terhenti dari file proyek yang sudah ada. Prompt ini juga tersedia di detail eksekusi.

Hanya satu run yang boleh aktif. Bila `/buat-video` menolak mulai karena run lain masih aktif, tunggu run itu selesai, tandai gagal dari halaman Eksekusi, atau tunggu 15 menit tanpa aktivitas.

## Biaya

Claude Code berjalan di cloud Anthropic dan memakai kuota langganan Claude Anda. Render dengan Remotion, penyimpanan file, dan dashboard ini gratis dan berjalan lokal. Layanan cloud ElevenLabs, Modal, RunPod, dan Ideogram butuh akun sendiri (umumnya berbayar) dan API key, dan hanya dipakai bila Anda mengisi API key-nya dan alur memintanya. Narasi Edge TTS dan musik latar bawaan gratis tanpa API key. Edge TTS memakai layanan baca-keras Microsoft Edge secara online; untuk konten komersial, periksa ketentuan Microsoft atau pakai ElevenLabs.

## Ruang disk

Setiap proyek memakai sekitar 690 MB selama proses berjalan, dan folder `node_modules` dihapus otomatis setelah run sukses. Browser render sebesar 270 MB dipakai bersama oleh semua proyek.

## Arti status

- **Berjalan**: Claude sedang mengerjakan video.
- **Menunggu Anda**: Claude menunggu balasan Anda di chat, misalnya persetujuan naskah.
- **Menunggu izin Anda**: Claude tertahan oleh prompt izin di Claude Code. Jawab prompt itu di sana. Bila sesi Claude Code itu sudah ditutup, tandai run gagal dari halaman Eksekusi.
- **Claude berhenti**: Claude sudah berhenti membalas, tetapi run belum ditutup dengan selesai atau gagal. Lanjutkan lewat chat.
- **Terhenti**: tidak ada aktivitas lebih dari 15 menit, biasanya karena sesi Claude ditutup. Lanjutkan dengan `/buat-video perbaiki=<runId>`, atau tandai gagal.
- **Gagal**: ada langkah yang tidak bisa diperbaiki. Alasannya tampil di detail eksekusi.
- **Sukses**: video lolos validasi dan sudah ada di galeri.
