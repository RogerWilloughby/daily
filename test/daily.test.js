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
  // Als .mjs-Kopie prüfen: so gilt die Datei in jeder Node-Version als Modul (der Schalter --experimental-default-type fehlt ab Node 24)
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'daily-syntax-'));
  try {
    for (const f of dateien) {
      const kopie = path.join(tmp, 'pruef.mjs');
      fs.copyFileSync(f, kopie);
      const r = spawnSync(process.execPath, ['--check', kopie], { encoding: 'utf8' });
      assert.equal(r.status, 0, path.relative(process.cwd(), f) + ': ' + (r.stderr || '').split('\n').slice(0, 5).join(' '));
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

// Trennung: Die Oberfläche (core/oberflaeche.js) und die allgemeinen Styles (app.css) enthalten nichts Wetter-Spezifisches.
// Diagramme → ansichten/*.js, adapter/diagramm.js, css/diagramm.css, css/wetter.css. Seit 0.47.2 kein Kachelraster mehr.
test('Aufbau: Oberfläche und app.css ohne Wetter-Teile, ohne Kachelraster, Ansichts-CSS eingebunden', () => {
  const lies = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  const ob = lies('src/js/core/oberflaeche.js').replace(/\/\/.*$/gm, '');
  for (const muster of [/\bwd-/, /\bzp-|\bt-zp\b|data-zp|zpHtml/, /\bwh-/, /\brk-|\brs[1-4]\b/, /miniDichte|zeile2/])
    assert.doesNotMatch(ob, muster, 'oberflaeche.js enthält ' + muster);
  const css = lies('src/app.css').replace(/\/\*[\s\S]*?\*\//g, '').replace(/var\(--wd-[\w-]+\)/g, '');
  for (const muster of [/\.wd-|--wd-/, /\.zp-|\.t-zp|\.mit-zp/, /\.wh-/, /\.rk-|--rs\d/])
    assert.doesNotMatch(css, muster, 'app.css enthält ' + muster);
  // kein Kachelraster, keine Leiste unten, kein Frag DAILY, keine Kachelauswahl (1b-2a)
  assert.doesNotMatch(css, /\.tile\b|\.grid\b|\.head\b|\.metric|\.teaser|\.bar\b|\.ask\b|\.answer|\.legal|\.k-liste|\.info-knopf|\.kr-leiste/, 'app.css: Regeln der alten Kacheln');
  const html = lies('src/index.html'), sw = lies('src/sw.js');
  for (const f of ['core/board.js', 'core/tiles.js', 'core/ask.js', 'core/einstellungsfenster.js', 'ui/kacheln.js', 'providers/news.js', 'providers/finanzen.js',
    'providers/sport.js', 'providers/verkehr.js', 'providers/local.js', 'providers/thema.js', 'adapter/finanzen.js', 'adapter/tanken.js', 'adapter/lokal.js'])
    assert.ok(!fs.existsSync(path.join(__dirname, '../src/js', f)), 'noch vorhanden: ' + f);
  for (const f of ['/css/abreissblock.css', '/css/diagramm.css', '/css/wetter.css', '/css/seiten.css']) {
    assert.ok(fs.existsSync(path.join(__dirname, '../src', f)), 'fehlt: ' + f);
    assert.ok(html.includes(`href="${f}"`), 'nicht in index.html: ' + f);
    assert.ok(sw.includes(`'${f}'`), 'nicht im Service Worker: ' + f);
  }
  // Service Worker: nichts, was es nicht mehr gibt
  for (const [, url] of sw.matchAll(/'(\/(?:js|css|tools|content)\/[^']+)'/g)) assert.ok(fs.existsSync(path.join(__dirname, '../src', url)), 'Service Worker nennt fehlende Datei: ' + url);
});

// Oberfläche „Abreißblock“ (0.47.0, Phase 1b): Gruppen unter „Heute“, Untertabs je Bereich, Adresse #bereich/untertab/teil
test('Oberfläche: drei Ebenen, Tagesinhalte in Heute · Entdecken · Mehr → Alltag, Adresse, Gemerkt', async () => {
  const ti = await esm('src/js/adapter/tagesinhalt.js');
  const { tageInhalt } = { tageInhalt: require('../services/daten/daily.json').tage[0] };
  const env = { daten: { datum: '2026-09-27', heute: '2026-10-03', erster: '2026-09-26', wiederholt: false, inhalt: { ...tageInhalt, geschichte: null } } };
  // jede Art steht genau einmal: Heute (Mitmachen), Entdecken, Mehr → Alltag (themen.md)
  const arten = [...ti.HEUTE_RUBRIKEN, ...ti.ENTDECKEN_RUBRIKEN].flatMap(g => g.arten).concat(ti.ALLTAG_ARTEN);
  assert.deepEqual([...arten].sort(), Object.keys(ti.ART).sort());
  assert.deepEqual(ti.HEUTE_RUBRIKEN.map(g => g.id), ['raetsel', 'quiz', 'lachen']);
  assert.deepEqual(ti.ENTDECKEN_RUBRIKEN.map(g => g.id), ['sprache', 'zeitreise', 'welt', 'kultur']);
  assert.deepEqual(ti.ortVon('film'), { bereich: 'entdecken', rubrik: 'kultur', thema: null });
  assert.deepEqual(ti.ortVon('sprichwort'), { bereich: 'entdecken', rubrik: 'sprache', thema: 'sprichwort' });
  assert.deepEqual(ti.ortVon('spartipp'), { bereich: 'mehr', rubrik: 'alltag', thema: 'spartipp' });
  assert.deepEqual(ti.ortVon('witz'), { bereich: 'heute', rubrik: 'lachen', thema: null });
  const fav = [{ art: 'witz', datum: '2026-09-27', kurz: 'x', text: 'x' }];
  const h = ti.heuteBereich(env, { favoriten: fav });
  assert.deepEqual(h.kleinReiter.map(r => r.id), ['raetsel', 'quiz', 'lachen']);
  assert.match(h.bereichKopf, /class="ab-tagzahl">27</); assert.match(h.bereichKopf, /Sonntag/); assert.match(h.bereichKopf, /September 2026/);
  assert.match(h.bereichKopf, /nachgeholt/); assert.match(h.bereichKopf, /data-ti="vor"(?! disabled)/);
  // Rätsel zum Mitmachen (0.51.0): vier Antworten je Tag fest gemischt, Tipps, Ergebnis mit Kästchen; ohne Antworten wie bisher „Lösung zeigen“
  const r = tageInhalt.raetsel, alle = [r.antwort, ...r.falsch];
  assert.deepEqual(ti.mischen(alle, '2026-09-27'), ti.mischen(alle, '2026-09-27'));                     // für alle gleich
  assert.deepEqual([...ti.mischen(alle, '2026-09-27')].sort(), [...alle].sort());
  assert.ok(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01'].some(d => ti.mischen(alle, d).join() !== ti.mischen(alle, '2026-09-27').join()));
  const rae = o => ti.heuteBereich(env, o).kleinReiter[0].html;
  const offen = rae({});
  assert.equal((offen.match(/data-ti="antwort"/g) || []).length, 4);
  assert.doesNotMatch(offen, /data-ti="loesung"|ab-ergebnis|ab-hinweis|data-ti="teilen"/);
  assert.match(offen, /data-ti="tipp">💡 Tipp</);
  const S = (x = {}) => ({ versuche: [], tipps: 0, geloest: false, nachgeholt: false, ...x });
  assert.match(rae({ spiel: S({ tipps: 1 }) }), new RegExp('class="ab-hinweis">💡 ' + r.tipps[0]));
  assert.match(rae({ spiel: S({ tipps: 1 }) }), /data-ti="tipp">💡 Noch ein Tipp</);
  assert.match(rae({ spiel: S({ tipps: 2 }) }), /data-ti="tipp" disabled>/);
  assert.match(rae({ spiel: S({ versuche: [r.falsch[0]] }) }), new RegExp(`class="ab-antwort ab-falsch" data-ti="antwort" data-antwort="${r.falsch[0]}" disabled`));
  const fertig = rae({ spiel: S({ versuche: [r.falsch[1], r.antwort], tipps: 1, geloest: true, nachgeholt: true }) });
  assert.match(fertig, new RegExp(`class="ab-antwort ab-richtig" data-ti="antwort" data-antwort="${r.antwort}" disabled`));
  assert.match(fertig, /class="ab-ergebnis">🟥🟩 Gelöst im 2\. Versuch · 💡 1 · nachgeholt</);
  assert.match(fertig, /data-ti="teilen">Teilen</);
  assert.doesNotMatch(fertig, /data-ti="tipp"|ab-hinweis/);
  assert.equal((fertig.match(/disabled/g) || []).length, 4);                                          // nach dem Lösen alles gesperrt
  assert.match(rae({ spiel: S({ versuche: [r.antwort], geloest: true }) }), /🟩 Auf Anhieb gelöst!</);
  const alt = { daten: { ...env.daten, inhalt: { ...env.daten.inhalt, raetsel: { frage: r.frage, loesung: r.loesung } } } };   // ohne Antworten
  assert.match(ti.heuteBereich(alt, {}).kleinReiter[0].html, /data-ti="loesung"/);
  assert.doesNotMatch(ti.heuteBereich(alt, {}).kleinReiter[0].html, new RegExp(r.loesung.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));   // Lösung erst auf Knopfdruck
  assert.match(ti.heuteBereich(alt, { loesung: true }).kleinReiter[0].html, /class="ab-loesung"/);
  // Quiz zum Mitmachen (0.53.0): Frage 1 offen, nach der Antwort Erklärung und „Weiter ›“, nach 5 Fragen Ergebnis mit Teilen
  const q = tageInhalt.quiz, quiz = o => ti.heuteBereich(env, { spiele: { quiz: o } }).kleinReiter[1].html;
  const q0 = quiz(undefined);
  assert.match(q0, /Frage 1 von 5 · ⬜⬜⬜⬜⬜/);
  assert.equal((q0.match(/data-ti="quiz-antwort"(?! disabled)/g) || []).length, 4);
  assert.doesNotMatch(q0, /quiz-weiter|data-ti="teilen"|ab-erklaerung/);
  const q1 = quiz({ antworten: [q[0].falsch[0]], frage: 0 });
  assert.match(q1, new RegExp(`class="ab-text ab-erklaerung">Leider falsch\\. ${q[0].erklaerung.slice(0, 20)}`));
  assert.match(q1, /data-ti="quiz-weiter">Weiter ›</); assert.equal((q1.match(/disabled/g) || []).length, 4);
  assert.match(quiz({ antworten: [q[0].falsch[0]], frage: 1 }), /Frage 2 von 5 · 🟥⬜⬜⬜⬜/);
  const alleRichtig = q.map(f => f.antwort);
  assert.match(quiz({ antworten: alleRichtig, frage: 4 }), /data-ti="quiz-weiter">Ergebnis ›</);
  const erg = quiz({ antworten: [...alleRichtig.slice(0, 3), q[3].falsch[1], q[4].antwort], frage: 5, geloest: true, nachgeholt: true });
  assert.match(erg, /class="ab-ergebnis">🟩🟩🟩🟥🟩 4 von 5 richtig</); assert.match(erg, /Sehr gut! · nachgeholt/);
  assert.equal((erg.match(/<li /g) || []).length, 5); assert.match(erg, /data-ti="teilen">Teilen</); assert.doesNotMatch(erg, /quiz-antwort/);
  assert.notDeepEqual(ti.mischen([1, 2, 3, 4], '2026-09-27|0'), undefined);
  assert.match(ti.artInhalt('quiz', tageInhalt).kurz, /^5 Fragen, z\. B\. „/);
  assert.deepEqual(ti.ortVon('quiz'), { bereich: 'heute', rubrik: 'quiz', thema: null });
  // Teilen und Spielstand
  const t = await esm('src/js/core/teilen.js');
  assert.equal(t.kaestchen(['a', 'b', 'c'], 'c'), '🟥🟥🟩');
  assert.equal(t.teilenText({ tag: 'Sa 3.10.', format: 'Rätsel', ergebnis: '🟥🟩', tipps: 1, adresse: 'https://daily.example/' }), 'DAILY Sa 3.10. · Rätsel 🟥🟩 · 💡1\nhttps://daily.example/');
  assert.equal(t.teilenText({ tag: 'Sa 3.10.', format: 'Rätsel', ergebnis: '🟩', adresse: 'x' }), 'DAILY Sa 3.10. · Rätsel 🟩\nx');
  const sp = await esm('src/js/core/spielstand.js');
  for (const kaputt of [null, '', '{', '{"v":0,"tage":{}}', '[]']) assert.deepEqual(sp.spielstandLesen(kaputt), { v: 1, tage: {} }, String(kaputt));
  sp._setzeStand({ v: 1, tage: { '2026-09-27': { raetsel: { versuche: ['x'], tipps: 0, geloest: false } }, '2026-09-28': { raetsel: { versuche: ['y'], geloest: true } } } });
  assert.deepEqual(sp.geloesteTage(), ['2026-09-28']);
  assert.deepEqual(sp.spiel('2026-09-30', 'raetsel'), { versuche: [], tipps: 0, geloest: false, nachgeholt: false });
  assert.match(h.kleinReiter[2].html, /aria-pressed="true">★ Gemerkt/);                                // Witz dieses Tags ist gemerkt
  // Entdecken: Sprache mit Themen Wort · Sprichwort, sonst eine Art je Rubrik; „vom …“ nur für Inhalte eines anderen Tags
  const e = ti.entdeckenBereich(env, {});
  assert.deepEqual(e.kleinReiter.map(r => [r.id, (r.teile || []).map(t => t.id).join(',')]), [['sprache', 'wort,sprichwort'], ['zeitreise', ''], ['welt', ''], ['kultur', '']]);
  assert.match(e.kleinReiter[0].teile[1].html, /Sprichwort des Tages/);
  assert.doesNotMatch(e.kleinReiter[0].teile[0].html, /Sprichwort/);                                    // Wort und Sprichwort getrennt
  assert.match(e.kleinReiter[1].html, /Wikipedia ist gerade nicht erreichbar/);
  assert.doesNotMatch(e.kleinReiter[2].html, /ab-vom/);
  assert.match(ti.entdeckenBereich(env, { vom: true }).kleinReiter[2].html, /class="ab-meta ab-vom">vom So 27\.9\. · <button type="button" class="ab-link" data-ti="heute">zu heute/);
  // Mehr → Alltag: Themen, Rezept in zwei Seiten
  const al = ti.alltagRubrik(env, {});
  assert.deepEqual(al.teile.map(t => t.id), ['rezept', 'gesundheit', 'tech', 'beziehung', 'spartipp']);
  assert.match(al.teile[0].html, /Seite 1 von 2: Zutaten/); assert.match(al.teile[0].html, /<ul class="ab-zutaten">/); assert.match(al.teile[0].html, /Zubereitung ›/);
  assert.match(ti.alltagRubrik(env, { rezeptSeite: 2 }).teile[0].html, /Seite 2 von 2: Zubereitung[\s\S]*‹ Zutaten/);
  assert.match(ti.datumsKopf({ datum: '2026-10-03', heute: '2026-10-03', erster: '2026-09-26' }), /KW 40[\s\S]*data-ti="vor" aria-label="Tag vor" title="Tag vor" disabled/);
  assert.deepEqual([ti.kw('2026-01-01'), ti.kw('2026-10-03'), ti.kw('2026-12-31')], [1, 40, 53]);
  assert.equal(ti.heuteBereich(null).state, 'error');
  const g = ti.gemerktReiter([{ art: 'witz', datum: '2026-09-27', kurz: 'A', text: 'A' }, { art: 'land', datum: '2026-10-01', kurz: 'B', text: 'B' }]);
  assert.deepEqual(g.liste.map(z => z.aktion), ['fav:land|2026-10-01', 'fav:witz|2026-09-27']);  // neueste zuerst
  // Rubriken je Bereich
  const o = await esm('src/js/core/oberflaeche.js');
  const T = { heute: h, entdecken: e, weather: { kleinReiter: [{ id: 'jetzt', name: 'Jetzt' }, { id: 'mehr', name: 'Details' }] }, himmel: { kleinReiter: [{ id: 'himmel', name: 'Himmel' }] },
    kalender: { kleinReiter: [{ id: 'naechste', name: 'Nächste' }, { id: 'termine', name: 'Termine' }, { id: 'feiertage', name: 'Feiertage' }, { id: 'ferien', name: 'Ferien' }, { id: 'himmel', name: 'Himmel' }, { id: 'namen', name: 'Namenstage' }] },
    alltag: al, links: { kleinReiter: [{ id: 'meine', name: 'Meine Seiten' }, { id: 'news', name: 'News' }] }, gemerkt: g, tools: { kleinReiter: [{ id: 'alle', name: 'Alle Tools' }] } };
  assert.deepEqual(o.BEREICHE.map(b => b.id), ['heute', 'entdecken', 'wetter', 'kalender', 'mehr']);   // Album ab Phase 3
  assert.ok(o.BEREICHE.length <= 6);
  assert.deepEqual(o.untertabsVon('wetter', T).map(r => r.id), ['jetzt', 'mehr', 'himmel']);        // Himmel unter Wetter
  assert.deepEqual(o.untertabsVon('kalender', T).map(r => r.name), ['Nächste', 'Feiertage', 'Ferien', 'Namenstage']);   // ohne Termine und Himmel
  assert.deepEqual(o.untertabsVon('mehr', T).map(r => r.id), ['alltag', 'seiten', 'gemerkt', 'ueber']);         // öffentlich ohne Tools
  assert.deepEqual(o.untertabsVon('mehr', T, { privat: true }).map(r => r.id), ['alltag', 'seiten', 'gemerkt', 'tools', 'ueber']);
  assert.deepEqual(o.untertabsVon('mehr', T)[1].teile.map(t => t.name), ['Meine', 'News']);           // kurze Namen für die Themen-Zeile
  assert.match(o.untertabsVon('mehr', T, { version: 'DAILY 0.49.0' }).at(-1).html, /data-doc="quellen"[\s\S]*data-doc="impressum"[\s\S]*data-doc="datenschutz"[\s\S]*DAILY 0\.49\.0/);
  assert.deepEqual(o.untertabsVon('wetter', {}), []);
  for (const b of o.BEREICHE) assert.ok(o.untertabsVon(b.id, T, { privat: true }).length <= 6, 'mehr als 6 Rubriken: ' + b.id);
  // Adresse
  assert.deepEqual(o.adresseLesen(''), { bereich: 'heute', unter: null, teil: null });
  assert.deepEqual(o.adresseLesen('#wetter/radar'), { bereich: 'wetter', unter: 'radar', teil: null });
  assert.deepEqual(o.adresseLesen('#entdecken/sprache/sprichwort'), { bereich: 'entdecken', unter: 'sprache', teil: 'sprichwort' });
  assert.equal(o.adresseLesen('#quatsch/x').bereich, 'heute');
  // Gerüst: Oberfläche eingebunden, keine Kachel-Leiste und kein „Frag DAILY“ mehr in der Seite
  const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8'), sw = fs.readFileSync(path.join(__dirname, '../src/sw.js'), 'utf8');
  for (const id of ['ab-tabs', 'ab-blatt', 'ort-select', 'open-settings', 'status', 'set-bereiche']) assert.ok(html.includes(`id="${id}"`), 'fehlt in index.html: ' + id);
  for (const weg of ['id="grid"', 'id="ask"', 'id="answer"', 'id="k-aktiv"']) assert.ok(!html.includes(weg), 'noch in index.html: ' + weg);
  assert.ok(html.includes('href="/css/abreissblock.css"') && sw.includes("'/css/abreissblock.css'") && sw.includes("'/fonts/big-shoulders-900.woff2'"));
});

// 1b-2b (0.47.3): alte Daten der Kachel-Oberfläche einmal aus dem Browser räumen; Rechtstexte nennen nur genutzte Dienste
test('Aufräumen: alte Browser-Daten einmal entfernen, Rechtstexte nur mit genutzten Diensten', async () => {
  const { aufraeumen, AUFGERAEUMT } = await esm('src/js/core/store.js');
  const speicher = start => { const m = new Map(Object.entries(start)); return { m, getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), keys: () => [...m.keys()] }; };
  const alt = { place: { name: 'Leipzig', lat: 51.34, lon: 12.37 }, orte: [{ name: 'Leipzig' }], kennwort: 'k', icsUrls: ['https://x.test/a.ics'], stop: 'Postplatz', team: 'Dynamo Dresden', fuel: 'e10', layout: ['weather'],
    kacheln: { weather: { mini: 7, reiter: 'radar', unwetterGesehen: 'X|' }, kalender: { namen: false }, links: { kategorien: ['news'] }, verkehr: { start: 'A' }, money: { haupt: 'CHF' }, sport: { liga: 'bl2' } } };
  const sp = speicher({ 'daily-settings': JSON.stringify(alt), 'daily-tasks': '[]', 'daily-clicks': '{}', 'daily-favoriten': '[1]', 'daily-links': '[2]',
    'daily-dienst:/api/v1/wetter?lat=51.34&lon=12.37': '{}', 'daily-dienst:/api/v1/kurse': '{}', 'daily-dienst:/api/v1/tanken?lat=1&lon=2': '{}', 'fremd': 'x' });
  assert.equal(aufraeumen(sp), true);
  assert.deepEqual(sp.keys().sort(), ['daily-dienst:/api/v1/wetter?lat=51.34&lon=12.37', 'daily-favoriten', 'daily-links', 'daily-settings', 'fremd']);
  const s = JSON.parse(sp.getItem('daily-settings'));
  assert.deepEqual(Object.keys(s).sort(), ['aufgeraeumt', 'kacheln', 'kennwort', 'orte', 'place']);   // Ort(e), Kennwort bleiben; Haltestelle, Verein, iCal-Links … weg
  assert.deepEqual(s.kacheln, { weather: { mini: 7, unwetterGesehen: 'X|' }, kalender: { namen: false }, links: { kategorien: ['news'] } });
  assert.equal(s.aufgeraeumt, AUFGERAEUMT);
  sp.setItem('daily-tasks', '[]');
  assert.equal(aufraeumen(sp), false);                                            // nur einmal
  assert.ok(sp.keys().includes('daily-tasks'));
  const leer = speicher({});
  assert.equal(aufraeumen(leer), true);                                           // neuer Besucher: nur der Merker
  assert.deepEqual(JSON.parse(leer.getItem('daily-settings')), { kacheln: {}, aufgeraeumt: AUFGERAEUMT });
  // Datenschutz und Impressum: keine Dienste, die nur noch auf dem Server laufen
  const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8');
  for (const weg of [/Tank/, /Fußball|OpenLigaDB/, /Abfahrt|VVO/, /Autobahn/, /Wechselkurs|EZB|Leitzins/, /Börse|Yahoo/, /Haltestelle|Kraftstoff|Klickzähler|Aufgaben|Arbeitsweg/])
    assert.doesNotMatch(html, weg, 'index.html nennt noch ' + weg);
  for (const da of [/Open-Meteo/, /Bright Sky/, /GeoNames/, /OpenHolidays/, /Astronomy Engine/, /Wikipedia/, /gemerkt/]) assert.match(html, da);
});

// 1c (0.48.0): nur Sichtbares laden; Programmdateien je Version aus dem Speicher des Service Workers
test('Laden: nur der sichtbare Bereich (und Wetterhinweise), Service Worker speichert je Version', async () => {
  const { faelligeAnbieter } = await esm('src/js/core/oberflaeche.js');
  const A = [{ id: 'heute', bereich: 'heute', every: 100 }, { id: 'wetterhinweise', bereich: 'immer', every: 50 }, { id: 'weather', bereich: 'wetter', every: 100 },
    { id: 'kalender', bereich: 'kalender', every: 100 }, { id: 'links', bereich: 'mehr', every: 100 }];
  const ids = (b, lr, t = 1000, max) => faelligeAnbieter(A, b, new Map(Object.entries(lr)), t, max).map(p => p.id);
  assert.deepEqual(ids('heute', {}), ['heute', 'wetterhinweise']);                                      // Öffnen mit „Heute“: kein Wetter, kein Kalender
  assert.deepEqual(ids('wetter', { heute: 990, wetterhinweise: 990 }), ['weather']);                    // erstes Antippen von „Wetter“
  assert.deepEqual(ids('wetter', { heute: 990, wetterhinweise: 900, weather: 950 }), ['wetterhinweise']);   // Wetter noch frisch
  assert.deepEqual(ids('heute', { heute: 850, wetterhinweise: 990, weather: 0 }), ['heute']);            // veraltetes Wetter lädt erst, wenn sichtbar
  assert.deepEqual(ids('heute', { heute: 960 }, 1000, () => 10), ['heute', 'wetterhinweise']);          // kürzere Grenze (Rückkehr in den Browser-Tab)
  // jeder Anbieter gehört zu einem Bereich
  const lies = p => fs.readFileSync(path.join(__dirname, '../src/js', p), 'utf8');
  for (const [p, b] of [['providers/heute.js', "\\['heute', 'entdecken', 'mehr'\\]"], ['providers/weather.js', "'wetter'"], ['providers/kalender.js', "'kalender'"], ['providers/links.js', "'mehr'"], ['providers/tools.js', "'mehr'"]])
    assert.match(lies(p), new RegExp(`export default \\{[^}]*bereich: ${b}`), p);
  assert.match(lies('providers/kalender.js'), /himmelAnbieter = \{ id: 'himmel', name: 'Himmel', bereich: 'wetter'/);   // Wetter → Himmel braucht nur den Dienst „himmel“
  assert.deepEqual(faelligeAnbieter([{ id: 'h', bereich: ['heute', 'mehr'], every: 9 }], 'mehr', new Map(), 100).map(p => p.id), ['h']);   // Liste von Bereichen
  assert.match(lies('providers/weather.js'), /hinweiseAnbieter = \{ id: 'wetterhinweise', name: 'Wetterhinweise', bereich: 'immer'/);
  const main = lies('main.js');
  assert.doesNotMatch(main, /PROVIDERS\.forEach\(run\)/, 'main.js startet noch alle Anbieter');
  assert.match(main, /document\.readyState === 'complete'\) anmelden\(\)/);   // auch anmelden, wenn „load“ schon vorbei ist
  assert.match(main, /controllerchange/);                                                              // nach neuer Version einmal neu laden
  // Service Worker: Speicher zuerst, /api nie, Startseite unter „/“, Tools behalten ihre Adresse, alter Speicher wird geräumt
  const sw = fs.readFileSync(path.join(__dirname, '../src/sw.js'), 'utf8');
  assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)\) return/);
  assert.match(sw, /c\.match\(schluessel\)\.then\(hit => hit \|\| fetch/);
  assert.match(sw, /url\.pathname === '\/' \|\| url\.pathname === '\/index\.html'/);
  assert.match(sw, /cache: 'reload'/);
  assert.match(sw, /keys\.filter\(k => k !== CACHE\)\.map\(k => caches\.delete\(k\)\)/);
  assert.match(fs.readFileSync(path.join(__dirname, '../build.js'), 'utf8'), /const CACHE = 'daily-\$\{version\}-\$\{commit \|\| Date\.now\(\)\}'/);   // neue Version → neuer Speicher
});
