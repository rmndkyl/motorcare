# MOTORCARE — AUDIT BASELINE

Diukur 26 Nov 2026, sebelum satu baris kode diubah.
Mesin ukur: Chromium (patchright) 390×844, DPR 2, mobile, `id-ID`, `Asia/Jakarta`, cache `no-store`, origin/port baru setiap run.
Data uji: **backup asli user** (`motorcare-backup-2026-11-26.json`, 1 motor · 1 servis · 15 pemeriksaan · 12 pengingat), bukan data sintetis.

Skrip: `_audit/harness.py`, `_audit/baseline.py`, `_audit/reprobe.py`. Hasil mentah: `_audit/baseline.json`, `_audit/reprobe.json`, `_audit/*.log`.

---

## 1. Tabel inspeksi

| Area | Kondisi | Masalah | Prioritas |
|---|---|---|---|
| Komponen pemeriksaan per-kendaraan | **Rusak** | `MC.COMPONENTS` global 13 item dipakai untuk semua motor. Diverifikasi: motor `bebek-manual` tidak dapat pengingat CVT (11 reminder, `cvt` absen) tapi `healthScore.total` tetap **13** dan grid pemeriksaan tetap menawarkan CVT. `contradiction: true`. | **P0** |
| Kontras teks tema terang | **Gagal WCAG AA** | `--accent` terang `oklch(0.615 0.170 45)` + `--on-accent` putih = **3.89** (canvas) / **3.92** (hitung manual oklch→sRGB). Butuh 4.5 untuk teks normal. 6 pasangan gagal, semua di tombol/chip primary. README mengklaim "11/11 PASS" — klaim itu tidak mencakup pasangan ini. | **P1** |
| Asal angka interval | **Tidak berdasar** | `matic-lama` oli 2.000 km/60 hr. Tidak ada penanda asal di UI (`uiSaysUnverified: false`, `uiSaysManualBook: false`). Sumber publik saling bertentangan untuk Mio M3: dealer 3.000 km/3 bln, blog resmi Yamaha "minimal 6 bulan / 4.000 km", service manual menyebut 8.000–12.000 km untuk oli transmisi. | **P1** |
| Penjelasan skor | **Tidak lengkap** | Tidak ada rincian bobot, tidak ada nilai per komponen, tidak ada daftar penalti. `healthScore` sudah menghitung `base` dan `delta` tiap faktor tapi **tidak pernah dirender**. User tidak bisa memeriksa angka yang kita beri. | **P1** |
| State komponen async | **Kosong** | `aria-busy` = 0 di seluruh CSS dan JS. Tombol simpan/ekspor/impor/laporan/wipe tidak pernah `disabled` atau menunjukkan proses. Tidak ada spinner. Toast satu-satunya umpan balik, dan itu muncul **setelah** selesai. | **P2** |
| Skenario F (multi-motor) | **Bersih** | 9/9 pemeriksaan lolos. Data motor B tidak bocor ke tampilan motor A (home/care/history/profile), dan sebaliknya. Kartu Garasi menampilkan odometer masing-masing dengan benar (`12.168` vs `45.000`). Catatan: probe pertama saya salah — Garasi memang **sengaja** menampilkan semua motor, jadi kehadiran data motor lain di sana bukan kebocoran. | — |
| Reflow 320px | Bersih | `scrollWidth 320 == innerWidth 320`. | — |
| Bottom nav | Bersih | `scrollTo(0, scrollHeight)`: `navTop 782` vs `lastElBottom 764` — tidak menutupi konten. | — |
| Target sentuh | Bersih | 0 elemen < 24×24 px. | — |
| Console | Bersih | 0 error, 0 warning, 0 pageerror di 10 kombinasi route/tab. | — |
| `bike.segment` data lama | Perlu diketahui | Motor user `segment: null` (backup dibuat sebelum fitur segmen). Tebakan otomatis menyelamatkan tampilan, tapi `healthScore` tidak pernah memakai segmen sama sekali. | **P0** (akar) |
| Enkripsi data lokal | Belum ditulis | IndexedDB plaintext. Proporsional untuk catatan servis, tapi belum ada pernyataan batas ini di README. | **P3** |

Tidak ada temuan yang saya isi tanpa bukti. Area yang bersih saya tulis bersih.

---

## 2. Skor anti-slop baseline: **79 / 100**

Rubrik 100 poin ini **buatan** (6 kategori dari dokumen direktif), bukan standar industri. Nilainya hanya berarti sebagai pembanding sebelum/sesudah pada aplikasi yang sama — bukan sertifikat kualitas, dan tidak boleh dibandingkan dengan proyek lain.

| Kategori | Maks | Skor | Alasan potongan |
|---|---|---|---|
| Generic Pattern | 20 | **17** | Bukan template: dark otomotif, aksen oranye tunggal, Barlow Condensed untuk display, gauge ring buatan sendiri, badge plat, timeline bertitik warna. Tidak ada gradient text, tidak ada glassmorphism menyeluruh, tidak ada ikon emoji. Potong 3: blok onboarding memakai pola feature-grid 4 item ikon+judul+sub yang generik. |
| Visual Inconsistency | 15 | **11** | Warna hampir seluruhnya lewat token. Potong 4: `font-size` di-override inline di banyak tempat (`13px`, `12.5px`, `11.5px`, `10px` tersebar di template string), `#fff`/`#000` hardcoded di blok `@media print`, `%23999` di SVG panah select. Skala tipografi tidak ditegakkan. |
| Decorative Noise | 15 | **13** | Animasi & grafik punya fungsi (gauge = skor, bar = biaya/bulan, timeline = kronologi). Potong 2: `pageIn` diputar di setiap perubahan route, termasuk saat `refresh()` data — gerak tanpa perubahan informasi. |
| Context & Content | 15 | **11** | Bahasa Indonesia spesifik, nama komponen nyata, peringatan jujur "ini bukan diagnosis", tidak ada teks pengisi. Potong 4: konteks kendaraan dilanggar oleh P0 (motor manual ditanya CVT), dan angka interval disajikan sebagai fakta pabrikan padahal tebakan. |
| Fake Functionality | 20 | **15** | Tidak ada metrik palsu, tidak ada badge "AI-powered", mode lokal mengaku pencocokan pola dan bukan model bahasa — itu jujur. Potong 5: `SEGMENT_INTERVALS` memberi wewenang angka yang tidak diverifikasi, dan skor kesehatan tampil sebagai satu angka tunggal tanpa cara memeriksanya. Dua-duanya membuat aplikasi terlihat lebih tahu daripada yang sebenarnya. |
| Repetitive UX | 15 | **12** | 5 halaman, pola konsisten, tidak ada CTA yang menduplikasi fungsi. Potong 3: "Catat servis terakhir" muncul di Home dan di Perawatan→Pengingat dengan kalimat berbeda untuk aksi yang sama. |
| **Total** | **100** | **79** | |

---

## 3. Rencana perbaikan

Satu item, satu alasan yang bisa diuji.

| # | Item | Alasan yang bisa diuji | Prioritas |
|---|---|---|---|
| 1 | Komponen diturunkan dari `segment` | Motor `bebek-manual` harus memberi `total` < 13 dan grid pemeriksaan tanpa CVT. Diuji dengan probe sintetis per segmen. | P0 |
| 2 | `MC.resolveSegment()` dipakai `healthScore` | `healthScore` tidak boleh lagi membaca `MC.COMPONENTS` langsung; `total` harus sama dengan panjang daftar tersaring. | P0 |
| 3 | `--accent` terang L 0.615 → 0.55 | Rasio putih-di-atas-aksen harus ≥ 4.5. Target terukur: 5.20. | P1 |
| 4 | Penanda asal interval | Teks "belum terverifikasi" harus ada di UI, bukan hanya di komentar kode. | P1 |
| 5 | Rincian skor yang bisa dibuka | Bobot, nilai per komponen, dan tiap penalti harus terlihat; komponen yang belum diperiksa harus dinyatakan **dikeluarkan** dari penyebut. | P1 |
| 6 | State async pada 5 kontrol | Tombol simpan/ekspor/impor/laporan/wipe harus `disabled` + `aria-busy` selama proses. | P2 |
| 7 | Uji skenario F sebagai skrip | Bisa dijalankan ulang, bukan sekali lihat. | P2 |
| 8 | Batas enkripsi di README | Pernyataan tertulis bahwa IndexedDB plaintext dan kenapa enkripsi lokal palsu tidak dipasang. | P3 |

Yang **tidak** dikerjakan, sesuai direktif: tidak menambah backend, tidak mengganti desain yang sudah lolos ukur, tidak menambah card agar halaman terlihat penuh.

---

## 4. Dua kesalahan metode yang tidak boleh terulang

1. **Parser regex pada `getComputedStyle`.** Nilainya `oklch()`/`oklab()`. Regex yang mengharap `rgb()` gagal parse dan mengembalikan rasio 1 untuk semua pasangan — terlihat seperti "semua gagal" atau "semua lolos" tergantung default. Yang benar: rasterisasi ke canvas 1×1, baca `ImageData`, komposit alpha, baru hitung luminance.
2. **Menganggap data di luar lipatan layar sebagai hilang.** Screenshot pada posisi scroll atas selalu memotong bottom nav. Yang benar: `scrollTo(0, scrollHeight)` lalu bandingkan `navTop` dengan `bottom` elemen terakhir.

Kesalahan ketiga yang saya buat **di sesi ini** dan saya catat supaya tidak terulang: probe pertama menyatakan Garasi "membocorkan" data motor lain. Itu salah — Garasi memang daftar semua motor. Menyatakan bug tanpa membaca maksud halaman adalah kesalahan yang lebih mahal daripada salah hitung, karena bisa memicu perbaikan yang merusak fitur.
