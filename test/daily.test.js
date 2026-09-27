// DAILY – Prüfungen ohne Netz: Umwandlung der Dienstdaten und Vollständigkeit der Tagesinhalte.
// Aufruf: npm test   (nutzt node:test, keine weiteren Pakete)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fx = require('../tools/fixtures');

test('Schlagzeilen: RSS und Atom werden gelesen', () => {
  const { parse } = require('../api/headlines');
  const r = parse(fx.rss('Tagesschau'), 'Tagesschau');
  assert.equal(r.length, 3);
  assert.match(r[0].link, /^https:\/\//);
  assert.ok(r[0].date);
  const a = parse(fx.atom('heise'), 'heise');
  assert.ok(a.length >= 1);
});

test('Fußball: Saison beginnt im Juli', () => {
  const { season } = require('../api/sport');
  assert.equal(season(new Date('2026-06-30T12:00:00Z')), 2025);
  assert.equal(season(new Date('2026-07-01T12:00:00Z')), 2026);
});

test('Fußball: eigener Verein wird gefunden und zusammengefasst', () => {
  const { summarize } = require('../api/sport');
  const s = summarize({ id: 'bl2', name: '2. Bundesliga' }, 2026, fx.table2(), fx.matches2(), 'Dynamo Dresden');
  assert.ok(s, 'Dynamo nicht gefunden');
  const me = s.table.find(r => r.isTeam);
  assert.equal(me.pos, 4);
  assert.equal(summarize({ id: 'bl2' }, 2026, fx.table2(), [], 'Gibtsnicht United'), null);
});

test('Abfahrten: VVO-Datum, Haltestelle und Sortierung', () => {
  const { parseDate, parsePoint, mapDepartures } = require('../api/transit');
  assert.equal(parseDate('/Date(1790424000000+0200)/'), new Date(1790424000000).toISOString());
  assert.equal(parseDate('kaputt'), null);
  assert.deepEqual(parsePoint('33000037|||Dresden|Postplatz|5660061|4621484|0||'), { id: '33000037', city: 'Dresden', name: 'Postplatz' });
  assert.equal(parsePoint('streetID:123|||x'), null);
  const deps = mapDepartures(fx.departures().Departures);
  assert.ok(deps.length > 0);
  for (let i = 1; i < deps.length; i++) assert.ok(deps[i - 1].time <= deps[i].time);
});

test('An diesem Tag: Ereignisse mit Link, neueste zuerst', () => {
  const { mapEvents } = require('../api/onthisday');
  const ev = mapEvents(fx.onthisday().selected);
  assert.ok(ev.length > 0);
  for (let i = 1; i < ev.length; i++) assert.ok(ev[i - 1].year >= ev[i].year);
  assert.equal(mapEvents(null).length, 0);
});

test('Tagesinhalte: 31 Tage ab 26.09.2026, alle Felder gefüllt', () => {
  const file = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/content/daily.json'), 'utf8'));
  const tage = file.tage;
  assert.ok(tage.length >= 31, 'weniger als 31 Tage');
  const first = Date.parse(tage[0].datum);
  tage.forEach((t, i) => {
    assert.equal(Date.parse(t.datum), first + i * 864e5, 'Lücke bei ' + t.datum);
    for (const k of ['raetsel', 'witz', 'wort', 'sprichwort', 'rezept', 'land', 'tech', 'beziehung', 'spartipp', 'gesundheit', 'film']) {
      assert.ok(t[k], `${t.datum}: ${k} fehlt`);
    }
    for (const k of ['beziehung', 'spartipp', 'gesundheit']) {
      assert.ok(t[k].kurz && t[k].kurz.length <= 26, `${t.datum}: ${k}.kurz fehlt oder zu lang`);
    }
    assert.ok(t.rezept.zutaten.length >= 3, `${t.datum}: zu wenig Zutaten`);
  });
  // keine Wiederholung innerhalb des Monats
  for (const k of [t => t.rezept.name, t => t.film.titel, t => t.land.name, t => t.raetsel.frage, t => t.witz]) {
    const v = tage.map(k);
    assert.equal(new Set(v).size, v.length, 'doppelter Eintrag: ' + v.find((x, i) => v.indexOf(x) !== i));
  }
});

// ---- Strategie „ohne Nutzerdaten, ohne Nachrichten“ ----
const { pathToFileURL } = require('node:url');
const esm = p => import(pathToFileURL(path.join(__dirname, '..', p)).href); // auch unter Windows

test('Feiertage: Ostern, Sachsen 2026, Buß- und Bettag, Brückentag', async () => {
  const { easter, holidays, bridgeDay, clockChanges, STATES } = await esm('src/js/lib/feiertage.js');
  assert.equal(easter(2026).toISOString().slice(0, 10), '2026-04-05');
  assert.equal(easter(2027).toISOString().slice(0, 10), '2027-03-28');
  const sn = holidays(2026, 'SN').map(h => h.date + ' ' + h.name);
  assert.ok(sn.includes('2026-11-18 Buß- und Bettag'));
  assert.ok(sn.includes('2026-10-31 Reformationstag'));
  assert.ok(!sn.some(x => x.includes('Fronleichnam')));
  assert.equal(holidays(2026, 'BY').filter(h => h.name === 'Fronleichnam')[0].date, '2026-06-04');
  assert.equal(holidays(2026, 'SN').length, 11);
  assert.equal(bridgeDay(holidays(2026, 'SN')[0]), '2026-01-02'); // Neujahr ist Donnerstag
  assert.deepEqual(clockChanges(2026).map(c => c.date), ['2026-03-29', '2026-10-25']);
  assert.equal(Object.keys(STATES).length, 16);
});

test('Himmel: Sonne in Dresden, Vollmond am 26.09.2026', async () => {
  const { sunTimes, moon, nextMeteor } = await esm('src/js/lib/astro.js');
  const t = Date.UTC(2026, 8, 26, 10);
  const s = sunTimes(t, 51.05, 13.74);
  const hmBerlin = x => new Date(x).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
  assert.ok(['06:57', '06:58', '06:59'].includes(hmBerlin(s.rise)), hmBerlin(s.rise));
  assert.ok(['18:55', '18:56', '18:57', '18:58'].includes(hmBerlin(s.set)), hmBerlin(s.set));
  assert.equal(moon(t).name, 'Vollmond');
  assert.equal(nextMeteor(t).name, 'Draconiden');
  assert.equal(sunTimes(Date.UTC(2026, 5, 21), 78, 15).rise, null); // Polartag
});

test('Tanken: nur offene mit Preis, günstigste zuerst', () => {
  const { mapStations } = require('../api/fuel');
  const r = mapStations(fx.fuel().stations);
  assert.deepEqual(r.map(s => s.price), [1.689, 1.749]);
  assert.equal(r[1].name, 'ARAL');
  assert.equal(r[1].street, 'Königsbrücker Straße 96');
});

test('Schulferien: deutscher Name, sortiert', () => {
  const { mapSchool } = require('../api/holidays');
  const r = mapSchool(fx.school());
  assert.deepEqual(r.map(s => s.name), ['Herbstferien', 'Weihnachtsferien']);
  assert.equal(mapSchool(null).length, 0);
});

test('Datenschutz: Koordinaten werden auf ~1 km gerundet', () => {
  const { coord } = require('../api/_lib/http');
  assert.equal(coord('51.050912', 90), 51.05);
  assert.equal(coord('abc', 90), null);
  assert.equal(coord('200', 180), null);
});

test('Betriebsart: Kalender und Schlagzeilen nur privat', async () => {
  const res = () => { const r = { headers: {}, setHeader(k, v) { r.headers[k] = v; }, status(c) { r.code = c; return r; }, json(o) { r.body = o; } }; return r; };
  delete process.env.DAILY_PRIVATE;
  for (const f of ['calendar', 'headlines']) {
    const r = res(); await require('../api/' + f)({ method: 'GET', query: {} }, r);
    assert.equal(r.code, 404, f + ' müsste öffentlich gesperrt sein');
  }
  const r = res(); require('../api/config')({}, r); assert.equal(r.body.private, false);
  process.env.DAILY_PRIVATE = '1';
  const r2 = res(); require('../api/config')({}, r2); assert.equal(r2.body.private, true);
  delete process.env.DAILY_PRIVATE;
});

test('Layouts: öffentlich ohne private Kacheln, immer 20 Plätze (fehlende bleiben frei)', async () => {
  const { LAYOUTS, CATALOG, byId, chooseLayout, SLOTS } = await esm('src/js/core/tiles.js');
  for (const [mode, ids] of Object.entries(LAYOUTS)) {
    assert.ok(ids.length <= SLOTS, mode);
    assert.equal(new Set(ids).size, ids.length, mode + ': doppelte Kachel');
    ids.forEach(id => assert.ok(byId[id], mode + ': unbekannt ' + id));
  }
  assert.ok(LAYOUTS.public.every(id => byId[id].scope === 'public'));
  assert.ok(!CATALOG.some(t => t.id === 'mail' || t.id === 'parcels'));
  const pub = chooseLayout(false, ['news', 'calendar', 'sky', 'sky', 'gibtsnicht'], true).map(t => t && t.id);
  assert.equal(pub.length, SLOTS);
  assert.equal(pub.filter(x => x === null).length, SLOTS - LAYOUTS.public.length);   // freie Plätze am Ende
  assert.ok(!pub.includes('alerts'));                                                // Warnungen stecken jetzt in der Wetterkachel
  assert.equal(pub[0], 'sky');
  assert.ok(!pub.includes('news') && !pub.includes('calendar'));
  assert.equal(chooseLayout(true, null, true).map(t => t.id)[1], 'calendar');
  // Standard: nur überarbeitete Kacheln, Rest freie Plätze; Vorschau zeigt alle
  const fertig = chooseLayout(false).map(t => t && t.id);
  assert.deepEqual(fertig.filter(Boolean), ['weather', 'links', 'tasks', 'usage']);
  assert.equal(fertig.length, SLOTS);
  assert.deepEqual(chooseLayout(true).filter(Boolean).map(t => t.id), ['weather', 'tasks', 'links', 'usage']);   // privat ebenso
  assert.ok(chooseLayout(false, null, true).filter(Boolean).length > 4);
});

test('Meine Seiten: nur http(s)-Adressen', async () => {
  const { cleanUrl } = await esm('src/js/lib/url.js');
  assert.equal(cleanUrl('spiegel.de'), 'https://spiegel.de/');
  assert.equal(cleanUrl('javascript:alert(1)'), null);
  assert.equal(cleanUrl('http://example.org/x'), 'http://example.org/x');
  assert.equal(cleanUrl(''), null);
});

test('Service Worker: alle Module im Offline-Speicher', () => {
  const sw = fs.readFileSync(path.join(__dirname, '../src/sw.js'), 'utf8');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const root = path.join(__dirname, '../src');
  walk(path.join(root, 'js')).forEach(f => {
    const url = '/' + path.relative(root, f).split(path.sep).join('/');
    assert.ok(sw.includes(`'${url}'`), 'fehlt im Service Worker: ' + url);
  });
});
