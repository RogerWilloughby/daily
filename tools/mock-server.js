// Lokaler Testserver: liefert public/ aus und führt die echten api/*.js aus –
// deren Zugriffe auf externe Dienste werden mit Beispieldaten beantwortet.
// Start: npm run build && node tools/mock-server.js  →  http://localhost:8787
const http = require('http');
const fs = require('fs');
const path = require('path');
// Testbetrieb: Tankerkönig-Schlüssel vortäuschen; privat nur mit MOCK_PRIVATE=1
process.env.TANKERKOENIG_API_KEY = process.env.TANKERKOENIG_API_KEY || 'test';
if (process.env.MOCK_PRIVATE === '1') process.env.DAILY_PRIVATE = '1';
// Kennwort des privaten Betriebs im Testserver: „test“ (im Browser unter Einstellungen → Privater Betrieb eintragen)
process.env.DAILY_PRIVAT_KENNWORT = process.env.DAILY_PRIVAT_KENNWORT || 'test';

const ROOT = path.join(__dirname, '..', 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

// Kopfzeilen aus vercel.json wie bei Vercel setzen (z. B. Content-Security-Policy) – so zeigt die Messung im Browser, ob die Regel etwas blockiert
const KOPF = (require('../vercel.json').headers || []).map(h => ({ re: new RegExp('^' + h.source.split('(.*)').map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$'), kopf: h.headers }));
const setzeKopf = (pfad, res) => KOPF.forEach(k => { if (k.re.test(pfad)) k.kopf.forEach(x => res.setHeader(x.key, x.value)); });

// Externe Aufrufe der Funktionen abfangen (dieselben Beispieldaten wie in den Tests)
const realFetch = global.fetch;
global.fetch = require('./fetch-stub');
// Kalender-Testadressen (calendar.test) gibt es im DNS nicht: Auflösung vortäuschen (öffentliche Adresse)
require('../services/termine').aufloesen = async () => [{ address: '93.184.216.34', family: 4 }];

// Jede Antwort im Format daily/1 gegen Rahmen und Schema des Diensts prüfen – streng, auch unbekannte Felder (Review M6).
// Verstöße stehen im Log („SCHEMA-FEHLER …“) und in der Kopfzeile X-Daily-Schema (ok | fehler: Anzahl), damit Messungen sie sehen.
const { pruefeStreng, RAHMEN } = require('../services/_lib/schema');
const DIENSTE = require('../services');
function schemaPruefen(id, o, res) {
  if (!id || !o || o.format !== 'daily/1') return;
  const d = DIENSTE.byId[id];
  const f = [...pruefeStreng(o, RAHMEN), ...(d && o.daten != null ? pruefeStreng(o.daten, d.schema) : [])];
  res.setHeader('X-Daily-Schema', f.length ? 'fehler: ' + f.length : 'ok');
  if (f.length) console.error(`SCHEMA-FEHLER ${id}: ${f.slice(0, 5).join(' · ')}${f.length > 5 ? ' …' : ''}`);
}

function shim(req, res, body) {
  const u = new URL(req.url, 'http://x');
  req.query = Object.fromEntries(u.searchParams);
  req.body = body ? JSON.parse(body) : undefined;
  res.status = c => { res.statusCode = c; return res; };
  res.json = o => { schemaPruefen(req.query.dienst, o, res); res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  setzeKopf(u.pathname, res);
  if (u.pathname.startsWith('/api/')) {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      try {
        // /api/v1/<dienst> → eine Funktion für alle Dienste (wie bei Vercel: api/v1/[dienst].js)
        const v1 = /^\/api\/v1\/([a-z0-9-]+)$/.exec(u.pathname);
        const h = require(path.join(__dirname, '..', 'api', v1 ? 'v1/[dienst].js' : u.pathname.slice(5) + '.js'));
        if (v1) req.url += (req.url.includes('?') ? '&' : '?') + 'dienst=' + v1[1];
        shim(req, res, body); await h(req, res);
      } catch (e) { res.statusCode = 500; res.end(String(e.stack)); }
    });
    return;
  }
  let p = path.join(ROOT, decodeURIComponent(u.pathname));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (err, data) => {
    if (err) { res.statusCode = 404; return res.end('404'); }
    res.setHeader('content-type', TYPES[path.extname(p)] || 'application/octet-stream');
    res.end(data);
  });
}).listen(process.env.PORT || 8787, () => console.log('DAILY Testserver: http://localhost:' + (process.env.PORT || 8787)));

module.exports = { realFetch };
