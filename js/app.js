/* MOTORCARE — app shell, router, event delegation */
(function (global) {
  'use strict';
  const MC = global.MC, CU = global.MCU, I = global.MCI, MCS = global.MCS, MCD = global.MCD;
  const S = MCS.S;

  const ROUTES = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'garage', label: 'Garasi', icon: 'garage' },
    { id: 'care', label: 'Perawatan', icon: 'wrench' },
    { id: 'history', label: 'Riwayat', icon: 'history' },
    { id: 'profile', label: 'Profil', icon: 'user' }
  ];

  let current = 'home';

  function shell() {
    return '<div class="appbar">' +
      '<div class="brand">' + I.logo(20) + 'MOTOR<em>CARE</em></div>' +
      '<div class="spacer"></div>' +
      '<button class="iconbtn" data-act="open-ai" aria-label="Asisten AI" title="Tanya Mekanik AI">' + I.icon('sparkAI') + '</button>' +
      '<button class="iconbtn" data-act="quick-menu" aria-label="Catat cepat" title="Catat cepat">' + I.icon('plus') + '</button>' +
    '</div>' +
    '<main id="view"></main>' +
    '<nav class="navbar" role="tablist">' +
      ROUTES.map((r) =>
        '<button data-nav="' + r.id + '" role="tab" class="' + (r.id === current ? 'active' : '') + '" aria-label="' + r.label + '">' +
          I.icon(r.icon, 21) + '<span>' + r.label + '</span></button>'
      ).join('') +
    '</nav>';
  }

  function renderView(animate) {
    const view = document.getElementById('view');
    if (!view) return;
    const page = global.MCPages[current] || global.MCPages.home;
    const html = page.render();
    view.innerHTML = '<div class="page">' + html + '</div>';
    if (!animate) {
      const p = view.querySelector('.page');
      if (p) p.style.animation = 'none';
    }
    // update nav active
    document.querySelectorAll('[data-nav]').forEach((b) => {
      b.classList.toggle('active', b.dataset.nav === current);
    });
    // scroll top on route change (bukan saat refresh data)
    if (animate) window.scrollTo({ top: 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
  }

  function go(route) {
    if (!global.MCPages[route]) return;
    current = route;
    renderView(true);
  }

  function refresh() {
    renderView(false);
  }

  /* ---------- quick menu (FAB behavior) ---------- */
  function quickMenu() {
    if (CU.anySheetOpen()) return;   // jangan menumpuk sheet di atas sheet
    const bike = MCS.activeBike();
    if (!bike) {
      global.MCBikeForm.bikeForm(null, () => refresh());
      return;
    }
    const body =
      '<div style="display:flex;flex-direction:column;gap:8px">' +
        menuItem('wrench', 'Catat servis', 'Oli, CVT, kampas rem, busi…', 'q-service') +
        menuItem('gauge2', 'Catat kilometer', 'Update odometer', 'q-odo') +
        menuItem('rupiah', 'Catat pengeluaran', 'Bensin, pajak, modifikasi', 'q-expense') +
        menuItem('alert', 'Catat kerusakan', 'Gejala & perkiraan biaya', 'q-damage') +
        menuItem('gauge', 'Periksa komponen', 'Skor kesehatan motor', 'q-check') +
        menuItem('clock', 'Tambah pengingat', 'Jadwal servis berikutnya', 'q-reminder') +
      '</div>';
    const s = CU.sheet({ title: 'Catat cepat', body, onMount(root) {
      root.querySelectorAll('[data-q]').forEach((btn) => {
        btn.onclick = () => {
          const k = btn.dataset.q;
          s.close();
          setTimeout(() => {
            if (k === 'q-service') global.MCForms.serviceForm();
            else if (k === 'q-odo') global.MCForms.odoForm();
            else if (k === 'q-expense') global.MCForms.expenseForm();
            else if (k === 'q-damage') global.MCForms.damageForm();
            else if (k === 'q-check') global.MCForms.checkForm();
            else if (k === 'q-reminder') global.MCForms.reminderForm();
          }, 200);
        };
      });
    }});
    return s;
  }

  function menuItem(ic, title, sub, key) {
    return '<button class="row" data-q="' + key + '" style="padding:12px;border-radius:12px;border:1px solid var(--line-soft);background:var(--surface)">' +
      '<span class="ic" style="background:var(--surface-2)">' + I.icon(ic) + '</span>' +
      '<span class="body"><span class="t">' + CU.esc(title) + '</span><span class="s">' + CU.esc(sub) + '</span></span>' +
      '<span class="end">' + I.icon('right', 16) + '</span></button>';
  }

  /* ---------- event delegation ---------- */
  const ACTIONS = {
    'add-bike': () => global.MCBikeForm.bikeForm(null, () => { go('garage'); }),
    'edit-bike': (d) => {
      const b = S.bikes.find((x) => x.id === d.id) || MCS.activeBike();
      if (b) global.MCBikeForm.bikeForm(b, () => refresh());
    },
    'editbike': () => { const b = MCS.activeBike(); if (b) global.MCBikeForm.bikeForm(b, () => refresh()); },
    'del-bike': async (d) => {
      const b = S.bikes.find((x) => x.id === d.id);
      if (!b) return;
      const ok = await CU.confirmDialog({
        title: 'Hapus ' + b.nickname + '?',
        message: 'Semua servis, kerusakan, pengeluaran, dan riwayat untuk motor ini ikut terhapus.',
        detail: 'Ekspor backup dulu kalau data ini masih kamu butuhkan.', danger: true, yes: 'Hapus motor'
      });
      if (!ok) return;
      const stores = ['services', 'damages', 'expenses', 'odoLog', 'reminders', 'checks', 'docs'];
      for (const st of stores) {
        const rows = await MC.Store.byBike(st, b.id);
        for (const r of rows) await MC.Store.del(st, r.id);
      }
      await MC.Store.del('bikes', b.id);
      await MCS.loadAll();
      CU.toast('Motor dihapus', 'ok');
      refresh();
    },
    'select-bike': async (d) => {
      await MCS.setActiveBike(d.id);
      await MCS.loadAll();
      CU.toast('Motor aktif: ' + (MCS.activeBike() || {}).nickname, 'ok');
      refresh();
    },
    'add-service': () => global.MCForms.serviceForm(),
    'service': (d) => {
      const sv = S.services.find((x) => x.id === d.id);
      if (sv) detailService(sv);
    },
    'add-damage': () => global.MCForms.damageForm(),
    'damage': (d) => {
      const dm = S.damages.find((x) => x.id === d.id);
      if (dm) detailDamage(dm);
    },
    'add-expense': () => global.MCForms.expenseForm(),
    'expense': (d) => {
      const e = S.expenses.find((x) => x.id === d.id);
      if (e) global.MCForms.expenseForm(e);
    },
    'add-odo': () => global.MCForms.odoForm(),
    'odo': (d) => {
      const o = S.odoLog.find((x) => x.id === d.id);
      if (o) global.MCForms.odoForm(o);
    },
    'add-reminder': () => global.MCForms.reminderForm(),
    'edit-reminder': (d) => {
      const r = S.reminders.find((x) => x.id === d.id);
      if (r) global.MCForms.reminderForm(r);
    },
    'reminder': (d) => {
      const r = S.reminders.find((x) => x.id === d.id);
      if (r) global.MCForms.reminderForm(r);
    },
    'add-check': () => global.MCForms.checkForm(),
    'check-comp': (d) => global.MCForms.checkForm(d.comp),
    'add-doc': () => global.MCForms.docForm(),
    'view-doc': (d) => {
      const doc = (S.docs || []).find((x) => x.id === d.id);
      if (doc) detailDoc(doc);
    },
    'open-ai': () => global.MCAI.openAI(),
    'quick-menu': () => quickMenu(),
    'export-json': () => global.MCData.exportJson(),
    'import-json': () => global.MCData.importJson(),
    'export-report': () => global.MCData.exportReport(),
    'wipe': () => global.MCData.wipe(),
    'force-reload': () => global.MCData.forceReload(),
    'go-check': () => { global.MCPages.care.setTab('cek'); go('care'); },
    'go-history': () => { global.MCPages.history.setTab('rusak'); go('history'); },
    'theme-info': () => CU.toast('Tema gelap otomotif — dibuat untuk dibaca malam hari di garasi.'),
    'storage-info': () => CU.toast('Data disimpan di IndexedDB browser. Ukuran foto sudah dikompres otomatis.'),
    'back': () => CU.closeTopSheet()
  };

  document.addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-nav]');
    if (navBtn) { go(navBtn.dataset.nav); return; }

    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) {
      const t = tabBtn.dataset.tab;
      if (global.MCPages.care.getTab && ['servis', 'reminder', 'cek'].indexOf(t) >= 0) global.MCPages.care.setTab(t);
      if (global.MCPages.history.getTab && ['timeline', 'rusak', 'biaya', 'odo'].indexOf(t) >= 0) global.MCPages.history.setTab(t);
      refresh();
      return;
    }

    const actBtn = e.target.closest('[data-act]');
    if (actBtn) {
      const act = actBtn.dataset.act;
      const fn = ACTIONS[act];
      if (fn) {
        e.preventDefault();
        fn({ id: actBtn.dataset.id, comp: actBtn.dataset.comp });
      }
      return;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && CU.anySheetOpen()) {
      CU.closeTopSheet();
    }
  });

  /* ---------- detail: servis ---------- */
  function detailService(sv) {
    const types = (sv.types || [sv.type]).map((t) => (MC.SERVICE_TYPES.find((x) => x.id === t) || {}).label || t);
    let body = '<div class="rows">' +
      dRow('Tanggal', MC.fmtDate(sv.date)) +
      dRow('Kilometer', MC.fmtKm(sv.km)) +
      (sv.shop ? dRow('Bengkel', sv.shop) : '') +
      (sv.cost ? dRow('Biaya', MC.fmtRp(sv.cost)) : '') +
    '</div>';
    if ((sv.parts || []).length) {
      body += '<div class="sec-title">Komponen diganti</div><div class="rows">' +
        sv.parts.map((p) => '<div class="row"><span class="body"><span class="t" style="font-size:13px">' + CU.esc(p.name || '—') +
          '</span></span><span class="end">' + (p.cost ? MC.fmtRp(p.cost) : '') + '</span></div>').join('') + '</div>';
    }
    if (sv.note) body += '<div class="sec-title">Catatan</div><div class="banner info">' + I.icon('info') + '<span>' + CU.esc(sv.note) + '</span></div>';
    if ((sv.photos || []).length) {
      body += '<div class="sec-title">Nota</div><img src="' + sv.photos[0] + '" alt="Nota servis" style="width:100%;border-radius:12px">';
    }

    const s = CU.sheet({
      title: types.join(' + '),
      body,
      footer: '<button class="btn ghost" data-edit>' + I.icon('edit') + 'Edit</button>' +
        '<button class="btn danger" data-remove>' + I.icon('trash') + '</button>',
      onMount(root) {
        root.querySelector('[data-edit]').onclick = () => { s.close(); setTimeout(() => global.MCForms.serviceForm(sv), 200); };
        root.querySelector('[data-remove]').onclick = async () => {
          const ok = await CU.confirmDialog({ title: 'Hapus catatan servis?', message: 'Data akan hilang dari HP.', danger: true, yes: 'Hapus' });
          if (!ok) return;
          await MC.Store.del('services', sv.id);
          s.close();
          await MCS.loadAll();
          CU.toast('Servis dihapus', 'ok');
          refresh();
        };
      }
    });
  }

  /* ---------- detail: kerusakan ---------- */
  function detailDamage(dm) {
    const pr = MC.PRIORITIES.find((p) => p.id === dm.priority) || MC.PRIORITIES[1];
    const st = MC.DAMAGE_STATUS.find((x) => x.id === dm.status) || MC.DAMAGE_STATUS[0];
    let body = '<div style="display:flex;gap:6px;margin-bottom:12px">' + CU.badge(pr.label, pr.tone, true) + CU.badge(st.label, dm.status === 'selesai' ? 'ok' : 'unknown') + '</div>' +
      '<div class="rows">' +
        dRow('Bagian', dm.part || '—') +
        dRow('Ditemukan', MC.fmtDate(dm.date)) +
        (dm.km ? dRow('Kilometer', MC.fmtKm(dm.km)) : '') +
        (dm.estCost ? dRow('Estimasi biaya', MC.fmtRp(dm.estCost)) : '') +
      '</div>';
    if (dm.symptoms) body += '<div class="sec-title">Gejala</div><div class="banner info">' + I.icon('info') + '<span>' + CU.esc(dm.symptoms) + '</span></div>';
    if (dm.note) body += '<div class="sec-title">Catatan</div><p style="font-size:13px;color:var(--text-2);line-height:1.5;margin:0">' + CU.esc(dm.note) + '</p>';
    if ((dm.photos || []).length) {
      body += '<div class="sec-title">Foto</div><div style="display:flex;gap:8px;flex-wrap:wrap">' +
        dm.photos.map((p) => '<img src="' + p + '" alt="Foto kerusakan" style="width:calc(50% - 4px);border-radius:10px">').join('') + '</div>';
    }
    body += '<div class="sec-title">Ubah status</div><div class="seg" data-statusseg>' +
      MC.DAMAGE_STATUS.map((x) => '<button data-st="' + x.id + '" class="' + (x.id === dm.status ? 'on' : '') + '">' + x.label.split(' ')[0] + '</button>').join('') + '</div>';

    const s = CU.sheet({
      title: dm.name,
      body,
      footer: '<button class="btn ghost" data-edit>' + I.icon('edit') + 'Edit</button>' +
        '<button class="btn danger" data-remove>' + I.icon('trash') + '</button>',
      onMount(root) {
        root.querySelectorAll('[data-st]').forEach((b) => {
          b.onclick = async () => {
            dm.status = b.dataset.st;
            await MC.Store.put('damages', dm);
            await MCS.loadAll();
            CU.toast('Status: ' + (MC.DAMAGE_STATUS.find((x) => x.id === dm.status) || {}).label, 'ok');
            s.close();
            refresh();
          };
        });
        root.querySelector('[data-edit]').onclick = () => { s.close(); setTimeout(() => global.MCForms.damageForm(dm), 200); };
        root.querySelector('[data-remove]').onclick = async () => {
          const ok = await CU.confirmDialog({ title: 'Hapus kerusakan?', message: 'Riwayat ini akan hilang.', danger: true, yes: 'Hapus' });
          if (!ok) return;
          await MC.Store.del('damages', dm.id);
          s.close();
          await MCS.loadAll();
          CU.toast('Kerusakan dihapus', 'ok');
          refresh();
        };
      }
    });
  }

  /* ---------- detail: dokumen ---------- */
  function detailDoc(doc) {
    let body = '<div class="rows">' +
      dRow('Jenis', doc.type || '—') +
      (doc.date ? dRow('Berlaku', MC.fmtDate(doc.date)) : '') +
    '</div>';
    if (doc.dataUrl) {
      body += '<img src="' + doc.dataUrl + '" alt="' + CU.esc(doc.name) + '" style="width:100%;border-radius:12px;margin-top:12px">';
    } else {
      body += '<div class="banner info" style="margin-top:12px">' + I.icon('info') + '<span>Belum ada foto dokumen.</span></div>';
    }
    const s = CU.sheet({
      title: doc.name,
      body,
      footer: '<button class="btn ghost" data-edit>' + I.icon('edit') + 'Edit</button>' +
        '<button class="btn danger" data-remove>' + I.icon('trash') + '</button>',
      onMount(root) {
        root.querySelector('[data-edit]').onclick = () => { s.close(); setTimeout(() => global.MCForms.docForm(doc), 200); };
        root.querySelector('[data-remove]').onclick = async () => {
          const ok = await CU.confirmDialog({ title: 'Hapus dokumen?', message: 'Dokumen akan dihapus dari HP.', danger: true, yes: 'Hapus' });
          if (!ok) return;
          await MC.Store.del('docs', doc.id);
          s.close();
          await MCS.loadAll();
          CU.toast('Dokumen dihapus', 'ok');
          refresh();
        };
      }
    });
  }

  function dRow(k, v) {
    return '<div class="row" style="padding:9px 0"><span class="body"><span class="t" style="font-size:12.5px;color:var(--text-3);font-weight:400">' +
      CU.esc(k) + '</span></span><span class="end"><span class="v" style="font-size:13px">' + CU.esc(v) + '</span></span></div>';
  }

  /* ---------- boot ---------- */
  async function boot() {
    const app = document.getElementById('app');
    app.innerHTML = '<div style="display:grid;place-items:center;height:100vh;gap:14px">' +
      '<div style="color:var(--accent)">' + I.logo(40) + '</div>' +
      '<div style="font-family:BC,sans-serif;font-size:13px;letter-spacing:.2em;color:var(--text-3)">MOTORCARE</div>' +
    '</div>';

    try {
      await MCS.loadAll();
    } catch (e) {
      app.innerHTML = '<div style="padding:40px 24px;text-align:center">' +
        '<h2 style="color:var(--danger)">Database tidak bisa dibuka</h2>' +
        '<p style="color:var(--text-2);font-size:13px;margin-top:10px;line-height:1.6">' + CU.esc(e.message) + '</p>' +
        '<p style="color:var(--text-3);font-size:12px;margin-top:14px">Kalau ini mode privat / incognito, coba buka di tab normal.</p>' +
      '</div>';
      return;
    }

    app.innerHTML = shell();
    renderView(false);

    // register service worker — daftar langsung kalau halaman sudah selesai load,
    // karena listener 'load' tidak akan pernah terpanggil lagi setelah event itu lewat
    if ('serviceWorker' in navigator) {
      const registerSW = () => {
        navigator.serviceWorker.register('sw.js').then((reg) => {
          // paksa cek versi baru tiap kali app dibuka; tanpa ini SW bisa
          // menyajikan cache lama berhari-hari setelah deploy
          if (reg && reg.update) reg.update().catch(() => {});
        }).catch(() => { /* offline mode opsional */ });
      };
      if (document.readyState === 'complete') registerSW();
      else window.addEventListener('load', registerSW);
    }
  }

  global.MCApp = { boot, go, refresh, quickMenu, getRoute: () => current };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
