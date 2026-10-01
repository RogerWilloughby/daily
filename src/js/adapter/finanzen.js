// Adapter „Finanzen“: macht aus den Diensten „finanzen“ (EZB, öffentlich) und „kurse“ (Yahoo, nur privat) die Kachel und Antworten.
// Reine Kursangaben, keine Anlageempfehlung. Rein, ohne DOM – testbar.
import { esc, icon } from '../core/util.js';
import { miniKurs } from './kursdiagramm.js';

export const FINANZ_STANDARD = { haupt: 'USD', weitere: ['GBP', 'CHF', 'PLN', 'CZK'], tage: 30, zinsen: true, maerkte: true, tipp: true };
// Zur Wahl in den Einstellungen (Reihenfolge)
export const AUSWAHL = ['USD', 'GBP', 'CHF', 'PLN', 'CZK', 'JPY', 'CNY', 'SEK', 'NOK', 'DKK', 'HUF', 'TRY', 'CAD', 'AUD'];
const HINWEIS = 'Reine Kursangaben, keine Anlageempfehlung.';

// Zahlen deutsch: Kurse mit passenden Stellen, Prozent mit Pfeil
export function kursZahl(v) {
  if (v == null) return '–';
  const d = v < 10 ? 4 : v < 1000 ? 2 : 0;
  return v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
}
const prozent = (v, stellen = 2) => v == null ? '–' : v.toLocaleString('de-DE', { minimumFractionDigits: stellen, maximumFractionDigits: stellen }) + ' %';
export const pfeil = v => v == null ? '' : v > 0 ? '▲' : v < 0 ? '▼' : '±';
const aend = (v, html = false) => {
  if (v == null) return '';
  const t = `${pfeil(v)} ${prozent(Math.abs(v))}`;
  return html ? `<small class="fi-aend ${v > 0 ? 'fi-plus' : v < 0 ? 'fi-minus' : ''}">${esc(t)}</small>` : t;
};
const datum = t => t ? new Date(t + 'T12:00:00Z').toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';
const monatName = m => m ? new Date(m + '-15T12:00:00Z').toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';
const zeilen = liste => '<dl class="kompakt">' + liste.map(([k, v]) => `<div class="row"><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('') + '</dl>';
const w = (fEnv, code) => fEnv && fEnv.daten ? fEnv.daten.waehrungen.find(x => x.code === code) || null : null;

// „1 € = 1,1423 $“
export const euroText = x => `1 € = ${kursZahl(x.kurs)} ${x.zeichen}`;

// Kachel mit Mini-Reitern (core/board.js, entscheidungen.md Abschnitt 13): Kurse · Zinsen & Inflation · Märkte (nur mit kEnv) · Tipp.
// opt siehe FINANZ_STANDARD (zinsen = Reiter „Zinsen & Inflation“; früher getrennt zinsen/inflation – beide aus = Reiter aus);
// kEnv nur im privaten Betrieb; tipp = Spartipp des Tages aus den Tagesinhalten ({ kurz, text }) oder null.
export function kachel(fEnv, kEnv = null, opt = {}, tipp = null) {
  const o = { ...FINANZ_STANDARD, ...opt };
  const d = fEnv && fEnv.daten;
  if (!d) {
    const t = 'Die EZB-Daten sind gerade nicht erreichbar.';
    return { state: 'error', m: '', x: t, kleinReiter: [{ id: 'kurse', name: 'Kurse', icon: icon('money'), kopf: 'Finanzen', html: `<p class="fi-text">${t}</p>` }] };
  }
  const h = w(fEnv, o.haupt) || w(fEnv, 'USD') || d.waehrungen[0];
  const weitere = o.weitere.filter(c => c !== h.code).map(c => w(fEnv, c)).filter(Boolean);
  const einlage = (d.leitzinsen || []).find(z => z.art === 'einlagen'), de = (d.inflation || []).find(i => i.gebiet === 'DE');
  const stand = `Stand ${datum(d.stand)}`;
  const reiter = [{
    id: 'kurse', name: 'Kurse', icon: icon('money'),
    kopf: `<span class="fi-kopf">1 € = <b>${esc(kursZahl(h.kurs))} ${esc(h.zeichen)}</b> ${aend(h.aenderungProzent, true)}</span>`,
    liste: weitere.map(x => ({ d: x.zeichen, t: `${kursZahl(x.kurs)}  ${aend(x.aenderungProzent)}`,
      tip: `${x.name}: ${euroText(x)} · Vortag ${kursZahl(x.vortag)} · 90 Tage ${kursZahl(x.tief90)} – ${kursZahl(x.hoch90)}`, gruppe: 1 })),
    unten: miniKurs({ tage: d.tage, werte: h.verlauf, zeichen: h.zeichen, wahl: +o.tage === 90 ? 90 : 30, titel: `1 € in ${h.zeichen}` })
  }];
  // „Zinsen & Inflation“: Schalter „zinsen“; wer früher nur „Leitzinsen“ aus-, „Inflation“ aber angeschaltet hatte, sieht den Reiter weiter
  if (!(o.zinsen === false && o.inflation !== true)) {
    const zl = (d.leitzinsen || []).map(z => ({ d: prozent(z.satzProzent), t: z.name + (z.seit ? ` · seit ${datum(z.seit)}` : ''),
      tip: `${z.name}: ${prozent(z.satzProzent)}${z.vorherProzent != null ? ` (vorher ${prozent(z.vorherProzent)})` : ''}` +
        (z.art === 'einlagen' ? ' – derzeit der maßgebliche Leitzins: so viel Zinsen bekommen Banken für Geld, das sie bei der Zentralbank parken.' : '') + ' Quelle: EZB.', gruppe: 1 }));
    const il = (d.inflation || []).map(i => ({ d: prozent(i.rateProzent, 1), t: `${i.name} · ${monatName(i.monat)}`,
      tip: `Anstieg der Verbraucherpreise gegenüber dem Vorjahresmonat (HVPI)${i.vormonatProzent != null ? `, Vormonat ${prozent(i.vormonatProzent, 1)}` : ''}. Quelle: EZB.`, gruppe: 2 }));
    reiter.push({ id: 'zinsen', name: 'Zinsen & Inflation', icon: icon('prozent'),
      kopf: [einlage ? `Leitzins <b>${esc(prozent(einlage.satzProzent))}</b>` : '', de ? `Inflation <b>${esc(prozent(de.rateProzent, 1))}</b>` : ''].filter(Boolean).join(' · ') || 'Zinsen & Inflation',
      liste: [...zl, ...il], html: '<p class="fi-text">Leitzinsen und Inflation sind gerade nicht erreichbar.</p>' });
  }
  const kw = kEnv && kEnv.daten ? kEnv.daten.werte : null;
  if (kw && o.maerkte !== false) reiter.push({ id: 'maerkte', name: 'Märkte', icon: icon('bars'),
    kopf: '<b>Märkte</b> <small class="fi-klein">zum Vortag</small>',
    liste: kw.map(x => ({ d: x.name, t: x.kurs == null ? 'gerade nicht verfügbar' : `${marktText(x)}  ${aend(x.aenderungProzent)}`,
      tip: `${x.name} · Quelle: Yahoo Finance (nur privat) · ${HINWEIS}`, gruppe: 1 })) });
  if (tipp && tipp.text && o.tipp !== false) reiter.push({ id: 'tipp', name: 'Spartipp', icon: icon('piggy'), kopf: '<b>Spartipp</b> <small class="fi-klein">des Tages</small>',
    html: `<p class="fi-tipp">${esc(tipp.text)}</p><p class="fi-text">Allgemeiner Tipp, keine Anlageempfehlung.</p>` });
  const zusatz = [einlage ? `Leitzins ${prozent(einlage.satzProzent)}` : '', de ? `Inflation ${prozent(de.rateProzent, 1)} (${monatName(de.monat).split(' ')[0]})` : ''].filter(Boolean).join(', ');
  return {
    state: 'live',
    title: `Finanzen · ${euroText(h)}`,
    m: '', ms: `${kursZahl(h.kurs)} ${h.zeichen}`,
    trend: h.aenderungProzent > 0 ? 'up' : h.aenderungProzent < 0 ? 'down' : null,
    x: `${euroText(h)}${h.aenderungProzent != null ? ` (${aend(h.aenderungProzent)})` : ''}.${zusatz ? ' ' + zusatz + '.' : ''} ${stand}.`,
    liste: [], info: [stand, 'Euro-Referenzkurse, Leitzinsen, Inflation: EZB (werktags gegen 16 Uhr, nur zur Information)', ...(kw ? ['Märkte: Yahoo Finance (nur privat)'] : []), HINWEIS],
    kleinReiter: reiter, startReiter: 'kurse'
  };
}

// Privater Kurs: „24.312 Pkt“, „98.120 €“, „3.765 $“
export const marktText = x => `${kursZahl(x.kurs)} ${x.einheit === 'Pkt' ? 'Pkt' : x.einheit === 'USD' ? '$' : '€'}`;

// Frag DAILY: Dollar, Franken, „100 Franken in Euro“, Leitzins, Inflation, privat DAX/Bitcoin … (null = nicht zuständig)
const NAMEN = { dollar: 'USD', usd: 'USD', pfund: 'GBP', gbp: 'GBP', franken: 'CHF', chf: 'CHF', zloty: 'PLN', 'złoty': 'PLN', krone: 'CZK', kronen: 'CZK',
  yen: 'JPY', yuan: 'CNY', renminbi: 'CNY', forint: 'HUF', lira: 'TRY', 'schwedische': 'SEK', 'norwegische': 'NOK', 'dänische': 'DKK', 'daenische': 'DKK' };
export function antwort(q, fEnv, kEnv = null) {
  const t = String(q).toLowerCase();
  const d = fEnv && fEnv.daten;
  if (/leitzins|zinssatz|ezb.?zins|\bzins/.test(t)) {
    if (!d || !d.leitzinsen) return 'Die Leitzinsen sind gerade nicht erreichbar.';
    const e = d.leitzinsen.find(z => z.art === 'einlagen') || d.leitzinsen[0];
    return `Der Leitzins der EZB (${e.name}) liegt bei ${prozent(e.satzProzent)}${e.seit ? `, seit ${datum(e.seit)}` : ''}. ` +
      d.leitzinsen.filter(z => z !== e).map(z => `${z.name}: ${prozent(z.satzProzent)}`).join(', ') + '. Quelle: EZB.';
  }
  if (/inflation|teuerung|preissteigerung|verbraucherpreis/.test(t)) {
    if (!d || !d.inflation) return 'Die Inflationsdaten sind gerade nicht erreichbar.';
    return d.inflation.map(i => `${i.name}: ${prozent(i.rateProzent, 1)} im ${monatName(i.monat)}`).join(', ') + ' (gegenüber dem Vorjahresmonat). Quelle: EZB.';
  }
  const kw = kEnv && kEnv.daten ? kEnv.daten.werte.filter(x => x.kurs != null) : [];
  const wort = n => new RegExp(`(^|[^a-zäöü])${n.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&')}`).test(t);
  const markt = kw.find(x => wort(x.name.toLowerCase().split(' ')[0]) || wort(x.id));
  if (markt) return `${markt.name}: ${marktText(markt)}${markt.aenderungProzent != null ? ` (${aend(markt.aenderungProzent)} zum Vortag)` : ''}. ${HINWEIS}`;
  if (/dax|börse|boerse|aktie|bitcoin|krypto|ethereum|gold/.test(t)) return kw.length ? kw.map(x => `${x.name} ${marktText(x)}`).join(' · ') + `. ${HINWEIS}`
    : 'Börsen- und Kryptokurse zeigt DAILY nur im privaten Betrieb (Lizenzgründe). Wechselkurse, Leitzinsen und Inflation gibt es für alle.';
  const code = Object.entries(NAMEN).find(([n]) => new RegExp(`\\b${n}`).test(t)) || (t.match(/\b([a-z]{3})\b/) && d && d.waehrungen.some(x => x.code === t.match(/\b([a-z]{3})\b/)[1].toUpperCase()) ? [null, t.match(/\b([a-z]{3})\b/)[1].toUpperCase()] : null);
  if (!code && !/wechselkurs|kurs|euro|währung|waehrung/.test(t)) return null;
  if (!d) return 'Die Wechselkurse sind gerade nicht erreichbar.';
  const x = w(fEnv, code ? code[1] : 'USD');
  if (!x) return null;
  // „Was kosten 100 Franken?“ / „100 Dollar in Euro“ → Umrechnung in Euro; „50 Euro in Dollar“ → in die Währung
  const betrag = (t.match(/(\d+(?:[.,]\d+)?)/) || [])[1];
  if (betrag) {
    const b = parseFloat(betrag.replace(',', '.'));
    const inWaehrung = /(\d+(?:[.,]\d+)?)\s*(€|euro|eur)\b/.test(t);
    return inWaehrung ? `${fmt(b)} € sind ${kursZahl(b * x.kurs)} ${x.zeichen} (Referenzkurs der EZB vom ${datum(d.stand)}, ohne Gebühren).`
      : `${fmt(b)} ${x.zeichen} sind ${fmt(b / x.kurs)} € (Referenzkurs der EZB vom ${datum(d.stand)}, ohne Gebühren).`;
  }
  return `${euroText(x)} (${x.name})${x.aenderungProzent != null ? `, ${aend(x.aenderungProzent)} zum Vortag` : ''}. Referenzkurs der EZB vom ${datum(d.stand)}.`;
}
const fmt = v => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
