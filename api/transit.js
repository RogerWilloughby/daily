// DAILY – Abfahrten im Verkehrsverbund Oberelbe (VVO/DVB) über die öffentliche VVO-Schnittstelle.
// 1) Haltestelle per Name suchen, 2) nächste Abfahrten mit Echtzeit holen.
const { postJson, send } = require('./_lib/http');

const PF = 'https://webapi.vvo-online.de/tr/pointfinder';
const DM = 'https://webapi.vvo-online.de/dm';

// "/Date(1790424000000+0200)/" → ISO-Zeit (die Millisekunden sind bereits UTC)
function parseDate(s) {
  const m = /\/Date\((-?\d+)(?:[+-]\d{4})?\)\//.exec(String(s || ''));
  return m ? new Date(Number(m[1])).toISOString() : null;
}

// "33000037|||Dresden|Postplatz|5660061|4621484|0||" → { id, city, name }
function parsePoint(p) {
  const f = String(p).split('|');
  return f[0] && /^\d+$/.test(f[0]) ? { id: f[0], city: f[3] || '', name: f[4] || f[3] || '' } : null;
}

function mapDepartures(list) {
  return (list || []).map(d => {
    const planned = parseDate(d.ScheduledTime), real = parseDate(d.RealTime) || planned;
    return {
      line: d.LineName, direction: d.Direction, mot: d.Mot || '',
      time: real, planned,
      delay: planned && real ? Math.round((Date.parse(real) - Date.parse(planned)) / 60000) : 0,
      platform: d.Platform ? `${d.Platform.Type === 'Railtrack' ? 'Gleis' : 'Steig'} ${d.Platform.Name}` : '',
      cancelled: d.State === 'Cancelled'
    };
  }).filter(d => d.time && !d.cancelled).sort((a, b) => a.time.localeCompare(b.time));
}

async function handler(req, res) {
  const q = String((req.query && req.query.stop) || 'Postplatz').slice(0, 60);
  let stop;
  try {
    const pf = await postJson(PF, { query: q, limit: 5, stopsOnly: true, dvb: true });
    stop = (pf.Points || []).map(parsePoint).filter(Boolean)[0];
  } catch (e) {
    return send(res, { found: false, stop: q, error: 'Haltestellensuche ' + e.message }, 0, 502);
  }
  if (!stop) return send(res, { found: false, stop: q }, 3600);
  try {
    const dm = await postJson(DM, { stopid: stop.id, limit: 12, shorttermchanges: true, mentzonly: false, isarrival: false });
    send(res, { found: true, stop: { id: stop.id, name: dm.Name || stop.name, city: dm.Place || stop.city }, departures: mapDepartures(dm.Departures) }, 30);
  } catch (e) {
    send(res, { found: false, stop: q, error: 'Abfahrten ' + e.message }, 0, 502);
  }
}

module.exports = handler;
module.exports.parseDate = parseDate;
module.exports.parsePoint = parsePoint;
module.exports.mapDepartures = mapDepartures;
