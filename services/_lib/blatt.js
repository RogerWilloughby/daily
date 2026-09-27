// Dienstblatt: Transparenz je Dienst – woher die Daten kommen, was der Dienst tut, Ein- und Ausgabe, Skalierung.
// Steht im Dienst-Modul (Feld „blatt“), erscheint im Katalog /api/v1/dienste und wird mit „npm run doku“
// zu docs/dienste/<id>.md. Ein Test prüft, dass jedes Blatt vollständig ist und jedes Ausgabefeld beschreibt.

const SKALIERUNG = ['klasse', 'quelle', 'kosten', 'cache', 'bei10Mio'];
const KLASSEN = {
  A: 'berechnet – ohne Quelle, beliebig oft',
  B: 'für alle gleich – ein Abruf je Zeitraum reicht für alle Nutzer',
  C: 'je Ort, rasterbar – Anfragen je gerundetem Ort bündelbar',
  D: 'je Eingabe – jede Eingabe ist eigen (Suche, Liste)'
};

// alle Feldpfade eines Schemas: orte, orte[].name, luft.pollen.erle …
function pfade(schema, vor = '') {
  const out = [];
  const props = schema && schema.properties;
  if (props) for (const [k, s] of Object.entries(props)) {
    const p = vor ? `${vor}.${k}` : k;
    out.push(p);
    if (s.properties) out.push(...pfade(s, p));
    if (s.items) { out.push(...pfade(s.items, p + '[]')); }
  }
  return out;
}

// fehlende Angaben eines Dienstblatts (leer = vollständig)
function pruefeBlatt(d) {
  const b = d.blatt, f = [];
  if (!b) return [`${d.id}: blatt fehlt`];
  if (!/^\d+\.\d+\.\d+$/.test(d.programmversion || '')) f.push(`${d.id}: programmversion fehlt oder ist nicht x.y.z`);
  if (!d.aenderungen || !d.aenderungen.length || d.aenderungen[0].version !== d.programmversion) f.push(`${d.id}: aenderungen muss mit der programmversion beginnen`);
  for (const k of ['zweck', 'herkunft', 'verarbeitung', 'ausgabe', 'skalierung']) if (!b[k] || (Array.isArray(b[k]) && !b[k].length)) f.push(`${d.id}: blatt.${k} fehlt`);
  for (const k of SKALIERUNG) if (!b.skalierung || !b.skalierung[k]) f.push(`${d.id}: blatt.skalierung.${k} fehlt`);
  if (b.skalierung && b.skalierung.klasse && !KLASSEN[b.skalierung.klasse]) f.push(`${d.id}: Skalierungsklasse ${b.skalierung.klasse} unbekannt`);
  const soll = pfade(d.schema), ist = Object.keys(b.ausgabe || {});
  for (const p of soll) if (!ist.includes(p)) f.push(`${d.id}: Ausgabefeld ${p} nicht beschrieben`);
  for (const p of ist) if (!soll.includes(p)) f.push(`${d.id}: Ausgabefeld ${p} gibt es im Schema nicht`);
  for (const [k, v] of Object.entries(d.eingaben || {})) if (!v) f.push(`${d.id}: Eingabe ${k} ohne Beschreibung`);
  return f;
}

const liste = x => (Array.isArray(x) ? x : [x]).map(z => `- ${z}`).join('\n');
const zelle = s => String(s).replace(/\|/g, '\\|');

// Dienstblatt als Markdown (docs/dienste/<id>.md)
function markdown(d) {
  const b = d.blatt, s = b.skalierung;
  const laender = d.laender === 'alle' || !d.laender ? 'weltweit' : d.laender.join(', ');
  return `# Dienst \`${d.id}\` – ${d.titel}

> Erzeugt aus \`services/${d.id}.js\` mit \`npm run doku\` – nicht von Hand bearbeiten.

${d.beschreibung}

| | |
|---|---|
| Aufruf | \`GET /api/v1/${d.id}\` |
| Programmversion | ${d.programmversion || '–'} |
| Vertrag (Datenformat) | daily/1, Version ${d.version} |
| Klasse | ${d.klasse} |
| Länder | ${laender} |
| Gültigkeit | ${d.takt ? `bis zum nächsten Takt von ${d.takt / 60} min (z. B. :00/:30)` : `${d.ttl} s`} |

## Zweck
${b.zweck}

## Herkunft der Daten
${liste(b.herkunft)}

Quellen mit Lizenz:
${d.quellen.map(q => `- ${q.name} (${q.lizenz || 'ohne Angabe'})${q.url ? ` – ${q.url}` : ''}`).join('\n')}

## Eingabe
| Parameter | Bedeutung |
|---|---|
${Object.entries(d.eingaben || {}).map(([k, v]) => `| \`${k}\` | ${zelle(v)} |`).join('\n')}

## Verarbeitung
${liste(b.verarbeitung)}

## Ausgabe (\`daten\`)
| Feld | Bedeutung |
|---|---|
${Object.entries(b.ausgabe).map(([k, v]) => `| \`${k}\` | ${zelle(v)} |`).join('\n')}
${b.hinweise ? `
Hinweise (\`hinweise\`):
${Object.entries(b.hinweise).map(([k, v]) => `- \`${k}\`: ${v}`).join('\n')}
` : ''}
## Skalierung
| | |
|---|---|
| Klasse | ${s.klasse} – ${KLASSEN[s.klasse]} |
| Quelle | ${zelle(s.quelle)} |
| Kosten | ${zelle(s.kosten)} |
| Cache | ${zelle(s.cache)} |
| Bei 10 Mio. Aufrufen/Tag | ${zelle(s.bei10Mio)} |

Rahmen und Stufen: \`../architektur/skalierung.md\`
${d.aenderungen && d.aenderungen.length ? `
## Änderungen
| Version | Datum | Änderung |
|---|---|---|
${d.aenderungen.map(a => `| ${a.version} | ${a.datum} | ${zelle(a.text)} |`).join('\n')}
` : ''}
`;
}

module.exports = { pfade, pruefeBlatt, markdown, KLASSEN };
