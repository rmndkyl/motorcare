/* MOTORCARE — Garasi: daftar motor + dokumen + detail */
(function (global) {
  'use strict';
  const MC = global.MC, CU = global.MCU, I = global.MCI, MCS = global.MCS, MCD = global.MCD;

  function render() {
    const S = MCS.S;
    if (!S.bikes.length) {
      return '<div style="padding-top:20px">' + CU.empty('garage', 'Garasi masih kosong', 'Tambahkan motor pertamamu untuk mulai mencatat.',
        '<button class="btn primary" data-act="add-bike">' + I.icon('plus') + 'Tambah Motor</button>') + '</div>';
    }

    let html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">' +
      '<div><h1>Garasi</h1><div style="font-size:12.5px;color:var(--text-3);margin-top:2px">' +
        S.bikes.length + ' motor terdaftar</div></div>' +
      '<button class="iconbtn" data-act="add-bike" aria-label="Tambah motor">' + I.icon('plus') + '</button>' +
    '</div>';

    html += '<div style="display:flex;flex-direction:column;gap:9px">';
    S.bikes.forEach((b) => {
      const ctx = MCS.ctxFor(b);
      const km = MCD.currentKm(b, ctx.odoLog, ctx.services);
      const h = MCD.healthScore(b, ctx);
      const active = b.id === MCS.S.activeBikeId;
      const photo = (b.photos || {}).samping || (b.photos || {}).depan;
      const tone = h.tone;
      html += '<button class="bike-card' + (active ? ' active' : '') + '" data-act="select-bike" data-id="' + b.id + '">' +
        '<span class="thumb">' + (CU.safeImgSrc(photo) ? CU.imgTag(photo, 'Foto ' + b.nickname) : I.icon('bike', 26)) + '</span>' +
        '<span class="info">' +
          '<span class="n">' + CU.esc(b.nickname) + '</span>' +
          '<span class="m">' + CU.esc([b.brand, b.model].filter(Boolean).join(' ')) + (b.plate ? ' · ' + CU.esc(b.plate) : '') + '</span>' +
          '<span class="m">' + MC.fmtKm(km) + '</span>' +
        '</span>' +
        '<span class="right">' + CU.badge(h.score === null ? 'Baru' : h.score + '%', tone, false) +
          (active ? '<div style="font-size:9.5px;color:var(--accent-text);margin-top:5px;letter-spacing:.06em">AKTIF</div>' : '') +
        '</span>' +
      '</button>';
    });
    html += '</div>';

    /* ---- detail motor aktif ---- */
    const bike = MCS.activeBike();
    if (bike) {
      const ctx = MCS.ctxFor(bike);
      html += '<div class="sec-title">Detail ' + CU.esc(bike.nickname) + '</div>';
      html += '<div class="card" style="padding:0;overflow:hidden">';
      const photos = Object.entries(bike.photos || {});
      const heroP = (bike.photos || {}).depan || (bike.photos || {}).samping;
      if (heroP) {
        html += CU.imgTag(heroP, 'Foto ' + bike.nickname, 'style="width:100%;aspect-ratio:16/9;object-fit:cover;display:block"');
      }
      html += '<div style="padding:14px">';
      const rows = [
        ['Merek', bike.brand],
        ['Tipe', bike.model],
        ['Tahun', bike.year],
        ['Kapasitas', bike.cc ? bike.cc + ' cc' : null],
        ['Warna', bike.color],
        ['Nomor plat', bike.plate],
        ['Nomor rangka', bike.vin],
        ['Nomor mesin', bike.engineNo],
        ['Mulai dipakai', bike.startDate ? MC.fmtDate(bike.startDate) : null],
        ['KM awal', bike.startKm !== null && bike.startKm !== undefined ? MC.fmtKm(bike.startKm) : null],
        ['Transmisi', bike.transmission === 'matik' ? 'Matic / CVT' : bike.transmission === 'manual' ? 'Manual' : bike.transmission === 'semi' ? 'Semi otomatis' : null]
      ].filter((r) => r[1] !== null && r[1] !== undefined && r[1] !== '');

      html += '<div class="rows">';
      rows.forEach(([k, v]) => {
        html += '<div class="row" style="padding:8px 0"><span class="body"><span class="t" style="font-size:12.5px;color:var(--text-3);font-weight:400">' + CU.esc(k) +
          '</span></span><span class="end"><span class="v" style="font-size:13px">' + CU.esc(v) + '</span></span></div>';
      });
      html += '</div>';

      if (bike.note) {
        html += '<div class="banner info" style="margin-top:10px">' + I.icon('info') + '<span>' + CU.esc(bike.note) + '</span></div>';
      }

      html += '<div class="btn-row" style="margin-top:12px">' +
        '<button class="btn sm ghost" data-act="edit-bike" data-id="' + bike.id + '">' + I.icon('edit') + 'Edit</button>' +
        '<button class="btn sm ghost" data-act="del-bike" data-id="' + bike.id + '">' + I.icon('trash') + 'Hapus</button>' +
      '</div>';
      html += '</div></div>';

      /* ---- dokumen ---- */
      html += '<div class="sec-title">Dokumen kendaraan</div>';
      const docs = ctx.docs || [];
      html += '<div class="card" style="padding:6px 14px">';
      if (docs.length) {
        html += '<div class="rows">';
        docs.forEach((d) => {
          html += '<button class="row" data-act="view-doc" data-id="' + d.id + '">' +
            '<span class="ic">' + I.icon('doc') + '</span>' +
            '<span class="body"><span class="t">' + CU.esc(d.name) + '</span>' +
            '<span class="s">' + (d.type || 'Dokumen') + (d.date ? ' · ' + MC.fmtDate(d.date) : '') + '</span></span>' +
            '<span class="end">' + I.icon('right', 16) + '</span></button>';
        });
        html += '</div>';
      } else {
        html += '<div style="padding:10px 0;font-size:12.5px;color:var(--text-3)">Belum ada dokumen (STNK, BPKB, asuransi).</div>';
      }
      html += '<button class="row" data-act="add-doc" style="color:var(--accent-text);border-top:1px solid var(--line-soft)">' +
        I.icon('plus', 16) + '<span style="font-size:13px;margin-left:6px">Tambah dokumen</span></button>';
      html += '</div>';

      /* ---- modifikasi ---- */
      html += '<div class="sec-title">Catatan modifikasi</div>';
      const mods = ctx.expenses.filter((e) => e.category === 'modifikasi');
      html += '<div class="card" style="padding:6px 14px">';
      if (mods.length) {
        html += '<div class="rows">';
        mods.forEach((m) => {
          html += '<div class="row"><span class="ic">' + I.icon('settings') + '</span>' +
            '<span class="body"><span class="t">' + CU.esc(m.note || 'Modifikasi') + '</span>' +
            '<span class="s">' + MC.fmtDate(m.date) + '</span></span>' +
            '<span class="end"><span class="v">' + MC.fmtRp(m.amount) + '</span></span></div>';
        });
        html += '</div>';
      } else {
        html += '<div style="padding:10px 0;font-size:12.5px;color:var(--text-3)">Belum ada catatan modifikasi.</div>';
      }
      html += '</div>';

      /* ---- insentif: kelengkapan ---- */
      const completeness = computeCompleteness(bike, ctx);
      html += '<div class="sec-title">Kelengkapan data</div>';
      html += '<div class="card">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">' +
          '<span style="font-size:13px">' + completeness.done + ' dari ' + completeness.total + ' terisi</span>' +
          '<span style="font-family:BC,sans-serif;font-size:19px;font-weight:700;color:var(--accent-text)">' + Math.round(completeness.done / completeness.total * 100) + '%</span>' +
        '</div>' +
        '<div style="height:6px;background:var(--surface-3);border-radius:3px;overflow:hidden">' +
          '<i style="display:block;height:100%;width:' + (completeness.done / completeness.total * 100) + '%;background:var(--accent);border-radius:3px;transition:width .5s cubic-bezier(.22,.61,.36,1)"></i>' +
        '</div>' +
        (completeness.missing.length
          ? '<div style="font-size:11.5px;color:var(--text-3);margin-top:9px;line-height:1.5">Belum: ' + completeness.missing.map(CU.esc).join(', ') + '</div>'
          : '<div style="font-size:11.5px;color:var(--ok);margin-top:9px">Semua data utama sudah lengkap.</div>') +
      '</div>';
    }

    return html;
  }

  function computeCompleteness(bike, ctx) {
    const checks = [
      ['Foto motor', Object.keys(bike.photos || {}).length > 0],
      ['Nomor plat', !!bike.plate],
      ['Warna', !!bike.color],
      ['Nomor rangka', !!bike.vin],
      ['Nomor mesin', !!bike.engineNo],
      ['KM awal', bike.startKm !== null && bike.startKm !== undefined],
      ['Catatan servis', ctx.services.length > 0],
      ['Odometer', ctx.odoLog.length > 0],
      ['Pemeriksaan komponen', ctx.checks.length > 0],
      ['Dokumen', (ctx.docs || []).length > 0]
    ];
    const done = checks.filter((c) => c[1]).length;
    return { done, total: checks.length, missing: checks.filter((c) => !c[1]).map((c) => c[0]) };
  }

  global.MCPages = global.MCPages || {};
  global.MCPages.garage = { render };
})(window);
