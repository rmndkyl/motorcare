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

    const groups = { overdue: [], soon: [], ok: [], unknown: [], 'no-baseline': [] };
    rems.forEach((r) => { (groups[r.state] || groups.unknown).push(r); });

    if (groups.overdue.length) {
      html += '<div class="banner danger" style="margin-bottom:12px">' + I.icon('alert') +
        '<span><b>' + groups.overdue.length + ' perawatan terlewat.</b> Motor berisiko kalau dibiarkan — minimal periksa kondisinya.</span></div>';
    }

    html += '<button class="btn primary block" data-act="add-reminder" style="margin-bottom:14px">' +
      I.icon('plus') + 'Tambah Pengingat</button>';

    const sections = [
      ['overdue', 'Terlewat', 'danger'],
      ['soon', 'Segera', 'warn'],
      ['ok', 'Terjadwal', 'ok'],
      ['no-baseline', 'Belum ada dasar', 'unknown']
    ];

    sections.forEach(([key, title, tone]) => {
      const items = groups[key];
      if (!items || !items.length) return;
      html += '<div class="sec-title">' + title + ' (' + items.length + ')</div>';
      html += '<div class="card" style="padding:6px 14px"><div class="rows">';
      items.forEach((r) => {
        html += '<button class="row" data-act="edit-reminder" data-id="' + r.id + '">' +
          '<span class="ic" style="color:var(--' + tone + ')">' + I.icon('clock') + '</span>' +
          '<span class="body">' +
            '<span class="t">' + CU.esc(r.label) + '</span>' +
            '<span class="s">' + reminderSub(r) + '</span>' +
          '</span>' +
          '<span class="end"><div style="font-size:12.5px;font-weight:600;color:var(--' + tone + ')">' +
            (r.kmLeft !== null ? (r.state === 'overdue' ? '−' + MC.fmtNum(Math.abs(r.kmLeft)) : MC.fmtNum(r.kmLeft)) + ' km'
              : r.daysLeft !== null ? (r.state === 'overdue' ? '−' + Math.abs(r.daysLeft) : r.daysLeft) + ' hari'
              : '—') + '</div>' +
            (r.nextDate ? '<div class="d">' + MC.fmtDate(r.nextDate, { day: 'numeric', month: 'short' }) + '</div>' : '') +
          '</span>' +
        '</button>';
      });
      html += '</div></div>';
    });

    html += '<div class="banner info" style="margin-top:16px">' + I.icon('info') +
      '<span>Interval default mengikuti rekomendasi umum. Sesuaikan dengan buku manual motormu atau saran mekanik — setiap pengingat bisa diedit.</span></div>';

    return html;
  }

  function reminderSub(r) {
    const parts = [];
    if (r.intervalKm) parts.push('tiap ' + MC.fmtNum(r.intervalKm) + ' km');
    if (r.intervalDays) parts.push('tiap ' + r.intervalDays + ' hari');
    if (r.lastKm !== null && r.lastKm !== undefined) parts.push('terakhir ' + MC.fmtNum(r.lastKm) + ' km');
    else if (r.lastDate) parts.push('terakhir ' + MC.fmtDate(r.lastDate, { day: 'numeric', month: 'short', year: '2-digit' }));
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
    let html = '';

    // gauge ringkas
    const toneVar = health.tone === 'ok' ? 'var(--ok)' : health.tone === 'warn' ? 'var(--warn)'
      : health.tone === 'warn2' ? 'var(--warn2)' : health.tone === 'danger' ? 'var(--danger)' : 'var(--line)';
    html += '<div class="card" style="margin-bottom:14px">' +
      '<div class="score-wrap">' +
        '<div class="gauge">' + I.ring(health.score, toneVar) +
          '<div class="num">' + (health.score === null ? '—' : health.score) + (health.score !== null ? '<small>%</small>' : '') + '</div></div>' +
        '<div class="score-info"><div class="kicker">Skor kesehatan</div>' +
          '<div class="state" style="color:' + toneVar + '">' + CU.esc(health.label) + '</div>' +
          '<div class="sub">' + health.checked + ' dari ' + health.total + ' komponen punya data pemeriksaan</div></div>' +
      '</div></div>';

    html += '<button class="btn primary block" data-act="add-check" style="margin-bottom:14px">' +
      I.icon('gauge') + 'Catat Pemeriksaan</button>';

    html += '<div class="comp-grid">';
    MC.COMPONENTS.forEach((comp) => {
      const c = latest[comp.id];
      const st = c ? (MC.CHECK_STATUS.find((s) => s.id === c.status) || MC.CHECK_STATUS[0]) : null;
      const tone = st ? st.tone : 'unknown';
      const pct = st ? st.score : 0;
      const barColor = tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--warn)'
        : tone === 'warn2' ? 'var(--warn2)' : tone === 'danger' ? 'var(--danger)' : 'var(--surface-3)';
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

  function setTab(t) { tab = t; }

  global.MCPages = global.MCPages || {};
  global.MCPages.care = { render, setTab, getTab: () => tab };
})(window);
