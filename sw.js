/* MOTORCARE — service worker
 * Cache-first untuk aset aplikasi supaya bisa dipakai tanpa internet.
 * Data user TIDAK pernah dikirim ke mana pun; SW hanya menyajikan file statis.
 */
const VERSION = 'motorcare-v1.5.3';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/core.js',
  './js/domain.js',
  './js/icons.js',
  './js/ui.js',
  './js/state.js',
  './js/page-bikeform.js',
  './js/page-home.js',
  './js/page-garage.js',
  './js/page-care.js',
  './js/page-history.js',
  './js/page-profile.js',
  './js/forms.js',
  './js/data-io.js',
  './js/ai.js',
  './js/app.js',
  './fonts/barlow-latin-400-normal.woff2',
  './fonts/barlow-latin-500-normal.woff2',
  './fonts/barlow-latin-600-normal.woff2',
  './fonts/barlow-condensed-latin-500-normal.woff2',
  './fonts/barlow-condensed-latin-700-normal.woff2',
  './fonts/barlow-condensed-latin-800-normal.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => {
        // fetch dengan cache:'reload' supaya aset diambil dari server, bukan dari
        // HTTP cache browser. Tanpa ini, SW baru bisa menyimpan versi LAMA kalau
        // CDN masih menyajikan build sebelumnya tepat setelah deploy.
        return Promise.all(ASSETS.map((url) =>
          fetch(new Request(url, { cache: 'reload' }))
            .then((res) => (res && res.ok) ? c.put(url, res) : null)
            .catch(() => null)
        ));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Jangan cache request ke API pihak ketiga (AI provider) — selalu network
  if (url.origin !== self.location.origin) return;

  const isDoc = req.mode === 'navigate';
  const isCode = /\.(?:js|css|webmanifest)$/.test(url.pathname);

  // Navigasi & kode: network-first. Kode berubah tiap deploy, jadi cache-first
  // akan menyajikan versi lama setelah update. Fallback ke cache saat offline.
  if (isDoc || isCode) {
    e.respondWith(
      fetch(new Request(req, { cache: 'no-cache' }))
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(isDoc ? './index.html' : req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(isDoc ? './index.html' : req))
    );
    return;
  }

  // Aset statis lain (font, ikon): cache-first
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit);
    })
  );
});
