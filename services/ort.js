// Dienst „ort“: Ortssuche. Liefert passende Orte mit Koordinaten, Region (Bundesland), Land und Zeitzone.
// Quelle: Open-Meteo Geocoding (GeoNames). Dieses Ort-Objekt ist die Eingabe fast aller anderen Dienste.
const { getJson } = require('./_lib/http');
const { DienstFehler, runde, text } = require('./_lib/rahmen');
const { S, ORT } = require('./_lib/schema');

const QUELLE = { name: 'Open-Meteo Geocoding (GeoNames)', lizenz: 'CC BY 4.0', url: 'https://open-meteo.com/en/docs/geocoding-api' };

// Treffer der Quelle → Ort-Objekt nach Vertrag
const alsOrt = r => ({
  name: r.name, region: r.admin1 || null, land: r.country_code || null,
  lat: runde(r.latitude, 2), lon: runde(r.longitude, 2), zeitzone: r.timezone || null
});

async function suche(q, anzahl = 6) {
  const j = await getJson(`https://geocoding-api.open-meteo.com/v1/search?count=${anzahl}&language=de&format=json&name=${encodeURIComponent(q)}`)
    .catch(e => { throw new DienstFehler('quelle_fehler', 'Ortssuche: ' + e.message); });
  return (j.results || []).map(alsOrt);
}

module.exports = {
  id: 'ort',
  version: 1,
  titel: 'Ortssuche',
  beschreibung: 'Findet Orte zu einem Namen, mit Koordinaten, Bundesland, Land und Zeitzone.',
  eingaben: { q: 'Ortsname, mindestens 2 Zeichen (Pflicht)' },
  klasse: 'oeffentlich',
  ttl: 86400,
  quellen: [QUELLE],
  schema: S.obj({ orte: S.liste({ ...ORT, type: 'object' }) }),
  async run(eingabe) {
    const q = text(eingabe.q, 60);
    if (!q || q.length < 2) throw new DienstFehler('eingabe_fehlt', 'Parameter q (Ortsname) fehlt');
    return { daten: { orte: await suche(q) } };
  },
  suche
};
