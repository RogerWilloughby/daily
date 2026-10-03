// DAILY – Einstieg: Oberfläche „Abreißblock“ aufbauen (seit 0.47.0), Anbieter starten und regelmäßig aktualisieren.
// Bereiche Heute · Entdecken · Wetter · Kalender · Mehr (core/oberflaeche.js, Album ab Phase 3); DAILY öffnet immer mit „Heute“.
// Seit 0.48.0 (Phase 1c) lädt ein Bereich erst, wenn er sichtbar ist, und frischt sich nur auf, solange er sichtbar ist;
// immer geladen werden nur die Wetterhinweise (Unwetter-Punkt am Tab „Wetter“).
import { initOberflaeche, aktiverBereich, faelligeAnbieter } from './core/oberflaeche.js';
import { report, demo, zeit } from './core/status.js';
import { aufMessung } from './dienste/client.js';
import { ONLINE, getJson } from './core/util.js';
import { initDialogs } from './ui/dialogs.js';
import { initOrt } from './ui/ort.js';
import { initPrivat } from './ui/privat.js';
import { betrieb } from './core/betrieb.js';
import './ansichten/mini-diagramm.js'; // Mini-Diagramme: Dichte, Zeiger (allgemein)
import heute from './providers/heute.js';
import weather, { hinweiseAnbieter } from './providers/weather.js';
import kalender, { himmelAnbieter } from './providers/kalender.js';
import links from './providers/links.js';

// Betriebsart vom Server: privat nur mit Vercel-Variable DAILY_PRIVATE=1 (Tools unter Mehr)
let isPrivate = false;
if (ONLINE) { try { isPrivate = !!(await getJson('/api/config', { timeout: 2500 })).private; } catch (e) { /* öffentlich */ } }
betrieb.privat = isPrivate;
const tools = isPrivate ? (await import('./providers/tools.js')).default : null;

// Jeder Anbieter gehört zu einem Bereich (p.bereich) oder läuft immer ('immer')
const PROVIDERS = [heute, hinweiseAnbieter, weather, himmelAnbieter, kalender, links, tools].filter(Boolean);
const lastRun = new Map();   // Anbieter-ID → letzter Lauf

async function run(p) {
  lastRun.set(p.id, Date.now());
  try { await p.load(); if (!p.local && !p.still) report(p.name, true); }
  catch (e) { if (!p.local && !p.still) report(p.name, false); console.warn('[DAILY]', p.name, e); }
}
// Was der sichtbare Bereich braucht und veraltet ist (nie geladen = sofort)
const ladeFaellige = (maxAlter = p => p.every) => faelligeAnbieter(PROVIDERS, aktiverBereich(), lastRun, Date.now(), maxAlter).forEach(run);

// Nur im sichtbaren Browser-Tab und nur den sichtbaren Bereich aktualisieren; beim Zurückkehren Veraltetes sofort nachladen
function schedule() {
  setInterval(() => { if (!document.hidden) ladeFaellige(); }, 30e3);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ladeFaellige(p => Math.min(p.every, 10 * 60e3)); });
  document.addEventListener('daily:bereich', () => ladeFaellige());   // Bereich gewechselt: beim ersten Mal laden, sonst nur, wenn veraltet
}

// Leiste: Datum (am Handy kurz „Sa. 3.10.“), Uhr nur am Rechner (CSS)
function tick() {
  const now = new Date();
  const tag = o => now.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', ...o });
  document.getElementById('date').innerHTML = `<span class="lang">${tag({ weekday: 'short', day: 'numeric', month: 'long' })}</span><span class="kurz">${tag({ weekday: 'short', day: 'numeric', month: 'numeric' }).replace(',', '')}</span>`;
  document.getElementById('clock').textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

aufMessung(zeit);   // Ladezeiten der Dienste in die Statusanzeige (Mouseover)
initOberflaeche({ privat: isPrivate });
initDialogs();
initPrivat(isPrivate);
// Ort geändert → ortsbezogene Anbieter gelten als veraltet; sichtbar ist, lädt sofort, der Rest beim nächsten Antippen
initOrt(() => { [hinweiseAnbieter, weather, himmelAnbieter, kalender].forEach(p => lastRun.delete(p.id)); ladeFaellige(); });
// Einstellungen gespeichert → den passenden Anbieter neu laden, wenn er schon einmal geladen hat
document.addEventListener('daily:einstellungen', e => PROVIDERS.filter(p => p.id === e.detail && lastRun.has(p.id)).forEach(run));
tick(); setInterval(tick, 15e3);

if (ONLINE) { ladeFaellige(); schedule(); }
else { demo(); PROVIDERS.filter(p => p.local).forEach(run); }

// Service Worker (seit 0.48.0): Programmdateien aus dem Speicher je Version. Nach einem Upload übernimmt der neue Service Worker
// die Seite – dann einmal neu laden, damit Seite und Programm zur selben Version gehören (nicht beim allerersten Besuch).
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const hatteSW = !!navigator.serviceWorker.controller;
  let neuGeladen = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hatteSW && !neuGeladen) { neuGeladen = true; location.reload(); } });
  // main.js wartet oben auf /api/config – meist ist „load“ dann schon vorbei (bis 0.47.3 wurde der Service Worker deshalb nie angemeldet)
  // update(): bei jedem Öffnen nachsehen, ob es eine neue Version gibt (eine kleine Anfrage nach /sw.js)
  const anmelden = () => navigator.serviceWorker.register('/sw.js').then(r => r.update()).catch(() => {});
  if (document.readyState === 'complete') anmelden(); else window.addEventListener('load', anmelden);
}
