// Erzeugt services/daten/namenstage.json aus einer Wikidata-Abfrage (tools/namenstage/abfrage.rq).
// Aufruf (in der GitHub Action „Namenstage erneuern“): node tools/namenstage-daten.js ergebnis.json
// Wikidata-Daten sind CC0 (gemeinfrei). Je Tag die bekanntesten Vornamen, höchstens MAX.
const fs = require('fs');
const path = require('path');

const MAX = 6;
const MONATE = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
// „March 19“ oder „19 March“ → „03-19“ (sonst null)
function tagAus(text) {
  const t = String(text || '').trim().toLowerCase();
  const m = /^([a-z]+) (\d{1,2})$/.exec(t) || /^(\d{1,2}) ([a-z]+)$/.exec(t);
  if (!m) return null;
  const [monat, tag] = /^\d/.test(m[1]) ? [MONATE[m[2]], +m[1]] : [MONATE[m[1]], +m[2]];
  if (!monat || tag < 1 || tag > 31) return null;
  if (new Date(Date.UTC(2024, monat - 1, tag)).getUTCMonth() !== monat - 1) return null;   // 2024: auch 29.02.
  return String(monat).padStart(2, '0') + '-' + String(tag).padStart(2, '0');
}
// nur echte Vornamen: ein Wort (auch mit Bindestrich), Buchstaben, großer Anfangsbuchstabe
const vorname = n => /^\p{Lu}[\p{Ll}'’]+(-\p{Lu}[\p{Ll}'’]+)?$/u.test(n) && n.length <= 20;

// SPARQL-Ergebnis → { 'MM-TT': ['Josef', …] }
function auswerten(json) {
  const je = new Map();   // tag → name → { heilige: Set, links, ausdruecklich }
  for (const b of (json && json.results && json.results.bindings) || []) {
    const tag = tagAus(b.tagEn && b.tagEn.value), name = b.nameDe && b.nameDe.value.trim();
    if (!tag || !name || !vorname(name)) continue;
    if (!je.has(tag)) je.set(tag, new Map());
    const m = je.get(tag);
    const e = m.get(name) || { heilige: new Set(), links: 0, ausdruecklich: false };
    if (b.heiliger) e.heilige.add(b.heiliger.value);
    if (b.weg && b.weg.value === 'namenstag') e.ausdruecklich = true;
    e.links = Math.max(e.links, +(b.links && b.links.value) || 0);
    m.set(name, e);
  }
  const tage = {};
  for (const tag of [...je.keys()].sort()) {
    tage[tag] = [...je.get(tag)].sort(([an, a], [bn, b]) => (b.ausdruecklich - a.ausdruecklich) || (b.links - a.links) || (b.heilige.size - a.heilige.size) || an.localeCompare(bn, 'de'))
      .slice(0, MAX).map(([n]) => n);
  }
  return tage;
}

// Plausibel? Sonst lieber abbrechen und den alten Stand behalten
function pruefe(tage) {
  const n = Object.keys(tage).length, namen = new Set(Object.values(tage).flat()).size;
  const fehler = [];
  if (n < 330) fehler.push(`nur ${n} Tage mit Namen (erwartet ≥ 330)`);
  if (namen < 500) fehler.push(`nur ${namen} verschiedene Namen (erwartet ≥ 500)`);
  return fehler;
}

function erzeuge(json, stand = new Date().toISOString().slice(0, 10)) {
  const tage = auswerten(json);
  return { quelle: 'Wikidata (CC0): Gedenktage der Heiligen und Namenstage', stand, tage };
}

if (require.main === module) {
  const json = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const daten = erzeuge(json), fehler = pruefe(daten.tage);
  console.log(`Namenstage: ${Object.keys(daten.tage).length} Tage, ${new Set(Object.values(daten.tage).flat()).size} Namen`);
  if (fehler.length) { console.error('Abbruch: ' + fehler.join('; ')); process.exit(1); }
  fs.writeFileSync(path.join(__dirname, '..', 'services', 'daten', 'namenstage.json'), JSON.stringify(daten));
}

module.exports = { tagAus, vorname, auswerten, pruefe, erzeuge, MAX };
