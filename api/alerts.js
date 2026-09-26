// DAILY – amtliche Wetterwarnungen des Deutschen Wetterdienstes für einen Ort, über Bright Sky (api.brightsky.dev).
// Quelle: Deutscher Wetterdienst. Keine eigenen Texte, nur die amtliche Warnung.
const { getJson, send, coord } = require('./_lib/http');

const LEVEL = { minor: 1, moderate: 2, severe: 3, extreme: 4 };
const cap = s => String(s || '').toLowerCase().replace(/(^|[\s-])\S/g, c => c.toUpperCase());

function mapAlerts(j) {
  const alerts = ((j && j.alerts) || []).filter(a => a.status !== 'test').map(a => ({
    event: cap(a.event_de || a.event_en), headline: a.headline_de || a.headline_en || '',
    level: LEVEL[a.severity] || 1, onset: a.onset || a.effective || null, expires: a.expires || null,
    description: a.description_de || a.description_en || '', instruction: a.instruction_de || ''
  })).sort((a, b) => b.level - a.level || String(a.onset).localeCompare(String(b.onset)));
  const loc = (j && j.location) || {};
  return { area: loc.name_short || loc.name || '', alerts };
}

async function handler(req, res) {
  const lat = coord(req.query && req.query.lat, 90), lon = coord(req.query && req.query.lon, 180);
  if (lat === null || lon === null) return send(res, { error: 'Ort fehlt' }, 0, 400);
  try {
    const j = await getJson(`https://api.brightsky.dev/alerts?lat=${lat}&lon=${lon}`);
    send(res, { ...mapAlerts(j), source: 'Deutscher Wetterdienst' }, 300);
  } catch (e) {
    send(res, { area: '', alerts: [], error: e.message }, 0, 502);
  }
}

module.exports = handler;
module.exports.mapAlerts = mapAlerts;
