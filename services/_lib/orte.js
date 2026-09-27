// Eigener Ortsbestand Deutschland (services/daten/orte-de.json, erzeugt von tools/orte-daten.js aus GeoNames, CC BY 4.0).
// Suche nach Name und Postleitzahl sowie Umkehrsuche (Koordinaten → nächster Ort) – ohne externe Anfragen.
const { runde } = require('./rahmen');

let D = null;       // Datenbestand (einmal je Serverinstanz geladen)
let NAMEN = null;   // [{ i, n }] normalisierte Namen
let PLZ = null;     // Map plz → [ortIndex]

// Vergleichbare Schreibweise: klein, Umlaute ausgeschrieben, ohne Satzzeichen
const norm = s => String(s || '').toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function daten() {
  if (D) return D;
  D = require('../daten/orte-de.json'); // fester Pfad, damit Vercel die Datei mit in die Funktion packt
  NAMEN = D.orte.map((o, i) => ({ i, n: norm(o[0]) }));
  PLZ = new Map();
  D.orte.forEach((o, i) => o[5].split(' ').forEach(p => { if (!PLZ.has(p)) PLZ.set(p, []); PLZ.get(p).push(i); }));
  return D;
}

// Datensatz → Ort-Objekt nach Vertrag
function alsOrt(i, nurPlz) {
  const o = daten().orte[i];
  const plz = o[5].split(' ');
  return {
    name: o[0], region: D.laender[o[1]] || null, land: 'DE',
    kreis: D.kreise[o[2]] || null, kreisSchluessel: o[2] || null,
    plz: nurPlz ? [nurPlz] : plz.slice(0, 10), einwohner: o[7] || null,
    typ: o[6] ? 'stadtteil' : 'ort',
    lat: runde(o[3], 2), lon: runde(o[4], 2), zeitzone: 'Europe/Berlin'
  };
}

// Größe eines Orts: Einwohner (GeoNames); ohne Einwohnerzahl ersatzweise die Anzahl seiner Postleitzahlen (Berlin 182, Dresden 29, Dorf 1)
const groesse = i => (D.orte[i][7] || 0) * 1000 + D.orte[i][5].split(' ').length;

// Namenssuche: exakte Treffer vor Wortanfängen; Orte vor Stadtteilen; größere Orte vorn
function sucheName(q, anzahl = 6) {
  daten();
  const n = norm(q);
  if (n.length < 2) return [];
  // 0 = Name ist der Suchbegriff oder beginnt mit ihm als ganzem Wort („Neustadt an der Weinstraße“), 1 = Wortanfang, 2 = Wort darin
  const rang = e => e.n === n || e.n.startsWith(n + ' ') ? 0 : e.n.startsWith(n) ? 1 : (' ' + e.n).includes(' ' + n) ? 2 : 9;
  return NAMEN.map(e => ({ i: e.i, r: rang(e) })).filter(x => x.r < 9)
    .sort((a, b) => a.r - b.r || D.orte[a.i][6] - D.orte[b.i][6] || groesse(b.i) - groesse(a.i) || a.i - b.i)
    .slice(0, anzahl).map(x => Object.defineProperty(alsOrt(x.i), EXAKT, { value: x.r === 0 }));
}
// Markierung „Name passt als ganzes Wort“ (nicht aufzählbar, erscheint nicht in der Antwort)
const EXAKT = Symbol('exakt');
const exakt = o => o[EXAKT] === true;

// Postleitzahl: alle Orte mit dieser PLZ (Orte vor Stadtteilen)
function suchePlz(plz, anzahl = 6) {
  daten();
  return (PLZ.get(plz) || []).slice().sort((a, b) => D.orte[a][6] - D.orte[b][6] || groesse(b) - groesse(a))
    .slice(0, anzahl).map(i => alsOrt(i, plz));
}

// Umkehrsuche: nächster Postleitzahl-Punkt (höchstens maxKm entfernt); bei Stadtteilen der zugehörige Ort
function naechster(lat, lon, maxKm = 25) {
  daten();
  const kx = Math.cos(lat * Math.PI / 180) * 111.32, ky = 110.57;
  let best = null, bd = Infinity;
  for (const p of D.punkte) {
    const dx = (p[3] - lon) * kx, dy = (p[2] - lat) * ky, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = p; }
  }
  if (!best || Math.sqrt(bd) > maxKm) return null;
  let i = best[1];
  const o = D.orte[i];
  if (o[6]) { // Stadtteil → Ort desselben Kreises, dessen Name vorn steht
    const eltern = D.orte.findIndex(x => x[2] === o[2] && !x[6] && o[0].startsWith(x[0] + ' '));
    if (eltern >= 0) i = eltern;
  }
  return { ...alsOrt(i, best[0]), lat: runde(lat, 2), lon: runde(lon, 2) }; // Koordinaten des Nutzers (gerundet), nicht der Ortsmitte
}

module.exports = { daten, norm, exakt, sucheName, suchePlz, naechster, alsOrt, quelle: () => daten().quelle, stand: () => daten().stand };
