// Oberfläche „Abreißblock“ (seit 0.47.0) mit drei Ebenen Bereich → Rubrik → Thema (seit 0.49.0, docs/konzept/themen.md):
// je höchstens 6 Einträge, am Rechner alle drei oben, am Handy alle drei unten (ganz unten der Bereich). Die Themen-Zeile erscheint nur,
// wenn eine Rubrik mehrere Themen hat. Im Code heißen Rubriken „Untertabs“ (kleinReiter) und Themen „teile“.
// Die Anbieter melden ihren Stand über set(id, patch) – hier entsteht daraus der Bereich.
// Adresse: #bereich/rubrik/thema (z. B. #wetter/jetzt/m7); ohne Adresse öffnet DAILY immer mit „Heute“. Die Seite scrollt nie.
import { esc, icon } from './util.js';
import { erweiterungen } from './ansichten.js';
import { listeHtml, krZeilen } from './mini-reiter.js';
import { versionText } from './version.js';

// Album folgt in Phase 3 (bis dahin ausgeblendet)
export const BEREICHE = [
  { id: 'heute', name: 'Heute', icon: 'cal', kachel: 'heute' },
  { id: 'entdecken', name: 'Entdecken', icon: 'book', kachel: 'entdecken' },
  { id: 'wetter', name: 'Wetter', icon: 'sun', kachel: 'weather' },
  { id: 'kalender', name: 'Kalender', icon: 'moon', kachel: 'kalender' },
  { id: 'mehr', name: 'Mehr', icon: 'list', kachel: 'mehr' }
];
// welcher Anbieter (set-ID) welchen Bereich füllt
const BEREICH_VON = { heute: 'heute', entdecken: 'entdecken', weather: 'wetter', himmel: 'wetter', kalender: 'kalender', alltag: 'mehr', links: 'mehr', gemerkt: 'mehr', tools: 'mehr' };
// kürzere Namen, die am Handy nebeneinander passen
const KURZNAME = { namen: 'Namenstage', meine: 'Meine', alle: 'Alle' };

// „Über DAILY“: Datenquellen, Impressum, Datenschutz (öffnen die bisherigen Dialoge) und die Version
export const ueberHtml = version => '<div class="ab-ueber"><p class="ab-text">DAILY – dein digitaler Abreißkalender. Jeden Tag ein neues Blatt zum Mitmachen.</p>' +
  '<div class="ab-ueber-knoepfe"><button type="button" class="ab-knopf" data-doc="quellen">Datenquellen</button>' +
  '<button type="button" class="ab-knopf" data-doc="impressum">Impressum</button><button type="button" class="ab-knopf" data-doc="datenschutz">Datenschutz</button></div>' +
  `<p class="ab-meta">${esc(version)}</p></div>`;

// Rubriken eines Bereichs aus dem Stand der Anbieter (rein, testbar). T: { id → Stand }, privat: privater Betrieb (Tools)
export function untertabsVon(bereich, T, { privat = false, version = '' } = {}) {
  const k = id => (T[id] && T[id].kleinReiter) || [];
  const kurz = r => (KURZNAME[r.id] ? { ...r, name: KURZNAME[r.id] } : r);
  switch (bereich) {
    case 'heute': return k('heute');
    case 'entdecken': return k('entdecken');
    case 'wetter': return [...k('weather'), ...k('himmel')].map(kurz);   // Himmel kommt aus dem Kalender (Dienst „himmel“)
    case 'kalender': return k('kalender').filter(r => r.id !== 'termine' && r.id !== 'himmel').map(kurz);   // Himmel steht unter Wetter
    case 'mehr': return [
      ...(T.alltag ? [T.alltag] : []),
      { id: 'seiten', name: 'Seiten', titel: 'Meine Seiten', teile: k('links').map(kurz), html: '<p class="ab-meta">Wird geladen …</p>' },
      ...(T.gemerkt ? [T.gemerkt] : []),
      ...(privat && T.tools ? [{ id: 'tools', name: 'Tools', teile: k('tools').map(kurz) }] : []),
      { id: 'ueber', name: 'Über', titel: 'Über DAILY', html: ueberHtml(version) }
    ];
    default: return [];
  }
}

// Adresse #bereich/untertab/teil lesen (rein, testbar) – unbekannter Bereich → Heute
export function adresseLesen(hash) {
  const [b, u, t] = String(hash || '').replace(/^#\/?/, '').split('/').map(x => decodeURIComponent(x || ''));
  return { bereich: BEREICHE.some(x => x.id === b) ? b : 'heute', unter: u || null, teil: t || null };
}
// Themen-Zeile nur ab zwei Themen; ein einzelnes Thema zeigt seinen Inhalt direkt
const themenVon = r => (r.teile && r.teile.length > 1 ? r.teile : null);

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
    `<button type="button" role="tab" data-unter="${esc(x.id)}" aria-selected="${x === r}"${x.titel ? ` title="${esc(x.titel)}" aria-label="${esc(x.titel)}"` : ''}>${esc(x.name)}</button>`).join('')}</div>`;
  const themen = themenVon(r), einzeln = r.teile && r.teile.length === 1 ? r.teile[0] : null;
  let feld, zeile = '';
  if (themen) {
    const t = waehle(themen, wahlTeil[b.id + '/' + r.id], r.startTeil);
    zeile = `<div class="ab-themen" role="tablist" aria-label="${esc(r.name)}" data-rubrik="${esc(r.id)}">${themen.map(x =>
      `<button type="button" role="tab" data-teil="${esc(x.id)}" aria-selected="${x === t}">${esc(x.name)}</button>`).join('')}</div>`;
    feld = inhaltHtml(t, false);
  } else feld = einzeln ? inhaltHtml(einzeln, false) : r.teile && !r.teile.length ? (r.html || '') : inhaltHtml(r, b.id !== 'heute' && b.id !== 'entdecken');
  const info = (quelle.info || []).filter(Boolean).join(' · ');
  // Reihenfolge im Gerüst: Kopf, Rubriken, Themen, Feld, Info – wo was steht (oben am Rechner, unten am Handy), regelt css/abreissblock.css
  return `<div class="ab-kopf">${kopf}</div>${unter}${zeile}<div class="kr-feld ab-feld${zeile ? ' mit-themen' : ''}" role="tabpanel">${feld}</div>` +
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
  document.dispatchEvent(new CustomEvent('daily:bereich', { detail: bereich }));   // main.js lädt, was dieser Bereich braucht (1c)
}
export const aktiverBereich = () => aktiv;

// Welche Anbieter jetzt laden sollen (rein, testbar; seit 0.48.0 „nur Sichtbares laden“): die des sichtbaren Bereichs und die mit
// bereich 'immer' (z. B. Wetterhinweise für den Unwetter-Punkt) – jeweils nur, wenn ihr letzter Lauf älter ist als maxAlter(p).
// lastRun: Map Anbieter-ID → Zeitpunkt; nie gelaufen = sofort fällig.
// p.bereich darf auch eine Liste sein (Tagesinhalte gehören zu Heute, Entdecken und Mehr).
export function faelligeAnbieter(anbieter, aktivBereich, lastRun, jetzt = Date.now(), maxAlter = p => p.every) {
  return anbieter.filter(p => [].concat(p.bereich).some(b => b === 'immer' || b === aktivBereich) && jetzt - (lastRun.get(p.id) || 0) >= maxAlter(p));
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
    else {
      const rubrik = t.closest('[data-rubrik]').dataset.rubrik;
      wahlTeil[aktiv + '/' + rubrik] = t.dataset.teil;
      document.dispatchEvent(new CustomEvent('daily:thema', { detail: { bereich: aktiv, rubrik, thema: t.dataset.teil } }));   // z. B. Wetter merkt sich den Zeitraum
    }
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
