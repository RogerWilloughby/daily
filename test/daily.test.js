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
