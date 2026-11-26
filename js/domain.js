/* MOTORCARE — domain logic
 * Aturan utama: TIDAK ada diagnosis otomatis. Skor hanya dihitung dari
 * data yang benar-benar diisi user (pemeriksaan, servis, kerusakan).
 * Komponen yang belum diperiksa TIDAK dianggap sehat.
 */
(function (global) {
  'use strict';
  const MC = global.MC;

  /* ---------- kilometre ---------- */
  // KM terkini = angka terbesar yang pernah dicatat (odo log, servis, profil).
  // Motor tidak mundur; kalau user salah input lebih kecil, itu tidak menurunkan KM.
  function currentKm(bike, odoLog, services) {
    const candidates = [];
    if (bike && Number.isFinite(+bike.currentKm)) candidates.push(+bike.currentKm);
    (odoLog || []).forEach((o) => { if (Number.isFinite(+o.km)) candidates.push(+o.km); });
    (services || []).forEach((s) => { if (Number.isFinite(+s.km)) candidates.push(+s.km); });
    return candidates.length ? Math.max.apply(null, candidates) : null;
  }

  function lastOdoUpdate(bike, odoLog) {
    const dates = [];
    (odoLog || []).forEach((o) => { if (o.date) dates.push(o.date); });
    if (bike && bike.currentKmDate) dates.push(bike.currentKmDate);
    if (!dates.length) return null;
    return dates.sort().slice(-1)[0];
  }

  /* ---------- umur komponen: kapan terakhir diganti ---------- */
  function componentAge(services) {
    const map = {};
    (services || []).forEach((s) => {
      const types = s.types && s.types.length ? s.types : (s.type ? [s.type] : []);
      types.forEach((t) => {
        const prev = map[t];
        if (!prev || (s.date || '') > (prev.date || '')) {
          map[t] = { date: s.date, km: s.km, cost: s.cost, shop: s.shop, serviceId: s.id };
        }
      });
    });
    return map;
  }

  /* ---------- reminder engine ---------- */
  // Setiap reminder punya dua sumbu: KM dan tanggal. Yang mana pun lebih dulu
  // tercapai = itu yang menentukan status. Bisa dimatikan per sumbu (interval null).
  function buildReminders(bike, services, reminders, km) {
    const age = componentAge(services);
    const out = [];
    const segment = MC.resolveSegment(bike);

    (reminders || []).forEach((r) => {
      if (r.active === false) return;
      // Pengingat yang mustahil untuk segmen motor ini tidak ditampilkan.
      // Build lama sempat memberi motor matic pengingat "Rantai & gear"; data itu
      // sudah tersimpan di IndexedDB user dan tidak bisa dihapus dari kode. Yang
      // bisa dilakukan: jangan tampilkan sebagai tugas yang harus dikerjakan.
      if (!MC.reminderApplies(r.kind, segment)) return;
      let lastKm = null, lastDate = null;

      if (r.serviceType) {
        const a = age[r.serviceType];
        if (a) { lastKm = a.km; lastDate = a.date; }
      }
      if (r.manualLastKm !== null && r.manualLastKm !== undefined && r.manualLastKm !== '') lastKm = +r.manualLastKm;
      if (r.manualLastDate) lastDate = r.manualLastDate;
      if (r.lastDoneKm !== null && r.lastDoneKm !== undefined && r.lastDoneKm !== '') lastKm = +r.lastDoneKm;
      if (r.lastDoneDate) lastDate = r.lastDoneDate;

      /* Kalau tidak ada riwayat servis, kita TIDAK TAHU kapan terakhir diganti.
         Menebak dari KM awal lalu menampilkan "terlewat 60.000 km" adalah angka palsu
         yang bikin panik tanpa guna. Jadi: tetap hitung jadwal saran (biar user tahu
         intervalnya), tapi statusnya 'needs-baseline' + CTA "catat servis terakhir". */
      let estimated = false;
      if (lastKm === null && lastDate === null && bike) {
        if (bike.startKm !== null && bike.startKm !== undefined) { lastKm = +bike.startKm; estimated = true; }
        if (bike.startDate) { lastDate = bike.startDate; estimated = true; }
      }

      const nextKm = (r.intervalKm && lastKm !== null) ? lastKm + +r.intervalKm : null;
      const nextDate = (r.intervalDays && lastDate) ? MC.addDays(lastDate, +r.intervalDays) : null;

      const kmLeft = (nextKm !== null && km !== null) ? nextKm - km : null;
      const daysLeft = nextDate ? MC.daysBetween(MC.todayISO(), nextDate) : null;

      let state = 'unknown';   // tidak ada data dasar
      if (nextDate === null && nextKm === null) state = 'no-baseline';
      else if (estimated) state = 'needs-baseline';   // jadwal ada, tapi dasar hitungannya tebakan
      else {
        const kmOver = kmLeft !== null && kmLeft <= 0;
        const dateOver = daysLeft !== null && daysLeft <= 0;
        const kmSoon = kmLeft !== null && kmLeft <= (r.soonKm || 300);
        const dateSoon = daysLeft !== null && daysLeft <= (r.soonDays || 21);
        if (kmOver || dateOver) state = 'overdue';
        else if (kmSoon || dateSoon) state = 'soon';
        else state = 'ok';
      }

      out.push({
        id: r.id, kind: r.kind, label: r.label || kindLabel(r.kind),
        nextKm, nextDate, kmLeft, daysLeft, state, estimated,
        lastKm, lastDate, intervalKm: r.intervalKm, intervalDays: r.intervalDays,
        serviceType: r.serviceType
      });
    });

    // urut: paling mendesak dulu
    const rank = { overdue: 0, soon: 1, 'needs-baseline': 2, ok: 3, 'no-baseline': 4, unknown: 5 };
    out.sort((a, b) => {
      if (rank[a.state] !== rank[b.state]) return rank[a.state] - rank[b.state];
      const av = a.kmLeft !== null ? a.kmLeft : (a.daysLeft !== null ? a.daysLeft * 50 : 999999);
      const bv = b.kmLeft !== null ? b.kmLeft : (b.daysLeft !== null ? b.daysLeft * 50 : 999999);
      return av - bv;
    });
    return out;
  }

  function kindLabel(kind) {
    const t = MC.REMINDER_TEMPLATES.find((x) => x.kind === kind);
    return t ? t.label : kind;
  }

  /* ---------- health score (jujur, berbasis data pemeriksaan) ---------- */
  function healthScore(bike, ctx) {
    const { checks, services, damages, reminders } = ctx;
    const km = currentKm(bike, ctx.odoLog, services);

    // Komponen aktif diturunkan dari segmen motor, bukan satu daftar global.
    // Motor manual tidak punya CVT; motor CVT tidak punya rantai & gir. Menghitung
    // komponen yang tidak ada sebagai "belum diperiksa" akan menghukum skor karena
    // sesuatu yang memang tidak perlu diperiksa.
    const segment = MC.resolveSegment(bike);
    const comps = MC.componentsFor(segment);

    const latestByComponent = {};
    (checks || []).forEach((c) => {
      const prev = latestByComponent[c.component];
      if (!prev || (c.date || '') >= (prev.date || '')) latestByComponent[c.component] = c;
    });

    // Hanya pemeriksaan dengan status yang DIKENAL yang boleh masuk hitungan.
    // Sebelumnya status tak dikenal jatuh ke CHECK_STATUS[0] = "Sehat" (100),
    // jadi satu baris rusak dari file backup bisa menaikkan skor ke 100 tanpa
    // ada yang sadar. Status tak dikenal sekarang diperlakukan seperti belum
    // diperiksa: dikeluarkan dari penyebut, bukan dianggap sehat.
    function statusOf(c) {
      return MC.CHECK_STATUS.find((s) => s.id === c.status) || null;
    }

    const relevantIds = comps.map((c) => c.id);
    const active = Object.keys(latestByComponent)
      .filter((k) => relevantIds.indexOf(k) >= 0 && statusOf(latestByComponent[k]));
    const factors = [];

    // rincian per komponen untuk panel penjelasan (P1). Disimpan lengkap supaya
    // user bisa memeriksa angka yang kita beri, bukan hanya 3 faktor teratas.
    const breakdown = comps.map((comp) => {
      const c = latestByComponent[comp.id];
      if (!c) {
        return { id: comp.id, label: comp.label, weight: comp.weight, status: null,
                 statusLabel: 'Belum diperiksa', value: null, counted: false };
      }
      const st = statusOf(c);
      if (!st) {
        return { id: comp.id, label: comp.label, weight: comp.weight, status: c.status,
                 statusLabel: 'Status tidak dikenal', value: null, counted: false,
                 date: c.date };
      }
      return { id: comp.id, label: comp.label, weight: comp.weight, status: c.status,
               statusLabel: st.label, value: st.score, counted: true,
               date: c.date, note: c.note || '' };
    });

    if (!active.length) {
      return {
        score: null,
        label: 'Belum ada data',
        tone: 'unknown',
        checked: 0,
        total: comps.length,
        segment,
        factors: [{ text: 'Belum ada pemeriksaan komponen. Skor tidak bisa dihitung tanpa data.', tone: 'unknown', delta: 0 }],
        breakdown,
        penalties: [],
        excluded: breakdown.filter((b) => !b.counted).map((b) => b.label),
        km
      };
    }

    let sumW = 0, sumS = 0;
    comps.forEach((comp) => {
      const c = latestByComponent[comp.id];
      if (!c) return;
      const st = statusOf(c);
      if (!st) return;                       // status tak dikenal: tidak dihitung
      sumW += comp.weight;
      sumS += st.score * comp.weight;
      if (st.score < 100) {
        factors.push({ text: comp.label + ': ' + st.label, tone: st.tone, delta: 0 });
      }
    });

    const weightedRaw = sumW ? sumS / sumW : 0;
    let score = Math.round(weightedRaw);
    const base = score;
    const penalties = [];

    // penalti dari servis yang lewat jadwal (bukan diagnosis, tapi bukti kelalaian)
    // 'needs-baseline' tidak dihitung: jadwalnya sendiri masih tebakan, jadi tidak
    // boleh dipakai menghukum skor
    const rem = buildReminders(bike, services, reminders, km);
    const overdue = rem.filter((r) => r.state === 'overdue');
    if (overdue.length) {
      const pen = Math.min(18, overdue.length * 6);
      score -= pen;
      const txt = overdue.length + ' jadwal perawatan terlewat';
      factors.push({ text: txt, tone: 'danger', delta: -pen });
      penalties.push({ label: txt, amount: pen, cap: 18 });
    }
    const soon = rem.filter((r) => r.state === 'soon');
    if (soon.length) {
      const pen = Math.min(8, soon.length * 2);
      score -= pen;
      const txt = soon.length + ' perawatan mendekati jadwal';
      factors.push({ text: txt, tone: 'warn', delta: -pen });
      penalties.push({ label: txt, amount: pen, cap: 8 });
    }

    // kerusakan yang belum ditangani
    const openDmg = (damages || []).filter((d) => d.status !== 'selesai');
    const critical = openDmg.filter((d) => d.priority === 'kritis');
    const high = openDmg.filter((d) => d.priority === 'tinggi');
    if (critical.length) {
      const pen = Math.min(20, critical.length * 10);
      score -= pen;
      const txt = critical.length + ' kerusakan kritis belum ditangani';
      factors.push({ text: txt, tone: 'danger', delta: -pen });
      penalties.push({ label: txt, amount: pen, cap: 20 });
    }
    if (high.length) {
      const pen = Math.min(10, high.length * 5);
      score -= pen;
      const txt = high.length + ' kerusakan prioritas tinggi belum ditangani';
      factors.push({ text: txt, tone: 'warn2', delta: -pen });
      penalties.push({ label: txt, amount: pen, cap: 10 });
    }

    // kesegaran data: odometer jarang di-update = skor tidak bisa dipercaya
    const lastOdo = lastOdoUpdate(bike, ctx.odoLog);
    if (lastOdo) {
      const stale = MC.daysBetween(lastOdo, MC.todayISO());
      if (stale !== null && stale > 90) {
        score -= 5;
        const txt = 'Odometer tidak diperbarui ' + stale + ' hari';
        factors.push({ text: txt, tone: 'warn', delta: -5 });
        penalties.push({ label: txt, amount: 5, cap: null });
      }
    } else {
      score -= 5;
      factors.push({ text: 'Belum pernah mencatat odometer', tone: 'warn', delta: -5 });
      penalties.push({ label: 'Belum pernah mencatat odometer', amount: 5, cap: null });
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    let label = 'Bermasalah', tone = 'danger';
    if (score >= 80) { label = 'Sehat'; tone = 'ok'; }
    else if (score >= 60) { label = 'Perlu Perhatian'; tone = 'warn'; }
    else if (score >= 40) { label = 'Bermasalah'; tone = 'warn2'; }

    return {
      score, base, label, tone,
      checked: active.length,
      total: comps.length,
      segment,
      factors: factors.sort((a, b) => a.delta - b.delta),
      breakdown,
      penalties,
      // komponen yang sengaja TIDAK masuk penyebut: belum diperiksa, atau
      // tidak relevan dengan segmen motor ini
      excluded: breakdown.filter((b) => !b.counted).map((b) => b.label),
      weightedRaw: Math.round(weightedRaw * 100) / 100,
      km
    };
  }

  /* ---------- expenses ---------- */
  function expenseStats(expenses) {
    const list = (expenses || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const nowMonth = MC.monthKey(MC.todayISO());
    const nowYear = MC.todayISO().slice(0, 4);
    let monthTotal = 0, yearTotal = 0, allTotal = 0;
    const byCategory = {};
    const byMonth = {};

    list.forEach((e) => {
      const amt = +e.amount || 0;
      allTotal += amt;
      if (MC.monthKey(e.date) === nowMonth) monthTotal += amt;
      if ((e.date || '').slice(0, 4) === nowYear) yearTotal += amt;
      byCategory[e.category || 'lainnya'] = (byCategory[e.category || 'lainnya'] || 0) + amt;
      const mk = MC.monthKey(e.date);
      byMonth[mk] = (byMonth[mk] || 0) + amt;
    });

    const serviceSpend = list.filter((e) => e.category === 'servis' || e.category === 'suku-cadang' || e.category === 'perbaikan');
    const monthsSpan = (() => {
      const keys = Object.keys(byMonth).sort();
      if (keys.length < 2) return 1;
      const [y1, m1] = keys[0].split('-').map(Number);
      const [y2, m2] = keys[keys.length - 1].split('-').map(Number);
      return Math.max(1, (y2 - y1) * 12 + (m2 - m1) + 1);
    })();

    return {
      list, monthTotal, yearTotal, allTotal, byCategory, byMonth,
      avgService: serviceSpend.length ? Math.round(serviceSpend.reduce((a, b) => a + (+b.amount || 0), 0) / serviceSpend.length) : 0,
      avgMonthly: Math.round(allTotal / monthsSpan),
      monthsSpan
    };
  }

  /* ---------- odometer stats ---------- */
  function odoStats(bike, odoLog) {
    const logs = (odoLog || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const km = currentKm(bike, odoLog, []);
    const start = bike && Number.isFinite(+bike.startKm) ? +bike.startKm : (logs.length ? +logs[0].km : null);
    const byMonth = {};
    logs.forEach((l) => {
      const mk = MC.monthKey(l.date);
      if (!byMonth[mk] || +l.km > byMonth[mk]) byMonth[mk] = +l.km;
    });
    const months = Object.keys(byMonth).sort();
    const monthly = [];
    for (let i = 1; i < months.length; i++) {
      const delta = byMonth[months[i]] - byMonth[months[i - 1]];
      if (delta > 0) monthly.push({ month: months[i], km: delta });
    }
    const totalDist = (km !== null && start !== null) ? km - start : null;
    const avgMonthly = monthly.length ? Math.round(monthly.reduce((a, b) => a + b.km, 0) / monthly.length) : null;
    const days = (bike && bike.startDate) ? MC.daysBetween(bike.startDate, MC.todayISO()) : null;

    return {
      logs, km, start, totalDist, monthly, avgMonthly,
      days: (days !== null && days >= 0) ? days : null,
      // umur pakai 0 hari lebih sering berarti tanggal mulai belum diisi benar,
      // bukan motor baru — jangan tampilkan "0 bulan" seolah fakta
      daysImplausible: days === 0
    };
  }

  /* ---------- timeline ---------- */
  function timeline(ctx) {
    const { bike, services, damages, odoLog, expenses, checks } = ctx;
    const ev = [];
    if (bike && bike.startDate) {
      ev.push({ date: bike.startDate, kind: 'beli', title: 'Motor mulai digunakan', detail: (bike.brand || '') + ' ' + (bike.model || ''), km: bike.startKm });
    }
    (services || []).forEach((s) => {
      const t = (s.types || [s.type]).map((x) => (MC.SERVICE_TYPES.find((v) => v.id === x) || {}).label || x);
      ev.push({ date: s.date, kind: 'servis', title: t.join(' + '), detail: s.shop || '', km: s.km, cost: s.cost, id: s.id });
    });
    (damages || []).forEach((d) => {
      ev.push({ date: d.date, kind: 'rusak', title: 'Kerusakan: ' + d.name, detail: (d.part || '') + (d.symptoms ? ' · ' + d.symptoms : ''), km: d.km, cost: d.estCost, id: d.id });
    });
    (odoLog || []).forEach((o) => {
      ev.push({ date: o.date, kind: 'odo', title: 'Odometer ' + MC.fmtKm(o.km), detail: o.note || '', km: o.km, id: o.id });
    });
    (checks || []).forEach((c) => {
      const comp = (MC.COMPONENTS.find((x) => x.id === c.component) || {}).label || c.component;
      const st = (MC.CHECK_STATUS.find((x) => x.id === c.status) || {}).label || c.status;
      ev.push({ date: c.date, kind: 'cek', title: 'Pemeriksaan ' + comp, detail: st + (c.note ? ' · ' + c.note : ''), km: c.km, id: c.id });
    });
    return ev.filter((e) => e.date).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  global.MCD = { currentKm, lastOdoUpdate, componentAge, buildReminders, healthScore, expenseStats, odoStats, timeline };
})(window);
