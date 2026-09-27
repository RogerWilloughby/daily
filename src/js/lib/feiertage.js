// Gesetzliche Feiertage in Deutschland je Bundesland – ohne Netz berechnet.
// Nur landesweite Feiertage; regionale (z. B. Fronleichnam in Teilen Sachsens) sind nicht enthalten.

export const STATES = {
  'Baden-Württemberg': 'BW', 'Bayern': 'BY', 'Berlin': 'BE', 'Brandenburg': 'BB', 'Bremen': 'HB', 'Hamburg': 'HH',
  'Hessen': 'HE', 'Mecklenburg-Vorpommern': 'MV', 'Niedersachsen': 'NI', 'Nordrhein-Westfalen': 'NW',
  'Rheinland-Pfalz': 'RP', 'Saarland': 'SL', 'Sachsen': 'SN', 'Sachsen-Anhalt': 'ST', 'Schleswig-Holstein': 'SH', 'Thüringen': 'TH'
};

const key = d => d.toISOString().slice(0, 10);
const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const plus = (d, n) => new Date(d.getTime() + n * 864e5);

// Ostersonntag (Gauß/Meeus, gregorianisch)
export function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(y, month, day);
}

// Liste { date: 'JJJJ-MM-TT', name } eines Jahres für ein Bundesland (Kürzel wie 'SN')
export function holidays(y, st) {
  const E = easter(y), has = list => list.includes(st);
  const out = [
    [utc(y, 1, 1), 'Neujahr'],
    has(['BW', 'BY', 'ST']) && [utc(y, 1, 6), 'Heilige Drei Könige'],
    has(['BE', 'MV']) && [utc(y, 3, 8), 'Internationaler Frauentag'],
    [plus(E, -2), 'Karfreitag'],
    [plus(E, 1), 'Ostermontag'],
    [utc(y, 5, 1), 'Tag der Arbeit'],
    [plus(E, 39), 'Christi Himmelfahrt'],
    [plus(E, 50), 'Pfingstmontag'],
    has(['BW', 'BY', 'HE', 'NW', 'RP', 'SL']) && [plus(E, 60), 'Fronleichnam'],
    has(['SL']) && [utc(y, 8, 15), 'Mariä Himmelfahrt'],
    has(['TH']) && [utc(y, 9, 20), 'Weltkindertag'],
    [utc(y, 10, 3), 'Tag der Deutschen Einheit'],
    has(['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH']) && [utc(y, 10, 31), 'Reformationstag'],
    has(['BW', 'BY', 'NW', 'RP', 'SL']) && [utc(y, 11, 1), 'Allerheiligen'],
    has(['SN']) && [bussUndBettag(y), 'Buß- und Bettag'],
    [utc(y, 12, 25), '1. Weihnachtstag'],
    [utc(y, 12, 26), '2. Weihnachtstag']
  ].filter(Boolean);
  return out.map(([d, name]) => ({ date: key(d), name, weekday: d.getUTCDay() })).sort((a, b) => a.date.localeCompare(b.date));
}

// Mittwoch vor dem 23. November
function bussUndBettag(y) {
  const n23 = utc(y, 11, 23), back = ((n23.getUTCDay() - 3 + 7) % 7) || 7;
  return plus(n23, -back);
}

// Brückentag: Feiertag an Dienstag → Montag davor, an Donnerstag → Freitag danach
export function bridgeDay(h) {
  const d = new Date(h.date + 'T00:00:00Z');
  if (h.weekday === 2) return key(plus(d, -1));
  if (h.weekday === 4) return key(plus(d, 1));
  return null;
}

// Tage zwischen zwei Datums-Schlüsseln
export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

// Zeitumstellung: letzter Sonntag im März (Sommerzeit) und Oktober (Winterzeit)
export function clockChanges(y) {
  const lastSunday = m => { const d = utc(y, m + 1, 0); return key(plus(d, -d.getUTCDay())); };
  return [{ date: lastSunday(3), name: 'Beginn der Sommerzeit (Uhr vor: 2 → 3 Uhr)' }, { date: lastSunday(10), name: 'Ende der Sommerzeit (Uhr zurück: 3 → 2 Uhr)' }];
}
