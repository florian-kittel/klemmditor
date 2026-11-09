// Service Worker: macht die App installierbar und offline nutzbar.
// Dateien mit Hash im Namen (assets/): erst Cache, sonst Netzwerk – sie ändern sich nie.
// Alles andere (Seite, Manifest, Icons): erst Netzwerk (immer aktuell), offline aus dem Cache.
const CACHE = 'klemmditor-v3';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['./', './manifest.webmanifest'])));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

const store = (key, response) => {
  if (response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(key, copy));
  }
  return response;
};

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (url.pathname.includes('/assets/')) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(r => store(request, r))));
    return;
  }

  const key = request.mode === 'navigate' ? './' : request;
  event.respondWith(fetch(request).then(r => store(key, r)).catch(() => caches.match(key)));
});
