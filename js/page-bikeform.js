/* MOTORCARE — form motor (tambah/edit) */
(function (global) {
  'use strict';
  const MC = global.MC, CU = global.MCU, I = global.MCI, MCS = global.MCS;

  const BRANDS = ['Honda', 'Yamaha', 'Suzuki', 'Kawasaki', 'Vespa', 'Piaggio', 'TVS', 'Benelli', 'KTM', 'Royal Enfield', 'CFMoto', 'Viar', 'United', 'Lainnya'];

  function bikeForm(bike, onDone) {
    const isEdit = !!bike;
    const b = bike || { photos: [] };
    const slots = [
      { key: 'depan', label: 'DEPAN', dataUrl: (b.photos || {}).depan || null },
      { key: 'samping', label: 'SAMPING', dataUrl: (b.photos || {}).samping || null },
      { key: 'belakang', label: 'BELAKANG', dataUrl: (b.photos || {}).belakang || null }
    ];

    const body =
      '<div class="field"><label>Foto motor</label>' + CU.photoPicker(slots, { max: 3 }) +
        '<div class="hint">Foto dikompres otomatis, disimpan hanya di HP ini.</div></div>' +

      CU.field('Nama panggilan', CU.input('nickname', b.nickname, { placeholder: 'Contoh: Vario Harian', required: true, maxlength: 40 })) +

      '<div class="grid2">' +
        '<div class="field"><label>Merek</label>' + CU.select('brand', BRANDS.map((x) => ({ id: x, label: x })), b.brand || 'Honda') + '</div>' +
        '<div class="field"><label>Tipe / model</label>' + CU.input('model', b.model, { placeholder: 'Vario 125', required: true }) + '</div>' +
      '</div>' +

      '<div class="grid2">' +
        CU.field('Tahun pembelian', CU.input('year', b.year, { type: 'number', min: 1970, max: 2100, placeholder: '2021', inputmode: 'numeric' })) +
        CU.field('Kapasitas mesin', CU.input('cc', b.cc, { type: 'number', min: 1, max: 2000, placeholder: '125', inputmode: 'numeric' })) +
      '</div>' +

      '<div class="grid2">' +
        CU.field('Nomor plat', CU.input('plate', b.plate, { placeholder: 'B 1234 XYZ' })) +
        CU.field('Warna', CU.input('color', b.color, { placeholder: 'Hitam' })) +
      '</div>' +

      '<div class="grid2">' +
        CU.field('Tanggal mulai dipakai', CU.input('startDate', b.startDate || MC.todayISO(), { type: 'date' }), 'Tanggal motor mulai kamu pakai') +
        CU.field('KM saat mulai', CU.input('startKm', b.startKm === undefined ? '' : b.startKm, { type: 'number', min: 0, placeholder: '0', inputmode: 'numeric' }), 'Untuk motor bekas: isi KM saat kamu beli') +
      '</div>' +

      '<div class="grid2">' +
        CU.field('Nomor rangka (opsional)', CU.input('vin', b.vin, { placeholder: 'MH1...' })) +
        CU.field('Nomor mesin (opsional)', CU.input('engineNo', b.engineNo, { placeholder: 'JM21E...' })) +
      '</div>' +

      '<div class="grid2">' +
        CU.field('KM saat ini', CU.input('currentKm', b.currentKm === undefined ? '' : b.currentKm, { type: 'number', min: 0, inputmode: 'numeric' }), 'Dipakai untuk hitung jadwal servis') +
        CU.field('Tipe transmisi', CU.select('transmission', [{ id: 'matik', label: 'Matic / CVT' }, { id: 'manual', label: 'Manual' }, { id: 'semi', label: 'Semi otomatis' }], b.transmission || 'matik')) +
      '</div>' +

      CU.field('Catatan (opsional)', CU.textarea('note', b.note, { placeholder: 'Kondisi awal, hasil inspeksi, dsb.' }));

    const s = CU.sheet({
      title: isEdit ? 'Edit Motor' : 'Tambah Motor',
      body: '<form id="bikeForm" autocomplete="off">' + body + '</form>',
      footer: '<button class="btn ghost" data-close>Batal</button><button class="btn primary" data-save>' +
        I.icon('check') + (isEdit ? 'Simpan' : 'Tambah') + '</button>',
      onMount(root) {
        const rerenderPicker = () => {
          const picker = root.querySelector('[data-picker]');
          const tmp = document.createElement('div');
          tmp.innerHTML = CU.photoPicker(slots, { max: 3 });
          const newPicker = tmp.querySelector('[data-picker]');
          picker.replaceWith(newPicker);
          CU.wirePhotoPicker(root, slots, rerenderPicker);
        };
        CU.wirePhotoPicker(root, slots, rerenderPicker);

        root.querySelector('[data-save]').onclick = async () => {
          const f = root.querySelector('#bikeForm');
          if (!f.reportValidity()) return;
          const v = CU.formValues(f);
          if (!String(v.nickname || '').trim()) { CU.toast('Nama panggilan wajib diisi', 'err'); return; }
          if (!String(v.model || '').trim()) { CU.toast('Tipe motor wajib diisi', 'err'); return; }

          const obj = isEdit ? Object.assign({}, b) : { id: MC.uid(), createdAt: new Date().toISOString() };
          obj.nickname = String(v.nickname).trim();
          obj.brand = v.brand;
          obj.model = String(v.model).trim();
          obj.year = v.year ? +v.year : null;
          obj.cc = v.cc ? +v.cc : null;
          obj.plate = String(v.plate || '').trim().toUpperCase();
          obj.color = String(v.color || '').trim();
          obj.startDate = v.startDate || null;
          obj.startKm = v.startKm !== '' ? +v.startKm : null;
          obj.vin = String(v.vin || '').trim();
          obj.engineNo = String(v.engineNo || '').trim();
          obj.currentKm = v.currentKm !== '' ? +v.currentKm : null;
          obj.currentKmDate = v.currentKm !== '' ? MC.todayISO() : (obj.currentKmDate || null);
          obj.transmission = v.transmission;
          obj.note = String(v.note || '').trim();
          obj.photos = {};
          slots.forEach((sl) => { if (sl.dataUrl) obj.photos[sl.key] = sl.dataUrl; });

          try {
            await MC.Store.put('bikes', obj);

            if (!isEdit) {
              // buat set reminder default
              const rems = MCS.defaultReminders(obj.id);
              await Promise.all(rems.map((r) => MC.Store.put('reminders', r)));
              // odometer awal
              if (obj.currentKm !== null) {
                await MC.Store.put('odoLog', {
                  id: MC.uid(), bikeId: obj.id, date: MC.todayISO(),
                  km: obj.currentKm, note: 'Odometer awal'
                });
              }
              await MCS.setActiveBike(obj.id);
            }

            await MCS.loadAll();
            s.close();
            CU.toast(isEdit ? 'Motor diperbarui' : 'Motor ditambahkan', 'ok');
            if (onDone) onDone(obj);
          } catch (e) {
            CU.toast('Gagal menyimpan: ' + e.message, 'err');
          }
        };
      }
    });
    return s;
  }

  global.MCBikeForm = { bikeForm, BRANDS };
})(window);
