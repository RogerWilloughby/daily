// DAILY Service Worker: App offline startbar, Daten und Code immer frisch aus dem Netz.
const CACHE = 'daily-dev';   // build.js ersetzt das je Upload durch daily-<version>-<commit>
const SHELL = [
  '/', '/app.css', '/css/diagramm.css', '/css/wetter.css', '/css/finanzen.css', '/css/verkehr.css', '/css/seiten.css', '/css/tagesinhalt.css', '/css/lokal.css', '/manifest.webmanifest', '/content/seiten.json',
  '/js/main.js', '/js/core/util.js', '/js/core/store.js', '/js/core/tiles.js', '/js/core/board.js',
  '/js/core/ask.js', '/js/core/status.js', '/js/core/version.js', '/js/ui/dialogs.js', '/js/ui/ort.js',
  '/js/providers/weather.js', '/js/providers/news.js', '/js/providers/finanzen.js', '/js/providers/verkehr.js', '/js/adapter/tanken.js', '/js/adapter/autobahn.js',
  '/js/providers/sport.js', '/js/providers/wissen.js', '/js/providers/local.js', '/js/adapter/lokal.js',
  '/js/providers/links.js', '/js/adapter/seiten.js', '/js/adapter/tagesinhalt.js', '/js/providers/thema.js', '/js/providers/unterhaltung.js', '/js/providers/alltag.js', '/js/providers/tools.js', '/js/tools/verzeichnis.js', '/tools/arbeitszeit.html', '/tools/setzkasten.html', '/js/providers/kalender.js',
  '/js/lib/url.js',
  '/js/dienste/client.js', '/js/core/betrieb.js', '/js/core/einstellungen.js', '/js/ui/kacheln.js', '/js/adapter/wetter.js', '/js/adapter/diagramm.js', '/js/adapter/kursdiagramm.js', '/js/core/ansichten.js', '/js/ansichten/mini-diagramm.js', '/js/ansichten/wetter.js', '/js/ansichten/radar.js', '/js/adapter/regen.js', '/js/adapter/hinweise.js', '/js/adapter/kalender.js', '/js/adapter/finanzen.js', '/js/adapter/katalog.js',
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
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return; // Live-Daten nie cachen
  // Schriften und Icons ändern sich nie: zuerst aus dem Cache
  if (url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
    return;
  }
  // Seite, Code, Inhalte: zuerst Netz (Updates sofort sichtbar), offline aus dem Cache
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request).then(hit => hit || (e.request.mode === 'navigate' ? caches.match('/') : Response.error()))));
});
