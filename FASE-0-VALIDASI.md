# FASE 0 — Lembar Validasi MOTORCARE

Tujuan fase ini **bukan** menambah fitur. Tujuannya menjawab satu pertanyaan:
apakah orang mau memakai ini secara rutin, dan **siapa yang mau membayar**.

Jangan bangun backend sebelum gerbang di bawah lolos.

---

## Gerbang kelulusan (harus dua-duanya)

| # | Kriteria | Ambang |
|---|---|---|
| G1 | Orang yang dikasih akses benar-benar mengisi data | ≥ **3 dari 10** mengisi ≥ 1 motor dalam 14 hari |
| G2 | Ada yang menyebut angka mau bayar | ≥ **1 orang** menyebut nominal (bukan "nanti aja") |

Kalau G1 gagal → masalahnya bukan fitur, jangan tambah fitur.
Kalau G2 gagal → turunkan ambisi ke portofolio. Jangan belanja server.

---

## Minggu 1 — Pakai sendiri (kamu)

Checklist harian. Beri tanda setiap hari kamu benar-benar membuka aplikasi.

| Hari | Buka app | Catat sesuatu | Ada reminder muncul? | Catatan friksi |
|---|---|---|---|---|
| 1 | ☐ | ☐ | ☐ | |
| 2 | ☐ | ☐ | ☐ | |
| 3 | ☐ | ☐ | ☐ | |
| 4 | ☐ | ☐ | ☐ | |
| 5 | ☐ | ☐ | ☐ | |
| 6 | ☐ | ☐ | ☐ | |
| 7 | ☐ | ☐ | ☐ | |

**Yang dicatat, bukan hanya dirasakan:** di hari ke-7 hitung berapa kali kamu membuka app
tanpa dipaksa. Angka itu adalah baseline retensi paling jujur yang kamu punya.

**Tes backup di HP sendiri (wajib, sekali):**
1. Profil → Ekspor backup → simpan file
2. Catat jumlah entri yang muncul di toast
3. Profil → Zona berbahaya → Hapus semua data
4. Profil → Impor backup → pilih file tadi
5. Cocokkan jumlah entri + pastikan foto motor masih ada + skor kesehatan masih terhitung

Kalau langkah 5 gagal, **berhenti** — bug backup adalah bug terburuk yang bisa dimiliki
aplikasi yang menjanjikan menyimpan riwayat.

---

## Minggu 2 — 10 orang

Kirim ke 10 pemilik motor. Bukan ke sesama pembuat bot. Bukan ke grup crypto.
Ke orang yang benar-benar punya motor dan biasa servis.

### Pesan kirim (salin apa adanya, jangan diedit jadi formal)

```
Bro, gue bikin aplikasi catatan servis motor. Gratis, tanpa akun, data disimpen di HP sendiri.

Coba pakai 2 menit: https://rmndkyl.github.io/motorcare/
Buka di Chrome -> menu titik tiga -> "Tambahkan ke layar utama"

Isinya: catat servis, inget jadwal oli/CVT/pajak, liat total biaya motor.
Kalau kepake, kabarin. Kalau nggak, bilang aja nggak kepake — gue butuh tau yang jujur.
```

### Tabel pelacakan

| # | Nama | Punya motor? | Buka app? | Isi ≥1 motor? | Balas? | Catatan |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |
| 5 | | | | | | |
| 6 | | | | | | |
| 7 | | | | | | |
| 8 | | | | | | |
| 9 | | | | | | |
| 10 | | | | | | |

**Hitungan G1:** ___ dari 10 mengisi data.

---

## Pertanyaan harga (ke 5 orang, setelah mereka pakai)

Jangan tanya "mau bayar berapa?" langsung — jawabannya selalu "gratis dong".
Tanya dalam bentuk pilihan, karena pilihan memaksa angka.

### Skrip

```
Kalau aplikasi ini ada versi lanjutannya — data otomatis ke-backup ke cloud,
bisa dibuka di HP lain, dan diingetin otomatis lewat WA kalau oli udah waktunya —
kamu lebih milih yang mana?

A. Tetap gratis, iklan yang muncul
B. Gratis, tapi fitur cloud/WA bayar Rp 15.000/bulan
C. Bayar sekali Rp 75.000, dapat semua fitur selamanya
D. Nggak butuh, cukup yang gratis sekarang
```

| # | Nama | Pilihan (A/B/C/D) | Alasan (kutip persis) |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |

**Kenapa pilihan, bukan angka bebas:** orang Indonesia menjawab "mahal" untuk angka apa pun
yang disebut duluan, tapi memilih dengan konsisten kalau dikasih tiga opsi konkret.
Pilihan B vs C juga memisahkan orang yang mau langganan dari yang mau bayar sekali —
dua model bisnis yang sangat berbeda.

**Hitungan G2:** ___ orang memilih B atau C.

---

## Kalau hasilnya lolos (G1 + G2)

Lanjut ke **Fase 1** di ROADMAP.md: Supabase, akun, sinkronisasi.
Modal minimum: **Rp 705.675** (domain + Play Console, Supabase tetap Free).
Jangan belanja Skenario B penuh sampai ada 1 pembeli nyata.

## Kalau gagal

Tidak ada yang terbuang. Aplikasi tetap hidup gratis di URL-nya, tetap jadi
portofolio untuk lini web dev LYID, dan pelajarannya masuk ke skill.

Yang **tidak** boleh dilakukan setelah G1/G2 gagal: menambah fitur, membeli domain,
membayar Supabase Pro, atau menyimpulkan "kurang promosi" lalu belanja iklan.

---

## Catatan metode

- Ambang 3-dari-10 itu **inferensi saya**, bukan angka riset. Kalau kamu rasa terlalu longgar,
  naikkan; yang penting ditetapkan **sebelum** melihat hasil, bukan disesuaikan setelahnya.
- Satu orang yang membayar lebih berarti daripada sepuluh yang bilang "keren".
  Keren itu sopan; bayar itu sinyal.
