// Kachel „Kalender“: holt die Dienste „feiertage“ und „himmel“ (daily/1) in einer Anfrage und stellt sie über den Adapter dar.
// Ersetzt die alten Kacheln „Feiertage & Ferien“ und „Himmel“. Später kommen Namenstage und (privat) eigene Termine dazu.
import { set } from '../core/board.js';
import { settings } from '../core/store.js';
import { addAnswer } from '../core/ask.js';
import { paket, gespeichert, ortParams } from '../dienste/client.js';
import { kachel, antwort } from '../adapter/kalender.js';
import { hm } from '../core/util.js';

let fe = null, hi = null;
const oder = x => (x instanceof Error ? null : x);
const zone = () => settings.place.zeitzone || 'Europe/Berlin';
const stand = e => (e && (e.veraltet || Date.parse(e.gueltigBis) < Date.now()) ? `Stand ${hm(e.erstellt)}` : '');

// Feiertage (Takt 1 Tag) und Himmel (Takt 1 Stunde) zusammen; beim Öffnen sofort der gespeicherte Stand.
// Feiertage gibt es nur in Deutschland – im Ausland zeigt die Kachel nur den Himmel.
export async function load() {
  const p = ortParams(settings.place);
  const altF = gespeichert('feiertage', p), altH = gespeichert('himmel', p);
  if ((altF || altH) && !fe && !hi) set('kalender', { ...kachel(altF, altH, Date.now(), zone()), tag: stand(altH || altF) });
  const r = await paket(['feiertage', 'himmel'], p);
  fe = oder(r.feiertage); hi = oder(r.himmel);
  if (!fe && !hi) throw r.himmel;
  set('kalender', { ...kachel(fe, hi, Date.now(), zone()), tag: stand(hi || fe) });
}

addAnswer(/ferien|feiertag|brücken|brueckentag|zeitumstellung|sommerzeit|winterzeit|kalenderwoche|\bkw\b|mond|stern|finsternis|jahreszeit|frühling|herbstanfang|sommeranfang|winteranfang|advent|muttertag|vatertag|ostern|pfingst|weihnacht|silvester|nikolaus|halloween|valentin|rosenmontag|erntedank|totensonntag|martin|wann ist/i,
  q => antwort(q, fe, hi, settings.place.name, Date.now(), zone()));

export default { id: 'kalender', name: 'Kalender', every: 30 * 60e3, load };
