// Lokaler Testserver: liefert public/ aus und führt die echten api/*.js aus –
// deren Zugriffe auf externe Dienste werden mit Beispieldaten beantwortet.
// Start: npm run build && node tools/mock-server.js  →  http://localhost:8787
const http = require('http');
const fs = require('fs');
const path = require('path');
const F = require('./fixtures');
// Testbetrieb: Tankerkönig-Schlüssel vortäuschen; privat nur mit MOCK_PRIVATE=1
process.env.TANKERKOENIG_API_KEY = process.env.TANKERKOENIG_API_KEY || 'test';
if (process.env.MOCK_PRIVATE === '1') process.env.DAILY_PRIVATE = '1';

const ROOT = path.join(__dirname, '..', 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

// Externe Aufrufe der Funktionen abfangen
const realFetch = global.fetch;
global.fetch = async (url, opts = {}) => {
  const u = String(url);
  const reply = (body, type = 'application/json') => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200, headers: { 'content-type': type } });
  if (u.includes('tagesschau.de')) return reply(F.rss('Tagesschau'), 'application/rss+xml');
  if (u.includes('mdr.de')) return reply(F.rss('MDR Sachsen'), 'application/rss+xml');
  if (u.includes('heise.de')) return reply(F.atom('heise'), 'application/atom+xml');
  if (u.includes('finance.yahoo.com')) return reply(F.yahoo(u));
  if (u.includes('openligadb.de/getbltable/bl1')) return reply(F.table1());
  if (u.includes('openligadb.de/getbltable/bl2')) return reply(F.table2());
  if (u.includes('openligadb.de/getbltable/bl3')) return reply([]);
  if (u.includes('openligadb.de/getmatchdata/bl2')) return reply(F.matches2());
  if (u.includes('openligadb.de/getmatchdata')) return reply([]);
  if (u.includes('vvo-online.de/tr/pointfinder')) return reply(F.pointfinder(JSON.parse(opts.body || '{}').query));
  if (u.includes('vvo-online.de/dm')) return reply(F.departures());
  if (u.includes('onthisday')) return reply(F.onthisday());
  if (u.includes('brightsky.dev/alerts')) return reply(F.alerts(process.env.MOCK_ALERTS !== '0'));
  if (u.includes('openholidaysapi.org/SchoolHolidays')) return reply(F.school());
  if (u.includes('tankerkoenig.de')) return reply(F.fuel());
  if (u.includes('calendar.test')) return reply(F.ics(), 'text/calendar');
  return new Response('not mocked: ' + u, { status: 404 });
};

function shim(req, res, body) {
  const u = new URL(req.url, 'http://x');
  req.query = Object.fromEntries(u.searchParams);
  req.body = body ? JSON.parse(body) : undefined;
  res.status = c => { res.statusCode = c; return res; };
  res.json = o => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/api/')) {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      try {
        const h = require(path.join(__dirname, '..', 'api', u.pathname.slice(5) + '.js'));
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
