// Dienst-Verzeichnis: jeder Dienst ist ein Modul mit id, version, titel, beschreibung, eingaben, laender ('alle' oder Liste wie ['DE']), klasse,
// ttl (Sekunden), quellen, schema (Vertrag für „daten“), blatt (Dienstblatt, siehe _lib/blatt.js) und run(eingabe) → { daten, ort?, hinweise?, quellen? }.
// Neuer Dienst = Modul in services/ + Eintrag hier. Aufruf: GET /api/v1/<id>
const { DienstFehler, antwort, fehlerAntwort, iso } = require('./_lib/rahmen');
const { isPrivate } = require('./_lib/http');

const DIENSTE = [
  require('./ort'),
  require('./wetter'),
  require('./regen'),
  require('./wetterhinweise'),
  require('./feiertage'),
  require('./himmel'),
  require('./namenstage'),
  require('./termine'),
  require('./finanzen'),
  require('./kurse'),
  require('./tanken'),
  require('./autobahn'),
  require('./tagesinhalt')
];
const byId = Object.fromEntries(DIENSTE.map(d => [d.id, d]));

function finde(id) {
  const d = byId[id];
  if (!d) throw new DienstFehler('dienst_unbekannt', `Dienst „${id}“ gibt es nicht`);
  if (d.klasse === 'privat' && !isPrivate()) throw new DienstFehler('nur_privat', `Dienst „${id}“ ist nur im privaten Betrieb verfügbar`);
  return d;
}

// Instanz-Zwischenspeicher: Antworten bleiben bis gueltigBis im Speicher der laufenden Funktion (Vercel nutzt Instanzen mehrfach).
// Schützt die Quellen, wenn viele Anfragen gleichzeitig am CDN vorbeikommen (z. B. zum Takt :00/:30). Nie für private Dienste.
const INSTANZ = new Map(), INSTANZ_MAX = 500;
const schluessel = (id, e) => id + '?' + Object.keys(e).sort().map(k => `${k}=${e[k]}`).join('&');
const laufend = new Map();   // gleichzeitige gleiche Anfragen warten auf dieselbe Berechnung

// Dienst ausführen und in den Rahmen daily/1 packen
async function ausfuehren(id, eingabe = {}, ctx = {}) {
  const d = finde(id);
  const privat = d.klasse === 'privat', k = schluessel(id, eingabe), jetzt = ctx.jetzt || Date.now();
  if (!privat && !ctx.jetzt) {
    const alt = INSTANZ.get(k);
    if (alt && Date.parse(alt.gueltigBis) > jetzt) return alt;
    if (laufend.has(k)) return laufend.get(k);
  }
  const p = (async () => antwort(d, { ...(await d.run(eingabe, ctx)), jetzt: ctx.jetzt }))();
  if (privat || ctx.jetzt) return p;
  laufend.set(k, p);
  try {
    const r = await p;
    INSTANZ.set(k, r);
    if (INSTANZ.size > INSTANZ_MAX) INSTANZ.delete(INSTANZ.keys().next().value);
    return r;
  } finally { laufend.delete(k); }
}

// Paket: mehrere Dienste für denselben Ort in einer Anfrage (weniger Anfragen, schneller auf dem Handy).
// Jeder Dienst behält seinen Rahmen; ein Fehler betrifft nur seinen Teil. Gültig bis zum frühesten gueltigBis.
async function paket(ids, eingabe = {}, ctx = {}) {
  const liste = [...new Set(ids)].slice(0, 10);
  if (!liste.length) throw new DienstFehler('eingabe_fehlt', 'Parameter dienste fehlt (z. B. dienste=wetter,regen)');
  const antworten = {};
  await Promise.all(liste.map(async id => {
    try { antworten[id] = await ausfuehren(id, eingabe, ctx); }
    catch (e) { antworten[id] = fehlerAntwort(id, e instanceof DienstFehler ? e : new DienstFehler('intern'), ctx.jetzt); }
  }));
  const jetzt = ctx.jetzt || Date.now();
  const gueltig = Object.values(antworten).filter(a => !a.fehler).map(a => Date.parse(a.gueltigBis));
  const bis = gueltig.length ? Math.min(...gueltig) : jetzt + 60e3;
  return { format: 'daily/1', dienst: 'paket', version: 1, programm: null, ort: null, erstellt: iso(jetzt), gueltigBis: iso(bis),
    quellen: [], hinweise: [], daten: { antworten }, fehler: null };
}

// Katalog: was es gibt, was es braucht, wie die Daten aussehen
function katalog() {
  return DIENSTE.filter(d => d.klasse !== 'privat' || isPrivate()).map(d => ({
    id: d.id, version: d.version, programmversion: d.programmversion || null, aenderungen: d.aenderungen || [], titel: d.titel, beschreibung: d.beschreibung, eingaben: d.eingaben,
    laender: d.laender || 'alle', klasse: d.klasse, ttl: d.ttl, takt: d.takt || null, quellen: d.quellen, schema: d.schema, blatt: d.blatt || null
  }));
}

module.exports = { DIENSTE, byId, finde, ausfuehren, paket, katalog, INSTANZ };
