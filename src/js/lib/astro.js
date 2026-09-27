// Sonne und Mond ohne Netz berechnen (vereinfachte Formeln, Genauigkeit etwa ±2 Minuten bzw. ±½ Tag).

const RAD = Math.PI / 180, DAY = 864e5, J1970 = 2440588, J2000 = 2451545;
const toJulian = t => t / DAY - 0.5 + J1970;
const fromJulian = j => (j + 0.5 - J1970) * DAY;

// Sonnenauf- und -untergang für einen Tag (t = irgendein Zeitpunkt des Tages, ms). Ergebnis: ms-Zeitstempel oder null (Polartag/-nacht)
export function sunTimes(t, lat, lon) {
  const lw = -lon * RAD, phi = lat * RAD;
  const n = Math.round(toJulian(t) - J2000 - 0.0009 - lw / (2 * Math.PI));
  const ds = 0.0009 + lw / (2 * Math.PI) + n;
  const M = RAD * (357.5291 + 0.98560028 * ds);
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(L) * Math.sin(RAD * 23.4397));
  const Jtransit = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const cosW = (Math.sin(-0.833 * RAD) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (cosW < -1 || cosW > 1) return { rise: null, set: null, noon: fromJulian(Jtransit) };
  const w = Math.acos(cosW) / (2 * Math.PI);
  return { rise: fromJulian(Jtransit - w), set: fromJulian(Jtransit + w), noon: fromJulian(Jtransit) };
}

// Mondphase: Alter in Tagen (0 = Neumond), beleuchteter Anteil 0…1, Name
const SYN = 29.530588853, NEW0 = Date.UTC(2000, 0, 6, 18, 14);
export function moon(t) {
  const age = (((t - NEW0) / DAY) % SYN + SYN) % SYN;
  const illum = (1 - Math.cos(2 * Math.PI * age / SYN)) / 2;
  const name = age < 1.2 || age > SYN - 1.2 ? 'Neumond'
    : Math.abs(age - SYN / 2) < 1.2 ? 'Vollmond'
    : Math.abs(age - SYN / 4) < 1.2 ? 'Erstes Viertel'
    : Math.abs(age - 3 * SYN / 4) < 1.2 ? 'Letztes Viertel'
    : age < SYN / 2 ? 'Zunehmender Mond' : 'Abnehmender Mond';
  const nextFull = t + (((SYN / 2 - age) % SYN + SYN) % SYN) * DAY;
  const nextNew = t + (SYN - age) * DAY;
  return { age, illum, name, waxing: age < SYN / 2, nextFull, nextNew };
}

// Sternschnuppen-Ströme mit Maximum (Monat, Tag) und ungefährer Anzahl pro Stunde
export const METEORS = [
  [1, 3, 'Quadrantiden', 80], [4, 22, 'Lyriden', 18], [5, 6, 'Eta-Aquariiden', 40], [8, 12, 'Perseiden', 100],
  [10, 8, 'Draconiden', 10], [10, 21, 'Orioniden', 20], [11, 17, 'Leoniden', 15], [12, 14, 'Geminiden', 150], [12, 22, 'Ursiden', 10]
];
export function nextMeteor(t) {
  const d = new Date(t), y = d.getUTCFullYear();
  const list = [y, y + 1].flatMap(yy => METEORS.map(([m, day, name, rate]) => ({ date: Date.UTC(yy, m - 1, day), name, rate })));
  return list.find(x => x.date >= t - DAY);
}
