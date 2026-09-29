// Ersatz für fetch() in Tests und im lokalen Testserver: beantwortet Aufrufe an externe Dienste mit Beispieldaten.
const F = require('./fixtures');

module.exports = async function fetchStub(url, opts = {}) {
  const u = String(url);
  const reply = (body, type = 'application/json') => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200, headers: { 'content-type': type } });
  if (u.includes('tagesschau.de')) return reply(F.rss('Tagesschau'), 'application/rss+xml');
  if (u.includes('mdr.de')) return reply(F.rss('MDR Sachsen'), 'application/rss+xml');
  if (u.includes('heise.de')) return reply(F.atom('heise'), 'application/atom+xml');
  if (u.includes('finance.yahoo.com')) return reply(F.yahoo(u));
  if (u.includes('eurofxref-hist-90d.xml')) return reply(F.ezbKurse(), 'text/xml');
  if (u.includes('data-api.ecb.europa.eu/service/data/FM/D.')) return reply(F.ezbZinsen(), 'text/csv');
  if (u.includes('data-api.ecb.europa.eu/service/data/ICP/')) return reply(F.ezbInflation(), 'text/csv');
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
  if (u.includes('tankerkoenig.de')) return reply(F.tanken());
  if (u.includes('sgx.geodatenzentrum.de/wmts_basemapde')) { const m = u.match(/\/(\d+)\/(\d+)\/(\d+)\.png$/) || []; return new Response(F.kachelPng(+m[1], +m[3], +m[2]), { status: 200, headers: { 'content-type': 'image/png' } }); }
  if (u.includes('verkehr.autobahn.de')) { const a = F.autobahn(u); return a ? reply(a) : new Response('{}', { status: 404 }); }
  if (u.includes('api.open-meteo.com/v1/forecast')) return reply(F.forecast());
  if (u.includes('air-quality-api.open-meteo.com')) return reply(F.airQuality());
  if (u.includes('api.brightsky.dev/radar')) return reply(F.radar(u));
  if (u.includes('geocoding-api.open-meteo.com')) return reply(F.geocoding(new URL(u).searchParams.get('name')));
  if (u.includes('calendar.test')) return reply(F.ics(), 'text/calendar');
  return new Response('not mocked: ' + u, { status: 404 });
};
