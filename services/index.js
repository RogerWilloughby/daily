// Dienst-Verzeichnis: jeder Dienst ist ein Modul mit id, version, titel, beschreibung, eingaben, laender ('alle' oder Liste wie ['DE']), klasse,
// ttl (Sekunden), quellen, schema (Vertrag für „daten“), blatt (Dienstblatt, siehe _lib/blatt.js) und run(eingabe) → { daten, ort?, hinweise?, quellen? }.
// Neuer Dienst = Modul in services/ + Eintrag hier. Aufruf: GET /api/v1/<id>
const { DienstFehler, antwort } = require('./_lib/rahmen');
const { isPrivate } = require('./_lib/http');

const DIENSTE = [
  require('./ort'),
  require('./wetter'),
  require('./regen')
];
const byId = Object.fromEntries(DIENSTE.map(d => [d.id, d]));

function finde(id) {
  const d = byId[id];
  if (!d) throw new DienstFehler('dienst_unbekannt', `Dienst „${id}“ gibt es nicht`);
  if (d.klasse === 'privat' && !isPrivate()) throw new DienstFehler('nur_privat', `Dienst „${id}“ ist nur im privaten Betrieb verfügbar`);
  return d;
}

// Dienst ausführen und in den Rahmen daily/1 packen
async function ausfuehren(id, eingabe = {}, ctx = {}) {
  const d = finde(id);
  const r = await d.run(eingabe, ctx);
  return antwort(d, { ...r, jetzt: ctx.jetzt });
}

// Katalog: was es gibt, was es braucht, wie die Daten aussehen
function katalog() {
  return DIENSTE.filter(d => d.klasse !== 'privat' || isPrivate()).map(d => ({
    id: d.id, version: d.version, programmversion: d.programmversion || null, aenderungen: d.aenderungen || [], titel: d.titel, beschreibung: d.beschreibung, eingaben: d.eingaben,
    laender: d.laender || 'alle', klasse: d.klasse, ttl: d.ttl, takt: d.takt || null, quellen: d.quellen, schema: d.schema, blatt: d.blatt || null
  }));
}

module.exports = { DIENSTE, byId, finde, ausfuehren, katalog };
