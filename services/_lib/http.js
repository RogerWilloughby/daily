// Gemeinsame HTTP-Helfer für alle Dienste (services/) und die älteren Einzelfunktionen (api/).
const crypto = require('crypto');
const UA = 'DAILY/0.2 (privates Dashboard; https://github.com/RogerWilloughby/daily)';

async function request(url, opts = {}) {
  let r;
  try {
    r = await fetch(url, {
      method: opts.method || 'GET',
      headers: { 'user-agent': UA, accept: opts.accept || '*/*', ...(opts.headers || {}) },
      body: opts.body,
      signal: AbortSignal.timeout(opts.timeout || 8000)
    });
  } catch (e) {
    throw new Error(e && e.name === 'TimeoutError' ? 'Zeitüberschreitung' : 'nicht erreichbar');
  }
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r;
}

const getText = async (url, opts) => (await request(url, opts)).text();
const getJson = async (url, opts) => (await request(url, { accept: 'application/json', ...opts })).json();
const postJson = async (url, data, opts = {}) => (await request(url, {
  ...opts, method: 'POST', accept: 'application/json',
  headers: { 'content-type': 'application/json', ...(opts.headers || {}) }, body: JSON.stringify(data)
})).json();

// Antwort mit Cache-Angabe für das Vercel-CDN (Sekunden). stale-if-error: Fällt die Quelle aus, darf das CDN die letzte gute Antwort
// bis zu 1 Stunde weitergeben (Review H2, Entscheidung 02.10.2026); die Oberfläche zeigt dann „Stand …“ (altes erstellt/gueltigBis).
// Fehler (4xx/5xx) speichert das Vercel-CDN ohnehin nicht – dafür merkt sich services/index.js Quellenfehler 60 s je Instanz.
const STALE_IF_ERROR = 3600;
function send(res, data, maxAge = 300, status = 200) {
  res.setHeader('Cache-Control', maxAge > 0 ? `s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 3}, stale-if-error=${STALE_IF_ERROR}` : 'private, no-store');
  res.status(status).json(data);
}

// Name vergleichbar machen: klein, ohne Akzente/Umlaute-Varianten und Satzzeichen
const norm = s => String(s || '').toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Privater Betrieb (Kalender, Schlagzeilen): nur wenn in Vercel DAILY_PRIVATE=1 gesetzt ist
const isPrivate = () => process.env.DAILY_PRIVATE === '1';
// Kennwort für den privaten Betrieb (Review M2, Entscheidung 02.10.2026): Vercel-Variable DAILY_PRIVAT_KENNWORT; der Browser schickt es
// in der Kopfzeile X-Daily-Kennwort (nie in der Adresse). Fehlt die Variable, bleibt der private Teil zu – unabhängig vom Vercel-Zugangsschutz.
function kennwortOk(kopf = {}) {
  const soll = process.env.DAILY_PRIVAT_KENNWORT || '', ist = String((kopf && kopf['x-daily-kennwort']) || '');
  if (!soll || !ist) return false;
  const h = s => crypto.createHash('sha256').update(s, 'utf8').digest();
  return crypto.timingSafeEqual(h(soll), h(ist));   // zeitkonstant
}
function privateOnly(req, res) {
  if (!isPrivate()) { send(res, { error: 'Nur im privaten Betrieb verfügbar.' }, 0, 404); return true; }
  if (!kennwortOk(req.headers)) { send(res, { error: 'Kennwort für den privaten Betrieb fehlt oder ist falsch (Einstellungen → Privater Betrieb).', kennwort: true }, 0, 401); return true; }
  return false;
}

// Koordinaten auf 2 Nachkommastellen (≈ 1 km) runden: schützt den genauen Standort und teilt den Cache
const coord = (v, max) => { const n = Number(v); return Number.isFinite(n) && Math.abs(n) <= max ? Math.round(n * 100) / 100 : null; };

module.exports = { STALE_IF_ERROR, getText, getJson, postJson, send, norm, isPrivate, kennwortOk, privateOnly, coord };
