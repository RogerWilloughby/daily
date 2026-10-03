// DAILY – Einstieg: Oberfläche „Abreißblock“ aufbauen (seit 0.47.0), Anbieter starten und regelmäßig aktualisieren.
// Bereiche Heute · Wetter · Kalender · Mehr (core/oberflaeche.js); DAILY öffnet immer mit „Heute“.
import { initOberflaeche } from './core/oberflaeche.js';
import { report, demo, zeit } from './core/status.js';
import { aufMessung } from './dienste/client.js';
import { ONLINE, getJson } from './core/util.js';
import { initDialogs } from './ui/dialogs.js';
import { initOrt } from './ui/ort.js';
import { initPrivat } from './ui/privat.js';
import { betrieb } from './core/betrieb.js';
import './ansichten/mini-diagramm.js'; // Mini-Diagramme: Dichte, Zeiger (allgemein)
import heute from './providers/heute.js';
import weather from './providers/weather.js';
import kalender from './providers/kalender.js';
import links from './providers/links.js';

// Betriebsart vom Server: privat nur mit Vercel-Variable DAILY_PRIVATE=1 (Tools unter Mehr)
let isPrivate = false;
if (ONLINE) { try { isPrivate = !!(await getJson('/api/config', { timeout: 2500 })).private; } catch (e) { /* öffentlich */ } }
betrieb.privat = isPrivate;
const tools = isPrivate ? (await import('./providers/tools.js')).default : null;

// Reihenfolge = Priorität: „Heute“ zuerst (damit öffnet DAILY), dann Wetter, Kalender, Mehr
const PROVIDERS = [heute, weather, kalender, links, tools].filter(Boolean);
const lastRun = new Map();

async function run(p) {
  lastRun.set(p, Date.now());
  try { await p.load(); if (!p.local) report(p.name, true); }
  catch (e) { if (!p.local) report(p.name, false); console.warn('[DAILY]', p.name, e); }
}

// Nur im sichtbaren Tab aktualisieren; beim Zurückkehren Veraltetes sofort nachladen
function schedule() {
  setInterval(() => {
    if (document.hidden) return;
    PROVIDERS.forEach(p => { if (Date.now() - (lastRun.get(p) || 0) >= p.every) run(p); });
  }, 30e3);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    PROVIDERS.forEach(p => { if (Date.now() - (lastRun.get(p) || 0) >= Math.min(p.every, 10 * 60e3)) run(p); });
  });
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
initOrt(() => [weather, kalender].forEach(run));   // Ort geändert → ortsbezogene Bereiche neu laden
// Einstellungen gespeichert → nur den passenden Anbieter neu laden
document.addEventListener('daily:einstellungen', e => PROVIDERS.filter(p => p.id === e.detail).forEach(run));
tick(); setInterval(tick, 15e3);

if (ONLINE) { PROVIDERS.forEach(run); schedule(); }
else { demo(); PROVIDERS.filter(p => p.local).forEach(run); }

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
