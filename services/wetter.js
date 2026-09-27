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
  laender: 'alle',
  klasse: 'oeffentlich',
  ttl: 900,
  quellen: QUELLEN,
  schema: SCHEMA,
  blatt: {
    zweck: 'Wetter für einen Ort: jetzt, die nächsten 48 Stunden und 7 Tage, dazu Luftqualität und Pollen. (Stand vor der Überarbeitung – Quelle und Raster werden im nächsten Schritt geprüft.)',
    herkunft: [
      'Open-Meteo Forecast API: kombiniert Wettermodelle der Wetterdienste; für Deutschland u. a. DWD ICON-D2 (≈ 2 km, 2 Tage), ICON-EU (≈ 7 km, 5 Tage) und ICON global (≈ 11 km).',
      'Open-Meteo Air Quality API: Luftqualität und Pollen aus Copernicus CAMS (Europa ≈ 11 km).',
      'Frei nutzbar nur nicht kommerziell: höchstens 600 Aufrufe/Minute, 5.000/Stunde, 10.000/Tag.'
    ],
    verarbeitung: [
      'Ort wird über den Dienst „ort“ aufgelöst oder als lat/lon übernommen und auf 2 Nachkommastellen (≈ 1 km) gerundet.',
      'Open-Meteo wählt die Modellzelle mit ähnlicher Höhe (Höhenmodell 90 m) und rechnet statistisch auf den Punkt herunter.',
      'WMO-Wettercode → Zustand als Aufzählung (klar, regen, gewitter …); Zeiten als UTC, Tage in der Zeitzone des Orts.',
      'Luftqualität optional: fällt sie aus, kommt luft = null und der Hinweis luft_nicht_verfuegbar.'
    ],
    ausgabe: {
      aktuell: 'Wetter jetzt',
      'aktuell.zeit': 'Zeitpunkt der Messung/Analyse (UTC)',
      'aktuell.tempC': 'Temperatur in °C',
      'aktuell.gefuehltC': 'gefühlte Temperatur in °C',
      'aktuell.code': 'WMO-Wettercode',
      'aktuell.zustand': 'Zustand als Aufzählung (siehe Schema)',
      'aktuell.tag': 'true = Tag, false = Nacht',
      'aktuell.windKmh': 'Wind in km/h',
      'aktuell.boeenKmh': 'Böen in km/h',
      'aktuell.feuchteProzent': 'relative Luftfeuchte in %',
      'aktuell.niederschlagMm': 'Niederschlag der letzten Stunde in mm',
      stunden: 'die nächsten 48 Stunden ab der aktuellen, zeitlich aufsteigend',
      'stunden[].zeit': 'Stundenbeginn (UTC)',
      'stunden[].tempC': 'Temperatur in °C',
      'stunden[].code': 'WMO-Wettercode',
      'stunden[].zustand': 'Zustand als Aufzählung',
      'stunden[].regenProzent': 'Regenwahrscheinlichkeit in %',
      'stunden[].niederschlagMm': 'Niederschlag in mm',
      tage: '7 Tage ab heute, zeitlich aufsteigend',
      'tage[].datum': 'Kalendertag JJJJ-MM-TT in der Zeitzone des Orts',
      'tage[].code': 'WMO-Wettercode (bedeutendstes Wetter des Tages)',
      'tage[].zustand': 'Zustand als Aufzählung',
      'tage[].minC': 'Tiefstwert in °C',
      'tage[].maxC': 'Höchstwert in °C',
      'tage[].regenProzent': 'höchste Regenwahrscheinlichkeit des Tages in %',
      'tage[].niederschlagMm': 'Niederschlagssumme in mm',
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
      kosten: 'Je Abruf 2 Anfragen an Open-Meteo (Wetter + Luft). Funktion: kurze Laufzeit, fast nur Warten auf die Quelle.',
      cache: 'CDN 15 min je gerundetem Ort (≈ 1 km). Alle Nutzer in derselben Zelle teilen sich einen Abruf; der Browser hält die Antwort bis gueltigBis.',
      bei10Mio: 'Nicht mit dem freien Open-Meteo: bei z. B. 50.000 belegten Zellen × 96 Aktualisierungen/Tag wären es ~5 Mio. Quellabrufe/Tag. Wege: gröberes Raster (z. B. 0,05° ≈ 5 km) und längere TTL, bezahlter Tarif oder eigene Daten (DWD-Open-Data ICON/MOSMIX selbst aufbereiten) – wird bei der Überarbeitung des Wetterdienstes entschieden.'
    }
  },
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
