// Dienst „ort“ (Standort): findet Orte
//  – nach Name (q=Neustadt): Open-Meteo Geocoding (GeoNames), Deutschland zuerst, Stadtteile nach hinten, größere Orte vorn
//  – nach Postleitzahl (q=01844): OpenPLZ API (Ort, Landkreis, Bundesland) + Open-Meteo für die Koordinaten
//  – nach Koordinaten (lat, lon – z. B. Gerätestandort): Nominatim/OpenStreetMap (Umkehrsuche)
// Das Ort-Objekt ist die Eingabe fast aller anderen Dienste.
const { getJson } = require('./_lib/http');
const { DienstFehler, runde, text } = require('./_lib/rahmen');
const { S, ORT_VOLL } = require('./_lib/schema');

const Q = {
  geo: { name: 'Open-Meteo Geocoding (GeoNames)', lizenz: 'CC BY 4.0', url: 'https://open-meteo.com/en/docs/geocoding-api' },
  plz: { name: 'OpenPLZ API', lizenz: 'ODbL', url: 'https://www.openplzapi.org' },
  osm: { name: 'Nominatim / OpenStreetMap-Mitwirkende', lizenz: 'ODbL', url: 'https://www.openstreetmap.org/copyright' }
};
const GEO = 'https://geocoding-api.open-meteo.com/v1/search?language=de&format=json';
const quelleFehler = name => e => { throw new DienstFehler('quelle_fehler', `${name}: ${e.message}`); };

// Treffer von Open-Meteo → Ort-Objekt. Bei deutschen Orten steht der Landkreis meist in admin3 (admin2 = Regierungsbezirk).
function ausGeo(r) {
  const land = r.country_code || null;
  return {
    name: r.name, region: r.admin1 || null, land,
    kreis: (land === 'DE' ? (r.admin3 || r.admin2) : r.admin2) || null,
    plz: Array.isArray(r.postcodes) ? r.postcodes.slice(0, 10) : [],
    einwohner: r.population || null,
    typ: /^PPLX/.test(r.feature_code || '') ? 'stadtteil' : 'ort',
    lat: runde(r.latitude, 2), lon: runde(r.longitude, 2), zeitzone: r.timezone || null
  };
}

// Deutschland zuerst, Stadtteile nach hinten, dann nach Einwohnern (unbekannt zuletzt); sonst Reihenfolge der Quelle
function sortiere(orte) {
  return orte.map((o, i) => ({ o, i })).sort((a, b) =>
    (a.o.land === 'DE' ? 0 : 1) - (b.o.land === 'DE' ? 0 : 1) ||
    (a.o.typ === 'stadtteil' ? 1 : 0) - (b.o.typ === 'stadtteil' ? 1 : 0) ||
    (b.o.einwohner || 0) - (a.o.einwohner || 0) || a.i - b.i
  ).map(x => x.o);
}

async function nameSuche(q, anzahl) {
  const j = await getJson(`${GEO}&count=30&name=${encodeURIComponent(q)}`).catch(quelleFehler('Ortssuche'));
  return sortiere((j.results || []).map(ausGeo)).slice(0, anzahl);
}

// Postleitzahl (nur Deutschland): OpenPLZ nennt Ort, Kreis und Land; die Koordinaten kommen von Open-Meteo
async function plzSuche(plz, anzahl) {
  const orte = await getJson(`https://openplzapi.org/de/Localities?postalCode=${plz}`).catch(quelleFehler('Postleitzahl'));
  const ergebnis = [];
  for (const o of (orte || []).slice(0, anzahl)) {
    const land = o.federalState && o.federalState.name, kreis = o.district && o.district.name;
    const j = await getJson(`${GEO}&count=10&countryCode=DE&name=${encodeURIComponent(o.name)}`).catch(() => ({}));
    const kandidaten = (j.results || []).map(ausGeo).filter(g => g.region === land);
    const passend = kandidaten.find(g => g.plz.includes(plz)) || kandidaten.find(g => kreis && g.kreis && g.kreis.includes(kreis)) || kandidaten[0];
    if (!passend) continue;
    ergebnis.push({ ...passend, name: o.name, region: land, kreis: kreis || passend.kreis, plz: [plz], typ: 'ort' });
  }
  return ergebnis;
}

// Umkehrsuche: Koordinaten → Ort (Nominatim erlaubt höchstens 1 Anfrage/Sekunde – DAILY fragt nur beim Einrichten)
async function rueckwaerts(lat, lon) {
  const j = await getJson(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1&accept-language=de&lat=${lat}&lon=${lon}`)
    .catch(quelleFehler('Umkehrsuche'));
  const a = (j && j.address) || {};
  const name = a.city || a.town || a.village || a.municipality || a.county;
  if (!name) return [];
  const land = a.country_code ? a.country_code.toUpperCase() : null;
  return [{
    name, region: a.state || null, land, kreis: a.county || (a.city ? a.city : null),
    plz: a.postcode ? [String(a.postcode)] : [], einwohner: null, typ: 'ort',
    lat, lon, zeitzone: land === 'DE' ? 'Europe/Berlin' : null
  }];
}

async function suche(q, anzahl = 6) {
  return /^\d{5}$/.test(q) ? plzSuche(q, anzahl) : nameSuche(q, anzahl);
}

module.exports = {
  id: 'ort',
  version: 1,
  titel: 'Standort',
  beschreibung: 'Findet Orte nach Name, Postleitzahl (Deutschland) oder Koordinaten – mit Landkreis, Bundesland, Land, Postleitzahlen, Einwohnern und Zeitzone.',
  eingaben: { q: 'Ortsname oder Postleitzahl (mind. 2 Zeichen) – oder –', lat: 'Breitengrad (Umkehrsuche)', lon: 'Längengrad (Umkehrsuche)' },
  laender: 'alle',
  klasse: 'oeffentlich',
  ttl: 86400,
  quellen: [Q.geo],
  schema: S.obj({ orte: S.liste(ORT_VOLL) }),
  async run(eingabe) {
    if (eingabe.lat != null && eingabe.lon != null) {
      const lat = runde(eingabe.lat, 2), lon = runde(eingabe.lon, 2);
      if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new DienstFehler('eingabe_ungueltig', 'lat/lon ungültig');
      return { daten: { orte: await rueckwaerts(lat, lon) }, quellen: [Q.osm] };
    }
    const q = text(eingabe.q, 60);
    if (!q || q.length < 2) throw new DienstFehler('eingabe_fehlt', 'Parameter q (Ortsname oder Postleitzahl) oder lat/lon fehlt');
    const plz = /^\d{5}$/.test(q);
    return { daten: { orte: await suche(q) }, quellen: plz ? [Q.plz, Q.geo] : [Q.geo] };
  },
  suche, sortiere, ausGeo
};
