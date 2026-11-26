# MOTORCARE

Buku kesehatan digital untuk sepeda motor pribadi. Mencatat servis, memantau kondisi
komponen, melacak biaya, dan mengingatkan jadwal perawatan — semuanya di HP kamu sendiri.

**Live:** https://rmndkyl.github.io/motorcare/

---

## Apa ini

MOTORCARE bukan aplikasi catatan servis biasa. Setiap motor punya **rekam jejak kesehatan**
sendiri sepanjang masa pemakaiannya: apa yang pernah diganti, kapan terakhir servis, berapa
biaya yang sudah keluar, kerusakan apa yang pernah terjadi, dan kapan perawatan berikutnya.

Keputusan bentuk produk (PWA, bukan APK) diambil lewat council deliberation — alasan dan
kill criteria-nya tercatat di `~/LYID-BOTS/_decisions/LEDGER.md`.

## Fitur

| Fitur | Keterangan |
|---|---|
| **Dashboard** | Foto motor, identitas, odometer, skor kesehatan, jadwal servis, ringkasan biaya |
| **Multi-motor** | Satu akun bisa menyimpan beberapa motor; ganti motor aktif dari tab Garasi |
| **Profil motor lengkap** | Merek, tipe, tahun, plat, nomor rangka & mesin, CC, warna, foto 3 sisi |
| **Catatan servis** | 12 jenis perawatan, multi-jenis per entri, bengkel, biaya, komponen diganti, foto nota |
| **Monitoring komponen per segmen** | 12 komponen untuk motor CVT, 12 untuk motor manual — CVT tidak ditanyakan pada motor manual, rantai tidak ditanyakan pada motor CVT |
| **4 tingkat status** | Sehat · Perlu diperiksa · Perlu perawatan · Harus segera ditangani |
| **Skor kesehatan** | Dihitung dari data pemeriksaan + jadwal terlewat + kerusakan terbuka + kesegaran odometer |
| **Riwayat kerusakan** | Gejala, bagian, prioritas, estimasi biaya, status penanganan, foto |
| **Pengingat 2 sumbu** | Berbasis KM **dan** tanggal; interval bisa diedit per pengingat |
| **13 template pengingat** | Servis awal 1.000 km, oli mesin, oli gardan, servis berkala, CVT, filter udara, busi, kampas rem, ban, aki, rantai, pajak, STNK |
| **Preset per segmen motor** | Interval otomatis menyesuaikan matic baru/lama, bebek manual, atau sport — bukan satu angka untuk semua motor |
| **Mode terang & gelap** | Ikut HP, atau pilih sendiri. Terang untuk dibaca di bawah sinar matahari |
| **Manajemen pengeluaran** | 7 kategori, total bulanan/tahunan, grafik 12 bulan, rata-rata per bulan |
| **Odometer** | Riwayat KM, delta antar catatan, jarak tempuh bulanan, grafik |
| **Timeline** | Seluruh kejadian motor dalam satu garis waktu |
| **Garasi digital** | Dokumen (STNK/BPKB/asuransi/faktur), catatan modifikasi, skor kelengkapan data |
| **Asisten AI** | Mode lokal offline (basis pengetahuan) + mode API key sendiri |
| **Backup** | Ekspor/impor JSON, ekspor laporan teks, hapus semua data |

## Yang sengaja TIDAK dilakukan

- **Tidak ada diagnosis otomatis.** Skor hanya mencerminkan apa yang kamu isi. Komponen yang
  belum diperiksa ditandai "Belum diperiksa" — bukan dianggap sehat.
- **Tidak ada klaim AI palsu.** Mode lokal adalah pencocokan gejala ke basis pengetahuan tetap,
  bukan model bahasa. Kalau tidak ada pola yang cocok, ia bilang tidak tahu.
- **Tidak ada backend.** Tidak ada server, tidak ada akun, tidak ada data yang dikirim ke mana pun.
  Request AI (kalau kamu isi API key) berangkat langsung dari HP ke provider pilihanmu.

## Cara pakai

### Di HP (disarankan)

1. Buka https://rmndkyl.github.io/motorcare/ di Chrome (Android) atau Safari (iOS).
2. Android: menu ⋮ → **Tambahkan ke layar utama**. iOS: Share → **Add to Home Screen**.
3. Buka dari ikon yang muncul — tampil fullscreen tanpa address bar, dan tetap jalan tanpa internet.

### Lokal

```bash
cd motorcare
python3 -m http.server 8899
# buka http://127.0.0.1:8899/
```

Service worker butuh `http://localhost` atau HTTPS — buka lewat `file://` akan jalan, tapi tanpa offline cache.

## Backup itu wajib

Data tinggal di IndexedDB browser. Kalau kamu hapus data browser, ganti HP, atau pakai mode
incognito, riwayat motor hilang permanen.

**Profil → Ekspor backup (JSON)** sebulan sekali. File itu bisa diimpor kembali di HP mana pun.

## Tech stack

Sengaja tanpa build step — buka `index.html` dan semuanya jalan.

| Lapisan | Pilihan | Alasan |
|---|---|---|
| UI | Vanilla JS + template string | Nol dependency, nol build, muat instan di HP kelas bawah |
| Data | IndexedDB (9 object store) | localStorage 5MB tidak cukup untuk foto |
| Styling | CSS custom properties, OKLCH | Satu sumber warna, dark mode native |
| Font | Barlow Condensed + Barlow (self-hosted, 148KB) | Tanpa CDN, jalan offline |
| Ikon | SVG inline | Tanpa font ikon, tanpa request |
| Offline | Service worker cache-first | Aset di-cache saat pertama buka |
| PWA | manifest.webmanifest | Installable, standalone display |

Struktur:

```
motorcare/
├── index.html
├── manifest.webmanifest
├── sw.js                  # service worker, cache-first untuk aset
├── css/app.css            # design system + komponen
├── js/
│   ├── core.js            # IndexedDB wrapper, helper tanggal/angka, kosakata domain
│   ├── domain.js          # skor kesehatan, mesin reminder, agregasi biaya, timeline
│   ├── icons.js           # ikon SVG inline + gauge
│   ├── ui.js              # sheet, toast, form control, photo picker
│   ├── state.js           # state global + loader data
│   ├── page-*.js          # 5 halaman
│   ├── forms.js           # 7 form (servis, kerusakan, biaya, odo, pengingat, cek, dokumen)
│   ├── data-io.js         # export/import/laporan/wipe
│   ├── ai.js              # asisten AI (lokal + API)
│   └── app.js             # router + event delegation
├── fonts/                 # 6 file woff2
└── icons/                 # ikon PWA 192/512
```

## Skor kesehatan: cara hitungnya

Berbobot per komponen (mesin/oli/rem depan/ban = 3, rem belakang/aki/kelistrikan/pendingin/rantai/CVT/bahan bakar = 2, suspensi/lampu = 1).

```
skor = Σ(skor_status × bobot) / Σ(bobot)     untuk komponen yang SUDAH diperiksa
```

**Penyebutnya per segmen, bukan angka tetap.** Motor CVT dan motor manual punya daftar
komponen berbeda (lihat tabel di bagian preset), jadi `Σ(bobot)` ikut berbeda. Motor manual
tidak dihitung "kurang" karena tidak punya CVT.

Status → skor: Sehat 100 · Perlu diperiksa 70 · Perlu perawatan 40 · Harus segera 10.

Lalu dikurangi:

| Kondisi | Penalti |
|---|---|
| Jadwal perawatan terlewat | −6 per item (maks −18) |
| Perawatan mendekati jadwal | −2 per item (maks −8) |
| Kerusakan kritis terbuka | −10 per item (maks −20) |
| Kerusakan prioritas tinggi terbuka | −5 per item (maks −10) |
| Odometer tidak diperbarui >90 hari | −5 |
| Belum pernah mencatat odometer | −5 |

Label: ≥80 Sehat · 60–79 Perlu Perhatian · 40–59 Bermasalah · <40 Bermasalah.

Tanpa satu pun pemeriksaan, skor = `—` dan labelnya "Belum ada data". Itu disengaja.

**Angka ini bisa diperiksa sendiri.** Di kartu skor ada tautan "Lihat cara hitung skor" yang
membuka rincian: rumus lengkap dengan angka aslinya, nilai tiap komponen beserta bobotnya,
tiap penalti yang diterapkan, dan daftar komponen yang **dikeluarkan** dari penyebut beserta
alasannya. Contoh dari data sungguhan:

```
(100×3 + 40×3 + 10×3) ÷ 9 = 50 dasar
50 − 16 penalti = 34
Dikeluarkan dari penyebut (9): Rem belakang, Ban, Suspensi, Aki, ...
```

Tanpa panel ini user hanya melihat satu angka yang tidak bisa dibantah — dan angka yang
tidak bisa diperiksa sama saja dengan tebakan dari sudut pandang user.

## Pengingat: dua sumbu

```
nextKm   = lastKm + intervalKm
nextDate = lastDate + intervalDays
status   = overdue kalau salah satu lewat; soon kalau salah satu ≤ soonKm/soonDays
```

`lastKm`/`lastDate` diambil otomatis dari servis terakhir dengan jenis yang cocok, atau
di-override manual per pengingat. Jadi catat servis → jadwal berikutnya langsung terhitung.

## Preset interval per segmen motor

Satu angka interval untuk semua motor itu salah: oli motor matic lama dan motor sport
butuh jarak yang berbeda. Aplikasi menyimpan empat preset dan memilih awalannya dari
transmisi + tahun motor (bisa diubah di form motor).

| Segmen | Oli mesin | Rantai | CVT / oli gardan |
|---|---|---|---|
| Matic / bebek ≤5 tahun | 4.000 km / 4 bln | **tidak dibuat** | ada |
| Matic / bebek >5 tahun | 2.000 km / 2 bln | **tidak dibuat** | ada |
| Bebek / manual | 3.000 km / 3 bln | 4.000 km / 4 bln | **tidak dibuat** |
| Sport / oli sintetik | 6.000 km / 4 bln | 4.000 km / 4 bln | **tidak dibuat** |

Motor manual tidak diberi pengingat CVT atau oli gardan karena komponennya tidak ada. Motor
matic tidak diberi pengingat rantai & gir karena rantai digantikan v-belt di dalam CVT.
Pengingat yang mustahil dikerjakan membuat daftar terasa penuh tapi tidak berguna.

Daftar **komponen pemeriksaan** memakai aturan yang sama (`SEGMENT_COMPONENTS`): motor matic
12 komponen tanpa rantai, motor manual 12 komponen tanpa CVT.

`servis-awal` (1.000 km) dibuat **nonaktif** secara default. Kalau aktif, motor yang sudah
60.000 km akan langsung menampilkan "terlewat 59.000 km" — angka benar secara aritmetika
tapi menyesatkan sebagai saran.

### Angka interval ini belum terverifikasi

**Yang tertulis di tabel di atas bukan angka buku servis.** Itu titik awal yang disusun dari
rekomendasi umum yang beredar di Indonesia (AHM: oli maksimal 4.000 km atau 4 bulan; Yamaha:
2.000 km/2 bulan untuk model lama, 4.000–5.000 km matic-bebek modern, 6.000 km sport dengan
pelumas sintetik).

Untuk Yamaha Mio M3 125 — motor yang jadi acuan preset `matic-lama` — sumber publiknya
**saling bertentangan**: dealer menyebut servis tiap 3.000 km / 3 bulan, blog resmi Yamaha
menyebut "minimal 6 bulan atau 4.000 km", dan service manual menyebut 8.000–12.000 km untuk
oli transmisi. Karena tidak ada satu angka resmi per varian yang bisa ditunjuk, semuanya
ditandai `INTERVAL_SOURCE.verified = false` dan UI menampilkan peringatan itu apa adanya di
tab Pengingat dan di form motor.

Kalau nanti angka per varian benar-benar didapat (buku servis fisik atau PDF resmi pabrikan),
ubah `INTERVAL_SOURCE` menjadi `verified: true` **beserta sumbernya** — jangan hanya
menghapus peringatannya. Semua pengingat tetap bisa diedit satu per satu oleh user.

Ubah tabelnya di `js/core.js` → `SEGMENT_INTERVALS`, daftar komponennya di `SEGMENT_COMPONENTS`.

## Tema terang & gelap

Default **ikut HP** (`prefers-color-scheme`), bisa dipaksa Gelap atau Terang dari Profil.
Pilihan disimpan di `localStorage`, jadi tetap berlaku setelah aplikasi ditutup.

Kenapa terang itu penting: layar OLED yang menyala terang di bawah sinar matahari justru
kalah oleh pantulan. Mode terang memakai latar `oklch(0.968)` dan menggelapkan semua warna
status — bukan sekadar membalik tema gelap, karena hijau/kuning versi gelap gagal kontras
di atas latar cerah.

Semua warna lewat token di `css/app.css` (`:root`/`[data-theme="dark"]` dan
`[data-theme="light"]`). Menambah komponen baru tidak perlu tahu tema yang aktif — cukup
pakai `var(--surface)`, `var(--text-2)`, dan seterusnya.

Tema dipasang oleh `js/theme.js` yang dimuat di `<head>` **sebelum** body dirender. Kalau
dipasang setelah boot, user melihat kedipan tema yang membuat aplikasi terasa lambat.
File itu tidak boleh diubah jadi inline script: CSP memakai `script-src 'self'` tanpa
`'unsafe-inline'`.

## Asisten AI

**Mode lokal (default)** — offline, tanpa key. 11 pola gejala di `js/ai.js` (`KB`), masing-masing
memetakan ke komponen, kemungkinan penyebab, yang bisa dicek, dan urgensi. Kalau tidak ada
kecocokan, jawabannya bilang tidak tahu dan menyarankan sebutkan gejala lebih spesifik.

**Mode API (opsional)** — isi Base URL + model + API key sendiri (OpenAI-compatible). Data motor
dikirim sebagai konteks supaya jawabannya nyambung dengan kondisi motor. Key disimpan lokal di
IndexedDB, hanya dikirim ke provider yang kamu tentukan.

Menambah pola gejala: tambahkan objek ke array `KB` di `js/ai.js`.

## Menyesuaikan

| Mau ubah | Di mana |
|---|---|
| Warna aksen | `css/app.css` → `--accent` di blok tema gelap DAN terang |
| Interval per segmen motor | `js/core.js` → `SEGMENT_INTERVALS` |
| Daftar segmen | `js/core.js` → `BIKE_SEGMENTS` |
| Jenis perawatan | `js/core.js` → `SERVICE_TYPES` |
| Daftar komponen + bobot | `js/core.js` → `COMPONENTS` |
| Komponen mana untuk segmen mana | `js/core.js` → `SEGMENT_COMPONENTS` |
| Penanda asal interval | `js/core.js` → `INTERVAL_SOURCE` |
| Template pengingat + interval default | `js/core.js` → `REMINDER_TEMPLATES` |
| Kategori pengeluaran | `js/core.js` → `EXPENSE_CATEGORIES` |
| Pola gejala AI lokal | `js/ai.js` → `KB` |

Setelah mengubah aset, naikkan `VERSION` di `sw.js` supaya cache lama dibuang.

## Troubleshooting

| Gejala | Penyebab & solusi |
|---|---|
| "Database tidak bisa dibuka" | Mode incognito. Buka di tab normal. |
| Skor tetap `—` | Belum ada pemeriksaan komponen. Tab Perawatan → Pemeriksaan. |
| Reminder "belum ada dasar" | Belum ada servis dengan jenis itu dan tidak ada nilai manual. Catat servis, atau isi "Terakhir ganti" saat edit pengingat. |
| Perubahan tidak muncul setelah edit | Naikkan `VERSION` di `sw.js`, lalu hard reload. |
| Data hilang | Data browser terhapus. Impor backup JSON terakhir. |
| AI API error | Cek Base URL (harus diakhiri `/v1`), nama model, dan sisa kuota key. |

## Verifikasi yang sudah dijalankan

Diuji di browser sungguhan (Chromium, viewport 390×844), bukan hanya dibaca:

- Tambah motor → tersimpan → pindah ke Garasi → tampil di Dashboard
- Catat servis oli @24.500 km → pengingat oli otomatis jadi 26.500 km (sisa 2.000 km)
- 3 pemeriksaan komponen → skor 70%, label "Perlu Perhatian", faktor penalti benar
- Kerusakan prioritas tinggi → skor turun 70→65; ditandai selesai → naik lagi 65→70
- Edit biaya servis 68.000→72.000 tersimpan
- Hapus pengeluaran → konfirmasi → terhapus
- AI lokal: "rem jauh + bunyi kasar" → mencocokkan CVT dan rem depan
- Export JSON: 8 store, foto round-trip utuh
- Reload halaman → semua data utuh
- **Offline diuji dua cara:** perangkat dibuat offline (`set_offline`) dan server dimatikan
  (socket ditutup). Keduanya: app terbuka, navigasi + konten render, data 1 motor utuh, dan
  penulisan data baru tetap tersimpan. Service worker menyimpan 45 aset di cache `motorcare-v2.4.0`.
- **Impor backup asli user:** 30 entri masuk, 0 ditolak — 1 motor, 1 servis, 15 pemeriksaan,
  12 pengingat, 1 odometer. Ekspor ulang: 8 store, jumlah baris identik, foto data URL utuh (418 KB).
- **Hitung ulang pengingat:** catat servis oli @13.168 km → pengingat bergeser 14.168 → 15.168 km
  dengan interval 2.000 km tetap.
- Navigasi semua route + tab: 0 console error, 0 warning, 0 unhandled rejection
- Lebar 390px: `scrollWidth` = 390 (tidak ada overflow horizontal)
- **Multi-motor (skenario F):** 2 motor dengan riwayat berbeda → 9/9 pemeriksaan lolos. Data
  motor B tidak bocor ke tampilan motor A (home/perawatan/riwayat/profil), dan sebaliknya.
  Kartu Garasi menampilkan odometer masing-masing (`12.168` vs `45.000`).
- **Data parsial:** 3 dari 12 komponen diperiksa → skor 34, rumus `(100×3 + 40×3 + 10×3) ÷ 9 = 50`,
  lalu `50 − 16 penalti = 34`, 9 komponen dinyatakan dikeluarkan dari penyebut.
- **Motor manual:** grid pemeriksaan tanpa CVT, tab Pengingat tanpa CVT & oli gardan,
  pengingat rantai ada. Skor `—` (bukan 0) saat belum ada pemeriksaan.
- **Data lama:** pengingat "Rantai & gear" yang sudah tersimpan dari build lama pada motor
  matic tidak ditampilkan lagi, tanpa menghapus datanya dari perangkat.

Audit standar (diukur di browser, bukan perkiraan). Kontras diukur dengan **rasterisasi canvas
1×1 → komposit alpha → luminance relatif**, bukan regex pada `getComputedStyle`, karena token
warna di aplikasi ini `oklch()` dan parser regex mengembalikan rasio palsu:

| Standar | Hasil |
|---|---|
| Kontras WCAG 2.2 AA `1.4.3` — mode gelap | 119 pasangan, 0 gagal, terendah **5.11** |
| Kontras WCAG 2.2 AA `1.4.3` — mode terang | 119 pasangan, 0 gagal, terendah **4.43** (teks besar 19px/800, ambang 3.0) |
| Kontras panel skor terbuka — gelap / terang | 23 pasangan per tema, 0 gagal (terendah 5.11 / 5.28) |
| Target sentuh `2.5.8` | 0 elemen di bawah 24×24 px |
| Reflow `1.4.10` @320px | 0 overflow, `scrollWidth == innerWidth`, termasuk saat panel skor terbuka |
| Zoom teks 200% `1.4.4` | tidak ada teks terpotong |
| Fokus tidak tertutup `2.4.11` | PASS |
| LCP / CLS / long task | 752 ms / 0 / 0 |
| Secret tertanam di kode | 0 |
| XSS lewat impor backup | tertahan (allowlist `safeImgSrc`, 0 eksekusi) |
| Console CSP | 0 error setelah `frame-ancestors` dipindah keluar dari `<meta>` |

Catatan jujur soal angka kontras: klaim versi sebelumnya ("11/11 PASS, terendah 6.09")
**tidak mencakup** pasangan putih-di-atas-aksen pada tombol primary. Pasangan itu awalnya
3.89:1 dan gagal AA. Setelah aksen terang digelapkan (L 0.615 → 0.55) nilainya 5.20:1.
Yang salah bukan pengukurannya, tapi cakupan sampelnya — 11 pasangan tidak mewakili seluruh
permukaan teks aplikasi. Sekarang yang diukur 119 pasangan per tema.

## Batasan yang jujur

- **Bukan pengganti mekanik.** Tidak ada sensor, tidak ada koneksi OBD. Semua data dari input manual.
- **Satu perangkat.** Tidak ada sinkronisasi antar HP — backup JSON adalah jalur pindah perangkat.
- **Tanpa push notification.** Pengingat muncul saat aplikasi dibuka, bukan sebagai notifikasi OS.
  Web Push di iOS sangat terbatas; ini batasan yang disadari, bukan yang disembunyikan.
- **Foto disimpan sebagai data URL** di IndexedDB. Sudah dikompres ke 1280px/JPEG 0.72, tapi
  ratusan foto tetap bisa membuat backup besar.
- **Belum ada multi-user.** Satu instalasi = satu pemilik data.
- **Data tidak dienkripsi.** IndexedDB menyimpan catatan servis sebagai teks biasa. Siapa pun
  yang bisa membuka DevTools di perangkat ini, atau menyalin file backup JSON, bisa membacanya.
  Ini batas yang disadari, bukan yang disembunyikan.

  Enkripsi lokal **sengaja tidak dipasang**. Enkripsi yang kuncinya disimpan di tempat yang
  sama dengan datanya (localStorage, IndexedDB, atau variabel di kode) hanya memindahkan
  hambatan, bukan menutup akses: siapa pun yang bisa membaca database juga bisa membaca
  kuncinya. Memberi label "terenkripsi" pada kondisi itu justru menyesatkan.

  Yang benar-benar melindungi data ini adalah kunci layar perangkat dan enkripsi disk bawaan
  OS. Kalau kamu butuh perlindungan di atas itu (mis. karena menyimpan foto STNK/BPKB),
  perlakukan file backup JSON seperti dokumen sensitif: jangan kirim lewat chat, simpan di
  penyimpanan terenkripsi, dan hapus salinan lama setelah pindah perangkat.

## Lisensi

MIT — LYID / Ramanda Kayla.
