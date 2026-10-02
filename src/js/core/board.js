// Das Kachelraster: Aufbau, Raster nach Kachelzahl und Fläche, Zeichnen und Aktualisieren einzelner Kacheln.
// Bedienung nur über Mini-Reiter in der kleinen Kachel (core/mini-reiter.js) und das Zahnrad (core/einstellungsfenster.js) –
// seit 0.45.0 kein Aufklappen und kein Handy-Vollbild mehr (Review M4 Schritt 3).
import { TILES, byId, raster } from './tiles.js';
import { esc, icon } from './util.js';
import { ansichtVon, erweiterungen } from './ansichten.js';
import { countClick, kachelOptSpeichern } from './store.js';
import { hatReiter, gewaehlt, krHtml, krZeilen, listeHtml } from './mini-reiter.js';
import { einstellungenOeffnen } from './einstellungsfenster.js';

const grid = document.getElementById('grid');

function tileHTML(t) {
  return `<article class="tile" data-state="${t.state}" id="tile-${t.id}">
    <div class="head">
      <span class="label">${icon(t.icon)}<span class="lglyph" hidden></span><span class="long"></span><span class="kopf"></span><span class="short">${esc(t.short)}</span><span class="tag" hidden></span></span>
      <span class="metric"><span class="glyph"></span><span class="m-long"></span><span class="m-short"></span></span>
      <span class="teaser"></span>
      <span class="mini" aria-hidden="true"></span>
    </div>
    <div class="kr" hidden></div>
    <button class="info-knopf" type="button" data-info aria-label="Info zu ${esc(t.name || t.title)}" aria-expanded="false">i</button>
    <div class="info-feld" role="tooltip" hidden></div>
  </article>`;
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
  mEl.toggleAttribute('data-leer', !t.m && !t.glyph);   // keine große Zeile
  mEl.dataset.len = String(t.m).length > 13 ? 'long' : 'short';
  el.querySelector('.m-short').textContent = t.ms ?? t.m;
  // Unterzeile: als Text und – falls die Kachel eine Liste liefert – als Liste untereinander
  const tz = el.querySelector('.teaser');
  // zeileIcon: das Symbol (z. B. Wetterlage) steht vor dem Text statt im Kopf
  tz.innerHTML = `<span class="t-text">${t.zeileIcon && t.lglyph ? `<span class="t-icon" title="${esc(t.lglyphTip || '')}">${t.lglyph}</span>` : ''}${esc(t.x)}</span>` +
    (t.liste && t.liste.length ? `<span class="t-liste">${listeHtml(t.liste)}</span>` : '');
  tz.classList.toggle('mit-liste', !!(t.liste && t.liste.length));
  // Eigene Ansicht der Kachel (core/ansichten.js, z. B. ansichten/wetter.js): zusätzlicher Inhalt und Klassen der Unterzeile
  const av = ansichtVon(id), extra = av && av.teaser ? av.teaser(t) : null;
  (tz.dataset.klassen || '').split(' ').filter(Boolean).forEach(k => tz.classList.remove(k));
  if (extra) { tz.insertAdjacentHTML('beforeend', extra.html || ''); (extra.klassen || []).forEach(k => tz.classList.add(k)); }
  tz.dataset.klassen = extra ? (extra.klassen || []).join(' ') : '';
  // Kopf der kleinen Kachel: nur Inhalt (z. B. Ort und Temperaturen, KW) – der Name erscheint beim Überfahren
  el.querySelector('.label .kopf').innerHTML = t.kopf || '';
  // Info-Feld hinter dem (i) unten rechts: Name, Quellen, Stand …
  el.querySelector('.info-feld').innerHTML = [t.hover || t.name || t.title, ...(t.info || [])].map(z => `<span>${esc(z)}</span>`).join('');
  el.querySelector('.mini').innerHTML = t.chart || '';
  // Mini-Reiter: Kopf des gewählten Reiters, Spalte mit Symbolen, Inhalt
  const kr = el.querySelector('.kr'), mitKr = hatReiter(t);
  el.classList.toggle('mit-kr', mitKr); kr.hidden = !mitKr;
  if (mitKr) {
    kr.innerHTML = krHtml(t);
    const r = gewaehlt(t);
    if (r.kopf != null) el.querySelector('.label .kopf').innerHTML = r.kopf;
    requestAnimationFrame(() => krZeilen(el));
  } else kr.innerHTML = '';
  erweiterungen().forEach(x => x.nachZeichnen && x.nachZeichnen(el));
  el.querySelector('.head').setAttribute('aria-label', [t.title, t.lglyphTip, t.m].filter(Boolean).join(': '));
}

// Anbieter melden neue Werte hierüber
export function set(id, patch) {
  const t = byId[id]; if (!t) return;
  Object.assign(t, patch);
  paint(id);
}

// Raster: Spalten × Zeilen aus Kachelzahl und Fläche (tiles.js → raster); übrige Felder = „Freier Platz“
let COLS = 1, ROWS = 1;
const HANDY = matchMedia('(max-width:760px),(max-height:520px)');
function rasterNeu() {
  const abstand = parseFloat(getComputedStyle(grid).rowGap) || 10;
  const r = raster(TILES.length, grid.clientWidth, grid.clientHeight, abstand, HANDY.matches ? 1 : 1.4);
  if (r.cols === COLS && r.rows === ROWS && grid.querySelectorAll('.tile.free').length === COLS * ROWS - TILES.length) return;
  COLS = r.cols; ROWS = r.rows;
  grid.querySelectorAll('.tile.free').forEach(x => x.remove());
  for (let c = TILES.length; c < COLS * ROWS; c++) grid.insertAdjacentHTML('beforeend', `<div class="tile free" id="cell-${c}" aria-hidden="true"><span>Freier Platz</span></div>`);
  grid.dataset.raster = `${COLS}x${ROWS}`;
  grid.style.gridTemplateColumns = `repeat(${COLS},minmax(0,1fr))`;
  grid.style.gridTemplateRows = `repeat(${ROWS},minmax(0,1fr))`;
}

export function initBoard() {
  const zeiger = e => erweiterungen().forEach(x => x.zeiger && x.zeiger(e, grid));
  grid.addEventListener('pointermove', zeiger);
  grid.addEventListener('pointerleave', zeiger);
  addEventListener('resize', () => requestAnimationFrame(() => {
    rasterNeu(); erweiterungen().forEach(x => x.groesse && x.groesse(grid));
    grid.querySelectorAll('.tile.mit-kr').forEach(krZeilen);
  }));
  grid.innerHTML = TILES.map(tileHTML).join('');
  TILES.forEach(t => paint(t.id));
  rasterNeu();
  erweiterungen().forEach(x => x.groesse && x.groesse(grid));

  // (i): Überfahren zeigt das Info-Feld, Klick schaltet es fest ein/aus
  const info = (knopf, an) => { const f = knopf.nextElementSibling; f.hidden = !an; knopf.setAttribute('aria-expanded', String(an)); };
  grid.addEventListener('pointerover', e => { const k = e.target.closest('[data-info]'); if (k) info(k, true); });
  grid.addEventListener('pointerout', e => { const k = e.target.closest('[data-info]'); if (k && !k.classList.contains('fest')) info(k, false); });
  document.addEventListener('click', e => {
    const k = e.target.closest('[data-info]');
    grid.querySelectorAll('[data-info].fest').forEach(x => { if (x !== k) { x.classList.remove('fest'); info(x, false); } });
    if (k) { k.classList.toggle('fest'); info(k, k.classList.contains('fest')); }
  });
  // Mini-Reiter: Wechsel sofort und gespeichert (zählt für „Deine Nutzung“); Zahnrad öffnet das Einstellungsfenster
  grid.addEventListener('click', e => {
    const kr = e.target.closest('[data-kr]'), ke = e.target.closest('[data-kr-einst]');
    if (!kr && !ke) return;
    const id = e.target.closest('.tile').id.replace(/^tile-/, '');
    if (ke) { einstellungenOeffnen(id); return; }
    countClick(id); document.dispatchEvent(new CustomEvent('daily:click', { detail: id }));
    kachelOptSpeichern(id, { reiter: kr.dataset.kr });
    paint(id);
  });
}
