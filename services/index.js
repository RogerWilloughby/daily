// Dienst-Verzeichnis: jeder Dienst ist ein Modul mit id, version, titel, beschreibung, eingaben, laender ('alle' oder Liste wie ['DE']), klasse,
// ttl (Sekunden), quellen, schema (Vertrag für „daten“), blatt (Dienstblatt, siehe _lib/blatt.js) und run(eingabe) → { daten, ort?, hinweise?, quellen? }.
// Neuer Dienst = Modul in services/ + Eintrag in LADER (unten). Aufruf: GET /api/v1/<id>
const { DienstFehler, antwort } = require('./_lib/rahmen');
const { isPrivate } = require('./_lib/http');
const { pruefeEingaben } = require('./_lib/parameter');

// Dienste erst beim ersten Aufruf laden (seit App 0.46.1): Ein Kaltstart der Funktion lädt nur den angefragten Dienst statt aller
// (gemessen auf lokaler Platte: Router mit allen Diensten ≈ 40 ms, jetzt ≈ 3 ms plus der eine Dienst – wächst nicht mehr mit jedem neuen Dienst). Jedes require steht wörtlich da, damit Vercel beim
// Bauen alle Dateien in die Funktion packt (zusammengesetzte Pfade erkennt es nicht sicher). Neuer Dienst = Eintrag hier (Test prüft das).
const LADER = {
  ort: () => require('./ort'),
  wetter: () => require('./wetter'),
  regen: () => require('./regen'),
  wetterhinweise: () => require('./wetterhinweise'),
  feiertage: () => require('./feiertage'),
  himmel: () => require('./himmel'),
  namenstage: () => require('./namenstage'),
  termine: () => require('./termine'),
  finanzen: () => require('./finanzen'),
  kurse: () => require('./kurse'),
  tanken: () => require('./tanken'),
  autobahn: () => require('./autobahn'),
  tagesinhalt: () => require('./tagesinhalt'),
  andiesemtag: () => require('./andiesemtag'),
  fussball: () => require('./fussball'),
  schlagzeilen: () => require('./schlagzeilen')
};
const IDS = Object.keys(LADER);
const gibt = id => Object.prototype.hasOwnProperty.call(LADER, id);
function lade(id) {
  if (!gibt(id)) return undefined;
  const d = LADER[id]();
  if (d.id !== id) throw new Error(`services/index.js: Eintrag „${id}“ lädt Dienst „${d.id}“`);
  return d;
}
// byId: wie ein Objekt Dienst-ID → Dienst, lädt aber erst beim Zugriff; DIENSTE (unten): alle, in fester Reihenfolge (Katalog, Doku, Tests)
const byId = new Proxy({}, {
  get: (_, id) => (typeof id === 'string' ? lade(id) : undefined),
  has: (_, id) => gibt(id),
  ownKeys: () => IDS,
  getOwnPropertyDescriptor: (_, id) => (gibt(id) ? { enumerable: true, configurable: true, value: lade(id) } : undefined)
});
const alle = () => IDS.map(lade);

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
  return alle().filter(d => d.klasse !== 'privat' || isPrivate()).map(d => ({
    id: d.id, version: d.version, programmversion: d.programmversion || null, aenderungen: d.aenderungen || [], titel: d.titel, beschreibung: d.beschreibung, eingaben: d.eingaben,
    laender: d.laender || 'alle', klasse: d.klasse, ttl: d.ttl, takt: d.takt || null, quellen: d.quellen, schema: d.schema, blatt: d.blatt || null
  }));
}

module.exports = { byId, IDS, finde, ausfuehren, katalog, INSTANZ, FEHLER, FEHLER_MS };
// DIENSTE erst beim Zugriff: lädt dann alle Dienste (Katalog, npm run doku, Tests, Testserver)
Object.defineProperty(module.exports, 'DIENSTE', { enumerable: true, get: alle });
