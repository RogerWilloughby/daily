// Erzeugt die Dienstblätter docs/dienste/<id>.md und die Übersicht docs/dienste/README.md aus den Dienst-Modulen.
// Aufruf: npm run doku   (ein Test prüft, dass die Dateien aktuell sind)
const fs = require('fs');
const path = require('path');
const { DIENSTE } = require('../services');
const { markdown, KLASSEN } = require('../services/_lib/blatt');

const ORDNER = path.join(__dirname, '..', 'docs', 'dienste');

function uebersicht() {
  return `# DAILY – Dienstblätter

> Erzeugt mit \`npm run doku\` – nicht von Hand bearbeiten. Jeder Dienst beschreibt sich selbst im Feld \`blatt\` seines Moduls in \`services/\`.
> Dieselben Angaben liefert der Katalog \`GET /api/v1/dienste\`; die App zeigt sie unter „Woher kommen die Daten?“.

| Dienst | Titel | Version | Quellen | Länder | Skalierung |
|---|---|---|---|---|---|
${DIENSTE.map(d => `| [\`${d.id}\`](${d.id}.md) | ${d.titel} | ${d.programmversion || '–'} | ${d.quellen.map(q => q.name).join(', ')} | ${d.laender === 'alle' ? 'weltweit' : d.laender.join(', ')} | ${d.blatt ? d.blatt.skalierung.klasse : '–'} |`).join('\n')}

Skalierungsklassen: ${Object.entries(KLASSEN).map(([k, v]) => `**${k}** ${v}`).join(' · ')}
`;
}

function dateien() {
  const out = { 'README.md': uebersicht() };
  for (const d of DIENSTE) if (d.blatt) out[`${d.id}.md`] = markdown(d);
  return out;
}

if (require.main === module) {
  fs.mkdirSync(ORDNER, { recursive: true });
  for (const [name, inhalt] of Object.entries(dateien())) fs.writeFileSync(path.join(ORDNER, name), inhalt);
  console.log('Dienstblätter geschrieben:', Object.keys(dateien()).join(', '));
}

module.exports = { dateien, ORDNER };
