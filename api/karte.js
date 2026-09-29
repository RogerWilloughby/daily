// DAILY – Kartenkacheln für die Radarkarte: GET /api/karte?z=9&x=275&y=171 → PNG (256 × 256).
// Quelle: basemap.de Web Raster grau (Bundesamt für Kartographie und Geodäsie, © GeoBasis-DE / BKG), Web-Mercator-Kacheln.
// Kein Dienst im Format daily/1 (die Antwort ist ein Bild), sondern eine Weiterleitung: Der Browser fragt nur DAILY,
// das BKG sieht keine Nutzer-IP; CDN und Browser halten jede Kachel 30 Tage (Deutschland hat bei Zoom 8–11 nur wenige tausend Kacheln).
const QUELLE = 'https://sgx.geodatenzentrum.de/wmts_basemapde/tile/1.0.0/de_basemapde_web_raster_grau/default/GLOBAL_WEBMERCATOR';
const ZOOM = [8, 11];
const GEBIET = { latMin: 46.5, latMax: 56, lonMin: 4.5, lonMax: 16.5 };   // Deutschland mit Rand für ±50 km um Grenzorte
const HALTEN = 30 * 86400;
const UA = 'DAILY (privates Dashboard; https://github.com/RogerWilloughby/daily)';

// Kachelnummer einer Koordinate (Web Mercator)
const kachelX = (lon, z) => Math.floor((lon + 180) / 360 * 2 ** z);
const kachelY = (lat, z) => Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** z);

// Nur Zoom 8–11 und Kacheln über Deutschland (samt Rand) – schützt die Quelle vor beliebigen Abrufen über DAILY
function erlaubt(z, x, y) {
  if (![z, x, y].every(v => Number.isInteger(v))) return false;
  if (z < ZOOM[0] || z > ZOOM[1]) return false;
  return x >= kachelX(GEBIET.lonMin, z) && x <= kachelX(GEBIET.lonMax, z) && y >= kachelY(GEBIET.latMax, z) && y <= kachelY(GEBIET.latMin, z);
}
const zahl = v => (/^\d{1,5}$/.test(String(v)) ? +v : NaN);

module.exports = async function handler(req, res) {
  const q = req.query || {}, z = zahl(q.z), x = zahl(q.x), y = zahl(q.y);
  const fehler = (status, text) => { res.statusCode = status; res.setHeader('Cache-Control', 'no-store'); res.setHeader('content-type', 'text/plain; charset=utf-8'); res.end(text); };
  if (req.method !== 'GET') return fehler(405, 'Nur GET');
  if (!erlaubt(z, x, y)) return fehler(400, 'Kachel außerhalb (Zoom 8–11, nur Deutschland)');
  let r;
  try {
    r = await fetch(`${QUELLE}/${z}/${y}/${x}.png`, { headers: { 'user-agent': UA, accept: 'image/png' }, signal: AbortSignal.timeout(8000) });
  } catch (e) { return fehler(502, 'Karte nicht erreichbar'); }
  if (!r.ok) return fehler(r.status === 404 ? 404 : 502, 'Karte: HTTP ' + r.status);
  const bild = Buffer.from(await r.arrayBuffer());
  res.statusCode = 200;
  res.setHeader('content-type', 'image/png');
  res.setHeader('Cache-Control', `public, max-age=${HALTEN}, s-maxage=${HALTEN}, stale-while-revalidate=${HALTEN}`);
  res.end(bild);
};
module.exports.erlaubt = erlaubt;
module.exports.kachelX = kachelX;
module.exports.kachelY = kachelY;
module.exports.QUELLE = QUELLE;
