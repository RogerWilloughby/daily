// DAILY – günstigste Tankstellen in der Nähe über die Tankerkönig-API (Daten der Markttransparenzstelle für Kraftstoffe, CC BY 4.0).
// Braucht einen kostenlosen API-Schlüssel als Vercel-Variable TANKERKOENIG_API_KEY (https://onboarding.tankerkoenig.de).
const { getJson, send, coord } = require('./_lib/http');

const TYPES = ['e5', 'e10', 'diesel'];

function mapStations(list) {
  return (list || []).filter(s => s.isOpen !== false && typeof s.price === 'number' && s.price > 0).map(s => ({
    name: s.brand || s.name || 'Tankstelle', street: [s.street, s.houseNumber].filter(Boolean).join(' ').trim(),
    place: s.place || '', dist: s.dist, price: s.price
  })).sort((a, b) => a.price - b.price || a.dist - b.dist).slice(0, 8);
}

async function handler(req, res) {
  const key = process.env.TANKERKOENIG_API_KEY;
  if (!key) return send(res, { configured: false }, 300);
  const lat = coord(req.query && req.query.lat, 90), lon = coord(req.query && req.query.lon, 180);
  const type = TYPES.includes(String(req.query && req.query.type)) ? req.query.type : 'e10';
  if (lat === null || lon === null) return send(res, { error: 'Ort fehlt' }, 0, 400);
  try {
    const j = await getJson(`https://creativecommons.tankerkoenig.de/json/list.php?lat=${lat}&lng=${lon}&rad=5&sort=price&type=${type}&apikey=${encodeURIComponent(key)}`);
    if (!j.ok) throw new Error(j.message || 'Antwort nicht ok');
    send(res, { configured: true, type, stations: mapStations(j.stations), source: 'Tankerkönig (CC BY 4.0), MTS-K' }, 300);
  } catch (e) {
    send(res, { configured: true, type, stations: [], error: e.message }, 0, 502);
  }
}

module.exports = handler;
module.exports.mapStations = mapStations;
