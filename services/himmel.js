// Dienst „himmel“: Mond (Phase, Beleuchtung, Auf- und Untergang), die nächsten Mondphasen mit Supermond,
// Sternschnuppen-Nächte, Sonnen- und Mondfinsternisse, die am Ort zu sehen sind, und der Beginn der Jahreszeiten.
// Alles wird gerechnet – mit Astronomy Engine (MIT-Lizenz, Genauigkeit etwa eine Minute), ohne Abruf fremder Quellen.
const { P } = require('./_lib/parameter');
const A = require('astronomy-engine');
const { iso, runde } = require('./_lib/rahmen');
const { ortAus } = require('./_lib/ort');
const { S } = require('./_lib/schema');

const QUELLEN = [
  { name: 'Astronomy Engine (Berechnung)', lizenz: 'MIT', url: 'https://github.com/cosinekitty/astronomy' },
  { name: 'Sternschnuppen: Termine der International Meteor Organization (Mittelwerte)', lizenz: null, url: 'https://www.imo.net' }
];
const KM_JE_AE = 149597870.7;
const SUPERMOND_KM = 360000;          // Vollmond näher als 360.000 km gilt als Supermond
const FINSTERNIS_JAHRE = 5;           // so weit wird nach sichtbaren Finsternissen gesucht

// Sternschnuppen: [Monat, Tag des Maximums, Name, Anzahl je Stunde unter idealen Bedingungen]
const STROEME = [
  [1, 3, 'Quadrantiden', 80], [4, 22, 'Lyriden', 18], [5, 6, 'Eta-Aquariiden', 40], [8, 12, 'Perseiden', 100],
  [10, 8, 'Draconiden', 10], [10, 21, 'Orioniden', 20], [11, 17, 'Leoniden', 15], [12, 14, 'Geminiden', 150], [12, 22, 'Ursiden', 10]
];
const PHASEN = ['neumond', 'erstes_viertel', 'vollmond', 'letztes_viertel'];
const NAMEN = ['neumond', 'zunehmende_sichel', 'erstes_viertel', 'zunehmender_mond', 'vollmond', 'abnehmender_mond', 'letztes_viertel', 'abnehmende_sichel'];
const TYP = { partial: 'partiell', total: 'total', annular: 'ringfoermig', penumbral: 'halbschatten' };

// Mondphase als Name aus dem Winkel (0 = Neumond, 180 = Vollmond); Viertel und Voll-/Neumond je ±10° (≈ ±20 Std.)
function phasenName(winkel) {
  const w = ((winkel % 360) + 360) % 360;
  if (w < 10 || w >= 350) return 'neumond';
  if (w < 80) return 'zunehmende_sichel';
  if (w < 100) return 'erstes_viertel';
  if (w < 170) return 'zunehmender_mond';
  if (w < 190) return 'vollmond';
  if (w < 260) return 'abnehmender_mond';
  if (w < 280) return 'letztes_viertel';
  return 'abnehmende_sichel';
}
const mondKm = t => runde(A.GeoVector(A.Body.Moon, t, false).Length() * KM_JE_AE, 0);
const hoehe = (koerper, t, beob) => {
  const eq = A.Equator(koerper, t, beob, true, true);
  return A.Horizon(t, beob, eq.ra, eq.dec, 'normal').altitude;
};
const zeit = t => (t ? iso(t.date || t) : null);

function mond(jetzt, beob) {
  const t = A.MakeTime(new Date(jetzt)), winkel = A.MoonPhase(t);
  const auf = A.SearchRiseSet(A.Body.Moon, beob, +1, t, 1.5), unter = A.SearchRiseSet(A.Body.Moon, beob, -1, t, 1.5);
  return {
    name: phasenName(winkel), zunehmend: winkel < 180,
    beleuchtung: Math.round(A.Illumination(A.Body.Moon, t).phase_fraction * 100),
    alterTage: runde(winkel / 360 * 29.530588853, 1),
    aufgang: zeit(auf), untergang: zeit(unter),
    naechsterVollmond: zeit(A.SearchMoonPhase(180, t, 40)), naechsterNeumond: zeit(A.SearchMoonPhase(0, t, 40))
  };
}

// die nächsten 8 Mondphasen (≈ 2 Monate), Vollmond mit Entfernung und Supermond
function mondphasen(jetzt) {
  const out = []; let q = A.SearchMoonQuarter(new Date(jetzt));
  for (let i = 0; i < 8; i++) {
    const km = q.quarter === 2 ? mondKm(q.time) : null;
    out.push({ zeit: zeit(q.time), phase: PHASEN[q.quarter], entfernungKm: km, supermond: km != null && km < SUPERMOND_KM });
    q = A.NextMoonQuarter(q);
  }
  return out;
}

// die nächsten 3 Maxima, mit Mondlicht in der Nacht (viel Mondlicht = weniger Sternschnuppen zu sehen)
function sternschnuppen(jetzt) {
  const y = new Date(jetzt).getUTCFullYear(), gestern = jetzt - 864e5;
  return [y, y + 1].flatMap(j => STROEME.map(([m, d, name, rate]) => ({ t: Date.UTC(j, m - 1, d, 23), name, rate })))
    .filter(s => s.t >= gestern).slice(0, 3)
    .map(s => ({ name: s.name, maximum: new Date(s.t).toISOString().slice(0, 10), proStunde: s.rate,
      mondBeleuchtung: Math.round(A.Illumination(A.Body.Moon, A.MakeTime(new Date(s.t))).phase_fraction * 100) }));
}

// Sichtbarkeit aus der Höhe über dem Horizont zu Beginn, Maximum und Ende
const sicht = hoehen => hoehen.every(h => h > 0) ? 'ganz' : hoehen.some(h => h > 0) ? 'teilweise' : null;

function sonnenfinsternisse(jetzt, beob, bis) {
  const out = []; let e = A.SearchLocalSolarEclipse(new Date(jetzt), beob);
  while (e.peak.time.date.getTime() < bis && out.length < 3) {
    const s = sicht([e.partial_begin.altitude, e.peak.altitude, e.partial_end.altitude]);
    if (s) out.push({ art: 'sonne', typ: TYP[e.kind], beginn: zeit(e.partial_begin.time), maximum: zeit(e.peak.time), ende: zeit(e.partial_end.time),
      bedeckung: Math.round(e.obscuration * 100), hoeheGrad: runde(e.peak.altitude, 0), sichtbar: s });
    e = A.NextLocalSolarEclipse(e.peak.time, beob);
  }
  return out;
}

function mondfinsternisse(jetzt, beob, bis) {
  const out = []; let l = A.SearchLunarEclipse(new Date(jetzt));
  while (l.peak.date.getTime() < bis && out.length < 3) {
    const halb = l.kind === 'penumbral' ? l.sd_penum : l.sd_partial;   // Minuten vom Maximum bis Beginn/Ende
    const beginn = l.peak.AddDays(-halb / 1440), ende = l.peak.AddDays(halb / 1440);
    const s = sicht([beginn, l.peak, ende].map(t => hoehe(A.Body.Moon, t, beob)));
    if (s && l.kind !== 'penumbral') out.push({ art: 'mond', typ: TYP[l.kind], beginn: zeit(beginn), maximum: zeit(l.peak), ende: zeit(ende),
      bedeckung: Math.round(l.obscuration * 100), hoeheGrad: runde(hoehe(A.Body.Moon, l.peak, beob), 0), sichtbar: s });
    l = A.NextLunarEclipse(l.peak);
  }
  return out;
}

// Beginn der Jahreszeiten (astronomisch): die nächsten 4
function jahreszeiten(jetzt) {
  const y = new Date(jetzt).getUTCFullYear();
  return [y, y + 1].flatMap(j => { const s = A.Seasons(j);
    return [[s.mar_equinox, 'fruehling'], [s.jun_solstice, 'sommer'], [s.sep_equinox, 'herbst'], [s.dec_solstice, 'winter']]; })
    .filter(([t]) => t.date.getTime() >= jetzt).slice(0, 4).map(([t, art]) => ({ zeit: zeit(t), art }));
}

// Alles zusammen (rein, testbar)
function berechne(lat, lon, jetzt = Date.now()) {
  const beob = new A.Observer(lat, lon, 0), bis = jetzt + FINSTERNIS_JAHRE * 365.25 * 864e5;
  const finsternisse = [...sonnenfinsternisse(jetzt, beob, bis), ...mondfinsternisse(jetzt, beob, bis)]
    .sort((a, b) => a.maximum.localeCompare(b.maximum));
  return { mond: mond(jetzt, beob), mondphasen: mondphasen(jetzt), sternschnuppen: sternschnuppen(jetzt), finsternisse, jahreszeiten: jahreszeiten(jetzt) };
}

const SCHEMA = S.obj({
  mond: S.obj({ name: { type: 'string', enum: NAMEN }, zunehmend: S.ja(), beleuchtung: S.ganz({ minimum: 0, maximum: 100 }), alterTage: S.zahl({ minimum: 0, maximum: 30 }),
    aufgang: S.zeit(), untergang: S.zeit(), naechsterVollmond: S.zeit(), naechsterNeumond: S.zeit() }),
  mondphasen: S.liste(S.obj({ zeit: S.zeit(), phase: { type: 'string', enum: PHASEN }, entfernungKm: S.ganz(), supermond: S.ja() })),
  sternschnuppen: S.liste(S.obj({ name: S.text(), maximum: S.datum(), proStunde: S.ganz(), mondBeleuchtung: S.ganz({ minimum: 0, maximum: 100 }) })),
  finsternisse: S.liste(S.obj({ art: { type: 'string', enum: ['sonne', 'mond'] }, typ: { type: 'string', enum: Object.values(TYP) },
    beginn: S.zeit(), maximum: S.zeit(), ende: S.zeit(), bedeckung: S.ganz({ minimum: 0, maximum: 100 }), hoeheGrad: S.zahl(), sichtbar: { type: 'string', enum: ['ganz', 'teilweise'] } })),
  jahreszeiten: S.liste(S.obj({ zeit: S.zeit(), art: { type: 'string', enum: ['fruehling', 'sommer', 'herbst', 'winter'] } }))
});

module.exports = {
  id: 'himmel',
  version: 1,
  programmversion: '2.0.0',
  aenderungen: [
    { version: '2.0.0', datum: '2026-10-02', text: 'Eingaben nur noch lat/lon mit höchstens 2 Nachkommastellen; Ortssuche per Name (ort=) sowie name, region, land, zeitzone entfallen – die Antwort enthält keinen Ortsnamen mehr (den kennt die Oberfläche). Unbekannte Angaben werden abgelehnt (Adresse = Cache-Schlüssel, Entscheidung 02.10.2026).' },
    { version: '1.0.0', datum: '2026-09-27', text: 'Erste Fassung als Dienst: Mond, Mondphasen mit Supermond, Sternschnuppen, Finsternisse am Ort, Jahreszeiten – gerechnet mit Astronomy Engine' }
  ],
  titel: 'Himmel',
  beschreibung: 'Mond, Mondphasen, Sternschnuppen, Sonnen- und Mondfinsternisse, die am Ort zu sehen sind, und der Beginn der Jahreszeiten.',
  eingaben: { lat: 'Breitengrad, höchstens 2 Nachkommastellen (z. B. 51.05)', lon: 'Längengrad, höchstens 2 Nachkommastellen (z. B. 13.74)' },
  parameter: { lat: P.lat, lon: P.lon },   // erlaubte Angaben = Cache-Schlüssel (_lib/parameter.js)
  laender: 'alle',
  klasse: 'oeffentlich',
  ttl: 3600,
  takt: 3600,
  quellen: QUELLEN,
  schema: SCHEMA,
  blatt: {
    zweck: 'Sagt, was am Himmel los ist: Vollmond, Supermond, die nächste Sternschnuppen-Nacht, eine Finsternis, die man vom eigenen Ort aus sieht, und wann Frühling, Sommer, Herbst oder Winter beginnen.',
    herkunft: [
      'Berechnung mit Astronomy Engine (freie Bibliothek, MIT-Lizenz, geprüft gegen NASA JPL Horizons und die NOVAS-Rechnung; Genauigkeit etwa eine Minute).',
      'Sternschnuppen: Maxima der großen Ströme nach der International Meteor Organization (Mittelwerte, schwanken von Jahr zu Jahr um etwa einen Tag).'
    ],
    verarbeitung: [
      'Mond: Phase aus dem Winkel zwischen Sonne und Mond; Voll- und Neumond heißen so, solange sie weniger als etwa 20 Stunden entfernt sind.',
      'Supermond: Vollmond, der näher als 360.000 km an der Erde steht.',
      'Finsternisse: Suche 5 Jahre voraus; aufgenommen wird nur, was am Ort über dem Horizont steht (ganz oder teilweise). Halbschatten-Mondfinsternisse sind kaum zu sehen und werden weggelassen. Bedeckung: Anteil der Sonnenscheibe bzw. des Monds im Kernschatten.',
      'Sternschnuppen: die nächsten 3 Maxima mit dem Mondlicht der Nacht – je heller der Mond, desto weniger ist zu sehen.',
      'Kein Abruf fremder Dienste; Koordinaten auf etwa 1 km gerundet.'
    ],
    ausgabe: {
      mond: 'Mond jetzt',
      'mond.name': 'neumond, zunehmende_sichel, erstes_viertel, zunehmender_mond, vollmond, abnehmender_mond, letztes_viertel, abnehmende_sichel',
      'mond.zunehmend': 'true = zunehmend',
      'mond.beleuchtung': 'beleuchteter Anteil in %',
      'mond.alterTage': 'Tage seit Neumond',
      'mond.aufgang': 'nächster Mondaufgang (UTC)',
      'mond.untergang': 'nächster Monduntergang (UTC)',
      'mond.naechsterVollmond': 'nächster Vollmond (UTC)',
      'mond.naechsterNeumond': 'nächster Neumond (UTC)',
      mondphasen: 'die nächsten 8 Hauptphasen',
      'mondphasen[].zeit': 'Zeitpunkt (UTC)',
      'mondphasen[].phase': 'neumond, erstes_viertel, vollmond, letztes_viertel',
      'mondphasen[].entfernungKm': 'Entfernung des Vollmonds in km (sonst null)',
      'mondphasen[].supermond': 'true = Supermond',
      sternschnuppen: 'die nächsten 3 Sternschnuppen-Maxima',
      'sternschnuppen[].name': 'Name des Stroms (z. B. Perseiden)',
      'sternschnuppen[].maximum': 'Nacht des Maximums (Abend dieses Tages)',
      'sternschnuppen[].proStunde': 'Anzahl je Stunde unter idealen Bedingungen',
      'sternschnuppen[].mondBeleuchtung': 'Mondlicht in dieser Nacht in %',
      finsternisse: 'am Ort sichtbare Finsternisse der nächsten 5 Jahre (je Art höchstens 3)',
      'finsternisse[].art': 'sonne oder mond',
      'finsternisse[].typ': 'partiell, total, ringfoermig',
      'finsternisse[].beginn': 'Beginn (UTC)',
      'finsternisse[].maximum': 'größte Bedeckung (UTC)',
      'finsternisse[].ende': 'Ende (UTC)',
      'finsternisse[].bedeckung': 'Bedeckung am Ort in %',
      'finsternisse[].hoeheGrad': 'Höhe über dem Horizont beim Maximum (Grad, negativ = unter dem Horizont)',
      'finsternisse[].sichtbar': 'ganz oder teilweise (z. B. bei Sonnenaufgang)',
      jahreszeiten: 'Beginn der nächsten 4 Jahreszeiten (astronomisch)',
      'jahreszeiten[].zeit': 'Zeitpunkt (UTC)',
      'jahreszeiten[].art': 'fruehling, sommer, herbst, winter'
    },
    skalierung: {
      klasse: 'A',
      quelle: 'keine – alles wird gerechnet.',
      kosten: 'Etwa 20–40 ms Rechenzeit je Ort und Stunde (Finsternissuche am teuersten).',
      cache: 'Takt 1 Stunde; CDN und Browser halten die Antwort bis zur vollen Stunde.',
      bei10Mio: 'Kein Quellenlimit. Rechenzeit ≈ belegte 1-km-Zellen × 24 je Tag; bei Bedarf Finsternisse je 1°-Feld für den Tag vorrechnen.'
    }
  },
  async run(eingabe, { jetzt = Date.now() } = {}) {
    const ort = await ortAus(eingabe);
    return { ort, daten: berechne(ort.lat, ort.lon, jetzt) };
  },
  berechne, phasenName
};
