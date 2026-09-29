// Dienst „wetter“ (Referenz-Dienst für das Austauschformat daily/1):
// aktuelles Wetter, 48 Stunden, 15 Tage (ab Tag 8 als Trend), Luftqualität und Pollen für einen Ort.
// Quellen: Open-Meteo (Wettermodelle der Wetterdienste, u. a. DWD) und Open-Meteo Air Quality (CAMS).
const { getJson } = require('./_lib/http');
const { DienstFehler, iso, tagIn, runde } = require('./_lib/rahmen');
const { ortAus } = require('./_lib/ort');
const { S } = require('./_lib/schema');

const QUELLEN = [
  { name: 'Open-Meteo', lizenz: 'CC BY 4.0', url: 'https://open-meteo.com' },
  { name: 'Open-Meteo Air Quality (Copernicus CAMS)', lizenz: 'CC BY 4.0', url: 'https://open-meteo.com/en/docs/air-quality-api' }
];

// WMO-Wettercode → grober, maschinenlesbarer Zustand (Text macht die Darstellung)
const ZUSTAENDE = ['klar', 'ueberwiegend_klar', 'teilweise_bewoelkt', 'bedeckt', 'nebel', 'niesel', 'gefrierender_niesel',
  'regen', 'gefrierender_regen', 'schnee', 'schneegriesel', 'regenschauer', 'schneeschauer', 'gewitter', 'gewitter_hagel', 'unbekannt'];
function zustand(c) {
  if (c == null) return 'unbekannt';
  if (c === 0) return 'klar';
  if (c === 1) return 'ueberwiegend_klar';
  if (c === 2) return 'teilweise_bewoelkt';
  if (c === 3) return 'bedeckt';
  if (c === 45 || c === 48) return 'nebel';
  if (c >= 51 && c <= 55) return 'niesel';
  if (c === 56 || c === 57) return 'gefrierender_niesel';
  if (c >= 61 && c <= 65) return 'regen';
  if (c === 66 || c === 67) return 'gefrierender_regen';
  if (c >= 71 && c <= 75) return 'schnee';
  if (c === 77) return 'schneegriesel';
  if (c >= 80 && c <= 82) return 'regenschauer';
  if (c === 85 || c === 86) return 'schneeschauer';
  if (c === 95) return 'gewitter';
  if (c === 96 || c === 99) return 'gewitter_hagel';
  return 'unbekannt';
}

// Europäischer Luftqualitätsindex → Stufe
const LUFT = ['gut', 'ausreichend', 'maessig', 'schlecht', 'sehr_schlecht', 'extrem_schlecht'];
const luftStufe = v => v == null ? null : LUFT[Math.min(5, Math.floor(v / 20))];

const zeitU = s => s == null ? null : iso(s * 1000); // Unix-Sekunden → ISO-UTC

// Windrichtung in Grad → Himmelsrichtung (8 Sektoren)
const RICHTUNGEN = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
const richtung = g => g == null ? null : RICHTUNGEN[Math.round(((g % 360) + 360) % 360 / 45) % 8];
// Luftdruck-Tendenz über 3 Stunden (Schwelle 1 hPa)
const TENDENZEN = ['steigend', 'gleichbleibend', 'fallend'];
const tendenz = d => d == null ? null : d >= 1 ? 'steigend' : d <= -1 ? 'fallend' : 'gleichbleibend';
const TREND_AB_TAG = 8;   // ab dem 8. Tag nur noch Tendenz
const TAGE = 15;          // so weit reichen die Modelle vollständig (Tag 16 kam oft leer an)
const cmAusM = v => v == null ? null : runde(v * 100);

// Antworten der Quelle → Vertrag „wetter“ v1 (reine Funktion, testbar)
function umwandeln(w, q, jetzt = Date.now()) {
  const zone = w.timezone || 'UTC';
  const c = w.current || {}, h = w.hourly || {}, d = w.daily || {};
  const abStunde = Math.floor(jetzt / 3600e3) * 3600;
  const wert = (feld, k, stellen = 0) => runde(h[feld]?.[k], stellen);

  // Stundenwerte: die nächsten 48 Stunden; dazu je Kalendertag Nullgradgrenze (tiefste) und Schneehöhe (höchste)
  const stunden = [], jeTag = {};
  let jetztK = -1;
  (h.time || []).forEach((t, k) => {
    const tag = tagIn(t * 1000, zone), j = (jeTag[tag] ||= { null0: null, schnee: null, tmin: null, tminT: null, tmax: null, tmaxT: null });
    const f = h.freezing_level_height?.[k], sd = h.snow_depth?.[k];
    if (f != null && (j.null0 == null || f < j.null0)) j.null0 = f;
    if (sd != null && (j.schnee == null || sd > j.schnee)) j.schnee = sd;
    const tc = h.temperature_2m?.[k];   // Zeitpunkt des Tiefst-/Höchstwerts (erste Stunde mit dem Extremwert)
    if (tc != null && (j.tmin == null || tc < j.tmin)) { j.tmin = tc; j.tminT = t; }
    if (tc != null && (j.tmax == null || tc > j.tmax)) { j.tmax = tc; j.tmaxT = t; }
    if (t < abStunde) return;
    if (jetztK < 0) jetztK = k;
    if (stunden.length >= 48) return;
    stunden.push({
      zeit: zeitU(t), tempC: wert('temperature_2m', k, 1), gefuehltC: wert('apparent_temperature', k, 1),
      code: h.weather_code?.[k] ?? null, zustand: zustand(h.weather_code?.[k]),
      regenProzent: h.precipitation_probability?.[k] ?? null, niederschlagMm: wert('precipitation', k, 1), neuschneeCm: wert('snowfall', k, 1),
      windKmh: wert('wind_speed_10m', k), boeenKmh: wert('wind_gusts_10m', k), windRichtungGrad: wert('wind_direction_10m', k),
      wolkenProzent: h.cloud_cover?.[k] ?? null, uvIndex: wert('uv_index', k, 1), sichtweiteM: wert('visibility', k)
    });
  });
  // Luftdruck-Tendenz: Änderung von jetzt bis in 3 Stunden (Vorhersage)
  const p0 = h.pressure_msl?.[jetztK], p3 = h.pressure_msl?.[jetztK + 3];
  const druckAenderung = p0 == null || p3 == null ? null : runde(p3 - p0, 1);

  const tage = (d.time || []).slice(0, TAGE).map((t, k) => {
    const datum = tagIn(t * 1000, zone), minC = runde(d.temperature_2m_min?.[k], 1);
    const niederschlagMm = runde(d.precipitation_sum?.[k], 1), neuschneeCm = runde(d.snowfall_sum?.[k], 1);
    const j = jeTag[datum] || {};
    return {
      datum, trend: k + 1 >= TREND_AB_TAG, code: d.weather_code?.[k] ?? null, zustand: zustand(d.weather_code?.[k]),
      minC, maxC: runde(d.temperature_2m_max?.[k], 1), minZeit: j.tminT == null ? null : zeitU(j.tminT), maxZeit: j.tmaxT == null ? null : zeitU(j.tmaxT),
      regenProzent: d.precipitation_probability_max?.[k] ?? null, niederschlagMm, neuschneeCm,
      schneehoeheCm: cmAusM(j.schnee), nullgradgrenzeM: runde(j.null0),
      frost: minC == null ? null : minC < 0,
      glaette: minC == null ? null : minC <= 0.5 && ((niederschlagMm || 0) > 0 || (neuschneeCm || 0) > 0),
      windMaxKmh: runde(d.wind_speed_10m_max?.[k]), boeenMaxKmh: runde(d.wind_gusts_10m_max?.[k]),
      windRichtungGrad: runde(d.wind_direction_10m_dominant?.[k]), windRichtung: richtung(d.wind_direction_10m_dominant?.[k]),
      sonnenstunden: d.sunshine_duration?.[k] == null ? null : runde(d.sunshine_duration[k] / 3600, 1),
      sonnenaufgang: zeitU(d.sunrise?.[k]), sonnenuntergang: zeitU(d.sunset?.[k]), uvMax: runde(d.uv_index_max?.[k], 1)
    };
  });
  while (tage.length && tage[tage.length - 1].minC == null && tage[tage.length - 1].maxC == null) tage.pop();   // unvollständige Tage am Ende weg
  const qc = q && q.current;
  const luft = qc ? {
    aqi: runde(qc.european_aqi), stufe: luftStufe(qc.european_aqi),
    pollen: { erle: runde(qc.alder_pollen, 1), birke: runde(qc.birch_pollen, 1), graeser: runde(qc.grass_pollen, 1), beifuss: runde(qc.mugwort_pollen, 1), ambrosia: runde(qc.ragweed_pollen, 1) }
  } : null;
  return {
    zeitzone: zone,
    daten: {
      aktuell: {
        zeit: zeitU(c.time), tempC: runde(c.temperature_2m, 1), gefuehltC: runde(c.apparent_temperature, 1),
        code: c.weather_code ?? null, zustand: zustand(c.weather_code), tag: c.is_day == null ? null : c.is_day === 1,
        windKmh: runde(c.wind_speed_10m), boeenKmh: runde(c.wind_gusts_10m),
        windRichtungGrad: runde(c.wind_direction_10m), windRichtung: richtung(c.wind_direction_10m),
        feuchteProzent: c.relative_humidity_2m ?? null, niederschlagMm: runde(c.precipitation, 1),
        wolkenProzent: c.cloud_cover ?? null, uvIndex: runde(c.uv_index, 1),
        luftdruckHpa: runde(c.pressure_msl, 1), druckAenderung3hHpa: druckAenderung, druckTendenz: tendenz(druckAenderung),
        sichtweiteM: runde(c.visibility), taupunktC: runde(c.dew_point_2m, 1), schneehoeheCm: cmAusM(c.snow_depth)
      },
      stunden, tage, luft
    }
  };
}

const Z = () => ({ type: 'string', enum: ZUSTAENDE });
const RICHTUNG = () => ({ type: ['string', 'null'], enum: [...RICHTUNGEN, null] });
const PROZENT = () => S.zahl({ minimum: 0, maximum: 100 });
const SCHEMA = S.obj({
  aktuell: S.obj({ zeit: S.zeit(), tempC: S.zahl(), gefuehltC: S.zahl(), code: S.ganz(), zustand: Z(), tag: S.ja(),
    windKmh: S.zahl(), boeenKmh: S.zahl(), windRichtungGrad: S.zahl(), windRichtung: RICHTUNG(),
    feuchteProzent: PROZENT(), niederschlagMm: S.zahl(), wolkenProzent: PROZENT(), uvIndex: S.zahl(),
    luftdruckHpa: S.zahl(), druckAenderung3hHpa: S.zahl(), druckTendenz: { type: ['string', 'null'], enum: [...TENDENZEN, null] },
    sichtweiteM: S.zahl(), taupunktC: S.zahl(), schneehoeheCm: S.zahl() }),
  stunden: S.liste(S.obj({ zeit: S.zeit(), tempC: S.zahl(), gefuehltC: S.zahl(), code: S.ganz(), zustand: Z(),
    regenProzent: PROZENT(), niederschlagMm: S.zahl(), neuschneeCm: S.zahl(),
    windKmh: S.zahl(), boeenKmh: S.zahl(), windRichtungGrad: S.zahl(), wolkenProzent: PROZENT(), uvIndex: S.zahl(), sichtweiteM: S.zahl() })),
  tage: S.liste(S.obj({ datum: S.datum(), trend: S.ja(), code: S.ganz(), zustand: Z(), minC: S.zahl(), maxC: S.zahl(), minZeit: S.zeit(), maxZeit: S.zeit(),
    regenProzent: PROZENT(), niederschlagMm: S.zahl(), neuschneeCm: S.zahl(), schneehoeheCm: S.zahl(), nullgradgrenzeM: S.zahl(),
    frost: S.ja(), glaette: S.ja(), windMaxKmh: S.zahl(), boeenMaxKmh: S.zahl(), windRichtungGrad: S.zahl(), windRichtung: RICHTUNG(),
    sonnenstunden: S.zahl(), sonnenaufgang: S.zeit(), sonnenuntergang: S.zeit(), uvMax: S.zahl() })),
  luft: S.obj({
    aqi: S.zahl(), stufe: { type: ['string', 'null'], enum: [...LUFT, null] },
    pollen: S.obj({ erle: S.zahl(), birke: S.zahl(), graeser: S.zahl(), beifuss: S.zahl(), ambrosia: S.zahl() })
  }, ['aqi', 'stufe', 'pollen'], true)
});

module.exports = {
  id: 'wetter',
  version: 1,                 // Vertrag (Datenformat)
  programmversion: '1.4.0',   // steigt bei jeder Änderung des Dienstes
  aenderungen: [
    { version: '1.4.0', datum: '2026-09-29', text: '15 statt 16 Tage (der 16. Tag kam oft ohne Werte); Tage am Ende ohne Tiefst- und Höchstwert werden weggelassen' },
    { version: '1.3.0', datum: '2026-09-28', text: 'Je Tag Uhrzeit des Tiefst- und Höchstwerts (minZeit, maxZeit) aus den Stundenwerten' },
    { version: '1.2.0', datum: '2026-09-27', text: '16 Tage (ab Tag 8 Trend), Wind/Sonne/Wolken/Luftdruck/Sicht/Schnee/Frost, Cache-Takt :00/:30' },
    { version: '1.1.0', datum: '2026-09-27', text: 'Dienstblatt (Herkunft, Verarbeitung, Skalierung)' },
    { version: '1.0.0', datum: '2026-09-27', text: 'Erste Fassung im Format daily/1: jetzt, 48 Stunden, 7 Tage, Luft und Pollen (Open-Meteo)' }
  ],
  titel: 'Wetter',
  beschreibung: 'Aktuelles Wetter, 48-Stunden- und 16-Tage-Vorhersage (ab Tag 8 als Trend) mit Wind, Sonne, Wolken, Luftdruck, Sicht, Schnee und Frost, dazu Luftqualität und Pollen für einen Ort.',
  eingaben: { ort: 'Ortsname (z. B. Berlin) – oder –', lat: 'Breitengrad', lon: 'Längengrad', name: 'Anzeigename (optional)', region: 'Bundesland (optional)', land: 'Ländercode (optional)' },
  laender: 'alle',
  klasse: 'oeffentlich',
  ttl: 1800,
  takt: 1800,   // Cache läuft immer zur vollen und halben Stunde ab – alle Nutzer sehen denselben Stand
  quellen: QUELLEN,
  schema: SCHEMA,
  blatt: {
    zweck: 'Wetter für einen Ort: jetzt, die nächsten 48 Stunden und 15 Tage (ab Tag 8 als Trend gekennzeichnet), mit Wind, Sonne, Wolken, Luftdruck, Sicht, Schnee und Frost, dazu Luftqualität und Pollen.',
    herkunft: [
      'Open-Meteo Forecast API („best match“): für Deutschland zuerst DWD ICON-D2 (≈ 2 km, ≈ 2 Tage), dann ICON-EU (≈ 7 km, bis 5 Tage) und ICON global (bis 7,5 Tage), danach ECMWF (bis 15 Tage) und GFS (bis 16 Tage).',
      'Open-Meteo Air Quality API: Luftqualität und Pollen aus Copernicus CAMS (Europa ≈ 11 km).',
      'Frei nutzbar nur nicht kommerziell (keine Werbung, kein Abo): höchstens 600 Aufrufe/Minute, 5.000/Stunde, 10.000/Tag. Entscheidung 27.09.2026: Open-Meteo, solange DAILY nicht kommerziell ist.'
    ],
    verarbeitung: [
      'Ort wird über den Dienst „ort“ aufgelöst oder als lat/lon übernommen und auf 2 Nachkommastellen (≈ 1 km) gerundet.',
      'Open-Meteo wählt die Modellzelle mit ähnlicher Höhe (Höhenmodell 90 m) und rechnet die Temperatur auf die Höhe des Orts um.',
      'Nur auf Anfrage: Der Server fragt Open-Meteo erst, wenn ein Nutzer diesen Ort anfordert und keine frische Antwort im Cache liegt.',
      'Takt: Antworten gelten bis zur nächsten vollen oder halben Stunde – alle Nutzer einer 1-km-Zelle teilen sich einen Abruf und sehen denselben Stand.',
      'WMO-Wettercode → Zustand als Aufzählung (klar, regen, gewitter …); Windrichtung → 8 Himmelsrichtungen; Zeiten als UTC, Tage in der Zeitzone des Orts.',
      'Abgeleitet: Luftdruck-Tendenz (Änderung jetzt → +3 h, ab 1 hPa steigend/fallend), Frost (Tiefstwert unter 0 °C), Glätte (Tiefstwert ≤ 0,5 °C und Niederschlag oder Neuschnee), Nullgradgrenze (tiefste des Tages), Schneehöhe (höchste des Tages).',
      'Tage ab dem 8. sind als Trend gekennzeichnet (trend: true) – Oberflächen zeigen sie zurückhaltend.',
      'Luftqualität optional: fällt sie aus, kommt luft = null und der Hinweis luft_nicht_verfuegbar.'
    ],
    ausgabe: {
      aktuell: 'Wetter jetzt',
      'aktuell.zeit': 'Zeitpunkt der Werte (UTC, 15-Minuten-Raster)',
      'aktuell.tempC': 'Temperatur in °C',
      'aktuell.gefuehltC': 'gefühlte Temperatur in °C',
      'aktuell.code': 'WMO-Wettercode',
      'aktuell.zustand': 'Zustand als Aufzählung (siehe Schema)',
      'aktuell.tag': 'true = Tag, false = Nacht',
      'aktuell.windKmh': 'Wind in km/h (10 m Höhe)',
      'aktuell.boeenKmh': 'Böen in km/h',
      'aktuell.windRichtungGrad': 'Windrichtung in Grad (woher der Wind kommt, 0 = Nord)',
      'aktuell.windRichtung': 'Windrichtung: N, NO, O, SO, S, SW, W, NW',
      'aktuell.feuchteProzent': 'relative Luftfeuchte in %',
      'aktuell.niederschlagMm': 'Niederschlag der letzten Viertelstunde bzw. Stunde in mm',
      'aktuell.wolkenProzent': 'Bewölkung in %',
      'aktuell.uvIndex': 'UV-Index',
      'aktuell.luftdruckHpa': 'Luftdruck auf Meereshöhe in hPa',
      'aktuell.druckAenderung3hHpa': 'Änderung des Luftdrucks von jetzt bis in 3 Stunden in hPa',
      'aktuell.druckTendenz': 'steigend, gleichbleibend oder fallend (Schwelle 1 hPa in 3 h)',
      'aktuell.sichtweiteM': 'Sichtweite in m (unter 1.000 m: Nebel)',
      'aktuell.taupunktC': 'Taupunkt in °C (ab etwa 16 °C schwül)',
      'aktuell.schneehoeheCm': 'Schneehöhe in cm',
      stunden: 'die nächsten 48 Stunden ab der aktuellen, zeitlich aufsteigend',
      'stunden[].zeit': 'Stundenbeginn (UTC)',
      'stunden[].tempC': 'Temperatur in °C',
      'stunden[].gefuehltC': 'gefühlte Temperatur in °C',
      'stunden[].code': 'WMO-Wettercode',
      'stunden[].zustand': 'Zustand als Aufzählung',
      'stunden[].regenProzent': 'Regenwahrscheinlichkeit in %',
      'stunden[].niederschlagMm': 'Niederschlag in mm',
      'stunden[].neuschneeCm': 'Neuschnee in cm',
      'stunden[].windKmh': 'Wind in km/h',
      'stunden[].boeenKmh': 'Böen in km/h',
      'stunden[].windRichtungGrad': 'Windrichtung in Grad',
      'stunden[].wolkenProzent': 'Bewölkung in %',
      'stunden[].uvIndex': 'UV-Index',
      'stunden[].sichtweiteM': 'Sichtweite in m',
      tage: '15 Tage ab heute, zeitlich aufsteigend (am Ende weniger, falls ein Tag ohne Tiefst- und Höchstwert käme)',
      'tage[].datum': 'Kalendertag JJJJ-MM-TT in der Zeitzone des Orts',
      'tage[].trend': 'true ab dem 8. Tag: nur Tendenz, Werte unsicher',
      'tage[].code': 'WMO-Wettercode (bedeutendstes Wetter des Tages)',
      'tage[].zustand': 'Zustand als Aufzählung',
      'tage[].minC': 'Tiefstwert in °C',
      'tage[].maxC': 'Höchstwert in °C',
      'tage[].minZeit': 'Stunde, in der der Tiefstwert erreicht wird (UTC; aus den Stundenwerten, oder null)',
      'tage[].maxZeit': 'Stunde, in der der Höchstwert erreicht wird (UTC; aus den Stundenwerten, oder null)',
      'tage[].regenProzent': 'höchste Regenwahrscheinlichkeit des Tages in %',
      'tage[].niederschlagMm': 'Niederschlagssumme in mm',
      'tage[].neuschneeCm': 'Neuschnee-Summe in cm',
      'tage[].schneehoeheCm': 'höchste Schneehöhe des Tages in cm',
      'tage[].nullgradgrenzeM': 'tiefste Nullgradgrenze des Tages in m (Schneefallgrenze liegt meist 200–300 m tiefer)',
      'tage[].frost': 'true, wenn der Tiefstwert unter 0 °C liegt',
      'tage[].glaette': 'true, wenn Tiefstwert ≤ 0,5 °C und Niederschlag oder Neuschnee',
      'tage[].windMaxKmh': 'höchste Windgeschwindigkeit in km/h',
      'tage[].boeenMaxKmh': 'stärkste Böe in km/h',
      'tage[].windRichtungGrad': 'vorherrschende Windrichtung in Grad',
      'tage[].windRichtung': 'vorherrschende Windrichtung: N, NO, O, SO, S, SW, W, NW',
      'tage[].sonnenstunden': 'Sonnenscheindauer in Stunden',
      'tage[].sonnenaufgang': 'Sonnenaufgang (UTC)',
      'tage[].sonnenuntergang': 'Sonnenuntergang (UTC)',
      'tage[].uvMax': 'höchster UV-Index',
      luft: 'Luftqualität und Pollen jetzt (null, wenn nicht verfügbar)',
      'luft.aqi': 'Europäischer Luftqualitätsindex (0 = sehr gut)',
      'luft.stufe': 'Stufe: gut, ausreichend, maessig, schlecht, sehr_schlecht, extrem_schlecht',
      'luft.pollen': 'Pollenbelastung in Körnern/m³',
      'luft.pollen.erle': 'Erle',
      'luft.pollen.birke': 'Birke',
      'luft.pollen.graeser': 'Gräser',
      'luft.pollen.beifuss': 'Beifuß',
      'luft.pollen.ambrosia': 'Ambrosia'
    },
    hinweise: { luft_nicht_verfuegbar: 'Luftqualität/Pollen gerade nicht abrufbar, Wetter trotzdem vollständig' },
    skalierung: {
      klasse: 'C',
      quelle: 'Open-Meteo frei: 10.000 Aufrufe/Tag, nur nicht kommerziell. Bezahlt: 29 $/Monat für 1 Mio., 99 $/Monat für 5 Mio. Aufrufe; darüber Enterprise.',
      kosten: 'Je Aktualisierung 2 Anfragen an Open-Meteo (Wetter + Luft). Funktion: kurze Laufzeit, fast nur Warten auf die Quelle.',
      cache: 'Nur auf Anfrage; CDN und Browser halten die Antwort bis zur nächsten vollen oder halben Stunde. Je belegter 1-km-Zelle höchstens 48 Aktualisierungen/Tag = 96 Abrufe – das freie Kontingent reicht für rund 100 gleichzeitig genutzte Orte.',
      bei10Mio: 'Nicht mit dem freien Open-Meteo: bei z. B. 50.000 belegten Zellen × 48 Aktualisierungen wären es ~4,8 Mio. Abrufe/Tag. Wege: gröberes Raster (z. B. 0,05° ≈ 5 km), bezahlter Tarif (ab 29 $/Monat) oder DWD-Open-Data (MOSMIX: Abrufe unabhängig von der Nutzerzahl).'
    }
  },
  zustaende: ZUSTAENDE,
  async run(eingabe, { jetzt = Date.now() } = {}) {
    const ort = await ortAus(eingabe);
    const p = `latitude=${ort.lat}&longitude=${ort.lon}&timezone=auto&timeformat=unixtime`;
    const [w, q] = await Promise.all([
      getJson(`https://api.open-meteo.com/v1/forecast?${p}&forecast_days=15&wind_speed_unit=kmh` +
        '&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,is_day,wind_speed_10m,wind_gusts_10m,' +
        'wind_direction_10m,cloud_cover,uv_index,pressure_msl,visibility,dew_point_2m,snow_depth' +
        '&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,snowfall,weather_code,wind_speed_10m,wind_gusts_10m,' +
        'wind_direction_10m,cloud_cover,uv_index,visibility,pressure_msl,freezing_level_height,snow_depth' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,snowfall_sum,sunrise,sunset,' +
        'sunshine_duration,uv_index_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant'),
      getJson(`https://air-quality-api.open-meteo.com/v1/air-quality?${p}&current=european_aqi,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen`).catch(() => null)
    ]).catch(e => { throw new DienstFehler('quelle_fehler', 'Wetter: ' + e.message); });
    const { zeitzone, daten } = umwandeln(w, q, jetzt);
    return { ort: { ...ort, zeitzone: ort.zeitzone || zeitzone }, daten, hinweise: q ? [] : ['luft_nicht_verfuegbar'] };
  },
  umwandeln
};
