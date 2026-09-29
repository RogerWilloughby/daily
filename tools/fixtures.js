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

// Tankerkönig list.php (type=all: alle Sorten je Tankstelle, sortiert nach Entfernung)
const tanken = () => ({ ok: true, license: 'CC BY 4.0 -  https://creativecommons.tankerkoenig.de', data: 'MTS-K', status: 'ok', stations: [
  { id: 's2', name: 'Freie Tankstelle', brand: '', street: 'Budapester Str.', houseNumber: '1', postCode: 1069, place: 'Dresden', lat: 51.0441, lng: 13.7301, dist: 0.9, diesel: 1.599, e5: 1.749, e10: 1.689, isOpen: true },
  { id: 's4', name: 'Shell Dresden', brand: 'Shell', street: 'Bautzner Str.', houseNumber: '', postCode: 1099, place: 'Dresden', lat: 51.061, lng: 13.76, dist: 1.1, diesel: null, e5: false, e10: 1.729, isOpen: true },
  { id: 's3', name: 'JET Dresden', brand: 'JET', street: 'Leipziger Str.', houseNumber: '10', postCode: 1097, place: 'Dresden', lat: 51.07, lng: 13.73, dist: 1.5, diesel: 1.499, e5: 1.599, e10: 1.539, isOpen: false },
  { id: 's1', name: 'Tankstelle Nord', brand: 'ARAL', street: 'Königsbrücker Straße', houseNumber: '96', postCode: 1099, place: 'Dresden', lat: 51.08, lng: 13.76, dist: 2.4, diesel: 1.629, e5: 1.809, e10: 1.749, isOpen: true },
  { id: 's5', name: 'Star Coschütz', brand: 'STAR', street: 'Karlsruher Str.', houseNumber: '85', postCode: 1189, place: 'Dresden', lat: 51.02, lng: 13.72, dist: 3.8, diesel: 1.589, e5: 1.739, e10: 1.689, isOpen: true }
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
      freezing_level_height: hours.map((_, k) => 2400 - (k % 24) * 10), snow_depth: hours.map(() => 0),
      sunshine_duration: hours.map((_, k) => (k % 24 >= 8 && k % 24 <= 16 ? 2400 : 0)) },
    daily: { time: days, weather_code: je([61, 2, 3, 80, 0, 1, 95, 73]), temperature_2m_max: je([16.2, 18.1, 14, 12.5, 17, 19.2, 21, 2]).map((v, k) => (k === T - 1 ? null : v)),
      temperature_2m_min: je([9.4, 8.7, 7, 6.1, 5, 8, 12, -3.5]).map((v, k) => (k === T - 1 ? null : v)), precipitation_probability_max: je([55, 10, 30, 80, 0, 5, 70, 60]),
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


// EZB: Referenzkurse der letzten 90 Tage (neuester Tag zuerst, wie im Original), Leitzinsen und HVPI als SDMX-CSV
const EZB_BASIS = { USD: 1.14, GBP: 0.858, CHF: 0.936, PLN: 4.27, CZK: 24.4, JPY: 178.5, CNY: 8.12 };
function ezbKurse() {
  const tage = [];
  for (let d = 0; tage.length < 64; d++) {
    const t = new Date(now - d * 864e5);
    if (t.getUTCDay() % 6 !== 0) tage.push(t.toISOString().slice(0, 10));
  }
  const cubes = tage.map((tag, i) => `<Cube time="${tag}">` + Object.entries(EZB_BASIS).map(([c, b]) =>
    `<Cube currency="${c}" rate="${+(b * (1 + 0.02 * Math.sin(i / 7) + (i === 0 ? 0.002 : 0))).toFixed(c === 'JPY' ? 2 : 4)}"/>`).join('') + '</Cube>').join('');
  return `<?xml version="1.0" encoding="UTF-8"?><gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref"><gesmes:subject>Reference rates</gesmes:subject><Cube>${cubes}</Cube></gesmes:Envelope>`;
}
const ezbZinsen = () => 'KEY,FREQ,REF_AREA,CURRENCY,PROVIDER_FM,INSTRUMENT_FM,PROVIDER_FM_ID,DATA_TYPE_FM,TIME_PERIOD,OBS_VALUE,TITLE\n' +
  [['DFR', '2025-03-12', 2.5], ['DFR', '2025-06-11', 2.0], ['MRR_FR', '2025-03-12', 2.65], ['MRR_FR', '2025-06-11', 2.15], ['MLFR', '2025-03-12', 2.9], ['MLFR', '2025-06-11', 2.4]]
    .map(([k, t, v]) => `FM.D.U2.EUR.4F.KR.${k}.LEV,D,U2,EUR,4F,KR,${k},LEV,${t},${v},"Satz, Stand"`).join('\n');
const ezbInflation = () => 'KEY,FREQ,REF_AREA,ADJUSTMENT,ICP_ITEM,STS_INSTITUTION,ICP_SUFFIX,TIME_PERIOD,OBS_VALUE\n' +
  [['DE', '2026-07', 2.0], ['DE', '2026-08', 2.1], ['U2', '2026-07', 2.0], ['U2', '2026-08', 2.2]]
    .map(([g, m, v]) => `ICP.M.${g}.N.000000.4.ANR,M,${g},N,000000,4,ANR,${m},${v}`).join('\n');

// Autobahn-API (verkehr.autobahn.de): Aufbau wie die echten Antworten vom 29.09.2026, Strecke A4 Dresden – Chemnitz.
// Zeiten relativ zu jetzt (Ortszeit im Text), damit „läuft gerade“ / „ab heute Abend“ im Testserver stimmt.
const bt = d => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: '2-digit' }).format(d);
const bz = d => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
const abendHeute = (() => { const d = new Date(now); d.setUTCHours(19, 0, 0, 0); if (d <= now) d.setUTCDate(d.getUTCDate() + 1); return d; })();
const ab = (id, typ, titel, unter, [lat, lon], [lat2, lon2], mehr = {}) => ({
  identifier: id, icon: '101', isBlocked: 'false', future: false, extent: `${lat},${lon},${lat2},${lon2}`, point: `${lat},${lon}`,
  startLcPosition: '5', display_type: typ, subtitle: unter, title: titel, coordinate: { lat, long: lon },
  routeRecommendation: [], footer: [], lorryParkingFeatureIcons: [], geometry: { type: 'LineString', coordinates: [[lon, lat], [lon2, lat2]] }, ...mehr
});
function autobahn(url) {
  const m = String(url).match(/autobahn\/(A\d+)\/services\/(\w+)/);
  if (!m) return null;
  const [, strasse, art] = m;
  if (strasse === 'A4') {
    if (art === 'warning') return { warning: [
      ab('INRIX--vi-avl.test-1', 'WARNING', 'A4 | Wilsdruff - Nossen', ' Dresden -> Chemnitz', [51.0551, 13.5201], [51.0602, 13.3301], {
        startTimestamp: ago(25).toISOString().replace(/\.\d{3}Z$/, 'Z'), delayTimeValue: '14', abnormalTrafficType: 'QUEUING_TRAFFIC', averageSpeed: '25', source: 'inrix',
        description: [`Beginn: ${bt(ago(25))} um ${bz(ago(25))} Uhr`, '', 'Angespannte Verkehrslage, stockender Verkehr zwischen Wilsdruff und Nossen', '', 'Verzögerung: 14 Minuten'] }),
      ab('INRIX--vi-avl.test-2', 'WARNING', 'A4 | Frechen-Nord - Köln-Eifeltor', ' Heerlen/Aachen -> Köln', [50.9285, 6.8317], [50.8943, 6.9184], {
        startTimestamp: ago(90).toISOString().replace(/\.\d{3}Z$/, 'Z'), delayTimeValue: '27', abnormalTrafficType: 'QUEUING_TRAFFIC', source: 'inrix',
        description: [`Beginn: ${bt(ago(90))} um ${bz(ago(90))} Uhr`, '', 'Angespannte Verkehrslage...'] }),
      ab('vi-mel.test-3', 'WARNING', 'A4 | Hainichen - Chemnitz-Ost', ' Chemnitz -> Dresden', [50.9701, 13.1203], [50.9001, 13.0002], {
        startTimestamp: ago(10).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        description: [`Beginn: ${bt(ago(10))} um ${bz(ago(10))} Uhr`, '', 'Gegenstände auf der Fahrbahn'] })
    ] };
    if (art === 'closure') return { closure: [
      ab('vi-fbm.test-4', 'CLOSURE_ENTRY_EXIT', 'A4 | Dresden-Altstadt', ' Chemnitz -> Dresden', [51.0701, 13.6801], [51.0701, 13.6801], {
        icon: '262', isBlocked: 'true', startTimestamp: ago(24 * 60).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        impact: { lower: 'Dresden-Altstadt', upper: 'Dresden-Altstadt', symbols: ['CLOSED'] },
        description: [`Beginn: ${bt(ago(24 * 60))} um ${bz(ago(24 * 60))} Uhr`, `Ende: ${bt(inMin(3 * 24 * 60))} um ${bz(inMin(3 * 24 * 60))} Uhr`, '', 'A4: Chemnitz -> Dresden, Auffahrt Dresden-Altstadt gesperrt', '', 'Fahrbahnerneuerung'] }),
      ab('vi-fbm.test-5', 'CLOSURE', 'A4 | Siebenlehn - Nossen', ' Chemnitz -> Dresden', [51.0301, 13.3001], [51.0501, 13.2901], {
        icon: '250', future: true, impact: { lower: 'Nossen', upper: 'Siebenlehn', symbols: ['SEPARATE', 'CLOSED', 'CLOSED'] },
        description: ['Die Baustelle ist zu folgenden Zeiträumen gültig:', `${bt(abendHeute)} ${bz(abendHeute)} bis zum ${bt(new Date(+abendHeute + 8 * 3600e3))} ${bz(new Date(+abendHeute + 8 * 3600e3))} Uhr.`,
          `${bt(new Date(+abendHeute + 7 * 864e5))} ${bz(abendHeute)} bis zum ${bt(new Date(+abendHeute + 7 * 864e5 + 8 * 3600e3))} ${bz(new Date(+abendHeute + 8 * 3600e3))} Uhr.`,
          '(Ende der Gesamtmaßnahme: 30.10.26)', '', 'A4: Chemnitz -> Dresden, zwischen AS Siebenlehn und AS Nossen', '', 'Länge: konnte nicht ermittelt werden', '', 'Vollsperrung für Brückenprüfung'] })
    ] };
    if (art === 'roadworks') return { roadworks: [
      ab('vi-bs.test-6', 'SHORT_TERM_ROADWORKS', 'A4 | Wilsdruff - Dresden-Altstadt', ' Chemnitz -> Dresden', [51.0551, 13.5401], [51.0651, 13.6601], {
        icon: '123', startTimestamp: ago(120).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        description: ['Zeitraum dieser Bauphase:', `Beginn: ${bt(ago(120))} um ${bz(ago(120))} Uhr`, `Ende: ${bt(inMin(360))} um ${bz(inMin(360))} Uhr`, '', 'Länge: 1.2 km | Max. 60 km/h', '', 'Tagesbaustelle, rechter Fahrstreifen gesperrt'] }),
      ab('vi-bs.test-7', 'ROADWORKS', 'A4 | Hainichen - Siebenlehn', ' Dresden -> Chemnitz', [50.9801, 13.1501], [51.0201, 13.2801], {
        icon: '123', startTimestamp: ago(30 * 24 * 60).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        description: ['Zeitraum dieser Bauphase:', `Beginn: ${bt(ago(30 * 24 * 60))} um 09:00 Uhr`, `Ende: ${bt(inMin(60 * 24 * 60))} um 15:00 Uhr`, '', 'Länge: 3.85 km | Max. 80 km/h | Maximale Durchfahrtsbreite: 6.25 m', '', 'Fahrbahnerneuerung'] }),
      ab('2023-001281--vi-bs.test-8', 'ROADWORKS', 'A4 | Aachen-Laurensberg - Aachen', ' Heerlen/Aachen -> Köln', [50.803642258915616, 6.085980568128126], [50.80367511958786, 6.140189036523035], {
        icon: '123', startTimestamp: '2026-08-25T09:00:00+02:00',
        description: ['Zeitraum dieser Bauphase:', 'Beginn: 25.08.26 um 09:00 Uhr', 'Ende: 01.12.26 um 15:00 Uhr', '(Ende der Gesamtmaßnahme: 01.12.26)', '',
          'A4: Heerlen/Aachen -> Köln, zwischen 0.7 km hinter AS Aachen-Laurensberg und 2.2 km vor AK Aachen', '', 'Länge: 3.85 km | Max. 80 km/h | Maximale Durchfahrtsbreite: 6.25 m', '', 'Instandsetzung Grenze NL_D - AK Aachen'] })
    ] };
  }
  if (strasse === 'A13') {
    if (art === 'roadworks') return { roadworks: [
      ab('vi-bs.test-9', 'ROADWORKS', 'A13 | Ruhland - Ortrand', ' Berlin -> Dresden', [51.4501, 13.8501], [51.3901, 13.7801], {
        startTimestamp: ago(10 * 24 * 60).toISOString().replace(/\.\d{3}Z$/, 'Z'), description: ['Länge: 2 km | Max. 80 km/h', 'Fahrbahnerneuerung'] })
    ] };
    return { [art]: [] };
  }
  return null;   // unbekannte Autobahn: 404
}

module.exports = { ezbKurse, ezbZinsen, ezbInflation, rss, atom, yahoo, table1, table2, matches2, pointfinder, departures, onthisday, ics, alerts, school, tanken, forecast, airQuality, geocoding, radar, autobahn };
