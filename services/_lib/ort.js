// Ort-Eingabe für Dienste: entweder Koordinaten (lat, lon + optional name, region, land, zeitzone)
// oder ein Ortsname (ort=Berlin), der über den Dienst „ort“ aufgelöst wird (erster Treffer).
// Koordinaten werden auf 2 Nachkommastellen (≈ 1 km) gerundet: schützt den genauen Standort und teilt den Cache.
const { DienstFehler, runde, text } = require('./rahmen');

function gueltigeZone(z) {
  if (!z) return null;
  try { new Intl.DateTimeFormat('de-DE', { timeZone: z }); return z; } catch (e) { return null; }
}

async function ortAus(eingabe) {
  const lat = Number(eingabe.lat), lon = Number(eingabe.lon);
  if (eingabe.lat != null && eingabe.lon != null) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      throw new DienstFehler('eingabe_ungueltig', 'lat/lon ungültig');
    }
    return {
      name: text(eingabe.name), region: text(eingabe.region), land: text(eingabe.land, 2),
      lat: runde(lat, 2), lon: runde(lon, 2), zeitzone: gueltigeZone(text(eingabe.zeitzone, 60))
    };
  }
  const q = text(eingabe.ort, 60);
  if (!q) throw new DienstFehler('eingabe_fehlt', 'Ort fehlt: ort=<Name> oder lat=…&lon=…');
  const [treffer] = await require('../ort').suche(q, 1);
  if (!treffer) throw new DienstFehler('ort_nicht_gefunden', `Kein Ort „${q}“ gefunden`);
  return treffer;
}

module.exports = { ortAus };
