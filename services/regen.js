// Dienst „regen“: Regenradar für einen Ort – jetzt, die nächsten 2 Stunden (5-Minuten-Schritte), letzte Stunde,
// Regen in der Nähe und eine Radarkarte (±50 km, 1 Stunde zurück bis 2 Stunden voraus). Quelle: DWD-Radar (RV-Produkt, 1 km, alle 5 Minuten, Vorhersage +2 h),
// abgerufen über Bright Sky (liefert nur den Ausschnitt um den Ort).
const zlib = require('zlib');
const { getJson } = require('./_lib/http');
const { DienstFehler, iso, runde } = require('./_lib/rahmen');
const { ortAus } = require('./_lib/ort');
const { S } = require('./_lib/schema');
const { zuGrad } = require('./_lib/radolan');

const QUELLEN = [
  { name: 'Deutscher Wetterdienst (Radar RV)', lizenz: 'GeoNutzV (Quellenvermerk)', url: 'https://opendata.dwd.de/weather/radar/composite/rv/' },
  { name: 'Bright Sky', lizenz: 'MIT (Software); Daten DWD', url: 'https://brightsky.dev' }
];
const NAEHE_KM = 25;           // Regen in der Nähe: bis 25 km
const KARTE_RADIUS_KM = 50;    // Ausschnitt (Abruf und Karte): 50 km in jede Richtung
const KARTE_KM = 2;            // Karte: 2-km-Zellen
const KARTE_SCHRITT_MIN = 15;  // Karte: ein Bild alle 15 Minuten

// Regenstärke (mm/h) → Stufe; Grenzen wie beim DWD üblich
const STUFEN = ['kein', 'leicht', 'maessig', 'stark', 'sehr_stark'];
const stufeNr = mmH => (mmH < 0.1 ? 0 : mmH < 2.5 ? 1 : mmH < 10 ? 2 : mmH < 50 ? 3 : 4);
const RICHTUNGEN = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];

// Bright-Sky-Rohdaten eines Bilds → Zahlenfeld (0,01 mm je 5 min), Zeilen von Nord nach Süd
function entpacke(b64, breite, hoehe) {
  const buf = zlib.inflateSync(Buffer.from(b64, 'base64'));
  const werte = new Uint16Array(breite * hoehe);
  for (let i = 0; i < werte.length && 2 * i + 1 < buf.length; i++) werte[i] = buf.readUInt16LE(2 * i);
  return werte;
}
const mmH = v => runde(v * 0.12, 1);   // 0,01 mm / 5 min → mm/h

// Ecken der Karte als Koordinaten (Kanten der Zellen: links oben, rechts oben, links unten) – damit Oberflächen das Radar auf eine Landkarte legen können.
// Pixel i des Rasters reicht von i − 0,5 bis i + 0,5 (services/_lib/radolan.js).
function ecken(bbox, kb, kh) {
  const [oben, links] = bbox, x = links - 0.5, y = oben - 0.5;
  const p = (gx, gy) => { const g = zuGrad(gx, gy); return { lat: runde(g.lat, 5), lon: runde(g.lon, 5) }; };
  return { nw: p(x, y), ne: p(x + kb * KARTE_KM, y), sw: p(x, y + kh * KARTE_KM) };
}

// Antwort der Quelle → Vertrag „regen“ v1 (reine Funktion, testbar)
function umwandeln(q, lon, jetzt = Date.now()) {
  const [oben, links, unten, rechts] = q.bbox;
  const breite = rechts - links + 1, hoehe = unten - oben + 1;
  const px = Math.min(breite - 1, Math.max(0, Math.round(q.latlon_position.x)));
  const py = Math.min(hoehe - 1, Math.max(0, Math.round(q.latlon_position.y)));
  const bilder = (q.radar || []).map(r => ({
    t: Date.parse(r.timestamp),
    lauf: Date.parse(String(r.source || '').split('::')[2] || r.timestamp),   // Zeitpunkt der Messung, aus der das Bild stammt
    werte: entpacke(r.precipitation_5, breite, hoehe)
  })).sort((a, b) => a.t - b.t);
  if (!bilder.length) throw new DienstFehler('quelle_fehler', 'Radar: keine Bilder');
  const letzteMessung = Math.max(...bilder.map(b => b.lauf));
  const amOrt = b => mmH(b.werte[py * breite + px]);

  // Jetzt = jüngstes gemessenes Bild; Verlauf = jetzt bis +2 h
  const gemessen = bilder.filter(b => b.t <= letzteMessung);
  const jetztBild = gemessen[gemessen.length - 1] || bilder[0];
  const zukunft = bilder.filter(b => b.t >= jetztBild.t && b.t <= jetztBild.t + 120 * 60e3);
  const verlauf = zukunft.map(b => { const v = amOrt(b); return { zeit: iso(b.t), mmH: v, stufe: STUFEN[stufeNr(v)], gemessen: b.t <= letzteMessung }; });
  const regnet = verlauf.length && verlauf[0].stufe !== 'kein';
  const minuten = b => Math.round((Date.parse(b.zeit) - jetztBild.t) / 60e3);
  const wechsel = verlauf.find(v => (v.stufe !== 'kein') !== regnet);
  const beginnt = !regnet && wechsel ? { inMinuten: minuten(wechsel), zeit: wechsel.zeit } : null;
  const endet = regnet && wechsel ? { inMinuten: minuten(wechsel), zeit: wechsel.zeit } : null;

  // Letzte Stunde: Summe am Ort und wann es aufgehört hat
  const vergangen = gemessen.filter(b => b.t > jetztBild.t - 60 * 60e3 && b.t <= jetztBild.t);
  const summeMm = runde(vergangen.reduce((s, b) => s + b.werte[py * breite + px] * 0.01, 0), 1);
  let aufgehoert = null;
  if (!regnet) {
    const zuletzt = [...vergangen].reverse().find(b => stufeNr(amOrt(b)) > 0);
    if (zuletzt) aufgehoert = Math.round((jetztBild.t - zuletzt.t) / 60e3);
  }

  // Regen in der Nähe (aktuelles Bild): nächste Zelle mit Regen im Umkreis, Richtung vom Ort aus
  let naehe = null, bestD = Infinity;
  for (let y = 0; y < hoehe; y++) for (let x = 0; x < breite; x++) {
    const v = mmH(jetztBild.werte[y * breite + x]);
    if (stufeNr(v) === 0) continue;
    const dx = x - (q.latlon_position.x), dy = y - (q.latlon_position.y), d = Math.hypot(dx, dy);
    if (d > NAEHE_KM || d >= bestD) continue;
    bestD = d;
    // Rasterwinkel (Norden = oben) → geografische Richtung: Meridiane laufen im Radarraster zum Pol bei 10° Ost
    const grad = ((Math.atan2(dx, -dy) * 180 / Math.PI + (lon - 10)) % 360 + 360) % 360;
    naehe = { entfernungKm: runde(d), richtung: RICHTUNGEN[Math.round(grad / 45) % 8], richtungGrad: runde(grad), stufe: STUFEN[stufeNr(v)] };
  }
  if (naehe && naehe.entfernungKm < 1) naehe = { ...naehe, entfernungKm: 0 };

  // Karte: 2-km-Zellen (stärkste Stufe der 4 Pixel), ein Bild alle 15 Minuten von −60 min bis +2 h; Stufen als Ziffernfolge Zeile für Zeile
  const kb = Math.ceil(breite / KARTE_KM), kh = Math.ceil(hoehe / KARTE_KM);
  const kartenbild = b => {
    let s = '';
    for (let y = 0; y < kh; y++) for (let x = 0; x < kb; x++) {
      let m = 0;
      for (let dy = 0; dy < KARTE_KM; dy++) for (let dx = 0; dx < KARTE_KM; dx++) {
        const yy = y * KARTE_KM + dy, xx = x * KARTE_KM + dx;
        if (yy < hoehe && xx < breite) m = Math.max(m, stufeNr(b.werte[yy * breite + xx] * 0.12));
      }
      s += m;
    }
    return s;
  };
  const kartenBilder = bilder.filter(b => b.t >= jetztBild.t - 60 * 60e3 && b.t <= jetztBild.t + 120 * 60e3 && Math.round((b.t - jetztBild.t) / 60e3) % KARTE_SCHRITT_MIN === 0)
    .map(b => ({ zeit: iso(b.t), gemessen: b.t <= letzteMessung, stufen: kartenbild(b) }));

  return {
    jetzt: { zeit: iso(jetztBild.t), mmH: amOrt(jetztBild), stufe: STUFEN[stufeNr(amOrt(jetztBild))] },
    regnet: !!regnet, beginnt, endet,
    maxMmH: verlauf.length ? Math.max(...verlauf.map(v => v.mmH || 0)) : null,
    verlauf,
    letzteStunde: { summeMm, aufgehoertVorMinuten: aufgehoert },
    naehe,
    karte: { zelleKm: KARTE_KM, breite: kb, hoehe: kh, ortX: runde((q.latlon_position.x + 0.5) / KARTE_KM, 1), ortY: runde((q.latlon_position.y + 0.5) / KARTE_KM, 1),
      ecken: ecken(q.bbox, kb, kh), bilder: kartenBilder }
  };
}

const STUFE = () => ({ type: 'string', enum: STUFEN });
const PUNKT = () => S.obj({ lat: { type: 'number' }, lon: { type: 'number' } });
const ZEITPUNKT = () => S.obj({ inMinuten: S.ganz({ minimum: 0 }), zeit: S.zeit() }, ['inMinuten', 'zeit'], true);
const SCHEMA = S.obj({
  jetzt: S.obj({ zeit: S.zeit(), mmH: S.zahl({ minimum: 0 }), stufe: STUFE() }),
  regnet: S.ja(), beginnt: ZEITPUNKT(), endet: ZEITPUNKT(), maxMmH: S.zahl({ minimum: 0 }),
  verlauf: S.liste(S.obj({ zeit: S.zeit(), mmH: S.zahl({ minimum: 0 }), stufe: STUFE(), gemessen: S.ja() })),
  letzteStunde: S.obj({ summeMm: S.zahl({ minimum: 0 }), aufgehoertVorMinuten: S.ganz({ minimum: 0 }) }),
  naehe: S.obj({ entfernungKm: S.zahl({ minimum: 0 }), richtung: { type: 'string', enum: RICHTUNGEN }, richtungGrad: S.zahl(), stufe: STUFE() }, undefined, true),
  karte: S.obj({ zelleKm: S.ganz(), breite: S.ganz(), hoehe: S.ganz(), ortX: S.zahl(), ortY: S.zahl(),
    ecken: S.obj({ nw: PUNKT(), ne: PUNKT(), sw: PUNKT() }),
    bilder: S.liste(S.obj({ zeit: S.zeit(), gemessen: S.ja(), stufen: { type: 'string', pattern: '^[0-4]*$' } })) })
});

module.exports = {
  id: 'regen',
  version: 1,
  programmversion: '1.1.0',
  aenderungen: [
    { version: '1.1.0', datum: '2026-09-29', text: 'Karte größer: Ausschnitt ±50 km (vorher ±25), Bilder von −60 min bis +2 Std., Ecken als Koordinaten (karte.ecken) für die Landkarte darunter; Regen in der Nähe bleibt bei 25 km' },
    { version: '1.0.0', datum: '2026-09-27', text: 'Erste Fassung: DWD-Radar über Bright Sky – jetzt, 2 Stunden, letzte Stunde, Regen in der Nähe, kleine Karte' }
  ],
  titel: 'Regenradar',
  beschreibung: 'Regen am Ort jetzt und in den nächsten 2 Stunden (5-Minuten-Schritte), „Regen in X Minuten“, letzte Stunde, Regen in der Nähe und eine Radarkarte (100 × 100 km, −1 bis +2 Stunden).',
  eingaben: { ort: 'Ortsname (z. B. Berlin) – oder –', lat: 'Breitengrad', lon: 'Längengrad', name: 'Anzeigename (optional)', region: 'Bundesland (optional)', land: 'Ländercode (optional)' },
  laender: ['DE'],
  klasse: 'oeffentlich',
  ttl: 300,
  takt: 300,   // Radar alle 5 Minuten – Cache läuft zur nächsten vollen 5-Minuten-Marke ab
  quellen: QUELLEN,
  schema: SCHEMA,
  blatt: {
    zweck: 'Beantwortet „Regnet es gleich?“: Regen am Ort jetzt und in den nächsten 2 Stunden, wann er beginnt oder aufhört, was in der letzten Stunde fiel, wo in der Nähe es regnet – dazu eine Radarkarte von 100 × 100 km, die Oberflächen auf eine Landkarte legen können.',
    herkunft: [
      'Deutscher Wetterdienst, Radar-Komposit RV (RADOLAN/RADVOR): 1-km-Raster über Deutschland und angrenzende Gebiete, alle 5 Minuten, mit Niederschlagsvorhersage bis +2 Stunden. Open Data, Nutzung nach GeoNutzV mit Quellenvermerk – auch kommerziell.',
      'Abgerufen über Bright Sky (freie JSON-Schnittstelle zu DWD-Daten, Open Source): nur der Ausschnitt von 50 km um den Ort. Bright Sky lässt sich bei Bedarf selbst betreiben.'
    ],
    verarbeitung: [
      'Ort auf 2 Nachkommastellen (≈ 1 km) gerundet; Ausschnitt ±50 km, 1 Stunde zurück bis 2 Stunden voraus.',
      'Rohwert 0,01 mm je 5 Minuten → mm/h (× 0,12). Stufen: leicht unter 2,5 mm/h, mäßig bis 10, stark bis 50, sehr stark darüber.',
      'Jetzt = jüngstes gemessenes Bild; Bilder danach sind Vorhersage (gemessen: false). „Beginnt/endet“ = erster Wechsel zwischen Regen und trocken im Verlauf.',
      'Regen in der Nähe: nächste Zelle mit Regen im Umkreis von 25 km, Richtung vom Ort aus (Rasterwinkel auf geografisch Nord umgerechnet).',
      'Karte: 2-km-Zellen (stärkste Stufe), ein Bild alle 15 Minuten von −60 Minuten bis +2 Stunden, als Ziffernfolge 0–4 Zeile für Zeile von Nord nach Süd.',
      'Ecken der Karte als Koordinaten: umgerechnet aus dem Radarraster (polare stereografische Projektion des DWD, Parameter wie bei Bright Sky; geprüft an den Eckpunkten des Rasters). Damit legt die Oberfläche das Radar auf eine Landkarte (Abweichung bei 100 km unter 1 km).',
      'Takt: Antworten gelten bis zur nächsten 5-Minuten-Marke – alle Nutzer eines 1-km-Felds teilen sich einen Abruf.'
    ],
    ausgabe: {
      jetzt: 'Regen am Ort im jüngsten Radarbild',
      'jetzt.zeit': 'Zeitpunkt des Bilds (UTC)',
      'jetzt.mmH': 'Regenstärke in mm/h',
      'jetzt.stufe': 'kein, leicht, maessig, stark, sehr_stark',
      regnet: 'true, wenn es am Ort gerade regnet',
      beginnt: 'wann der Regen am Ort beginnt (null: trocken für 2 Stunden oder es regnet schon)',
      'beginnt.inMinuten': 'Minuten ab jetzt',
      'beginnt.zeit': 'Zeitpunkt (UTC)',
      endet: 'wann der Regen am Ort aufhört (null: trocken oder Regen hält 2 Stunden an)',
      'endet.inMinuten': 'Minuten ab jetzt',
      'endet.zeit': 'Zeitpunkt (UTC)',
      maxMmH: 'stärkster Regen am Ort in den nächsten 2 Stunden in mm/h',
      verlauf: 'jetzt bis +2 Stunden in 5-Minuten-Schritten, zeitlich aufsteigend',
      'verlauf[].zeit': 'Zeitpunkt (UTC)',
      'verlauf[].mmH': 'Regenstärke in mm/h',
      'verlauf[].stufe': 'Stufe',
      'verlauf[].gemessen': 'true = Messung, false = Vorhersage',
      letzteStunde: 'Regen am Ort in der letzten Stunde',
      'letzteStunde.summeMm': 'gefallene Menge in mm',
      'letzteStunde.aufgehoertVorMinuten': 'vor wie vielen Minuten der Regen aufgehört hat (null: nicht geregnet oder regnet noch)',
      naehe: 'nächster Regen im Umkreis von 25 km (null: nirgends)',
      'naehe.entfernungKm': 'Entfernung in km (0 = am Ort)',
      'naehe.richtung': 'Richtung vom Ort aus: N, NO, O, SO, S, SW, W, NW',
      'naehe.richtungGrad': 'Richtung in Grad (0 = Nord)',
      'naehe.stufe': 'Stufe dort',
      karte: 'Radarkarte um den Ort, 100 × 100 km (Rasterausrichtung, Norden etwa oben)',
      'karte.zelleKm': 'Kantenlänge einer Zelle in km',
      'karte.breite': 'Zellen je Zeile',
      'karte.hoehe': 'Zeilen',
      'karte.ortX': 'Lage des Orts in Zellen von links',
      'karte.ortY': 'Lage des Orts in Zellen von oben',
      'karte.ecken': 'Ecken der Karte als Koordinaten (äußere Kanten der Zellen)',
      'karte.ecken.nw': 'links oben',
      'karte.ecken.nw.lat': 'Breitengrad',
      'karte.ecken.nw.lon': 'Längengrad',
      'karte.ecken.ne': 'rechts oben',
      'karte.ecken.ne.lat': 'Breitengrad',
      'karte.ecken.ne.lon': 'Längengrad',
      'karte.ecken.sw': 'links unten',
      'karte.ecken.sw.lat': 'Breitengrad',
      'karte.ecken.sw.lon': 'Längengrad',
      'karte.bilder': 'ein Bild je 15 Minuten von −60 Minuten bis +2 Stunden (bis jetzt gemessen, danach Vorhersage)',
      'karte.bilder[].zeit': 'Zeitpunkt (UTC)',
      'karte.bilder[].gemessen': 'true = Messung, false = Vorhersage',
      'karte.bilder[].stufen': 'Stufen 0–4 je Zelle als Ziffernfolge, Zeile für Zeile von Nord nach Süd'
    },
    skalierung: {
      klasse: 'C',
      quelle: 'Bright Sky: kostenlos, ohne Schlüssel, keine veröffentlichte Grenze, keine zugesicherte Verfügbarkeit. DWD-Rohdaten frei (GeoNutzV).',
      kosten: 'Je Aktualisierung 1 Abruf (≈ 103 × 103 Pixel × 37 Bilder, gepackt). Funktion entpackt und rechnet wenige Millisekunden; Antwort ≈ 40 KB (13 Kartenbilder).',
      cache: 'Nur auf Anfrage; CDN und Browser halten die Antwort bis zur nächsten 5-Minuten-Marke. Je belegter 1-km-Zelle höchstens 288 Abrufe/Tag.',
      bei10Mio: 'Bright Sky selbst betreiben (Docker, PostgreSQL) oder die RV-Datei des DWD alle 5 Minuten einmal zentral laden und in einem gemeinsamen Speicher vorhalten – dann ist die Zahl der Quellabrufe unabhängig von der Nutzerzahl (288/Tag).'
    }
  },
  async run(eingabe, { jetzt = Date.now() } = {}) {
    const ort = await ortAus(eingabe);
    const von = new Date(jetzt - 65 * 60e3).toISOString(), bis = new Date(jetzt + 125 * 60e3).toISOString();
    const url = `https://api.brightsky.dev/radar?lat=${ort.lat}&lon=${ort.lon}&distance=${KARTE_RADIUS_KM * 1000 + 1000}&format=compressed` +
      `&date=${encodeURIComponent(von)}&last_date=${encodeURIComponent(bis)}`;
    let q;
    try { q = await getJson(url, { timeout: 9000 }); } catch (e) {
      if (/HTTP 404/.test(e.message)) throw new DienstFehler('nicht_unterstuetzt', 'Ort liegt außerhalb des Radarbereichs');
      throw new DienstFehler('quelle_fehler', 'Radar: ' + e.message);
    }
    if (!q || !q.bbox || !q.latlon_position) throw new DienstFehler('nicht_unterstuetzt', 'Ort liegt außerhalb des Radarbereichs');
    return { ort, daten: umwandeln(q, ort.lon, jetzt) };
  },
  umwandeln, STUFEN
};
