// Kachel „Kalender“: Feiertage, Ferien, Himmel und Namenstage (öffentlich, eine Anfrage als Paket) und im privaten Betrieb
// zusätzlich die eigenen Termine (Dienst „termine“, per POST mit den iCal-Links aus den Einstellungen, nie zwischengespeichert).
import { set } from '../core/board.js';
import { settings, saveSettings, kachelOpt, kachelOptSpeichern } from '../core/store.js';
import { kachelEinstellungen } from '../core/einstellungen.js';
import { addAnswer } from '../core/ask.js';
import { paket, gespeichert, ortParams, dienst, privatDienst } from '../dienste/client.js';
import { kachel, antwort, namenAntwort, termineAntwort } from '../adapter/kalender.js';
import { betrieb } from '../core/betrieb.js';
import { hm } from '../core/util.js';

let fe = null, hi = null, na = null, te = null;
const oder = x => (x instanceof Error ? null : x);
const zone = () => settings.place.zeitzone || 'Europe/Berlin';
const STANDARD = { namen: true, aktion: true, himmel: true };
const opt = () => kachelOpt('kalender', STANDARD);
// Einstellungen anwenden: Namenstage, Aktionstage, Himmel aus- oder einblenden (die Antworten für Frag DAILY bleiben vollständig)
function zeige(f, h, n, t) {
  const o = opt();
  const f2 = f && o.aktion === false ? { ...f, daten: { ...f.daten, aktionstage: [] } } : f;
  return kachel(f2, o.himmel === false ? null : h, Date.now(), zone(), o.namen === false ? null : n, t);
}
const stand = e => (e && (e.veraltet || Date.parse(e.gueltigBis) < Date.now()) ? `Stand ${hm(e.erstellt)}` : '');

// Feiertage, Namenstage (Takt 1 Tag) und Himmel (Takt 1 Stunde) zusammen; öffentlich beim Öffnen sofort der gespeicherte Stand.
// Privat NICHT: Termine werden nie gespeichert – ein Zwischenstand ohne Termine sähe anders aus und „spränge“ dann um.
// Stattdessen warten, bis Paket und Termine da sind (höchstens 3 s, dann ohne Termine; Termine werden nachgereicht).
// Beim regelmäßigen Auffrischen bleiben bis dahin die bisherigen Termine stehen. Feiertage gibt es nur in Deutschland.
export const WARTEN_MS = 3000;
const zeichne = () => set('kalender', { ...zeige(fe, hi, na, te), tag: stand(hi || fe) });
export async function load() {
  const p = ortParams(settings.place);
  if (!betrieb.privat) {
    const altF = gespeichert('feiertage', p), altH = gespeichert('himmel', p), altN = gespeichert('namenstage', p);
    if ((altF || altH) && !fe && !hi) set('kalender', { ...zeige(altF, altH, altN, null), tag: stand(altH || altF) });
  }
  // Termine (nur privat) parallel zum Paket; bei Störung zeigt der Reiter „nicht erreichbar“
  const termineHolen = betrieb.privat
    ? privatDienst('termine', { urls: settings.icsUrls || [], zeitzone: zone() }).catch(() => ({ daten: null }))
    : Promise.resolve(null);
  const r = await paket(['feiertage', 'himmel', 'namenstage'], p);
  fe = oder(r.feiertage); hi = oder(r.himmel); na = oder(r.namenstage);
  if (!fe && !hi) throw r.himmel;
  const zuSpaet = Symbol('zu spät');
  const t = await Promise.race([termineHolen, new Promise(ok => setTimeout(() => ok(zuSpaet), WARTEN_MS))]);
  if (t !== zuSpaet) { te = t; zeichne(); return; }
  zeichne();                                            // ohne neue Termine (bisherige bleiben, beim ersten Mal keine)
  te = await termineHolen; zeichne();                   // Termine nachreichen
}

// „Wann hat Josef Namenstag?“ fragt den Dienst mit dem Namen; „Wer hat heute Namenstag?“ nimmt die geladenen Daten
addAnswer(/namenstag/i, async q => {
  const m = /(?:wann\s+(?:hat|haben)|namenstag\s+(?:von|für|fuer))\s+(?:der\s+|die\s+)?([A-Za-zÄÖÜäöüß-]{2,})/i.exec(q);
  const name = m && !/^(heute|morgen|wer|ich|man)$/i.test(m[1]) ? m[1] : null;
  if (!name) return namenAntwort(na);
  try { return namenAntwort(await dienst('namenstage', { name })); } catch (e) { return namenAntwort(null); }
});

// Eigene Termine (nur privat)
addAnswer(/termin|was steht|heute an|morgen an|was habe ich|was hab ich|kalender/i, q => termineAntwort(q, te, Date.now(), zone()));

addAnswer(/ferien|feiertag|brücken|brueckentag|zeitumstellung|sommerzeit|winterzeit|kalenderwoche|\bkw\b|mond|stern|finsternis|jahreszeit|frühling|herbstanfang|sommeranfang|winteranfang|advent|muttertag|vatertag|ostern|pfingst|weihnacht|silvester|nikolaus|halloween|valentin|rosenmontag|erntedank|totensonntag|martin|wann ist/i,
  q => antwort(q, fe, hi, settings.place.name, Date.now(), zone()));

// Einstellungen der Kachel (Zahnrad-Reiter)
kachelEinstellungen('kalender', {
  felder: () => {
    const o = opt();
    return [
      ...(betrieb.privat ? [
        { typ: 'textarea', key: 'ics', label: 'Deine Kalender (iCal-Links)', wert: (settings.icsUrls || []).join('\n'), platzhalter: 'https://calendar.google.com/calendar/ical/…/basic.ics',
          hilfe: 'Einer pro Zeile, höchstens 5 (Google: „Privatadresse im iCal-Format“). Bleibt nur in diesem Browser.' }
      ] : []),
      { typ: 'titel', label: 'Anzeigen' },
      { typ: 'check', key: 'namen', label: 'Namenstage', wert: o.namen !== false },
      { typ: 'check', key: 'aktion', label: 'Aktions- und Brauchtumstage (Muttertag, Advent …)', wert: o.aktion !== false },
      { typ: 'check', key: 'himmel', label: 'Himmel (Mond, Sternschnuppen, Finsternisse, Jahreszeiten)', wert: o.himmel !== false }
    ];
  },
  speichern: w => {
    if ('ics' in w) saveSettings({ icsUrls: w.ics.split(/\s+/).map(u => u.trim()).filter(u => /^(https|webcal):\/\//i.test(u)).slice(0, 5) });
    kachelOptSpeichern('kalender', { namen: !!w.namen, aktion: !!w.aktion, himmel: !!w.himmel });
    if (fe || hi) set('kalender', { ...zeige(fe, hi, na, te), tag: stand(hi || fe) });
  }
});

export default { id: 'kalender', name: 'Kalender', every: 10 * 60e3, load };   // 10 min wegen der Termine; öffentliche Teile kommen aus dem Speicher
