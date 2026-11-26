# MOTORCARE — AUDIT SESUDAH PERBAIKAN

Diukur 26 Nov 2026 pada build `motorcare-v2.4.0`, hash aset `f0440e1e40`.
Mesin ukur & data uji identik dengan baseline: Chromium 390×844 DPR 2, `id-ID`, `Asia/Jakarta`,
origin/port baru, cache `no-store`, **backup asli user** (1 motor · 1 servis · 15 pemeriksaan · 12 pengingat).

Pembanding: `AUDIT-BASELINE.md` / `baseline.json`. Hasil sesudahnya: `final.json`, `after.json`, `edge.json`.

---

## 1. Tabel inspeksi — sesudah

| Area | Sebelum | Sesudah | Bukti |
|---|---|---|---|
| Komponen per-kendaraan | **P0 rusak** — manual ditanya CVT, penyebut tetap 13 | **Selesai** — 4/4 segmen konsisten | `p0_all_segments_consistent: true`. Matic 12 komponen tanpa rantai, manual 12 tanpa CVT. Form pemeriksaan motor manual menawarkan 12 komponen, `offersCvt: false` |
| Pengingat rantai untuk matic | **Bug ditemukan saat audit** | **Selesai** — matic tidak lagi dapat pengingat rantai | `reminderHasRantai: false` untuk `matic-baru` & `matic-lama`. README sudah lama menjanjikan ini; kode sekarang cocok dengan dokumen |
| Data lama (pengingat mustahil tersimpan) | Akan tetap tampil | **Selesai** — disaring tanpa menghapus data | Backup asli menyimpan `rantai-gear` di DB; `hasRantai: false` di engine, `showsRantai: false` di UI, baris tetap ada di IndexedDB |
| Status asing → skor 100 | **Bug nyata** — `CHECK_STATUS[0]` = Sehat | **Selesai** — dikeluarkan dari penyebut | Bike dengan satu-satunya check berstatus `RUSAK_TOTAL` → skor `null`, bukan 100. Sanitizer impor menulis ulang ke `perlu-diperiksa` |
| Kontras tema terang | **Gagal AA** — 3.89 / 3.92 | **Lulus** — 5.20 (kanvas), 174 pasangan 0 gagal | Aksen L 0.615 → 0.55, hue & chroma tetap |
| Asal angka interval | Tidak ada penanda | **Selesai** — peringatan eksplisit di 2 tempat | Tab Pengingat + form motor menampilkan "belum diverifikasi ke buku servis … bukan dari buku servis varian motormu" |
| Penjelasan skor | Hanya 3 faktor teratas | **Selesai** — panel bisa dibuka | Rumus `(100×3 + …) ÷ 26 = 100 dasar`, 12 baris komponen + bobot, bagian penalti, catatan komponen yang dikeluarkan |
| State async | 0 `aria-busy`, tanpa spinner | **Selesai** — 5 kontrol | `aria-busy: true` + `disabled: true` selama proses, `::after` spinner 15px `animation: spin`, pulih setelah selesai |
| Skenario F (multi-motor) | Belum diuji | **Lulus 9/9** | Tidak ada kebocoran data dua arah; kartu Garasi menampilkan odometer masing-masing |
| Console CSP | 2 error tiap load | **0 error** | `frame-ancestors` dihapus dari `<meta>` (diabaikan browser), clickjacking tetap tertutup |
| Reflow 320px | Bersih | Tetap bersih, termasuk panel skor terbuka | `scrollWidth 320 == innerWidth 320` |
| Bottom nav | Bersih | Tetap bersih | `navTop 782` vs `lastElBottom 764` |
| Target sentuh | 0 di bawah 24px | Tetap 0 | — |
| Enkripsi lokal | Tidak ditulis | **Selesai** — batas + alasan di README | Bagian "Batasan yang jujur" |

Tidak ada area yang saya nyatakan bersih tanpa angka.

---

## 2. Skor anti-slop: **79 → 88**

Rubrik sama, kategori sama, penilaian dilakukan oleh saya dengan bukti yang sama seperti baseline.

| Kategori | Maks | Sebelum | Sesudah | Yang berubah |
|---|---|---|---|---|
| Generic Pattern | 20 | 17 | 17 | Tidak disentuh. Blok onboarding feature-grid masih generik (potongan 3 tetap) |
| Visual Inconsistency | 15 | 11 | 12 | Panel skor memakai token warna & skala tipografi, bukan inline acak. +1 karena komponen baru konsisten; sisa potongan 3 adalah `font-size` inline lama yang belum dibereskan |
| Decorative Noise | 15 | 13 | 13 | Tidak berubah. `pageIn` masih diputar pada refresh data |
| Context & Content | 15 | 11 | **15** | Dua potongan utamanya hilang: kontradiksi komponen/CVT selesai (P0), dan angka interval tidak lagi disajikan sebagai fakta pabrikan |
| Fake Functionality | 20 | 15 | **18** | Skor sekarang bisa diperiksa (rumus + bobot + penalti + komponen dikecualikan), dan status asing tidak lagi diam-diam jadi "Sehat". Sisa potongan 2: `SEGMENT_INTERVALS` masih titik awal, hanya sekarang jujur soal itu |
| Repetitive UX | 15 | 12 | 13 | "Catat servis terakhir" di Home dan Pengingat kini mengarah ke aksi yang sama dengan konteks yang dibedakan; potongan 2 tersisa untuk duplikasi CTA yang masih ada |
| **Total** | **100** | **79** | **88** | |

**Batas dari angka ini:** rubrik 100 poin ini buatan, bukan standar industri. Fungsinya hanya
membandingkan build yang sama sebelum dan sesudah pada aplikasi yang sama. Skor 88 tidak berarti
"aplikasi bagus" — artinya 9 poin perbaikan terukur dari 79. Kategori yang tidak saya sentuh
(Generic Pattern, Decorative Noise) sengaja tidak naik, karena menaikkannya tanpa perubahan nyata
akan membuat angka ini tidak berarti apa-apa.

Kalau dihitung sekali saja di akhir tanpa baseline, angka 88 tidak bisa dibantah dan tidak bisa
dipercaya. Yang membuatnya berguna adalah 79 yang tercatat lebih dulu.

---

## 3. Yang TIDAK dikerjakan (sengaja)

| Item | Alasan |
|---|---|
| Backend, akun, sinkronisasi | Tidak ada dan itu memang desainnya. Seluruh kontrol sisi server tidak berlaku; audit fokus ke klien |
| Enkripsi IndexedDB | Kunci yang disimpan bersama data hanya keamanan palsu. Ditulis sebagai batas di README, bukan dipasang |
| Mengganti desain | Dark otomotif + aksen oranye adalah identitas dan sudah lolos ukur. Yang diubah hanya satu nilai lightness karena gagal kontras |
| Menambah card/komponen | Dilarang dokumen bagian 05. Panel skor bukan card baru — ia membuka data yang sudah dihitung |
| Angka interval "resmi" per varian | Tidak ada satu sumber yang bisa ditunjuk. Menyajikan tebakan sebagai angka pabrikan justru kesalahan yang diperbaiki di sini |
| `pageIn` pada refresh, `font-size` inline, CTA ganda | Terukur, tapi bukan prioritas P0–P2. Tercatat di skor sebagai potongan yang jujur |

---

## 4. Verifikasi akhir (build `f0440e1e40`)

| Pemeriksaan | Hasil |
|---|---|
| `node --check` 15 file JS | 0 error |
| `python3 build.py` | 17 aset, hash tunggal `f0440e1e40` |
| `sw.js` VERSION | `motorcare-v2.4.0` |
| Kontras gelap | 174 pasangan, **0 gagal**, terendah 5.11 (teks 14px, ambang 4.5) |
| Kontras terang | 174 pasangan, **0 gagal**, terendah 4.43 (teks 19px/800, ambang 3.0) |
| Kontras panel skor terbuka | 23 pasangan/tema, 0 gagal (5.11 / 5.28) |
| Console | 0 error, 0 warning, 0 pageerror di 10 route/tab |
| Reflow 320px | `320 == 320`, termasuk panel terbuka |
| Target sentuh | 0 elemen < 24×24 |
| Simpan pemeriksaan end-to-end | Tersimpan, skor turun 100 → 93 saat oli "perlu perawatan" |
| Status asing | Skor `null` (bukan 100), komponen dikecualikan |

### Uji integrasi (`_audit/integration.py`)

| Jalur | Hasil | Angka |
|---|---|---|
| Impor backup asli lewat `sanitizeRow` + loop Store | Lulus | 30 entri masuk, 0 ditolak → 1 motor, 1 servis, 15 pemeriksaan, 12 pengingat, 1 odometer |
| Ekspor → JSON → baca ulang | Lulus | 8 store, jumlah baris identik, foto data URL utuh, 418 KB |
| Hitung ulang pengingat setelah catat servis | Lulus | oli 12.168 → 13.168 km, `nextKm` 14.168 → 15.168 (interval 2.000 tetap) |
| Tema tersimpan setelah reload | Lulus | `data-theme: light`, `localStorage: light`, aksen `oklch(0.550 0.170 45)` |
| Service worker | Lulus | aktif, cache `motorcare-v2.4.0`, **45 aset** tersimpan |
| **Offline — perangkat** (`set_offline`) | **Lulus** | nav + konten render, data 1 motor "PCX MANDAYY" utuh, **tulis data tetap jalan** |
| **Offline — server mati** (socket ditutup) | **Lulus** | app tetap terbuka dengan data utuh |
| Console selama semua di atas | 0 error | — |

Catatan metode: percobaan offline pertama saya **timeout 15 detik** dan terlihat seperti app gagal offline. Penyebabnya harness, bukan aplikasi: `httpd.shutdown()` menghentikan loop tapi **tidak menutup socket**, jadi koneksi menggantung alih-alih ditolak, dan `.catch()` di service worker tidak pernah jalan. Setelah `server_close()` dipanggil, keduanya lulus. Ini kesalahan metode keempat di sesi ini — dan yang paling menipu, karena hasilnya terlihat seperti bug produk.

Screenshot: `_audit/shots/clean-01..08`.

### Verifikasi produksi (`_audit/live.py`, build `f0440e1e40`)

Bukan build lokal — URL live `https://rmndkyl.github.io/motorcare/` diuji ulang setelah push:

| Pemeriksaan | Hasil |
|---|---|
| Hash aset yang benar-benar disajikan | `f0440e1e40`, 16 script ber-hash |
| Komponen per-segmen di produksi | 4/4 konsisten (matic tanpa rantai, manual tanpa CVT) |
| Panel skor | Ada, 13 baris, rumus terender |
| Peringatan asal interval | Tampil |
| Kontras gelap / terang | 119 pasangan, **0 gagal** (5.11 / 4.43) |
| Bottom nav | `navTop 782` vs `lastElBottom 764` — tidak menutupi |
| Target sentuh | 0 di bawah 24px |
| PWA | manifest OK, `display: standalone`, 3 ikon, service worker aktif |
| Console | 0 error, 0 warning |

Ini penting karena push yang berhasil ≠ build yang tersaji. GitHub Pages bisa menyajikan build
lama dari cache; yang membuktikan deploy berhasil adalah hash aset di HTML yang benar-benar
dimuat browser, bukan status `git push`.

---

## 5. Catatan metode — empat kesalahan yang saya buat di sesi ini

Ini dicatat supaya tidak terulang, bukan untuk membela diri.

1. **Menyatakan Garasi "membocorkan" data motor lain.** Salah. Garasi memang daftar semua motor.
   Probe pertama saya menuduh bug tanpa membaca maksud halaman. Kesalahan ini lebih mahal dari
   salah hitung, karena bisa memicu perbaikan yang merusak fitur.
2. **Mengukur CSS `::after` setelah `await` selesai.** Spinner sempat terbaca `animation: none`
   karena keadaan tombol sudah dipulihkan. Yang benar: ambil `getComputedStyle` **selama** proses
   berjalan, di antara pemanggilan dan `await`.
3. **Menguji skor dengan tanggal yang sama** dengan pemeriksaan yang sudah ada. Tie-break
   `>=` mempertahankan baris lama, jadi skor tidak berubah dan saya hampir menyimpulkan engine-nya
   rusak. Yang benar: tanggal harus lebih baru, atau pakai motor baru yang bersih.
4. **Menyimpulkan app gagal offline dari timeout harness.** `httpd.shutdown()` menghentikan loop
   tapi tidak menutup socket, jadi koneksi menggantung dan `.catch()` di service worker tidak
   pernah jalan. Setelah `server_close()`, offline lulus 2/2 cara. Ini yang paling menipu dari
   keempatnya: hasilnya terlihat persis seperti bug produk, dan saya hampir mencatatnya begitu.

Pola keempatnya sama: **alat ukur saya lebih sering salah daripada kodenya.** Karena itu setiap
angka di dokumen ini punya dua sumber kalau bisa — kontras diukur dengan kanvas dan dihitung ulang
manual dari oklch, deploy dicek lewat hash aset dan bukan status push.

Dua kesalahan dari sesi sebelumnya tetap berlaku dan berhasil dihindari: parser regex pada
`getComputedStyle` (diganti rasterisasi canvas + verifikasi hitung manual oklch), dan menyimpulkan
dari screenshot posisi scroll atas (diganti `scrollTo(0, scrollHeight)` + perbandingan koordinat).

Satu kesalahan pengukuran lagi yang ketahuan di sesi ini: **klaim "11/11 PASS" di README lama
bukan salah hitung, tapi salah cakupan** — 11 pasangan tidak mewakili seluruh permukaan teks, dan
justru pasangan yang paling sering dilihat (putih di atas tombol primary) yang tidak diukur.
Sampel yang salah cakupan lebih berbahaya daripada rumus yang salah, karena hasilnya terlihat
meyakinkan.
