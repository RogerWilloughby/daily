// Eigener Ortsbestand Deutschland (services/daten/orte-de.json, erzeugt von tools/orte-daten.js aus GeoNames, CC BY 4.0).
// Suche nach Name und Postleitzahl sowie Umkehrsuche (Koordinaten → nächster Ort) – ohne externe Anfragen.
const { runde } = require('./rahmen');

let D = null;       // Datenbestand (einmal je Serverinstanz geladen)
let IDX = null;     // je Ort: { name: [Wörter], kontext: Set(Bundesland, Kreis, Abkürzungen, Postleitzahlen) }
let PLZ = null;     // Map plz → [ortIndex]

// Vergleichbare Schreibweise, tolerant wie eine Suchmaschine: klein, ohne Akzente und Satzzeichen,
// Umlaute gefaltet (ä, ae → a; ß → ss), „Sankt“ → „st“. Beide Seiten (Bestand und Eingabe) werden gleich gefaltet.
const norm = s => String(s || '').toLowerCase()
  .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
  .replace(/[^a-z0-9]+/g, ' ').replace(/\bsankt\b/g, 'st').trim();

// Füllwörter in Ortsnamen und Eingaben („Neustadt in Sachsen“, „Neustadt i. Sa.“, „Frankfurt am Main“)
const FUELL = new Set(['in', 'i', 'im', 'an', 'am', 'a', 'der', 'den', 'dem', 'd', 'bei', 'b', 'ob', 'vor', 'v', 'auf', 'unter', 'u', 'zu', 'und']);
const woerter = s => norm(s).split(' ').filter(w => w && !FUELL.has(w));

// übliche Kürzel der Bundesländer und Landschaften („Neustadt/Sa.“, „Halle/Westf.“, „Neustadt Pfalz“)
const KUERZEL = {
  'Baden-Württemberg': ['bw', 'wurtt', 'wurttemberg', 'baden'], 'Bayern': ['by', 'bay', 'bayr', 'bayrisch'],
  'Berlin': ['be'], 'Brandenburg': ['bb', 'brb', 'mark'], 'Bremen': ['hb'], 'Hamburg': ['hh'],
  'Hessen': ['he', 'hess'], 'Mecklenburg-Vorpommern': ['mv', 'meckl', 'mecklenburg', 'vorpommern'],
  'Niedersachsen': ['nds', 'ni', 'niedersachs'], 'Nordrhein-Westfalen': ['nrw', 'nw', 'westf', 'westfalen', 'rheinland'],
  'Rheinland-Pfalz': ['rlp', 'rp', 'pfalz', 'rheinland'], 'Saarland': ['sl', 'saar'],
  'Sachsen': ['sn', 'sa', 'sachs'], 'Sachsen-Anhalt': ['st', 'lsa', 'anhalt', 'sachsenanhalt'],
  'Schleswig-Holstein': ['sh', 'holst', 'holstein', 'schleswig'], 'Thüringen': ['th', 'thur', 'thuringen']
};
// Regierungsbezirke und Landesteile nach den ersten drei Stellen des Kreisschlüssels („Weiden Oberpfalz“, „Halle Westf.“)
const BEZIRK = {
  '091': ['oberbayern', 'obb'], '092': ['niederbayern', 'ndb'], '093': ['oberpfalz', 'opf'], '094': ['oberfranken', 'ofr', 'franken'],
  '095': ['mittelfranken', 'mfr', 'franken'], '096': ['unterfranken', 'ufr', 'franken'], '097': ['schwaben', 'schw'],
  '081': ['wurttemberg', 'wurtt'], '082': ['baden'], '083': ['baden', 'breisgau', 'schwarzwald'], '084': ['wurttemberg', 'wurtt', 'schwaben'],
  '051': ['rheinland', 'niederrhein'], '053': ['rheinland'], '055': ['westfalen', 'westf', 'munsterland'], '057': ['westfalen', 'westf', 'lippe'], '059': ['westfalen', 'westf', 'sauerland'],
  '064': ['sudhessen'], '065': ['mittelhessen', 'oberhessen'], '066': ['nordhessen'],
  '073': ['pfalz'], '071': ['eifel', 'hunsruck', 'westerwald'], '072': ['eifel', 'mosel']
};
const KREISTYP = /^(Landkreis|Kreisfreie Stadt|Stadtkreis|Kreis|Regionalverband|Städteregion|Region) /;

function daten() {
  if (D) return D;
  D = require('../daten/orte-de.json'); // fester Pfad, damit Vercel die Datei mit in die Funktion packt
  IDX = D.orte.map(o => {
    const land = D.laender[o[1]] || '';
    const kontext = new Set([
      ...(land === 'Sachsen-Anhalt' ? [] : woerter(land)),      // „Sachsen-Anhalt“ soll nicht bei „Sachsen“ passen
      ...(KUERZEL[land] || []),
      ...(BEZIRK[String(o[2]).slice(0, 3)] || []),
      ...woerter(String(D.kreise[o[2]] || '').replace(KREISTYP, '')),
      ...o[5].split(' ')
    ]);
    return { name: [...new Set([...woerter(o[0]), ...woerter(o[8] || '')])], kontext }; // o[8] = Name bei GeoNames („Munich“, „Halle (Saale)“)
  });
  PLZ = new Map();
  D.orte.forEach((o, i) => o[5].split(' ').forEach(p => { if (!PLZ.has(p)) PLZ.set(p, []); PLZ.get(p).push(i); }));
  return D;
}

// Tippfehler-Abstand (Damerau-Levenshtein: vertauschte Nachbarbuchstaben zählen als ein Fehler, „Drseden“)
function abstand(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let min = Infinity;
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      if (d[i][j] < min) min = d[i][j];
    }
    if (min > max) return max + 1;
  }
  return d[a.length][b.length];
}
const erlaubt = w => (w.length >= 8 ? 2 : w.length >= 4 ? 1 : 0); // erlaubte Tippfehler je Wortlänge

// Wie gut passt ein Suchwort zu einer Wortliste? 0 = genau, 1 = Wortanfang, 2 = Tippfehler, 9 = gar nicht
function passt(w, liste, tippfehler) {
  let best = 9;
  for (const t of liste) {
    if (t === w) return 0;
    if (best > 1 && t.startsWith(w)) best = 1;
    else if (tippfehler && best > 2 && t[0] === w[0] && !/^\d/.test(w) && erlaubt(w) && abstand(w, t, erlaubt(w)) <= erlaubt(w)) best = 2; // erster Buchstabe muss stimmen
  }
  return best;
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

// Namenssuche wie bei einer Suchmaschine: jedes Suchwort muss passen – im Ortsnamen oder im Umfeld (Bundesland, Kürzel, Kreis,
// Postleitzahl); mindestens eines im Namen. Reihenfolge: schlechtestes Suchwort (genau vor Wortanfang vor Tippfehler),
// dann mehr Treffer im Namen, Orte vor Stadtteilen, dann Einwohner.
// Beispiele: „Neustadt Sachsen“, „Neustadt i. Sa.“, „Neustadt in Sachsen“ → Neustadt in Sachsen; „Halle Saale“, „Muenchen“, „Dresdn“.
function sucheName(q, anzahl = 6) {
  daten();
  const ws = woerter(q);
  if (!ws.length || ws.join('').length < 2) return [];
  const nurZahlen = ws.every(w => /^\d+$/.test(w));
  let treffer = durchsuche(ws, nurZahlen, false);
  if (!treffer.some(t => t.schlechtester === 0)) {  // nichts genau Passendes: noch einmal mit Tippfehlern („Dresdn“, „Neustat“)
    const schon = new Set(treffer.map(t => t.i));
    treffer = treffer.concat(durchsuche(ws, nurZahlen, true).filter(t => !schon.has(t.i)));
  }
  return treffer.sort((a, b) => a.schlechtester - b.schlechtester || a.imUmfeld - b.imUmfeld ||
      D.orte[a.i][6] - D.orte[b.i][6] || groesse(b.i) - groesse(a.i) || a.rest - b.rest || a.i - b.i)
    .slice(0, anzahl).map(x => Object.defineProperty(alsOrt(x.i), EXAKT, { value: x.schlechtester === 0 }));
}

function durchsuche(ws, nurZahlen, tippfehler) {
  const treffer = [];
  IDX.forEach((e, i) => {
    let schlechtester = 0, imUmfeld = 0, imName = 0;
    for (const w of ws) {
      const n = passt(w, e.name, tippfehler);
      const k = n === 0 ? 9 : passt(w, e.kontext, tippfehler);
      if (n === 9 && k === 9) return;                 // Suchwort passt nirgends → kein Treffer
      if (n <= k) { imName++; schlechtester = Math.max(schlechtester, n); }
      else { imUmfeld++; schlechtester = Math.max(schlechtester, k); }
    }
    if (!imName && !nurZahlen) return;               // nur „Sachsen“ im Umfeld reicht nicht
    const rest = e.name.filter(t => !ws.some(w => t.startsWith(w))).length; // Namenswörter, nach denen nicht gesucht wurde
    treffer.push({ i, schlechtester, imUmfeld, rest });
  });
  return treffer;
}
// Markierung „alle Suchwörter passen genau“ (nicht aufzählbar, erscheint nicht in der Antwort)
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

module.exports = { daten, norm, woerter, exakt, sucheName, suchePlz, naechster, alsOrt, quelle: () => daten().quelle, stand: () => daten().stand };
