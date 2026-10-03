// Oberfläche „Abreißblock“ (Phase 1b, Entscheidungen 03.10.2026 – docs/konzept/plan-neuausrichtung.md):
// vier Bereiche Heute · Wetter · Kalender · Mehr (am Handy unten, am Rechner oben), jeder mit Untertabs; jeder Untertab hat die ganze Fläche.
// Untertabs mit mehreren Teilen (z. B. Wissen: Wort · Land · An diesem Tag) haben im Feld einen Umschalter.
// Die Anbieter melden ihren Stand wie bisher über set(id, patch) – hier entsteht daraus der Bereich (früher core/board.js).
// Adresse: #bereich/untertab/teil (z. B. #wetter/radar); ohne Adresse öffnet DAILY immer mit „Heute“. Die Seite scrollt nie.
import { esc, icon } from './util.js';
import { erweiterungen } from './ansichten.js';
import { listeHtml, krZeilen } from './mini-reiter.js';
import { versionText } from './version.js';

export const BEREICHE = [
  { id: 'heute', name: 'Heute', icon: 'cal', kachel: 'heute' },
  { id: 'wetter', name: 'Wetter', icon: 'sun', kachel: 'weather' },
  { id: 'kalender', name: 'Kalender', icon: 'moon', kachel: 'kalender' },
  { id: 'mehr', name: 'Mehr', icon: 'list', kachel: 'mehr' }
];
// welcher Anbieter (set-ID) welchen Bereich füllt
const BEREICH_VON = { heute: 'heute', weather: 'wetter', kalender: 'kalender', links: 'mehr', gemerkt: 'mehr', tools: 'mehr' };
// kürzere Namen für Untertabs, die sonst am Handy nicht nebeneinander passen
const KURZNAME = { frei: 'Feiertage', namen: 'Namenstage' };

// „Über DAILY“: Datenquellen, Impressum, Datenschutz (öffnen die bisherigen Dialoge) und die Version
export const ueberHtml = version => '<div class="ab-ueber"><p class="ab-text">DAILY – dein digitaler Abreißkalender. Jeden Tag ein neues Blatt zum Mitmachen.</p>' +
  '<div class="ab-ueber-knoepfe"><button type="button" class="ab-knopf" data-doc="quellen">Datenquellen</button>' +
  '<button type="button" class="ab-knopf" data-doc="impressum">Impressum</button><button type="button" class="ab-knopf" data-doc="datenschutz">Datenschutz</button></div>' +
  `<p class="ab-meta">${esc(version)}</p></div>`;

// Untertabs eines Bereichs aus dem Stand der Anbieter (rein, testbar). T: { id → Stand }, privat: privater Betrieb (Tools)
export function untertabsVon(bereich, T, { privat = false, version = '' } = {}) {
  const k = id => (T[id] && T[id].kleinReiter) || [];
  const kurz = r => (KURZNAME[r.id] ? { ...r, name: KURZNAME[r.id] } : r);
  switch (bereich) {
    case 'heute': return k('heute');
    case 'wetter': return k('weather').map(kurz);
    case 'kalender': return k('kalender').filter(r => r.id !== 'termine').map(kurz);   // Termine sind seit 0.47.0 nicht mehr in der Oberfläche
    case 'mehr': return [
      { id: 'seiten', name: 'Meine Seiten', teile: k('links'), html: '<p class="ab-meta">Wird geladen …</p>' },
      ...(T.gemerkt ? [T.gemerkt] : []),
      ...(privat && T.tools ? [{ id: 'tools', name: 'Tools', teile: k('tools') }] : []),
      { id: 'ueber', name: 'Über DAILY', html: ueberHtml(version) }
    ];
    default: return [];
  }
}

// Adresse #bereich/untertab/teil lesen (rein, testbar) – unbekannter Bereich → Heute
export function adresseLesen(hash) {
  const [b, u, t] = String(hash || '').replace(/^#\/?/, '').split('/').map(x => decodeURIComponent(x || ''));
  return { bereich: BEREICHE.some(x => x.id === b) ? b : 'heute', unter: u || null, teil: t || null };
}

// gewählter Eintrag: gemerkte Wahl > Start > erster
const waehle = (liste, wahl, start) => liste.find(x => x.id === wahl) || liste.find(x => x.id === start) || liste[0];

// ---- Zustand ----
const T = {};
const opts = { privat: false };
let aktiv = 'heute';
const wahlUnter = {}, wahlTeil = {};   // je Bereich bzw. Bereich/Untertab
let blatt = null, tabs = null;

export const stand = id => T[id] || null;

function inhaltHtml(r, mitKopf) {
  const liste = r.liste && r.liste.length ? `<div class="kr-liste">${listeHtml(r.liste)}</div>` : (r.html || '');
  return (mitKopf && r.kopf ? `<div class="ab-zkopf">${r.kopf}</div>` : '') + liste + (r.unten ? `<div class="kr-unten">${r.unten}</div>` : '');
}

function bereichHtml(b) {
  const quelle = T[b.kachel] || {};
  const liste = untertabsVon(b.id, T, { privat: opts.privat, version: versionText() });
  const kopf = b.id === 'heute' ? (quelle.bereichKopf || '')
    : b.id === 'wetter' && quelle.kopf ? `<div class="ab-wkopf">${quelle.kopf}${quelle.tag ? ` <span class="tag">${esc(quelle.tag)}</span>` : ''}</div>` : '';
  if (!liste.length) {
    const text = quelle.state === 'error' ? 'Gerade nicht erreichbar – DAILY versucht es gleich wieder.' : 'Wird geladen …';
    return `<div class="ab-kopf">${kopf}</div><div class="kr-feld ab-feld"><p class="ab-meta">${text}</p></div>`;
  }
  const r = waehle(liste, wahlUnter[b.id], quelle.startReiter);
  const unter = `<div class="ab-unter" role="tablist" aria-label="${esc(b.name)}">${liste.map(x =>
    `<button type="button" role="tab" data-unter="${esc(x.id)}" aria-selected="${x === r}">${esc(x.name)}</button>`).join('')}</div>`;
  let feld;
  if (r.teile && r.teile.length) {
    const t = waehle(r.teile, wahlTeil[b.id + '/' + r.id]);
    feld = `<div class="ab-teile" role="tablist" aria-label="${esc(r.name)}">${r.teile.map(x =>
      `<button type="button" role="tab" data-teil="${esc(x.id)}" aria-selected="${x === t}">${esc(x.name)}</button>`).join('')}</div>` + inhaltHtml(t, false);
  } else feld = inhaltHtml(r, b.id !== 'heute');
  const info = (quelle.info || []).filter(Boolean).join(' · ');
  return `<div class="ab-kopf">${kopf}</div>${unter}<div class="kr-feld ab-feld" role="tabpanel" data-unter-feld="${esc(r.id)}">${feld}</div>` +
    (info ? `<div class="ab-info" title="${esc(info)}">${esc(info)}</div>` : '');
}

function zeichne(bereich) {
  const b = BEREICHE.find(x => x.id === bereich), el = blatt && blatt.querySelector(`[data-bereich="${bereich}"]`);
  if (!b || !el) return;
  el.dataset.state = (T[b.kachel] || {}).state || 'loading';
  el.innerHTML = bereichHtml(b);
  nachZeichnen(el);
}
// Zeilen, die nicht ganz passen, ausblenden (keine halben Zeilen, kein Scrollen): Listen im Feld und Ereignisse unter „Heute“
function zeilenKuerzen(el) {
  krZeilen(el);
  el.querySelectorAll('.ab-inhalt').forEach(box => {
    const z = [...box.querySelectorAll('.kr-z')];
    z.forEach(x => { x.hidden = false; });
    const unten = box.getBoundingClientRect().bottom;
    z.forEach(x => { if (x.getBoundingClientRect().bottom > unten + 0.5) x.hidden = true; });
  });
}
function nachZeichnen(el) {
  if (el.hidden) return;
  requestAnimationFrame(() => zeilenKuerzen(el));
  erweiterungen().forEach(x => x.nachZeichnen && x.nachZeichnen(el));
}
function tabsZeichnen() {
  if (!tabs) return;
  const unwetter = T.weather && T.weather.unwetter;
  tabs.innerHTML = BEREICHE.map(b => `<button type="button" data-bereich-tab="${b.id}" aria-current="${b.id === aktiv ? 'page' : 'false'}"${b.id === 'wetter' && unwetter ? ' data-hinweis="1" title="Amtliche Unwetterwarnung"' : ''}>` +
    `${icon(b.icon)}<span>${esc(b.name)}</span></button>`).join('');
}
function adresseSchreiben() {
  const u = wahlUnter[aktiv], t = u && wahlTeil[aktiv + '/' + u];
  const neu = aktiv === 'heute' && !u ? '' : '#' + [aktiv, u, t].filter(Boolean).map(encodeURIComponent).join('/');
  if (location.hash !== neu) history.replaceState(null, '', neu || location.pathname + location.search);
}

// Bereich (und optional Untertab/Teil) zeigen – auch für Anbieter, z. B. „Gemerkt“ öffnet den Tag unter „Heute“
export function zeige(bereich, unter = null, teil = null) {
  if (!BEREICHE.some(b => b.id === bereich)) bereich = 'heute';
  aktiv = bereich;
  if (unter) wahlUnter[bereich] = unter;
  if (unter && teil) wahlTeil[bereich + '/' + unter] = teil;
  blatt.querySelectorAll('[data-bereich]').forEach(s => { s.hidden = s.dataset.bereich !== bereich; });
  blatt.dataset.aktiv = bereich;
  tabsZeichnen();
  zeichne(bereich);
  adresseSchreiben();
}

// Anbieter melden neue Werte hierüber (wie früher board.js → set)
export function set(id, patch) {
  T[id] = Object.assign(T[id] || { id, state: 'loading' }, patch);
  if (patch && patch.springe) { wahlUnter[BEREICH_VON[id]] = patch.springe; delete T[id].springe; }   // z. B. Unwetter → „Hinweise“
  if (id === 'weather') tabsZeichnen();
  const b = BEREICH_VON[id];
  if (b && blatt) zeichne(b);
}

export function initOberflaeche({ privat = false } = {}) {
  opts.privat = privat;
  blatt = document.getElementById('ab-blatt');
  tabs = document.getElementById('ab-tabs');
  blatt.insertAdjacentHTML('beforeend', BEREICHE.map(b => `<section class="tile ab-bereich" id="tile-${b.kachel}" data-bereich="${b.id}" aria-label="${esc(b.name)}" hidden></section>`).join(''));
  const a = adresseLesen(location.hash);
  if (a.unter) wahlUnter[a.bereich] = a.unter;
  if (a.unter && a.teil) wahlTeil[a.bereich + '/' + a.unter] = a.teil;
  zeige(a.bereich);

  tabs.addEventListener('click', e => { const b = e.target.closest('[data-bereich-tab]'); if (b) zeige(b.dataset.bereichTab); });
  blatt.addEventListener('click', e => {
    const u = e.target.closest('[data-unter]'), t = e.target.closest('[data-teil]');
    if (!u && !t) return;
    if (u) wahlUnter[aktiv] = u.dataset.unter;
    else { const feld = t.closest('[data-unter-feld]'); wahlTeil[aktiv + '/' + feld.dataset.unterFeld] = t.dataset.teil; }
    zeichne(aktiv); adresseSchreiben();
  });
  addEventListener('hashchange', () => { const x = adresseLesen(location.hash); zeige(x.bereich, x.unter, x.teil); });
  // Diagramme: Spalte überfahren (Werte im Zeitpunkt-Block), Größe neu berechnen; Zeilen, die nicht passen, ausblenden
  const zeiger = e => erweiterungen().forEach(x => x.zeiger && x.zeiger(e, blatt));
  blatt.addEventListener('pointermove', zeiger);
  blatt.addEventListener('pointerleave', zeiger);
  addEventListener('resize', () => requestAnimationFrame(() => {
    erweiterungen().forEach(x => x.groesse && x.groesse(blatt));
    const el = blatt.querySelector(`[data-bereich="${aktiv}"]`); if (el) zeilenKuerzen(el);
  }));
}
