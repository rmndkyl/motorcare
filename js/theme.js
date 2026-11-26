/* MOTORCARE — tema terang/gelap
 *
 * Tiga pilihan: 'system' (ikut HP), 'dark', 'light'. Default 'system' karena
 * HP Android/iOS modern sudah punya jadwal tema sendiri.
 *
 * Kunci teknisnya: tema dipasang sebagai atribut di <html> SEBELUM halaman
 * dirender, supaya tidak ada kedipan putih/ hitam saat aplikasi dibuka. Kalau
 * tema diterapkan setelah boot, user melihat flash yang membuat app terasa lambat.
 */
(function (global) {
  'use strict';

  const KEY = 'motorcare-theme';
  const META_THEME = { dark: '#16181c', light: '#f5f6f8' };

  function stored() {
    try { return localStorage.getItem(KEY) || 'system'; } catch (e) { return 'system'; }
  }

  function systemPrefersDark() {
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches; }
    catch (e) { return true; }
  }

  function resolve(mode) {
    if (mode === 'dark' || mode === 'light') return mode;
    return systemPrefersDark() ? 'dark' : 'light';
  }

  function apply(mode) {
    const m = mode || stored();
    const actual = resolve(m);
    document.documentElement.setAttribute('data-theme', actual);
    // warna address bar / status bar HP ikut berubah
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', META_THEME[actual]);
    return actual;
  }

  function set(mode) {
    try { localStorage.setItem(KEY, mode); } catch (e) { /* mode privat: tema tidak persist */ }
    return apply(mode);
  }

  // ikut berubah kalau HP ganti tema sementara user pilih 'system'
  function watch() {
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => { if (stored() === 'system') apply('system'); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    } catch (e) { /* ignore */ }
  }

  const OPTIONS = [
    { id: 'system', label: 'Ikut HP' },
    { id: 'dark', label: 'Gelap' },
    { id: 'light', label: 'Terang' }
  ];

  // dipanggil dari <head> inline, sebelum body dirender
  function boot() {
    apply(stored());
    watch();
  }

  global.MCTheme = { boot, apply, set, stored, resolve, OPTIONS, key: KEY };

  /* Self-boot: file ini dimuat di <head> secara sinkron, jadi tema sudah terpasang
     sebelum <body> dirender. Tidak boleh memakai inline script di index.html karena
     CSP memakai script-src 'self' tanpa 'unsafe-inline'. */
  boot();
})(window);
