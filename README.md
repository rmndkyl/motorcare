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
| **Monitoring 13 komponen** | Mesin, oli, rem depan/belakang, ban, suspensi, aki, kelistrikan, lampu, pendingin, rantai, CVT, bahan bakar |
| **4 tingkat status** | Sehat · Perlu diperiksa · Perlu perawatan · Harus segera ditangani |
| **Skor kesehatan** | Dihitung dari data pemeriksaan + jadwal terlewat + kerusakan terbuka + kesegaran odometer |
| **Riwayat kerusakan** | Gejala, bagian, prioritas, estimasi biaya, status penanganan, foto |
| **Pengingat 2 sumbu** | Berbasis KM **dan** tanggal; interval bisa diedit per pengingat |
| **12 template pengingat** | Oli mesin, oli gardan, servis berkala, CVT, filter udara, busi, kampas rem, ban, aki, rantai, pajak, STNK |
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

## Pengingat: dua sumbu

```
nextKm   = lastKm + intervalKm
nextDate = lastDate + intervalDays
status   = overdue kalau salah satu lewat; soon kalau salah satu ≤ soonKm/soonDays
```

`lastKm`/`lastDate` diambil otomatis dari servis terakhir dengan jenis yang cocok, atau
di-override manual per pengingat. Jadi catat servis → jadwal berikutnya langsung terhitung.

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
| Warna aksen | `css/app.css` → `--accent` dan turunannya (OKLCH) |
| Jenis perawatan | `js/core.js` → `SERVICE_TYPES` |
| Daftar komponen + bobot | `js/core.js` → `COMPONENTS` |
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
- Export JSON: 22 entri, 8 store, foto round-trip utuh
- Reload halaman → semua data utuh
- Server dimatikan → app tetap terbuka dari cache, data utuh, input baru tetap tersimpan
- Navigasi semua route + tab: 0 console error, 0 warning, 0 unhandled rejection
- Lebar 390px: `scrollWidth` = 390 (tidak ada overflow horizontal)

## Batasan yang jujur

- **Bukan pengganti mekanik.** Tidak ada sensor, tidak ada koneksi OBD. Semua data dari input manual.
- **Satu perangkat.** Tidak ada sinkronisasi antar HP — backup JSON adalah jalur pindah perangkat.
- **Tanpa push notification.** Pengingat muncul saat aplikasi dibuka, bukan sebagai notifikasi OS.
  Web Push di iOS sangat terbatas; ini batasan yang disadari, bukan yang disembunyikan.
- **Foto disimpan sebagai data URL** di IndexedDB. Sudah dikompres ke 1280px/JPEG 0.72, tapi
  ratusan foto tetap bisa membuat backup besar.
- **Belum ada multi-user.** Satu instalasi = satu pemilik data.

## Lisensi

MIT — LYID / Ramanda Kayla.
