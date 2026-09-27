// DAILY – Prüfungen der Dienst-Schicht (Austauschformat daily/1), ohne Netz.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fx = require('../tools/fixtures');
const { pruefe, RAHMEN } = require('../services/_lib/schema');
const { antwort, fehlerAntwort, DienstFehler } = require('../services/_lib/rahmen');
const dienste = require('../services');
const router = require('../api/v1/[dienst].js');

const esm = p => import(pathToFileURL(path.join(__dirname, '..', p)).href);
const echtesFetch = global.fetch;
test.before(() => { global.fetch = require('../tools/fetch-stub'); });
test.after(() => { global.fetch = echtesFetch; });

// Router wie bei Vercel aufrufen
async function rufe(dienst, query = {}, method = 'GET') {
  const r = { headers: {}, setHeader(k, v) { r.headers[k.toLowerCase()] = v; }, status(c) { r.code = c; return r; }, json(o) { r.body = o; } };
  await router({ method, query: { dienst, ...query } }, r);
  return r;
}
const gueltig = (env, datenSchema) => {
  assert.deepEqual(pruefe(env, RAHMEN), [], 'Rahmen ungültig');
  if (datenSchema) assert.deepEqual(pruefe(env.daten, datenSchema), [], 'Daten ungültig');
};

test('Schema-Prüfer erkennt Typ-, Format-, Pflicht- und Bereichsfehler', () => {
  const s = { type: 'object', required: ['a', 'z'], properties: { a: { type: 'integer', minimum: 0 }, z: { type: 'string', format: 'zeit' }, e: { enum: ['x'] } } };
  assert.deepEqual(pruefe({ a: 1, z: '2026-09-27T08:00:00Z' }, s), []);
  const f = pruefe({ a: -1.5, z: '2026-09-27 08:00', e: 'y' }, s);
  assert.equal(f.length, 3, f.join('\n'));
  assert.equal(pruefe({}, s).length, 2);
});

test('Rahmen daily/1: Erfolg und Fehler haben dieselbe Form', () => {
  const d = { id: 'probe', version: 3, ttl: 60, quellen: [{ name: 'X' }] };
  const ok = antwort(d, { daten: { a: 1 }, jetzt: Date.UTC(2026, 8, 27, 8) });
  gueltig(ok);
  assert.equal(ok.gueltigBis, '2026-09-27T08:01:00Z');
  assert.equal(ok.fehler, null);
  const bad = fehlerAntwort('probe', new DienstFehler('eingabe_fehlt', 'fehlt'));
  gueltig(bad);
  assert.equal(bad.daten, null);
  assert.equal(bad.fehler.code, 'eingabe_fehlt');
});

test('Wetter: Umwandlung erfüllt den Vertrag, auch ohne Luftdaten', () => {
  const w = dienste.byId.wetter;
  const r = w.umwandeln(fx.forecast(), fx.airQuality());
  assert.deepEqual(pruefe(r.daten, w.schema), []);
  assert.equal(r.daten.stunden.length, 48);
  assert.equal(r.daten.tage.length, 16);
  assert.deepEqual(r.daten.tage.map(t => t.trend), [...Array(7).fill(false), ...Array(9).fill(true)]);   // ab Tag 8 Trend
  const a = r.daten.aktuell;
  assert.deepEqual([a.windRichtung, a.windRichtungGrad, a.wolkenProzent, a.luftdruckHpa, a.druckTendenz, a.sichtweiteM, a.taupunktC, a.schneehoeheCm],
    ['W', 250, 45, 1016.2, 'fallend', 24000, 10.1, 0]);
  const t8 = r.daten.tage[7];                                 // Tag 8: Frost, Schnee, Glätte, Nordwind
  assert.deepEqual([t8.frost, t8.glaette, t8.neuschneeCm, t8.windRichtung, t8.sonnenstunden], [true, true, 3.5, 'N', 1]);
  assert.deepEqual([r.daten.tage[0].frost, r.daten.tage[0].glaette, r.daten.tage[0].sonnenstunden, r.daten.tage[0].boeenMaxKmh], [false, false, 4, 38]);
  assert.ok(r.daten.tage[0].nullgradgrenzeM > 2000);
  assert.ok('uvIndex' in r.daten.stunden[0] && 'windRichtungGrad' in r.daten.stunden[0]);
  assert.equal(r.daten.aktuell.zustand, 'teilweise_bewoelkt');
  assert.equal(r.daten.luft.stufe, 'ausreichend');
  const heute = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
  assert.equal(r.daten.tage[0].datum, heute);
  const ohne = w.umwandeln(fx.forecast(), null);
  assert.equal(ohne.daten.luft, null);
  assert.deepEqual(pruefe(ohne.daten, w.schema), []);
});

test('Router: /api/v1/wetter?ort=Berlin liefert daily/1 mit gerundetem Ort', async () => {
  const r = await rufe('wetter', { ort: 'Berlin' });
  assert.equal(r.code, 200);
  gueltig(r.body, dienste.byId.wetter.schema);
  const o = r.body.ort;
  assert.deepEqual([o.name, o.region, o.land, o.kreis, o.kreisSchluessel, o.typ, o.zeitzone], ['Berlin', 'Berlin', 'DE', 'Berlin', '11000', 'ort', 'Europe/Berlin']);
  assert.ok(Math.abs(o.lat - 52.5) < 0.1 && Math.abs(o.lon - 13.4) < 0.1, `${o.lat},${o.lon}`);
  assert.equal(o.lat, Math.round(o.lat * 100) / 100);
  // Takt: gültig bis zur nächsten vollen oder halben Stunde, CDN-Cache genau so lange
  const bis = new Date(r.body.gueltigBis);
  assert.ok([0, 30].includes(bis.getUTCMinutes()) && bis.getUTCSeconds() === 0, r.body.gueltigBis);
  const s = +/s-maxage=(\d+)/.exec(r.headers['cache-control'])[1];
  assert.ok(s >= 60 && s <= 1800 && Math.abs(s - Math.max(60, (bis - Date.now()) / 1000)) < 5, r.headers["cache-control"]);
  assert.equal(r.headers['access-control-allow-origin'], '*');
});

test('Router: Koordinaten statt Name, Zeitzone aus der Quelle', async () => {
  const r = await rufe('wetter', { lat: '51.050912', lon: '13.738', name: 'Dresden', region: 'Sachsen', land: 'DE' });
  assert.equal(r.code, 200);
  assert.equal(r.body.ort.lat, 51.05);
  assert.equal(r.body.ort.zeitzone, 'Europe/Berlin');
});

test('Router: Fehler kommen im Rahmen mit passendem Status', async () => {
  const fehlt = await rufe('wetter');
  assert.equal(fehlt.code, 400); assert.equal(fehlt.body.fehler.code, 'eingabe_fehlt'); gueltig(fehlt.body);
  const kaputt = await rufe('wetter', { lat: 'x', lon: '13' });
  assert.equal(kaputt.code, 400); assert.equal(kaputt.body.fehler.code, 'eingabe_ungueltig');
  const unbekannt = await rufe('gibtsnicht');
  assert.equal(unbekannt.code, 404); assert.equal(unbekannt.body.fehler.code, 'dienst_unbekannt');
  const nirgends = await rufe('wetter', { ort: 'Atlantis' });
  assert.equal(nirgends.code, 404); assert.equal(nirgends.body.fehler.code, 'ort_nicht_gefunden');
  const post = await rufe('wetter', { ort: 'Berlin' }, 'POST');
  assert.equal(post.code, 405);
});

const namen = env => env.daten.orte.map(x => x.name);

test('Ortsbestand: Aufbau, keine Großkunden, echte Orte mit Firmen-ähnlichen Namen bleiben', () => {
  const orte = require('../services/_lib/orte');
  const d = orte.daten();
  assert.equal(d.format, 'daily-orte/1');
  assert.ok(d.orte.length > 10000 && Object.keys(d.kreise).length >= 400, `${d.orte.length} Orte`);
  const alle = new Set(d.orte.map(o => o[0]));
  for (const firma of ['BMW Welt', 'AOK', 'Bundeskriminalamt', 'Hauptzollamt', 'Otto Versand']) assert.ok(!alle.has(firma), firma);
  for (const ort of ['Maikammer', 'Hohenkammer', 'Freiamt', 'Welle', 'Stadt Wehlen', 'Neunkirchen', 'Born a. Darß', 'Wakendorf II']) assert.ok(alle.has(ort), ort);
  const { istFirma } = require('../tools/orte-daten');
  assert.ok(istFirma('Staatsanwaltschaft Berlin') && istFirma('Becker u. Kries') && !istFirma('Aicha vorm Wald'));
});

test('Standort: Name – eigener Bestand, ganzes Wort vor Wortanfang, Orte vor Stadtteilen', async () => {
  const o = await rufe('ort', { q: 'Neustadt' });
  assert.equal(o.code, 200);
  gueltig(o.body, dienste.byId.ort.schema);
  const orte = o.body.daten.orte;
  assert.equal(orte.length, 6);
  assert.ok(orte.every(x => x.land === 'DE' && x.typ === 'ort' && /\bNeustadt\b/.test(x.name)), namen(o.body).join());
  assert.deepEqual(o.body.quellen.map(q => q.name), ['GeoNames Postal Codes (eigener Ortsbestand)']);
  const dd = (await rufe('ort', { q: 'dresden' })).body.daten.orte;
  assert.equal(dd[0].name, 'Dresden');
  assert.equal(dd[0].kreisSchluessel, '14612');
  assert.ok(dd.slice(1).every(x => x.typ === 'stadtteil'));
});

test('Standort: Suche wie eine Suchmaschine – Zusätze, Kürzel, Umlaute, Tippfehler', async () => {
  const erster = async q => ((await rufe('ort', { q })).body.daten.orte[0] || {}).name;
  for (const q of ['Neustadt in Sachsen', 'Neustadt Sachsen', 'neustadt sachsen', 'Neustadt i. Sa.', 'Neustadt/Sa.', 'Neustadt 01844', 'Neustadt Osterzgebirge'])
    assert.equal(await erster(q), 'Neustadt in Sachsen', q);
  assert.equal(await erster('Neustadt Pfalz'), 'Neustadt an der Weinstraße');
  assert.equal(await erster('Neustadt Aisch'), 'Neustadt an der Aisch');
  assert.equal(await erster('Frankfurt Oder'), 'Frankfurt (Oder)');
  assert.equal(await erster('Freiburg Breisgau'), 'Freiburg im Breisgau');
  assert.equal(await erster('Weiden Oberpfalz'), 'Weiden');
  assert.equal(await erster('Garmisch Partenkirchen'), 'Garmisch-Partenkirchen');
  assert.equal(await erster('St. Wendel'), 'Sankt Wendel');
  for (const q of ['München', 'Muenchen', 'Munchen', 'Munich']) assert.equal(await erster(q), 'München', q);
  for (const q of ['Halle', 'Halle Saale', 'Halle (Saale)']) assert.equal((await rufe('ort', { q })).body.daten.orte[0].kreisSchluessel, '15002', q);
  assert.equal((await rufe('ort', { q: 'Halle Westf' })).body.daten.orte[0].kreisSchluessel, '05754');
  assert.equal(await erster('Freiburg'), 'Freiburg im Breisgau');
  for (const q of ['Hamburg', 'Kiel']) {                      // doppelt im Bestand, aber nur einmal in der Liste
    const n = (await rufe('ort', { q })).body.daten.orte.filter(x => x.name === q).length;
    assert.equal(n, 1, q);
  }
  for (const q of ['Dresdn', 'Drseden', 'Dresdne']) assert.equal(await erster(q), 'Dresden', q);  // Tippfehler
  const nurSa = (await rufe('ort', { q: 'Neustadt Sachsen' })).body.daten.orte;
  assert.ok(nurSa.every(x => x.region === 'Sachsen'), nurSa.map(x => x.name + '/' + x.region).join());  // nicht Sachsen-Anhalt
  assert.deepEqual((await rufe('ort', { q: 'Sachsen' })).body.daten.orte.filter(x => !/Sachsen/.test(x.name)), []); // Bundesland allein reicht nicht
});

test('Standort: Ausland nur, wenn kein deutscher Ort so heißt', async () => {
  const o = await rufe('ort', { q: 'Wien' });
  gueltig(o.body, dienste.byId.ort.schema);
  assert.deepEqual(o.body.daten.orte.slice(0, 2).map(x => [x.name, x.land]), [['Wien', 'AT'], ['Wien', 'US']]);
  assert.equal(o.body.daten.orte[2].land, 'DE');          // danach „Wiendorf“ …
  assert.ok(o.body.daten.orte.every(x => !(x.land === 'DE' && x.name === 'Wien'))); // deutscher Treffer der Quelle entfällt
  assert.deepEqual(o.body.hinweise, ['ausland']);
  assert.equal(o.body.quellen.length, 2);
  const rom = (await rufe('ort', { q: 'Rom' })).body;        // „Rom“ gibt es auch in Mecklenburg (klein) – Rom in Italien zuerst
  assert.deepEqual(rom.daten.orte.slice(0, 2).map(x => [x.name, x.land]), [['Rom', 'IT'], ['Rom', 'DE']]);
  assert.deepEqual((await rufe('ort', { q: 'Neustadt Sachsen' })).body.hinweise, []);   // große deutsche Treffer: kein Auslandsabruf
  const nurDe = (await rufe('ort', { q: 'Wien', land: 'DE' })).body;   // Vorschläge beim Tippen: nur Deutschland
  assert.ok(nurDe.daten.orte.every(x => x.land === 'DE') && nurDe.daten.orte.length > 0);
  const leer = await rufe('ort', { q: 'Atlantis' });
  assert.equal(leer.code, 200); assert.deepEqual(leer.body.daten.orte, []);
});

test('Standort: Postleitzahl aus dem eigenen Bestand, auch als Ort-Eingabe anderer Dienste', async () => {
  const o = await rufe('ort', { q: '01844' });
  assert.equal(o.code, 200);
  gueltig(o.body, dienste.byId.ort.schema);
  const ns = o.body.daten.orte.find(x => x.name === 'Neustadt in Sachsen');
  assert.ok(ns, namen(o.body).join());
  assert.deepEqual([ns.kreis, ns.kreisSchluessel, ns.region, ns.plz], ['Landkreis Sächsische Schweiz-Osterzgebirge', '14628', 'Sachsen', ['01844']]);
  assert.ok(Math.abs(ns.lat - 51.02) < 0.05 && Math.abs(ns.lon - 14.22) < 0.05);
  assert.equal((await rufe('ort', { q: '99999' })).body.daten.orte.length, 0);
  const w = await rufe('wetter', { ort: '01067' });
  assert.equal(w.code, 200); assert.equal(w.body.ort.name, 'Dresden');
});

test('Standort: Umkehrsuche aus Koordinaten – gerundet, Stadtteil → Ort, außerhalb leer', async () => {
  const o = await rufe('ort', { lat: '51.050409', lon: '13.737262' });
  assert.equal(o.code, 200);
  gueltig(o.body, dienste.byId.ort.schema);
  const d = o.body.daten.orte[0];
  assert.deepEqual([d.name, d.region, d.land, d.kreisSchluessel, d.typ, d.lat, d.lon, d.plz.length], ['Dresden', 'Sachsen', 'DE', '14612', 'ort', 51.05, 13.74, 1]);
  const hh = (await rufe('ort', { lat: '53.55', lon: '9.99' })).body.daten.orte[0];
  assert.equal(hh.name, 'Hamburg');                          // nicht „Hamburg Neustadt“
  const wien = await rufe('ort', { lat: '48.2', lon: '16.37' });
  assert.equal(wien.code, 200); assert.deepEqual(wien.body.daten.orte, []); assert.deepEqual(wien.body.hinweise, ['ausserhalb']);
  assert.equal((await rufe('ort', { q: 'x' })).body.fehler.code, 'eingabe_fehlt');
  assert.equal((await rufe('ort', { lat: '99', lon: '0' })).body.fehler.code, 'eingabe_ungueltig');
});

test('Katalog: jeder Dienst vollständig beschrieben, mit Ländern', async () => {
  const k = await rufe('dienste');
  gueltig(k.body);
  const ids = k.body.daten.dienste.map(d => d.id);
  assert.ok(ids.includes('wetter') && ids.includes('ort'));
  for (const d of k.body.daten.dienste) {
    for (const f of ['id', 'version', 'titel', 'beschreibung', 'eingaben', 'laender', 'klasse', 'ttl', 'quellen', 'schema']) assert.ok(d[f] != null, `${d.id}.${f} fehlt`);
  }
});

test('Adapter Wetter: Kachel und Antwort aus dem Vertrag', async () => {
  const { kachel, antwort: text } = await esm('src/js/adapter/wetter.js');
  const env = (await rufe('wetter', { ort: 'Berlin' })).body;
  const k = kachel(env);
  assert.equal(k.title, 'Berlin 15° · 9°/16°');               // Ort, jetzt, Tiefst/Höchst in einer Zeile
  assert.equal(k.m, '');                                        // keine große Zeile mehr
  assert.equal(k.ms, '15°');                                    // Handy: Kurzform
  assert.equal(k.lglyphTip, 'Teilweise bewölkt');               // Symbol in der Kopfzeile mit Erklärung
  assert.match(k.lglyph, /^<svg/);
  // Mini-Diagramm beschriftet: Skala in Linienfarbe und Legende
  assert.match(k.chart, /wd-miniskala"><b class="wd-t-max">21°<\/b><b class="wd-t-min">-3°<\/b>/);
  assert.match(k.chart, /16 Tage: <b class="wd-t-max">Höchst<\/b> · <b class="wd-t-min">Tiefst<\/b> · <b class="wd-t-regen">Regen<\/b>/);
  assert.match(k.chart, /wd-max.*wd-min.*wd-trend/);
  // Kopfzeile mit farbigen Zahlen
  assert.equal(k.titleHtml, 'Berlin 15° · <b class="wd-t-min">9°</b>/<b class="wd-t-max">16°</b>');
  // Aufgeklappt: Reiter
  assert.deepEqual(k.tabs.map(t => t.name), ['Heute', '16 Tage', '48 Std.', 'Mehr']);
  const tab = id => k.tabs.find(t => t.id === id).html;
  assert.equal((tab('tage').match(/data-tip=/g) || []).length, 16);          // 16 Tagesspalten mit Hinweis
  assert.equal((tab('stunden').match(/data-tip=/g) || []).length, 48);       // 48 Stundenspalten
  assert.match(tab('tage'), /Teilweise bewölkt|Regen|Bedeckt/);             // Hinweis nennt den Zustand
  assert.match(tab('heute'), /<b class="wd-t-min">9°<\/b> bis <b class="wd-t-max">16°<\/b>/);
  assert.match(tab('mehr'), /Luftqualität.*Taupunkt/s);
  assert.ok(!/<path[^>]*d=""/.test(k.tabs.map(t => t.html).join('') + k.chart), 'leerer Pfad');
  // Sonne unbekannt ≠ 0 Stunden
  const { tageDiagramm } = await esm('src/js/adapter/diagramm.js');
  const ohneSonne = env.daten.tage.map((t, i) => (i === 2 ? { ...t, sonnenstunden: null } : t));
  assert.match(tageDiagramm(ohneSonne, d => d), /Sonne: keine Angabe/);
  assert.equal(k.x, 'Teilweise bewölkt, gefühlt 14°. Regen möglich gegen 17 Uhr.');
  assert.ok(k.rows.some(([l]) => l === 'Luftqualität'));
  assert.ok(k.rows.some(([l]) => l === 'Morgen'));
  const zeile = l => (k.rows.find(([x]) => x.startsWith(l)) || [])[1];
  assert.equal(zeile('Wind'), '11 km/h aus W, Böen 25 km/h');
  assert.match(zeile('Sonne'), /4 Std\. Sonne · UV bis 3$/);
  assert.equal(zeile('Luftdruck'), '1016 hPa, fallend');
  assert.match(zeile('Trend bis'), /° bis .*° · .* \(unsicher\)$/);
  assert.ok(!k.rows.some(([l]) => l === 'Achtung'));        // heute/morgen kein Frost
  assert.match(text(env), /^Berlin: jetzt 15°/);
});

test('Dienstblätter: vollständig, jedes Ausgabefeld beschrieben, docs/dienste aktuell', async () => {
  const { pruefeBlatt } = require('../services/_lib/blatt');
  for (const d of dienste.DIENSTE) assert.deepEqual(pruefeBlatt(d), [], d.id);
  const k = await rufe('dienste');
  assert.ok(k.body.daten.dienste.every(d => d.blatt && d.blatt.skalierung), 'Katalog ohne Dienstblatt');
  const fs = require('node:fs');
  const { dateien, ORDNER } = require('../tools/doku');
  for (const [name, inhalt] of Object.entries(dateien())) {
    const datei = path.join(ORDNER, name);
    assert.ok(fs.existsSync(datei) && fs.readFileSync(datei, 'utf8').replace(/\r\n/g, '\n') === inhalt, `docs/dienste/${name} veraltet – npm run doku ausführen`);
  }
});

test('Adapter Katalog: Seite „Woher kommen die Daten?“ nennt jeden Dienst mit Quellen', async () => {
  const { seite } = await esm('src/js/adapter/katalog.js');
  const html = seite((await rufe('dienste')).body);
  for (const d of dienste.DIENSTE) assert.ok(html.includes(`<h3>${d.titel} <small class="dversion">${d.id} ${d.programmversion}</small></h3>`), d.id);
  assert.match(html, /GeoNames/);
  assert.match(html, /<details>/);
  assert.equal(seite(null), '<p>Keine Angaben verfügbar.</p>');
});

test('Ortsbestand-Erzeugung: Einwohner über Name, alternativen Namen oder Grundnamen in der Nähe', () => {
  const fs = require('node:fs'), os = require('node:os');
  const t = require('../tools/orte-daten');
  assert.equal(t.grundname('Freiburg im Breisgau'), 'Freiburg');
  assert.equal(t.grundname('Halle (Saale)'), 'Halle');
  assert.equal(t.grundname('Mühlhausen/Thüringen'), 'Mühlhausen');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orte-'));
  const plz = path.join(dir, 'plz.txt'), orte = path.join(dir, 'orte.txt');
  // GeoNames-Postleitzahlen (tabulatorgetrennt): Land, PLZ, Ort, Land, Code, Bezirk, Code, Kreis, Kreisschlüssel, lat, lon
  fs.writeFileSync(plz, [
    ['DE', '06108', 'Halle', 'Sachsen-Anhalt', 'ST', '', '', 'Halle', '15002', '51.48', '11.97'],
    ['DE', '79098', 'Freiburg im Breisgau', 'Baden-Württemberg', 'BW', '', '', 'Freiburg', '08311', '47.99', '7.85'],
    ['DE', '33790', 'Halle', 'Nordrhein-Westfalen', 'NW', '', '', 'Gütersloh', '05754', '52.06', '8.36'],
    ['DE', '99999', 'Musterfirma GmbH', 'Sachsen', 'SN', '', '', 'Dresden', '14612', '51.05', '13.74']
  ].map(z => z.join('\t')).join('\n'));
  // GeoNames-Ortsverzeichnis: 19 Spalten, 1 Name, 3 alternative Namen, 4/5 lat/lon, 6 Klasse, 14 Einwohner
  const zeile = (name, alt, lat, lon, ew, code = 'PPLA2') => ['1', name, name, alt, lat, lon, 'P', code, 'DE', '', '', '', '', '', String(ew), '', '', 'Europe/Berlin', ''].join('\t');
  fs.writeFileSync(orte, [
    zeile('Halle (Saale)', '', '51.48', '11.97', 238762),
    zeile('Freiburg', 'Friburgo', '47.99', '7.85', 227590),
    zeile('Halle', '', '52.06', '8.36', 21393),
    zeile('Munich', 'München,Monaco di Baviera', '48.14', '11.58', 1260391),
    zeile('Neustadt an der Weinstraße', '', '49.35', '8.14', 53984),  // gleicher Grundname, aber weit weg: zählt nicht
    zeile('Allstedt', 'Ahlsdorf', '51.40', '11.38', 7888, 'PPL')       // alternativer Name bei einem Dorf: zählt nicht
  ].join('\n'));
  fs.appendFileSync(plz, '\n' + [['DE', '80331', 'München', 'Bayern', 'BY', '', '', 'München', '09162', '48.14', '11.57'],
    ['DE', '99998', 'Neustadt', 'Rheinland-Pfalz', 'RP', '', '', 'Kusel', '07336', '49.55', '7.40'],
    ['DE', '06295', 'Ahlsdorf', 'Sachsen-Anhalt', 'ST', '', '', 'Mansfeld-Südharz', '15087', '51.41', '11.40'],
    ['DE', '21039', 'Hamburg Bergedorf', 'Schleswig-Holstein', 'SH', '', '', 'Herzogtum Lauenburg', '01053', '53.48', '10.21']].map(z => z.join('\t')).join('\n'));
  const d = t.erzeuge(plz, orte);
  const ew = Object.fromEntries(d.orte.map(o => [o[0] + '|' + o[2], [o[7], o[8]]]));
  assert.deepEqual(ew, { 'Freiburg im Breisgau|08311': [227590, 'Freiburg'], 'Halle|05754': [21393, ''], 'Halle|15002': [238762, 'Halle (Saale)'],
    'München|09162': [1260391, 'Munich'], 'Neustadt|07336': [0, ''], 'Ahlsdorf|15087': [0, ''], 'Hamburg Bergedorf|02000': [0, ''] });
  assert.equal(d.laender[d.orte.find(o => o[0] === 'Hamburg Bergedorf')[1]], 'Hamburg');   // Stadtstaat, nicht Schleswig-Holstein
  assert.equal(d.anzahl.ausgefiltert, 1);
  assert.equal(d.anzahl.mitEinwohnern, 4);
  assert.ok(!d.orte.some(o => o[2] === '01053'));
});

test('Ort-Knopf: Beschriftung, gespeicherter Ort, Trefferzeile', async () => {
  const { knopfText, alsEinstellung, beschrift } = await esm('src/js/ui/ort.js');
  const p = (await rufe('ort', { q: 'Neustadt Sachsen' })).body.daten.orte[0];
  const e = alsEinstellung(p);
  assert.deepEqual([e.name, e.admin, e.land, e.kreisSchluessel, e.gewaehlt], ['Neustadt in Sachsen', 'Sachsen', 'DE', '14628', true]);
  assert.equal(knopfText(e), 'Neustadt in Sachsen');
  assert.equal(knopfText({ name: 'Dresden', lat: 51.05 }), 'Ort wählen');           // nur Beispielort
  assert.equal(beschrift(p), 'Neustadt in Sachsen, Lkr. Sächsische Schweiz-Osterzgebirge (01844) <small>· Sachsen</small>');
  assert.equal(beschrift({ name: 'Dresden', kreis: 'Kreisfreie Stadt Dresden', plz: ['01067', '01069'], region: 'Sachsen', land: 'DE' }), 'Dresden (01067 …) <small>· Sachsen</small>');
});

test('Versionen: App-Nummer gleich in package.json und Oberfläche, Programmversion in jeder Antwort und im Katalog', async () => {
  const { APP, versionText } = await esm('src/js/core/version.js');
  assert.equal(APP.version, require('../package.json').version);
  assert.match(APP.version, /^\d+\.\d+\.\d+$/);
  assert.equal(versionText({ version: '0.6.0', stand: '2026-09-27T12:32:00Z', commit: 'b518008' }), 'DAILY 0.6.0 · 27.09.2026 14:32 · b518008');
  assert.equal(versionText({ version: '0.6.0', stand: null, commit: null }), 'DAILY 0.6.0');
  const w = await rufe('wetter', { ort: 'Berlin' });
  assert.equal(w.body.programm, dienste.byId.wetter.programmversion);
  const k = (await rufe('dienste')).body.daten;
  assert.equal(k.app.version, APP.version);
  for (const d of k.dienste) {
    assert.match(d.programmversion, /^\d+\.\d+\.\d+$/, d.id);
    assert.equal(d.aenderungen[0].version, d.programmversion, d.id);
  }
  const { seite } = await esm('src/js/adapter/katalog.js');
  assert.match(seite({ daten: k }, 'DAILY 0.6.0'), /DAILY 0\.6\.0.*wetter 1\.\d+\.\d+/s);
});

test('Regen: Radar über Bright Sky – jetzt, Beginn, letzte Stunde, Nähe, Karte, Takt 5 Minuten', async () => {
  const r = await rufe('regen', { lat: '52.52', lon: '13.41', name: 'Berlin' });
  assert.equal(r.code, 200);
  gueltig(r.body, dienste.byId.regen.schema);
  const d = r.body.daten;
  assert.deepEqual([d.regnet, d.jetzt.stufe, d.beginnt.inMinuten, d.endet], [false, 'kein', 20, null]);
  assert.equal(d.verlauf.length, 25);                        // jetzt bis +2 h in 5-Minuten-Schritten
  assert.equal(d.verlauf[0].gemessen, true); assert.equal(d.verlauf[1].gemessen, false);
  assert.deepEqual(d.letzteStunde, { summeMm: 0.4, aufgehoertVorMinuten: 30 });
  assert.deepEqual([d.naehe.richtung, d.naehe.entfernungKm], ['W', 4]);   // Zelle zieht von Westen heran
  assert.equal(d.karte.bilder.length, 9);                    // alle 15 Minuten bis +2 h
  assert.equal(d.karte.bilder[0].stufen.length, d.karte.breite * d.karte.hoehe);
  assert.equal(new Date(r.body.gueltigBis).getUTCMinutes() % 5, 0);
  assert.deepEqual(r.body.quellen.map(q => q.name), ['Deutscher Wetterdienst (Radar RV)', 'Bright Sky']);
});

test('Adapter Regen: Hinweis in der Wetterkachel und Reiter „Radar“', async () => {
  const { hinweis, radarReiter } = await esm('src/js/adapter/regen.js');
  const { kachel, antwort: text } = await esm('src/js/adapter/wetter.js');
  const regen = (await rufe('regen', { lat: '52.52', lon: '13.41' })).body;
  assert.equal(hinweis(regen), 'Regen in 20 Min. (leicht).');
  assert.equal(hinweis(null), null);
  const html = radarReiter(regen, iso => iso.slice(11, 16));
  assert.match(html, /<svg class="rk".*@keyframes/s);          // animierte Karte
  assert.match(html, /4 km westlich/);
  assert.match(html, /0,4 mm, aufgehört vor 30 Min\./);
  const wetter = (await rufe('wetter', { ort: 'Berlin' })).body;
  const k = kachel(wetter, regen);
  assert.deepEqual(k.tabs.map(t => t.id), ['heute', 'radar', 'tage', 'stunden', 'mehr']);
  assert.match(k.x, /Regen in 20 Min\./);
  assert.deepEqual(kachel(wetter, null).tabs.map(t => t.id), ['heute', 'tage', 'stunden', 'mehr']);   // ohne Radar
  assert.match(text(wetter, regen), /Radar: Regen in 20 Min\./);
});
