# MOTORCARE — Roadmap & Modal Produksi

Dibuat 26 Nov 2026. Semua angka biaya dari sumber publik yang dicek hari ini
(lihat bagian Sumber). Kurs: **1 USD = Rp 18.227** (er-api, 25 Nov 2026).

---

## 1. Tujuan

**Satu kalimat:** menjadikan MOTORCARE sebagai *buku servis digital* yang dipakai rutin
oleh pemilik motor Indonesia — dan dibayar oleh **bengkel**, bukan oleh pemilik motor.

Alasan arah itu ada di bagian 4: dengan harga konsumen yang realistis di Indonesia,
butuh 32–53 pelanggan aktif hanya untuk menutup biaya server. Dengan model bengkel,
2 bengkel sudah cukup.

### Yang bukan tujuan
- Bukan aplikasi diagnosis. Tidak ada sensor, tidak ada OBD. Skor hanya dari input user.
- Bukan marketplace sparepart / booking bengkel (itu produk lain, jangan dicampur).
- Bukan "super app kendaraan". Satu masalah, diselesaikan benar.

---

## 2. Baseline: apa yang SUDAH ada (terverifikasi 26 Nov 2026)

| Item | Status | Bukti |
|---|---|---|
| Aplikasi PWA | Live | https://rmndkyl.github.io/motorcare/ |
| Fungsi inti | Jalan | tambah motor → 12 reminder → servis 24.500km → reminder 26.500km → skor 70% |
| Offline | Jalan | server dimatikan → app tetap buka, data utuh, input tersimpan |
| Console error | 0 | semua route + 7 form disapu |
| Font asli | Ter-load | `document.fonts.check` = true |
| Repo | Publik | github.com/rmndkyl/motorcare (commit 6b10b1a) |
| Backend | **Tidak ada** | data di IndexedDB perangkat |
| Akun user | **Tidak ada** | tanpa login |
| Push notification | **Tidak ada** | reminder hanya saat app dibuka |
| Uji di HP user | **Belum** | kill criterion council masih terbuka |

**Titik lemah yang menentukan seluruh roadmap:** tanpa backend, aplikasi ini tidak bisa
punya akun, sinkronisasi, atau notifikasi. Dan tanpa tiga hal itu, tidak ada yang mau bayar
untuk versi berikutnya. Jadi backend adalah gerbang, bukan fitur.

---

## 3. Roadmap — 4 fase, tiap fase punya gerbang yang bisa diuji

### FASE 0 — Validasi nyata (1–2 minggu, Rp 0)

**Tujuan:** membuktikan aplikasi ini dipakai, bukan hanya dikagumi.

| Langkah | Selesai kalau |
|---|---|
| Buka di HP sendiri, install ke home screen | terpasang, dipakai 7 hari berturut |
| Isi data motor asli (servis, odo, biaya) | ≥ 5 catatan servis nyata |
| Ekspor backup JSON, lalu impor balik | data utuh, 0 entri hilang |
| Bagikan ke 10 pemilik motor (WA/grup) | ≥ 5 orang membuka, ≥ 2 orang isi ≥ 1 motor |
| Tanya 5 pemilik motor: "mau bayar berapa?" | dapat angka, bukan asumsi |

**Gerbang Fase 0 → 1:** minimal **3 dari 10** orang mengisi data motor DAN minimal **1 orang**
bilang akan bayar (dengan angka). Kalau tidak tercapai: **berhenti, jangan bangun backend.**
Aplikasi tetap hidup gratis sebagai portofolio.

### FASE 1 — Backend minimum (3–4 minggu, modal Rp 0–7,4jt tergantung pilihan)

**Tujuan:** akun + sinkronisasi. Bukan menambah fitur, tapi memindahkan data dari
"milik satu HP" ke "milik satu akun".

Arsitektur yang dipilih: **Supabase** (Postgres + Auth + Storage + Row Level Security).

| Langkah | Kenapa Supabase |
|---|---|
| Skema 9 tabel mengikuti IndexedDB yang sudah ada | migrasi jadi pemetaan, bukan desain ulang |
| Auth email + OTP | tanpa password, cocok kebiasaan Indonesia |
| RLS per `user_id` | syarat "setiap pengguna hanya akses data sendiri" dari brief awal |
| Storage bucket untuk foto | foto tidak lagi masuk JSON backup |
| Mode offline tetap jalan | IndexedDB jadi cache, sync saat online |

**Aturan migrasi yang tidak boleh dilanggar:** user yang sudah punya data lokal harus bisa
klaim datanya saat pertama login. Kalau login menghapus data lokal, produk ini sudah
mengkhianati janjinya sendiri.

**Gerbang Fase 1 → 2:** dua perangkat berbeda (HP + laptop) login akun sama, lihat data sama;
matikan internet di satu perangkat, tambah catatan, nyalakan → catatan muncul di perangkat lain
tanpa duplikat. Diuji dengan data asli, bukan data demo.

### FASE 2 — Notifikasi (2–3 minggu, biaya variabel)

**Tujuan:** reminder yang benar-benar sampai, karena inilah satu-satunya alasan orang
kembali membuka aplikasi.

Tiga jalur, urut dari murah:

| Jalur | Biaya | Kenapa |
|---|---|---|
| Web Push (PWA) | Rp 0 | jalan di Android; iOS terbatas, harus ditulis apa adanya |
| Email | Rp 0 (Gmail app password yang sudah ada) | untuk yang tidak install PWA |
| WhatsApp utility | ~Rp 365–456/pesan | paling efektif di Indonesia, tapi bayar per pesan |

**Jangan mulai dari WhatsApp.** Mulai dari Web Push + email (gratis). WhatsApp hanya untuk
user yang membayar, supaya biaya per pesan tertutup pendapatan.

**Gerbang Fase 2 → 3:** ≥ 30% user yang menerima reminder membuka aplikasi dalam 48 jam.
Kalau di bawah itu, masalahnya bukan saluran notifikasi — masalahnya reminder-nya tidak
dianggap penting, dan menambah saluran tidak akan memperbaikinya.

### FASE 3 — Salah satu dari dua jalur bisnis (pilih SETELAH Fase 0)

#### Jalur A — B2C: Play Store + freemium

| Langkah | Catatan biaya |
|---|---|
| Google Play Console | $25 sekali (Rp 455.675) |
| Wajib 12 tester × 14 hari untuk akun personal | **gratis tapi lambat** — ini penentu jadwal, bukan uang |
| Bungkus PWA jadi AAB (Bubblewrap/TWA) | Rp 0 |
| Fitur premium: multi-motor tanpa batas, backup cloud, ekspor PDF | pembeda harus jelas |

**Angka jujurnya:** untuk menutup burn Rp 476.508/bulan, dengan harga Rp 9.000/bulan butuh
**53 pelanggan aktif**; dengan Rp 15.000 butuh **32**; dengan Rp 25.000 butuh **19**.
Itu bukan angka mustahil, tapi juga bukan angka yang datang sendiri tanpa pemasaran.

#### Jalur B — B2B: bengkel (rekomendasi)

Bengkel punya masalah yang sama tapi dengan uang: riwayat servis pelanggan tercerai-berai
di buku tulis. Produk untuk mereka bukan aplikasi ini apa adanya — perlu tambahan:
cari pelanggan lewat plat nomor, riwayat per pelanggan, cetak/WA rekap servis, ekspor.

| Langkah | Biaya |
|---|---|
| Riset 10 bengkel: apakah mau pakai? bayar berapa? | Rp 0, tapi ini yang menentukan |
| Tambahan fitur multi-pelanggan | waktu, bukan uang |
| Onboarding 3 bengkel pertama secara manual | Rp 0 |

**Angka jujurnya:** Rp 250.000/bulan per bengkel → **2 bengkel** sudah menutup burn.
Modal Rp 7,4jt balik dalam **9,6 bulan dengan 5 bengkel**, atau **3,7 bulan dengan 10 bengkel**.

**Gerbang Fase 3:** minimal 2 bengkel membayar 2 bulan berturut-turut, atau minimal 19
pelanggan B2C aktif. Di bawah itu: hentikan pengeluaran, kembali ke Fase 0.

---

## 4. Modal awal — tiga skenario

### Skenario A — Rp 0 (kondisi sekarang)

PWA statis, data di perangkat, backup JSON manual. Sudah live. **Tidak perlu modal.**
Batasnya: tanpa akun, tanpa sync, tanpa push, satu perangkat.

### Skenario B — Rp 7.408.530 (rekomendasi kalau mau serius)

| Komponen | Biaya |
|---|---|
| Supabase Pro (12 bulan × $25) | Rp 5.468.100 |
| Domain .id (12 bulan) | Rp 250.000 |
| Google Play Console (sekali) | Rp 455.675 |
| Hosting (Cloudflare/GitHub Pages) | Rp 0 |
| **Subtotal** | **Rp 6.173.775** |
| Cadangan 20% (kurs naik / biaya tersembunyi) | Rp 1.234.755 |
| **TOTAL** | **Rp 7.408.530** (~$406) |

Burn setelah tahun pertama: **Rp 476.508/bulan**.

**Bisa ditekan:** Supabase Free (Rp 0) cukup untuk Fase 1–2 selama masih < 500MB database.
Free tier **pause setelah 7 hari tanpa aktivitas** — itu tidak masalah untuk development,
tapi tidak layak untuk produksi. Jadi: mulai Free, naik ke Pro saat ada user nyata.

Versi hemat: **Rp 705.675** (domain + Play Console, Supabase tetap Free).

### Skenario C — Rp 27.268.060 (produksi luas: iOS + WA reminder + desain)

| Komponen | Biaya |
|---|---|
| Supabase Pro (12 bulan) | Rp 5.468.100 |
| Domain .com + .id | Rp 450.000 |
| Google Play Console | Rp 455.675 |
| Apple Developer (12 bulan) | Rp 1.804.473 |
| WhatsApp utility: 1.000 user × 2 pesan/bln × 12 | Rp 10.936.200 |
| Desain/brand (logo, ikon, screenshot store) | Rp 1.500.000 |
| Uji perangkat (HP sewa/beli bekas) | Rp 1.200.000 |
| **Subtotal** | **Rp 21.814.448** |
| Cadangan 25% | Rp 5.453.612 |
| **TOTAL** | **Rp 27.268.060** (~$1.496) |

Burn setelah tahun pertama: **Rp 643.548/bulan**.

**Catatan penting:** Rp 10,9jt dari total itu adalah WhatsApp. Itu **biaya variabel** yang
baru masuk akal kalau ada pendapatan per user. Membayarnya sebelum ada pelanggan = membakar
uang untuk reminder yang belum tentu dibaca.

### Yang TIDAK perlu dibeli sekarang

| Item | Kenapa ditunda |
|---|---|
| Apple Developer ($99) | iOS butuh Mac untuk build yang andal; uji dulu di PWA |
| WhatsApp API | biaya per pesan; tunggu ada yang bayar |
| Iklan (Google/Meta Ads) | Rp 50rb/hari = Rp 1,5jt/bulan, tanpa bukti konversi |
| VPS baru | Supabase + Pages sudah cukup; VPS sg1 sudah dipakai fleet lain |
| Jasa desain mahal | ikon & tampilan sudah ada, sudah diuji di HP |

---

## 5. Prioritas kalau modal cuma Rp 0

Urut dari yang paling menentukan, semua gratis:

1. **Uji di HP kamu sendiri** dan pakai 7 hari. Kill criterion council bergantung ini.
2. **Tanya 5 pemilik motor** mau bayar berapa. Ini menentukan Jalur A vs B.
3. **Aktifkan Supabase Free**, pindahkan skema. Nol rupiah, dan mengubah produk dari
   "catatan di HP" menjadi "akun".
4. **Web Push + email** untuk reminder. Nol rupiah.
5. Baru bicara uang setelah 1–4 ada buktinya.

---

## 6. Kill criteria (kapan berhenti, bukan kapan lanjut)

| Kondisi | Tindakan |
|---|---|
| 10 orang dikasih akses, < 3 mengisi data dalam 2 minggu | Berhenti. Masalahnya bukan fitur. |
| 5 pemilik motor ditanya, 0 mau bayar | Turunkan ambisi ke portofolio, jangan belanja server |
| 10 bengkel ditanya, < 2 tertarik | Jalur B mati, jangan paksakan |
| Reminder dibuka < 30% dalam 48 jam | Perbaiki isi reminder sebelum tambah saluran |
| Modal terpakai > Rp 3jt sebelum ada 1 pembeli | Hentikan pengeluaran, kembali ke Fase 0 |

---

## 7. Sumber angka (dicek 26 Nov 2026)

| Angka | Sumber |
|---|---|
| Supabase Pro $25/bln, Free 500MB + pause 7 hari | supabase.com/pricing |
| Apple Developer $99/tahun | developer.apple.com/programs |
| Google Play $25 sekali + aturan 12 tester/14 hari | developer guide 2026 |
| WhatsApp utility Indonesia $0,020–0,025/pesan | Meta rate card / aggregator 2026 |
| QRIS MDR 0–0,3% (bukan biaya developer) | BI |
| 139,4 juta sepeda motor Indonesia (BPS) | bps.go.id |
| Kurs 1 USD = Rp 18.227 | er-api 25 Nov 2026 |

**Inferensi (bukan fakta):** pembagian biaya per user, konversi 3-dari-10, dan estimasi
storage 2MB/motor-tahun. Itu model, bukan pengukuran — angka nyata baru ada setelah Fase 0.
