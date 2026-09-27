// Dienst „ort“ (Standort): findet Orte
//  – in Deutschland aus dem eigenen Ortsbestand (services/daten/orte-de.json, GeoNames, monatlich erneuert) – ohne externe Anfrage:
//    nach Name (q=Neustadt), nach Postleitzahl (q=01844) und nach Koordinaten (lat, lon – Gerätestandort)
//  – im Ausland nur nach Name, und nur wenn es in Deutschland keinen Treffer gibt: Open-Meteo Geocoding
// Das Ort-Objekt ist die Eingabe fast aller anderen Dienste.
const { getJson } = require('./_lib/http');
const { DienstFehler, runde, text } = require('./_lib/rahmen');
const { S, ORT_VOLL } = require('./_lib/schema');
const orte = require('./_lib/orte');

const Q = {
  gn: { name: 'GeoNames Postal Codes (eigener Ortsbestand)', lizenz: 'CC BY 4.0', url: 'https://www.geonames.org' },
  geo: { name: 'Open-Meteo Geocoding (GeoNames)', lizenz: 'CC BY 4.0', url: 'https://open-meteo.com/en/docs/geocoding-api' }
};
const GEO = 'https://geocoding-api.open-meteo.com/v1/search?language=de&format=json';

// Treffer von Open-Meteo → Ort-Objekt (nur Ausland)
function ausGeo(r) {
  const land = r.country_code || null;
  return {
    name: r.name, region: r.admin1 || null, land, kreis: r.admin2 || null, kreisSchluessel: null,
    plz: Array.isArray(r.postcodes) ? r.postcodes.slice(0, 10) : [],
    einwohner: r.population || null,
    typ: /^PPLX/.test(r.feature_code || '') ? 'stadtteil' : 'ort',
    lat: runde(r.latitude, 2), lon: runde(r.longitude, 2), zeitzone: r.timezone || null
  };
}

// Ausland: Orte vor Stadtteilen, dann nach Einwohnern; deutsche Treffer der Quelle entfallen (die kennt der eigene Bestand besser)
async function auslandSuche(q, anzahl) {
  const j = await getJson(`${GEO}&count=20&name=${encodeURIComponent(q)}`)
    .catch(e => { throw new DienstFehler('quelle_fehler', `Ortssuche Ausland: ${e.message}`); });
  return (j.results || []).filter(r => r.country_code !== 'DE').map(ausGeo)
    .map((o, i) => ({ o, i }))
    .sort((a, b) => (a.o.typ === 'stadtteil') - (b.o.typ === 'stadtteil') || (b.o.einwohner || 0) - (a.o.einwohner || 0) || a.i - b.i)
    .slice(0, anzahl).map(x => x.o);
}

// Suche nach Name oder Postleitzahl → { orte, quellen, hinweise }
// Passt ein deutscher Ort als ganzes Wort („Neustadt“), bleibt es bei Deutschland. Sonst („Wien“, „Paris“) wird zusätzlich
// im Ausland gesucht: exakte Auslandstreffer zuerst, dann deutsche Orte, die nur mit dem Suchwort beginnen („Wiendorf“).
async function finde(q, anzahl = 6) {
  if (/^\d{5}$/.test(q)) return { orte: orte.suchePlz(q, anzahl), quellen: [Q.gn], hinweise: [] };
  const de = orte.sucheName(q, anzahl);
  if (de.some(orte.exakt)) return { orte: de, quellen: [Q.gn], hinweise: [] };
  let aus;
  try { aus = await auslandSuche(q, anzahl); } catch (e) {
    if (de.length) return { orte: de, quellen: [Q.gn], hinweise: ['ausland_nicht_verfuegbar'] };
    throw e;
  }
  const n = orte.norm(q), gleich = aus.filter(o => orte.norm(o.name) === n);
  const liste = [...gleich, ...de, ...aus.filter(o => !gleich.includes(o))].slice(0, anzahl);
  const quellen = [liste.some(o => o.land === 'DE') && Q.gn, liste.some(o => o.land !== 'DE') && Q.geo].filter(Boolean);
  return { orte: liste, quellen: quellen.length ? quellen : [Q.gn], hinweise: liste.some(o => o.land !== 'DE') ? ['ausland'] : [] };
}
const suche = async (q, anzahl = 6) => (await finde(q, anzahl)).orte;

module.exports = {
  id: 'ort',
  version: 1,
  titel: 'Standort',
  beschreibung: 'Findet Orte nach Name, Postleitzahl oder Koordinaten – mit Landkreis, Bundesland, Postleitzahlen und Zeitzone. Deutschland aus eigenem Bestand, Ausland nach Name.',
  eingaben: { q: 'Ortsname oder Postleitzahl (mind. 2 Zeichen) – oder –', lat: 'Breitengrad (Umkehrsuche, nur Deutschland)', lon: 'Längengrad (Umkehrsuche, nur Deutschland)' },
  laender: 'alle',
  klasse: 'oeffentlich',
  ttl: 86400,
  quellen: [Q.gn, Q.geo],
  schema: S.obj({ orte: S.liste(ORT_VOLL) }),
  blatt: {
    zweck: 'Grundlage aller ortsbezogenen Dienste: macht aus einer Eingabe des Nutzers (Name, Postleitzahl oder Gerätestandort) einen eindeutigen Ort mit Koordinaten.',
    herkunft: [
      'Deutschland: eigener Ortsbestand aus den GeoNames-Postleitzahldaten, Einwohnerzahlen aus dem GeoNames-Ortsverzeichnis (beide CC BY 4.0). Monatlich neu erzeugt (tools/orte-daten.js, GitHub Action „Ortsbestand erneuern“). Liegt als Datei beim Dienst – keine externe Anfrage.',
      'Ausland: Open-Meteo Geocoding (Datenbasis GeoNames), nur Namenssuche und nur, wenn kein deutscher Ort genau so heißt.'
    ],
    verarbeitung: [
      'Großkunden-Postleitzahlen (Firmen, Behörden, Kassen) werden beim Erzeugen herausgefiltert.',
      'Bundesland aus dem amtlichen Kreisschlüssel; Stadtteile („Dresden Innere Altstadt“) werden als solche markiert.',
      'Namenssuche: exakter Name bzw. Name mit Zusatz („Neustadt an der Weinstraße“) vor Wortanfängen; Orte vor Stadtteilen; größere Orte vorn (nach Einwohnern, ersatzweise nach Anzahl der Postleitzahlen).',
      'Umkehrsuche: nächster Postleitzahl-Punkt im Umkreis von 25 km; ein Stadtteil wird dem zugehörigen Ort zugeordnet. Zurück kommen die gerundeten Koordinaten des Nutzers.',
      'Koordinaten werden auf 2 Nachkommastellen (≈ 1 km) gerundet.'
    ],
    ausgabe: {
      orte: 'Treffer, beste zuerst (höchstens 6; Umkehrsuche höchstens 1)',
      'orte[].name': 'Ortsname',
      'orte[].region': 'Bundesland bzw. Region',
      'orte[].land': 'Ländercode ISO 3166-1 (DE, AT …)',
      'orte[].kreis': 'Landkreis bzw. kreisfreie Stadt',
      'orte[].kreisSchluessel': 'amtlicher Kreisschlüssel (5 Stellen, nur Deutschland)',
      'orte[].plz': 'Postleitzahlen des Orts (bei PLZ- und Umkehrsuche nur die passende)',
      'orte[].einwohner': 'Einwohnerzahl laut GeoNames, soweit bekannt, sonst null',
      'orte[].typ': 'ort oder stadtteil',
      'orte[].lat': 'Breitengrad, 2 Nachkommastellen',
      'orte[].lon': 'Längengrad, 2 Nachkommastellen',
      'orte[].zeitzone': 'IANA-Zeitzone'
    },
    hinweise: { ausland: 'Ergebnis enthält Orte aus der Auslandssuche', ausland_nicht_verfuegbar: 'Auslandssuche gerade nicht erreichbar, nur deutsche Treffer', ausserhalb: 'Koordinaten liegen außerhalb Deutschlands (Umkehrsuche nur in Deutschland)' },
    skalierung: {
      klasse: 'D',
      quelle: 'Deutschland ohne externe Quelle – unbegrenzt. Ausland: Open-Meteo frei bis 10.000 Aufrufe/Tag (nicht kommerziell), danach ab 29 $/Monat; betrifft nur Suchen ohne passenden deutschen Ort.',
      kosten: 'Rechenzeit der Funktion: Laden des Bestands ≈ 60 ms je Kaltstart, Suche < 5 ms. Keine Gebühren an Dritte (Deutschland).',
      cache: 'CDN 24 h je Suchbegriff bzw. gerundeter Koordinate; der Browser speichert den gewählten Ort dauerhaft – die Suche fällt nur beim Einrichten an.',
      bei10Mio: 'Unkritisch: Ortssuche passiert beim Einrichten, nicht bei jedem Aufruf. Andere Dienste bekommen lat/lon direkt. Ausland ggf. eigener Bestand (GeoNames allCountries) statt Open-Meteo.'
    }
  },
  async run(eingabe) {
    if (eingabe.lat != null && eingabe.lon != null) {
      const lat = Number(eingabe.lat), lon = Number(eingabe.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new DienstFehler('eingabe_ungueltig', 'lat/lon ungültig');
      const o = orte.naechster(lat, lon);
      return { daten: { orte: o ? [o] : [] }, quellen: [Q.gn], hinweise: o ? [] : ['ausserhalb'] };
    }
    const q = text(eingabe.q, 60);
    if (!q || q.length < 2) throw new DienstFehler('eingabe_fehlt', 'Parameter q (Ortsname oder Postleitzahl) oder lat/lon fehlt');
    const r = await finde(q);
    return { daten: { orte: r.orte }, quellen: r.quellen, hinweise: r.hinweise };
  },
  suche, ausGeo
};
