// Lokale Speicherung (nur dieser Browser). Jeder Zugriff ist abgesichert,
// damit DAILY auch ohne Speicher (privates Fenster, blockiert) funktioniert.
import { GENUTZTE_DIENSTE } from './betrieb.js';

function read(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch (e) { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
}

// ---- Einmal aufräumen (0.47.3, Entscheidung 03.10.2026): Daten der alten Kachel-Oberfläche entfernen ----
// Aufgaben („Mein Daily“), Klickzähler („Deine Nutzung“), alte Einstellungen (Haltestelle, Verein, Kraftstoff, Kachelbelegung,
// iCal-Links der Termine, Einstellungen weggefallener Kacheln, gemerkte Reiterwahl) und gespeicherte Antworten von Diensten,
// die die Oberfläche nicht mehr abruft. Läuft nur einmal (Merker in den Einstellungen). Rein bis auf den übergebenen Speicher – testbar.
export const AUFGERAEUMT = 1;
const BEREICHE_MIT_EINSTELLUNGEN = ['weather', 'kalender', 'links', 'tools'];
const ALTE_EINSTELLUNGEN = ['icsUrls', 'stop', 'team', 'fuel', 'layout', 'alleKacheln'];
export function aufraeumen(sp) {
  let s; try { s = JSON.parse(sp.getItem('daily-settings')) || {}; } catch (e) { s = {}; }
  if (s.aufgeraeumt >= AUFGERAEUMT) return false;
  ['daily-clicks', 'daily-tasks'].forEach(k => sp.removeItem(k));
  for (const k of sp.keys()) {
    const m = /^daily-dienst:\/api\/v1\/([a-z]+)/.exec(k);
    if (k.startsWith('daily-dienst:') && !(m && GENUTZTE_DIENSTE.includes(m[1]))) sp.removeItem(k);
  }
  ALTE_EINSTELLUNGEN.forEach(k => delete s[k]);
  const kacheln = {};
  for (const id of BEREICHE_MIT_EINSTELLUNGEN) if (s.kacheln && s.kacheln[id]) { const { reiter, ...rest } = s.kacheln[id]; kacheln[id] = rest; }
  s.kacheln = kacheln;
  s.aufgeraeumt = AUFGERAEUMT;
  sp.setItem('daily-settings', JSON.stringify(s));
  return true;
}
try {
  if (typeof localStorage !== 'undefined') aufraeumen({ getItem: k => localStorage.getItem(k), setItem: (k, v) => localStorage.setItem(k, v),
    removeItem: k => localStorage.removeItem(k), keys: () => Object.keys(localStorage) });
} catch (e) { /* ohne Speicher: nichts zu tun */ }

// ---- Einstellungen ----
export const DEFAULTS = {
  place: { name: 'Dresden', admin: 'Sachsen', land: 'DE', lat: 51.05, lon: 13.74, zeitzone: 'Europe/Berlin' },
  kacheln: {}        // Einstellungen je Bereich (Name aus der Kachel-Zeit), z. B. { weather: { mini: 7 }, kalender: { namen: false } }
};
const SKEY = 'daily-settings';
export const settings = Object.assign({}, DEFAULTS, read(SKEY, {}));
if (!settings.place || typeof settings.place.lat !== 'number') settings.place = DEFAULTS.place;
// früher gespeicherter eigener Ort (vor dem Merkmal „gewaehlt“): alles außer dem Beispielort Dresden gilt als gewählt
else if (settings.place.gewaehlt == null && read(SKEY, {}).place && !(settings.place.name === 'Dresden' && settings.place.lat === 51.05))
  settings.place = { ...settings.place, gewaehlt: true };
export function saveSettings(patch) { Object.assign(settings, patch); return write(SKEY, settings); }
// Einstellungen eines Bereichs lesen (mit Standardwerten) und speichern
export const kachelOpt = (id, standard = {}) => ({ ...standard, ...((settings.kacheln || {})[id] || {}) });
export const kachelOptSpeichern = (id, werte) => saveSettings({ kacheln: { ...(settings.kacheln || {}), [id]: { ...((settings.kacheln || {})[id] || {}), ...werte } } });

// ---- Mehrere Orte: settings.orte (Liste), settings.place = aktiver Ort (alle Bereiche lesen nur place) ----
export const MAX_ORTE = 10;
const gleicherOrt = (a, b) => a && b && a.name === b.name && Math.abs(a.lat - b.lat) < 0.02 && Math.abs(a.lon - b.lon) < 0.02;
if (!Array.isArray(settings.orte)) settings.orte = settings.place && settings.place.gewaehlt ? [settings.place] : [];
export function ortWaehlen(i) {
  const o = settings.orte[i]; if (!o) return false;
  return saveSettings({ place: o });
}
// neuen Ort aufnehmen (oder vorhandenen wählen) und aktiv setzen; der älteste fällt bei mehr als MAX_ORTE heraus
export function ortHinzufuegen(p) {
  const da = settings.orte.find(o => gleicherOrt(o, p));
  if (da) return saveSettings({ place: da });           // schon gespeichert: nur wählen, Reihenfolge bleibt
  const orte = [...settings.orte, p];
  while (orte.length > MAX_ORTE) orte.shift();
  return saveSettings({ orte, place: p });
}
export function ortEntfernen(i) {
  const orte = settings.orte.filter((_, k) => k !== i);
  const aktivWeg = gleicherOrt(settings.orte[i], settings.place);
  return saveSettings({ orte, place: aktivWeg ? (orte[0] || DEFAULTS.place) : settings.place });
}
export const aktiverOrt = () => settings.orte.findIndex(o => gleicherOrt(o, settings.place));

// ---- Gemerkte Tagesinhalte (Kopie des Inhalts: { art, datum, kurz, text }) – nur auf diesem Gerät ----
const FKEY = 'daily-favoriten';
export const favoriten = read(FKEY, null) || [];
export function saveFavoriten() { return write(FKEY, favoriten); }

// ---- Meine Seiten (Links zu den eigenen Portalen) ----
const LKEY = 'daily-links';
export const links = read(LKEY, null) || [
  { id: 'l1', name: 'Tagesschau', url: 'https://www.tagesschau.de' },
  { id: 'l2', name: 'Gmail', url: 'https://mail.google.com' },
  { id: 'l3', name: 'Google Kalender', url: 'https://calendar.google.com' }
];
export function saveLinks() { return write(LKEY, links); }
