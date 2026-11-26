/* MOTORCARE — semua form input (sheet) */
(function (global) {
  'use strict';
  const MC = global.MC, CU = global.MCU, I = global.MCI, MCS = global.MCS, MCD = global.MCD;

  function bikeId() { return MCS.activeBike() ? MCS.activeBike().id : null; }
  function currentKm() {
    const b = MCS.activeBike();
    if (!b) return null;
    const ctx = MCS.ctxFor(b);
    return MCD.currentKm(b, ctx.odoLog, ctx.services);
  }

  async function after(type) {
    await MCS.loadAll();
    if (global.MCApp && global.MCApp.refresh) global.MCApp.refresh();
  }

  /* ================= SERVIS ================= */
  function serviceForm(existing) {
    const isEdit = !!existing;
    const s0 = existing || {};
    const selected = new Set(s0.types || (s0.type ? [s0.type] : []));
    let photos = (s0.photos || []).slice();

    const body =
      '<div class="field"><label>Jenis perawatan (bisa lebih dari satu)</label>' +
        '<div class="check-grid" data-types>' +
          MC.SERVICE_TYPES.map((t) =>
            '<label class="checkbox"><input type="checkbox" value="' + t.id + '"' + (selected.has(t.id) ? ' checked' : '') + '>' +
            '<span class="box">' + I.icon('check', 11) + '</span><span>' + CU.esc(t.label) + '</span></label>'
          ).join('') +
        '</div></div>' +
      '<div class="grid2">' +
        CU.field('Tanggal', CU.input('date', s0.date || MC.todayISO(), { type: 'date', required: true })) +
        CU.field('Kilometer', CU.input('km', s0.km !== undefined ? s0.km : currentKm(), { type: 'number', min: 0, inputmode: 'numeric', placeholder: '12000' })) +
      '</div>' +
      CU.field('Nama bengkel', CU.input('shop', s0.shop, { placeholder: 'AHASS, bengkel langganan, dsb.' })) +
      CU.field('Biaya (Rp)', CU.input('cost', s0.cost, { type: 'number', min: 0, inputmode: 'numeric', placeholder: '85000' })) +
      '<div class="field"><label>Komponen / part yang diganti</label>' +
        '<div data-parts style="display:flex;flex-direction:column;gap:8px"></div>' +
        '<button type="button" class="btn sm ghost block" data-addpart style="margin-top:8px">' + I.icon('plus') + 'Tambah komponen</button>' +
      '</div>' +
      CU.field('Catatan', CU.textarea('note', s0.note, { placeholder: 'Oli Yamalube Matic, busi NGK, dsb.' })) +
      '<div class="field"><label>Foto nota / bukti</label>' +
        '<div data-nota></div><div class="hint">Opsional. Simpan foto nota supaya tidak hilang.</div></div>';

    let partsArr = (s0.parts || []).slice();
    let notaSlots = [{ key: 'nota', label: 'NOTA', dataUrl: (s0.photos || [])[0] || null }];

    const s = CU.sheet({
      title: isEdit ? 'Edit Servis' : 'Catat Servis',
      body: '<form id="svcForm" autocomplete="off">' + body + '</form>',
      footer: isEdit
        ? '<button class="btn danger" data-del>' + I.icon('trash') + '</button><button class="btn primary" data-save>' + I.icon('check') + 'Simpan</button>'
        : '<button class="btn ghost" data-close>Batal</button><button class="btn primary" data-save>' + I.icon('check') + 'Simpan</button>',
      onMount(root) {
        const partsBox = root.querySelector('[data-parts]');
        function renderParts() {
          if (!partsArr.length) {
            partsBox.innerHTML = '<div style="font-size:12px;color:var(--text-3)">Belum ada komponen.</div>';
            return;
          }
          partsBox.innerHTML = partsArr.map((p, i) =>
            '<div style="display:flex;gap:7px;align-items:center">' +
              '<input class="inp" data-pname="' + i + '" value="' + CU.esc(p.name || '') + '" placeholder="Nama komponen">' +
              '<input class="inp" data-pcost="' + i + '" type="number" inputmode="numeric" value="' + (p.cost || '') + '" placeholder="Rp" style="max-width:105px">' +
              '<button type="button" class="iconbtn" data-pdel="' + i + '" aria-label="Hapus">' + I.icon('x', 16) + '</button>' +
            '</div>'
          ).join('');
          partsBox.querySelectorAll('[data-pname]').forEach((inp) => {
            inp.oninput = () => { partsArr[+inp.dataset.pname].name = inp.value; };
          });
          partsBox.querySelectorAll('[data-pcost]').forEach((inp) => {
            inp.oninput = () => { partsArr[+inp.dataset.pcost].cost = inp.value ? +inp.value : null; };
          });
          partsBox.querySelectorAll('[data-pdel]').forEach((btn) => {
            btn.onclick = () => { partsArr.splice(+btn.dataset.pdel, 1); renderParts(); };
          });
        }
        renderParts();
        root.querySelector('[data-addpart]').onclick = () => {
          partsArr.push({ name: '', cost: null });
          renderParts();
          const last = partsBox.querySelector('[data-pname="' + (partsArr.length - 1) + '"]');
          if (last) last.focus();
        };

        const notaBox = root.querySelector('[data-nota]');
        function renderNota() {
          notaBox.innerHTML = CU.photoPicker(notaSlots, { max: 1 });
          CU.wirePhotoPicker(notaBox, notaSlots, renderNota);
        }
        renderNota();

        root.querySelector('[data-save]').onclick = async () => {
          const f = root.querySelector('#svcForm');
          if (!f.reportValidity()) return;
          const v = CU.formValues(f);
          const types = Array.from(root.querySelectorAll('[data-types] input:checked')).map((x) => x.value);
          if (!types.length) { CU.toast('Pilih minimal satu jenis perawatan', 'err'); return; }
          if (!bikeId()) { CU.toast('Belum ada motor aktif', 'err'); return; }

          const obj = isEdit ? Object.assign({}, existing) : { id: MC.uid() };
          obj.bikeId = bikeId();
          obj.types = types;
          obj.type = types[0];
          obj.date = v.date;
          obj.km = v.km !== '' ? +v.km : null;
          obj.shop = String(v.shop || '').trim();
          obj.cost = v.cost !== '' ? +v.cost : 0;
          obj.parts = partsArr.filter((p) => p.name || p.cost);
          obj.note = String(v.note || '').trim();
          obj.photos = notaSlots.map((x) => x.dataUrl).filter(Boolean);

          try {
            await CU.withBusy(root.querySelector('[data-save]'), async () => {
              await MC.Store.put('services', obj);
              // kalau ada KM dan lebih besar, update odometer motor
              if (obj.km !== null) await bumpKm(obj.km, obj.date, 'Servis');
              // kalau biaya > 0, catat juga ke pengeluaran? -> tidak otomatis, agar tidak dobel hitung
              await after();
            }, 'Menyimpan servis');
            s.close();
            CU.toast(isEdit ? 'Servis diperbarui' : 'Servis dicatat', 'ok');
          } catch (e) { CU.toast('Gagal: ' + e.message, 'err'); }
        };

        const delBtn = root.querySelector('[data-del]');
        if (delBtn) delBtn.onclick = async () => {
          const ok = await CU.confirmDialog({ title: 'Hapus catatan servis?', message: 'Catatan ini akan dihapus permanen dari HP ini.', danger: true, yes: 'Hapus' });
          if (!ok) return;
          await MC.Store.del('services', existing.id);
          s.close();
          CU.toast('Servis dihapus', 'ok');
          await after();
        };
      }
    });
    return s;
  }

  async function bumpKm(km, date, note) {
    const b = MCS.activeBike();
    if (!b) return;
    const ctx = MCS.ctxFor(b);
    const cur = MCD.currentKm(b, ctx.odoLog, ctx.services);
    if (cur !== null && km <= cur) return;
    b.currentKm = km;
    b.currentKmDate = date || MC.todayISO();
    await MC.Store.put('bikes', b);
    await MC.Store.put('odoLog', {
      id: MC.uid(), bikeId: b.id, date: date || MC.todayISO(), km, note: note || ''
    });
  }

  /* ================= KERUSAKAN ================= */
  function damageForm(existing) {
    const isEdit = !!existing;
    const d0 = existing || {};
    let photos = (d0.photos || []).slice();
    let slots = [
      { key: 'f1', label: 'FOTO 1', dataUrl: photos[0] || null },
      { key: 'f2', label: 'FOTO 2', dataUrl: photos[1] || null }
    ];

    const body =
      CU.field('Nama kerusakan', CU.input('name', d0.name, { placeholder: 'Contoh: CVT berisik saat akselerasi', required: true })) +
      CU.field('Bagian motor', CU.input('part', d0.part, { placeholder: 'CVT, rem depan, kelistrikan…' })) +
      CU.field('Gejala yang dirasakan', CU.textarea('symptoms', d0.symptoms, { placeholder: 'Bunyi kasar saat gas dibuka, getaran di setang…' })) +
      '<div class="grid2">' +
        CU.field('Tanggal ditemukan', CU.input('date', d0.date || MC.todayISO(), { type: 'date' })) +
        CU.field('Kilometer', CU.input('km', d0.km !== undefined ? d0.km : currentKm(), { type: 'number', min: 0, inputmode: 'numeric' })) +
      '</div>' +
      '<div class="grid2">' +
        '<div class="field"><label>Prioritas</label>' + CU.select('priority', MC.PRIORITIES, d0.priority || 'sedang') + '</div>' +
        '<div class="field"><label>Status</label>' + CU.select('status', MC.DAMAGE_STATUS, d0.status || 'belum') + '</div>' +
      '</div>' +
      CU.field('Estimasi biaya perbaikan (Rp)', CU.input('estCost', d0.estCost, { type: 'number', min: 0, inputmode: 'numeric' })) +
      '<div class="field"><label>Foto kerusakan</label><div data-dmgphoto></div></div>' +
      CU.field('Catatan', CU.textarea('note', d0.note, { placeholder: 'Hasil pemeriksaan bengkel, saran mekanik…' }));

    const s = CU.sheet({
      title: isEdit ? 'Edit Kerusakan' : 'Catat Kerusakan',
      body: '<form id="dmgForm" autocomplete="off">' + body + '</form>',
      footer: isEdit
        ? '<button class="btn danger" data-del>' + I.icon('trash') + '</button><button class="btn primary" data-save>' + I.icon('check') + 'Simpan</button>'
        : '<button class="btn ghost" data-close>Batal</button><button class="btn primary" data-save>' + I.icon('check') + 'Simpan</button>',
      onMount(root) {
        const pbox = root.querySelector('[data-dmgphoto]');
        function renderP() {
          pbox.innerHTML = CU.photoPicker(slots, { max: 2 });
          CU.wirePhotoPicker(pbox, slots, renderP);
        }
        renderP();

        root.querySelector('[data-save]').onclick = async () => {
          const f = root.querySelector('#dmgForm');
          if (!f.reportValidity()) return;
          const v = CU.formValues(f);
          if (!String(v.name || '').trim()) { CU.toast('Nama kerusakan wajib diisi', 'err'); return; }

          const obj = isEdit ? Object.assign({}, existing) : { id: MC.uid() };
          obj.bikeId = bikeId();
          obj.name = String(v.name).trim();
          obj.part = String(v.part || '').trim();
          obj.symptoms = String(v.symptoms || '').trim();
          obj.date = v.date;
          obj.km = v.km !== '' ? +v.km : null;
          obj.priority = v.priority;
          obj.status = v.status;
          obj.estCost = v.estCost !== '' ? +v.estCost : null;
          obj.note = String(v.note || '').trim();
          obj.photos = slots.map((x) => x.dataUrl).filter(Boolean);

          try {
            await CU.withBusy(root.querySelector('[data-save]'), async () => {
              await MC.Store.put('damages', obj);
              if (obj.km !== null) await bumpKm(obj.km, obj.date, 'Kerusakan');
              await after();
            }, 'Menyimpan kerusakan');
            s.close();
            CU.toast(isEdit ? 'Kerusakan diperbarui' : 'Kerusakan dicatat', 'ok');
          } catch (e) { CU.toast('Gagal: ' + e.message, 'err'); }
        };

        const delBtn = root.querySelector('[data-del]');
        if (delBtn) delBtn.onclick = async () => {
          const ok = await CU.confirmDialog({ title: 'Hapus catatan kerusakan?', message: 'Riwayat kerusakan ini akan hilang dari HP.', danger: true, yes: 'Hapus' });
          if (!ok) return;
          await MC.Store.del('damages', existing.id);
          s.close();
          CU.toast('Kerusakan dihapus', 'ok');
          await after();
        };
      }
    });
    return s;
  }

  /* ================= PENGELUARAN ================= */
  function expenseForm(existing) {
    const isEdit = !!existing;
    const e0 = existing || {};
    const body =
      '<div class="field"><label>Kategori</label>' + CU.select('category', MC.EXPENSE_CATEGORIES, e0.category || 'servis') + '</div>' +
      '<div class="grid2">' +
        CU.field('Tanggal', CU.input('date', e0.date || MC.todayISO(), { type: 'date', required: true })) +
        CU.field('Jumlah (Rp)', CU.input('amount', e0.amount, { type: 'number', min: 0, inputmode: 'numeric', placeholder: '50000', required: true })) +
      '</div>' +
      CU.field('Keterangan', CU.input('note', e0.note, { placeholder: 'Bensin Pertamax 3 liter, ganti ban belakang…' })) +
      CU.field('Kilometer (opsional)', CU.input('km', e0.km !== undefined ? e0.km : currentKm(), { type: 'number', min: 0, inputmode: 'numeric' }));

    const s = CU.sheet({
      title: isEdit ? 'Edit Pengeluaran' : 'Catat Pengeluaran',
      body: '<form id="expForm" autocomplete="off">' + body + '</form>',
      footer: isEdit
        ? '<button class="btn danger" data-del>' + I.icon('trash') + '</button><button class="btn primary" data-save>' + I.icon('check') + 'Simpan</button>'
        : '<button class="btn ghost" data-close>Batal</button><button class="btn primary" data-save>' + I.icon('check') + 'Simpan</button>',
      onMount(root) {
        root.querySelector('[data-save]').onclick = async () => {
          const f = root.querySelector('#expForm');
          if (!f.reportValidity()) return;
          const v = CU.formValues(f);
          if (!v.amount || +v.amount <= 0) { CU.toast('Jumlah harus lebih dari 0', 'err'); return; }
          const obj = isEdit ? Object.assign({}, existing) : { id: MC.uid() };
          obj.bikeId = bikeId();
          obj.category = v.category;
          obj.date = v.date;
          obj.amount = +v.amount;
          obj.note = String(v.note || '').trim();
          obj.km = v.km !== '' ? +v.km : null;
          try {
            await CU.withBusy(root.querySelector('[data-save]'), async () => {
              await MC.Store.put('expenses', obj);
              await after();
            }, 'Menyimpan pengeluaran');
            s.close();
            CU.toast(isEdit ? 'Pengeluaran diperbarui' : 'Pengeluaran dicatat', 'ok');
          } catch (e) { CU.toast('Gagal: ' + e.message, 'err'); }
        };
        const delBtn = root.querySelector('[data-del]');
        if (delBtn) delBtn.onclick = async () => {
          const ok = await CU.confirmDialog({ title: 'Hapus pengeluaran?', message: 'Transaksi ini akan dihapus.', danger: true, yes: 'Hapus' });
          if (!ok) return;
          await MC.Store.del('expenses', existing.id);
          s.close();
          CU.toast('Pengeluaran dihapus', 'ok');
          await after();
        };
      }
    });
    return s;
  }

  /* ================= ODOMETER ================= */
  function odoForm(existing) {
    const isEdit = !!existing;
    const o0 = existing || {};
    const body =
      '<div class="grid2">' +
        CU.field('Tanggal', CU.input('date', o0.date || MC.todayISO(), { type: 'date', required: true })) +
        CU.field('Kilometer', CU.input('km', o0.km, { type: 'number', min: 0, inputmode: 'numeric', placeholder: '15000', required: true })) +
      '</div>' +
      CU.field('Catatan', CU.input('note', o0.note, { placeholder: 'Odometer akhir bulan, setelah touring…' }));

    const s = CU.sheet({
      title: isEdit ? 'Edit Odometer' : 'Catat Kilometer',
      body: '<form id="odoForm" autocomplete="off">' + body + '</form>' +
        '<div class="banner info" style="margin-top:12px">' + I.icon('info') +
        '<span>Catat KM tiap awal bulan membuat perkiraan jadwal servis jauh lebih akurat.</span></div>',
      footer: isEdit
        ? '<button class="btn danger" data-del>' + I.icon('trash') + '</button><button class="btn primary" data-save>' + I.icon('check') + 'Simpan</button>'
        : '<button class="btn ghost" data-close>Batal</button><button class="btn primary" data-save>' + I.icon('check') + 'Simpan</button>',
      onMount(root) {
        root.querySelector('[data-save]').onclick = async () => {
          const f = root.querySelector('#odoForm');
          if (!f.reportValidity()) return;
          const v = CU.formValues(f);
          const obj = isEdit ? Object.assign({}, existing) : { id: MC.uid() };
          obj.bikeId = bikeId();
          obj.date = v.date;
          obj.km = +v.km;
          obj.note = String(v.note || '').trim();
          try {
            await CU.withBusy(root.querySelector('[data-save]'), async () => {
              await MC.Store.put('odoLog', obj);
              const b = MCS.activeBike();
              const ctx = MCS.ctxFor(b);
              const cur = MCD.currentKm(b, ctx.odoLog, ctx.services);
              if (cur === null || obj.km > cur) {
                b.currentKm = obj.km;
                b.currentKmDate = obj.date;
                await MC.Store.put('bikes', b);
              }
              await after();
            }, 'Menyimpan kilometer');
            s.close();
            CU.toast('Kilometer dicatat', 'ok');
          } catch (e) { CU.toast('Gagal: ' + e.message, 'err'); }
        };
        const delBtn = root.querySelector('[data-del]');
        if (delBtn) delBtn.onclick = async () => {
          const ok = await CU.confirmDialog({ title: 'Hapus catatan kilometer?', message: 'Catatan ini akan dihapus.', danger: true, yes: 'Hapus' });
          if (!ok) return;
          await MC.Store.del('odoLog', existing.id);
          s.close();
          CU.toast('Dihapus', 'ok');
          await after();
        };
      }
    });
    return s;
  }

  /* ================= PENGINGAT ================= */
  function reminderForm(existing, presetKind) {
    const isEdit = !!existing;
    const r0 = existing || MC.REMINDER_TEMPLATES.find((t) => t.kind === presetKind) || {};
    const kinds = MC.REMINDER_TEMPLATES.map((t) => ({ id: t.kind, label: t.label }));
    const body =
      (isEdit
        ? CU.field('Jenis pengingat', CU.input('label', r0.label, { }) + '<input type="hidden" name="kind" value="' + CU.esc(r0.kind) + '">')
        : '<div class="field"><label>Jenis pengingat</label>' + CU.select('kind', kinds, r0.kind || 'oli-mesin') + '</div>') +
      '<div class="grid2">' +
        CU.field('Interval KM', CU.input('intervalKm', r0.intervalKm, { type: 'number', min: 0, inputmode: 'numeric', placeholder: '2000' }), 'Kosongkan kalau tidak berbasis KM') +
        CU.field('Interval hari', CU.input('intervalDays', r0.intervalDays, { type: 'number', min: 0, inputmode: 'numeric', placeholder: '120' })) +
      '</div>' +
      '<div class="grid2">' +
        CU.field('Terakhir ganti (KM)', CU.input('lastDoneKm', r0.lastDoneKm, { type: 'number', min: 0, inputmode: 'numeric' }), 'Kosongkan untuk ambil dari riwayat servis') +
        CU.field('Terakhir ganti (tanggal)', CU.input('lastDoneDate', r0.lastDoneDate, { type: 'date' })) +
      '</div>' +
      '<div class="grid2">' +
        CU.field('Ingatkan di sisa KM', CU.input('soonKm', r0.soonKm !== undefined ? r0.soonKm : 300, { type: 'number', min: 0, inputmode: 'numeric' })) +
        CU.field('Ingatkan di sisa hari', CU.input('soonDays', r0.soonDays !== undefined ? r0.soonDays : 21, { type: 'number', min: 0, inputmode: 'numeric' })) +
      '</div>' +
      '<label class="checkbox" style="margin-top:4px"><input type="checkbox" name="active" value="1"' + (r0.active !== false ? ' checked' : '') + '>' +
        '<span class="box">' + I.icon('check', 11) + '</span><span>Aktifkan pengingat ini</span></label>';

    const s = CU.sheet({
      title: isEdit ? 'Edit Pengingat' : 'Tambah Pengingat',
      body: '<form id="remForm" autocomplete="off">' + body + '</form>',
      footer: isEdit
        ? '<button class="btn danger" data-del>' + I.icon('trash') + '</button><button class="btn primary" data-save>' + I.icon('check') + 'Simpan</button>'
        : '<button class="btn ghost" data-close>Batal</button><button class="btn primary" data-save>' + I.icon('check') + 'Simpan</button>',
      onMount(root) {
        const sel = root.querySelector('[name="kind"]');
        if (sel && sel.tagName === 'SELECT') {
          sel.onchange = () => {
            const t = MC.REMINDER_TEMPLATES.find((x) => x.kind === sel.value);
            if (!t) return;
            const f = root.querySelector('#remForm');
            if (t.intervalKm !== null) f.querySelector('[name="intervalKm"]').value = t.intervalKm;
            if (t.intervalDays !== null) f.querySelector('[name="intervalDays"]').value = t.intervalDays;
          };
        }

        root.querySelector('[data-save]').onclick = async () => {
          const f = root.querySelector('#remForm');
          if (!f.reportValidity()) return;
          const v = CU.formValues(f);
          const kind = v.kind;
          const tpl = MC.REMINDER_TEMPLATES.find((x) => x.kind === kind);

          const obj = isEdit ? Object.assign({}, existing) : { id: MC.uid() };
          obj.bikeId = bikeId();
          obj.kind = kind;
          obj.label = String(v.label || (tpl ? tpl.label : kind)).trim();
          obj.intervalKm = v.intervalKm !== '' ? +v.intervalKm : null;
          obj.intervalDays = v.intervalDays !== '' ? +v.intervalDays : null;
          obj.lastDoneKm = v.lastDoneKm !== '' ? +v.lastDoneKm : null;
          obj.lastDoneDate = v.lastDoneDate || null;
          obj.soonKm = v.soonKm !== '' ? +v.soonKm : 300;
          obj.soonDays = v.soonDays !== '' ? +v.soonDays : 21;
          obj.serviceType = tpl ? tpl.serviceType : (existing ? existing.serviceType : null);
          obj.active = !!v.active;

          try {
            await CU.withBusy(root.querySelector('[data-save]'), async () => {
              await MC.Store.put('reminders', obj);
              await after();
            }, 'Menyimpan pengingat');
            s.close();
            CU.toast(isEdit ? 'Pengingat diperbarui' : 'Pengingat ditambahkan', 'ok');
          } catch (e) { CU.toast('Gagal: ' + e.message, 'err'); }
        };

        const delBtn = root.querySelector('[data-del]');
        if (delBtn) delBtn.onclick = async () => {
          const ok = await CU.confirmDialog({ title: 'Hapus pengingat?', message: 'Pengingat ini tidak akan muncul lagi.', danger: true, yes: 'Hapus' });
          if (!ok) return;
          await MC.Store.del('reminders', existing.id);
          s.close();
          CU.toast('Pengingat dihapus', 'ok');
          await after();
        };
      }
    });
    return s;
  }

  /* ================= PEMERIKSAAN KOMPONEN ================= */
  function checkForm(componentId) {
    // komponen yang ditawarkan mengikuti segmen motor aktif — motor manual tidak
    // ditanya soal CVT, motor CVT tidak ditanya soal rantai & gir
    const bike = MCS.activeBike();
    const comps = MC.componentsFor(MC.resolveSegment(bike));
    const allowed = comps.map((c) => c.id);
    const validId = componentId && allowed.indexOf(componentId) >= 0 ? componentId : null;

    const latest = {};
    MCS.ctxFor(bike).checks.forEach((c) => {
      const p = latest[c.component];
      if (!p || (c.date || '') >= (p.date || '')) latest[c.component] = c;
    });

    const body =
      (validId
        ? '<div class="banner accent" style="margin-bottom:14px">' + I.icon('gauge') +
          '<span>Memeriksa: <b>' + CU.esc((comps.find((c) => c.id === validId) || {}).label) + '</b></span></div>'
        : '<div class="field"><label>Komponen</label>' + CU.select('component', comps, validId || comps[0].id) + '</div>') +
      (validId ? '<input type="hidden" name="component" value="' + CU.esc(validId) + '">' : '') +
      '<div class="field"><label>Status</label>' +
        '<div style="display:flex;flex-direction:column;gap:7px" data-status>' +
          MC.CHECK_STATUS.map((st) =>
            '<label class="checkbox" style="justify-content:flex-start">' +
              '<input type="radio" name="status" value="' + st.id + '"' + (st.id === 'sehat' ? ' checked' : '') + '>' +
              '<span class="box">' + I.icon('check', 11) + '</span>' +
              '<span style="flex:1">' + CU.esc(st.label) + '</span>' +
              '<span class="badge ' + st.tone + '">' + st.score + '%</span>' +
            '</label>'
          ).join('') +
        '</div></div>' +
      '<div class="grid2">' +
        CU.field('Tanggal pemeriksaan', CU.input('date', MC.todayISO(), { type: 'date', required: true })) +
        CU.field('Kilometer', CU.input('km', currentKm(), { type: 'number', min: 0, inputmode: 'numeric' })) +
      '</div>' +
      CU.field('Catatan pemeriksaan', CU.textarea('note', '', { placeholder: 'Ketebalan kampas masih 3mm, oli masih bening, aki 12.4V…' }));

    const s = CU.sheet({
      title: 'Catat Pemeriksaan',
      body: '<form id="chkForm" autocomplete="off">' + body + '</form>',
      footer: '<button class="btn ghost" data-close>Batal</button><button class="btn primary" data-save>' + I.icon('check') + 'Simpan</button>',
      onMount(root) {
        const sel = root.querySelector('select[name="component"]');
        if (sel) {
          sel.onchange = () => {
            const c = latest[sel.value];
            if (c) {
              const radio = root.querySelector('input[name="status"][value="' + c.status + '"]');
              if (radio) radio.checked = true;
            }
          };
          sel.onchange();
        }
        root.querySelector('[data-save]').onclick = async () => {
          const f = root.querySelector('#chkForm');
          if (!f.reportValidity()) return;
          const v = CU.formValues(f);
          const st = root.querySelector('input[name="status"]:checked');
          if (!st) { CU.toast('Pilih status komponen', 'err'); return; }
          const obj = {
            id: MC.uid(),
            bikeId: bikeId(),
            component: v.component,
            status: st.value,
            date: v.date,
            km: v.km !== '' ? +v.km : null,
            note: String(v.note || '').trim()
          };
          try {
            await CU.withBusy(root.querySelector('[data-save]'), async () => {
              await MC.Store.put('checks', obj);
              await after();
            }, 'Menyimpan pemeriksaan');
            s.close();
            CU.toast('Pemeriksaan dicatat', 'ok');
          } catch (e) { CU.toast('Gagal: ' + e.message, 'err'); }
        };
      }
    });
    return s;
  }

  /* ================= DOKUMEN ================= */
  function docForm(existing) {
    const isEdit = !!existing;
    const d0 = existing || {};
    let slots = [{ key: 'd', label: 'FILE', dataUrl: d0.dataUrl || null, isFile: true }];

    const TYPES = [
      { id: 'STNK', label: 'STNK' },
      { id: 'BPKB', label: 'BPKB' },
      { id: 'Asuransi', label: 'Asuransi' },
      { id: 'Faktur', label: 'Faktur pembelian' },
      { id: 'Servis', label: 'Buku servis' },
      { id: 'Lainnya', label: 'Lainnya' }
    ];

    const body =
      '<div class="grid2">' +
        '<div class="field"><label>Jenis dokumen</label>' + CU.select('type', TYPES, d0.type || 'STNK') + '</div>' +
        CU.field('Tanggal berlaku', CU.input('date', d0.date, { type: 'date' })) +
      '</div>' +
      CU.field('Nama / keterangan', CU.input('name', d0.name, { placeholder: 'STNK Vario — berlaku s/d 2028' })) +
      '<div class="field"><label>Foto dokumen</label><div data-docphoto></div>' +
        '<div class="hint">Disimpan lokal di HP. Jangan bagikan file backup ke orang lain.</div></div>';

    const s = CU.sheet({
      title: isEdit ? 'Edit Dokumen' : 'Tambah Dokumen',
      body: '<form id="docForm" autocomplete="off">' + body + '</form>',
      footer: isEdit
        ? '<button class="btn danger" data-del>' + I.icon('trash') + '</button><button class="btn primary" data-save>' + I.icon('check') + 'Simpan</button>'
        : '<button class="btn ghost" data-close>Batal</button><button class="btn primary" data-save>' + I.icon('check') + 'Simpan</button>',
      onMount(root) {
        const box = root.querySelector('[data-docphoto]');
        function renderD() {
          box.innerHTML = CU.photoPicker(slots, { max: 1 });
          CU.wirePhotoPicker(box, slots, renderD);
        }
        renderD();

        root.querySelector('[data-save]').onclick = async () => {
          const f = root.querySelector('#docForm');
          if (!f.reportValidity()) return;
          const v = CU.formValues(f);
          const obj = isEdit ? Object.assign({}, existing) : { id: MC.uid() };
          obj.bikeId = bikeId();
          obj.type = v.type;
          obj.name = String(v.name || v.type).trim();
          obj.date = v.date || null;
          obj.dataUrl = slots[0].dataUrl || null;
          try {
            await CU.withBusy(root.querySelector('[data-save]'), async () => {
              await MC.Store.put('docs', obj);
              await after();
            }, 'Menyimpan dokumen');
            s.close();
            CU.toast('Dokumen disimpan', 'ok');
          } catch (e) { CU.toast('Gagal: ' + e.message, 'err'); }
        };

        const delBtn = root.querySelector('[data-del]');
        if (delBtn) delBtn.onclick = async () => {
          const ok = await CU.confirmDialog({ title: 'Hapus dokumen?', message: 'Dokumen ini akan dihapus dari HP.', danger: true, yes: 'Hapus' });
          if (!ok) return;
          await MC.Store.del('docs', existing.id);
          s.close();
          CU.toast('Dokumen dihapus', 'ok');
          await after();
        };
      }
    });
    return s;
  }

  global.MCForms = { serviceForm, damageForm, expenseForm, odoForm, reminderForm, checkForm, docForm, bumpKm };
})(window);
