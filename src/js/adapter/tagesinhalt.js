// Adapter „tagesinhalt“: macht aus dem Vertrag tagesinhalt v1 (und „andiesemtag“) die Bereiche „Heute“ (Datumsblock mit Blättern ‹ ›,
// Rätsel zum Mitmachen, Lachen), „Entdecken“ und „Mehr → Alltag“ – je Art eine Fläche mit „☆ Merken“, dazu „Gemerkt“ unter Mehr.
// Gemerktes speichert eine Kopie des Inhalts (bleibt erhalten, auch wenn der Vorrat wechselt). Rein, ohne DOM – testbar.
import { esc } from '../core/util.js';
import { kaestchen } from '../core/teilen.js';

export const ART = {
  raetsel: { name: 'Rätsel' }, witz: { name: 'Witz' }, film: { name: 'Film' }, wort: { name: 'Wort' }, sprichwort: { name: 'Sprichwort' }, land: { name: 'Land' },
  geschichte: { name: 'An diesem Tag' }, rezept: { name: 'Rezept' }, gesundheit: { name: 'Gesundheit' }, tech: { name: 'Tech' }, beziehung: { name: 'Beziehung' },
  spartipp: { name: 'Spartipp' }
};
// „Do 1.10.“ / kurz „1.10.“
export const datumText = (d, kurz = false) => {
  const t = new Date(d + 'T12:00:00Z');
  return `${kurz ? '' : t.toLocaleDateString('de-DE', { weekday: 'short', timeZone: 'UTC' }).replace('.', '') + ' '}${t.getUTCDate()}.${t.getUTCMonth() + 1}.`;
};
export const tagPlus = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
export const favKey = (art, datum) => `${art}|${datum}`;
// Jahr eines Ereignisses: negativ = vor Christus
export const jahrText = j => (j < 0 ? `${-j} v. Chr.` : String(j));
// Antwort eines Zusatz-Dienstes (z. B. „andiesemtag“) als weitere Art in die Inhalte des Tags (null: nicht erreichbar)
export const mitZusatz = (env, art, z) => (env && env.daten ? { ...env, daten: { ...env.daten, inhalt: { ...env.daten.inhalt, [art]: z && z.daten ? z.daten : null } } } : env);
// Kurzfassung einer Art für „Gemerkt“: kurz (Zeile), text (vollständig, beim Überfahren); null, wenn es die Art an dem Tag nicht gibt
export function artInhalt(art, inhalt) {
  const i = inhalt || {};
  switch (art) {
    case 'raetsel': { const r = i.raetsel; return r ? { kurz: r.frage, text: `${r.frage} – Lösung: ${r.loesung}` } : null; }
    case 'witz': return i.witz ? { kurz: i.witz, text: i.witz } : null;
    case 'film': { const f = i.film; if (!f) return null;
      const kopf = `${f.titel}${f.jahr ? ` (${f.jahr})` : ''}${f.genre ? ' · ' + f.genre : ''}`;
      return { kurz: kopf, text: `${kopf}. ${f.text || ''}`.trim() }; }
    case 'wort': { const w = i.wort; return w ? { kurz: w.wort, text: `${w.wort}: ${w.bedeutung}${w.herkunft ? ` (${w.herkunft})` : ''}` } : null; }
    case 'sprichwort': return i.sprichwort ? { kurz: i.sprichwort, text: `Sprichwort: ${i.sprichwort}` } : null;
    case 'land': { const l = i.land; if (!l) return null;
      const daten = [l.hauptstadt && `Hauptstadt ${l.hauptstadt}`, l.sprache, l.waehrung, l.gericht && `typisch: ${l.gericht}`].filter(Boolean).join(' · ');
      return { kurz: l.name, text: `${l.name}: ${daten}. ${l.fakt || ''}`.trim() }; }
    case 'rezept': { const r = i.rezept; if (!r) return null;
      const info = [r.minuten ? `${r.minuten} Min.` : '', 'für 2', r.vegetarisch ? 'vegetarisch' : ''].filter(Boolean).join(' · ');
      return { kurz: r.name, text: `${r.name} (${info}). Zutaten: ${(r.zutaten || []).join(', ')}. ${r.zubereitung || ''}`.trim() }; }
    case 'gesundheit': case 'beziehung': case 'spartipp': { const t = i[art]; return t ? { kurz: t.kurz || t.text, text: t.text } : null; }
    case 'geschichte': { const g = i.geschichte; if (!g || !g.ereignisse || !g.ereignisse.length) return null;
      const zeile = e => `${jahrText(e.jahr)}: ${e.text}`;
      return { kurz: zeile(g.ereignisse[0]), text: g.ereignisse.map(zeile).join(' · ') }; }
    case 'tech': { const t = i.tech; return t ? { kurz: t.kategorie ? `${t.kategorie}: ${t.text}` : t.text, text: t.text } : null; }
    default: return null;
  }
}

// Gemerktes als Kopie: { art, datum, kurz, text }
export const favEintrag = (art, env) => { const a = artInhalt(art, env.daten.inhalt); return a ? { art, datum: env.daten.datum, kurz: a.kurz, text: a.text } : null; };

// ---- Oberfläche (seit 0.49.0, Schritt 1d, docs/konzept/themen.md): Bereich → Rubrik → Thema ----
// Tagesinhalte erscheinen in drei Bereichen: „Heute“ (Mitmachen, mit ‹ ›), „Entdecken“ und „Mehr → Alltag“ (immer heute).
// Rubriken mit mehreren Arten haben Themen (Ebene 3). Weitere Rubriken laut themen.md kommen, sobald es Inhalte gibt.
export const HEUTE_RUBRIKEN = [
  { id: 'raetsel', name: 'Rätsel', arten: ['raetsel'] },
  { id: 'lachen', name: 'Lachen', arten: ['witz'] }
];
export const ENTDECKEN_RUBRIKEN = [
  { id: 'sprache', name: 'Sprache', arten: ['wort', 'sprichwort'] },
  { id: 'zeitreise', name: 'Zeitreise', arten: ['geschichte'] },
  { id: 'welt', name: 'Welt', arten: ['land'] },
  { id: 'kultur', name: 'Kultur', arten: ['film'] }
];
export const ALLTAG_ARTEN = ['rezept', 'gesundheit', 'tech', 'beziehung', 'spartipp'];
// Wo steht eine Art? { bereich, rubrik, thema } – thema nur, wenn die Rubrik mehrere Arten hat (für „Gemerkt“)
export function ortVon(art) {
  if (ALLTAG_ARTEN.includes(art)) return { bereich: 'mehr', rubrik: 'alltag', thema: art };
  for (const [bereich, liste] of [['heute', HEUTE_RUBRIKEN], ['entdecken', ENTDECKEN_RUBRIKEN]]) {
    const r = liste.find(x => x.arten.includes(art));
    if (r) return { bereich, rubrik: r.id, thema: r.arten.length > 1 ? art : null };
  }
  return { bereich: 'heute', rubrik: HEUTE_RUBRIKEN[0].id, thema: null };
}
// kurze Namen für den Umschalter im Feld, Überschrift über dem Inhalt
const KURZ = { wort: 'Wort', sprichwort: 'Sprichwort', land: 'Land', geschichte: 'An diesem Tag', rezept: 'Rezept', gesundheit: 'Gesundheit', tech: 'Tech', beziehung: 'Beziehung', spartipp: 'Spartipp' };
export const RUBRIK = { raetsel: 'Rätsel des Tages', witz: 'Witz des Tages', film: 'Film des Tages', wort: 'Wort des Tages', sprichwort: 'Sprichwort des Tages', land: 'Land des Tages', geschichte: 'An diesem Tag',
  rezept: 'Rezept des Tages', gesundheit: 'Gesundheit', tech: 'Tech-Tipp', beziehung: 'Für euch zwei', spartipp: 'Spartipp' };
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
// Kalenderwoche nach ISO 8601
export function kw(d) {
  const t = new Date(d + 'T12:00:00Z'), tag = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - tag + 3);
  const erster = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((t - erster) / 864e5 - 3 + ((erster.getUTCDay() + 6) % 7)) / 7);
}

// Datumsblock des Abreißkalenders: große Tageszahl, Wochentag, Monat; ‹ › blättert, ältere Tage sind „nachgeholt“
export function datumsKopf({ datum, erster, heute }) {
  const t = new Date(datum + 'T12:00:00Z'), alt = datum < heute;
  return `<div class="ab-datum${alt ? ' ab-alt' : ''}">` +
    `<span class="ab-tagzahl">${t.getUTCDate()}</span>` +
    `<span class="ab-datum-text"><span class="ab-wtag">${WTAGE[t.getUTCDay()]}</span><span class="ab-monat">${MONATE[t.getUTCMonth()]} ${t.getUTCFullYear()}</span>` +
    (alt ? `<span class="ab-zusatz">nachgeholt · <button type="button" class="ab-link" data-ti="heute">zu heute</button></span>` : `<span class="ab-zusatz">KW ${kw(datum)}</span>`) + '</span>' +
    `<span class="ab-blaettern"><button type="button" data-ti="zurueck" aria-label="Tag zurück" title="Tag zurück"${datum <= erster ? ' disabled' : ''}>‹</button>` +
    `<button type="button" data-ti="vor" aria-label="Tag vor" title="Tag vor"${datum >= heute ? ' disabled' : ''}>›</button></span></div>`;
}

// Antworten je Tag fest gemischt – für alle gleich (das Datum ist der Startwert), damit man über dasselbe Rätsel reden kann
export function mischen(liste, datum) {
  let h = 2166136261; for (const c of String(datum)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const zufall = () => { h = (h + 0x6D2B79F5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(zufall() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// Rätsel zum Mitmachen (seit 0.51.0): gibt es kurze Antwort und falsche Antworten?
export const mitmachRaetsel = r => !!(r && r.antwort && Array.isArray(r.falsch) && r.falsch.length);
const LEER_SPIEL = { versuche: [], tipps: 0, geloest: false, nachgeholt: false };
// Ergebnis-Zeile nach dem Lösen
export const raetselErgebnis = (r, s) => `${kaestchen(s.versuche, r.antwort)} ${s.versuche.length === 1 ? 'Auf Anhieb gelöst!' : `Gelöst im ${s.versuche.length}. Versuch`}` +
  `${s.tipps ? ` · 💡 ${s.tipps}` : ''}${s.nachgeholt ? ' · nachgeholt' : ''}`;
// Frage, vier Antworten (falsch gewählte rot und gesperrt), gezeigte Tipps; gelöst: Ergebnis und – wenn sie mehr sagt – die ganze Lösung
function raetselHtml(r, datum, s, p) {
  const fertig = s.geloest;
  const knoepfe = mischen([r.antwort, ...r.falsch], datum).map(a => {
    const gewaehlt = s.versuche.includes(a), richtig = a === r.antwort, zeig = gewaehlt || (fertig && richtig);
    return `<button type="button" class="ab-antwort${zeig ? (richtig ? ' ab-richtig' : ' ab-falsch') : ''}" data-ti="antwort" data-antwort="${esc(a)}"` +
      `${gewaehlt || fertig ? ' disabled' : ''}${zeig ? ` aria-label="${esc(a)} – ${richtig ? 'richtig' : 'falsch'}"` : ''}>${esc(a)}</button>`;
  }).join('');
  const mehr = r.loesung && r.loesung.replace(/\.$/, '') !== r.antwort;
  return p(r.frage, 'ab-gross ab-frage') + `<div class="ab-antworten">${knoepfe}</div>` +
    (fertig ? p(raetselErgebnis(r, s), 'ab-ergebnis') + (mehr ? p(r.loesung, 'ab-meta ab-erklaerung') : '')
      : (r.tipps || []).slice(0, s.tipps).map((t, i) => p('💡 ' + t, 'ab-hinweis' + (i ? ' ab-hinweis2' : ''))).join(''));
}

// Inhalt einer Art für die ganze Fläche (größer als in der Kachel). rezeptSeite: 1 = Zutaten, 2 = Zubereitung
// spiel: Spielstand des Rätsels an diesem Tag (core/spielstand.js), datum: der Tag (fürs Mischen)
export function flaecheHtml(art, inhalt, { loesung = false, rezeptSeite = 1, spiel = LEER_SPIEL, datum = '' } = {}) {
  const i = inhalt || {}, p = (t, k = 'ab-text') => `<p class="${k}">${esc(t)}</p>`;
  switch (art) {
    case 'raetsel': { const r = i.raetsel; if (!r) return null;
      if (mitmachRaetsel(r)) return raetselHtml(r, datum, spiel, p);
      return p(r.frage, 'ab-gross') + (loesung ? p('Lösung: ' + r.loesung, 'ab-loesung') : '<button type="button" class="ab-knopf" data-ti="loesung">Lösung zeigen</button>'); }
    case 'witz': return i.witz ? p(i.witz, 'ab-gross ab-witz') : null;
    case 'film': { const f = i.film; if (!f) return null;
      return p(f.titel, 'ab-titel') + p([f.jahr, f.genre].filter(Boolean).join(' · '), 'ab-meta') + (f.text ? p(f.text) : ''); }
    case 'wort': { const w = i.wort; if (!w) return null;
      const lang = w.wort.length > 15 ? ' ab-l3' : w.wort.length > 11 ? ' ab-l2' : '';   // lange Wörter kleiner (Fingerspitzengefühl)
      return p(w.wort, 'ab-wort' + lang) + p(w.bedeutung) + (w.herkunft ? p('Herkunft: ' + w.herkunft, 'ab-meta') : ''); }
    case 'sprichwort': return i.sprichwort ? p('„' + i.sprichwort + '“', 'ab-gross ab-spruch') : null;
    case 'land': { const l = i.land; if (!l) return null;
      const f = [['Hauptstadt', l.hauptstadt], ['Sprache', l.sprache], ['Währung', l.waehrung], ['Typisch', l.gericht]].filter(x => x[1]);
      return p(l.name, 'ab-titel') + `<dl class="ab-fakten">${f.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` + (l.fakt ? p(l.fakt) : ''); }
    case 'geschichte': { const g = i.geschichte; if (!g || !g.ereignisse || !g.ereignisse.length) return null;
      const jahr = +String(g.datum || '').slice(0, 4);
      return `<div class="ab-ereignisse">${g.ereignisse.map(e => { const tip = esc(`${jahr ? `vor ${jahr - e.jahr} Jahren · ` : ''}${e.text}`), inn = `<b>${esc(jahrText(e.jahr))}</b> ${esc(e.text)}`;
        return e.link ? `<a class="ab-ev kr-z" href="${esc(e.link)}" target="_blank" rel="noopener noreferrer" title="${tip}">${inn}</a>` : `<p class="ab-ev kr-z" title="${tip}">${inn}</p>`; }).join('')}</div>`; }
    case 'rezept': { const r = i.rezept; if (!r) return null;
      const info = [r.minuten ? `${r.minuten} Minuten` : '', 'für 2', r.vegetarisch ? 'vegetarisch' : ''].filter(Boolean);
      const zweite = rezeptSeite === 2 && r.zubereitung;
      return p(r.name, 'ab-titel') + p([...info, zweite ? 'Seite 2 von 2: Zubereitung' : r.zubereitung ? 'Seite 1 von 2: Zutaten' : ''].filter(Boolean).join(' · '), 'ab-meta') +
        (zweite ? p(r.zubereitung) : `<ul class="ab-zutaten">${(r.zutaten || []).map(z => `<li>${esc(z)}</li>`).join('')}</ul>`); }   // Blättern: Knopf neben „Merken“ (artFlaeche)
    case 'gesundheit': case 'beziehung': case 'spartipp': { const t = i[art]; if (!t) return null;
      const hinweis = { gesundheit: 'Allgemeine Anregung, keine medizinische Beratung.', spartipp: 'Allgemeiner Tipp, keine Anlageempfehlung.' }[art];
      return p(t.text, 'ab-gross ab-tipp') + (hinweis ? p(hinweis, 'ab-meta') : ''); }
    case 'tech': { const t = i.tech; if (!t) return null;
      return (t.kategorie ? p(t.kategorie, 'ab-meta ab-kategorie') : '') + p(t.text, 'ab-gross ab-tipp'); }
    default: return null;
  }
}

// Fläche einer Art: Überschrift, Inhalt, „☆ Merken“ (Kopie im Browser, erscheint unter Mehr → Gemerkt).
// vom: true = Inhalt eines anderen Tags in einem Bereich ohne ‹ › (aus „Gemerkt“ geöffnet) – Hinweis „vom 1.10.“ mit „zu heute“
// Rätsel zum Mitmachen: neben „Merken“ der Tipp-Knopf (bis zu 2 Tipps), nach dem Lösen „Teilen“
export function artFlaeche(art, d, { favoriten = [], loesung = false, rezeptSeite = 1, vom = false, spiel = LEER_SPIEL } = {}) {
  const inh = d ? flaecheHtml(art, d.inhalt, { loesung, rezeptSeite, spiel, datum: d.datum }) : null, wiki = art === 'geschichte';
  const rae = art === 'raetsel' && d && mitmachRaetsel(d.inhalt.raetsel) ? d.inhalt.raetsel : null, tippsGesamt = rae ? (rae.tipps || []).length : 0;
  const fav = !!d && favoriten.some(f => f.art === art && f.datum === d.datum);
  const leer = !d ? 'Die Tagesinhalte sind gerade nicht erreichbar.' : wiki && d.inhalt.geschichte === null ? 'Wikipedia ist gerade nicht erreichbar.' : 'Für diesen Tag gibt es hier nichts.';
  return `<div class="ab-art" data-art="${art}"><span class="ab-rubrik">${esc(RUBRIK[art])}${wiki ? ' <small title="Texte: Wikipedia, CC BY-SA 4.0">aus Wikipedia</small>' : ''}</span>` +
    (vom && d ? `<p class="ab-meta ab-vom">vom ${esc(datumText(d.datum))} · <button type="button" class="ab-link" data-ti="heute">zu heute</button></p>` : '') +
    (inh ? `<div class="ab-inhalt">${inh}</div>` : `<p class="ab-meta">${leer}</p>`) +
    (inh ? `<div class="ab-aktionen"><button type="button" class="ab-merken" data-ti="fav" data-art="${art}" aria-pressed="${fav}">${fav ? '★ Gemerkt' : '☆ Merken'}</button>` +
      (art === 'rezept' && d.inhalt.rezept.zubereitung ? `<button type="button" class="ab-knopf ab-weiter" data-ti="rezeptseite">${rezeptSeite === 2 ? '‹ Zutaten' : 'Zubereitung ›'}</button>` : '') +
      (rae && spiel.geloest ? '<button type="button" class="ab-knopf ab-teilen" data-ti="teilen">Teilen</button>' : '') +
      (rae && !spiel.geloest && tippsGesamt ? `<button type="button" class="ab-knopf ab-tipp-knopf" data-ti="tipp"${spiel.tipps >= tippsGesamt ? ' disabled' : ''}>💡 ${spiel.tipps ? 'Noch ein Tipp' : 'Tipp'}</button>` : '') +
      '</div>' : '') + '</div>';
}

// Rubriken aus einer Liste (rein): eine Art → Inhalt direkt, mehrere Arten → Themen (Ebene 3)
const rubriken = (liste, d, o) => liste.map(g => g.arten.length === 1
  ? { id: g.id, name: g.name, html: artFlaeche(g.arten[0], d, o) }
  : { id: g.id, name: g.name, teile: g.arten.map(a => ({ id: a, name: KURZ[a] || ART[a].name, html: artFlaeche(a, d, o) })) });
const INFO = d => ['Inhalte von DAILY (mit KI vorbereitet)', d && d.wiederholt ? 'Vorrat wiederholt sich – neue Inhalte folgen' : null];

// Bereich „Heute“ (rein, testbar): Datumsblock mit ‹ ›, Rubriken zum Mitmachen
export function heuteBereich(env, { favoriten = [], loesung = false, rezeptSeite = 1, spiel = LEER_SPIEL } = {}) {
  const d = env && env.daten;
  return {
    state: d ? 'content' : 'error', bereichKopf: d ? datumsKopf(d) : '', kleinReiter: rubriken(HEUTE_RUBRIKEN, d, { favoriten, loesung, spiel }), startReiter: 'raetsel',
    info: [...INFO(d), 'Verpasst? Mit ‹ blätterst du zurück'].filter(Boolean)
  };
}
// Bereich „Entdecken“ (rein): immer heute; vom = Inhalt eines anderen Tags (aus „Gemerkt“)
export function entdeckenBereich(env, { favoriten = [], vom = false } = {}) {
  const d = env && env.daten;
  return { state: d ? 'content' : 'error', kleinReiter: rubriken(ENTDECKEN_RUBRIKEN, d, { favoriten, vom }), startReiter: 'sprache',
    info: [...INFO(d), '„An diesem Tag“: Wikipedia (CC BY-SA 4.0)'].filter(Boolean) };
}
// Mehr → „Alltag“ (rein): Themen Rezept · Gesundheit · Tech · Beziehung · Spartipp, immer heute
export function alltagRubrik(env, { favoriten = [], rezeptSeite = 1, vom = false } = {}) {
  const d = env && env.daten;
  return { id: 'alltag', name: 'Alltag', teile: ALLTAG_ARTEN.map(a => ({ id: a, name: KURZ[a], html: artFlaeche(a, d, { favoriten, rezeptSeite, vom }) })) };
}

// Mehr → „Gemerkt“: alle gemerkten Inhalte, neueste zuerst; ein Klick öffnet den Inhalt in seinem Bereich
export function gemerktReiter(favoriten = []) {
  const favs = [...favoriten].filter(f => ART[f.art]).sort((a, b) => (b.datum + b.art).localeCompare(a.datum + a.art));
  return { id: 'gemerkt', name: 'Gemerkt', kopf: `<b>Gemerkt</b> <small>${favs.length}</small>`,
    liste: favs.map(f => ({ d: datumText(f.datum, true), t: `${ART[f.art].name}: ${f.kurz}`, tip: f.text, aktion: 'fav:' + favKey(f.art, f.datum), gruppe: 1 })),
    html: '<p class="ab-meta">Noch nichts gemerkt. Mit ☆ Merken hebst du dir einen Inhalt auf – er bleibt hier, auch Tage später.</p>' };
}
