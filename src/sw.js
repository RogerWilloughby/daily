// DAILY Service Worker: App-Hülle offline verfügbar, Daten immer frisch.
const CACHE = 'daily-v1';
const SHELL = [
  '/', '/manifest.webmanifest',
  '/fonts/bricolage-grotesque.woff2', '/fonts/figtree-400.woff2', '/fonts/figtree-500.woff2', '/fonts/figtree-600.woff2',
  '/icons/icon-192.png', '/icons/icon-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Wetter-API usw. nie cachen
  // Seite: erst Netz (damit Updates sofort da sind), offline aus dem Cache
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('/', copy)); return r; })
      .catch(() => caches.match('/')));
    return;
  }
  // Schriften, Icons: aus dem Cache, sonst Netz
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
