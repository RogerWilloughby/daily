// Adapter „tagesinhalt“: macht aus dem Vertrag tagesinhalt v1 die Themen-Kacheln (Unterhaltung, Wissen, Alltag) mit Mini-Reitern –
// je Art ein Reiter mit Blättern ‹ ›, Favorit ☆ und „+ Aufgabe“, dazu der Reiter „Favoriten“ (Top 11 vorbereitet).
// Favoriten speichern eine Kopie des Inhalts (bleibt erhalten, auch wenn der Vorrat wechselt). Rein, ohne DOM – testbar.
import { esc, icon } from '../core/util.js';

export const ART = {
  raetsel: { name: 'Rätsel', icon: 'frage' }, witz: { name: 'Witz', icon: 'lachen' }, film: { name: 'Film', icon: 'film' },
  wort: { name: 'Wort & Sprichwort', icon: 'book' }, land: { name: 'Land', icon: 'globe' },
  rezept: { name: 'Rezept', icon: 'food' }, gesundheit: { name: 'Gesundheit', icon: 'heart' }, tech: { name: 'Tech', icon: 'chip' }, beziehung: { name: 'Beziehung', icon: 'pair' }
};
export const THEMEN = {
  unterhaltung: { name: 'Unterhaltung', arten: ['raetsel', 'witz', 'film'] },
  wissen: { name: 'Wissen', arten: ['wort', 'land'] },
  alltag: { name: 'Alltag', arten: ['rezept', 'gesundheit', 'tech', 'beziehung'] }
};

// „Do 1.10.“ / kurz „1.10.“
export const datumText = (d, kurz = false) => {
  const t = new Date(d + 'T12:00:00Z');
  return `${kurz ? '' : t.toLocaleDateString('de-DE', { weekday: 'short', timeZone: 'UTC' }).replace('.', '') + ' '}${t.getUTCDate()}.${t.getUTCMonth() + 1}.`;
};
export const tagPlus = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
export const favKey = (art, datum) => `${art}|${datum}`;

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
    case 'gesundheit': case 'beziehung': { const t = i[art]; if (!t) return null;
      return { kurz: t.kurz || t.text, text: t.text, html: p(t.text) + (art === 'gesundheit' ? p('Allgemeine Anregung, keine medizinische Beratung.', 'ti-hinweis') : '') }; }
    case 'tech': { const t = i.tech; if (!t) return null;
      return { kurz: t.kategorie ? `${t.kategorie}: ${t.text}` : t.text, text: t.text, html: (t.kategorie ? `<p class="ti-klein"><b>${esc(t.kategorie)}</b></p>` : '') + p(t.text) }; }
    default: return null;
  }
}

// Zeile über dem Inhalt: ‹ Datum ›, Favorit, Aufgabe
export function navZeile({ datum, erster, heute }, fav) {
  return `<div class="ti-nav"><button type="button" data-ti="zurueck" aria-label="Tag zurück" title="Tag zurück"${datum <= erster ? ' disabled' : ''}>‹</button>` +
    `<span class="ti-datum">${esc(datumText(datum))}</span>` +
    `<button type="button" data-ti="vor" aria-label="Tag vor" title="Tag vor"${datum >= heute ? ' disabled' : ''}>›</button>` +
    `<button type="button" class="ti-stern" data-ti="fav" aria-pressed="${!!fav}" title="${fav ? 'Aus den Favoriten nehmen' : 'Als Favorit merken'}">${fav ? '★' : '☆'}</button>` +
    `<button type="button" class="ti-aufgabe" data-ti="aufgabe" title="Als Aufgabe in „Mein Daily“ anlegen" aria-label="Als Aufgabe anlegen">+<span class="ti-lang"> Aufgabe</span></button></div>`;
}

// Favorit als Kopie: { art, datum, kurz, text }
export const favEintrag = (art, env) => { const a = artInhalt(art, env.daten.inhalt); return a ? { art, datum: env.daten.datum, kurz: a.kurz, text: a.text } : null; };

// Themen-Kachel. favoriten: Liste aller Favoriten (alle Themen); opt: Kachel-Einstellungen (Reiter ein/aus); top: vorbereitete Top 11 (null = noch nicht entschieden)
export function kachel(thema, env, { favoriten = [], loesung = false, opt = {}, top = null } = {}) {
  const t = THEMEN[thema], d = env && env.daten;
  const favs = favoriten.filter(f => t.arten.includes(f.art)).sort((a, b) => (b.datum + b.art).localeCompare(a.datum + a.art));
  const reiter = t.arten.filter(a => opt[a] !== false).map(a => {
    const inh = d ? artInhalt(a, d.inhalt, { loesung }) : null;
    const fav = d && favoriten.some(f => f.art === a && f.datum === d.datum);
    return { id: a, name: ART[a].name, icon: icon(ART[a].icon), kopf: `<b>${esc(ART[a].name)}</b>${d ? ` <small class="ti-tag">${esc(datumText(d.datum))}</small>` : ''}`,
      html: !d ? '<p class="ti-hinweis">Die Tagesinhalte sind gerade nicht erreichbar.</p>'
        : navZeile(d, fav) + (inh ? `<div class="ti-inhalt" title="${esc(inh.text)}">${inh.html}</div>` : '<p class="ti-hinweis">Für diesen Tag gibt es hier nichts.</p>') };
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
    info: ['Inhalte von DAILY (mit KI vorbereitet)', d && d.wiederholt ? 'Vorrat wiederholt sich – neue Inhalte folgen' : 'Ältere Tage mit ‹ ›', 'Favoriten bleiben in diesem Browser'].filter(Boolean)
  };
}
