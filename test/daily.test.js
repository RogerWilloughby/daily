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

test('Tanken: nur offene mit Preis, günstigste zuerst', () => {
  const { mapStations } = require('../api/fuel');
  const r = mapStations(fx.fuel().stations);
  assert.deepEqual(r.map(s => s.price), [1.689, 1.749]);
  assert.equal(r[1].name, 'ARAL');
  assert.equal(r[1].street, 'Königsbrücker Straße 96');
});

test('Datenschutz: Koordinaten werden auf ~1 km gerundet', () => {
  const { coord } = require('../api/_lib/http');
  assert.equal(coord('51.050912', 90), 51.05);
  assert.equal(coord('abc', 90), null);
  assert.equal(coord('200', 180), null);
});

test('Betriebsart: Schlagzeilen nur privat', async () => {
  const res = () => { const r = { headers: {}, setHeader(k, v) { r.headers[k] = v; }, status(c) { r.code = c; return r; }, json(o) { r.body = o; } }; return r; };
  delete process.env.DAILY_PRIVATE;
  for (const f of ['headlines']) {
    const r = res(); await require('../api/' + f)({ method: 'GET', query: {} }, r);
    assert.equal(r.code, 404, f + ' müsste öffentlich gesperrt sein');
  }
  const r = res(); require('../api/config')({}, r); assert.equal(r.body.private, false);
  process.env.DAILY_PRIVATE = '1';
  const r2 = res(); require('../api/config')({}, r2); assert.equal(r2.body.private, true);
  delete process.env.DAILY_PRIVATE;
});

test('Layouts: öffentlich ohne private Kacheln, Standard 12 (fertige zuerst), Raster nach Kachelzahl', async () => {
  const { LAYOUTS, CATALOG, byId, chooseLayout, SLOTS, STANDARD_ANZAHL, raster } = await esm('src/js/core/tiles.js');
  for (const [mode, ids] of Object.entries(LAYOUTS)) {
    assert.ok(ids.length <= SLOTS, mode);
    assert.equal(new Set(ids).size, ids.length, mode + ': doppelte Kachel');
    ids.forEach(id => assert.ok(byId[id], mode + ': unbekannt ' + id));
  }
  assert.ok(LAYOUTS.public.every(id => byId[id].scope === 'public'));
  assert.ok(!CATALOG.some(t => t.id === 'mail' || t.id === 'parcels'));
  // eigene Belegung: genau diese Kacheln in dieser Reihenfolge (auch Vorschau), ohne Doppelte, Unbekannte und öffentlich private
  assert.deepEqual(chooseLayout(false, ['news', 'fuel', 'fuel', 'gibtsnicht', 'weather']).map(t => t.id), ['fuel', 'weather']);
  assert.deepEqual(chooseLayout(true, ['news', 'kalender']).map(t => t.id), ['news', 'kalender']);   // privat erlaubt
  assert.equal(chooseLayout(false, []).length, 0);                                    // leere eigene Belegung bleibt leer
  assert.equal(chooseLayout(true, LAYOUTS.private.concat(CATALOG.map(t => t.id))).length, Math.min(SLOTS, CATALOG.length));   // höchstens 20
  // Standard (keine eigene Belegung): 12 Kacheln, überarbeitete zuerst, dann Vorschau-Kacheln in Standardreihenfolge
  const pub = chooseLayout(false).map(t => t.id);
  assert.equal(pub.length, STANDARD_ANZAHL);
  assert.deepEqual(pub.slice(0, 5), ['weather', 'kalender', 'links', 'tasks', 'usage']);
  assert.deepEqual(pub.slice(5, 7), ['transit', 'sport']);
  assert.ok(!pub.includes('news') && !pub.includes('alerts'));
  const priv = chooseLayout(true).map(t => t.id);
  assert.deepEqual(priv.slice(0, 6), ['weather', 'kalender', 'tasks', 'links', 'usage', 'news']);
  // Raster: Rechner (quer, Wunschform 1,4) und Handy (hochkant, quadratisch)
  const r = (n, w, h, a, v) => { const x = raster(n, w, h, a, v); return `${x.cols}x${x.rows}`; };
  assert.deepEqual([1, 2, 4, 6, 9, 12, 20].map(n => r(n, 1344, 700)), ['1x1', '2x1', '2x2', '3x2', '3x3', '4x3', '5x4']);
  assert.deepEqual([2, 12].map(n => r(n, 1850, 900)), ['2x1', '4x3']);
  assert.deepEqual([2, 4, 12, 20].map(n => r(n, 358, 560, 7, 1)), ['1x2', '2x2', '3x4', '4x5']);
  assert.equal(r(0, 1344, 700), '1x1');
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
