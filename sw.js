// Service worker: makes the app open offline. Network-first with cache
// fallback, so updates show up immediately when online and the cached copy
// serves when offline. Bump CACHE_VERSION on every release to drop old files.

const CACHE_VERSION = 'wakeup-v2';
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/storage.js',
  './js/alarm.js',
  './js/recheck.js',
  './js/challenges/index.js',
  './js/challenges/math.js',
  './js/challenges/typing.js',
  './js/challenges/qr.js',
  './js/vendor/jsQR.js',
  './js/vendor/qrcode.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return;
  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      try {
        const res = await fetch(event.request);
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      } catch {
        return (await cache.match(event.request)) || Response.error();
      }
    })
  );
});
