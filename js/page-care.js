/* MOTORCARE — Perawatan: servis, pengingat, pemeriksaan komponen */
(function (global) {
  'use strict';
  const MC = global.MC, CU = global.MCU, I = global.MCI, MCS = global.MCS, MCD = global.MCD;

  let tab = 'servis'; // servis | reminder | cek

  function render() {
    const bike = MCS.activeBike();
    if (!bike) {
      return '<div style="padding-top:20px">' + CU.empty('wrench', 'Belum ada motor', 'Tambahkan motor dulu untuk mencatat perawatan.',
        '<button class="btn primary" data-act="add-bike">' + I.icon('plus') + 'Tambah Motor</button>') + '</div>';
    }
    const ctx = MCS.ctxFor(bike);
    const km = MCD.currentKm(bike, ctx.odoLog, ctx.services);

    let html = '<div style="margin-bottom:14px"><h1>Perawatan</h1>' +
      '<div style="font-size:12.5px;color:var(--text-3);margin-top:2px">' + CU.esc(bike.nickname) + ' · ' + MC.fmtKm(km) + '</div></div>';

    html += '<div class="seg" style="margin-bottom:16px">' +
      '<button data-tab="servis" class="' + (tab === 'servis' ? 'on' : '') + '">Servis</button>' +
      '<button data-tab="reminder" class="' + (tab === 'reminder' ? 'on' : '') + '">Pengingat</button>' +
      '<button data-tab="cek" class="' + (tab === 'cek' ? 'on' : '') + '">Pemeriksaan</button>' +
    '</div>';

    if (tab === 'servis') html += renderServices(ctx, bike, km);
    else if (tab === 'reminder') html += renderReminders(ctx, bike, km);
    else html += renderChecks(ctx, bike, km);

    return html;
  }

  /* ================= SERVIS ================= */
  function renderServices(ctx, bike, km) {
    const list = ctx.services.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    let html = '';

    html += '<button class="btn primary block" data-act="add-service" style="margin-bottom:14px">' +
      I.icon('plus') + 'Catat Servis Baru</button>';

    if (!list.length) {
      return html + '<div class="card">' + CU.empty('wrench', 'Belum ada catatan servis',
        'Setiap servis yang dicatat membuat jadwal berikutnya otomatis terhitung.',
        '<button class="btn primary sm" data-act="add-service">' + I.icon('plus') + 'Catat Servis</button>') + '</div>';
    }

    // group by year-month
    const groups = {};
    list.forEach((s) => {
      const k = MC.monthKey(s.date);
      (groups[k] = groups[k] || []).push(s);
    });

    const totalCost = list.reduce((a, b) => a + (+b.cost || 0), 0);
    html += '<div class="stats" style="margin-bottom:14px">' +
      '<div class="stat"><div class="k">Total servis</div><div class="v">' + list.length + ' <small>kali</small></div></div>' +
      '<div class="stat"><div class="k">Total biaya</div><div class="v" style="font-size:16px">' + MC.fmtRp(totalCost) + '</div></div>' +
    '</div>';

    Object.keys(groups).sort().reverse().forEach((k) => {
      const items = groups[k];
      const sum = items.reduce((a, b) => a + (+b.cost || 0), 0);
      html += '<div class="sec-title">' + MC.monthLabel(k) +
        (sum ? ' · ' + MC.fmtRp(sum) : '') + '</div>';
      html += '<div class="card" style="padding:6px 14px"><div class="rows">';
      items.forEach((s) => {
        const types = (s.types || [s.type]).map((t) => (MC.SERVICE_TYPES.find((x) => x.id === t) || {}).label || t);
        const comps = (s.parts || []).map((p) => p.name).filter(Boolean);
        html += '<button class="row" data-act="service" data-id="' + s.id + '">' +
          '<span class="ic">' + I.icon(iconFor(types[0])) + '</span>' +
          '<span class="body"><span class="t">' + CU.esc(types.join(' + ')) + '</span>' +
          '<span class="s">' + MC.fmtDate(s.date) + ' · ' + MC.fmtKm(s.km) +
            (s.shop ? ' · ' + CU.esc(s.shop) : '') + (comps.length ? ' · ' + CU.esc(comps.join(', ')) : '') + '</span></span>' +
          '<span class="end"><span class="v">' + (s.cost ? MC.fmtRp(s.cost) : '—') + '</span></span>' +
        '</button>';
      });
      html += '</div></div>';
    });

    return html;
  }

  function iconFor(typeLabel) {
    const t = MC.SERVICE_TYPES.find((x) => x.label === typeLabel);
    return t ? t.icon : 'wrench';
  }

  /* ================= REMINDER ================= */
  function renderReminders(ctx, bike, km) {
    const rems = MCD.buildReminders(bike, ctx.services, ctx.reminders, km);
    let html = '';

    const groups = { overdue: [], soon: [], 'needs-baseline': [], ok: [], unknown: [], 'no-baseline': [] };
    rems.forEach((r) => { (groups[r.state] || groups.unknown).push(r); });

    if (groups.overdue.length) {
      html += '<div class="banner danger" style="margin-bottom:12px">' + I.icon('alert') +
        '<span><b>' + groups.overdue.length + ' perawatan terlewat.</b> Motor berisiko kalau dibiarkan — minimal periksa kondisinya.</span></div>';
    }
    if (groups['needs-baseline'].length) {
      html += '<div class="card" style="margin-bottom:12px;border-color:var(--accent-line)">' +
        '<div style="display:flex;gap:10px;align-items:flex-start">' +
          '<span style="color:var(--accent);flex:none;margin-top:1px">' + I.icon('info', 17) + '</span>' +
          '<div style="flex:1">' +
            '<div style="font-size:13px;font-weight:600;margin-bottom:3px">' + groups['needs-baseline'].length + ' jadwal belum punya titik mulai</div>' +
            '<div style="font-size:12px;color:var(--text-2);line-height:1.5">' +
              'Aplikasi belum tahu kapan komponen ini terakhir diganti. Catat servis terakhirnya, ' +
              'atau isi kolom "terakhir ganti" saat mengedit pengingat. Setelah itu hitungannya akurat.' +
            '</div>' +
            '<button class="btn sm primary" style="margin-top:9px" data-act="add-service">' + I.icon('plus') + 'Catat servis terakhir</button>' +
          '</div>' +
        '</div></div>';
    }

    html += '<button class="btn primary block" data-act="add-reminder" style="margin-bottom:14px">' +
      I.icon('plus') + 'Tambah Pengingat</button>';

    const sections = [
      ['overdue', 'Terlewat', 'danger'],
      ['soon', 'Segera', 'warn'],
      ['needs-baseline', 'Belum ada riwayat', 'accent'],
      ['ok', 'Terjadwal', 'ok'],
      ['no-baseline', 'Belum ada dasar', 'unknown']
    ];

    sections.forEach(([key, title, tone]) => {
      const items = groups[key];
      if (!items || !items.length) return;
      html += '<div class="sec-title">' + title + ' (' + items.length + ')</div>';
      html += '<div class="card" style="padding:6px 14px"><div class="rows">';
      items.forEach((r) => {
        const nb = r.state === 'needs-baseline';
        html += '<button class="row" data-act="edit-reminder" data-id="' + r.id + '">' +
          '<span class="ic" style="color:var(--' + tone + ')">' + I.icon('clock') + '</span>' +
          '<span class="body">' +
            '<span class="t">' + CU.esc(r.label) + '</span>' +
            '<span class="s">' + reminderSub(r) + '</span>' +
          '</span>' +
          '<span class="end">' +
            (nb
              ? '<div style="font-size:11.5px;font-weight:600;color:var(--accent-text)">isi<br>riwayat</div>'
              : '<div style="font-size:12.5px;font-weight:600;color:var(--' + tone + ')">' +
                  (r.kmLeft !== null ? (r.state === 'overdue' ? '−' + MC.fmtNum(Math.abs(r.kmLeft)) : MC.fmtNum(r.kmLeft)) + ' km'
                    : r.daysLeft !== null ? (r.state === 'overdue' ? '−' + Math.abs(r.daysLeft) : r.daysLeft) + ' hari'
                    : '—') + '</div>' +
                (r.nextDate ? '<div class="d">' + MC.fmtDate(r.nextDate, { day: 'numeric', month: 'short' }) + '</div>' : '')) +
          '</span>' +
        '</button>';
      });
      html += '</div></div>';
    });

    html += '<div class="banner info" style="margin-top:16px">' + I.icon('info') +
      '<span><b>' + CU.esc(MC.INTERVAL_SOURCE.label) + '.</b> ' + CU.esc(MC.INTERVAL_SOURCE.note) + '</span></div>';

    return html;
  }

  function reminderSub(r) {
    const parts = [];
    if (r.intervalKm) parts.push('tiap ' + MC.fmtNum(r.intervalKm) + ' km');
    if (r.intervalDays) parts.push('tiap ' + r.intervalDays + ' hari');
    if (r.estimated) {
      // sengaja tidak menambah teks di sini: kolom kanan sudah bilang "isi riwayat",
      // dan sub yang kepanjangan akan terpotong di tengah kata
    } else if (r.lastKm !== null && r.lastKm !== undefined) {
      parts.push('terakhir ' + MC.fmtNum(r.lastKm) + ' km');
    } else if (r.lastDate) {
      parts.push('terakhir ' + MC.fmtDate(r.lastDate, { day: 'numeric', month: 'short', year: '2-digit' }));
    }
    return parts.join(' · ') || 'Belum ada data dasar';
  }

  /* ================= PEMERIKSAAN ================= */
  function renderChecks(ctx, bike, km) {
    const latest = {};
    ctx.checks.forEach((c) => {
      const p = latest[c.component];
      if (!p || (c.date || '') >= (p.date || '')) latest[c.component] = c;
    });

    const health = MCD.healthScore(bike, ctx);
    const comps = MC.componentsFor(health.segment);
    let html = '';

    // gauge ringkas
    // 'unknown' (belum ada data) TIDAK boleh jatuh ke var(--line): itu warna garis,
    // dan sebagai teks 18px rasionya ~1.4 (praktis tak terbaca). Pakai warna teks.
    const toneVar = health.tone === 'ok' ? 'var(--ok)' : health.tone === 'warn' ? 'var(--warn)'
      : health.tone === 'warn2' ? 'var(--warn2)' : health.tone === 'danger' ? 'var(--danger)' : 'var(--text-2)';
    html += '<div class="card" style="margin-bottom:14px">' +
      '<div class="score-wrap">' +
        '<div class="gauge">' + I.ring(health.score, toneVar) +
          '<div class="num">' + (health.score === null ? '—' : health.score) + (health.score !== null ? '<small>%</small>' : '') + '</div></div>' +
        '<div class="score-info"><div class="kicker">Skor kesehatan</div>' +
          '<div class="state" style="color:' + toneVar + '">' + CU.esc(health.label) + '</div>' +
          '<div class="sub">' + health.checked + ' dari ' + health.total + ' komponen punya data pemeriksaan</div></div>' +
      '</div>' +
      scoreDetail(health) +
    '</div>';

    html += '<button class="btn primary block" data-act="add-check" style="margin-bottom:14px">' +
      I.icon('gauge') + 'Catat Pemeriksaan</button>';

    html += '<div class="comp-grid">';
    comps.forEach((comp) => {
      const c = latest[comp.id];
      const st = c ? (MC.CHECK_STATUS.find((s) => s.id === c.status) || null) : null;
      const tone = st ? st.tone : 'unknown';
      const pct = st ? st.score : 0;
      const barColor = tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--warn)'
        : tone === 'warn2' ? 'var(--warn2)' : tone === 'danger' ? 'var(--danger)' : 'var(--surface-3)';
      // status asing pada data tersimpan: st = null -> tampil "Belum diperiksa",
      // bukan diam-diam tampil sebagai "Sehat" (itu menyesatkan)
      html += '<button class="comp" data-act="check-comp" data-comp="' + comp.id + '">' +
        '<div class="head"><span class="name">' + CU.esc(comp.label) + '</span></div>' +
        '<div class="st ' + tone + '">' + (st ? CU.esc(st.label) : 'Belum diperiksa') + '</div>' +
        '<div class="mbar"><i style="width:' + pct + '%;background:' + barColor + '"></i></div>' +
        (c && c.date ? '<div style="font-size:10px;color:var(--text-3);margin-top:5px">' + MC.fmtDate(c.date, { day: 'numeric', month: 'short' }) + '</div>' : '') +
      '</button>';
    });
    html += '</div>';

    html += '<div class="banner warn" style="margin-top:16px">' + I.icon('alert') +
      '<span><b>Skor ini bukan diagnosis.</b> Hanya mencerminkan apa yang kamu isi. Bunyi mesin aneh atau rem blong tetap harus diperiksa mekanik.</span></div>';

    return html;
  }

  /* ---------- penjelasan skor ----------
   * Dokumen 07-C menuntut skor disertai cara hitungnya. Tanpa ini user hanya
   * melihat satu angka yang tidak bisa diperiksa — dan angka yang tidak bisa
   * diperiksa sama saja dengan tebakan dari sudut pandang user.
   *
   * Yang ditampilkan: penyebut (komponen apa saja yang dihitung dan bobotnya),
   * nilai tiap komponen, tiap penalti yang diterapkan, dan komponen yang
   * DIKELUARKAN dari hitungan beserta alasannya.
   */
  function scoreDetail(health) {
    if (health.score === null) {
      return '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line-soft)">' +
        '<div style="font-size:11.5px;color:var(--text-3);line-height:1.55">' +
          'Skor belum dihitung karena tidak ada satu pun komponen yang diperiksa. ' +
          'Komponen yang belum diperiksa <b>tidak</b> dianggap sehat — itu sebabnya skornya kosong, bukan 0.' +
        '</div></div>';
    }

    const counted = health.breakdown.filter((b) => b.counted);
    const notCounted = health.breakdown.filter((b) => !b.counted);

    let rows = '';
    counted.forEach((b) => {
      const tone = (MC.CHECK_STATUS.find((s) => s.id === b.status) || {}).tone || 'unknown';
      rows += '<div class="sd-row">' +
        '<span class="sd-name">' + CU.esc(b.label) + '</span>' +
        '<span class="sd-w">bobot ' + b.weight + '</span>' +
        '<span class="sd-v" style="color:var(--' + tone + ')">' + b.value + '%</span>' +
      '</div>';
    });

    let penRows = '';
    if (health.penalties.length) {
      health.penalties.forEach((p) => {
        penRows += '<div class="sd-row">' +
          '<span class="sd-name">' + CU.esc(p.label) + '</span>' +
          '<span class="sd-w">' + (p.cap ? 'maks ' + p.cap : 'tetap') + '</span>' +
          '<span class="sd-v" style="color:var(--danger)">−' + p.amount + '</span>' +
        '</div>';
      });
    } else {
      penRows = '<div class="sd-row"><span class="sd-name" style="color:var(--text-3)">Tidak ada penalti</span></div>';
    }

    let skipNote = '';
    if (notCounted.length) {
      skipNote = '<div class="sd-note">Dikeluarkan dari penyebut (' + notCounted.length + '): ' +
        notCounted.map((b) => CU.esc(b.label)).join(', ') +
        '. Komponen ini tidak punya data pemeriksaan, jadi tidak ikut menaikkan atau menurunkan skor.</div>';
    }

    return '<details class="sd">' +
      '<summary class="sd-sum">Lihat cara hitung skor' + I.icon('right', 14) + '</summary>' +
      '<div class="sd-body">' +
        '<div class="sd-formula">' +
          '(' + counted.map((b) => b.value + '×' + b.weight).join(' + ') + ') ÷ ' +
          counted.reduce((a, b) => a + b.weight, 0) +
          ' = ' + health.base + ' <span style="color:var(--text-3)">dasar</span>' +
        '</div>' +
        '<div class="sd-sec">Nilai per komponen</div>' + rows +
        '<div class="sd-sec">Penalti yang diterapkan</div>' + penRows +
        (health.penalties.length
          ? '<div class="sd-formula">' + health.base + ' − ' +
              health.penalties.reduce((a, b) => a + b.amount, 0) + ' penalti = <b>' + health.score + '</b></div>'
          : '') +
        skipNote +
      '</div>' +
    '</details>';
  }

  function setTab(t) { tab = t; }

  global.MCPages = global.MCPages || {};
  global.MCPages.care = { render, setTab, getTab: () => tab };
})(window);
