/* MOTORCARE — backup, export, import, laporan, wipe */
(function (global) {
  'use strict';
  const MC = global.MC, CU = global.MCU, I = global.MCI, MCS = global.MCS, MCD = global.MCD;

  const STORES = ['bikes', 'services', 'damages', 'expenses', 'odoLog', 'reminders', 'checks', 'docs'];

  async function exportJson(btn) {
    await CU.withBusy(btn, async () => {
      const dump = { app: 'motorcare', version: 1, exportedAt: new Date().toISOString(), data: {} };
      for (const s of STORES) {
        dump.data[s] = await MC.Store.all(s);
      }
      const json = JSON.stringify(dump, null, 1);
      const name = 'motorcare-backup-' + MC.todayISO() + '.json';
      downloadFile(json, name, 'application/json');
      const parts = STORES.map((s) => dump.data[s].length).reduce((a, b) => a + b, 0);
      CU.toast('Backup tersimpan (' + parts + ' entri)', 'ok');
    }, 'Menyiapkan backup');
  }

  // Validasi bentuk data sebelum masuk database. File backup bisa datang dari mana saja —
  // termasuk versi yang sudah dimanipulasi. Yang tidak berbentuk gambar dibuang di sini,
  // bukan hanya saat render, supaya data kotor tidak pernah tersimpan.
  const IMG_RE = /^data:image\/(png|jpe?g|webp|gif|avif);base64,[A-Za-z0-9+/=\s]+$/i;
  const BLOB_RE = /^blob:https?:/i;

  function cleanImg(v) {
    if (typeof v !== 'string') return '';
    const s = v.trim();
    return (IMG_RE.test(s) || BLOB_RE.test(s)) ? s : '';
  }

  function sanitizeRow(store, row) {
    const r = Object.assign({}, row);
    if (typeof r.id !== 'string' || !r.id) r.id = MC.uid();
    if (typeof r.bikeId !== 'string') r.bikeId = '';

    // foto: objek {depan,samping,belakang} untuk bikes, array untuk services/damages, string untuk docs
    if (store === 'bikes' && r.photos && typeof r.photos === 'object' && !Array.isArray(r.photos)) {
      const clean = {};
      Object.keys(r.photos).forEach((k) => {
        const u = cleanImg(r.photos[k]);
        if (u) clean[k] = u;
      });
      r.photos = clean;
    } else if (Array.isArray(r.photos)) {
      r.photos = r.photos.map(cleanImg).filter(Boolean);
    }
    if (store === 'docs') r.dataUrl = cleanImg(r.dataUrl) || null;

    // segmen motor: hanya nilai yang dikenal, kalau tidak jatuh ke tebakan dari data motor
    if (store === 'bikes') {
      const valid = (MC.BIKE_SEGMENTS || []).map((s) => s.id);
      if (r.segment && valid.indexOf(r.segment) < 0) r.segment = null;
    }

    // status pemeriksaan: hanya nilai yang dikenal. Kalau status asing lolos masuk,
    // skor kesehatan akan memperlakukannya sebagai data tak terpakai (dan sebelumnya
    // malah dianggap "Sehat"). Lebih baik dijatuhkan ke status terendah yang pasti
    // dikenali daripada menyimpan nilai yang tidak bisa ditafsirkan siapa pun.
    if (store === 'checks') {
      const valid = (MC.CHECK_STATUS || []).map((s) => s.id);
      if (valid.indexOf(r.status) < 0) r.status = 'perlu-diperiksa';
    }
    if (store === 'damages') {
      const valid = (MC.DAMAGE_STATUS || []).map((s) => s.id);
      if (valid.indexOf(r.status) < 0) r.status = 'belum';
    }
    // Pengingat dengan `kind` asing sengaja TIDAK diubah: kind hanya dipakai untuk
    // mencocokkan template dan aturan segmen, dan keduanya sudah menangani nilai
    // tak dikenal (label jatuh ke kind itu sendiri, reminderApplies -> true).
    // Mengubahnya ke nilai "tebakan" justru bisa menimpa pengingat custom user.

    // teks: buang kontrol & batasi panjang, supaya satu field tidak bisa
    // menabrakkan seluruh tampilan atau menyimpan payload raksasa
    ['nickname', 'brand', 'model', 'plate', 'color', 'note', 'name', 'part', 'symptoms', 'shop', 'type', 'label']
      .forEach((k) => {
        if (typeof r[k] === 'string') {
          r[k] = r[k].replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, 500);
        }
      });

    // angka: tolak negatif / NaN untuk odometer dan biaya
    ['km', 'cost', 'amount', 'estCost', 'currentKm', 'startKm', 'intervalKm', 'intervalDays'].forEach((k) => {
      if (r[k] !== undefined && r[k] !== null && r[k] !== '') {
        const n = Number(r[k]);
        r[k] = Number.isFinite(n) && n >= 0 ? n : null;
      }
    });

    return r;
  }

  function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  function importJson(btn) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      try {
        const text = await f.text();
        const parsed = JSON.parse(text);
        if (!parsed || parsed.app !== 'motorcare' || !parsed.data) {
          CU.toast('File ini bukan backup MOTORCARE', 'err');
          return;
        }
        // tolak file absurd sebelum diproses (cegah browser/HP macet)
        if (f.size > 40 * 1024 * 1024) {
          CU.toast('File terlalu besar (maks 40 MB). Periksa lagi file backup-nya.', 'err');
          return;
        }
        const counts = Object.keys(parsed.data).map((k) => k + ': ' + (parsed.data[k] || []).length).join(', ');
        const ok = await CU.confirmDialog({
          title: 'Impor backup?',
          message: 'Data dari file akan DITAMBAHKAN ke data yang ada sekarang.',
          detail: counts + '\nTanggal backup: ' + (parsed.exportedAt || '—'),
          yes: 'Impor'
        });
        if (!ok) return;

        // impor bisa menulis ratusan baris; tanpa indikator, user mengira
        // tombolnya tidak bekerja dan menekannya lagi
        const done = CU.busy(btn, 'Mengimpor backup');
        CU.toast('Mengimpor…', 'ok');
        let imported = 0, rejected = 0;
        try {
          for (const store of STORES) {
            const rows = parsed.data[store] || [];
            for (const raw of rows) {
              if (!raw || typeof raw !== 'object') { rejected++; continue; }
              const r = sanitizeRow(store, raw);
              await MC.Store.put(store, r);
              imported++;
            }
          }
          await MCS.loadAll();
          CU.toast(imported + ' entri dipulihkan' + (rejected ? ', ' + rejected + ' ditolak' : ''), 'ok');
          if (global.MCApp) global.MCApp.refresh();
        } finally {
          done();
        }
      } catch (e) {
        CU.toast('Gagal impor: ' + e.message, 'err');
      }
    };
    inp.click();
  }

  function exportReport(btn) {
    const bike = MCS.activeBike();
    if (!bike) { CU.toast('Belum ada motor', 'err'); return; }
    return CU.withBusy(btn, async () => {
    const ctx = MCS.ctxFor(bike);
    const km = MCD.currentKm(bike, ctx.odoLog, ctx.services);
    const health = MCD.healthScore(bike, ctx);
    const rems = MCD.buildReminders(bike, ctx.services, ctx.reminders, km);
    const exp = MCD.expenseStats(ctx.expenses);

    let t = '';
    t += 'MOTORCARE — LAPORAN KENDARAAN\n';
    t += '='.repeat(46) + '\n';
    t += 'Dibuat: ' + MC.fmtDate(MC.todayISO(), { day: 'numeric', month: 'long', year: 'numeric' }) + '\n\n';
    t += 'MOTOR\n';
    t += '-'.repeat(46) + '\n';
    t += 'Nama        : ' + bike.nickname + '\n';
    t += 'Merek/Tipe  : ' + [bike.brand, bike.model].filter(Boolean).join(' ') + '\n';
    if (bike.year) t += 'Tahun       : ' + bike.year + '\n';
    if (bike.plate) t += 'Nomor plat  : ' + bike.plate + '\n';
    if (bike.cc) t += 'Kapasitas   : ' + bike.cc + ' cc\n';
    if (bike.color) t += 'Warna       : ' + bike.color + '\n';
    if (bike.startDate) t += 'Mulai pakai : ' + MC.fmtDate(bike.startDate) + '\n';
    t += 'Odometer    : ' + MC.fmtKm(km) + '\n';
    t += '\nKESEHATAN\n';
    t += '-'.repeat(46) + '\n';
    t += 'Status      : ' + health.label + (health.score !== null ? ' (' + health.score + '%)' : '') + '\n';
    t += 'Komponen diperiksa: ' + health.checked + '/' + health.total + '\n';
    if (health.factors.length) {
      health.factors.forEach((f) => { t += '  • ' + f.text + '\n'; });
    }
    t += '\nJADWAL PERAWATAN\n';
    t += '-'.repeat(46) + '\n';
    rems.filter((r) => r.state !== 'no-baseline').forEach((r) => {
      const stat = r.state === 'overdue' ? 'TERLEWAT' : r.state === 'soon' ? 'SEGERA' : 'terjadwal';
      const when = r.kmLeft !== null ? MC.fmtNum(Math.max(0, r.kmLeft)) + ' km lagi' : (r.daysLeft !== null ? Math.max(0, r.daysLeft) + ' hari lagi' : '—');
      t += '[' + stat.padEnd(9) + '] ' + r.label.padEnd(22) + ' ' + when + '\n';
    });
    t += '\nBIAYA\n';
    t += '-'.repeat(46) + '\n';
    t += 'Bulan ini   : ' + MC.fmtRp(exp.monthTotal) + '\n';
    t += 'Tahun ini   : ' + MC.fmtRp(exp.yearTotal) + '\n';
    t += 'Total       : ' + MC.fmtRp(exp.allTotal) + '\n';
    t += 'Rata2/bulan : ' + MC.fmtRp(exp.avgMonthly) + '\n';
    t += '\nRIWAYAT SERVIS (' + ctx.services.length + ')\n';
    t += '-'.repeat(46) + '\n';
    ctx.services.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach((s) => {
      const types = (s.types || [s.type]).map((x) => (MC.SERVICE_TYPES.find((v) => v.id === x) || {}).label || x);
      t += MC.fmtDate(s.date) + ' | ' + MC.fmtKm(s.km) + ' | ' + types.join(' + ');
      if (s.cost) t += ' | ' + MC.fmtRp(s.cost);
      if (s.shop) t += ' | ' + s.shop;
      t += '\n';
    });
    if (ctx.damages.length) {
      t += '\nRIWAYAT KERUSAKAN (' + ctx.damages.length + ')\n';
      t += '-'.repeat(46) + '\n';
      ctx.damages.forEach((d) => {
        const st = (MC.DAMAGE_STATUS.find((x) => x.id === d.status) || {}).label;
        t += MC.fmtDate(d.date) + ' | ' + d.name + ' | ' + (d.part || '-') + ' | ' + st + '\n';
        if (d.symptoms) t += '   Gejala: ' + d.symptoms + '\n';
      });
    }
    t += '\n' + '='.repeat(46) + '\n';
    t += 'Laporan ini dibuat dari data yang kamu isi sendiri.\n';
    t += 'Bukan diagnosis medis kendaraan — periksa ke mekanik.\n';

    downloadFile(t, 'motorcare-laporan-' + bike.nickname.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '-' + MC.todayISO() + '.txt', 'text/plain');
    CU.toast('Laporan diunduh', 'ok');
    }, 'Menyiapkan laporan');
  }

  async function forceReload() {
    const ok = await CU.confirmDialog({
      title: 'Paksa muat ulang?',
      message: 'Aplikasi akan menghapus cache lokal dan mengambil versi terbaru dari internet.',
      detail: 'Data motor, servis, dan biaya TIDAK ikut terhapus. Hanya file aplikasinya yang diambil ulang. Butuh koneksi internet.',
      yes: 'Muat ulang'
    });
    if (!ok) return;
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (window.caches && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) { /* tetap lanjut reload walau pembersihan gagal sebagian */ }
    location.reload();
  }

  async function wipe(btn) {
    const ok = await CU.confirmDialog({
      title: 'Hapus SEMUA data?',
      message: 'Semua motor, servis, kerusakan, pengeluaran, dan pengingat akan dihapus dari HP ini.',
      detail: 'Tidak bisa dibatalkan. Ekspor backup dulu kalau ragu.',
      danger: true, yes: 'Hapus semua'
    });
    if (!ok) return;
    const ok2 = await CU.confirmDialog({
      title: 'Yakin?',
      message: 'Ini penghapusan permanen seluruh data MOTORCARE di perangkat ini.',
      danger: true, yes: 'Ya, hapus'
    });
    if (!ok2) return;
    await CU.withBusy(btn, async () => {
      await MC.Store.clearAll();
      await MCS.loadAll();
    }, 'Menghapus data');
    CU.toast('Semua data dihapus', 'ok');
    if (global.MCApp) global.MCApp.go('home');
  }

  global.MCData = { exportJson, importJson, exportReport, wipe, downloadFile, forceReload, sanitizeRow };
})(window);
