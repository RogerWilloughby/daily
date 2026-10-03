// DAILY – Prüfungen ohne Netz: Umwandlung der Dienstdaten und Vollständigkeit der Tagesinhalte.
// Aufruf: npm test   (nutzt node:test, keine weiteren Pakete)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fx = require('../tools/fixtures');

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

test('Tagesinhalte: 31 Tage ab 26.09.2026, alle Felder gefüllt', () => {
  const file = JSON.parse(fs.readFileSync(path.join(__dirname, '../services/daten/daily.json'), 'utf8'));
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

test('Datenschutz: Koordinaten werden auf ~1 km gerundet', () => {
  const { coord } = require('../api/_lib/http');
  assert.equal(coord('51.050912', 90), 51.05);
  assert.equal(coord('abc', 90), null);
  assert.equal(coord('200', 180), null);
});

test('Betriebsart: Schalter DAILY_PRIVATE in api/config', async () => {
  const res = () => { const r = { headers: {}, setHeader(k, v) { r.headers[k] = v; }, status(c) { r.code = c; return r; }, json(o) { r.body = o; } }; return r; };
  delete process.env.DAILY_PRIVATE;
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
  assert.deepEqual(chooseLayout(false, ['news', 'sport', 'sport', 'gibtsnicht', 'weather']).map(t => t.id), ['sport', 'weather']);
  // frühere Kacheln „Abfahrten“ (transit) und „Tanken“ (fuel) → „Verkehr“, nur einmal
  assert.deepEqual(chooseLayout(false, ['transit', 'weather', 'fuel']).map(t => t.id), ['verkehr', 'weather']);
  assert.deepEqual(chooseLayout(true, ['news', 'kalender']).map(t => t.id), ['news', 'kalender']);   // privat erlaubt
  assert.equal(chooseLayout(false, []).length, 0);                                    // leere eigene Belegung bleibt leer
  assert.equal(chooseLayout(true, LAYOUTS.private.concat(CATALOG.map(t => t.id))).length, Math.min(SLOTS, CATALOG.length));   // höchstens 20
  // Standard (keine eigene Belegung): 12 Kacheln, überarbeitete zuerst, dann Vorschau-Kacheln in Standardreihenfolge
  const pub = chooseLayout(false).map(t => t.id);
  assert.equal(pub.length, STANDARD_ANZAHL);
  assert.deepEqual(pub, ['weather', 'kalender', 'links', 'tasks', 'verkehr', 'sport', 'money', 'unterhaltung', 'alltag', 'wissen', 'tools', 'usage']);
  assert.deepEqual(chooseLayout(false, ['play', 'film', 'saving']).map(t => t.id), ['unterhaltung', 'money']);   // „Rätsel & Witz“ und „Film“ → Unterhaltung, „Sparen“ → Finanzen
  assert.deepEqual(chooseLayout(false, ['knowledge', 'travel', 'weather']).map(t => t.id), ['wissen', 'weather']);   // „Wissen“ und „Land des Tages“ → Wissen
  assert.ok(!CATALOG.some(t => t.id === 'knowledge' || t.id === 'travel'));
  assert.deepEqual(chooseLayout(false, ['food', 'health', 'tech', 'relation', 'money']).map(t => t.id), ['alltag', 'money']);   // Essen, Gesundheit, Tech, Beziehung → Alltag
  assert.ok(!CATALOG.some(t => ['food', 'health', 'tech', 'relation'].includes(t.id)));
  assert.ok(!CATALOG.some(t => t.id === 'transit' || t.id === 'fuel'));
  assert.ok(!pub.includes('news') && !pub.includes('alerts'));
  const priv = chooseLayout(true).map(t => t.id);
  assert.deepEqual(priv.slice(0, 12), ['weather', 'kalender', 'news', 'tasks', 'verkehr', 'sport', 'money', 'unterhaltung', 'alltag', 'wissen', 'links', 'tools']);
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

test('Tools: Verzeichnis, Kachel mit Links, Seiten ohne Google Fonts', async () => {
  const fs = require('fs');
  const { TOOLS } = await esm('src/js/tools/verzeichnis.js');
  assert.deepEqual(TOOLS.map(t => t.id), ['arbeitszeit', 'setzkasten']);
  for (const t of TOOLS) {
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', t.pfad), 'utf8');
    assert.match(html, /^<!doctype html>/i, t.id);
    assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/, t.id + ': kein Google Fonts');
    assert.match(html, /url\(\/fonts\/figtree-400\.woff2\)/, t.id + ': Schrift von DAILY');
    assert.ok(fs.readFileSync(path.join(__dirname, '..', 'src', 'sw.js'), 'utf8').includes(t.pfad), t.id + ' offline (sw.js)');
  }
  const { kachel } = await esm('src/js/tools/verzeichnis.js');
  {
    const k = kachel(TOOLS);   // Mini-Reiter: „Alle“ plus je Tool ein Reiter, kein Aufklappen
    assert.deepEqual(k.kleinReiter.map(r => r.id), ['alle', 'arbeitszeit', 'setzkasten']);
    assert.equal(k.tabs, undefined); assert.deepEqual(k.liste, []);
    assert.deepEqual(k.kleinReiter[0].liste.map(z => [z.d, z.href]), [['Arbeitszeit', '/tools/arbeitszeit.html'], ['Setzkasten', '/tools/setzkasten.html']]);
    assert.match(k.kleinReiter[2].unten, /^<a class="kt-knopf" href="\/tools\/setzkasten\.html" target="_blank" rel="noopener">Setzkasten öffnen ↗<\/a>/);
    assert.deepEqual(kachel([]).kleinReiter.map(r => [r.id, r.liste.length]), [['alle', 0]]);
    assert.match(kachel([]).kleinReiter[0].html, /Keine Tools ausgewählt/);
  }
});

test('Syntax: alle Browser-Module lassen sich parsen', () => {
  const fs = require('fs'), { spawnSync } = require('child_process');
  const dateien = [];
  const lauf = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => { const p = path.join(d, e.name); if (e.isDirectory()) lauf(p); else if (p.endsWith('.js')) dateien.push(p); });
  lauf(path.join(__dirname, '..', 'src', 'js'));
  for (const f of dateien) {
    const r = spawnSync(process.execPath, ['--experimental-default-type=module', '--check', f], { encoding: 'utf8' });
    assert.equal(r.status, 0, path.relative(process.cwd(), f) + ': ' + (r.stderr || '').split('\n').slice(0, 5).join(' '));
  }
});

// Trennung: Das allgemeine Kachelraster (core/board.js) und die allgemeinen Styles (app.css) enthalten nichts Wetter- oder
// Finanz-Spezifisches. Diagramme → ansichten/*.js, adapter/*diagramm.js, css/diagramm.css, css/wetter.css, css/finanzen.css.
test('Aufbau: board.js und app.css ohne Wetter-/Finanz-Teile, ohne Aufklappen, Ansichts-CSS eingebunden', () => {
  const lies = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  const board = lies('src/js/core/board.js').replace(/\/\/.*$/gm, '');
  for (const muster of [/\bwd-/, /\bzp-|\bt-zp\b|data-zp|zpHtml/, /\bfi-/, /\bwh-/, /\brk-|\brs[1-4]\b/, /miniDichte|miniKurs|zeile2/])
    assert.doesNotMatch(board, muster, 'board.js enthält ' + muster);
  const css = lies('src/app.css').replace(/\/\*[\s\S]*?\*\//g, '').replace(/var\(--wd-[\w-]+\)/g, '');
  for (const muster of [/\.wd-|--wd-/, /\.zp-|\.t-zp|\.mit-zp/, /\.fi-/, /\.wh-/, /\.rk-|--rs\d/])
    assert.doesNotMatch(css, muster, 'app.css enthält ' + muster);
  const html = lies('src/index.html'), sw = lies('src/sw.js');
  // Seit 0.45.0 nur Mini-Reiter: kein Aufklappen, kein Handy-Vollbild, keine alten Reiter/Zeilenlisten (Review M4 Schritt 3)
  for (const muster of [/activate|closeAll|fillContent|reiterVon|showSheet|data-mode|t\.rows|t\.tabs/])
    assert.doesNotMatch(board, muster, 'board.js enthält noch ' + muster);
  assert.ok(!html.includes('id="sheet"'), 'index.html enthält noch das Handy-Vollbild');
  for (const f of ['src/app.css', 'src/css/diagramm.css', 'src/css/wetter.css', 'src/css/finanzen.css'])
    assert.doesNotMatch(lies(f), /data-mode|\.sheet\b|\.reiterfeld|\.wd-gross/, f + ': Regeln fürs Aufklappen');
  for (const f of ['/js/core/mini-reiter.js', '/js/core/einstellungsfenster.js']) assert.ok(sw.includes(`'${f}'`), 'nicht im Service Worker: ' + f);
  for (const f of ['/css/diagramm.css', '/css/wetter.css', '/css/finanzen.css']) {
    assert.ok(fs.existsSync(path.join(__dirname, '../src', f)), 'fehlt: ' + f);
    assert.ok(html.includes(`href="${f}"`), 'nicht in index.html: ' + f);
    assert.ok(sw.includes(`'${f}'`), 'nicht im Service Worker: ' + f);
  }
});

// Oberfläche „Abreißblock“ (0.47.0, Phase 1b): Gruppen unter „Heute“, Untertabs je Bereich, Adresse #bereich/untertab/teil
test('Oberfläche: Heute in Gruppen, Untertabs je Bereich, Adresse, Gemerkt', async () => {
  const ti = await esm('src/js/adapter/tagesinhalt.js');
  const { tageInhalt } = { tageInhalt: require('../services/daten/daily.json').tage[0] };
  const env = { daten: { datum: '2026-09-27', heute: '2026-10-03', erster: '2026-09-26', wiederholt: false, inhalt: { ...tageInhalt, geschichte: null } } };
  // Gruppen: jede Art genau einmal (Spartipp jetzt unter Alltag), Film unter Kultur
  assert.deepEqual(ti.GRUPPEN.map(g => g.id), ['raetsel', 'lachen', 'wissen', 'kultur', 'alltag']);
  const arten = ti.GRUPPEN.flatMap(g => g.arten);
  assert.deepEqual([...arten].sort(), Object.keys(ti.ART).sort());
  assert.equal(ti.gruppeVon('film'), 'kultur'); assert.equal(ti.gruppeVon('spartipp'), 'alltag');
  const h = ti.heuteBereich(env, { favoriten: [{ art: 'witz', datum: '2026-09-27', kurz: 'x', text: 'x' }] });
  assert.deepEqual(h.kleinReiter.map(r => [r.id, (r.teile || []).map(t => t.id).join(',')]),
    [['raetsel', ''], ['lachen', ''], ['wissen', 'wort,land,geschichte'], ['kultur', ''], ['alltag', 'rezept,gesundheit,tech,beziehung,spartipp']]);
  assert.match(h.bereichKopf, /class="ab-tagzahl">27</); assert.match(h.bereichKopf, /Sonntag/); assert.match(h.bereichKopf, /September 2026/);
  assert.match(h.bereichKopf, /nachgeholt/); assert.match(h.bereichKopf, /data-ti="vor"(?! disabled)/);
  assert.match(h.kleinReiter[0].html, /data-ti="loesung"/);
  assert.doesNotMatch(h.kleinReiter[0].html, new RegExp(tageInhalt.raetsel.loesung.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));   // Lösung erst auf Knopfdruck
  assert.match(ti.heuteBereich(env, { loesung: true }).kleinReiter[0].html, /class="ab-loesung"/);
  assert.match(h.kleinReiter[1].html, /aria-pressed="true">★ Gemerkt/);                                // Witz dieses Tags ist gemerkt
  assert.match(h.kleinReiter[2].teile[2].html, /Wikipedia ist gerade nicht erreichbar/);
  const rez = h.kleinReiter[4].teile[0].html;
  assert.match(rez, /Seite 1 von 2: Zutaten/); assert.match(rez, /<ul class="ab-zutaten">/); assert.match(rez, /Zubereitung ›/);
  assert.match(ti.heuteBereich(env, { rezeptSeite: 2 }).kleinReiter[4].teile[0].html, /Seite 2 von 2: Zubereitung[\s\S]*‹ Zutaten/);
  assert.match(ti.datumsKopf({ datum: '2026-10-03', heute: '2026-10-03', erster: '2026-09-26' }), /KW 40[\s\S]*data-ti="vor" aria-label="Tag vor" title="Tag vor" disabled/);
  assert.deepEqual([ti.kw('2026-01-01'), ti.kw('2026-10-03'), ti.kw('2026-12-31')], [1, 40, 53]);
  assert.equal(ti.heuteBereich(null).state, 'error');
  const g = ti.gemerktReiter([{ art: 'witz', datum: '2026-09-27', kurz: 'A', text: 'A' }, { art: 'land', datum: '2026-10-01', kurz: 'B', text: 'B' }]);
  assert.deepEqual(g.liste.map(z => z.aktion), ['fav:land|2026-10-01', 'fav:witz|2026-09-27']);  // neueste zuerst
  // Untertabs je Bereich
  const o = await esm('src/js/core/oberflaeche.js');
  const T = { heute: h, weather: { kleinReiter: [{ id: 'jetzt', name: 'Jetzt' }, { id: 'mehr', name: 'Mehr' }] },
    kalender: { kleinReiter: [{ id: 'naechste', name: 'Nächste' }, { id: 'termine', name: 'Termine' }, { id: 'frei', name: 'Feiertage & Ferien' }] },
    links: { kleinReiter: [{ id: 'meine', name: 'Meine Seiten' }] }, gemerkt: g, tools: { kleinReiter: [{ id: 'alle', name: 'Alle Tools' }] } };
  assert.deepEqual(o.BEREICHE.map(b => b.id), ['heute', 'wetter', 'kalender', 'mehr']);
  assert.deepEqual(o.untertabsVon('kalender', T).map(r => r.name), ['Nächste', 'Feiertage']);       // ohne Termine, kurzer Name
  assert.deepEqual(o.untertabsVon('mehr', T).map(r => r.id), ['seiten', 'gemerkt', 'ueber']);         // öffentlich ohne Tools
  assert.deepEqual(o.untertabsVon('mehr', T, { privat: true }).map(r => r.id), ['seiten', 'gemerkt', 'tools', 'ueber']);
  assert.match(o.untertabsVon('mehr', T, { version: 'DAILY 0.47.0' })[2].html, /data-doc="quellen"[\s\S]*data-doc="impressum"[\s\S]*data-doc="datenschutz"[\s\S]*DAILY 0\.47\.0/);
  assert.deepEqual(o.untertabsVon('wetter', {}), []);
  // Adresse
  assert.deepEqual(o.adresseLesen(''), { bereich: 'heute', unter: null, teil: null });
  assert.deepEqual(o.adresseLesen('#wetter/radar'), { bereich: 'wetter', unter: 'radar', teil: null });
  assert.deepEqual(o.adresseLesen('#heute/wissen/land'), { bereich: 'heute', unter: 'wissen', teil: 'land' });
  assert.equal(o.adresseLesen('#quatsch/x').bereich, 'heute');
  // Gerüst: Oberfläche eingebunden, keine Kachel-Leiste und kein „Frag DAILY“ mehr in der Seite
  const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8'), sw = fs.readFileSync(path.join(__dirname, '../src/sw.js'), 'utf8');
  for (const id of ['ab-tabs', 'ab-blatt', 'ort-select', 'open-settings', 'status', 'set-bereiche']) assert.ok(html.includes(`id="${id}"`), 'fehlt in index.html: ' + id);
  for (const weg of ['id="grid"', 'id="ask"', 'id="answer"', 'id="k-aktiv"']) assert.ok(!html.includes(weg), 'noch in index.html: ' + weg);
  assert.ok(html.includes('href="/css/abreissblock.css"') && sw.includes("'/css/abreissblock.css'") && sw.includes("'/fonts/big-shoulders-900.woff2'"));
  const main = fs.readFileSync(path.join(__dirname, '../src/js/main.js'), 'utf8');
  for (const weg of ['core/board.js', 'core/ask.js', 'ui/kacheln.js', 'providers/news.js', 'providers/finanzen.js', 'providers/sport.js', 'providers/verkehr.js', 'providers/local.js'])
    assert.ok(!main.includes(weg), 'main.js lädt noch ' + weg);
});
