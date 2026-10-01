// Kachel „Finanzen“: Dienst „finanzen“ (EZB: Wechselkurse, Leitzinsen, Inflation – für alle) und im privaten Betrieb
// zusätzlich „kurse“ (DAX, Krypto, Gold über Yahoo – nur privat). Reine Kursangaben, keine Anlageempfehlung.
// Mini-Reiter in der kleinen Kachel (Kurse · Zinsen & Inflation · Märkte · Spartipp, Zahnrad → Einstellungsfenster), kein Aufklappen.
// Spartipp seit 0.36.0 aus dem Dienst „tagesinhalt“ mit ‹ › (vergangene Tage), ☆ Favorit (erscheint in „Alltag“) und „+ Aufgabe“.
import { set } from '../core/board.js';
import { kachelOpt, kachelOptSpeichern } from '../core/store.js';
import { kachelEinstellungen } from '../core/einstellungen.js';
import { addAnswer } from '../core/ask.js';
import { dienst, gespeichert } from '../dienste/client.js';
import { kachel, antwort, FINANZ_STANDARD, AUSWAHL } from '../adapter/finanzen.js';
import { betrieb } from '../core/betrieb.js';
import { hm, berlinDay } from '../core/util.js';
import { tagPlus } from '../adapter/tagesinhalt.js';
import { favUmschalten, istFavorit, alsAufgabe } from './thema.js';

let fe = null, ku = null, tippEnv = null, tippHeute = null;
const oder = x => (x instanceof Error ? null : x);
const opt = () => kachelOpt('money', FINANZ_STANDARD);
const stand = e => (e && (e.veraltet || Date.parse(e.gueltigBis) < Date.now()) ? `Stand ${hm(e.erstellt)}` : '');
const tipp = () => (tippEnv ? { env: tippEnv, fav: istFavorit('spartipp', tippEnv) } : null);
const zeichne = () => set('money', { ...kachel(fe, ku, opt(), tipp()), tag: stand(fe) });
// Spartipp eines Tags (Fehler: der bisherige bleibt)
async function holeTipp(d) {
  try { const r = await dienst('tagesinhalt', { datum: d }); tippEnv = r; if (r.daten.datum === r.daten.heute) tippHeute = r; } catch (e) { /* bisheriger bleibt */ }
}

// EZB-Daten (Takt 1 Stunde, für alle gleich) – beim Öffnen sofort der gespeicherte Stand; privat die Kurse parallel
export async function load() {
  const alt = gespeichert('finanzen');
  if (alt && !fe) set('money', { ...kachel(alt, null, opt(), tipp()), tag: stand(alt) });
  // Spartipp: heute – ist man zurückgeblättert, bleibt der Tag
  const tippTag = !tippEnv || tippEnv.daten.datum === tippEnv.daten.heute ? berlinDay() : tippEnv.daten.datum;
  const [f, k] = await Promise.all([
    dienst('finanzen').catch(e => e),
    betrieb.privat ? dienst('kurse', {}, { privat: true }).catch(e => e) : Promise.resolve(null),
    holeTipp(tippTag)
  ]);
  if (f instanceof Error) { if (!fe && !alt) throw f; }
  else fe = f;
  if (!fe) fe = alt;
  ku = oder(k) || ku;
  zeichne();
}

addAnswer(/spartipp|spar|geld sparen/i, () => (tippHeute && tippHeute.daten.inhalt.spartipp ? `Spartipp: ${tippHeute.daten.inhalt.spartipp.text}` : null));
addAnswer(/leitzins|zins|inflation|teuerung|preissteigerung|dollar|pfund|franken|zloty|złoty|krone|yen|yuan|forint|lira|wechselkurs|währung|waehrung|kurs|euro|dax|börse|boerse|aktie|bitcoin|krypto|ethereum|gold/i,
  q => antwort(q, fe, ku));

// Umschalter im Kursdiagramm des Reiters „Kurse“ (30 / 90 Tage): dieselbe Einstellung wie im Einstellungsfenster, sofort ohne Abruf
document.addEventListener('click', e => {
  const b = e.target.closest('#tile-money [data-mini-wahl]'); if (!b) return;
  kachelOptSpeichern('money', { ...opt(), tage: +b.dataset.miniWahl });
  if (fe) zeichne();
});

// Spartipp: ‹ › Datum, ☆ Favorit, + Aufgabe
document.addEventListener('click', e => {
  const b = e.target.closest('#tile-money [data-ti]'); if (!b || b.disabled || !tippEnv) return;
  const ti = b.dataset.ti, d = tippEnv.daten.datum;
  if (ti === 'zurueck' || ti === 'vor') holeTipp(tagPlus(d, ti === 'vor' ? 1 : -1)).then(() => fe && zeichne());
  else if (ti === 'fav') favUmschalten('spartipp', tippEnv);
  else if (ti === 'aufgabe') alsAufgabe('spartipp', tippEnv, b);
});
document.addEventListener('daily:favoriten', () => { if (fe) zeichne(); });
// Favorit „Spartipp“ aus der Kachel „Alltag“ öffnen: Reiter „Spartipp“, dieser Tag
document.addEventListener('daily:tagesinhalt', e => {
  if (e.detail.art !== 'spartipp') return;
  kachelOptSpeichern('money', { reiter: 'tipp' });
  holeTipp(e.detail.datum).then(() => fe && zeichne());
});

// Einstellungen der Kachel (Zahnrad in der Reiterspalte → Einstellungsfenster)
const NAME = { USD: 'US-Dollar', GBP: 'Brit. Pfund', CHF: 'Schweizer Franken', PLN: 'Poln. Złoty', CZK: 'Tschech. Krone', JPY: 'Yen', CNY: 'Yuan',
  SEK: 'Schwed. Krone', NOK: 'Norw. Krone', DKK: 'Dän. Krone', HUF: 'Forint', TRY: 'Türk. Lira', CAD: 'Kanad. Dollar', AUD: 'Austral. Dollar' };
kachelEinstellungen('money', {
  felder: () => {
    const o = opt();
    return [
      { typ: 'select', key: 'haupt', label: 'Hauptwährung (1 € = …)', wert: o.haupt, optionen: AUSWAHL.map(c => [c, NAME[c]]) },
      { typ: 'select', key: 'tage', label: 'Kursdiagramm', wert: String(o.tage), optionen: [['30', '30 Tage'], ['90', '90 Tage']] },
      { typ: 'titel', label: 'Weitere Währungen (so viele, wie in die Kachel passen)' },
      ...AUSWAHL.map(c => ({ typ: 'check', key: 'w_' + c, label: c, wert: o.weitere.includes(c) })),
      { typ: 'titel', label: 'Reiter anzeigen' },
      { typ: 'check', key: 'zinsen', label: 'Zinsen & Inflation', wert: !(o.zinsen === false && o.inflation !== true) },
      ...(betrieb.privat ? [{ typ: 'check', key: 'maerkte', label: 'Märkte (DAX, Krypto, Gold – privat)', wert: o.maerkte !== false }] : []),
      { typ: 'check', key: 'tipp', label: 'Spartipp', wert: o.tipp !== false }
    ];
  },
  speichern: w => {
    kachelOptSpeichern('money', {
      haupt: w.haupt, tage: +w.tage, weitere: AUSWAHL.filter(c => w['w_' + c] && c !== w.haupt),
      zinsen: !!w.zinsen, inflation: !!w.zinsen, tipp: !!w.tipp, ...('maerkte' in w ? { maerkte: !!w.maerkte } : {})
    });
    if (fe) zeichne();
  }
});

export default { id: 'money', name: 'Finanzen', every: 15 * 60e3, load };
