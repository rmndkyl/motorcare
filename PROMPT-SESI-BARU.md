# PROMPT SESI BARU — MOTORCARE (lanjutan)

Salin seluruh blok di bawah ini sebagai pesan pertama di sesi baru.

---

## PROMPT

Lanjutkan pekerjaan **MOTORCARE**. Jangan mulai dari nol, jangan menebak keadaan proyek —
semua fakta di bawah ini sudah diverifikasi dan harus kamu pakai sebagai titik awal.

### 1. Identitas proyek

- **Repo:** `~/LYID-BOTS/motorcare` (git, branch `master`), publik di github.com/rmndkyl/motorcare
- **Live:** https://rmndkyl.github.io/motorcare/
- **Build saat ini:** `motorcare-v2.3.1`, hash aset `4c2aec4ef6`, commit `c08617e`
- **Stack:** vanilla JS (tanpa framework, tanpa build step selain `build.py`), IndexedDB 9 object store,
  CSS custom properties dengan dua tema, service worker, GitHub Pages
- **Backend: TIDAK ADA.** Ini keputusan sadar, bukan pekerjaan yang belum selesai. Jangan menambahkan
  server, akun, atau API kecuali user memintanya secara eksplisit.
- **Data milik user** tersimpan di IndexedDB perangkat. Backup/restore lewat file JSON.

Baca dulu, sebelum menyentuh apa pun: `README.md`, `ROADMAP.md`, `FASE-0-VALIDASI.md`,
dan `git log --oneline -12`.

### 2. Yang SUDAH selesai dan terverifikasi (jangan dikerjakan ulang)

- 5 halaman: Home, Garasi, Perawatan (Servis/Pengingat/Pemeriksaan), Riwayat (Timeline/Kerusakan/Pengeluaran/Odometer), Profil
- 13 komponen pemeriksaan, 4 tingkat status, skor kesehatan berbobot + penalti
- Pengingat dual-trigger (km **dan** tanggal), 13 template, state `needs-baseline` untuk data kosong
- Preset interval per segmen motor (`matic-baru`, `matic-lama`, `bebek-manual`, `sport`)
- Tema gelap + terang, ikut HP atau dipaksa, persist di localStorage
- Offline penuh (service worker), hash URL aset anti-cache-basi
- Backup JSON dengan sanitasi saat impor, CSP, allowlist `safeImgSrc` (XSS lewat `img src` sudah ditutup)
- Diukur: LCP 752 ms, CLS 0, 0 long task, kontras light 11/11 PASS, reflow 320px bersih,
  0 console error di seluruh route/tab/form

### 3. Direktif yang harus kamu jalankan sekarang

User punya dokumen "MASTER PRODUCT EVOLUTION DIRECTIVE" (riset NN/g, WCAG 2.2, Core Web Vitals,
OWASP ASVS 5.0, Yamaha Indonesia, plus rubric anti-AI-slop 100 poin buatan sendiri). Arahnya benar,
tapi dokumen itu **tidak tahu keadaan kode yang sebenarnya** — beberapa permintaannya sudah selesai,
beberapa mengasumsikan hal yang tidak ada. Jangan turuti mentah.

Tugasmu: audit berdasarkan **kode yang benar-benar ada**, lalu perbaiki yang memang kurang.

#### Celah nyata yang sudah teridentifikasi (mulai dari sini, urut prioritas)

**P0 — Komponen pemeriksaan masih GLOBAL, bukan per-kendaraan.**
`MC.COMPONENTS` di `js/core.js` dipakai untuk semua motor. Akibatnya motor manual tetap ditanya
soal CVT, padahal pengingatnya sudah segment-aware (manual tidak dapat CVT/oli gardan). Ini
inkonsistensi internal yang baru muncul setelah preset segmen ditambahkan, dan bertentangan
langsung dengan bagian 09 dokumen ("jangan mengasumsikan semua kendaraan punya konfigurasi
komponen yang sama"). Perbaiki: komponen aktif diturunkan dari `segment`, bukan satu daftar global.
Pastikan skor kesehatan ikut menyesuaikan penyebutnya.

**P1 — Interval `matic-lama` belum dari buku servis.**
Motor user adalah Yamaha Mio M3 2015. Preset `matic-lama` memberi oli 2.000 km / 2 bulan, tapi itu
**tebakan dari umur motor**, bukan angka buku servis Mio M3. Dokumen itu sendiri memperingatkan hal
ini. Kalau sumber resmi per varian tidak tersedia, tandai interval sebagai **belum terverifikasi**
di UI — jangan sajikan tebakan sebagai angka pabrikan.

**P1 — Penjelasan skor belum lengkap.**
Dokumen 07-C menuntut "skor harus disertai penjelasan bagaimana angka itu dihitung". Sekarang hanya
3 faktor teratas yang tampil. Tambahkan rincian yang bisa dibuka: bobot per komponen, nilai per
komponen, dan tiap penalti yang diterapkan. Tanpa itu user tidak bisa memeriksa angka yang kita beri.

**P2 — Status komponen belum punya semua state.**
Dokumen 04 menuntut default/hover/focus/active/disabled/loading/error per komponen. Sekarang fokus
dan active ada, disabled sebagian, loading/error hampir tidak ada. Tambahkan hanya di tempat yang
memang punya proses async (impor, ekspor, simpan).

**P2 — Scenario F (multi-kendaraan) belum diuji.**
Skenario A–E sudah teruji. Yang belum: dua motor dengan riwayat berbeda, ganti motor aktif,
pastikan tidak ada data tertukar di halaman mana pun. Ini kelas bug yang paling mahal kalau lolos.

**P2 — Skor anti-AI-slop belum dihitung.**
Rubric dokumen: 6 kategori, 100 poin (Generic Pattern 20, Visual Inconsistency 15, Decorative Noise 15,
Context & Content 15, Fake Functionality 20, Repetitive UX 15). Hitung **sebelum** perubahan apa pun,
simpan hasilnya sebagai baseline, baru kerjakan perbaikan, lalu hitung ulang. Skor tanpa baseline
tidak ada artinya.

**P3 — Enkripsi data lokal.**
IndexedDB tersimpan plaintext. Untuk catatan servis ini proporsional, tapi harus ditulis sebagai
batas di README. **Jangan** memasang enkripsi yang kuncinya disimpan di tempat yang sama — itu
keamanan palsu.

#### Yang JANGAN dikerjakan

- Jangan tanya "mana backend/database/auth" lalu membuatnya. Tidak ada, dan itu memang desainnya.
  Kalau dokumen meminta audit backend, jawab: tidak ada backend, jadi seluruh kontrol sisi server
  tidak berlaku; fokus ke klien (XSS, CSP, data lokal, supply chain).
- Jangan mengganti desain yang sudah lolos ukur. Dark otomotif + aksen oranye adalah identitas,
  bukan template.
- Jangan menambah card/komponen supaya halaman "terlihat lebih penuh". Dokumen bagian 05 melarangnya.
- Jangan mengklaim skor/status apa pun tanpa angka yang bisa ditunjuk.

### 4. Aturan bukti (tidak bisa dinegosiasi)

- Klaim "berhasil" wajib punya bukti yang bisa ditunjuk: output perintah, isi file, hasil ukur, screenshot.
- **Ukur, jangan lihat.** Kontras: resolve warna lewat canvas → composite alpha → hitung luminance.
  Parser regex pada `getComputedStyle` akan gagal karena nilainya `oklch()`/`oklab()`, dan itu
  menghasilkan rasio 1 untuk semua teks. Dua kali metode pengukuran saya salah di sesi sebelumnya
  karena ini — jangan ulangi.
- Screenshot pada posisi scroll atas selalu terlihat "terpotong lipatan layar". Untuk menguji
  bottom nav, `scrollTo(0, scrollHeight)` lalu bandingkan `navTop` vs `bottom` elemen terakhir.
- Kalau ada dua angka bertengkar, cari pengukuran ketiga yang independen. Jangan pilih yang enak.
- Sebelum deploy: `node --check` tiap file JS, lalu `python3 build.py` (menempel hash aset; gagal
  kalau ada aset terlewat), lalu naikkan `VERSION` di `sw.js`.
- Uji di origin/port yang **belum pernah dibuka** — origin yang sudah dibuka menyajikan CSS/JS lama
  dari HTTP cache browser dan membuat perbaikan terlihat gagal padahal berhasil.
- Impor **backup asli user** untuk uji, bukan data sintetis. Data buatan sendiri selalu rapi, jadi
  jalur data-kosong, tanggal hari-ini, dan duplikat tidak pernah tereksekusi.

### 5. Bentuk keluaran yang diminta

1. **Tabel inspeksi** — Area | Kondisi | Masalah | Prioritas (P0–P2). Isi hanya dengan temuan yang
   kamu buktikan sendiri dari kode/log/pengukuran. Kalau sebuah area bersih, tulis bersih.
2. **Skor anti-slop baseline** (0–100, 6 kategori) beserta alasan tiap potongan nilai.
3. **Rencana perbaikan** urut P0→P3, satu item satu alasan yang bisa diuji.
4. Baru eksekusi, satu item per langkah, verifikasi tiap langkah.

Kalau ada yang tidak bisa kamu verifikasi, tulis **UNVERIFIED** dengan alasan — jangan diisi
dengan tebakan.

---

## Catatan untuk user (bukan bagian prompt)

Tiga hal yang perlu kamu tahu sebelum menempel prompt di atas:

1. **Dokumen ChatGPT itu tidak membaca kodemu.** Ia bahkan menulis bahwa link MOTORCARE hanya
   terbaca sebagai judul halaman. Jadi seluruh isinya premis, bukan temuan — karena itu prompt di
   atas membawa fakta proyek versi terukur supaya sesi baru tidak mulai dari asumsi yang salah
   (mis. mencari backend yang tidak ada).

2. **Satu celah yang saya temukan justru berasal dari pekerjaan saya sendiri.** Waktu saya menambah
   preset segmen, pengingat jadi sadar-segmen (motor manual tidak dapat CVT), tapi daftar komponen
   pemeriksaan masih global — jadi motor manual tetap ditanya soal CVT. Itu P0 di atas, dan itu
   contoh kenapa audit harus dimulai dari kode, bukan dari daftar fitur.

3. **Saran terbaik dari dokumen itu:** simpan hasil audit sebelum menyentuh kode. Kalau tidak, kamu
   hanya akan punya klaim "sekarang sudah bagus" tanpa pembanding. Prompt di atas sudah meminta
   baseline disimpan lebih dulu.
