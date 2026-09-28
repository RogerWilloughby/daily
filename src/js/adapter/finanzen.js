// Adapter „Finanzen“: macht aus den Diensten „finanzen“ (EZB, öffentlich) und „kurse“ (Yahoo, nur privat) die Kachel und Antworten.
// Reine Kursangaben, keine Anlageempfehlung. Rein, ohne DOM – testbar.
import { esc } from '../core/util.js';
import { miniKurs } from './diagramm.js';

export const FINANZ_STANDARD = { haupt: 'USD', weitere: ['GBP', 'CHF', 'PLN', 'CZK'], tage: 30, zinsen: true, inflation: true, maerkte: true };
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

// Kachel (Felder wie core/board.js erwartet). opt siehe FINANZ_STANDARD; kEnv nur im privaten Betrieb
export function kachel(fEnv, kEnv = null, opt = {}) {
  const o = { ...FINANZ_STANDARD, ...opt };
  const d = fEnv && fEnv.daten;
  if (!d) return { state: 'error', m: '', x: 'Die EZB-Daten sind gerade nicht erreichbar.' };
  const h = w(fEnv, o.haupt) || w(fEnv, 'USD') || d.waehrungen[0];
  const weitere = o.weitere.filter(c => c !== h.code).map(c => w(fEnv, c)).filter(Boolean);
  const einlage = (d.leitzinsen || []).find(z => z.art === 'einlagen'), de = (d.inflation || []).find(i => i.gebiet === 'DE');
  const stand = `Stand ${datum(d.stand)}`;
  // Reiter
  const kurse = [h, ...weitere].map(x => [x.name, `<b>${esc(euroText(x))}</b> ${aend(x.aenderungProzent, true)}` +
    `<br><small>Vortag ${esc(kursZahl(x.vortag))} · 90 Tage ${esc(kursZahl(x.tief90))} – ${esc(kursZahl(x.hoch90))}</small>`]);
  const tabs = [
    { id: 'kurse', name: 'Kurse', html: zeilen([...kurse, ['Hinweis', `Euro-Referenzkurse der EZB vom ${esc(datum(d.stand))} (werktags gegen 16 Uhr) – nur zur Information. ${HINWEIS}`]]) }
  ];
  if (o.zinsen !== false) tabs.push({ id: 'zinsen', name: 'Leitzinsen', html: d.leitzinsen ? zeilen([
    ...d.leitzinsen.map(z => [z.name, `<b>${esc(prozent(z.satzProzent))}</b>${z.seit ? ` seit ${esc(datum(z.seit))}` : ''}${z.vorherProzent != null ? ` <small>(vorher ${esc(prozent(z.vorherProzent))})</small>` : ''}`]),
    ['Hinweis', 'Der Einlagesatz ist derzeit der maßgebliche Leitzins: So viel Zinsen bekommen Banken für Geld, das sie bei der Zentralbank parken. Quelle: EZB.']
  ]) : '<p>Die Leitzinsen sind gerade nicht erreichbar.</p>' });
  if (o.inflation !== false) tabs.push({ id: 'inflation', name: 'Inflation', html: d.inflation ? zeilen([
    ...d.inflation.map(i => [i.name, `<b>${esc(prozent(i.rateProzent, 1))}</b> im ${esc(monatName(i.monat))}${i.vormonatProzent != null ? ` <small>(Vormonat ${esc(prozent(i.vormonatProzent, 1))})</small>` : ''}`]),
    ['Hinweis', 'Anstieg der Verbraucherpreise gegenüber dem Vorjahresmonat (Harmonisierter Verbraucherpreisindex). Quelle: EZB.']
  ]) : '<p>Die Inflationsdaten sind gerade nicht erreichbar.</p>' });
  const kw = kEnv && kEnv.daten ? kEnv.daten.werte : null;
  if (kw && o.maerkte !== false) tabs.push({ id: 'maerkte', name: 'Märkte', html: zeilen([
    ...kw.map(x => [x.name, x.kurs == null ? 'gerade nicht verfügbar' : `<b>${esc(marktText(x))}</b> ${aend(x.aenderungProzent, true)}`]),
    ['Hinweis', `Veränderung zum Vortag · Quelle: Yahoo Finance (nur privat) · ${HINWEIS}`]
  ]) });
  const zusatz = [einlage ? `Leitzins ${prozent(einlage.satzProzent)}` : '', de ? `Inflation ${prozent(de.rateProzent, 1)} (${monatName(de.monat).split(' ')[0]})` : ''].filter(Boolean).join(', ');
  return {
    state: 'live',
    title: `Finanzen · ${euroText(h)}`,
    kopf: `<span class="fi-kopf">1 € = <b>${esc(kursZahl(h.kurs))} ${esc(h.zeichen)}</b> ${aend(h.aenderungProzent, true)}</span>`,
    m: '', ms: `${kursZahl(h.kurs)} ${h.zeichen}`,
    trend: h.aenderungProzent > 0 ? 'up' : h.aenderungProzent < 0 ? 'down' : null,
    x: `${euroText(h)}${h.aenderungProzent != null ? ` (${aend(h.aenderungProzent)})` : ''}.${zusatz ? ' ' + zusatz + '.' : ''} ${stand}.`,
    liste: weitere.slice(0, 4).map(x => ({ d: x.zeichen, t: `${kursZahl(x.kurs)}  ${aend(x.aenderungProzent)}`, gruppe: 1 })),
    chart: miniKurs({ tage: d.tage, werte: h.verlauf, zeichen: h.zeichen, wahl: +o.tage === 90 ? 90 : 30, titel: `1 € in ${h.zeichen}` }),
    info: [stand, 'Quelle: EZB'],
    tabs, startReiter: 'kurse'
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
