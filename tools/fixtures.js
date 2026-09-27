// Beispieldaten für tools/mock-server.js und die Tests (im Format der echten Dienste).
const now = Date.now();
const ago = m => new Date(now - m * 60000);
const inMin = m => new Date(now + m * 60000);

function rss(source) {
  const items = [1, 2, 3].map(k => `<item><title><![CDATA[${source}: Beispielmeldung ${k} für die Testansicht]]></title>
    <link>https://example.org/${encodeURIComponent(source)}/${k}</link><pubDate>${ago(k * 37).toUTCString()}</pubDate></item>`).join('');
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>${source}</title>${items}</channel></rss>`;
}
function atom(source) {
  const entries = [1, 2].map(k => `<entry><title>${source}: Technik-Beispiel ${k}</title>
    <link rel="alternate" type="text/html" href="https://example.org/heise/${k}"/><updated>${ago(k * 50).toISOString()}</updated></entry>`).join('');
  return `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>${source}</title>${entries}</feed>`;
}

const PRICES = { '^GDAXI': [24312.45, 24210], '^GSPC': [6612.3, 6625.1], 'IWDA.AS': [108.42, 108.1], 'BTC-EUR': [98120, 96500],
  'ETH-EUR': [3890.5, 3920], 'EURUSD=X': [1.1734, 1.1702], 'GC=F': [3765.2, 3740.9] };
function yahoo(u) {
  const sym = decodeURIComponent(u.split('/chart/')[1].split('?')[0]);
  const p = PRICES[sym] || [100, 100];
  return { chart: { result: [{ meta: { regularMarketPrice: p[0], chartPreviousClose: p[1], regularMarketTime: Math.floor((now - 600000) / 1000) } }] } };
}

const BL1 = ['FC Bayern München', 'Borussia Dortmund', 'Bayer 04 Leverkusen', 'RB Leipzig', 'VfB Stuttgart', 'Eintracht Frankfurt', 'SC Freiburg', 'VfL Wolfsburg',
  '1. FSV Mainz 05', 'Borussia Mönchengladbach', 'Werder Bremen', 'TSG Hoffenheim', 'FC Augsburg', '1. FC Union Berlin', '1. FC Köln', 'Hamburger SV', 'FC St. Pauli', '1. FC Heidenheim'];
const BL2 = ['SG Dynamo Dresden', 'Hertha BSC', 'FC Schalke 04', 'Hannover 96', 'Fortuna Düsseldorf', '1. FC Nürnberg', 'Karlsruher SC', 'SC Paderborn 07',
  'SV Darmstadt 98', '1. FC Kaiserslautern', 'Holstein Kiel', 'VfL Bochum', 'Eintracht Braunschweig', 'SV Elversberg', 'Preußen Münster', 'Arminia Bielefeld', '1. FC Magdeburg', 'SpVgg Greuther Fürth'];
const tbl = names => names.map((n, i) => ({ teamInfoId: 100 + i + (names === BL2 ? 50 : 0), teamName: n, shortName: n.replace(/^(SG|FC|SV|SC|VfL|VfB|1\. FC|1\. FSV|TSG|SpVgg) /, ''),
  points: 20 - i, opponentGoals: 8 + i, goals: 18 - Math.floor(i / 2), matches: 8, won: 6 - Math.floor(i / 3), lost: Math.floor(i / 3), draw: 2, goalDiff: 10 - i }));
const table1 = () => tbl(BL1);
// Dynamo auf Platz 4
const table2 = () => { const t = tbl(BL2); const d = t.shift(); t.splice(3, 0, d); return t.map((r, i) => ({ ...r, points: 20 - i })); };

function matches2() {
  const t = tbl(BL2), dyn = t[0];
  const team = r => ({ teamInfoId: r.teamInfoId, teamName: r.teamName, shortName: r.shortName });
  const out = [];
  for (let g = 1; g <= 10; g++) {
    const opp = t[g];
    const finished = g <= 8;
    const date = new Date(now + (g - 8.5) * 7 * 864e5);
    out.push({ matchID: g, matchDateTimeUTC: date.toISOString(), group: { groupName: `${g}. Spieltag`, groupOrderID: g },
      team1: team(g % 2 ? dyn : opp), team2: team(g % 2 ? opp : dyn), matchIsFinished: finished,
      matchResults: finished ? [{ resultTypeID: 2, pointsTeam1: g % 3, pointsTeam2: (g + 1) % 2 }] : [] });
    out.push({ matchID: 100 + g, matchDateTimeUTC: date.toISOString(), group: { groupName: `${g}. Spieltag`, groupOrderID: g },
      team1: team(t[11]), team2: team(t[12]), matchIsFinished: finished, matchResults: finished ? [{ resultTypeID: 2, pointsTeam1: 1, pointsTeam2: 1 }] : [] });
  }
  return out;
}

const pointfinder = q => ({ Status: { Code: 'Ok' }, Points: /post/i.test(q || '') ? ['33000037|||Dresden|Postplatz|5660061|4621484|0||'] : [] });
const vvoDate = d => `/Date(${d.getTime()}+0200)/`;
function departures() {
  const lines = [['1', 'Leutewitz', 'Tram'], ['2', 'Kleinzschachwitz', 'Tram'], ['12', 'Striesen', 'Tram'], ['62', 'Löbtau', 'CityBus'], ['7', 'Weixdorf', 'Tram'], ['4', 'Radebeul West', 'Tram']];
  return { Name: 'Postplatz', Place: 'Dresden', Status: { Code: 'Ok' }, Departures: lines.map((l, k) => ({
    Id: 'x' + k, LineName: l[0], Direction: l[1], Mot: l[2], State: k === 2 ? 'Delayed' : 'InTime',
    ScheduledTime: vvoDate(inMin(2 + k * 3)), RealTime: vvoDate(inMin(2 + k * 3 + (k === 2 ? 2 : 0))), Platform: { Name: String(1 + (k % 4)), Type: 'Platform' } })) };
}

const onthisday = () => ({ selected: [
  { year: 1990, text: 'Beispielereignis A für die Testansicht.', pages: [{ content_urls: { desktop: { page: 'https://de.wikipedia.org/wiki/Beispiel_A' } } }] },
  { year: 1950, text: 'Beispielereignis B für die Testansicht.', pages: [{ content_urls: { desktop: { page: 'https://de.wikipedia.org/wiki/Beispiel_B' } } }] },
  { year: 1871, text: 'Beispielereignis C für die Testansicht.', pages: [] }
] });

function ics() {
  const d = (off, h, m = 0) => { const x = new Date(now + off * 864e5); return `${x.getUTCFullYear()}${String(x.getUTCMonth() + 1).padStart(2, '0')}${String(x.getUTCDate()).padStart(2, '0')}T${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}00Z`; };
  const day = off => { const x = new Date(now + off * 864e5); return `${x.getUTCFullYear()}${String(x.getUTCMonth() + 1).padStart(2, '0')}${String(x.getUTCDate()).padStart(2, '0')}`; };
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DAILY//Test//DE',
    'BEGIN:VEVENT', 'UID:a', `DTSTART:${d(0, 21)}`, `DTEND:${d(0, 22)}`, 'SUMMARY:Abendspaziergang', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:b', `DTSTART;VALUE=DATE:${day(1)}`, `DTEND;VALUE=DATE:${day(2)}`, 'SUMMARY:Geburtstag Anna', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:c', `DTSTART:${d(2, 7, 30)}`, `DTEND:${d(2, 8)}`, 'RRULE:FREQ=WEEKLY;COUNT=4', 'SUMMARY:Wochenplanung', 'END:VEVENT',
    'END:VCALENDAR'].join('\r\n');
}

// Bright Sky /alerts (DWD)
const alerts = (withWarning = true) => ({
  alerts: withWarning ? [
    { id: 1, status: 'actual', severity: 'minor', event_de: 'STARKE BÖEN', headline_de: 'Amtliche WARNUNG vor STARKEN BÖEN',
      onset: inMin(60).toISOString(), expires: inMin(600).toISOString(), description_de: 'Es treten Windböen mit Geschwindigkeiten um 55 km/h auf.', instruction_de: '' },
    { id: 2, status: 'actual', severity: 'moderate', event_de: 'STURMBÖEN', headline_de: 'Amtliche WARNUNG vor STURMBÖEN',
      onset: inMin(120).toISOString(), expires: inMin(480).toISOString(), description_de: 'Es treten Sturmböen um 70 km/h auf.', instruction_de: 'Achten Sie auf herabstürzende Äste.' },
    { id: 3, status: 'test', severity: 'extreme', event_de: 'TEST' }
  ] : [],
  location: { warn_cell_id: 814612000, name: 'Stadt Dresden', name_short: 'Dresden', district: 'Dresden', state: 'Sachsen', state_short: 'SN' }
});

// OpenHolidays /SchoolHolidays
const day = d => d.toISOString().slice(0, 10);
const school = () => [
  { id: 'a', startDate: day(inMin(60 * 24 * 12)), endDate: day(inMin(60 * 24 * 24)), type: 'School', name: [{ language: 'DE', text: 'Herbstferien' }] },
  { id: 'b', startDate: day(inMin(60 * 24 * 88)), endDate: day(inMin(60 * 24 * 100)), type: 'School', name: [{ language: 'EN', text: 'Christmas holidays' }, { language: 'DE', text: 'Weihnachtsferien' }] }
];

// Tankerkönig list.php
const fuel = () => ({ ok: true, status: 'ok', stations: [
  { id: 's1', name: 'Tankstelle Nord', brand: 'ARAL', street: 'Königsbrücker Straße', houseNumber: '96', place: 'Dresden', dist: 2.4, price: 1.749, isOpen: true },
  { id: 's2', name: 'Freie Tankstelle', brand: '', street: 'Budapester Str.', houseNumber: '1', place: 'Dresden', dist: 0.9, price: 1.689, isOpen: true },
  { id: 's3', name: 'Zu', brand: 'JET', street: 'Leipziger Str.', houseNumber: '', place: 'Dresden', dist: 1.5, price: 1.599, isOpen: false },
  { id: 's4', name: 'Ohne Preis', brand: 'Shell', street: 'x', place: 'Dresden', dist: 1.1, price: null, isOpen: true }
] });

// ---- Open-Meteo (Format mit timezone=auto & timeformat=unixtime) ----
const ZONE = 'Europe/Berlin';
const offsetSek = t => { const m = /GMT([+-]\d+)(?::(\d+))?/.exec(new Intl.DateTimeFormat('en-US', { timeZone: ZONE, timeZoneName: 'shortOffset' }).format(t)) || [];
  return ((+m[1] || 0) * 60 + Math.sign(+m[1] || 1) * (+m[2] || 0)) * 60; };
const berlinTag = t => new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
const mitternacht = t => (Date.parse(berlinTag(t) + 'T00:00:00Z') - offsetSek(t) * 1000) / 1000; // Unix-Sekunden
function forecast() {
  const m0 = mitternacht(now), off = offsetSek(now), T = 16;
  const hours = Array.from({ length: T * 24 }, (_, k) => m0 + k * 3600);
  const days = Array.from({ length: T }, (_, k) => m0 + k * 86400);
  const je = (werte) => days.map((_, k) => werte[k % werte.length]);
  return {
    latitude: 52.52, longitude: 13.41, timezone: ZONE, utc_offset_seconds: off,
    current: { time: Math.floor(now / 900e3) * 900, temperature_2m: 15.4, apparent_temperature: 13.9, relative_humidity_2m: 71, precipitation: 0,
      weather_code: 2, is_day: 1, wind_speed_10m: 11.2, wind_gusts_10m: 24.8, wind_direction_10m: 250, cloud_cover: 45, uv_index: 2.4,
      pressure_msl: 1016.2, visibility: 24000, dew_point_2m: 10.1, snow_depth: 0 },
    hourly: { time: hours, temperature_2m: hours.map((_, k) => 10 + 6 * Math.sin((k % 24 - 8) / 24 * 2 * Math.PI)),
      apparent_temperature: hours.map((_, k) => 9 + 6 * Math.sin((k % 24 - 8) / 24 * 2 * Math.PI)),
      precipitation_probability: hours.map((_, k) => k % 24 === 17 ? 55 : 8), precipitation: hours.map((_, k) => k % 24 === 17 ? 0.6 : 0),
      snowfall: hours.map(() => 0), weather_code: hours.map((_, k) => k % 24 === 17 ? 61 : 2),
      wind_speed_10m: hours.map(() => 12), wind_gusts_10m: hours.map(() => 25), wind_direction_10m: hours.map(() => 250),
      cloud_cover: hours.map(() => 45), uv_index: hours.map((_, k) => Math.max(0, 3 * Math.sin((k % 24 - 7) / 12 * Math.PI))),
      visibility: hours.map(() => 24000), pressure_msl: hours.map((_, k) => 1016.2 - k * 0.5),   // fallend: -1,5 hPa in 3 h
      freezing_level_height: hours.map((_, k) => 2400 - (k % 24) * 10), snow_depth: hours.map(() => 0) },
    daily: { time: days, weather_code: je([61, 2, 3, 80, 0, 1, 95, 73]), temperature_2m_max: je([16.2, 18.1, 14, 12.5, 17, 19.2, 21, 2]),
      temperature_2m_min: je([9.4, 8.7, 7, 6.1, 5, 8, 12, -3.5]), precipitation_probability_max: je([55, 10, 30, 80, 0, 5, 70, 60]),
      precipitation_sum: je([1.2, 0, 0.3, 6.4, 0, 0, 12, 2]), snowfall_sum: je([0, 0, 0, 0, 0, 0, 0, 3.5]),
      sunrise: days.map(d => d + 6.97 * 3600), sunset: days.map(d => d + 18.87 * 3600),
      sunshine_duration: je([14400, 30000, 9000, 0, 36000, 32000, 5000, 3600]), uv_index_max: je([3.1, 3.4, 2, 1.5, 3.8, 3.6, 2.9, 1]),
      wind_speed_10m_max: je([18, 12, 22, 35, 10, 14, 28, 20]), wind_gusts_10m_max: je([38, 25, 45, 70, 20, 30, 60, 40]),
      wind_direction_10m_dominant: je([250, 270, 180, 225, 90, 45, 315, 0]) }
  };
}
const airQuality = () => ({ timezone: ZONE, current: { time: Math.floor(now / 3600e3) * 3600, european_aqi: 27, alder_pollen: 0, birch_pollen: 0, grass_pollen: 4.2, mugwort_pollen: 1, ragweed_pollen: 0.5 } });
// Open-Meteo Geocoding – nur noch für die Auslandssuche (Deutschland kommt aus dem eigenen Ortsbestand)
const GEO = {
  wien: [
    { id: 2761369, name: 'Wien', latitude: 48.20849, longitude: 16.37208, feature_code: 'PPLC', country_code: 'AT', admin1: 'Wien', admin2: 'Wien Stadt', timezone: 'Europe/Vienna', population: 1691468, postcodes: ['1010'] },
    { id: 7, name: 'Wien', latitude: 44.35, longitude: -89.6, feature_code: 'PPL', country_code: 'US', admin1: 'Wisconsin', admin2: 'Marathon County', timezone: 'America/Chicago', population: 800 },
    { id: 8, name: 'Wien', latitude: 52.0, longitude: 8.0, feature_code: 'PPL', country_code: 'DE', admin1: 'Niedersachsen', timezone: 'Europe/Berlin' }
  ],
  rom: [{ id: 3169070, name: 'Rom', latitude: 41.89193, longitude: 12.51133, feature_code: 'PPLC', country_code: 'IT', admin1: 'Latium', admin2: 'Rom', timezone: 'Europe/Rome', population: 2318895 }]
};
const geocoding = q => ({ results: GEO[String(q || '').toLowerCase()] });

// Bright Sky /radar (format=compressed): 53 × 53 Pixel um den Ort, 1 h zurück bis 2 h voraus.
// Eine Regenzelle zieht von Westen heran (am Ort ab +20 min); vor 45 bis 30 min hat es am Ort leicht geregnet.
function radar(jetzt = now) {
  const zlib = require('zlib');
  const N = 53, M = 26, t0 = Math.floor(jetzt / 300e3) * 300e3, radar = [];
  for (let k = -12; k <= 24; k++) {
    const t = t0 + k * 300e3, feld = Buffer.alloc(N * N * 2);
    const setze = (x, y, v) => { if (x >= 0 && y >= 0 && x < N && y < N) feld.writeUInt16LE(Math.max(v, feld.readUInt16LE(2 * (y * N + x))), 2 * (y * N + x)); };
    if (k >= 0) { const cx = M - 10 + k; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = Math.hypot(x - cx, y - M); if (d <= 6) setze(x, y, Math.round(30 - d * 2.5)); } }
    if (k >= -9 && k <= -6) for (let y = M - 2; y <= M + 2; y++) for (let x = M - 2; x <= M + 2; x++) setze(x, y, 10);
    const lauf = k <= 0 ? t : t0;
    radar.push({ timestamp: new Date(t).toISOString(), source: 'RADOLAN::RV::' + new Date(lauf).toISOString(), precipitation_5: zlib.deflateSync(feld).toString('base64') });
  }
  return { radar, geometry: { type: 'Polygon', coordinates: [] }, bbox: [400, 500, 452, 552], latlon_position: { x: 26.2, y: 25.9 } };
}

module.exports = { rss, atom, yahoo, table1, table2, matches2, pointfinder, departures, onthisday, ics, alerts, school, fuel, forecast, airQuality, geocoding, radar };
