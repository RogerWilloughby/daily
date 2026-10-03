// DAILY Service Worker (seit 0.48.0, Phase 1c): Programmdateien, Styles, Schriften und Seite kommen je Version aus dem Speicher –
// so zählt ein erneutes Öffnen bei Vercel nur noch wenige Anfragen. Live-Daten (/api/…) immer aus dem Netz, nie gespeichert.
// Neue Version: build.js setzt CACHE neu → der Browser findet einen geänderten Service Worker, lädt alle Dateien einmal neu,
// räumt den alten Speicher weg und übernimmt die Seite (main.js lädt sie dann einmal neu).
const CACHE = 'daily-dev';   // build.js ersetzt das je Upload durch daily-<version>-<commit>
const SHELL = [
  '/', '/app.css', '/css/abreissblock.css', '/css/diagramm.css', '/css/wetter.css', '/css/seiten.css', '/css/lokal.css', '/manifest.webmanifest', '/content/seiten.json',
  '/js/adapter/diagramm.js', '/js/adapter/hinweise.js', '/js/adapter/kalender.js', '/js/adapter/katalog.js', '/js/adapter/regen.js', '/js/adapter/seiten.js',
  '/js/adapter/tagesinhalt.js', '/js/adapter/wetter.js', '/js/ansichten/mini-diagramm.js', '/js/ansichten/radar.js', '/js/ansichten/wetter.js', '/js/core/ansichten.js',
  '/js/core/betrieb.js', '/js/core/einstellungen.js', '/js/core/mini-reiter.js', '/js/core/oberflaeche.js', '/js/core/spielstand.js', '/js/core/status.js', '/js/core/store.js', '/js/core/teilen.js',
  '/js/core/util.js', '/js/core/version.js', '/js/dienste/client.js', '/js/dienste/vertraege.js', '/js/lib/bundesland.js', '/js/lib/url.js',
  '/js/main.js', '/js/providers/heute.js', '/js/providers/kalender.js', '/js/providers/links.js', '/js/providers/tools.js', '/js/providers/weather.js',
  '/js/tools/verzeichnis.js', '/js/ui/dialogs.js', '/js/ui/ort.js', '/js/ui/privat.js',
  '/tools/arbeitszeit.html', '/tools/setzkasten.html',
  '/fonts/big-shoulders-900.woff2', '/fonts/figtree-400.woff2', '/fonts/figtree-500.woff2', '/fonts/figtree-600.woff2', '/fonts/figtree-700.woff2',
  '/icons/icon-192.png', '/icons/icon-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).catch(() => {}).then(() => self.skipWaiting()));   // am Browser-Speicher vorbei frisch holen
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return; // Live-Daten nie speichern
  // Zuerst aus dem Speicher dieser Version; was fehlt, einmal aus dem Netz holen und merken. Die Startseite unter „/“
  // (Tools wie /tools/arbeitszeit.html sind eigene Seiten und behalten ihre Adresse).
  const start = e.request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html');
  const schluessel = start ? '/' : e.request;
  e.respondWith(caches.open(CACHE).then(c => c.match(schluessel).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok && url.search === '') c.put(schluessel, r.clone());
    return r;
  }).catch(() => (start ? caches.match('/') : Response.error())))));
});
