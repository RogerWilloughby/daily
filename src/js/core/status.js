// Zustand der Live-Quellen für die Anzeige unten in der Leiste.
import { hm } from './util.js';

const sources = {}; // name → { ok, at }
const el = document.getElementById('status');
const txt = document.getElementById('status-text');

export function report(name, ok) {
  sources[name] = { ok, at: new Date().toISOString() };
  const all = Object.entries(sources);
  const bad = all.filter(([, s]) => !s.ok).map(([n]) => n);
  const last = all.map(([, s]) => s.at).sort().pop();
  el.dataset.level = bad.length ? 'warn' : 'ok';
  txt.textContent = bad.length ? `${bad.length} Quelle${bad.length > 1 ? 'n' : ''} gestört` : `Live · ${hm(last)}`;
  zeichneTitel();
}

// Ladezeiten der Dienste (Messung im Client): „wetter 120 ms“; aus dem Speicher = 0 ms
const zeiten = {};
const QUELLE = { netz: '', speicher: ' (Speicher)', rueckfall: ' (letzter Stand – Quelle gestört)', fehler: ' (Fehler)' };
export function zeit(name, ms, quelle) {
  if (quelle === 'speicher' && zeiten[name]) return;   // gemessene Netzzeit nicht durch Speichertreffer überschreiben
  zeiten[name] = { ms, quelle };
  zeichneTitel();
}
function zeichneTitel() {
  const q = Object.entries(sources).map(([n, s]) => `${n}: ${s.ok ? 'ok' : 'nicht erreichbar'} (${hm(s.at)})`);
  const z = Object.entries(zeiten).map(([n, t]) => `${n} ${t.ms} ms${QUELLE[t.quelle] || ''}`);
  el.title = q.join('\n') + (z.length ? '\n\nLadezeiten: ' + z.join(' · ') : '');
}

export function demo() {
  el.dataset.level = 'idle';
  txt.textContent = 'Beispieldaten';
  el.title = 'Lokale Vorschau ohne Server – Live-Daten gibt es auf Vercel.';
}
