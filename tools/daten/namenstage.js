// Erzeuger „namenstage“: services/daten/namenstage.json aus Wikidata (CC0) – Gedenktage der Heiligen und Namenstage.
const { execFileSync } = require('child_process');
const path = require('path');

module.exports = {
  titel: 'Namenstage aus Wikidata',
  async ausfuehren() {
    execFileSync(process.execPath, [path.join(__dirname, '..', 'namenstage-daten.js')], { stdio: 'inherit' });
  }
};
