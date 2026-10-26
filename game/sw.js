// Service worker: always asks the server for the newest files (so updates
// show up on the next launch instead of after the 10-minute browser cache),
// and falls back to the last copy when offline.

const CACHE = 'cash-out';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(event.request, { cache: 'no-cache' });
      if (res.ok) cache.put(event.request, res.clone());
      return res;
    } catch {
      return (await cache.match(event.request)) || Response.error();
    }
  })());
});
