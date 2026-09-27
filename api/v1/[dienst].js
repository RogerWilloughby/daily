// DAILY – ein Einstiegspunkt für alle Dienste: GET /api/v1/<dienst>?…
// /api/v1/dienste liefert den Katalog. Jede Antwort hat den Rahmen daily/1 (services/_lib/rahmen.js).
// Eine Funktion für alle Dienste hält uns unter der Funktionsgrenze des Vercel-Hobby-Tarifs.
const { ausfuehren, paket, katalog, byId } = require('../../services');
const { fehlerAntwort, DienstFehler, antwort } = require('../../services/_lib/rahmen');
const { send } = require('../../services/_lib/http');

module.exports = async (req, res) => {
  const q = { ...(req.query || {}) };
  const id = String(q.dienst || '').toLowerCase();
  delete q.dienst;
  const privat = byId[id] && byId[id].klasse === 'privat';
  // Öffentliche Daten ohne Nutzerbezug dürfen auch andere Oberflächen lesen; private nie (und nie im CDN-Cache)
  if (!privat) res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return send(res, fehlerAntwort(id, new DienstFehler('eingabe_ungueltig', 'Nur GET')), 0, 405);
  try {
    if (id === 'dienste') {
      return send(res, antwort({ id: 'dienste', version: 1, ttl: 300, quellen: [] }, { daten: { app: require('../../services/_lib/version').APP, dienste: katalog() } }), 300);
    }
    if (id === 'paket') {   // /api/v1/paket?dienste=wetter,regen&lat=…&lon=… – nur öffentliche Dienste
      const ids = String(q.dienste || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
      delete q.dienste;
      if (ids.some(x => byId[x] && byId[x].klasse === 'privat')) throw new DienstFehler('eingabe_ungueltig', 'Private Dienste nicht im Paket');
      const r = await paket(ids, q);
      return send(res, r, Math.max(60, Math.round((Date.parse(r.gueltigBis) - Date.now()) / 1000)));
    }
    const r = await ausfuehren(id, q);
    // CDN-Cache genau bis gueltigBis (mindestens 60 s) – bei Diensten mit Takt also bis zur nächsten vollen/halben Stunde
    send(res, r, privat ? 0 : Math.max(60, Math.round((Date.parse(r.gueltigBis) - Date.now()) / 1000)));
  } catch (e) {
    const f = e instanceof DienstFehler ? e : new DienstFehler('intern');
    if (!(e instanceof DienstFehler)) console.error('[daily]', id, e);
    send(res, fehlerAntwort(id, f), 0, f.status);
  }
};
