// Erzeugt services/daten/namenstage.json aus Wikidata (CC0, gemeinfrei). Je Tag die bekanntesten Vornamen, höchstens MAX.
// Aufruf: über den Erzeuger tools/daten/namenstage.js (GitHub Action „Daten erneuern“) oder direkt: node tools/namenstage-daten.js
// Ablauf in kleinen Schritten, weil Wikidata Abfragen nach 60 s abbricht:
//   1. SPARQL nur mit Kennungen: Heilige (P411 = Heiliger) mit Gedenktag (P841) und Vorname (P735)
//   2. SPARQL nur mit Kennungen: Vornamen mit Namenstag (P1750) für Deutschland/Österreich
//   3. Namen (deutsch), Tage (englisch, z. B. „March 19“) und Bekanntheit (Zahl der Sprachversionen)
//      stapelweise über die Wikidata-Schnittstelle (wbgetentities, je 50 Kennungen)
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

// ---- Abruf (nur in der Action; braucht Netz) ----
const UA = 'DAILY-Namenstage/1.1 (https://github.com/RogerWilloughby/daily)';
const SPARQL_HEILIGE = 'SELECT ?heiliger ?tag ?name WHERE { ?heiliger wdt:P411 wd:Q43115 ; wdt:P841 ?tag ; wdt:P735 ?name . }';
const SPARQL_NAMENSTAG = 'SELECT ?name ?tag WHERE { ?name p:P1750 ?a . ?a ps:P1750 ?tag ; (pq:P17|pq:P1001) ?land . VALUES ?land { wd:Q183 wd:Q40 } }';
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

// Kennungen → { id: { de, en, links } } in Stapeln zu 50
async function entitaeten(ids, mitLinks) {
  const out = {}, liste = [...new Set(ids)];
  for (let i = 0; i < liste.length; i += 50) {
    const teil = liste.slice(i, i + 50).join('|');
    const j = await holeJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&maxlag=5&languages=de|en&props=labels${mitLinks ? '|sitelinks' : ''}&ids=${teil}`);
    for (const [id, e] of Object.entries(j.entities || {})) {
      out[id] = { de: e.labels && e.labels.de && e.labels.de.value, en: e.labels && e.labels.en && e.labels.en.value, links: e.sitelinks ? Object.keys(e.sitelinks).length : 0 };
    }
    await warte(200);
  }
  return out;
}

// Rohdaten (Kennungen) + Beschriftungen → Zeilen im Format, das auswerten() erwartet
function zeilen(heilige, namenstage, namen, tage) {
  const z = (nameId, tagId, weg, heiliger) => ({
    nameDe: { value: (namen[nameId] || {}).de || '' }, tagEn: { value: (tage[tagId] || {}).en || '' },
    links: { value: String((namen[nameId] || {}).links || 0) }, weg: { value: weg }, ...(heiliger ? { heiliger: { value: heiliger } } : {})
  });
  return { results: { bindings: [...heilige.map(h => z(h.name, h.tag, 'heilige', h.heiliger)), ...namenstage.map(n => z(n.name, n.tag, 'namenstag'))] } };
}

async function abrufen() {
  const heilige = (await sparql(SPARQL_HEILIGE)).map(b => ({ heiliger: qid(b.heiliger.value), tag: qid(b.tag.value), name: qid(b.name.value) }));
  console.log(`Heilige mit Gedenktag und Vorname: ${heilige.length}`);
  let namenstage = [];
  try { namenstage = (await sparql(SPARQL_NAMENSTAG)).map(b => ({ tag: qid(b.tag.value), name: qid(b.name.value) })); }
  catch (e) { console.warn('Namenstage (P1750) übersprungen: ' + e.message); }
  console.log(`Ausdrückliche Namenstage DE/AT: ${namenstage.length}`);
  const alle = [...heilige, ...namenstage];
  const namen = await entitaeten(alle.map(x => x.name), true);
  const tage = await entitaeten(alle.map(x => x.tag), false);
  console.log(`Beschriftungen: ${Object.keys(namen).length} Namen, ${Object.keys(tage).length} Tage`);
  return zeilen(heilige, namenstage, namen, tage);
}

if (require.main === module) {
  (async () => {
    const json = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : await abrufen();
    const daten = erzeuge(json), fehler = pruefe(daten.tage);
    console.log(`Namenstage: ${Object.keys(daten.tage).length} Tage, ${new Set(Object.values(daten.tage).flat()).size} Namen`);
    if (fehler.length) { console.error('Abbruch: ' + fehler.join('; ')); process.exit(1); }
    fs.writeFileSync(path.join(__dirname, '..', 'services', 'daten', 'namenstage.json'), JSON.stringify(daten));
  })().catch(e => { console.error('Fehler: ' + e.message); process.exit(1); });
}

module.exports = { tagAus, vorname, auswerten, pruefe, erzeuge, zeilen, entitaeten, MAX };
