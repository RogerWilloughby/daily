// Adapter „tagesinhalt“: macht aus dem Vertrag tagesinhalt v1 die Themen-Kacheln (Unterhaltung, Wissen, Alltag) mit Mini-Reitern –
// je Art ein Reiter mit Blättern ‹ ›, Favorit ☆ und „+ Aufgabe“, dazu der Reiter „Favoriten“ (Top 11 vorbereitet).
// Favoriten speichern eine Kopie des Inhalts (bleibt erhalten, auch wenn der Vorrat wechselt). Rein, ohne DOM – testbar.
import { esc, icon } from '../core/util.js';

export const ART = {
  raetsel: { name: 'Rätsel', icon: 'frage' }, witz: { name: 'Witz', icon: 'lachen' }, film: { name: 'Film', icon: 'film' },
  wort: { name: 'Wort & Sprichwort', icon: 'book' }, land: { name: 'Land', icon: 'globe' }, geschichte: { name: 'An diesem Tag', icon: 'clock' },
  rezept: { name: 'Rezept', icon: 'food' }, gesundheit: { name: 'Gesundheit', icon: 'heart' }, tech: { name: 'Tech', icon: 'chip' }, beziehung: { name: 'Beziehung', icon: 'pair' },
  spartipp: { name: 'Spartipp', icon: 'piggy' }
};
export const THEMEN = {
  unterhaltung: { name: 'Unterhaltung', arten: ['raetsel', 'witz', 'film'] },
  wissen: { name: 'Wissen', arten: ['wort', 'land', 'geschichte'] },
  alltag: { name: 'Alltag', arten: ['rezept', 'gesundheit', 'tech', 'beziehung'], favAuch: ['spartipp'] }   // Spartipp: Reiter in „Finanzen“, Favoriten hier
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
// Arten ohne „+ Aufgabe“ (Geschichte ist nichts zum Erledigen)
const OHNE_AUFGABE = new Set(['geschichte']);

// Inhalt einer Art: html (Reiter), kurz (Favoriten-Zeile, Aufgabe), text (vollständig, beim Überfahren)
export function artInhalt(art, inhalt, { loesung = false } = {}) {
  const i = inhalt || {}, p = (t, k = 'ti-text') => `<p class="${k}">${esc(t)}</p>`;
  switch (art) {
    case 'raetsel': { const r = i.raetsel; if (!r) return null;
      return { kurz: r.frage, text: `${r.frage} – Lösung: ${r.loesung}`,
        html: p(r.frage) + (loesung ? p('Lösung: ' + r.loesung, 'ti-antwort') : '<button type="button" class="ti-loesung" data-ti="loesung">Lösung zeigen</button>') }; }
    case 'witz': return i.witz ? { kurz: i.witz, text: i.witz, html: p(i.witz) } : null;
    case 'film': { const f = i.film; if (!f) return null;
      const kopf = `${f.titel}${f.jahr ? ` (${f.jahr})` : ''}${f.genre ? ' · ' + f.genre : ''}`;
      return { kurz: kopf, text: `${kopf}. ${f.text || ''}`.trim(), html: `<p class="ti-text"><b>${esc(f.titel)}</b>${f.jahr ? ` (${f.jahr})` : ''}${f.genre ? ` · ${esc(f.genre)}` : ''}</p>` + (f.text ? p(f.text, 'ti-klein') : '') }; }
    case 'wort': { const w = i.wort; if (!w && !i.sprichwort) return null;
      return { kurz: w ? w.wort : i.sprichwort, text: [w ? `${w.wort}: ${w.bedeutung}${w.herkunft ? ` (${w.herkunft})` : ''}` : '', i.sprichwort ? `Sprichwort: ${i.sprichwort}` : ''].filter(Boolean).join(' · '),
        html: (w ? `<p class="ti-text"><b>${esc(w.wort)}</b> – ${esc(w.bedeutung)}${w.herkunft ? ` <small>(${esc(w.herkunft)})</small>` : ''}</p>` : '') + (i.sprichwort ? p('„' + i.sprichwort + '“', 'ti-klein') : '') }; }
    case 'land': { const l = i.land; if (!l) return null;
      const daten = [l.hauptstadt && `Hauptstadt ${l.hauptstadt}`, l.sprache, l.waehrung, l.gericht && `typisch: ${l.gericht}`].filter(Boolean).join(' · ');
      return { kurz: l.name, text: `${l.name}: ${daten}. ${l.fakt || ''}`.trim(), html: `<p class="ti-text"><b>${esc(l.name)}</b> · ${esc(daten)}</p>` + (l.fakt ? p(l.fakt, 'ti-klein') : '') }; }
    case 'rezept': { const r = i.rezept; if (!r) return null;
      const info = [r.minuten ? `${r.minuten} Min.` : '', 'für 2', r.vegetarisch ? 'vegetarisch' : ''].filter(Boolean).join(' · ');
      return { kurz: r.name, text: `${r.name} (${info}). Zutaten: ${(r.zutaten || []).join(', ')}. ${r.zubereitung || ''}`.trim(),
        html: `<p class="ti-text"><b>${esc(r.name)}</b> <small>${esc(info)}</small></p>` + p((r.zutaten || []).join(' · '), 'ti-klein') + (r.zubereitung ? p(r.zubereitung, 'ti-klein') : '') }; }
    case 'gesundheit': case 'beziehung': case 'spartipp': { const t = i[art]; if (!t) return null;
      const hinweis = { gesundheit: 'Allgemeine Anregung, keine medizinische Beratung.', spartipp: 'Allgemeiner Tipp, keine Anlageempfehlung.' }[art];
      return { kurz: t.kurz || t.text, text: t.text, html: p(t.text) + (hinweis ? p(hinweis, 'ti-hinweis') : '') }; }
    case 'geschichte': { const g = i.geschichte; if (!g || !g.ereignisse || !g.ereignisse.length) return null;
      const jahr = +String(g.datum || '').slice(0, 4), ev = g.ereignisse, zeile = e => `${jahrText(e.jahr)}: ${e.text}`;
      return { kurz: zeile(ev[0]), text: ev.map(zeile).join(' · '),
        html: ev.map(e => { const tip = esc(`${jahr ? `vor ${jahr - e.jahr} Jahren · ` : ''}${e.text}`), inn = `<b>${esc(jahrText(e.jahr))}</b> ${esc(e.text)}`;
          return e.link ? `<a class="ti-ev kr-z" href="${esc(e.link)}" target="_blank" rel="noopener noreferrer" title="${tip}">${inn}</a>` : `<p class="ti-ev kr-z" title="${tip}">${inn}</p>`; }).join('') }; }
    case 'tech': { const t = i.tech; if (!t) return null;
      return { kurz: t.kategorie ? `${t.kategorie}: ${t.text}` : t.text, text: t.text, html: (t.kategorie ? `<p class="ti-klein"><b>${esc(t.kategorie)}</b></p>` : '') + p(t.text) }; }
    default: return null;
  }
}

// Zeile über dem Inhalt: ‹ Datum ›, Favorit, Aufgabe
export function navZeile({ datum, erster, heute }, fav, { aufgabe = true } = {}) {
  return `<div class="ti-nav"><button type="button" data-ti="zurueck" aria-label="Tag zurück" title="Tag zurück"${datum <= erster ? ' disabled' : ''}>‹</button>` +
    `<span class="ti-datum">${esc(datumText(datum))}</span>` +
    `<button type="button" data-ti="vor" aria-label="Tag vor" title="Tag vor"${datum >= heute ? ' disabled' : ''}>›</button>` +
    `<button type="button" class="ti-stern" data-ti="fav" aria-pressed="${!!fav}" title="${fav ? 'Aus den Favoriten nehmen' : 'Als Favorit merken'}">${fav ? '★' : '☆'}</button>` +
    (aufgabe ? `<button type="button" class="ti-aufgabe" data-ti="aufgabe" title="Als Aufgabe in „Mein Daily“ anlegen" aria-label="Als Aufgabe anlegen">+<span class="ti-lang"> Aufgabe</span></button>` : '') + '</div>';
}

// Favorit als Kopie: { art, datum, kurz, text }
export const favEintrag = (art, env) => { const a = artInhalt(art, env.daten.inhalt); return a ? { art, datum: env.daten.datum, kurz: a.kurz, text: a.text } : null; };

// Themen-Kachel. favoriten: Liste aller Favoriten (alle Themen); opt: Kachel-Einstellungen (Reiter ein/aus); top: vorbereitete Top 11 (null = noch nicht entschieden)
export function kachel(thema, env, { favoriten = [], loesung = false, opt = {}, top = null } = {}) {
  const t = THEMEN[thema], d = env && env.daten;
  const favs = favoriten.filter(f => t.arten.includes(f.art) || (t.favAuch || []).includes(f.art)).sort((a, b) => (b.datum + b.art).localeCompare(a.datum + a.art));
  const reiter = t.arten.filter(a => opt[a] !== false).map(a => {
    const inh = d ? artInhalt(a, d.inhalt, { loesung }) : null;
    const fav = d && favoriten.some(f => f.art === a && f.datum === d.datum);
    const wiki = a === 'geschichte', leer = wiki && d && d.inhalt.geschichte === null ? 'Wikipedia ist gerade nicht erreichbar.' : 'Für diesen Tag gibt es hier nichts.';
    return { id: a, name: ART[a].name, icon: icon(ART[a].icon),
      kopf: `<b>${esc(ART[a].name)}</b>${wiki ? ' <small class="ti-tag" title="Texte: Wikipedia, CC BY-SA 4.0">aus Wikipedia</small>' : d ? ` <small class="ti-tag">${esc(datumText(d.datum))}</small>` : ''}`,
      html: !d ? '<p class="ti-hinweis">Die Tagesinhalte sind gerade nicht erreichbar.</p>'
        : navZeile(d, fav, { aufgabe: !OHNE_AUFGABE.has(a) }) + (inh ? `<div class="ti-inhalt"${wiki ? '' : ` title="${esc(inh.text)}"`}>${inh.html}</div>` : `<p class="ti-hinweis">${leer}</p>`) };
  });
  if (opt.favoriten !== false) reiter.push({ id: 'favoriten', name: 'Favoriten', icon: icon('stern'), kopf: `<b>Favoriten</b> <small class="ti-tag">${favs.length}</small>`,
    liste: favs.map(f => ({ d: datumText(f.datum, true), t: `${ART[f.art].name}: ${f.kurz}`, tip: f.text, aktion: 'fav:' + favKey(f.art, f.datum), gruppe: 1 })),
    html: '<p class="ti-hinweis">Noch keine Favoriten. Mit ☆ in einem Reiter merkst du dir einen Inhalt – er bleibt hier, auch Tage später.</p>' });
  // Top 11 (vorbereitet): erscheint erst, wenn es eine Liste gibt – wer sie bestimmt, ist noch offen
  if (Array.isArray(top) && top.length) reiter.push({ id: 'top', name: 'Top 11', icon: icon('bars'), kopf: '<b>Top 11</b>',
    liste: top.slice(0, 11).map((x, i) => ({ d: `${i + 1}.`, t: `${ART[x.art] ? ART[x.art].name + ': ' : ''}${x.kurz}`, tip: x.text, aktion: x.datum ? 'fav:' + favKey(x.art, x.datum) : undefined, gruppe: 1 })) });
  return {
    state: d ? 'content' : 'error', title: t.name, m: '', ms: d ? datumText(d.datum, true) : '–',
    x: d ? t.arten.map(a => (artInhalt(a, d.inhalt) || {}).kurz).filter(Boolean).join(' · ') : 'Die Tagesinhalte sind gerade nicht erreichbar.',
    liste: [], kleinReiter: reiter, startReiter: t.arten[0],
    info: ['Inhalte von DAILY (mit KI vorbereitet)', t.arten.includes('geschichte') ? '„An diesem Tag“: Wikipedia (CC BY-SA 4.0)' : null,
      d && d.wiederholt ? 'Vorrat wiederholt sich – neue Inhalte folgen' : 'Ältere Tage mit ‹ ›', 'Favoriten bleiben in diesem Browser'].filter(Boolean)
  };
}

// ---- Oberfläche „Abreißblock“ (seit 0.47.0, Phase 1b): Bereich „Heute“ mit Untertabs als Gruppen und Umschalter im Feld ----
// Rätsel · Lachen (Witz) · Wissen (Wort & Sprichwort, Land, An diesem Tag) · Kultur (Film) · Alltag (Rezept, Gesundheit, Tech, Beziehung, Spartipp)
export const GRUPPEN = [
  { id: 'raetsel', name: 'Rätsel', arten: ['raetsel'] },
  { id: 'lachen', name: 'Lachen', arten: ['witz'] },
  { id: 'wissen', name: 'Wissen', arten: ['wort', 'land', 'geschichte'] },
  { id: 'kultur', name: 'Kultur', arten: ['film'] },
  { id: 'alltag', name: 'Alltag', arten: ['rezept', 'gesundheit', 'tech', 'beziehung', 'spartipp'] }
];
export const gruppeVon = art => (GRUPPEN.find(g => g.arten.includes(art)) || GRUPPEN[0]).id;
// kurze Namen für den Umschalter im Feld, Überschrift über dem Inhalt
const KURZ = { wort: 'Wort', land: 'Land', geschichte: 'An diesem Tag', rezept: 'Rezept', gesundheit: 'Gesundheit', tech: 'Tech', beziehung: 'Beziehung', spartipp: 'Spartipp' };
export const RUBRIK = { raetsel: 'Rätsel des Tages', witz: 'Witz des Tages', film: 'Film des Tages', wort: 'Wort des Tages', land: 'Land des Tages', geschichte: 'An diesem Tag',
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

// Inhalt einer Art für die ganze Fläche (größer als in der Kachel). rezeptSeite: 1 = Zutaten, 2 = Zubereitung
export function flaecheHtml(art, inhalt, { loesung = false, rezeptSeite = 1 } = {}) {
  const i = inhalt || {}, p = (t, k = 'ab-text') => `<p class="${k}">${esc(t)}</p>`;
  switch (art) {
    case 'raetsel': { const r = i.raetsel; if (!r) return null;
      return p(r.frage, 'ab-gross') + (loesung ? p('Lösung: ' + r.loesung, 'ab-loesung') : '<button type="button" class="ab-knopf" data-ti="loesung">Lösung zeigen</button>'); }
    case 'witz': return i.witz ? p(i.witz, 'ab-gross ab-witz') : null;
    case 'film': { const f = i.film; if (!f) return null;
      return p(f.titel, 'ab-titel') + p([f.jahr, f.genre].filter(Boolean).join(' · '), 'ab-meta') + (f.text ? p(f.text) : ''); }
    case 'wort': { const w = i.wort; if (!w && !i.sprichwort) return null;
      const lang = w && w.wort.length > 15 ? ' ab-l3' : w && w.wort.length > 11 ? ' ab-l2' : '';   // lange Wörter kleiner (Fingerspitzengefühl)
      return (w ? p(w.wort, 'ab-wort' + lang) + p(w.bedeutung) + (w.herkunft ? p('Herkunft: ' + w.herkunft, 'ab-meta') : '') : '') +
        (i.sprichwort ? `<p class="ab-sprichwort">Sprichwort: <b>${esc(i.sprichwort)}</b></p>` : ''); }
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

// Fläche einer Art: Überschrift, Inhalt, „☆ Merken“ (Kopie im Browser, erscheint unter Mehr → Gemerkt)
export function artFlaeche(art, d, { favoriten = [], loesung = false, rezeptSeite = 1 } = {}) {
  const inh = d ? flaecheHtml(art, d.inhalt, { loesung, rezeptSeite }) : null, wiki = art === 'geschichte';
  const fav = !!d && favoriten.some(f => f.art === art && f.datum === d.datum);
  const leer = !d ? 'Die Tagesinhalte sind gerade nicht erreichbar.' : wiki && d.inhalt.geschichte === null ? 'Wikipedia ist gerade nicht erreichbar.' : 'Für diesen Tag gibt es hier nichts.';
  return `<div class="ab-art" data-art="${art}"><span class="ab-rubrik">${esc(RUBRIK[art])}${wiki ? ' <small title="Texte: Wikipedia, CC BY-SA 4.0">aus Wikipedia</small>' : ''}</span>` +
    (inh ? `<div class="ab-inhalt">${inh}</div>` : `<p class="ab-meta">${leer}</p>`) +
    (inh ? `<div class="ab-aktionen"><button type="button" class="ab-merken" data-ti="fav" data-art="${art}" aria-pressed="${fav}">${fav ? '★ Gemerkt' : '☆ Merken'}</button>` +
      (art === 'rezept' && d.inhalt.rezept.zubereitung ? `<button type="button" class="ab-knopf ab-weiter" data-ti="rezeptseite">${rezeptSeite === 2 ? '‹ Zutaten' : 'Zubereitung ›'}</button>` : '') + '</div>' : '') + '</div>';
}

// Bereich „Heute“ (rein, testbar): Datumsblock, je Gruppe ein Untertab; Gruppen mit mehreren Arten haben einen Umschalter (teile)
export function heuteBereich(env, { favoriten = [], loesung = false, rezeptSeite = 1 } = {}) {
  const d = env && env.daten, o = { favoriten, loesung, rezeptSeite };
  const kleinReiter = GRUPPEN.map(g => g.arten.length === 1
    ? { id: g.id, name: g.name, html: artFlaeche(g.arten[0], d, o) }
    : { id: g.id, name: g.name, teile: g.arten.map(a => ({ id: a, name: KURZ[a] || ART[a].name, html: artFlaeche(a, d, o) })) });
  return {
    state: d ? 'content' : 'error', bereichKopf: d ? datumsKopf(d) : '', kleinReiter, startReiter: 'raetsel',
    info: ['Inhalte von DAILY (mit KI vorbereitet)', '„An diesem Tag“: Wikipedia (CC BY-SA 4.0)', d && d.wiederholt ? 'Vorrat wiederholt sich – neue Inhalte folgen' : 'Verpasst? Mit ‹ blätterst du zurück']
      .filter(Boolean)
  };
}

// Mehr → „Gemerkt“: alle gemerkten Inhalte, neueste zuerst; ein Klick öffnet den Tag unter „Heute“
export function gemerktReiter(favoriten = []) {
  const favs = [...favoriten].filter(f => ART[f.art]).sort((a, b) => (b.datum + b.art).localeCompare(a.datum + a.art));
  return { id: 'gemerkt', name: 'Gemerkt', kopf: `<b>Gemerkt</b> <small>${favs.length}</small>`,
    liste: favs.map(f => ({ d: datumText(f.datum, true), t: `${ART[f.art].name}: ${f.kurz}`, tip: f.text, aktion: 'fav:' + favKey(f.art, f.datum), gruppe: 1 })),
    html: '<p class="ab-meta">Noch nichts gemerkt. Mit ☆ Merken unter „Heute“ hebst du dir einen Inhalt auf – er bleibt hier, auch Tage später.</p>' };
}
