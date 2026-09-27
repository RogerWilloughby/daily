// Erzeugt den eigenen Ortsbestand services/daten/orte-de.json aus den GeoNames-Postleitzahldaten (CC BY 4.0).
// Aufruf: node tools/orte-daten.js <Postleitzahlen> [<Orte mit Einwohnern>]
//   <Postleitzahlen> = GeoNames DE.txt aus https://download.geonames.org/export/zip/DE.zip (tabulatorgetrennt)
//                      oder der CSV-Spiegel zipcodes.de.csv (github.com/zauberware/postal-codes-json-xml-csv, gleiche Daten)
//   <Orte>           = optional GeoNames DE.txt aus https://download.geonames.org/export/dump/DE.zip – liefert die Einwohnerzahlen
// Monatlich aktualisiert durch .github/workflows/orte-daten.yml.
const fs = require('fs');
const path = require('path');

const ZIEL = path.join(__dirname, '..', 'services', 'daten', 'orte-de.json');

// Großkunden-Postleitzahlen (Firmen, Behörden) sind keine Orte
const FIRMA = /gmbh|\bmbh\b|\bag\b|\bkg\b|\beg\b|\bse\b|e\.\s?v\.|&|\+|postfach|bank|sparkasse|kasse\b|versicherung|verwaltung|deutsche post|stiftung|finanzamt|\bamt\b|ämter|gericht|agentur|behörde|ministerium|landesamt|bundesamt|universit|hochschule|klinik|krankenhaus|gruppe|verein|verlag|zentrale|dienststelle|redaktion|direktion|dezernat|\bsenat|kantine|fabrik|großhandel|vertrieb|service|management|holding|\bpartner|werbeagentur|\bltd\b|\binc\b|\bdr\. |\bbkk\b|\baok\b|genossenschaft|bundesanstalt|zentralamt|handelskammer|handwerkskammer|ärztekammer|landwirtschaftskammer|versorgungskammer|kammertag|förderkreis|staatsanwalt|staatskanzlei|bezirksamt|fachbereich|handelsvertretung|arbeitsgemeinschaft|verband|entsorgung|center|dienstleistungszentrum|rechenzentrum|servicezentrum|\bu\. |\bco\.|\bfür |krankenkasse|landratsamt|stadtwerke|polizei|präsidium|regierung|bundeswehr|kreiswehr|berufsbildung|akademie|institut|schule\b|versand|\bkg\.|\bohg\b|\bgbr\b|hospital|apotheke|rechtsanw|aktiengesellschaft|\bs\.a|\bkirche\b|kirchenkreis|landeskirch|oberkirchenrat|kirchensteuer|diözese|landtag|rundfunk|lotterie|gesundheit|niederlassung|botschaft|justizvollzug|filiale|bezüge|gebr\.|\bev\.|^magistrat|^stadt (?!wehlen)|^landkreis |^gemeinde |bundesbahn|amazon|telekom|\breisen\b|wohnstift|seniorenzentrum|altenzentrum|\bevang|\bdipl|studio|museum|\bteam\b|handelsgesellschaft|investment|anstalt|\bb\.v\.|\bsrl\b|\bllp\b|\be\. ?k\.|arbeitskreis|geschäftsstelle|fraktion|bataillon|kinderdörfer|streitkräfte|vermessungsamt|bürgermeisteramt|bürgeramt|eigenbetrieb|\bdez\.|landesbetrieb|landesentwicklung|organisationskomitee|entschädigung|schadenausgleich|kinderschutz|mineralöl|drahtindustrie|zentrum\b|centre|merchandising|teleshopping|staatsbibliothek|verkehrsbetriebe|wasserbetriebe|blutspende|wirtschaft\b|bundesgeschäft|kinderkanal|\babt\.|\bfd \d|\.(de|fm|at|com)\b|\d{3,}|zeitung|honighaus|mutter und kind|produktion|mc donalds|\be\.on\b|diven|knappschaft|großannahme|kochstudio|feinschmecker|rechtsanwalt|landesfunkhaus|garten und|\Bamt\b|\bbund\b|sportbund|\bbundes|gesellschaft|gemeinschaft|gewerkschaft|landeshauptstadt|\blandes(?!bergen)|\bdeutsche[rs]?\b|deutschland|bibliothek|(förderungs|diakonie|reifen|studenten|-s-)werk|ärzteversorgung|ausschuss|vertretung|\bpatent|konzerthaus|kaufhaus|\bhaus maria|missionshaus|mutterhaus|rotes kreuz|samariter|\bbauhaus\b|radio|ministerpräsident|bevollmächtigte|koordination|computershare|grenzschutz|landeskranken|medizin|ärzteblatt|forschung|olympisch|handelstag|shell\b|mondelez|\bder magistrat|allianz|alte leipziger|hotel|konzern|kravag|reinigung|südbund|verkehrsverbund|\baör\b|weingut|bistum|generalvikariat|ordinariat|büro\b|buchhandel|buchhandlung|förderungsdienst|airways|kommunikation|postleit|generali|logistik|mcdonalds|medialog|versorgungsstelle|heimversorgung|^rathaus|rheinenergie|rheinische post|schneefernerhaus|beratungsstelle|^sparte|betriebe\b|^upost|- werke/i;

// Abkürzungen in Großbuchstaben (BMW, DAK, IHK …) sind Firmen oder Einrichtungen; römische Zahlen (Wakendorf II) nicht
const KUERZEL = /(^|[\s(\/-])(?![IVX]+\b)[A-ZÄÖÜ]{2,}/;
// echte Orte, die wie Einrichtungen aussehen
const ECHT = new Set(['Freiamt', 'Stadt Wehlen', 'Amt Neuhaus']);
const istFirma = n => !ECHT.has(n) && (FIRMA.test(n) || KUERZEL.test(n) || /^[a-zäöü]/.test(n)); // klein geschrieben („rhenag“): Firma

// Bundesland aus den ersten zwei Stellen des amtlichen Kreisschlüssels (die Quelle mischt deutsche und englische Namen)
const LAND = { '01': 'Schleswig-Holstein', '02': 'Hamburg', '03': 'Niedersachsen', '04': 'Bremen', '05': 'Nordrhein-Westfalen', '06': 'Hessen',
  '07': 'Rheinland-Pfalz', '08': 'Baden-Württemberg', '09': 'Bayern', '10': 'Saarland', '11': 'Berlin', '12': 'Brandenburg',
  '13': 'Mecklenburg-Vorpommern', '14': 'Sachsen', '15': 'Sachsen-Anhalt', '16': 'Thüringen' };

// Kreisnamen, die in der Quelle veraltet oder fremdsprachig sind (Schlüssel = amtlicher Kreisschlüssel)
const KREIS_KORREKTUR = {
  '14628': 'Landkreis Sächsische Schweiz-Osterzgebirge',
  '09564': 'Kreisfreie Stadt Nürnberg',
  '06412': 'Kreisfreie Stadt Frankfurt am Main',
  '11000': 'Berlin',
  '02000': 'Hamburg'
};
const TYP = /^(Landkreis|Kreis |Kreisfreie Stadt|Stadtkreis|Region |Städteregion|Regionalverband|Eifelkreis|Rhein-|Burgenlandkreis|Saalekreis|Salzlandkreis|Erzgebirgskreis|Vogtlandkreis|Wartburgkreis|Kyffhäuserkreis|Ilm-Kreis|Unstrut-Hainich-Kreis|Saale-|Werra-|Main-|Hochtaunuskreis|Wetteraukreis|Vogelsbergkreis|Schwalm-|Lahn-|Odenwaldkreis|Rheingau-|Enzkreis|Hohenlohekreis|Ostalbkreis|Rems-|Alb-|Bodenseekreis|Ortenaukreis|Zollernalbkreis|Rhein-Neckar-Kreis|Neckar-|Märkischer Kreis|Hochsauerlandkreis|Ennepe-|Oberbergischer|Rheinisch-|Heinsberg)/;

// eine CSV-Zeile in Felder zerlegen (Anführungszeichen, verdoppelte "" und Kommas im Feld)
function csvFelder(zeile) {
  const f = []; let feld = '', inQ = false;
  for (let i = 0; i < zeile.length; i++) {
    const c = zeile[i];
    if (inQ) {
      if (c === '"' && zeile[i + 1] === '"') { feld += '"'; i++; }
      else if (c === '"') inQ = false;
      else feld += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { f.push(feld); feld = ''; }
    else feld += c;
  }
  f.push(feld);
  return f;
}

function lies(datei) {
  const text = fs.readFileSync(datei, 'utf8').replace(/^﻿/, '');
  const zeilen = text.split(/\r?\n/).filter(Boolean);
  if (zeilen[0].startsWith('country_code,')) { // CSV-Spiegel
    const kopf = zeilen.shift().split(',');
    return zeilen.map(z => {
      const f = csvFelder(z);
      const o = Object.fromEntries(kopf.map((k, i) => [k, f[i]]));
      return { plz: o.zipcode, ort: o.place, land: o.state, kreis: o.community, kreisSchluessel: o.community_code, lat: +o.latitude, lon: +o.longitude };
    });
  }
  return zeilen.map(z => { // GeoNames-Original, tabulatorgetrennt
    const f = z.split('\t');
    return { plz: f[1], ort: f[2], land: f[3], kreis: f[7], kreisSchluessel: f[8], lat: +f[9], lon: +f[10] };
  });
}

// je Kreisschlüssel einen einheitlichen Namen wählen: bevorzugt mit Kreistyp („Landkreis …“), sonst ohne Zusatz „, Stadt“
function kreisNamen(zeilen) {
  const varianten = {};
  for (const z of zeilen) if (z.kreisSchluessel) (varianten[z.kreisSchluessel] ||= new Set()).add(z.kreis);
  const namen = {};
  for (const [k, set] of Object.entries(varianten)) {
    const liste = [...set].filter(Boolean);
    namen[k] = KREIS_KORREKTUR[k] || liste.find(n => TYP.test(n)) ||
      liste.map(n => n.replace(/, (Stadt|Hansestadt|kreisfreie Stadt|Landeshauptstadt|Wissenschaftsstadt|documenta-Stadt|Freie und Hansestadt)$/, '')).sort((a, b) => b.length - a.length)[0] || null;
  }
  return namen;
}

// Grundname für den Abgleich: „Freiburg im Breisgau“ → „Freiburg“, „Halle (Saale)“ → „Halle“, „Mühlhausen/Thüringen“ → „Mühlhausen“
const grundname = n => String(n).replace(/\s*\(.*\)\s*$/, '').split('/')[0]
  .replace(/ (an der|an den|am|im|in|bei|ob der|vor der|auf der|unter der) .*$/, '').trim();

// Einwohner aus dem GeoNames-Ortsverzeichnis (dump). Spalten: 1 name, 2 asciiname, 3 alternatenames, 4 lat, 5 lon,
// 6 feature class, 14 population. Große Städte heißen dort oft englisch („Munich“) oder mit Zusatz („Halle (Saale)“),
// deshalb wird über Name, alternative Namen und Grundname gesucht – und nur Orte in der Nähe zählen.
// Liefert (Name, lat, lon) → { ew, alias } (alias = Hauptname bei GeoNames, falls anders geschrieben).
function einwohnerAus(datei) {
  const nachName = new Map();
  const merke = (k, e) => { if (!nachName.has(k)) nachName.set(k, []); nachName.get(k).push(e); };
  if (datei) for (const z of fs.readFileSync(datei, 'utf8').split(/\r?\n/)) {
    const f = z.split('\t');
    if (f.length < 15 || f[6] !== 'P') continue;
    const ew = +f[14];
    if (!(ew > 0)) continue;
    const e = { name: f[1], lat: +f[4], lon: +f[5], ew };
    // alternative Namen nur bei Verwaltungssitzen (PPLA…, PPLC): dort steht der Hauptname oft englisch („Munich“);
    // bei Dörfern führen sie in die Irre (Ahlsdorf als alter Name eines Ortsteils von Allstedt)
    const alt = /^PPL(A\d?|C)$/.test(f[7]) ? String(f[3] || '').split(',').filter(n => /[a-zäöüß]/i.test(n) && n.length < 60) : [];
    const namen = new Set([f[1], f[2], ...alt]);
    for (const n of namen) { merke('n|' + n, e); merke('g|' + grundname(n), e); }
  }
  const km = (a, b, c, d) => Math.hypot((a - c) * 111.2, (b - d) * 111.2 * Math.cos(a * Math.PI / 180));
  return (name, lat, lon) => {
    // genauer oder alternativer Name: bis 20 km; nur Grundname („Freiburg im Breisgau“ ↔ „Freiburg“): bis 6 km
    for (const [k, r] of [['n|' + name, 20], ['g|' + grundname(name), 6]]) {
      const nah = (nachName.get(k) || []).filter(e => km(lat, lon, e.lat, e.lon) <= r);
      if (nah.length) {
        const best = nah.reduce((a, b) => (b.ew > a.ew ? b : a));
        return { ew: best.ew, alias: best.name !== name ? best.name : '' };
      }
    }
    return { ew: 0, alias: '' };
  };
}

// Postleitzahlgebiete über die Landesgrenze: GeoNames führt „Hamburg Bergedorf“ zusätzlich unter Kreisen in Schleswig-Holstein.
// Orte der Stadtstaaten gehören immer zum Stadtstaat.
const STADTSTAAT = { Hamburg: '02000', Berlin: '11000', Bremen: '04011' };
function stadtstaat(z) {
  const stadt = Object.keys(STADTSTAAT).find(s => z.ort === s || z.ort.startsWith(s + ' '));
  return stadt ? { ...z, kreisSchluessel: STADTSTAAT[stadt], land: LAND[STADTSTAAT[stadt].slice(0, 2)] } : z;
}

function erzeuge(datei, ortsdatei) {
  const ew = einwohnerAus(ortsdatei);
  const alle = lies(datei).filter(z => /^\d{5}$/.test(z.plz) && z.ort && Number.isFinite(z.lat) && Number.isFinite(z.lon))
    .map(z => stadtstaat({ ...z, land: LAND[String(z.kreisSchluessel || '').slice(0, 2)] || z.land }));
  const zeilen = alle.filter(z => !istFirma(z.ort));
  const kreise = kreisNamen(zeilen);
  const laender = [...new Set(zeilen.map(z => z.land))].sort();

  // Orte = (Name, Kreis); Koordinate = Mittel der Postleitzahl-Punkte
  const orte = new Map();
  for (const z of zeilen) {
    const key = z.ort + '|' + z.kreisSchluessel;
    const o = orte.get(key) || { name: z.ort, land: z.land, kreis: z.kreisSchluessel, lat: 0, lon: 0, n: 0, plz: new Set() };
    o.lat += z.lat; o.lon += z.lon; o.n++; o.plz.add(z.plz);
    orte.set(key, o);
  }
  // Stadtteil: Name beginnt mit einem anderen Ortsnamen desselben Kreises, gefolgt von Leerzeichen („Dresden Innere Altstadt“)
  const namenJeKreis = {};
  for (const o of orte.values()) (namenJeKreis[o.kreis] ||= new Set()).add(o.name);
  const liste = [...orte.values()].map(o => {
    const teil = [...namenJeKreis[o.kreis]].some(n => n !== o.name && o.name.startsWith(n + ' '));
    const lat = Math.round(o.lat / o.n * 1e4) / 1e4, lon = Math.round(o.lon / o.n * 1e4) / 1e4;
    const e = teil ? { ew: 0, alias: '' } : ew(o.name, lat, lon);
    return [o.name, laender.indexOf(o.land), o.kreis || '', lat, lon, [...o.plz].sort().join(' '), teil ? 1 : 0, e.ew, e.alias];
  }).sort((a, b) => a[0].localeCompare(b[0], 'de'));
  const index = new Map(liste.map((o, i) => [o[0] + '|' + o[2], i]));
  // Postleitzahl-Punkte für die Umkehrsuche: [plz, ortIndex, lat, lon]
  const punkte = zeilen.map(z => [z.plz, index.get(z.ort + '|' + z.kreisSchluessel), Math.round(z.lat * 1e4) / 1e4, Math.round(z.lon * 1e4) / 1e4]);

  return {
    format: 'daily-orte/1',
    stand: new Date().toISOString().slice(0, 10),
    quelle: { name: 'GeoNames Postal Codes', lizenz: 'CC BY 4.0', url: 'https://www.geonames.org' },
    anzahl: { orte: liste.length, mitEinwohnern: liste.filter(o => o[7] > 0).length, plz: new Set(zeilen.map(z => z.plz)).size, punkte: punkte.length, ausgefiltert: alle.length - zeilen.length },
    felder: { orte: ['name', 'landIndex', 'kreisSchluessel', 'lat', 'lon', 'plz (Leerzeichen-getrennt)', 'stadtteil (0/1)', 'einwohner (0 = unbekannt)', 'alias: Name bei GeoNames, falls anders (Munich, Halle (Saale))'], punkte: ['plz', 'ortIndex', 'lat', 'lon'] },
    laender, kreise, orte: liste, punkte
  };
}
if (require.main === module) {
  const datei = process.argv[2];
  if (!datei) { console.error('Aufruf: node tools/orte-daten.js <DE.txt | zipcodes.de.csv> [<Orte-DE.txt>]'); process.exit(1); }
  const d = erzeuge(datei, process.argv[3]);
  fs.mkdirSync(path.dirname(ZIEL), { recursive: true });
  fs.writeFileSync(ZIEL, JSON.stringify(d));
  console.log(`orte-de.json: ${d.anzahl.orte} Orte (${d.anzahl.mitEinwohnern} mit Einwohnerzahl), ${d.anzahl.plz} Postleitzahlen, ${Object.keys(d.kreise).length} Kreise, ${d.anzahl.ausgefiltert} Großkunden entfernt, ${(fs.statSync(ZIEL).size / 1024).toFixed(0)} KB`);
}

module.exports = { erzeuge, lies, kreisNamen, csvFelder, istFirma, einwohnerAus, grundname };
