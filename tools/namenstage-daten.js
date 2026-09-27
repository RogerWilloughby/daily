// Erzeugt services/daten/namenstage.json aus Wikidata (CC0, gemeinfrei). Je Tag die bekanntesten Vornamen, höchstens MAX.
// Aufruf: über den Erzeuger tools/daten/namenstage.js (GitHub Action „Daten erneuern“) oder direkt: node tools/namenstage-daten.js
// Fassung 2 (deutsche Namen): Grundlage sind Heilige und Selige MIT Artikel in der deutschen Wikipedia und Gedenktag (P841).
// Der Vorname kommt aus dem deutschen Namen des Heiligen („Josef von Nazaret“ → Josef, „Nikolaus von Myra“ → Nikolaus),
// nicht aus Wikidatas Vornamen-Einträgen (die sind je Sprache getrennt: Giovanni, Juan, John …).
// Ablauf in kleinen Schritten, weil Wikidata Abfragen nach 60 s abbricht:
//   1. SPARQL nur mit Kennungen: Personen (P31 = Mensch) mit Gedenktag (P841)
//   2. deutsche Namen und Sprachversionen der Personen, englische Namen der Tage („March 19“)
//      stapelweise über die Wikidata-Schnittstelle (wbgetentities, je 50 Kennungen); nur Personen mit deutschem Artikel
// Prüfung: genug Tage und Namen UND bekannte Namenstage müssen stimmen (Josef 19.3., Nikolaus 6.12. …) – sonst Abbruch.
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

// Vorname aus dem deutschen Namen eines Heiligen: erstes Wort („Martin von Tours“ → Martin, „Georg (Heiliger)“ → Georg)
function vornameAus(labelDe) {
  const erstes = String(labelDe || '').trim().split(/[\s(,]+/)[0];
  return vorname(erstes) ? erstes : null;
}

// Zeilen → { 'MM-TT': ['Josef', …] }
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

// Bekannte Namenstage (Allgemeiner Römischer Kalender) – mindestens 6 von 8 müssen stimmen
const ANKER = { '03-19': 'Josef', '06-24': 'Johannes', '11-11': 'Martin', '12-06': 'Nikolaus', '04-23': 'Georg', '11-19': 'Elisabeth', '12-04': 'Barbara', '10-04': 'Franz' };
// Plausibel? Sonst lieber abbrechen und den alten Stand behalten
function pruefe(tage) {
  const n = Object.keys(tage).length, namen = new Set(Object.values(tage).flat()).size;
  const fehler = [];
  if (n < 300) fehler.push(`nur ${n} Tage mit Namen (erwartet ≥ 300)`);
  if (namen < 300) fehler.push(`nur ${namen} verschiedene Namen (erwartet ≥ 300)`);
  const falsch = Object.entries(ANKER).filter(([t, name]) => !(tage[t] || []).includes(name));
  if (falsch.length > 2) fehler.push(`bekannte Namenstage fehlen: ${falsch.map(([t, name]) => `${name} ${t}`).join(', ')}`);
  return fehler;
}

function erzeuge(json, stand = new Date().toISOString().slice(0, 10)) {
  const tage = auswerten(json);
  return { format: 2, quelle: 'Wikidata (CC0): Gedenktage der Heiligen mit Artikel in der deutschen Wikipedia', stand, tage };
}

// ---- Abruf (nur in der Action; braucht Netz) ----
const UA = 'DAILY-Namenstage/2.0 (https://github.com/RogerWilloughby/daily)';
const SPARQL = 'SELECT ?heiliger ?tag WHERE { ?heiliger wdt:P841 ?tag ; wdt:P31 wd:Q5 . }';
const qid = uri => String(uri || '').split('/').pop();
const warte = ms => new Promise(r => setTimeout(r, ms));

async function holeJson(url, opts = {}, versuche = 4) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { ...opts, headers: { 'User-Agent': UA, Accept: 'application/json', ...(opts.headers || {}) }, signal: AbortSignal.timeout(90000) });
      if (r.ok) return await r.json();
      throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      if (i >= versuche) throw new Error(`${url.slice(0, 80)}: ${e.message}`);
      await warte(5000 * i);
    }
  }
}
const sparql = q => holeJson('https://query.wikidata.org/sparql', {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' },
  body: 'query=' + encodeURIComponent(q)
}).then(j => j.results.bindings);

// Kennungen → { id: { de, en, links, dewiki } } in Stapeln zu 50
async function entitaeten(ids, mitLinks) {
  const out = {}, liste = [...new Set(ids)];
  for (let i = 0; i < liste.length; i += 50) {
    const teil = liste.slice(i, i + 50).join('|');
    const j = await holeJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&maxlag=5&languages=de|en&props=labels${mitLinks ? '|sitelinks' : ''}&ids=${teil}`);
    for (const [id, e] of Object.entries(j.entities || {})) {
      const sl = e.sitelinks || {};
      out[id] = { de: e.labels && e.labels.de && e.labels.de.value, en: e.labels && e.labels.en && e.labels.en.value, links: Object.keys(sl).length, dewiki: !!sl.dewiki };
    }
    if (i && i % 5000 === 0) console.log(`  … ${i} von ${liste.length}`);
    await warte(100);
  }
  return out;
}

// Gedenktage + Beschriftungen → Zeilen im Format, das auswerten() erwartet (nur Personen mit deutschem Artikel)
function zeilen(gedenktage, personen, tage) {
  const out = [];
  for (const g of gedenktage) {
    const p = personen[g.heiliger];
    if (!p || !p.dewiki) continue;
    const name = vornameAus(p.de);
    if (!name) continue;
    out.push({ nameDe: { value: name }, tagEn: { value: (tage[g.tag] || {}).en || '' }, links: { value: String(p.links) }, weg: { value: 'heilige' }, heiliger: { value: g.heiliger } });
  }
  return { results: { bindings: out } };
}

async function abrufen() {
  const gedenktage = (await sparql(SPARQL)).map(b => ({ heiliger: qid(b.heiliger.value), tag: qid(b.tag.value) }));
  console.log(`Personen mit Gedenktag: ${new Set(gedenktage.map(g => g.heiliger)).size} (${gedenktage.length} Gedenktage)`);
  const personen = await entitaeten(gedenktage.map(g => g.heiliger), true);
  console.log(`davon mit Artikel in der deutschen Wikipedia: ${Object.values(personen).filter(p => p.dewiki).length}`);
  const tage = await entitaeten(gedenktage.map(g => g.tag), false);
  return zeilen(gedenktage, personen, tage);
}

if (require.main === module) {
  (async () => {
    const json = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : await abrufen();
    const daten = erzeuge(json), fehler = pruefe(daten.tage);
    console.log(`Namenstage: ${Object.keys(daten.tage).length} Tage, ${new Set(Object.values(daten.tage).flat()).size} Namen`);
    console.log('Stichprobe: ' + Object.keys(ANKER).map(t => `${t} ${(daten.tage[t] || []).join('/')}`).join(' · '));
    if (fehler.length) { console.error('Abbruch: ' + fehler.join('; ')); process.exit(1); }
    fs.writeFileSync(path.join(__dirname, '..', 'services', 'daten', 'namenstage.json'), JSON.stringify(daten));
  })().catch(e => { console.error('Fehler: ' + e.message); process.exit(1); });
}

module.exports = { tagAus, vorname, vornameAus, auswerten, pruefe, erzeuge, zeilen, entitaeten, ANKER, MAX };
