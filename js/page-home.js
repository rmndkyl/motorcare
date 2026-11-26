/* MOTORCARE — Home / Dashboard */
(function (global) {
  'use strict';
  const MC = global.MC, CU = global.MCU, I = global.MCI, MCS = global.MCS, MCD = global.MCD;

  function render() {
    const S = MCS.S;
    const bike = MCS.activeBike();

    if (!bike) return onboarding();

    const ctx = MCS.ctxFor(bike);
    const km = MCD.currentKm(bike, ctx.odoLog, ctx.services);
    const health = MCD.healthScore(bike, ctx);
    const reminders = MCD.buildReminders(bike, ctx.services, ctx.reminders, km);
    const exp = MCD.expenseStats(ctx.expenses);

    const urgent = reminders.filter((r) => r.state === 'overdue' || r.state === 'soon').slice(0, 3);
    const openDmg = ctx.damages.filter((d) => d.status !== 'selesai');
    const nextSvc = reminders.find((r) => r.state !== 'no-baseline');

    const heroPhoto = (bike.photos || {}).samping || (bike.photos || {}).depan || (bike.photos || {}).belakang;

    let html = '';

    /* ---- hero ---- */
    html += '<div class="hero">' +
      '<div class="hero-img' + (heroPhoto ? '' : ' no-photo') + '">' +
        (heroPhoto ? '<img src="' + heroPhoto + '" alt="Foto ' + CU.esc(bike.nickname) + '">'
          : '<div class="ph">' + I.icon('bike', 30) +
              '<div class="phtxt"><b>Belum ada foto motor</b><span>Foto memudahkan saat ke bengkel</span></div>' +
              '<button class="addphoto" data-act="editbike">Tambah</button></div>') +
        '<div class="hero-overlay"></div>' +
      '</div>' +
      '<div class="hero-body">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">' +
          '<div style="min-width:0">' +
            '<div class="nick">' + CU.esc(bike.nickname) + '</div>' +
            '<div class="meta">' + CU.esc([bike.brand, bike.model, bike.year].filter(Boolean).join(' · ')) +
              (bike.cc ? ' · ' + bike.cc + 'cc' : '') + '</div>' +
          '</div>' +
          '<button class="iconbtn" data-act="editbike" aria-label="Edit motor">' + I.icon('edit') + '</button>' +
        '</div>' +
        (bike.plate ? '<div class="plate">' + CU.esc(bike.plate) + '</div>' : '') +
      '</div>' +
    '</div>';

    /* ---- gauge + km ---- */
    const toneVar = health.tone === 'ok' ? 'var(--ok)' : health.tone === 'warn' ? 'var(--warn)'
      : health.tone === 'warn2' ? 'var(--warn2)' : health.tone === 'danger' ? 'var(--danger)' : 'var(--line)';

    html += '<div class="card" style="margin-top:10px">' +
      '<div class="score-wrap">' +
        '<div class="gauge">' + I.ring(health.score, toneVar) +
          '<div class="num">' + (health.score === null ? '—' : health.score) + (health.score !== null ? '<small>%</small>' : '') + '</div>' +
        '</div>' +
        '<div class="score-info">' +
          '<div class="kicker">Skor kesehatan</div>' +
          '<div class="state" style="color:' + toneVar + '">' + CU.esc(health.label) + '</div>' +
          '<div class="sub">' + (health.score === null
            ? 'Belum ada pemeriksaan komponen'
            : health.checked + ' dari ' + health.total + ' komponen sudah diperiksa') + '</div>' +
          '<button class="btn sm ghost" data-act="go-check">' + I.icon('gauge') + 'Periksa</button>' +
        '</div>' +
      '</div>' +
      (health.factors.length
        ? '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line-soft);display:flex;flex-direction:column;gap:6px">' +
            health.factors.slice(0, 3).map((f) =>
              '<div style="display:flex;gap:7px;align-items:flex-start;font-size:12px;color:var(--text-2)">' +
                '<span style="color:var(--' + (f.tone === 'unknown' ? 'text-3' : f.tone) + ');flex:none;margin-top:1px">' + I.icon('alert', 13) + '</span>' +
                '<span>' + CU.esc(f.text) + '</span></div>'
            ).join('') +
            (health.factors.length > 3 ? '<div style="font-size:11.5px;color:var(--text-3);padding-left:20px">+' + (health.factors.length - 3) + ' faktor lain</div>' : '') +
          '</div>'
        : '') +
    '</div>';

    /* ---- stat grid ---- */
    html += '<div class="stats" style="margin-top:10px">' +
      '<div class="stat"><div class="k">Odometer</div><div class="v">' + MC.fmtNum(km) + ' <small>km</small></div></div>' +
      '<div class="stat"><div class="k">Servis berikutnya</div><div class="v" style="font-size:' +
        (nextSvc && nextSvc.kmLeft !== null && nextSvc.kmLeft < 1000 ? '15px' : '17px') + '">' +
        (nextSvc && nextSvc.kmLeft !== null ? MC.fmtNum(Math.max(0, nextSvc.kmLeft)) + ' <small>km lagi</small>'
          : nextSvc && nextSvc.daysLeft !== null ? Math.max(0, nextSvc.daysLeft) + ' <small>hari lagi</small>'
          : '<small>belum ada</small>') + '</div></div>' +
      '<div class="stat"><div class="k">Pengeluaran bulan ini</div><div class="v" style="font-size:16px">' + MC.fmtRp(exp.monthTotal) + '</div></div>' +
      '<div class="stat"><div class="k">Total perawatan</div><div class="v" style="font-size:16px">' + MC.fmtRp(exp.allTotal) + '</div></div>' +
    '</div>';

    /* ---- reminder alert ---- */
    if (urgent.length) {
      html += '<div class="sec-title">Perlu tindakan</div>';
      html += '<div class="card" style="padding:6px 14px"><div class="rows">';
      urgent.forEach((r) => {
        const isOver = r.state === 'overdue';
        const sub = [];
        if (r.kmLeft !== null) sub.push(isOver ? 'lewat ' + MC.fmtNum(Math.abs(r.kmLeft)) + ' km' : MC.fmtNum(r.kmLeft) + ' km lagi');
        if (r.daysLeft !== null) sub.push(isOver ? 'lewat ' + Math.abs(r.daysLeft) + ' hari' : r.daysLeft + ' hari lagi');
        html += '<button class="row" data-act="reminder" data-id="' + r.id + '">' +
          '<span class="ic" style="color:var(--' + (isOver ? 'danger' : 'warn') + ')">' + I.icon('clock') + '</span>' +
          '<span class="body"><span class="t">' + CU.esc(r.label) + '</span>' +
          '<span class="s">' + CU.esc(sub.join(' · ') || 'Belum ada data dasar') + '</span></span>' +
          '<span class="end">' + CU.badge(isOver ? 'Terlewat' : 'Segera', isOver ? 'danger' : 'warn', true) + '</span>' +
        '</button>';
      });
      html += '</div></div>';
    }

    /* ---- kerusakan terbuka ---- */
    if (openDmg.length) {
      html += '<div class="sec-title">Kerusakan terbuka</div>';
      html += '<div class="card" style="padding:6px 14px"><div class="rows">';
      openDmg.slice(0, 3).forEach((d) => {
        const pr = MC.PRIORITIES.find((p) => p.id === d.priority) || MC.PRIORITIES[0];
        html += '<button class="row" data-act="damage" data-id="' + d.id + '">' +
          '<span class="ic" style="color:var(--' + pr.tone + ')">' + I.icon('alert') + '</span>' +
          '<span class="body"><span class="t">' + CU.esc(d.name) + '</span>' +
          '<span class="s">' + CU.esc((d.part || '') + (d.symptoms ? ' · ' + d.symptoms : '')) + '</span></span>' +
          '<span class="end">' + CU.badge(pr.label, pr.tone, true) + '</span>' +
        '</button>';
      });
      if (openDmg.length > 3) {
        html += '<button class="row" data-act="go-history"><span class="body" style="color:var(--accent-text);font-size:13px">Lihat semua ' + openDmg.length + ' kerusakan</span><span class="end">' + I.icon('right', 16) + '</span></button>';
      }
      html += '</div></div>';
    }

    /* ---- servis terakhir ---- */
    const recentSvc = ctx.services.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 3);
    html += '<div class="sec-title">Servis terakhir</div>';
    if (recentSvc.length) {
      html += '<div class="card" style="padding:6px 14px"><div class="rows">';
      recentSvc.forEach((s) => {
        const types = (s.types || [s.type]).map((t) => (MC.SERVICE_TYPES.find((x) => x.id === t) || {}).label || t);
        html += '<button class="row" data-act="service" data-id="' + s.id + '">' +
          '<span class="ic">' + I.icon('wrench') + '</span>' +
          '<span class="body"><span class="t">' + CU.esc(types.join(' + ')) + '</span>' +
          '<span class="s">' + MC.fmtDate(s.date) + ' · ' + MC.fmtKm(s.km) + (s.shop ? ' · ' + CU.esc(s.shop) : '') + '</span></span>' +
          '<span class="end"><span class="v">' + (s.cost ? MC.fmtRp(s.cost) : '—') + '</span></span>' +
        '</button>';
      });
      html += '</div></div>';
    } else {
      html += '<div class="card">' + CU.empty('wrench', 'Belum ada catatan servis', 'Catat servis pertama supaya riwayat motor terbentuk.',
        '<button class="btn primary sm" data-act="add-service">' + I.icon('plus') + 'Catat Servis</button>') + '</div>';
    }

    return html;
  }

  function onboarding() {
    return '<div style="padding:28px 4px 10px;text-align:center">' +
      '<div style="width:80px;height:80px;margin:0 auto 18px;border-radius:24px;background:var(--accent-soft);display:grid;place-items:center;color:var(--accent)">' +
        I.icon('bike', 42) + '</div>' +
      '<h1 style="font-size:25px">Mulai rekam<br>kesehatan motormu</h1>' +
      '<p style="color:var(--text-2);font-size:13.5px;margin:12px auto 0;max-width:290px;line-height:1.55">' +
        'Semua data tersimpan di HP ini. Tidak ada akun, tidak ada server, tidak ada yang bisa melihat riwayat motormu.</p>' +
    '</div>' +
    '<div class="card" style="margin-top:18px">' +
      '<div style="display:flex;flex-direction:column;gap:14px">' +
        featureRow('gauge', 'Skor kesehatan dari data nyata', 'Dihitung dari pemeriksaan yang kamu isi sendiri — bukan tebakan.') +
        featureRow('clock', 'Pengingat by KM dan tanggal', 'Oli, CVT, kampas rem, pajak — semua bisa kamu atur sendiri.') +
        featureRow('rupiah', 'Tahu ke mana uang perginya', 'Servis, bensin, pajak, modifikasi dalam satu grafik.') +
        featureRow('shield', 'Data milikmu, bukan milik server', 'Backup JSON bisa diekspor kapan saja.') +
      '</div>' +
    '</div>' +
    '<button class="btn primary block" style="margin-top:16px;min-height:50px" data-act="add-bike">' +
      I.icon('plus') + 'Tambah Motor Pertama</button>' +
    '<p style="text-align:center;font-size:11.5px;color:var(--text-3);margin-top:12px;line-height:1.5">' +
      'Sudah punya backup?<br><button style="color:var(--accent-text);font-size:11.5px;text-decoration:underline" data-act="import-json">Impor file backup</button></p>';
  }

  function featureRow(ic, title, sub) {
    return '<div style="display:flex;gap:11px;align-items:flex-start">' +
      '<span style="width:32px;height:32px;border-radius:9px;background:var(--surface-2);display:grid;place-items:center;color:var(--accent);flex:none">' + I.icon(ic, 16) + '</span>' +
      '<div><div style="font-size:13.5px;font-weight:500">' + CU.esc(title) + '</div>' +
      '<div style="font-size:11.5px;color:var(--text-3);margin-top:1px;line-height:1.45">' + CU.esc(sub) + '</div></div></div>';
  }

  global.MCPages = global.MCPages || {};
  global.MCPages.home = { render };
})(window);
