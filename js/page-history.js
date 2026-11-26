/* MOTORCARE — Riwayat: kerusakan, pengeluaran, odometer, timeline */
(function (global) {
  'use strict';
  const MC = global.MC, CU = global.MCU, I = global.MCI, MCS = global.MCS, MCD = global.MCD;

  let tab = 'timeline';

  function render() {
    const bike = MCS.activeBike();
    if (!bike) {
      return '<div style="padding-top:20px">' + CU.empty('history', 'Belum ada motor', 'Riwayat muncul setelah kamu menambahkan motor.',
        '<button class="btn primary" data-act="add-bike">' + I.icon('plus') + 'Tambah Motor</button>') + '</div>';
    }
    const ctx = MCS.ctxFor(bike);

    let html = '<div style="margin-bottom:14px"><h1>Riwayat</h1>' +
      '<div style="font-size:12.5px;color:var(--text-3);margin-top:2px">' + CU.esc(bike.nickname) + '</div></div>';

    html += '<div class="chips" style="margin-bottom:16px">' +
      ['timeline|Timeline', 'rusak|Kerusakan', 'biaya|Pengeluaran', 'odo|Odometer'].map((x) => {
        const [k, l] = x.split('|');
        return '<button class="chip ' + (tab === k ? 'on' : '') + '" data-tab="' + k + '">' + l + '</button>';
      }).join('') +
    '</div>';

    if (tab === 'timeline') html += renderTimeline(ctx, bike);
    else if (tab === 'rusak') html += renderDamages(ctx, bike);
    else if (tab === 'biaya') html += renderExpenses(ctx, bike);
    else html += renderOdo(ctx, bike);

    return html;
  }

  /* ============ TIMELINE ============ */
  function renderTimeline(ctx, bike) {
    const ev = MCD.timeline(ctx);
    if (!ev.length) {
      return CU.empty('history', 'Timeline masih kosong', 'Timeline terbentuk otomatis dari servis, kerusakan, odometer, dan pemeriksaan.');
    }
    let html = '<div class="card"><div class="tl">';
    ev.slice(0, 80).forEach((e) => {
      html += '<div class="tl-item ' + e.kind + '">' +
        '<div class="d">' + MC.fmtDate(e.date) + (e.km ? ' · ' + MC.fmtKm(e.km) : '') + '</div>' +
        '<div class="t">' + CU.esc(e.title) + '</div>' +
        (e.detail ? '<div class="s">' + CU.esc(e.detail) + '</div>' : '') +
        (e.cost ? '<div class="s" style="color:var(--accent-text)">' + MC.fmtRp(e.cost) + '</div>' : '') +
      '</div>';
    });
    html += '</div></div>';
    if (ev.length > 80) html += '<div style="text-align:center;font-size:11.5px;color:var(--text-3);margin-top:10px">Menampilkan 80 dari ' + ev.length + ' kejadian terbaru</div>';
    return html;
  }

  /* ============ KERUSAKAN ============ */
  function renderDamages(ctx, bike) {
    const list = ctx.damages.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    let html = '<button class="btn primary block" data-act="add-damage" style="margin-bottom:14px">' +
      I.icon('plus') + 'Catat Kerusakan</button>';

    if (!list.length) {
      return html + '<div class="card">' + CU.empty('shield', 'Belum ada kerusakan tercatat',
        'Mencatat kerusakan membuat pola masalah motor terlihat — dan membantu mekanik saat servis.') + '</div>';
    }

    const open = list.filter((d) => d.status !== 'selesai');
    const done = list.filter((d) => d.status === 'selesai');

    [['Terbuka', open], ['Selesai', done]].forEach(([title, items]) => {
      if (!items.length) return;
      html += '<div class="sec-title">' + title + ' (' + items.length + ')</div>';
      html += '<div style="display:flex;flex-direction:column;gap:9px">';
      items.forEach((d) => {
        const pr = MC.PRIORITIES.find((p) => p.id === d.priority) || MC.PRIORITIES[1];
        const st = MC.DAMAGE_STATUS.find((s) => s.id === d.status) || MC.DAMAGE_STATUS[0];
        html += '<button class="card" data-act="damage" data-id="' + d.id + '" style="text-align:left;width:100%">' +
          '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">' +
            '<div style="min-width:0;flex:1">' +
              '<div style="font-size:14px;font-weight:600">' + CU.esc(d.name) + '</div>' +
              '<div style="font-size:11.5px;color:var(--text-3);margin-top:2px">' + CU.esc(d.part || '—') + ' · ' + MC.fmtDate(d.date) + '</div>' +
              (d.symptoms ? '<div style="font-size:11.5px;color:var(--text-2);margin-top:5px;line-height:1.4">' + CU.esc(d.symptoms) + '</div>' : '') +
            '</div>' +
            '<div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex:none">' +
              CU.badge(pr.label, pr.tone, true) + CU.badge(st.label, d.status === 'selesai' ? 'ok' : 'unknown') +
            '</div>' +
          '</div>' +
          (d.estCost ? '<div style="font-size:12.5px;color:var(--accent-text);margin-top:8px;font-weight:600">Est. ' + MC.fmtRp(d.estCost) + '</div>' : '') +
        '</button>';
      });
      html += '</div>';
    });

    const totalEst = list.reduce((a, b) => a + (+b.estCost || 0), 0);
    if (totalEst) html += '<div class="banner info" style="margin-top:14px">' + I.icon('info') + '<span>Total estimasi biaya perbaikan: <b>' + MC.fmtRp(totalEst) + '</b></span></div>';

    return html;
  }

  /* ============ PENGELUARAN ============ */
  function renderExpenses(ctx, bike) {
    const st = MCD.expenseStats(ctx.expenses);
    let html = '<button class="btn primary block" data-act="add-expense" style="margin-bottom:14px">' +
      I.icon('plus') + 'Catat Pengeluaran</button>';

    if (!st.list.length) {
      return html + '<div class="card">' + CU.empty('rupiah', 'Belum ada pengeluaran',
        'Catat servis, bensin, pajak, dan modifikasi untuk tahu biaya asli motormu.') + '</div>';
    }

    html += '<div class="stats" style="margin-bottom:14px">' +
      '<div class="stat"><div class="k">Bulan ini</div><div class="v" style="font-size:16px">' + MC.fmtRp(st.monthTotal) + '</div></div>' +
      '<div class="stat"><div class="k">Tahun ini</div><div class="v" style="font-size:16px">' + MC.fmtRp(st.yearTotal) + '</div></div>' +
      '<div class="stat"><div class="k">Rata-rata/bulan</div><div class="v" style="font-size:16px">' + MC.fmtRp(st.avgMonthly) + '</div></div>' +
      '<div class="stat"><div class="k">Rata-rata servis</div><div class="v" style="font-size:16px">' + MC.fmtRp(st.avgService) + '</div></div>' +
    '</div>';

    // grafik per bulan
    const months = Object.keys(st.byMonth).sort().slice(-12);
    if (months.length) {
      const max = Math.max.apply(null, months.map((m) => st.byMonth[m]));
      html += '<div class="card" style="margin-bottom:14px">' +
        '<div class="card-head"><h3>Pengeluaran per bulan</h3></div>' +
        '<div class="bars">' + months.map((m) => {
          const v = st.byMonth[m];
          const h = max ? Math.max(3, Math.round(v / max * 100)) : 0;
          return '<div class="b" title="' + MC.fmtRp(v) + '">' +
            '<span class="val">' + (v >= 1000000 ? (v / 1000000).toFixed(1) + 'jt' : v >= 1000 ? Math.round(v / 1000) + 'k' : v) + '</span>' +
            '<div class="fill" style="height:' + h + '%"></div>' +
            '<span class="lbl">' + m.slice(5) + '</span></div>';
        }).join('') + '</div></div>';
    }

    // breakdown kategori
    html += '<div class="card" style="margin-bottom:14px"><div class="card-head"><h3>Per kategori</h3></div><div class="rows">';
    Object.entries(st.byCategory).sort((a, b) => b[1] - a[1]).forEach(([cat, amt]) => {
      const label = (MC.EXPENSE_CATEGORIES.find((c) => c.id === cat) || {}).label || cat;
      const pct = st.allTotal ? Math.round(amt / st.allTotal * 100) : 0;
      html += '<div class="row"><span class="body"><span class="t" style="font-size:13px">' + CU.esc(label) + '</span>' +
        '<span class="s">' + pct + '% dari total</span></span>' +
        '<span class="end"><span class="v">' + MC.fmtRp(amt) + '</span></span></div>';
    });
    html += '</div></div>';

    // transaksi terbaru
    html += '<div class="sec-title">Transaksi terbaru</div>';
    html += '<div class="card" style="padding:6px 14px"><div class="rows">';
    st.list.slice(0, 40).forEach((e) => {
      const label = (MC.EXPENSE_CATEGORIES.find((c) => c.id === e.category) || {}).label || e.category;
      html += '<button class="row" data-act="expense" data-id="' + e.id + '">' +
        '<span class="ic">' + I.icon('rupiah') + '</span>' +
        '<span class="body"><span class="t">' + CU.esc(e.note || label) + '</span>' +
        '<span class="s">' + label + ' · ' + MC.fmtDate(e.date) + '</span></span>' +
        '<span class="end"><span class="v">' + MC.fmtRp(e.amount) + '</span></span>' +
      '</button>';
    });
    html += '</div></div>';

    return html;
  }

  /* ============ ODOMETER ============ */
  function renderOdo(ctx, bike) {
    const st = MCD.odoStats(bike, ctx.odoLog);
    let html = '<button class="btn primary block" data-act="add-odo" style="margin-bottom:14px">' +
      I.icon('plus') + 'Catat Kilometer</button>';

    html += '<div class="stats" style="margin-bottom:14px">' +
      '<div class="stat"><div class="k">KM saat ini</div><div class="v">' + MC.fmtNum(st.km) + ' <small>km</small></div></div>' +
      '<div class="stat"><div class="k">Total jarak</div><div class="v">' + MC.fmtNum(st.totalDist) + ' <small>km</small></div></div>' +
      '<div class="stat"><div class="k">Rata-rata/bulan</div><div class="v" style="font-size:16px">' + MC.fmtNum(st.avgMonthly) + ' <small>km</small></div></div>' +
      '<div class="stat"><div class="k">Umur pakai</div><div class="v" style="font-size:16px">' + (st.days !== null && st.days >= 30 ? Math.round(st.days / 30) + ' <small>bln</small>' : st.daysImplausible ? '<small>isi tgl mulai</small>' : st.days !== null ? st.days + ' <small>hari</small>' : '—') + '</div></div>' +
    '</div>';

    if (st.monthly.length) {
      const max = Math.max.apply(null, st.monthly.map((m) => m.km));
      html += '<div class="card" style="margin-bottom:14px"><div class="card-head"><h3>Jarak tempuh per bulan</h3></div>' +
        '<div class="bars">' + st.monthly.slice(-12).map((m) => {
          const h = Math.max(3, Math.round(m.km / max * 100));
          return '<div class="b" title="' + MC.fmtNum(m.km) + ' km"><span class="val">' + MC.fmtNum(m.km) + '</span>' +
            '<div class="fill" style="height:' + h + '%"></div><span class="lbl">' + m.month.slice(5) + '</span></div>';
        }).join('') + '</div></div>';
    }

    if (!st.logs.length) {
      return html + '<div class="card">' + CU.empty('gauge', 'Belum ada catatan odometer',
        'Catat KM secara berkala supaya jadwal servis berbasis jarak akurat.') + '</div>';
    }

    html += '<div class="sec-title">Riwayat odometer</div>';
    html += '<div class="card" style="padding:6px 14px"><div class="rows">';

    // tampilkan dari yang terbaru, dengan delta
    const sorted = st.logs.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    sorted.forEach((o, i) => {
      const prev = sorted[i + 1];
      const delta = prev && o.km && prev.km ? +o.km - +prev.km : null;
      html += '<button class="row" data-act="odo" data-id="' + o.id + '">' +
        '<span class="ic">' + I.icon('gauge2') + '</span>' +
        '<span class="body"><span class="t">' + MC.fmtKm(o.km) + '</span>' +
        '<span class="s">' + MC.fmtDate(o.date) + (o.note ? ' · ' + CU.esc(o.note) : '') + '</span></span>' +
        '<span class="end">' + (delta && delta > 0 ? '<span class="v" style="color:var(--ok);font-size:12px">+' + MC.fmtNum(delta) + ' km</span>' : '') + '</span>' +
      '</button>';
    });
    html += '</div></div>';

    return html;
  }

  function setTab(t) { tab = t; }

  global.MCPages = global.MCPages || {};
  global.MCPages.history = { render, setTab, getTab: () => tab };
})(window);
