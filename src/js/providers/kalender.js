// Bereich „Kalender“: Feiertage, Ferien, Himmel und Namenstage (je Dienst eine eigene Anfrage), Rubriken Nächste · Feiertage · Ferien ·
// Namenstage (core/oberflaeche.js); die Rubrik „Himmel“ steht seit 0.49.0 unter Wetter (himmelAnbieter lädt dafür nur den Dienst „himmel“).
// Seit 0.47.0 ohne eigene Termine (Entscheidung 03.10.2026: „ganz weg“; der Dienst „termine“ bleibt auf dem Server).
import { set } from '../core/oberflaeche.js';
import { settings, kachelOpt, kachelOptSpeichern } from '../core/store.js';
import { kachelEinstellungen } from '../core/einstellungen.js';
import { gespeichert, ortParams, dienst } from '../dienste/client.js';
import { bundeslandVon } from '../lib/bundesland.js';
import { kachel } from '../adapter/kalender.js';
import { hm } from '../core/util.js';

let fe = null, hi = null, na = null;
const oder = x => (x instanceof Error ? null : x);
const zone = () => settings.place.zeitzone || 'Europe/Berlin';
const STANDARD = { namen: true, aktion: true, himmel: true };
const opt = () => kachelOpt('kalender', STANDARD);
// Einstellungen anwenden: Namenstage, Aktionstage, Himmel aus- oder einblenden
function zeige(f, h, n) {
  const o = opt();
  const f2 = f && o.aktion === false ? { ...f, daten: { ...f.daten, aktionstage: [] } } : f;
  return kachel(f2, o.himmel === false ? null : h, Date.now(), zone(), o.namen === false ? null : n);
}
const stand = e => (e && (e.veraltet || Date.parse(e.gueltigBis) < Date.now()) ? `Stand ${hm(e.erstellt)}` : '');
// Himmel als Rubrik unter Wetter (aus derselben Antwort; ausgeblendet, wenn im Zahnrad abgewählt)
const himmelSetzen = h => set('himmel', { kleinReiter: opt().himmel === false || !h ? [] : kachel(null, h, Date.now(), zone()).kleinReiter.filter(r => r.id === 'himmel') });
const zeichne = () => { set('kalender', { ...zeige(fe, hi, na), tag: stand(hi || fe) }); himmelSetzen(hi); };

// Feiertage, Namenstage (Takt 1 Tag) und Himmel (Takt 1 Stunde) zusammen; beim Öffnen sofort der gespeicherte Stand.
// Feiertage gibt es nur in Deutschland.
export async function load() {
  // Jeder Dienst mit genau seinen Angaben: Himmel je Ort, Feiertage je Bundesland, Namenstage für alle gleich
  const p = ortParams(settings.place), bl = bundeslandVon(settings.place), fP = bl ? { bundesland: bl } : null;
  const altF = fP && gespeichert('feiertage', fP), altH = gespeichert('himmel', p), altN = gespeichert('namenstage');
  if ((altF || altH) && !fe && !hi) set('kalender', { ...zeige(altF, altH, altN), tag: stand(altH || altF) });
  const [f, h, n] = await Promise.all([fP ? dienst('feiertage', fP).catch(e => e) : null, dienst('himmel', p).catch(e => e), dienst('namenstage').catch(e => e)]);
  fe = oder(f); hi = oder(h); na = oder(n);
  if (!fe && !hi) throw (h instanceof Error ? h : new Error('Kalender nicht erreichbar'));
  zeichne();
}

// Einstellungen (Abschnitt „Kalender“ im Einstellungsfenster)
kachelEinstellungen('kalender', {
  felder: () => {
    const o = opt();
    return [
      { typ: 'titel', label: 'Anzeigen' },
      { typ: 'check', key: 'namen', label: 'Namenstage', wert: o.namen !== false },
      { typ: 'check', key: 'aktion', label: 'Aktions- und Brauchtumstage (Muttertag, Advent …)', wert: o.aktion !== false },
      { typ: 'check', key: 'himmel', label: 'Himmel (Mond, Sternschnuppen, Finsternisse, Jahreszeiten)', wert: o.himmel !== false }
    ];
  },
  speichern: w => {
    kachelOptSpeichern('kalender', { namen: !!w.namen, aktion: !!w.aktion, himmel: !!w.himmel });
    if (fe) zeichne(); else himmelSetzen(hi);
  }
});

// Nur der Himmel für Wetter → Himmel (seit 0.49.0): ein Dienst statt drei, wenn „Kalender“ noch nicht geöffnet war
export const himmelAnbieter = { id: 'himmel', name: 'Himmel', bereich: 'wetter', every: 60 * 60e3,
  async load() {
    const p = ortParams(settings.place), alt = gespeichert('himmel', p);
    if (alt && !hi) himmelSetzen(alt);
    hi = await dienst('himmel', p);
    himmelSetzen(hi);
  } };

export default { id: 'kalender', name: 'Kalender', bereich: 'kalender', every: 60 * 60e3, load };   // Himmel hat den kürzesten Takt (1 Stunde)
