// Kleiner Schema-Prüfer für die Dienst-Verträge (Teilmenge von JSON Schema, ohne Zusatzpaket).
// Unterstützt: type (auch als Liste), properties, required, items, enum, minimum, maximum, format.

const FORMATE = {
  zeit: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,  // ISO-Zeitpunkt in UTC
  datum: /^\d{4}-\d{2}-\d{2}$/                      // Kalendertag
};

function typVon(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}
const passt = (ist, soll) => ist === soll || (soll === 'number' && ist === 'integer');

// Liefert eine Liste von Fehlern („pfad: Grund“); leer = gültig
function pruefe(wert, schema, pfad = '$') {
  const fehler = [];
  if (!schema) return fehler;
  const ist = typVon(wert);
  if (schema.type) {
    const erlaubt = [].concat(schema.type);
    if (!erlaubt.some(t => passt(ist, t))) return [`${pfad}: erwartet ${erlaubt.join('|')}, ist ${ist}`];
  }
  if (schema.enum && !schema.enum.includes(wert)) fehler.push(`${pfad}: ${JSON.stringify(wert)} nicht in ${schema.enum.join(', ')}`);
  if (ist === 'integer' || ist === 'number') {
    if (schema.minimum != null && wert < schema.minimum) fehler.push(`${pfad}: kleiner als ${schema.minimum}`);
    if (schema.maximum != null && wert > schema.maximum) fehler.push(`${pfad}: größer als ${schema.maximum}`);
  }
  if (ist === 'string' && schema.format && FORMATE[schema.format] && !FORMATE[schema.format].test(wert)) {
    fehler.push(`${pfad}: kein gültiges Format „${schema.format}“ (${wert})`);
  }
  if (ist === 'object') {
    for (const k of schema.required || []) if (!(k in wert)) fehler.push(`${pfad}.${k}: fehlt`);
    for (const [k, s] of Object.entries(schema.properties || {})) if (k in wert) fehler.push(...pruefe(wert[k], s, `${pfad}.${k}`));
  }
  if (ist === 'array' && schema.items) wert.forEach((v, i) => fehler.push(...pruefe(v, schema.items, `${pfad}[${i}]`)));
  return fehler;
}

// Bausteine für Schemas
const S = {
  zahl: (extra = {}) => ({ type: ['number', 'null'], ...extra }),
  ganz: (extra = {}) => ({ type: ['integer', 'null'], ...extra }),
  text: (extra = {}) => ({ type: ['string', 'null'], ...extra }),
  zeit: () => ({ type: ['string', 'null'], format: 'zeit' }),
  datum: () => ({ type: 'string', format: 'datum' }),
  ja: () => ({ type: ['boolean', 'null'] }),
  obj: (properties, required = Object.keys(properties), nullbar = false) => ({ type: nullbar ? ['object', 'null'] : 'object', properties, required }),
  liste: items => ({ type: 'array', items })
};

// Schema des gemeinsamen Rahmens (daily/1); „daten“ prüft der jeweilige Dienst
// Ort-Objekt: name, lat, lon Pflicht; weitere Angaben, soweit bekannt
const ORT_FELDER = {
  name: S.text(), region: S.text(), land: S.text(), kreis: S.text(), plz: S.liste({ type: 'string' }),
  einwohner: S.ganz({ minimum: 0 }), typ: { type: ['string', 'null'], enum: ['ort', 'stadtteil', null] },
  lat: { type: 'number' }, lon: { type: 'number' }, zeitzone: S.text()
};
const ORT = S.obj(ORT_FELDER, ['name', 'lat', 'lon'], true);
// vollständiges Ort-Objekt, wie es der Dienst „ort“ liefert
const ORT_VOLL = S.obj(ORT_FELDER);
const RAHMEN = S.obj({
  format: { type: 'string', enum: ['daily/1'] },
  dienst: S.text(), version: S.ganz(), ort: ORT,
  erstellt: { type: 'string', format: 'zeit' }, gueltigBis: { type: 'string', format: 'zeit' },
  quellen: S.liste(S.obj({ name: { type: 'string' }, lizenz: S.text(), url: S.text() }, ['name'])),
  hinweise: S.liste({ type: 'string' }),
  daten: { type: ['object', 'array', 'null'] },
  fehler: S.obj({ code: { type: 'string' }, meldung: S.text() }, ['code'], true)
});

module.exports = { pruefe, S, ORT, ORT_VOLL, RAHMEN };
