// Service worker: makes Seven-Nil work fully offline. Every file is cached on
// the first visit, so the game opens with no connection from then on. When
// online it still asks the server first (updates show up on the next launch),
// but gives up after a few seconds on a bad connection and uses the cache.
// Bump CACHE when the file list changes.

const CACHE = 'seven-nil-v2';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './js/main.js',
  './js/data.js',
  './js/draft.js',
  './js/formations.js',
  './js/sim.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];
const TIMEOUT = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE)
    .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('seven-nil') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = () => cache.match(req, { ignoreSearch: true })
      .then((hit) => hit || (req.mode === 'navigate' ? cache.match('./index.html') : undefined));
    const network = fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    network.catch(() => {}); // a late failure after the cache already answered is fine
    const timeout = new Promise((resolve) => setTimeout(resolve, TIMEOUT));
    try {
      const res = await Promise.race([network, timeout.then(cached)]);
      if (res) return res;
      return await network;
    } catch {
      return (await cached()) || Response.error();
    }
  })());
});
