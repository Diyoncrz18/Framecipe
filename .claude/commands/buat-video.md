---
description: Buat video dari alur dashboard (req=<id>, perbaiki=<runId>, atau <id-alur> "<topik>")
argument-hint: req=<id> | perbaiki=<runId> | <id-alur> "<topik>"
---

# /buat-video

Argumen: $ARGUMENTS

Kamu menjalankan **alur yang sudah disetujui pemiliknya** di dashboard. Ini bukan sesi brainstorming: jangan memulai brainstorming, jangan mengajukan pertanyaan klarifikasi, dan jangan meminta konfirmasi rencana. Satu-satunya jeda yang diizinkan adalah review naskah bila alur memintanya (`approval: "script-review"`). Laporkan semuanya dalam Bahasa Indonesia.

## Aturan wajib
- Jalankan semua perintah dari root repo. Setiap langkah pipeline lewat `node dashboard/bin/run.mjs <subperintah>`. Jangan memanggil `npm`, `npx`, atau `remotion` langsung, dan jangan menambahkan prefix apa pun (termasuk `rtk`) di depan `node`.
- Jalankan setiap `node dashboard/bin/run.mjs …` sebagai satu perintah Bash yang berdiri sendiri. Jangan merangkainya dengan `cd … &&`, `;`, atau pipe (`|`).
- Pakai Bash hanya untuk `node dashboard/bin/run.mjs …`. Untuk melihat folder dan file, pakai tool Read, Glob, dan Grep, bukan `ls`, `cat`, atau `find` (juga tidak lewat `rtk`).
- Setiap subperintah mencetak JSON. Bila `finish` mengembalikan `"status": "failed"`, baca alasannya di field `error`.
- Awali setiap tahap dengan `node dashboard/bin/run.mjs stage <tahap>`.
- Ubah file hanya di dalam `projects/<project>/`. Jangan mengubah `templates/`, `lib/`, `brands/`, `flows/`, atau `examples/`.
- Setelah `start` berhasil: jika sebuah langkah gagal dan tidak bisa kamu perbaiki dalam 2 percobaan, jalankan `node dashboard/bin/run.mjs fail --reason "<penjelasan singkat>"` lalu berhenti. Jangan pernah berhenti tanpa `finish` atau `fail`.
- Bila `start` gagal (misalnya masih ada run aktif lain), sampaikan pesannya ke pengguna lalu berhenti. Jangan menjalankan `fail`, `finish`, `stage`, atau subperintah lain: run aktif itu milik sesi lain.
- Untuk `install` dan `render`, beri perintah Bash timeout 600000 ms.

## Langkah
1. Mulai run sesuai argumen:
   - `req=<id>`: `node dashboard/bin/run.mjs start --request <id>`
   - `perbaiki=<runId>`: `node dashboard/bin/run.mjs start --retry <runId>`. Baca juga `error` di `run.json` milik run yang gagal, lalu lanjutkan dari file proyek yang sudah ada.
   - selain itu: `node dashboard/bin/run.mjs start --flow <id-alur> --topic "<topik>"`

   Bila `start` gagal, sampaikan pesannya ke pengguna lalu berhenti (jangan menjalankan `fail`, `finish`, `stage`, atau subperintah lain). Bila berhasil, simpan `project` dan `runId` dari output JSON. Baca `projects/<project>/runs/<runId>/run.json` (topik, catatan) dan `projects/<project>/runs/<runId>/flow.json` (alur yang berlaku).
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
