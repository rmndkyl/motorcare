# PROMPT SESI BARU — MOTORCARE (lanjutan)

Salin seluruh blok di bawah ini sebagai pesan pertama di sesi baru.

---

## PROMPT

Lanjutkan pekerjaan **MOTORCARE**. Jangan mulai dari nol, jangan menebak keadaan proyek —
semua fakta di bawah ini sudah diverifikasi dan harus kamu pakai sebagai titik awal.

### 1. Identitas proyek

- **Repo:** `~/LYID-BOTS/motorcare` (git, branch `master`), publik di github.com/rmndkyl/motorcare
- **Live:** https://rmndkyl.github.io/motorcare/ — Pages menyajikan langsung dari branch `master`
- **Build saat ini:** `motorcare-v2.4.0`, hash aset `f0440e1e40`, commit `fff12fa`
- **Stack:** vanilla JS (tanpa framework, tanpa build step selain `build.py`), IndexedDB 9 object store,
  CSS custom properties dengan dua tema, service worker, GitHub Pages
- **Backend: TIDAK ADA.** Ini keputusan sadar, bukan pekerjaan yang belum selesai.
- **Data milik user** tersimpan di IndexedDB perangkat. Backup/restore lewat file JSON.

Baca dulu, sebelum menyentuh apa pun: `README.md`, `_audit/AUDIT-SESUDAH.md`,
`_audit/AUDIT-BASELINE.md`, `ROADMAP.md`, `FASE-0-VALIDASI.md`, dan `git log --oneline -6`.

### 2. Cara mengukur proyek ini

Harness audit sudah ada dan **jangan ditulis ulang** — pakai yang ini:

```bash
cd ~/LYID-BOTS/motorcare
~/LYID-BOTS/_tools/patchright-venv/bin/python _audit/final.py        # acceptance + kontras + screenshot
~/LYID-BOTS/_tools/patchright-venv/bin/python _audit/integration.py  # impor/ekspor/offline
~/LYID-BOTS/_tools/patchright-venv/bin/python _audit/live.py         # verifikasi URL produksi
```

Pitfall yang sudah ditemukan dan **tidak boleh diulang**:

- **patchright mengevaluasi di isolated world.** `MC`, `MCS`, `MCD`, `MCApp` tidak terlihat.
  `harness.launch()` sudah membungkus `page.evaluate` dengan `isolated_context=False` — pakai
  object `page` yang dikembalikan harness, jangan panggil `page.evaluate` mentah.
- **Kontras tidak boleh diukur dengan regex pada `getComputedStyle`.** Token warnanya `oklch()`;
  regex mengembalikan rasio palsu. Yang benar: rasterisasi canvas 1×1 → baca `ImageData` →
  komposit alpha → luminance. Sudah ada di `JS_LIB` tiap skrip.
- **`httpd.shutdown()` tidak menutup socket.** Untuk uji offline wajib `server_close()` juga,
  kalau tidak koneksi menggantung dan `.catch()` di service worker tidak pernah jalan.
- **Jangan pakai origin/port yang pernah dibuka.** Harness memilih port acak tiap run.
- **Data uji = backup asli user**, bukan data sintetis:
  `~/.hermes/cache/documents/doc_3009baf8a237_motorcare-backup-2026-11-26.json`
  (1 motor PCX · 1 servis · 15 pemeriksaan · 12 pengingat). Data buatan sendiri selalu rapi,
  jadi jalur data-kosong dan tanggal-hari-ini tidak pernah tereksekusi.
- **Screenshot di posisi scroll atas selalu terlihat "terpotong".** Untuk uji bottom nav,
  `scrollTo(0, scrollHeight)` lalu bandingkan `navTop` vs `bottom` elemen terakhir.
- **Auto-screenshot bisa menipu.** `MCTheme.set()` bekerja, tapi headless default ke light —
  screenshot "dark" pernah identik byte-per-byte dengan "light". Assert `data-theme` sebelum ambil.

Sebelum deploy, urutannya tidak boleh dibalik:

```bash
for f in js/*.js; do node --check "$f"; done   # 15 file
python3 build.py                                # tempel hash; gagal kalau ada aset terlewat
# naikkan VERSION di sw.js
git add -A && git commit && git push origin master
curl -s "https://rmndkyl.github.io/motorcare/?nc=$RANDOM" | grep -o 'v=[a-f0-9]*' | sort -u
```

Push yang berhasil **bukan** bukti build tersaji. Yang membuktikan: hash aset di HTML yang
benar-benar dimuat browser.

### 3. Yang SUDAH selesai dan terverifikasi (jangan dikerjakan ulang)

- 5 halaman: Home, Garasi, Perawatan (Servis/Pengingat/Pemeriksaan), Riwayat (Timeline/Kerusakan/Pengeluaran/Odometer), Profil
- **Komponen pemeriksaan per-segmen** (`SEGMENT_COMPONENTS`): matic 12 komponen tanpa rantai,
  manual 12 tanpa CVT. 4/4 segmen konsisten antara pengingat dan grid. Penyebut skor menyesuaikan.
- **Pengingat sadar-segmen**, termasuk penyaringan pengingat mustahil yang terlanjur tersimpan
  dari build lama (matic dapat "Rantai & gear" — disaring dari engine + UI tanpa menghapus data user)
- **Penjelasan skor** yang bisa dibuka: rumus dengan angka asli, bobot + nilai per komponen,
  tiap penalti, dan daftar komponen yang dikeluarkan dari penyebut
- **Status pemeriksaan tak dikenal tidak lagi dianggap "Sehat"** (dulu jatuh ke `CHECK_STATUS[0]` = 100)
- **State async**: `aria-busy` + `disabled` + spinner pada simpan/impor/ekspor/laporan/wipe
- **Penanda asal interval** (`INTERVAL_SOURCE.verified=false`) tampil di tab Pengingat + form motor
- Tema gelap + terang, ikut HP atau dipaksa, persist di localStorage
- Offline penuh, hash URL aset anti-cache-basi, backup JSON dengan sanitasi saat impor, CSP
- **Diukur di produksi (`f0440e1e40`):** kontras 119 pasangan/tema 0 gagal (5.11 gelap / 4.43 terang),
  bottom nav tidak menutupi, target sentuh 0 di bawah 24px, 0 console error, PWA standalone,
  offline lulus 2 cara, impor 30 entri 0 ditolak, ekspor round-trip identik

Skor anti-slop: **79 → 88** (rubrik 100 poin buatan, lihat `_audit/AUDIT-SESUDAH.md` bagian 2).

### 4. Celah yang MASIH terbuka (mulai dari sini, urut prioritas)

**P1 — Interval belum dari buku servis.** `matic-lama` memberi oli 2.000 km/2 bln. Sumber publik
untuk Mio M3 saling bertentangan (dealer 3.000 km/3 bln, blog resmi Yamaha 4.000 km/6 bln, service
manual 8.000–12.000 km oli transmisi). Sekarang sudah **jujur** ditandai belum terverifikasi, tapi
angkanya masih tebakan. Kalau user punya buku servis fisik/PDF resmi, angka itu yang dipakai dan
`INTERVAL_SOURCE` diubah ke `verified: true` **beserta sumbernya**.

**P2 — Tiga potongan skor anti-slop yang tersisa, semuanya terukur:**
- `font-size` inline tersebar di template string (13px, 12.5px, 11.5px, 10px) — skala tipografi
  tidak ditegakkan. Ini penyebab utama Visual Inconsistency tinggal 12/15.
- `pageIn` diputar di setiap `refresh()` data, bukan hanya saat ganti route — gerak tanpa
  perubahan informasi (Decorative Noise 13/15).
- "Catat servis terakhir" muncul di Home dan Perawatan→Pengingat dengan kalimat berbeda
  untuk aksi yang sama (Repetitive UX 13/15).

**P2 — Blok onboarding masih feature-grid generik** (4 item ikon+judul+sub). Satu-satunya
alasan Generic Pattern tinggal 17/20.

**P3 — Belum ada push notification.** Pengingat hanya muncul saat app dibuka. Web Push di iOS
sangat terbatas; kalau dikerjakan, dokumentasikan batasnya jangan disembunyikan.

### 5. Yang JANGAN dikerjakan

- **Jangan tanya "mana backend/database/auth" lalu membuatnya.** Tidak ada, dan itu memang
  desainnya. Kalau dokumen meminta audit backend: tidak ada backend, jadi seluruh kontrol sisi
  server tidak berlaku; fokus ke klien (XSS, CSP, data lokal, supply chain).
- **Jangan memasang enkripsi IndexedDB** dengan kunci yang disimpan di tempat yang sama. Itu
  keamanan palsu dan sudah dijelaskan sebagai batasan di README.
- **Jangan mengganti desain.** Dark otomotif + aksen oranye adalah identitas. Satu-satunya nilai
  warna yang boleh diubah adalah kalau gagal ukur kontras, dan harus disertai angka sebelum/sesudah.
- **Jangan menambah card/komponen supaya halaman "terlihat lebih penuh".**
- **Jangan mengklaim skor/status apa pun tanpa angka yang bisa ditunjuk.**
- **Jangan hitung skor anti-slop sekali saja di akhir.** Tanpa baseline pembanding, angka itu
  tidak bisa dibantah dan tidak bisa dipercaya.

### 6. Aturan bukti (tidak bisa dinegosiasi)

- Klaim "berhasil" wajib punya bukti yang bisa ditunjuk: output perintah, isi file, hasil ukur, screenshot.
- **Ukur, jangan lihat.**
- Kalau ada dua angka bertengkar, cari pengukuran ketiga yang independen. Jangan pilih yang enak.
- Kalau ada yang tidak bisa diverifikasi, tulis **UNVERIFIED** dengan alasan — jangan diisi tebakan.
- **Curigai alat ukur sendiri lebih dulu.** Empat kesalahan metode terjadi di sesi lalu, dan
  keempatnya salah di alat ukur, bukan di kode. Daftar lengkap: `_audit/AUDIT-SESUDAH.md` bagian 5.

### 7. Bentuk keluaran yang diminta

1. **Tabel inspeksi** — Area | Kondisi | Masalah | Prioritas. Isi hanya dengan temuan yang kamu
   buktikan sendiri. Kalau sebuah area bersih, tulis bersih.
2. **Skor anti-slop** dengan 6 kategori yang sama seperti baseline, beserta alasan tiap potongan.
3. **Rencana perbaikan** urut P0→P3, satu item satu alasan yang bisa diuji.
4. Baru eksekusi, satu item per langkah, verifikasi tiap langkah.

---

## Catatan untuk user (bukan bagian prompt)

1. **Dokumen direktif ChatGPT itu tidak membaca kode.** Seluruh isinya premis, bukan temuan.
   Prompt di atas membawa fakta proyek versi terukur supaya sesi baru tidak mulai dari asumsi salah.

2. **Sesi lalu menemukan dua bug nyata yang tidak ada di dokumen mana pun** — keduanya berasal dari
   pekerjaan sendiri sebelumnya: (a) motor matic diberi pengingat rantai yang mustahil dikerjakan,
   (b) status pemeriksaan tak dikenal diam-diam dianggap "Sehat" sehingga skor bisa jadi 100 dari
   data rusak. Itu contoh kenapa audit harus dimulai dari kode, bukan dari daftar fitur.

3. **Klaim kontras lama di README ("11/11 PASS") bukan salah hitung, tapi salah cakupan.** Pasangan
   yang paling sering dilihat (putih di atas tombol primary) justru tidak diukur, dan nilainya
   3.89:1 — gagal AA. Sekarang 174 pasangan per tema, 0 gagal. Pelajarannya: sampel yang terlalu
   sedikit lebih berbahaya daripada rumus yang salah, karena hasilnya terlihat meyakinkan.
