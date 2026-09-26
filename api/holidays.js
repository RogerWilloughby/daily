// DAILY – Schulferien je Bundesland über OpenHolidays (openholidaysapi.org, frei nutzbar).
// Gesetzliche Feiertage rechnet die App selbst (src/js/lib/feiertage.js).
const { getJson, send } = require('./_lib/http');

const STATES = ['BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'];
const day = d => d.toISOString().slice(0, 10);

function mapSchool(list) {
  return (list || []).map(h => ({
    name: ((h.name || []).find(n => n.language === 'DE') || (h.name || [])[0] || {}).text || 'Ferien',
    start: h.startDate, end: h.endDate
  })).filter(h => h.start && h.end).sort((a, b) => a.start.localeCompare(b.start));
}

async function handler(req, res) {
  const st = String((req.query && req.query.state) || '').toUpperCase();
  if (!STATES.includes(st)) return send(res, { error: 'Unbekanntes Bundesland' }, 0, 400);
  const from = new Date(Date.now() - 30 * 864e5), to = new Date(Date.now() + 400 * 864e5);
  try {
    const list = await getJson(`https://openholidaysapi.org/SchoolHolidays?countryIsoCode=DE&subdivisionCode=DE-${st}&languageIsoCode=DE&validFrom=${day(from)}&validTo=${day(to)}`);
    send(res, { state: st, school: mapSchool(list), source: 'OpenHolidays API' }, 86400);
  } catch (e) {
    send(res, { state: st, school: [], error: e.message }, 0, 502);
  }
}

module.exports = handler;
module.exports.mapSchool = mapSchool;
