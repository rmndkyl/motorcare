/* MOTORCARE — core data layer
 * Storage: IndexedDB (foto bisa MB, localStorage 5MB tidak cukup)
 * No backend. Semua data milik user, tersimpan di perangkat.
 */
(function (global) {
  'use strict';

  const DB_NAME = 'motorcare';
  const DB_VERSION = 1;
  const STORES = ['bikes', 'services', 'damages', 'expenses', 'odoLog', 'reminders', 'checks', 'docs', 'meta'];

  let _db = null;

  function openDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        STORES.forEach((name) => {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: 'id' });
            if (name !== 'meta') {
              store.createIndex('bikeId', 'bikeId', { unique: false });
            }
          }
        });
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Database diblokir tab lain. Tutup tab MOTORCARE lain lalu muat ulang.'));
    });
  }

  function tx(storeName, mode) {
    return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
  }

  function req2promise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  const Store = {
    async all(storeName) {
      const store = await tx(storeName, 'readonly');
      return req2promise(store.getAll());
    },
    async get(storeName, id) {
      const store = await tx(storeName, 'readonly');
      return req2promise(store.get(id));
    },
    async put(storeName, obj) {
      if (!obj.id) obj.id = uid();
      obj.updatedAt = new Date().toISOString();
      if (!obj.createdAt) obj.createdAt = obj.updatedAt;
      const store = await tx(storeName, 'readwrite');
      await req2promise(store.put(obj));
      return obj;
    },
    async del(storeName, id) {
      const store = await tx(storeName, 'readwrite');
      return req2promise(store.delete(id));
    },
    async byBike(storeName, bikeId) {
      const store = await tx(storeName, 'readonly');
      const idx = store.index('bikeId');
      return req2promise(idx.getAll(bikeId));
    },
    async clearAll() {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const t = db.transaction(STORES, 'readwrite');
        STORES.forEach((n) => t.objectStore(n).clear());
        t.oncomplete = () => resolve(true);
        t.onerror = () => reject(t.error);
      });
    }
  };

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  /* ---------- date & number helpers ---------- */
  const DAY = 86400000;

  function todayISO() {
    // local date, bukan UTC — user di WIB bisa "kemarin" kalau pakai toISOString
    const d = new Date();
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d - off).toISOString().slice(0, 10);
  }

  function parseISO(s) {
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    if (!y) return null;
    return new Date(y, (m || 1) - 1, d || 1);
  }

  function daysBetween(aISO, bISO) {
    const a = parseISO(aISO), b = parseISO(bISO);
    if (!a || !b) return null;
    return Math.round((b - a) / DAY);
  }

  function addDays(iso, n) {
    const d = parseISO(iso);
    if (!d) return null;
    d.setDate(d.getDate() + n);
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d - off).toISOString().slice(0, 10);
  }

  function fmtDate(iso, opts) {
    const d = parseISO(iso);
    if (!d) return '—';
    return d.toLocaleDateString('id-ID', opts || { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtNum(n) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '—';
    return Number(n).toLocaleString('id-ID');
  }

  function fmtRp(n) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '—';
    return 'Rp ' + Number(n).toLocaleString('id-ID');
  }

  function fmtKm(n) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '—';
    return fmtNum(n) + ' km';
  }

  function monthKey(iso) { return (iso || '').slice(0, 7); }

  function monthLabel(key) {
    if (!key) return '—';
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
  }

  /* ---------- FILE helpers (foto & dokumen) ---------- */
  // Kompres foto sebelum disimpan: 1280px sisi terpanjang, JPEG 0.72
  function compressImage(file, maxSide = 1280, quality = 0.72) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          const scale = Math.min(1, maxSide / Math.max(width, height));
          width = Math.round(width * scale);
          height = Math.round(height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          resolve({
            dataUrl: canvas.toDataURL('image/jpeg', quality),
            width, height,
            name: file.name || 'foto.jpg',
            size: Math.round(canvas.toDataURL('image/jpeg', quality).length * 0.75)
          });
        };
        img.onerror = () => reject(new Error('File bukan gambar yang bisa dibaca.'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve({ dataUrl: r.result, name: file.name, size: file.size, type: file.type });
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  /* ---------- domain vocabulary ---------- */
  const SERVICE_TYPES = [
    { id: 'oli-mesin', label: 'Ganti oli mesin', icon: 'oil' },
    { id: 'oli-gardan', label: 'Ganti oli gardan', icon: 'oil' },
    { id: 'servis-cvt', label: 'Servis CVT', icon: 'cvt' },
    { id: 'servis-mesin', label: 'Servis mesin', icon: 'engine' },
    { id: 'filter-udara', label: 'Bersih/ganti filter udara', icon: 'filter' },
    { id: 'busi', label: 'Ganti busi', icon: 'spark' },
    { id: 'kampas-rem', label: 'Ganti kampas rem', icon: 'brake' },
    { id: 'ban', label: 'Ganti ban', icon: 'tire' },
    { id: 'aki', label: 'Ganti aki', icon: 'battery' },
    { id: 'kelistrikan', label: 'Servis kelistrikan', icon: 'bolt' },
    { id: 'rantai-gear', label: 'Perawatan rantai & gear', icon: 'chain' },
    { id: 'lainnya', label: 'Perawatan lainnya', icon: 'wrench' }
  ];

  const COMPONENTS = [
    { id: 'mesin', label: 'Mesin', weight: 3 },
    { id: 'oli', label: 'Oli', weight: 3 },
    { id: 'rem-depan', label: 'Rem depan', weight: 3 },
    { id: 'rem-belakang', label: 'Rem belakang', weight: 2 },
    { id: 'ban', label: 'Ban', weight: 3 },
    { id: 'suspensi', label: 'Suspensi', weight: 1 },
    { id: 'aki', label: 'Aki', weight: 2 },
    { id: 'kelistrikan', label: 'Kelistrikan', weight: 2 },
    { id: 'lampu', label: 'Lampu', weight: 1 },
    { id: 'pendingin', label: 'Sistem pendingin', weight: 2 },
    { id: 'rantai-gear', label: 'Rantai & gear', weight: 2 },
    { id: 'cvt', label: 'CVT', weight: 2 },
    { id: 'bahan-bakar', label: 'Sistem bahan bakar', weight: 2 }
  ];

  const CHECK_STATUS = [
    { id: 'sehat', label: 'Sehat', score: 100, tone: 'ok' },
    { id: 'perlu-diperiksa', label: 'Perlu diperiksa', score: 70, tone: 'warn' },
    { id: 'perlu-perawatan', label: 'Perlu perawatan', score: 40, tone: 'warn2' },
    { id: 'segera', label: 'Harus segera ditangani', score: 10, tone: 'danger' }
  ];

  const EXPENSE_CATEGORIES = [
    { id: 'servis', label: 'Servis' },
    { id: 'suku-cadang', label: 'Suku cadang' },
    { id: 'bahan-bakar', label: 'Bahan bakar' },
    { id: 'perbaikan', label: 'Perbaikan' },
    { id: 'modifikasi', label: 'Modifikasi' },
    { id: 'pajak', label: 'Pajak & STNK' },
    { id: 'lainnya', label: 'Lainnya' }
  ];

  const REMINDER_TEMPLATES = [
    { kind: 'oli-mesin', label: 'Ganti oli mesin', intervalKm: 2000, intervalDays: 120, serviceType: 'oli-mesin' },
    { kind: 'oli-gardan', label: 'Ganti oli gardan', intervalKm: 8000, intervalDays: 240, serviceType: 'oli-gardan' },
    { kind: 'servis-berkala', label: 'Servis berkala', intervalKm: 4000, intervalDays: 180, serviceType: 'servis-mesin' },
    { kind: 'cvt', label: 'Servis CVT', intervalKm: 8000, intervalDays: 240, serviceType: 'servis-cvt' },
    { kind: 'filter-udara', label: 'Filter udara', intervalKm: 8000, intervalDays: 240, serviceType: 'filter-udara' },
    { kind: 'busi', label: 'Busi', intervalKm: 8000, intervalDays: 365, serviceType: 'busi' },
    { kind: 'kampas-rem', label: 'Kampas rem', intervalKm: 10000, intervalDays: 365, serviceType: 'kampas-rem' },
    { kind: 'ban', label: 'Ban', intervalKm: 20000, intervalDays: 1095, serviceType: 'ban' },
    { kind: 'aki', label: 'Aki', intervalKm: 20000, intervalDays: 730, serviceType: 'aki' },
    { kind: 'rantai-gear', label: 'Rantai & gear', intervalKm: 20000, intervalDays: 730, serviceType: 'rantai-gear' },
    { kind: 'pajak', label: 'Pajak kendaraan', intervalKm: null, intervalDays: 365, serviceType: null },
    { kind: 'stnk', label: 'Perpanjangan STNK', intervalKm: null, intervalDays: 365, serviceType: null }
  ];

  const PRIORITIES = [
    { id: 'rendah', label: 'Rendah', tone: 'ok' },
    { id: 'sedang', label: 'Sedang', tone: 'warn' },
    { id: 'tinggi', label: 'Tinggi', tone: 'warn2' },
    { id: 'kritis', label: 'Kritis', tone: 'danger' }
  ];

  const DAMAGE_STATUS = [
    { id: 'belum', label: 'Belum diperbaiki' },
    { id: 'proses', label: 'Sedang diperbaiki' },
    { id: 'selesai', label: 'Selesai' }
  ];

  global.MC = {
    Store, uid, openDB,
    todayISO, parseISO, daysBetween, addDays, fmtDate, fmtNum, fmtRp, fmtKm, monthKey, monthLabel,
    compressImage, readAsDataUrl,
    SERVICE_TYPES, COMPONENTS, CHECK_STATUS, EXPENSE_CATEGORIES, REMINDER_TEMPLATES, PRIORITIES, DAMAGE_STATUS
  };
})(window);
