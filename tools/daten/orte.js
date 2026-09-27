// Erzeuger „orte“: Ortsbestand services/daten/orte-de.json aus GeoNames (CC BY 4.0) – Postleitzahlen und Orte Deutschlands.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = {
  titel: 'Ortsbestand aus GeoNames',
  async ausfuehren() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'geo-'));
    const lade = (url, datei) => execFileSync('curl', ['-sSfL', '--retry', '3', '-o', path.join(tmp, datei), url], { stdio: 'inherit' });
    lade('https://download.geonames.org/export/zip/DE.zip', 'plz.zip');
    lade('https://download.geonames.org/export/dump/DE.zip', 'orte.zip');
    execFileSync('unzip', ['-o', '-q', path.join(tmp, 'plz.zip'), '-d', path.join(tmp, 'plz')], { stdio: 'inherit' });
    execFileSync('unzip', ['-o', '-q', path.join(tmp, 'orte.zip'), '-d', path.join(tmp, 'orte')], { stdio: 'inherit' });
    execFileSync(process.execPath, [path.join(__dirname, '..', 'orte-daten.js'), path.join(tmp, 'plz', 'DE.txt'), path.join(tmp, 'orte', 'DE.txt')], { stdio: 'inherit' });
  }
};
