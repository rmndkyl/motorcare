/* MOTORCARE — Profil: backup, AI, pengaturan, tentang */
(function (global) {
  'use strict';
  const MC = global.MC, CU = global.MCU, I = global.MCI, MCS = global.MCS, MCD = global.MCD;

  function render() {
    const S = MCS.S;
    const bike = MCS.activeBike();
    const totalData = S.bikes.length + S.services.length + S.damages.length + S.expenses.length + S.odoLog.length + S.checks.length + (S.docs || []).length;

    let html = '<div style="margin-bottom:16px"><h1>Profil</h1>' +
      '<div style="font-size:12.5px;color:var(--text-3);margin-top:2px">Data lokal · tanpa akun</div></div>';

    /* ---- ringkasan ---- */
    html += '<div class="card" style="margin-bottom:14px">' +
      '<div style="display:flex;gap:12px;align-items:center">' +
        '<div style="width:48px;height:48px;border-radius:14px;background:var(--accent-soft);display:grid;place-items:center;color:var(--accent)">' + I.icon('bike', 24) + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-family:BC,sans-serif;font-size:17px;font-weight:700">' + S.bikes.length + ' motor · ' + totalData + ' catatan</div>' +
          '<div style="font-size:11.5px;color:var(--text-3)">Semua tersimpan di perangkat ini</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    /* ---- AI ---- */
    html += '<div class="sec-title">Asisten AI</div>';
    html += '<div class="card" style="padding:0;overflow:hidden">' +
      '<button class="row" data-act="open-ai" style="padding:14px;width:100%;text-align:left">' +
        '<span class="ic" style="background:var(--accent-soft);color:var(--accent)">' + I.icon('sparkAI') + '</span>' +
        '<span class="body"><span class="t">Tanya Mekanik AI</span>' +
        '<span class="s">Bahas gejala, fungsi komponen, prioritas perbaikan</span></span>' +
        '<span class="end">' + I.icon('right', 16) + '</span>' +
      '</button>' +
    '</div>';
    html += '<div class="banner info" style="margin-top:10px">' + I.icon('info') +
      '<span>Fitur AI butuh koneksi internet dan API key pribadi. Tanpa key, semua fitur lain tetap jalan penuh offline.</span></div>';

    /* ---- data ---- */
    html += '<div class="sec-title">Data &amp; backup</div>';
    html += '<div class="card" style="padding:6px 14px"><div class="rows">' +
      rowBtn('download', 'Ekspor backup (JSON)', 'Simpan seluruh data ke file', 'export-json') +
      rowBtn('upload', 'Impor backup', 'Pulihkan dari file JSON', 'import-json') +
      rowBtn('doc', 'Ekspor laporan (teks)', 'Rekap servis & biaya untuk dibaca/print', 'export-report') +
    '</div></div>';

    html += '<div class="banner warn" style="margin-top:10px">' + I.icon('alert') +
      '<span><b>Backup itu wajib.</b> Kalau kamu hapus data browser atau ganti HP, riwayat motor hilang permanen. Ekspor sebulan sekali.</span></div>';

    /* ---- pengaturan motor ---- */
    if (bike) {
      html += '<div class="sec-title">Motor aktif</div>';
      html += '<div class="card" style="padding:6px 14px"><div class="rows">' +
        rowBtn('edit', 'Edit ' + bike.nickname, 'Ubah profil & foto', 'edit-bike', { id: bike.id }) +
        rowBtn('plus', 'Tambah motor lain', 'Kelola lebih dari satu motor', 'add-bike') +
      '</div></div>';
    }

    /* ---- pengaturan ---- */
    html += '<div class="sec-title">Pengaturan</div>';
    html += '<div class="card" style="padding:6px 14px"><div class="rows">' +
      rowBtn('palette', 'Tema', 'Saat ini: gelap otomotif', 'theme-info') +
      rowBtn('settings', 'Kapasitas penyimpanan', storageLabel(), 'storage-info') +
      rowBtn('download', 'Paksa muat ulang aplikasi', 'Kalau tampilan terasa tidak update', 'force-reload') +
    '</div></div>';

    /* ---- bahaya ---- */
    html += '<div class="sec-title">Zona berbahaya</div>';
    html += '<div class="card" style="padding:6px 14px"><div class="rows">' +
      rowBtn('trash', 'Hapus semua data', 'Tidak bisa dibatalkan', 'wipe', { danger: true }) +
    '</div></div>';

    /* ---- tentang ---- */
    html += '<div style="text-align:center;margin-top:24px;padding:0 20px">' +
      '<div style="display:inline-flex;align-items:center;gap:7px;color:var(--text-3);font-size:12px">' + I.logo(16) + 'MOTORCARE</div>' +
      '<div style="font-size:11px;color:var(--text-3);margin-top:6px;line-height:1.6">' +
        'Rekam kesehatan motor, bukan pengganti mekanik.<br>' +
        'Data tersimpan lokal di perangkat ini.<br>' +
        '<span style="opacity:.7">Build ' + CU.esc(buildVersion()) + '</span></div>' +
    '</div>';

    return html;
  }

  function rowBtn(ic, title, sub, act, opts) {
    opts = opts || {};
    return '<button class="row" data-act="' + act + '"' + (opts.id ? ' data-id="' + opts.id + '"' : '') + '>' +
      '<span class="ic"' + (opts.danger ? ' style="color:var(--danger)"' : '') + '>' + I.icon(ic) + '</span>' +
      '<span class="body"><span class="t"' + (opts.danger ? ' style="color:var(--danger)"' : '') + '>' + CU.esc(title) + '</span>' +
      (sub ? '<span class="s">' + CU.esc(sub) + '</span>' : '') + '</span>' +
      '<span class="end">' + I.icon('right', 16) + '</span>' +
    '</button>';
  }

  function storageLabel() {
    let chars = 0;
    try {
      ['bikes', 'services', 'damages', 'expenses', 'odoLog', 'checks', 'docs'].forEach((k) => {
        (MCS.S[k] || []).forEach((o) => { chars += JSON.stringify(o).length; });
      });
    } catch (e) { /* ignore */ }
    return 'Perkiraan ' + CU.bytes(chars) + ' terpakai';
  }

  // versi build = hash aset yang benar-benar dimuat halaman ini.
  // Fungsinya untuk membedakan "HP masih pakai cache lama" dari "memang bug",
  // karena tanpa penanda, dua keadaan itu terlihat sama saja dari layar.
  function buildVersion() {
    try {
      const s = document.querySelector('script[src*="?v="]');
      if (s) {
        const m = s.getAttribute('src').match(/\?v=([a-f0-9]+)/);
        if (m) return m[1];
      }
    } catch (e) { /* ignore */ }
    return 'dev';
  }

  global.MCPages = global.MCPages || {};
  global.MCPages.profile = { render };
})(window);
