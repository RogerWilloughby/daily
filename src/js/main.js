// DAILY – Einstieg: Raster aufbauen, Anbieter starten und regelmäßig aktualisieren.
import { initBoard, closeAll } from './core/board.js';
import { initAsk, answerOpen, closeAnswer } from './core/ask.js';
import { report, demo } from './core/status.js';
import { ONLINE, getJson } from './core/util.js';
import { chooseLayout } from './core/tiles.js';
import { settings } from './core/store.js';
import { initDialogs } from './ui/dialogs.js';
import { initOrt } from './ui/ort.js';
import weather from './providers/weather.js';
import calendar from './providers/calendar.js';
import news from './providers/news.js';
import markets from './providers/markets.js';
import sport from './providers/sport.js';
import transit from './providers/transit.js';
import content from './providers/content.js';
import knowledge from './providers/knowledge.js';
import local from './providers/local.js';
import links from './providers/links.js';
import holidays from './providers/holidays.js';
import alerts from './providers/alerts.js';
import fuel from './providers/fuel.js';
import sky from './providers/sky.js';

// Betriebsart vom Server: privat nur mit Vercel-Variable DAILY_PRIVATE=1 (Kalender, Schlagzeilen)
let isPrivate = false;
if (ONLINE) { try { isPrivate = !!(await getJson('/api/config', { timeout: 2500 })).private; } catch (e) { /* öffentlich */ } }
chooseLayout(isPrivate, settings.layout);

// Reihenfolge = Priorität: was am häufigsten gebraucht wird, lädt zuerst
const PROVIDERS = [local, links, sky, weather, calendar, news, holidays, content, transit, markets, sport, knowledge, alerts, fuel]
  .filter(p => isPrivate || !p.private);
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

initBoard();
initAsk();
initDialogs(() => PROVIDERS.forEach(run), isPrivate);
initOrt(() => PROVIDERS.forEach(run));        // Ort geändert → alle Kacheln neu laden
tick(); setInterval(tick, 15e3);

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
  if (answerOpen()) closeAnswer(); else closeAll();
});

if (ONLINE) { PROVIDERS.forEach(run); schedule(); }
else { demo(); PROVIDERS.filter(p => p.local).forEach(run); }

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
