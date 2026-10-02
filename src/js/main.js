// DAILY – Einstieg: Raster aufbauen, Anbieter starten und regelmäßig aktualisieren.
import { initBoard } from './core/board.js';
import { initAsk, answerOpen, closeAnswer } from './core/ask.js';
import { report, demo, zeit } from './core/status.js';
import { aufMessung } from './dienste/client.js';
import { ONLINE, getJson } from './core/util.js';
import { chooseLayout, LAYOUTS } from './core/tiles.js';
import { settings, saveSettings } from './core/store.js';
import { initDialogs } from './ui/dialogs.js';
import { initOrt } from './ui/ort.js';
import { initKacheln } from './ui/kacheln.js';
import { initPrivat } from './ui/privat.js';
import { betrieb } from './core/betrieb.js';
import './ansichten/mini-diagramm.js'; // Mini-Diagramme: Dichte, Zeiger (allgemein)
import weather from './providers/weather.js';
import news from './providers/news.js';
import finanzen from './providers/finanzen.js';
import sport from './providers/sport.js';
import verkehr from './providers/verkehr.js';
import unterhaltung from './providers/unterhaltung.js';
import alltag from './providers/alltag.js';
import wissen from './providers/wissen.js';
import local from './providers/local.js';
import links from './providers/links.js';
import kalender from './providers/kalender.js';
import tools from './providers/tools.js';

// Betriebsart vom Server: privat nur mit Vercel-Variable DAILY_PRIVATE=1 (Kalender, Schlagzeilen)
let isPrivate = false;
if (ONLINE) { try { isPrivate = !!(await getJson('/api/config', { timeout: 2500 })).private; } catch (e) { /* öffentlich */ } }
betrieb.privat = isPrivate;
// Früher „Alle Kacheln zeigen (Vorschau)“ → einmalig in eine eigene Belegung mit allen Kacheln übernehmen
if (settings.alleKacheln && !Array.isArray(settings.layout)) saveSettings({ layout: LAYOUTS[isPrivate ? 'private' : 'public'], alleKacheln: undefined });
const sichtbar = new Set(chooseLayout(isPrivate, settings.layout).filter(Boolean).map(t => t.id));

// Welche Kacheln ein Anbieter füllt – Anbieter ausgeblendeter Kacheln starten gar nicht erst (keine Abrufe)
const KACHELN = { local: ['tasks', 'usage'] };   // Tagesinhalte seit 0.34.0–0.36.0 in den Themen-Kacheln Unterhaltung, Wissen, Alltag (Spartipp in „Finanzen“)
// Reihenfolge = Priorität: was am häufigsten gebraucht wird, lädt zuerst
const PROVIDERS = [local, links, weather, kalender, news, unterhaltung, alltag, verkehr, finanzen, sport, wissen, tools]
  .filter(p => (isPrivate || !p.private) && (KACHELN[p.id] || [p.id]).some(id => sichtbar.has(id)));
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

function tick() {
  const now = new Date();
  document.getElementById('date').textContent = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('clock').textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

aufMessung(zeit);   // Ladezeiten der Dienste in die Statusanzeige (Mouseover)
initBoard();
initAsk();
initDialogs();
initKacheln(isPrivate);
initPrivat(isPrivate);
initOrt(() => PROVIDERS.forEach(run));
// Kachel-Einstellungen gespeichert → nur den Anbieter dieser Kachel neu laden
document.addEventListener('daily:einstellungen', e => PROVIDERS.filter(p => (KACHELN[p.id] || [p.id]).includes(e.detail)).forEach(run));        // Ort geändert → alle Kacheln neu laden
tick(); setInterval(tick, 15e3);

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
  if (answerOpen()) closeAnswer();
});

if (ONLINE) { PROVIDERS.forEach(run); schedule(); }
else { demo(); PROVIDERS.filter(p => p.local).forEach(run); }

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
