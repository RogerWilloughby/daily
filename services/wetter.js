// Dienst „wetter“ (Referenz-Dienst für das Austauschformat daily/1):
// aktuelles Wetter, 48 Stunden, 7 Tage, Luftqualität und Pollen für einen Ort.
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

// Antworten der Quelle → Vertrag „wetter“ v1 (reine Funktion, testbar)
function umwandeln(w, q, jetzt = Date.now()) {
  const zone = w.timezone || 'UTC';
  const c = w.current || {}, h = w.hourly || {}, d = w.daily || {};
  const abStunde = Math.floor(jetzt / 3600e3) * 3600;
  const stunden = [];
  (h.time || []).forEach((t, k) => {
    if (t < abStunde || stunden.length >= 48) return;
    stunden.push({
      zeit: zeitU(t), tempC: runde(h.temperature_2m?.[k], 1), code: h.weather_code?.[k] ?? null, zustand: zustand(h.weather_code?.[k]),
      regenProzent: h.precipitation_probability?.[k] ?? null, niederschlagMm: runde(h.precipitation?.[k], 1)
    });
  });
  const tage = (d.time || []).map((t, k) => ({
    datum: tagIn(t * 1000, zone), code: d.weather_code?.[k] ?? null, zustand: zustand(d.weather_code?.[k]),
    minC: runde(d.temperature_2m_min?.[k], 1), maxC: runde(d.temperature_2m_max?.[k], 1),
    regenProzent: d.precipitation_probability_max?.[k] ?? null, niederschlagMm: runde(d.precipitation_sum?.[k], 1),
    sonnenaufgang: zeitU(d.sunrise?.[k]), sonnenuntergang: zeitU(d.sunset?.[k]), uvMax: runde(d.uv_index_max?.[k], 1)
  }));
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
        windKmh: runde(c.wind_speed_10m), boeenKmh: runde(c.wind_gusts_10m), feuchteProzent: c.relative_humidity_2m ?? null,
        niederschlagMm: runde(c.precipitation, 1)
      },
      stunden, tage, luft
    }
  };
}

const Z = () => ({ type: 'string', enum: ZUSTAENDE });
const SCHEMA = S.obj({
  aktuell: S.obj({ zeit: S.zeit(), tempC: S.zahl(), gefuehltC: S.zahl(), code: S.ganz(), zustand: Z(), tag: S.ja(), windKmh: S.zahl(), boeenKmh: S.zahl(), feuchteProzent: S.zahl({ minimum: 0, maximum: 100 }), niederschlagMm: S.zahl() }),
  stunden: S.liste(S.obj({ zeit: S.zeit(), tempC: S.zahl(), code: S.ganz(), zustand: Z(), regenProzent: S.zahl({ minimum: 0, maximum: 100 }), niederschlagMm: S.zahl() })),
  tage: S.liste(S.obj({ datum: S.datum(), code: S.ganz(), zustand: Z(), minC: S.zahl(), maxC: S.zahl(), regenProzent: S.zahl({ minimum: 0, maximum: 100 }), niederschlagMm: S.zahl(), sonnenaufgang: S.zeit(), sonnenuntergang: S.zeit(), uvMax: S.zahl() })),
  luft: S.obj({
    aqi: S.zahl(), stufe: { type: ['string', 'null'], enum: [...LUFT, null] },
    pollen: S.obj({ erle: S.zahl(), birke: S.zahl(), graeser: S.zahl(), beifuss: S.zahl(), ambrosia: S.zahl() })
  }, ['aqi', 'stufe', 'pollen'], true)
});

module.exports = {
  id: 'wetter',
  version: 1,
  titel: 'Wetter',
  beschreibung: 'Aktuelles Wetter, 48-Stunden- und 7-Tage-Vorhersage, Luftqualität und Pollen für einen Ort.',
  eingaben: { ort: 'Ortsname (z. B. Berlin) – oder –', lat: 'Breitengrad', lon: 'Längengrad', name: 'Anzeigename (optional)', region: 'Bundesland (optional)', land: 'Ländercode (optional)' },
  klasse: 'oeffentlich',
  ttl: 900,
  quellen: QUELLEN,
  schema: SCHEMA,
  zustaende: ZUSTAENDE,
  async run(eingabe, { jetzt = Date.now() } = {}) {
    const ort = await ortAus(eingabe);
    const p = `latitude=${ort.lat}&longitude=${ort.lon}&timezone=auto&timeformat=unixtime`;
    const [w, q] = await Promise.all([
      getJson(`https://api.open-meteo.com/v1/forecast?${p}&forecast_days=7&wind_speed_unit=kmh` +
        '&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,is_day,wind_speed_10m,wind_gusts_10m' +
        '&hourly=temperature_2m,precipitation_probability,precipitation,weather_code' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,uv_index_max'),
      getJson(`https://air-quality-api.open-meteo.com/v1/air-quality?${p}&current=european_aqi,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen`).catch(() => null)
    ]).catch(e => { throw new DienstFehler('quelle_fehler', 'Wetter: ' + e.message); });
    const { zeitzone, daten } = umwandeln(w, q, jetzt);
    return { ort: { ...ort, zeitzone: ort.zeitzone || zeitzone }, daten, hinweise: q ? [] : ['luft_nicht_verfuegbar'] };
  },
  umwandeln
};
