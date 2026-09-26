// Gemeinsame Helfer für die DAILY-Funktionen (Ordner mit _ wird von Vercel nicht als Funktion veröffentlicht).
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

// Antwort mit Cache-Angabe für das Vercel-CDN (Sekunden)
function send(res, data, maxAge = 300, status = 200) {
  res.setHeader('Cache-Control', maxAge > 0 ? `s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 3}` : 'private, no-store');
  res.status(status).json(data);
}

// Name vergleichbar machen: klein, ohne Akzente/Umlaute-Varianten und Satzzeichen
const norm = s => String(s || '').toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

module.exports = { getText, getJson, postJson, send, norm };
