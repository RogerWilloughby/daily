// DAILY – ein Einstiegspunkt für alle Dienste: GET /api/v1/<dienst>?… (private Dienste auch POST mit JSON-Körper)
// /api/v1/dienste liefert den Katalog. Jede Antwort hat den Rahmen daily/1 (services/_lib/rahmen.js).
// Eine Funktion für alle Dienste hält uns unter der Funktionsgrenze des Vercel-Hobby-Tarifs.
const { ausfuehren, katalog, byId } = require('../../services');
const { fehlerAntwort, DienstFehler, antwort } = require('../../services/_lib/rahmen');
const { send } = require('../../services/_lib/http');

module.exports = async (req, res) => {
  const q = { ...(req.query || {}) };
  const id = String(q.dienst || '').toLowerCase();
  delete q.dienst;
  const privat = byId[id] && byId[id].klasse === 'privat';
  // Öffentliche Daten ohne Nutzerbezug dürfen auch andere Oberflächen lesen; private nie (und nie im CDN-Cache)
  if (!privat) res.setHeader('Access-Control-Allow-Origin', '*');
  delete q._post;
  // Private Dienste nehmen zusätzlich POST (JSON-Körper), damit z. B. Kalender-Links nie in einer Adresse stehen
  if (req.method === 'POST' && privat) {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return send(res, fehlerAntwort(id, new DienstFehler('eingabe_ungueltig', 'JSON-Körper erwartet')), 0, 400);
    Object.assign(q, body, { _post: true });
  } else if (req.method !== 'GET') return send(res, fehlerAntwort(id, new DienstFehler('eingabe_ungueltig', privat ? 'Nur GET oder POST' : 'Nur GET')), 0, 405);
  try {
    if (id === 'dienste') {
      if (Object.keys(q).length) throw new DienstFehler('eingabe_ungueltig', `Unbekannte Angabe „${Object.keys(q)[0]}“ – der Katalog kennt keine Angaben`);
      return send(res, antwort({ id: 'dienste', version: 1, ttl: 300, quellen: [] }, { daten: { app: require('../../services/_lib/version').APP, dienste: katalog() } }), 300);
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
