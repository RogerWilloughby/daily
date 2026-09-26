// Das Kachelraster: Aufbau, „Raster wächst mit“, Handy-Vollbild und Aktualisieren einzelner Kacheln.
import { TILES, byId, COLS, ROWS } from './tiles.js';
import { esc, icon, rows } from './util.js';
import { countClick } from './store.js';

const WEIGHT = 4;
const mobileMQ = window.matchMedia('(max-width:760px), (max-height:520px)');
const grid = document.getElementById('grid');
const sheet = document.getElementById('sheet');
const ORDER = TILES.filter(Boolean).map(t => t.id); // Reihenfolge für das Wischen
let active = null; // aktive Kachel (Desktop)
let open = null;   // offene Kachel (Handy)

function tileHTML(t) {
  return `<article class="tile" data-mode="rest" data-state="${t.state}" id="tile-${t.id}">
    <button class="head" type="button" data-id="${t.id}" aria-expanded="false">
      <span class="label">${icon(t.icon)}<span class="long"></span><span class="short">${esc(t.short)}</span><span class="tag" hidden></span></span>
      <span class="metric"><span class="glyph"></span><span class="m-long"></span><span class="m-short"></span></span>
      <span class="teaser"></span>
    </button>
    <div class="body">
      <button class="close" type="button" data-close>Schließen</button>
      <div class="content"></div>
    </div>
  </article>`;
}

// Inhalt einer Kachel (aufgeklappt) in ein Element schreiben: eigene Darstellung oder Zeilen
function fillContent(t, el) {
  if (typeof t.render === 'function') { el.innerHTML = ''; t.render(el); }
  else el.innerHTML = rows(t.rows);
}

export function paint(id) {
  const t = byId[id], el = document.getElementById('tile-' + id);
  if (!t || !el) return;
  el.dataset.state = t.state;
  el.querySelector('.label .long').textContent = t.title;
  const tag = el.querySelector('.tag');
  tag.hidden = t.state !== 'off'; tag.textContent = 'später';
  el.querySelector('.glyph').innerHTML = t.glyph || '';
  const mEl = el.querySelector('.metric');
  mEl.classList.toggle('trend-up', t.trend === 'up');
  mEl.classList.toggle('trend-down', t.trend === 'down');
  el.querySelector('.m-long').textContent = t.m;
  mEl.dataset.len = String(t.m).length > 13 ? 'long' : 'short';
  el.querySelector('.m-short').textContent = t.ms ?? t.m;
  el.querySelector('.teaser').textContent = t.x;
  el.querySelector('.head').setAttribute('aria-label', `${t.title}: ${t.m}`);
  // Aufgeklappten Inhalt nur neu zeichnen, wenn er sichtbar ist (schont Eingaben in Formularen)
  if (active === id) fillContent(t, el.querySelector('.content'));
  if (open === id) showSheet(id);
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
  document.getElementById('s-label').innerHTML = icon(t.icon) + esc(t.title);
  document.getElementById('s-metric').textContent = t.m;
  document.getElementById('s-teaser').textContent = t.x;
  fillContent(t, document.getElementById('s-content'));
  document.getElementById('s-pos').textContent = `${i + 1} / ${n}`;
  document.getElementById('s-prev').textContent = '‹ ' + byId[ORDER[(i - 1 + n) % n]].short;
  document.getElementById('s-next').textContent = byId[ORDER[(i + 1) % n]].short + ' ›';
  sheet.classList.add('open');
}
function hideSheet() { open = null; sheet.classList.remove('open'); }
function step(d) { const n = ORDER.length; showSheet(ORDER[(ORDER.indexOf(open) + d + n) % n]); }

export function initBoard() {
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
