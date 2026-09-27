// Startet die Daten-Erzeuger in tools/daten/ (jede Datei außer dieser ist ein Erzeuger).
// Aufruf: node tools/daten/lauf.js            → alle Erzeuger
//         ERZEUGER=namenstage node tools/daten/lauf.js  → nur diesen (auch mehrere, mit Komma)
// Ein Fehler stoppt nicht die anderen. Fehlgeschlagene stehen in /tmp/daten-fehler.txt (die Action wird dann am Ende rot).
// Jeder Erzeuger exportiert { titel, ausfuehren() } und schreibt seine Datei nach services/daten/.
const fs = require('fs');
const path = require('path');

const ORDNER = __dirname;
const FEHLER = process.env.DATEN_FEHLER || '/tmp/daten-fehler.txt';
const alle = () => fs.readdirSync(ORDNER).filter(f => f.endsWith('.js') && f !== 'lauf.js').map(f => f.slice(0, -3)).sort();

async function lauf(wunsch = '') {
  const vorhanden = alle();
  const namen = wunsch.trim() ? wunsch.split(',').map(s => s.trim()).filter(Boolean) : vorhanden;
  const unbekannt = namen.filter(n => !vorhanden.includes(n));
  if (unbekannt.length) throw new Error(`Unbekannter Erzeuger: ${unbekannt.join(', ')} (vorhanden: ${vorhanden.join(', ')})`);
  const fehler = [];
  for (const n of namen) {
    const e = require(path.join(ORDNER, n + '.js')), start = Date.now();
    console.log(`\n=== ${n}: ${e.titel} ===`);
    try { await e.ausfuehren(); console.log(`=== ${n}: fertig in ${Math.round((Date.now() - start) / 1000)} s ===`); }
    catch (err) { console.error(`=== ${n}: FEHLER – ${err.message} ===`); fehler.push(`${n}: ${err.message}`); }
  }
  return fehler;
}

if (require.main === module) {
  lauf(process.env.ERZEUGER || '').then(fehler => {
    fs.writeFileSync(FEHLER, fehler.join('\n'));
    console.log(fehler.length ? `\n${fehler.length} Erzeuger fehlgeschlagen.` : '\nAlle Erzeuger fertig.');
  }).catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { lauf, alle };
