// Ort-Eingabe für Dienste: nur Koordinaten (lat, lon, höchstens 2 Nachkommastellen ≈ 1 km – geprüft in _lib/parameter.js).
// Seit 02.10.2026 (Entscheidung Abschnitt 14) keine Ortssuche per Name und kein Anzeigename mehr: die Adresse ist der Cache-Schlüssel,
// den Namen kennt die Oberfläche. Ortsnamen löst der Dienst „ort“ auf. Der Dienst braucht den Ortsbestand dafür nicht.
const { DienstFehler, runde } = require('./rahmen');

async function ortAus(eingabe) {
  if (eingabe.lat == null || eingabe.lon == null) throw new DienstFehler('eingabe_fehlt', 'Koordinaten fehlen: lat=…&lon=… (einen Ortsnamen löst der Dienst „ort“ auf)');
  const lat = Number(eingabe.lat), lon = Number(eingabe.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new DienstFehler('eingabe_ungueltig', 'lat/lon ungültig');
  }
  return { name: null, region: null, land: null, lat: runde(lat, 2), lon: runde(lon, 2), zeitzone: null };
}

// Grob: liegt der Punkt in Deutschland? (Rahmen um Deutschland; für Dienste mit Quellen nur in Deutschland, z. B. Tanken)
const inDeutschland = (lat, lon) => lat >= 47.2 && lat <= 55.1 && lon >= 5.8 && lon <= 15.1;

module.exports = { ortAus, inDeutschland };
