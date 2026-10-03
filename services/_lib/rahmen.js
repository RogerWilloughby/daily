// DAILY-Austauschformat „daily/1“: der gemeinsame Rahmen jeder Dienst-Antwort.
// Regeln (docs/architektur/dienste.md): reine Daten, keine fertigen Sätze; Zeitpunkte ISO 8601 in UTC („…Z“),
// Kalendertage als JJJJ-MM-TT in der Zeitzone des Orts; Einheit im Feldnamen (tempC, windKmh, regenMm);
// Feldnamen deutsch, camelCase, nur ASCII (ae/oe/ue/ss).

const FORMAT = 'daily/1';

// Fehler mit festem Code; der Router macht daraus Status und Rahmen
class DienstFehler extends Error {
  constructor(code, meldung, status) {
    super(meldung || code);
    this.code = code;
    this.status = status || STATUS[code] || 500;
  }
}
const STATUS = {
  eingabe_fehlt: 400, eingabe_ungueltig: 400, dienst_unbekannt: 404, nur_privat: 404,
  ort_nicht_gefunden: 404, nicht_unterstuetzt: 422, nicht_berechtigt: 401, schluessel_fehlt: 503, quelle_fehler: 502, intern: 500
};

// Zeitpunkt als ISO-UTC ohne Millisekunden
const iso = t => new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z');

// Kalendertag (JJJJ-MM-TT) eines Zeitpunkts in einer Zeitzone
function tagIn(t, zeitzone) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: zeitzone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
  } catch (e) {
    return iso(t).slice(0, 10);
  }
}

// Versatz einer Zeitzone zu UTC in ms zum Zeitpunkt t (Sommerzeit +2 h, Winterzeit +1 h für Europe/Berlin)
function versatzMs(t, zeitzone) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zeitzone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(t)).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(t / 1000) * 1000;
}
// Nächste Mitternacht in einer Zeitzone nach dem Zeitpunkt jetzt (seit App 0.46.2: Tagestakte enden um Mitternacht deutscher Zeit,
// nicht um Mitternacht UTC = 1 bzw. 2 Uhr) – auch an Tagen der Zeitumstellung (23 bzw. 25 Stunden)
function mitternachtNach(jetzt, zeitzone = 'Europe/Berlin') {
  const [j, m, t] = tagIn(jetzt, zeitzone).split('-').map(Number);
  const basis = Date.UTC(j, m - 1, t + 1);                     // Mitternacht des Folgetags, als wäre die Zone UTC
  let x = basis - versatzMs(basis, zeitzone);
  x = basis - versatzMs(x, zeitzone);                          // zweiter Schritt: Versatz, der um diese Mitternacht gilt
  return x;
}
// Ende der Gültigkeit: Tagestakt (Vielfaches von 86400 s) → nächste Mitternacht deutscher Zeit; sonst nächstes Taktende
// (Stunden- und Halbstundentakte sind in UTC und deutscher Zeit gleich); ohne Takt → jetzt + ttl
function gueltigBisVon(dienst, jetzt) {
  if (dienst.takt && dienst.takt % 86400 === 0) return mitternachtNach(jetzt, dienst.zeitzone || 'Europe/Berlin');
  return dienst.takt ? Math.ceil((jetzt + 1) / (dienst.takt * 1000)) * dienst.takt * 1000 : jetzt + dienst.ttl * 1000;
}

// Rahmen einer erfolgreichen Antwort
function antwort(dienst, { ort = null, daten, quellen = [], hinweise = [], jetzt = Date.now() }) {
  return {
    format: FORMAT,
    dienst: dienst.id,
    version: dienst.version,
    programm: dienst.programmversion || null,
    ort,
    erstellt: iso(jetzt),
    gueltigBis: iso(gueltigBisVon(dienst, jetzt)),   // Takt: bis zum nächsten Taktende (z. B. :00/:30, Tagestakt Mitternacht deutscher Zeit)
    quellen: quellen.length ? quellen : dienst.quellen,
    hinweise,
    daten,
    fehler: null
  };
}

// Rahmen einer Fehler-Antwort (gleiche Form, daten = null)
function fehlerAntwort(id, fehler, jetzt = Date.now()) {
  const code = fehler instanceof DienstFehler ? fehler.code : 'intern';
  return {
    format: FORMAT, dienst: id || null, version: null, programm: null, ort: null,
    erstellt: iso(jetzt), gueltigBis: iso(jetzt), quellen: [], hinweise: [], daten: null,
    fehler: { code, meldung: fehler instanceof DienstFehler ? fehler.message : 'Interner Fehler' }
  };
}

// Zahl runden (null bleibt null)
const runde = (v, stellen = 0) => v == null || !Number.isFinite(+v) ? null : Math.round(v * 10 ** stellen) / 10 ** stellen;

// Freitext aus der Anfrage begrenzen
const text = (v, max = 80) => v == null ? null
  : [...String(v)].filter(c => c.charCodeAt(0) >= 32 && c !== '<' && c !== '>').join('').trim().slice(0, max) || null;

module.exports = { FORMAT, DienstFehler, antwort, fehlerAntwort, iso, tagIn, mitternachtNach, gueltigBisVon, runde, text };
