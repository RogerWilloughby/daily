// Das Kachelraster: Aufbau, „Raster wächst mit“, Handy-Vollbild und Aktualisieren einzelner Kacheln.
import { TILES, byId, COLS, ROWS } from './tiles.js';
import { esc, icon, rows } from './util.js';
import { countClick } from './store.js';
import { hatEinstellungen, formular, binden, ZAHNRAD } from './einstellungen.js';

const WEIGHT = 4;
const mobileMQ = window.matchMedia('(max-width:760px), (max-height:520px)');
const grid = document.getElementById('grid');
const sheet = document.getElementById('sheet');
let ORDER = []; // Reihenfolge für das Wischen (= Belegung des Rasters)
let active = null; // aktive Kachel (Desktop)
let open = null;   // offene Kachel (Handy)

function tileHTML(t) {
  return `<article class="tile" data-mode="rest" data-state="${t.state}" id="tile-${t.id}">
    <button class="head" type="button" data-id="${t.id}" aria-expanded="false">
      <span class="label">${icon(t.icon)}<span class="lglyph" hidden></span><span class="long"></span><span class="short">${esc(t.short)}</span><span class="tag" hidden></span></span>
      <span class="metric"><span class="glyph"></span><span class="m-long"></span><span class="m-short"></span></span>
      <span class="teaser"></span>
      <span class="mini" aria-hidden="true"></span>
    </button>
    <div class="body">
      <button class="close" type="button" data-close>Schließen</button>
      <div class="content"></div>
    </div>
  </article>`;
}

// Inhalt einer Kachel (aufgeklappt) in ein Element schreiben: eigene Darstellung oder Zeilen
// t.big: optionale Grafik (HTML/SVG) über den Zeilen; Elemente mit data-tip zeigen beim Überfahren einen Hinweis
// t.tabs: [{ id, name, html }] – Reiter statt langer Liste; der gewählte Reiter bleibt je Kachel erhalten
// t.startReiter: Reiter, der beim ersten Aufklappen offen ist (sonst der erste)
// Hat die Kachel Einstellungen (core/einstellungen.js), kommt ein letzter Reiter mit Zahnrad dazu; Kacheln ohne Reiter
// bekommen dafür einen Reiter „Übersicht“ mit ihrem bisherigen Inhalt.
const reiterWahl = {};
const EINST = 'einstellungen';
export function reiterVon(t) {
  const einst = hatEinstellungen(t.id);
  let tabs = t.tabs && t.tabs.length ? t.tabs : null;
  if (!tabs && einst) tabs = [{ id: 'inhalt', name: 'Übersicht', html: (t.big || '') + rows(t.rows) }];
  if (tabs && einst) tabs = [...tabs, { id: EINST, name: 'Einstellungen', icon: ZAHNRAD, html: formular(t.id) }];
  return tabs;
}
function fillContent(t, el) {
  const tabs = typeof t.render === 'function' ? null : reiterVon(t);
  if (typeof t.render === 'function') { el.innerHTML = ''; t.render(el); }
  else if (tabs) {
    const gibt = id => tabs.some(x => x.id === id);
    const wahl = gibt(reiterWahl[t.id]) ? reiterWahl[t.id] : gibt(t.startReiter) ? t.startReiter : tabs[0].id;
    el.innerHTML = `<div class="reiter" role="tablist">${tabs.map(x =>
      `<button type="button" role="tab" data-tab="${esc(x.id)}" aria-selected="${x.id === wahl}"${x.icon ? ` class="reiter-icon" title="${esc(x.name)}" aria-label="${esc(x.name)}"` : ''}>${x.icon || esc(x.name)}</button>`).join('')}</div>` +
      tabs.map(x => `<div class="reiterfeld" role="tabpanel" data-feld="${esc(x.id)}"${x.id === wahl ? '' : ' hidden'}>${x.html}</div>`).join('');
    binden(t.id, el);
    el.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      reiterWahl[t.id] = b.dataset.tab;
      el.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
      el.querySelectorAll('[data-feld]').forEach(f => { f.hidden = f.dataset.feld !== b.dataset.tab; });
    }));
  }
  else el.innerHTML = (t.big || '') + rows(t.rows);
  hinweise(el);
}
function hinweise(el) {
  el.querySelectorAll('figure').forEach(fig => {
    const tip = fig.querySelector('.wd-tip'); if (!tip) return;
    const zeige = e => {
      const z = e.target.closest('[data-tip]');
      if (!z) { tip.hidden = true; return; }
      fig.querySelectorAll('.an').forEach(x => x.classList.remove('an')); z.classList.add('an');
      tip.textContent = z.dataset.tip; tip.hidden = false;
    };
    fig.addEventListener('pointermove', zeige);
    fig.addEventListener('pointerleave', () => { tip.hidden = true; fig.querySelectorAll('.an').forEach(x => x.classList.remove('an')); });
  });
}

export function paint(id) {
  const t = byId[id], el = document.getElementById('tile-' + id);
  if (!t || !el) return;
  el.dataset.state = t.state;
  if (t.titleHtml) el.querySelector('.label .long').innerHTML = t.titleHtml; else el.querySelector('.label .long').textContent = t.title;
  const tag = el.querySelector('.tag');
  const tagText = t.tag ?? (t.state === 'off' ? 'einrichten' : ''); tag.hidden = !tagText; tag.textContent = tagText;
  el.querySelector('.glyph').innerHTML = t.glyph || '';
  // Symbol in der Kopfzeile (z. B. aktuelles Wetter) mit Erklärung beim Überfahren
  const lg = el.querySelector('.lglyph');
  lg.innerHTML = t.lglyph || ''; lg.hidden = !t.lglyph; lg.title = t.lglyphTip || ''; lg.setAttribute('aria-label', t.lglyphTip || '');
  const mEl = el.querySelector('.metric');
  mEl.classList.toggle('trend-up', t.trend === 'up');
  mEl.classList.toggle('trend-down', t.trend === 'down');
  el.querySelector('.m-long').textContent = t.m;
  mEl.toggleAttribute('data-leer', !t.m && !t.glyph);   // keine große Zeile (Handy zeigt trotzdem die Kurzform)
  mEl.dataset.len = String(t.m).length > 13 ? 'long' : 'short';
  el.querySelector('.m-short').textContent = t.ms ?? t.m;
  el.querySelector('.teaser').textContent = t.x;
  el.querySelector('.mini').innerHTML = t.chart || '';
  el.querySelector('.head').setAttribute('aria-label', [t.title, t.lglyphTip, t.m].filter(Boolean).join(': '));
  // Aufgeklappten Inhalt nur neu zeichnen, wenn er sichtbar ist – und nicht, während die Einstellungen offen sind (Eingaben bleiben)
  const imFormular = reiterWahl[id] === EINST;
  if (active === id && !imFormular) fillContent(t, el.querySelector('.content'));
  if (open === id && !imFormular) showSheet(id);
}

// Anbieter melden neue Werte hierüber
export function set(id, patch) {
  const t = byId[id]; if (!t) return;
  Object.assign(t, patch);
  paint(id);
}

function layout() {
  const cells = TILES;
  const pos = active === null ? -1 : cells.findIndex(t => t && t.id === active);
  const ar = pos < 0 ? -1 : Math.floor(pos / COLS), ac = pos < 0 ? -1 : pos % COLS;
  const tr = (n, a) => Array.from({ length: n }, (_, k) => `minmax(0,${k === a ? WEIGHT : 1}fr)`).join(' ');
  grid.style.gridTemplateColumns = tr(COLS, ac);
  grid.style.gridTemplateRows = tr(ROWS, ar);
  cells.forEach((t, c) => {
    const r = Math.floor(c / COLS), col = c % COLS;
    const mode = pos < 0 ? 'rest' : c === pos ? 'active' : (r === ar || col === ac) ? 'lane' : 'small';
    const el = document.getElementById(t ? 'tile-' + t.id : 'cell-' + c);
    el.dataset.mode = mode;
    const h = el.querySelector('.head'); if (h) h.setAttribute('aria-expanded', String(mode === 'active'));
  });
}

export function activate(id) {
  if (active === id) return;
  active = id; layout();
  if (id) { const t = byId[id]; fillContent(t, document.querySelector(`#tile-${id} .content`)); }
}
export const isAnyOpen = () => active !== null || open !== null;
export function closeAll() {
  if (open !== null) { hideSheet(); return true; }
  if (active !== null) { activate(null); return true; }
  return false;
}

// ---- Handy: Vollbild pro Kachel ----
function showSheet(id) {
  open = id;
  const t = byId[id], i = ORDER.indexOf(id), n = ORDER.length;
  document.getElementById('s-label').innerHTML = icon(t.icon) + (t.lglyph ? `<span class="lglyph">${t.lglyph}</span>` : '') + (t.titleHtml || esc(t.title));
  document.getElementById('s-metric').textContent = t.m || t.ms || '';
  document.getElementById('s-teaser').textContent = t.x;
  fillContent(t, document.getElementById('s-content'));
  document.getElementById('s-pos').textContent = `${i + 1} / ${n}`;
  document.getElementById('s-prev').textContent = '‹ ' + byId[ORDER[(i - 1 + n) % n]].short;
  document.getElementById('s-next').textContent = byId[ORDER[(i + 1) % n]].short + ' ›';
  sheet.classList.add('open');
}
function hideSheet() { open = null; sheet.classList.remove('open'); }
function step(d) { const n = ORDER.length; showSheet(ORDER[(ORDER.indexOf(open) + d + n) % n]); }

// Nach dem Speichern von Kachel-Einstellungen: Inhalt neu zeichnen (Reiter können sich ändern), Zahnrad-Reiter bleibt offen
document.addEventListener('daily:einstellungen', e => {
  const id = e.detail, t = byId[id]; if (!t) return;
  const ziele = [active === id && document.querySelector(`#tile-${id} .content`), open === id && document.getElementById('s-content')].filter(Boolean);
  ziele.forEach(el => {
    fillContent(t, el);
    const ok = el.querySelector('.ke-ok');
    if (ok) { ok.textContent = 'Gespeichert ✓'; setTimeout(() => { ok.textContent = ''; }, 2500); }
  });
});

export function initBoard() {
  ORDER = TILES.filter(Boolean).map(t => t.id);
  grid.innerHTML = TILES.map((t, c) => t ? tileHTML(t)
    : `<div class="tile free" data-mode="rest" id="cell-${c}" aria-hidden="true"><span>Freier Platz</span></div>`).join('');
  TILES.forEach(t => t && paint(t.id));
  layout();

  grid.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { activate(null); return; }
    const head = e.target.closest('.head'); if (!head) return;
    const id = head.dataset.id;
    const clicked = () => { countClick(id); document.dispatchEvent(new CustomEvent('daily:click', { detail: id })); };
    if (mobileMQ.matches) { clicked(); showSheet(id); return; }
    if (active === id) return;
    clicked(); activate(id);
  });
  document.getElementById('s-back').onclick = hideSheet;
  document.getElementById('s-prev').onclick = () => step(-1);
  document.getElementById('s-next').onclick = () => step(1);
  let tx = null;
  sheet.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  sheet.addEventListener('touchend', e => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 60 && !e.target.closest('input,textarea')) step(dx < 0 ? 1 : -1);
  });
  mobileMQ.addEventListener('change', () => { if (!mobileMQ.matches) hideSheet(); });
}
