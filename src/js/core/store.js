// Lokale Speicherung (nur dieser Browser). Jeder Zugriff ist abgesichert,
// damit DAILY auch ohne Speicher (privates Fenster, blockiert) funktioniert.

function read(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch (e) { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
}

// ---- Einstellungen ----
export const DEFAULTS = {
  place: { name: 'Dresden', admin: 'Sachsen', lat: 51.05, lon: 13.74 },
  icsUrls: [],
  stop: 'Postplatz',
  team: 'Dynamo Dresden',
  fuel: 'e10',
  layout: null // eigene Kachelbelegung (Liste von IDs), kommt später über die Einstellungen
};
const SKEY = 'daily-settings';
export const settings = Object.assign({}, DEFAULTS, read(SKEY, {}));
if (!settings.place || typeof settings.place.lat !== 'number') settings.place = DEFAULTS.place;
export function saveSettings(patch) { Object.assign(settings, patch); return write(SKEY, settings); }

// ---- Klickzähler „Deine Nutzung“ (Schlüssel: Kachel-ID) ----
const CKEY = 'daily-clicks';
const LEGACY = { 'Heute & Wetter': 'weather', 'Kalender': 'calendar', 'Mail': 'mail', 'Nachrichten': 'news', 'Schlagzeilen': 'news',
  'Mein Daily': 'tasks', 'Sport': 'sport', 'Geld': 'money', 'Spielen': 'play', 'Essen': 'food', 'Wissen': 'knowledge',
  'Mobilität': 'transit', 'Gesundheit': 'health', 'Reisen & Länder': 'travel', 'Entertainment': 'film', 'Tech': 'tech',
  'Shopping': 'saving', 'Beziehung': 'relation', 'Pakete': 'parcels' };
export const stats = (() => {
  const s = read(CKEY, null) || { start: new Date().toISOString(), counts: {} };
  if (!s.counts) s.counts = {};
  if (!s.v) { // alte Zählung nach Titeln einmalig auf IDs umstellen
    const c = {};
    for (const [k, n] of Object.entries(s.counts)) { const id = LEGACY[k] || k; c[id] = (c[id] || 0) + n; }
    s.counts = c; s.v = 2; write(CKEY, s);
  }
  return s;
})();
export function countClick(id) { stats.counts[id] = (stats.counts[id] || 0) + 1; write(CKEY, stats); }
export function resetStats() { stats.start = new Date().toISOString(); stats.counts = {}; write(CKEY, stats); }

// ---- Aufgaben „Mein Daily“ ----
const TKEY = 'daily-tasks';
export const tasks = read(TKEY, null) || [
  { id: 't1', text: 'DAILY ausprobieren und Einstellungen prüfen', done: false },
  { id: 't2', text: 'Eigene Aufgabe hinzufügen', done: false }
];
export function saveTasks() { return write(TKEY, tasks); }

// ---- Meine Seiten (Links zu den eigenen Portalen) ----
const LKEY = 'daily-links';
export const links = read(LKEY, null) || [
  { id: 'l1', name: 'Tagesschau', url: 'https://www.tagesschau.de' },
  { id: 'l2', name: 'Gmail', url: 'https://mail.google.com' },
  { id: 'l3', name: 'Google Kalender', url: 'https://calendar.google.com' }
];
export function saveLinks() { return write(LKEY, links); }
