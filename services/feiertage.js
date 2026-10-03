// Dienst „feiertage“: was im Kalender des Orts wichtig ist – gesetzliche Feiertage des Bundeslands, Schulferien,
// Brückentage, Zeitumstellung, Kalenderwoche und bekannte Aktions- und Brauchtumstage (Muttertag, Advent …).
// Feiertage, Brückentage, Zeitumstellung und Aktionstage rechnet DAILY selbst; Schulferien kommen von OpenHolidays.
const { P } = require('./_lib/parameter');
const { getJson } = require('./_lib/http');
const { DienstFehler, tagIn, text } = require('./_lib/rahmen');
const { S } = require('./_lib/schema');

const QUELLEN = [
  { name: 'DAILY (Berechnung: Feiertage, Brückentage, Zeitumstellung, Aktionstage)', lizenz: null, url: null },
  { name: 'OpenHolidays API (Schulferien)', lizenz: 'Open Data (frei nutzbar, Quellenangabe)', url: 'https://www.openholidaysapi.org' }
];
const TAGE = 400;   // Vorschau: gut ein Jahr

const LAENDER = {
  'Baden-Württemberg': 'BW', 'Bayern': 'BY', 'Berlin': 'BE', 'Brandenburg': 'BB', 'Bremen': 'HB', 'Hamburg': 'HH',
  'Hessen': 'HE', 'Mecklenburg-Vorpommern': 'MV', 'Niedersachsen': 'NI', 'Nordrhein-Westfalen': 'NW',
  'Rheinland-Pfalz': 'RP', 'Saarland': 'SL', 'Sachsen': 'SN', 'Sachsen-Anhalt': 'ST', 'Schleswig-Holstein': 'SH', 'Thüringen': 'TH'
};

// ---- Datumsrechnung (UTC-Tage, keine Zeitzone nötig) ----
const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const plus = (d, n) => new Date(d.getTime() + n * 864e5);
const tag = d => d.toISOString().slice(0, 10);
const wochentag = datum => new Date(datum + 'T00:00:00Z').getUTCDay();

// Ostersonntag (Gauß/Meeus, gregorianisch)
function ostern(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return utc(y, Math.floor((h + l - 7 * m + 114) / 31), ((h + l - 7 * m + 114) % 31) + 1);
}
// n-ter Sonntag eines Monats (n = -1: letzter)
function sonntag(y, monat, n) {
  if (n < 0) { const d = utc(y, monat + 1, 0); return plus(d, -d.getUTCDay()); }
  const d = utc(y, monat, 1); return plus(d, (7 - d.getUTCDay()) % 7 + 7 * (n - 1));
}
// 1. Advent: vierter Sonntag vor dem 25.12.
const advent1 = y => { const w = utc(y, 12, 24); return plus(w, -w.getUTCDay() - 21); };

// Gesetzliche Feiertage (landesweit) eines Jahres
function feiertageJahr(y, st) {
  const E = ostern(y), in_ = l => l.includes(st);
  const bussUndBettag = () => { const n = utc(y, 11, 23), z = ((n.getUTCDay() - 3 + 7) % 7) || 7; return plus(n, -z); };
  return [
    [utc(y, 1, 1), 'Neujahr', true],
    in_(['BW', 'BY', 'ST']) && [utc(y, 1, 6), 'Heilige Drei Könige'],
    in_(['BE', 'MV']) && [utc(y, 3, 8), 'Internationaler Frauentag'],
    [plus(E, -2), 'Karfreitag', true],
    [plus(E, 1), 'Ostermontag', true],
    [utc(y, 5, 1), 'Tag der Arbeit', true],
    [plus(E, 39), 'Christi Himmelfahrt', true],
    [plus(E, 50), 'Pfingstmontag', true],
    in_(['BW', 'BY', 'HE', 'NW', 'RP', 'SL']) && [plus(E, 60), 'Fronleichnam'],
    in_(['SL']) && [utc(y, 8, 15), 'Mariä Himmelfahrt'],
    in_(['TH']) && [utc(y, 9, 20), 'Weltkindertag'],
    [utc(y, 10, 3), 'Tag der Deutschen Einheit', true],
    in_(['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH']) && [utc(y, 10, 31), 'Reformationstag'],
    in_(['BW', 'BY', 'NW', 'RP', 'SL']) && [utc(y, 11, 1), 'Allerheiligen'],
    in_(['SN']) && [bussUndBettag(), 'Buß- und Bettag'],
    [utc(y, 12, 25), '1. Weihnachtstag', true],
    [utc(y, 12, 26), '2. Weihnachtstag', true]
  ].filter(Boolean).map(([d, name, bundesweit]) => ({ datum: tag(d), name, bundesweit: !!bundesweit }));
}

// Brückentag: Feiertag am Dienstag → Montag davor, am Donnerstag → Freitag danach
function brueckentag(datum) {
  const w = wochentag(datum), d = new Date(datum + 'T00:00:00Z');
  return w === 2 ? tag(plus(d, -1)) : w === 4 ? tag(plus(d, 1)) : null;
}

// Aktions- und Brauchtumstage (keine arbeitsfreien Tage); ohne Tage, die im Land schon Feiertag sind
function aktionstageJahr(y, st) {
  const E = ostern(y), A = advent1(y);
  return [
    [utc(y, 2, 14), 'Valentinstag', 'brauch'],
    [plus(E, -52), 'Weiberfastnacht', 'brauch'],
    [plus(E, -48), 'Rosenmontag', 'brauch'],
    [plus(E, -46), 'Aschermittwoch', 'brauch'],
    !['BE', 'MV'].includes(st) && [utc(y, 3, 8), 'Internationaler Frauentag', 'welttag'],
    [plus(E, -7), 'Palmsonntag', 'brauch'],
    [plus(E, -3), 'Gründonnerstag', 'brauch'],
    [E, 'Ostersonntag', 'brauch'],
    [utc(y, 4, 22), 'Tag der Erde', 'welttag'],
    [utc(y, 4, 23), 'Welttag des Buches', 'welttag'],
    [sonntag(y, 5, 2), 'Muttertag', 'brauch'],
    [plus(E, 39), 'Vatertag', 'brauch'],
    [plus(E, 49), 'Pfingstsonntag', 'brauch'],
    [utc(y, 6, 1), 'Internationaler Kindertag', 'welttag'],
    st !== 'TH' && [utc(y, 9, 20), 'Weltkindertag', 'welttag'],
    [sonntag(y, 10, 1), 'Erntedankfest', 'brauch'],
    [utc(y, 10, 4), 'Welttierschutztag', 'welttag'],
    [utc(y, 10, 31), 'Halloween', 'brauch'],
    [utc(y, 11, 11), 'Martinstag', 'brauch'],
    [plus(A, -14), 'Volkstrauertag', 'gedenktag'],
    [plus(A, -7), 'Totensonntag', 'gedenktag'],
    [A, '1. Advent', 'brauch'],
    [utc(y, 12, 6), 'Nikolaus', 'brauch'],
    [plus(A, 7), '2. Advent', 'brauch'],
    [plus(A, 14), '3. Advent', 'brauch'],
    [plus(A, 21), '4. Advent', 'brauch'],
    [utc(y, 12, 24), 'Heiligabend', 'brauch'],
    [utc(y, 12, 31), 'Silvester', 'brauch']
  ].filter(Boolean).map(([d, name, art]) => ({ datum: tag(d), name, art }));
}

// Zeitumstellung: letzter Sonntag im März (Sommerzeit) und Oktober (Winterzeit)
const zeitumstellungJahr = y => [
  { datum: tag(sonntag(y, 3, -1)), art: 'sommerzeit' },
  { datum: tag(sonntag(y, 10, -1)), art: 'winterzeit' }
];

// ISO-Kalenderwoche eines Tages
function kalenderwoche(datum) {
  const d = new Date(datum + 'T00:00:00Z'), w = (d.getUTCDay() + 6) % 7;
  const donnerstag = plus(d, 3 - w), jan4 = utc(donnerstag.getUTCFullYear(), 1, 4);
  return 1 + Math.round(((donnerstag - jan4) / 864e5 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
}

// Schulferien von OpenHolidays → [{ name, von, bis }]
function ferienAus(liste) {
  return (liste || []).map(h => ({
    name: text(((h.name || []).find(n => n.language === 'DE') || (h.name || [])[0] || {}).text || 'Ferien', 80),
    von: h.startDate, bis: h.endDate
  })).filter(h => /^\d{4}-\d{2}-\d{2}$/.test(h.von || '') && /^\d{4}-\d{2}-\d{2}$/.test(h.bis || '')).sort((a, b) => a.von.localeCompare(b.von));
}

// Alles außer den Ferien (rein, testbar): ab „heute“ gut ein Jahr
function berechne(st, heute) {
  const y = +heute.slice(0, 4), bis = tag(plus(new Date(heute + 'T00:00:00Z'), TAGE));
  const im = x => x.datum >= heute && x.datum <= bis;
  const feiertage = [y, y + 1].flatMap(j => feiertageJahr(j, st)).filter(im)
    .map(f => ({ ...f, wochentag: wochentag(f.datum), brueckentag: brueckentag(f.datum) }));
  const frei = new Set(feiertage.map(f => f.datum + f.name));
  const aktionstage = [y, y + 1].flatMap(j => aktionstageJahr(j, st)).filter(im).filter(a => !frei.has(a.datum + a.name))
    .sort((a, b) => a.datum.localeCompare(b.datum));
  const zeitumstellung = [y, y + 1].flatMap(zeitumstellungJahr).filter(im);
  return { heute, kalenderwoche: kalenderwoche(heute), feiertage, aktionstage, zeitumstellung };
}

// Bundesland des Orts: aus der Eingabe (region) oder über den nächsten Ort im eigenen Bestand

const SCHEMA = S.obj({
  bundesland: S.text(), kuerzel: S.text(),
  heute: S.datum(), kalenderwoche: S.ganz({ minimum: 1, maximum: 53 }),
  feiertage: S.liste(S.obj({ datum: S.datum(), name: S.text(), bundesweit: S.ja(), wochentag: S.ganz({ minimum: 0, maximum: 6 }), brueckentag: { type: ['string', 'null'], format: 'datum' } })),
  ferien: { type: ['array', 'null'], items: S.obj({ name: S.text(), von: S.datum(), bis: S.datum() }) },
  zeitumstellung: S.liste(S.obj({ datum: S.datum(), art: { type: 'string', enum: ['sommerzeit', 'winterzeit'] } })),
  aktionstage: S.liste(S.obj({ datum: S.datum(), name: S.text(), art: { type: 'string', enum: ['brauch', 'welttag', 'gedenktag'] } }))
});

module.exports = {
  id: 'feiertage',
  version: 1,
  programmversion: '2.1.1',
  aenderungen: [
    { version: '2.1.1', datum: '2026-10-03', text: 'Tagestakt endet um Mitternacht deutscher Zeit statt um Mitternacht UTC (1 bzw. 2 Uhr) – auch an Tagen der Zeitumstellung.' },
    { version: '2.1.0', datum: '2026-10-02', text: 'Kürzel nur in Großbuchstaben (SN, nicht sn). Unbekannte Angaben werden abgelehnt (Adresse = Cache-Schlüssel, Entscheidung 02.10.2026).' },
    { version: '2.0.0', datum: '2026-10-02', text: 'Eingabe nur noch das Bundesland (bundesland=SN): eine Antwort je Bundesland statt je Ort – höchstens 16 Ferien-Abrufe am Tag. Ort, Koordinaten und Name entfallen.' },
    { version: '1.0.0', datum: '2026-09-27', text: 'Erste Fassung als Dienst: Feiertage je Bundesland, Schulferien (OpenHolidays), Brückentage, Zeitumstellung, Kalenderwoche, Aktions- und Brauchtumstage; Bundesland aus dem Ort' }
  ],
  titel: 'Feiertage und Ferien',
  beschreibung: 'Gesetzliche Feiertage und Schulferien des Bundeslands, Brückentage, Zeitumstellung, Kalenderwoche und bekannte Aktionstage – für gut ein Jahr ab heute.',
  eingaben: { bundesland: 'Kürzel des Bundeslands (Pflicht): BW, BY, BE, BB, HB, HH, HE, MV, NI, NW, RP, SL, SN, ST, SH, TH' },
  parameter: { bundesland: P.wahl(Object.values(LAENDER)) },   // erlaubte Angaben = Cache-Schlüssel (_lib/parameter.js)
  laender: ['DE'],
  klasse: 'oeffentlich',
  ttl: 86400,
  takt: 86400,
  quellen: QUELLEN,
  schema: SCHEMA,
  blatt: {
    zweck: 'Zeigt, wann frei ist und was ansteht: nächster Feiertag, laufende oder nächste Ferien, Brückentage, Zeitumstellung, Muttertag, Advent …',
    herkunft: [
      'Gesetzliche Feiertage: von DAILY aus den Feiertagsgesetzen der Länder berechnet (Ostertermin nach Gauß). Nur landesweite Feiertage; örtliche (z. B. Fronleichnam in Teilen Sachsens und Thüringens, Augsburger Friedensfest, Mariä Himmelfahrt in Teilen Bayerns) sind nicht enthalten.',
      'Schulferien: OpenHolidays API (freie Datenbank der Ferien- und Feiertage in Europa) für das Bundesland.',
      'Aktions- und Brauchtumstage: feste Liste von DAILY (Muttertag, Erntedank, Advent, Welttage …), Termine berechnet.'
    ],
    verarbeitung: [
      'Bundesland aus der Eingabe „bundesland“ (Kürzel). Den Ort kennt der Dienst nicht – die Oberfläche schickt das Bundesland des gewählten Orts.',
      'Zeitraum: heute bis 400 Tage voraus; „heute“ in der Zeitzone Europe/Berlin.',
      'Brückentag: Feiertag am Dienstag → Montag davor, am Donnerstag → Freitag danach.',
      'Aktionstage, die im Land ohnehin Feiertag sind (z. B. Frauentag in Berlin), erscheinen nur als Feiertag.',
      'Sind die Schulferien nicht erreichbar, ist „ferien“ null und der Hinweis „ferien_nicht_erreichbar“ gesetzt; alles Berechnete kommt trotzdem.'
    ],
    ausgabe: {
      bundesland: 'Bundesland (z. B. Sachsen)',
      kuerzel: 'Kürzel des Bundeslands (z. B. SN)',
      heute: 'heutiger Tag (Europe/Berlin)',
      kalenderwoche: 'ISO-Kalenderwoche von heute',
      feiertage: 'gesetzliche Feiertage ab heute',
      'feiertage[].datum': 'Tag',
      'feiertage[].name': 'Name des Feiertags',
      'feiertage[].bundesweit': 'true = in ganz Deutschland',
      'feiertage[].wochentag': '0 = Sonntag … 6 = Samstag',
      'feiertage[].brueckentag': 'passender Brückentag oder null',
      ferien: 'Schulferien, die noch nicht vorbei sind (null = Quelle nicht erreichbar)',
      'ferien[].name': 'Name (z. B. Herbstferien)',
      'ferien[].von': 'erster Ferientag',
      'ferien[].bis': 'letzter Ferientag',
      zeitumstellung: 'nächste Zeitumstellungen',
      'zeitumstellung[].datum': 'Tag (Sonntag, 2 bzw. 3 Uhr)',
      'zeitumstellung[].art': 'sommerzeit (Uhr vor) oder winterzeit (Uhr zurück)',
      aktionstage: 'Aktions-, Brauchtums- und Gedenktage ab heute',
      'aktionstage[].datum': 'Tag',
      'aktionstage[].name': 'Name (z. B. Muttertag)',
      'aktionstage[].art': 'brauch, welttag oder gedenktag'
    },
    skalierung: {
      klasse: 'B',
      quelle: 'OpenHolidays: frei, ohne Schlüssel, keine veröffentlichte Grenze. Alles andere wird gerechnet.',
      kosten: 'Je Bundesland und Tag 1 Abruf der Ferien; Rechnen < 1 ms.',
      cache: 'Gültig bis Mitternacht deutscher Zeit (Takt 1 Tag); die Adresse enthält nur das Bundesland → 16 Fächer für ganz Deutschland, fast nur Cache-Treffer.',
      bei10Mio: 'Unproblematisch: höchstens 16 verschiedene Antworten am Tag (je Bundesland eine) und damit höchstens 16 Ferien-Abrufe, unabhängig von der Nutzerzahl.'
    }
  },
  async run(eingabe, { jetzt = Date.now() } = {}) {
    const st = String(eingabe.bundesland || '').trim().toUpperCase();
    if (!st) throw new DienstFehler('eingabe_fehlt', 'Bundesland fehlt: bundesland=<Kürzel>, z. B. bundesland=SN');
    const land = Object.keys(LAENDER).find(n => LAENDER[n] === st);
    if (!land) throw new DienstFehler('eingabe_ungueltig', `Unbekanntes Bundesland „${st}“ – erlaubt: ${Object.values(LAENDER).join(', ')}`);
    const heute = tagIn(jetzt, 'Europe/Berlin');
    const daten = { bundesland: land, kuerzel: st, ...berechne(st, heute), ferien: null };
    const hinweise = [];
    const bis = tag(plus(new Date(heute + 'T00:00:00Z'), TAGE));
    try {
      const liste = await getJson(`https://openholidaysapi.org/SchoolHolidays?countryIsoCode=DE&subdivisionCode=DE-${st}&languageIsoCode=DE&validFrom=${heute}&validTo=${bis}`, { timeout: 8000 });
      daten.ferien = ferienAus(liste).filter(f => f.bis >= heute);
    } catch (e) { hinweise.push('ferien_nicht_erreichbar'); }
    // Reihenfolge der Felder wie im Vertrag
    const { bundesland: b, kuerzel, heute: h, kalenderwoche, feiertage, ferien, zeitumstellung, aktionstage } = daten;
    return { hinweise, daten: { bundesland: b, kuerzel, heute: h, kalenderwoche, feiertage, ferien, zeitumstellung, aktionstage } };
  },
  berechne, ostern, kalenderwoche, ferienAus, LAENDER
};
