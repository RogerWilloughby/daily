// Dienst-Verzeichnis: jeder Dienst ist ein Modul mit id, version, titel, beschreibung, eingaben, laender ('alle' oder Liste wie ['DE']), klasse,
// ttl (Sekunden), quellen, schema (Vertrag für „daten“), blatt (Dienstblatt, siehe _lib/blatt.js) und run(eingabe) → { daten, ort?, hinweise?, quellen? }.
// Neuer Dienst = Modul in services/ + Eintrag hier. Aufruf: GET /api/v1/<id>
const { DienstFehler, antwort } = require('./_lib/rahmen');
const { isPrivate } = require('./_lib/http');
const { pruefeEingaben } = require('./_lib/parameter');

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
  require('./tagesinhalt'),
  require('./andiesemtag'),
  require('./fussball')
];
const byId = Object.fromEntries(DIENSTE.map(d => [d.id, d]));

function finde(id, ctx = {}) {
  const d = byId[id];
  if (!d) throw new DienstFehler('dienst_unbekannt', `Dienst „${id}“ gibt es nicht`);
  if (d.klasse === 'privat' && !isPrivate()) throw new DienstFehler('nur_privat', `Dienst „${id}“ ist nur im privaten Betrieb verfügbar`);
  if (d.klasse === 'privat' && !ctx.berechtigt) throw new DienstFehler('nicht_berechtigt', 'Kennwort für den privaten Betrieb fehlt oder ist falsch (Einstellungen → Privater Betrieb)');
  return d;
}

// Instanz-Zwischenspeicher: Antworten bleiben bis gueltigBis im Speicher der laufenden Funktion (Vercel nutzt Instanzen mehrfach).
// Schützt die Quellen, wenn viele Anfragen gleichzeitig am CDN vorbeikommen (z. B. zum Takt :00/:30). Nie für private Dienste.
const INSTANZ = new Map(), INSTANZ_MAX = 500;
const schluessel = (id, e) => id + '?' + Object.keys(e).sort().map(k => `${k}=${e[k]}`).join('&');
const laufend = new Map();   // gleichzeitige gleiche Anfragen warten auf dieselbe Berechnung
// Quellenfehler je Anfrage 60 s merken (Review H2): solange fragt diese Instanz die kranke Quelle nicht erneut (das CDN speichert Fehler nicht)
const FEHLER = new Map(), FEHLER_MS = 60e3;

// Dienst ausführen und in den Rahmen daily/1 packen
async function ausfuehren(id, eingabe = {}, ctx = {}) {
  const d = finde(id, ctx);
  eingabe = pruefeEingaben(d, eingabe);   // nur erlaubte Angaben in einer Schreibweise (sonst 400) – daraus auch der Schlüssel
  const privat = d.klasse === 'privat', k = schluessel(id, eingabe), jetzt = ctx.jetzt || Date.now();
  if (!privat && !ctx.jetzt) {
    const alt = INSTANZ.get(k);
    if (alt && Date.parse(alt.gueltigBis) > jetzt) return alt;
    const f = FEHLER.get(k);
    if (f && f.bis > jetzt) throw f.fehler;
    if (laufend.has(k)) return laufend.get(k);
  }
  const p = (async () => antwort(d, { ...(await d.run(eingabe, ctx)), jetzt: ctx.jetzt }))();
  if (privat || ctx.jetzt) return p;
  laufend.set(k, p);
  try {
    const r = await p;
    INSTANZ.set(k, r);
    if (INSTANZ.size > INSTANZ_MAX) INSTANZ.delete(INSTANZ.keys().next().value);
    FEHLER.delete(k);
    return r;
  } catch (e) {
    if (e instanceof DienstFehler && e.code === 'quelle_fehler') {
      FEHLER.set(k, { fehler: e, bis: Date.now() + FEHLER_MS });
      if (FEHLER.size > INSTANZ_MAX) FEHLER.delete(FEHLER.keys().next().value);
    }
    throw e;
  } finally { laufend.delete(k); }
}

// Kein Paket mehr (seit App 0.39.0, Entscheidung 02.10.2026): jeder Dienst ist einzeln abrufbar und verhält sich im Betrieb wie allein –
// eigene Adresse, eigenes Fach im Cache, eigene Gültigkeit, eigene Fehler.

// Katalog: was es gibt, was es braucht, wie die Daten aussehen
function katalog() {
  return DIENSTE.filter(d => d.klasse !== 'privat' || isPrivate()).map(d => ({
    id: d.id, version: d.version, programmversion: d.programmversion || null, aenderungen: d.aenderungen || [], titel: d.titel, beschreibung: d.beschreibung, eingaben: d.eingaben,
    laender: d.laender || 'alle', klasse: d.klasse, ttl: d.ttl, takt: d.takt || null, quellen: d.quellen, schema: d.schema, blatt: d.blatt || null
  }));
}

module.exports = { DIENSTE, byId, finde, ausfuehren, katalog, INSTANZ, FEHLER, FEHLER_MS };
