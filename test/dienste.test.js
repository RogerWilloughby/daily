// DAILY – Prüfungen der Dienst-Schicht (Austauschformat daily/1), ohne Netz.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fx = require('../tools/fixtures');
const { pruefe, pruefeStreng, RAHMEN } = require('../services/_lib/schema');
const { antwort, fehlerAntwort, DienstFehler } = require('../services/_lib/rahmen');
const dienste = require('../services');
const router = require('../api/v1/[dienst].js');

const esm = p => import(pathToFileURL(path.join(__dirname, '..', p)).href);
const BERLIN = { lat: '52.52', lon: '13.41' };   // Ortsdienste bekommen nur Koordinaten (seit 0.40.0)
// Name und Land setzt die Oberfläche ein (client.js → mitOrt), wie in der App
const mitName = async (env, name = 'Berlin') => (await esm('src/js/dienste/client.js')).mitOrt(env, { name, land: 'DE' });
const echtesFetch = global.fetch;
test.before(() => {
  global.fetch = require('../tools/fetch-stub');
  process.env.DAILY_PRIVAT_KENNWORT = 'geheim';                                   // Kennwort des privaten Betriebs in den Tests
  require('../services/termine').aufloesen = async () => [{ address: '93.184.216.34', family: 4 }];   // calendar.test: öffentliche Adresse
});
const KENNWORT = { 'x-daily-kennwort': 'geheim' };
test.after(() => { global.fetch = echtesFetch; });

// Router wie bei Vercel aufrufen
async function rufe(dienst, query = {}, method = 'GET', kopf = {}) {
  const r = { headers: {}, setHeader(k, v) { r.headers[k.toLowerCase()] = v; }, status(c) { r.code = c; return r; }, json(o) { r.body = o; } };
  await router({ method, query: { dienst, ...query }, headers: kopf }, r);
  return r;
}
const gueltig = (env, datenSchema) => {
  assert.deepEqual(pruefeStreng(env, RAHMEN), [], 'Rahmen ungültig');                    // streng: auch unbekannte Felder (Review M6)
  if (datenSchema) assert.deepEqual(pruefeStreng(env.daten, datenSchema), [], 'Daten ungültig');
};

test('Schema-Prüfer erkennt Typ-, Format-, Pflicht- und Bereichsfehler', () => {
  const s = { type: 'object', required: ['a', 'z'], properties: { a: { type: 'integer', minimum: 0 }, z: { type: 'string', format: 'zeit' }, e: { enum: ['x'] } } };
  assert.deepEqual(pruefe({ a: 1, z: '2026-09-27T08:00:00Z' }, s), []);
  const f = pruefe({ a: -1.5, z: '2026-09-27 08:00', e: 'y' }, s);
  assert.equal(f.length, 3, f.join('\n'));
  assert.equal(pruefe({}, s).length, 2);
  assert.deepEqual(pruefe({ a: 1, z: '2026-09-27T08:00:00Z', neu: 1 }, s), []);                                  // normal: unbekannte Felder egal
  assert.deepEqual(pruefeStreng({ a: 1, z: '2026-09-27T08:00:00Z', neu: 1 }, s), ['$.neu: nicht im Schema']);    // streng: gemeldet
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
  assert.deepEqual(pruefeStreng(r.daten, w.schema), []);
  assert.equal(r.daten.stunden.length, 48);
  // heute: alle Stunden des Kalendertags ab 0 Uhr Ortszeit (auch vergangene); Tageszeiten: 3 Tage × Morgen/Mittag/Abend/Nacht
  assert.ok(r.daten.heute.length >= 23 && r.daten.heute.length <= 25);
  assert.equal(new Date(r.daten.heute[0].zeit).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23' }).slice(0, 2), '00');
  assert.equal(r.daten.tageszeiten.length, 12);
  assert.deepEqual(r.daten.tageszeiten.slice(0, 4).map(t => [t.abschnitt, t.stunden]), [['morgen', 6], ['mittag', 6], ['abend', 6], ['nacht', 6]]);
  assert.equal(new Set(r.daten.tageszeiten.map(t => t.datum)).size, 3);
  assert.equal(r.daten.tageszeiten[0].datum, r.daten.tage[0].datum);
  const mi = r.daten.tageszeiten[1];                           // Mittag: Regen um 17 Uhr (0,6 mm, 55 %), Sonne 12–16 Uhr = 5 × 40 min
  assert.deepEqual([mi.niederschlagMm, mi.regenProzent, mi.zustand, mi.sonnenstunden, mi.windMaxKmh, mi.boeenMaxKmh], [0.6, 55, 'regen', 3.3, 12, 25]);
  assert.ok(mi.minC <= mi.tempC && mi.tempC <= mi.maxC);
  assert.equal(r.daten.heute[12].sonnenMin, 40);
  assert.equal(r.daten.tage.length, 15);                     // 15 Tage; Tag 16 der Quelle (ohne Werte) fällt weg
  assert.deepEqual(r.daten.tage.map(t => t.trend), [...Array(7).fill(false), ...Array(8).fill(true)]);   // ab Tag 8 Trend
  const f = fx.forecast(); f.daily.temperature_2m_max[14] = null; f.daily.temperature_2m_min[14] = null;
  assert.equal(w.umwandeln(f, null).daten.tage.length, 14);   // unvollständiger letzter Tag wird weggelassen
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
  assert.deepEqual(pruefeStreng(ohne.daten, w.schema), []);
});

test('Router: /api/v1/wetter?lat=…&lon=… liefert daily/1 – Koordinaten, Zeitzone aus der Quelle, kein Ortsname', async () => {
  const r = await rufe('wetter', BERLIN);
  assert.equal(r.code, 200);
  gueltig(r.body, dienste.byId.wetter.schema);
  const o = r.body.ort;
  assert.deepEqual([o.name, o.region, o.land, o.lat, o.lon, o.zeitzone], [null, null, null, 52.52, 13.41, 'Europe/Berlin']);   // Name kennt die Oberfläche
  // Takt: gültig bis zur nächsten vollen oder halben Stunde, CDN-Cache genau so lange
  const bis = new Date(r.body.gueltigBis);
  assert.ok([0, 30].includes(bis.getUTCMinutes()) && bis.getUTCSeconds() === 0, r.body.gueltigBis);
  const s = +/s-maxage=(\d+)/.exec(r.headers['cache-control'])[1];
  assert.ok(s >= 60 && s <= 1800 && Math.abs(s - Math.max(60, (bis - Date.now()) / 1000)) < 5, r.headers["cache-control"]);
  assert.equal(r.headers['access-control-allow-origin'], '*');
});

test('Router: Koordinaten nur mit höchstens 2 Nachkommastellen, kein Name, keine Region', async () => {
  for (const q of [{ lat: '51.050912', lon: '13.738' }, { lat: '51.050', lon: '13.74' }, { lat: '51.05', lon: '13.74', name: 'Dresden' }, { lat: '51.05', lon: '13.74', region: 'Sachsen' }])
    assert.equal((await rufe('wetter', q)).body.fehler.code, 'eingabe_ungueltig', JSON.stringify(q));
  const r = await rufe('wetter', { lat: '51.05', lon: '13.74' });
  assert.equal(r.code, 200);
  assert.deepEqual([r.body.ort.lat, r.body.ort.zeitzone], [51.05, 'Europe/Berlin']);
});

test('Router: Fehler kommen im Rahmen mit passendem Status', async () => {
  const fehlt = await rufe('wetter');
  assert.equal(fehlt.code, 400); assert.equal(fehlt.body.fehler.code, 'eingabe_fehlt'); gueltig(fehlt.body);
  const kaputt = await rufe('wetter', { lat: 'x', lon: '13' });
  assert.equal(kaputt.code, 400); assert.equal(kaputt.body.fehler.code, 'eingabe_ungueltig');
  const unbekannt = await rufe('gibtsnicht');
  assert.equal(unbekannt.code, 404); assert.equal(unbekannt.body.fehler.code, 'dienst_unbekannt');
  const name = await rufe('wetter', { ort: 'Atlantis' });            // Ortssuche per Name gibt es nur noch im Dienst „ort“
  assert.equal(name.code, 400); assert.match(name.body.fehler.meldung, /Unbekannte Angabe „ort“ – wetter kennt lat, lon/);
  const post = await rufe('wetter', BERLIN, 'POST');
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

test('Standort: Postleitzahl aus dem eigenen Bestand; andere Dienste nehmen keine Ortsnamen mehr', async () => {
  const o = await rufe('ort', { q: '01844' });
  assert.equal(o.code, 200);
  gueltig(o.body, dienste.byId.ort.schema);
  const ns = o.body.daten.orte.find(x => x.name === 'Neustadt in Sachsen');
  assert.ok(ns, namen(o.body).join());
  assert.deepEqual([ns.kreis, ns.kreisSchluessel, ns.region, ns.plz], ['Landkreis Sächsische Schweiz-Osterzgebirge', '14628', 'Sachsen', ['01844']]);
  assert.ok(Math.abs(ns.lat - 51.02) < 0.05 && Math.abs(ns.lon - 14.22) < 0.05);
  assert.equal((await rufe('ort', { q: '99999' })).body.daten.orte.length, 0);
  assert.equal((await rufe('wetter', { ort: '01067' })).body.fehler.code, 'eingabe_ungueltig');
});

test('Standort: Umkehrsuche aus Koordinaten – gerundet, Stadtteil → Ort, außerhalb leer', async () => {
  assert.equal((await rufe('ort', { lat: '51.050409', lon: '13.737262' })).body.fehler.code, 'eingabe_ungueltig');   // der Browser rundet vorher
  const o = await rufe('ort', { lat: '51.05', lon: '13.74' });
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

test('Adapter Wetter: Bereich aus dem Vertrag', async () => {
  const { kachel, kopfzeileHtml } = await esm('src/js/adapter/wetter.js');
  const env = await mitName((await rufe('wetter', BERLIN)).body);
  const k = kachel(env);
  assert.ok(env.daten.tage[0].minZeit && env.daten.tage[0].maxZeit);
  // seit 0.47.3 nur noch, was die Oberfläche braucht: keine Felder der früheren kleinen Kachel
  for (const weg of ['title', 'titleHtml', 'm', 'ms', 'x', 'zeile2', 'lglyph', 'zp', 'zeileIcon']) assert.equal(k[weg], undefined, weg);
  // Mini-Diagramm: Temperaturskala in 5er-Schritten, Regenskala rechts in mm, Legende
  assert.match(k.chart, /wd-miniskala wd-t-max"><div class="wd-sk"><span class="wd-g5"[^>]*>-5°<\/span>.*>25°<\/span><\/div>/);   // Temperatur orange
  // gemeinsame graue Linien: 7 Linien (-5 … 25), jede mit Temperatur links und Regen rechts (Mock bis 12 mm → 2 mm je Linie)
  assert.equal((k.chart.match(/°<\/span>/g) || []).length, 7);
  assert.equal((k.chart.match(/<line class="wd-gitter/g) || []).length, 7);
  assert.match(k.chart, /wd-miniskala-r wd-t-regen"><div class="wd-sk"><span class="wd-g5"[^>]*>0<\/span><span[^>]*>2<\/span>.*<span class="wd-g5"[^>]*>12 mm<\/span><\/div>/);   // Regen grün
  assert.match(k.chart, /<b class="wd-t-regen" title="Balkenhöhe = Regenmenge in mm · kräftigere Farbe = Regen wahrscheinlicher">Regen mm<\/b> · <b class="wd-t-max" title="Höchst = wärmster Wert des Tages">Höchst<\/b> · <b class="wd-t-min" title="Tiefst = [^"]+">Tiefst<\/b>/);
  assert.doesNotMatch(k.chart, /kräftiger = wahrscheinlicher/);                     // Erklärung nur noch als Mouseover
  assert.doesNotMatch(k.chart, /data-mini-wahl|wd-wahl/);                          // Zeitraum ist seit 0.49.0 Ebene 3 (Themen unter „Jetzt“)
  assert.match(k.chart, /wd-marken">(<span[^>]*>(Mo|Di|Mi|Do|Fr|Sa|So)<\/span>){8}<\/div>/);   // Wochentage, bei 15 Tagen jeder zweite
  // Sonne (Tage) als gelbe Balken von oben, Mouseover je Tag, runde Linien
  assert.doesNotMatch(k.chart, /class="wd-sonne"/);                                   // keine Sonnenbalken mehr
  assert.match(k.chart, /<div class="wd-sonnen wd-t-sonne">(<span class="(wd-s2)?" style="left:[\d.]+%">\d+<\/span>){15}<\/div>/);   // volle Stunden je Tag
  assert.equal((k.chart.match(/class="wd-spalte"/g) || []).length, 15);
  const zp = c => JSON.parse(c.match(/data-zp="([^"]*)"/)[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  const z1 = zp(k.chart);                                                              // Werte je Tag für den Zeitpunkt-Block
  assert.deepEqual(Object.keys(z1), ['z', 't', 'g', 'i', 'l', 'mm', 'p', 'w', 's']);
  assert.match(z1.z, /^(Mo|Di|Mi|Do|Fr|Sa|So) \d{1,2}\.\d{1,2}\.$/);
  assert.match(z1.t, /^-?\d+–-?\d+°$/);
  assert.equal(z1.g, '');                                                             // Tag: kein „gefühlt“, Platz bleibt frei
  assert.match(z1.s, /^☀ \d+ h$/);
  assert.doesNotMatch(k.chart, /data-tip=/);
  assert.match(k.chart, /class="wd-max" d="M[\d.]+,[\d.]+C/);
  assert.match(k.chart, /<b class="wd-t-sonne"[^>]*>Sonne<\/b>/);
  assert.match(k.chart, /wd-max.*wd-min/);
  assert.doesNotMatch(k.chart + JSON.stringify(k.kleinReiter), /wd-trend|Trend|unsicher/);   // keine Trend-Kennzeichnung mehr in der Oberfläche
  // Kopfzeile mit farbigen Zahlen (mit aktueller Temperatur)
  assert.match(kopfzeileHtml(env), /^Berlin 15° · <span class="wd-tm" title="Tiefstwert heute: 9° um \d{1,2} Uhr"><b class="wd-t-min">9°<\/b> <small class="wd-um">\d{1,2} Uhr<\/small><\/span> \/ <span class="wd-tm" title="Höchstwert heute: 16° um \d{1,2} Uhr"><b class="wd-t-max">16°<\/b> <small class="wd-um">\d{1,2} Uhr<\/small><\/span>$/);
  assert.match(k.kopf, /9°<\/b> <small class="wd-um">\(\d{1,2} Uhr\)<\/small><\/span> \/ <span class="wd-tm" title="Höchstwert[^"]*"><b class="wd-t-max">16°<\/b> <small class="wd-um">\(\d{1,2} Uhr\)<\/small>/);   // Kopf des Bereichs: Uhrzeit in Klammern
  // Untertabs: Jetzt · Mehr – Radar nur mit Radar-Antwort, Hinweise nur bei Warnung
  assert.deepEqual(k.kleinReiter.map(r => r.id), ['jetzt', 'mehr']);
  assert.ok(k.kleinReiter.every(r => /^<svg class="ico"/.test(r.icon)));
  assert.match(k.kleinReiter[0].html, /^<div class="wz-jetzt"><span class="t-zp" data-jetzt="[^"]+"><span class="zp-z">Jetzt<\/span><span class="zp-t">15°<\/span>/);
  const mehr = k.kleinReiter[1].liste;
  assert.ok(['Morgen', 'Regen', 'Wind', 'Sonne', 'Luft', 'Pollen', 'Druck', 'Feuchte'].every(x => mehr.some(z => z.d === x)), mehr.map(z => z.d).join());
  assert.equal(mehr[0].d, 'Morgen');                                          // wichtigste zuerst
  assert.match(mehr.find(z => z.d === 'Feuchte').t, /Taupunkt/);
  assert.ok(k.info.some(x => /^Stand \d\d:\d\d Uhr$/.test(x)));
  assert.ok(!/<path[^>]*d=""/.test(JSON.stringify(k.kleinReiter) + k.chart), 'leerer Pfad');
  // Sonne unbekannt ≠ 0 Stunden
  const { zpTag } = await esm('src/js/adapter/wetter.js');
  assert.equal(zpTag({ ...env.daten.tage[2], sonnenstunden: null }).s, '☀ –');
  assert.equal(zpTag({ ...env.daten.tage[2], sonnenstunden: 0 }).s, '☀ 0 h');
  const zeile = l => (mehr.find(z => z.d === l) || {}).t;            // Untertab „Mehr“
  assert.equal(zeile('Wind'), '11 km/h aus W, Böen 25');
  assert.match(zeile('Sonne'), /4 Std\. · UV bis 3$/);
  assert.equal(zeile('Druck'), '1016 hPa, fallend');
  assert.ok(zeile('Luft'));
  assert.ok(!mehr.some(z => z.d === 'Achtung'));           // heute/morgen kein Frost
  const w = await esm('src/js/adapter/wetter.js');
  for (const weg of ['antwort', 'regen24', 'kopfzeile', 'KURZ', 'zpText']) assert.equal(w[weg], undefined, 'noch da: ' + weg);   // Frag DAILY und kleine Kachel entfernt
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

test('Adapter Katalog: Seite „Woher kommen die Daten?“ nennt jeden Dienst der Oberfläche mit Quellen', async () => {
  const { seite } = await esm('src/js/adapter/katalog.js');
  const { GENUTZTE_DIENSTE } = await esm('src/js/core/betrieb.js');
  const html = seite((await rufe('dienste')).body);
  for (const d of dienste.DIENSTE) {
    const kopf = `<h3>${d.titel} <small class="dversion">${d.id} ${d.programmversion}</small></h3>`;
    if (GENUTZTE_DIENSTE.includes(d.id)) assert.ok(html.includes(kopf), 'fehlt: ' + d.id);
    else assert.ok(!html.includes(kopf), 'nur auf dem Server, trotzdem genannt: ' + d.id);   // seit 0.47.3
  }
  assert.ok(GENUTZTE_DIENSTE.filter(id => id !== 'dienste').every(id => dienste.IDS.includes(id)), 'unbekannter Dienst in GENUTZTE_DIENSTE');
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
  const { leistenText } = await esm('src/js/core/version.js');   // Statusleiste (0.51.1)
  assert.equal(leistenText({ version: '0.51.1', stand: '2026-10-03T07:14:00Z', commit: 'b518008' }), 'v0.51.1 · 03.10.2026 09:14');
  assert.equal(leistenText({ version: '0.51.1', stand: '2026-10-03T07:14:00Z', commit: 'b518008' }, true), 'v0.51.1 · 3.10. 09:14');
  assert.equal(leistenText({ version: '0.51.1', stand: null, commit: null }), 'v0.51.1');
  const html = require('node:fs').readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
  assert.match(html, /class="ab-version" data-version="leiste"/); assert.match(html, /class="ab-ver" data-version="leiste-kurz"/);
  const w = await rufe('wetter', BERLIN);
  assert.equal(w.body.programm, dienste.byId.wetter.programmversion);
  const k = (await rufe('dienste')).body.daten;
  assert.equal(k.app.version, APP.version);
  for (const d of k.dienste) {
    assert.match(d.programmversion, /^\d+\.\d+\.\d+$/, d.id);
    assert.equal(d.aenderungen[0].version, d.programmversion, d.id);
  }
  const { seite } = await esm('src/js/adapter/katalog.js');
  assert.match(seite({ daten: k }, 'DAILY 0.6.0'), /DAILY 0\.6\.0.*wetter \d+\.\d+\.\d+/s);
});

test('Regen: Radar über Bright Sky – jetzt, Beginn, letzte Stunde, Nähe, Karte, Takt 5 Minuten', async () => {
  const r = await rufe('regen', BERLIN);
  assert.equal(r.code, 200);
  gueltig(r.body, dienste.byId.regen.schema);
  const d = r.body.daten;
  assert.deepEqual([d.regnet, d.jetzt.stufe, d.beginnt.inMinuten, d.endet], [false, 'kein', 20, null]);
  assert.equal(d.verlauf.length, 25);                        // jetzt bis +2 h in 5-Minuten-Schritten
  assert.equal(d.verlauf[0].gemessen, true); assert.equal(d.verlauf[1].gemessen, false);
  assert.deepEqual(d.letzteStunde, { summeMm: 0.4, aufgehoertVorMinuten: 30 });
  assert.deepEqual([d.naehe.richtung, d.naehe.entfernungKm], ['W', 4]);   // Zelle zieht von Westen heran
  assert.equal(d.karte.bilder.length, 13);                   // alle 15 Minuten von −60 min bis +2 h
  assert.equal(d.karte.bilder.map(b => (b.gemessen ? 'g' : 'v')).join(''), 'gggggvvvvvvvv');
  assert.deepEqual([d.karte.breite, d.karte.hoehe], [52, 52]);   // ±50 km in 2-km-Zellen
  assert.equal(d.karte.bilder[0].stufen.length, d.karte.breite * d.karte.hoehe);
  const e = d.karte.ecken;                                   // Ecken umschließen den Ort; 104 Rasterpixel ≈ 100 km (Maßstab des Rasters wahr bei 60° N)
  assert.ok(e.nw.lat > 52.52 && e.sw.lat < 52.52 && e.nw.lon < 13.41 && e.ne.lon > 13.41);
  assert.ok(Math.abs((e.nw.lat - e.sw.lat) * 111.2 - 100) < 2);
  assert.equal(new Date(r.body.gueltigBis).getUTCMinutes() % 5, 0);
  assert.deepEqual(r.body.quellen.map(q => q.name), ['Deutscher Wetterdienst (Radar RV)', 'Bright Sky']);
});

test('Adapter Regen: Abzeichen im Bereich Wetter und Untertab „Radar“', async () => {
  const { hinweis, radarKlein } = await esm('src/js/adapter/regen.js');
  const { kachel } = await esm('src/js/adapter/wetter.js');
  const regen = (await rufe('regen', { lat: '52.52', lon: '13.41' })).body;
  assert.equal(hinweis(regen), 'Regen in 20 Min. (leicht).');
  assert.equal(hinweis(null), null);
  const wetter = await mitName((await rufe('wetter', BERLIN)).body);
  const k = kachel(wetter, regen);
  assert.deepEqual(k.kleinReiter.map(r => r.id), ['jetzt', 'radar', 'mehr']);
  const rk = k.kleinReiter[1], html = rk.html;
  assert.equal(rk.kopf, 'Regen in 20 Min. (leicht).');
  assert.match(html, /^<div class="rk-klein"><div class="rk-karte"><svg class="rk rk-mit-land".*<div class="rk-leiste".*<dl class="rk-werte">.*4 km westlich/s);
  assert.match(html, /<svg class="rk rk-mit-land" viewBox="0 0 (\S+) \1"/);   // quadratische Karte mit Landkarte
  const kacheln = html.match(/<image href="\/api\/karte\?z=9&amp;x=\d+&amp;y=\d+"/g) || [];
  assert.ok(kacheln.length >= 4 && kacheln.length <= 16, 'Kacheln: ' + kacheln.length);
  assert.match(html, /<g class="rk-radar" transform="matrix\(/);
  assert.equal((html.match(/class="rk-bild/g) || []).length, 13);
  assert.match(html, /<g class="rk-bild rk-an" data-i="4">/);  // „jetzt“ ist sichtbar, auch ohne Skript
  assert.equal((html.match(/data-rk-bild="/g) || []).length, 13);
  assert.match(html, /aria-pressed="true" title="[\d:]+ Uhr · gemessen"><i><\/i><span>jetzt<\/span>/);
  assert.match(html, /<span>−1 Std\.<\/span>.*<span>\+1 Std\.<\/span>.*<span>\+2 Std\.<\/span>/s);
  assert.match(html, /Letzte Std\.<\/dt><dd>0,4 mm/);
  const ohneLand = radarKlein({ ...regen, daten: { ...regen.daten, karte: { ...regen.daten.karte, ecken: undefined } } }, iso => iso.slice(11, 16));
  assert.doesNotMatch(ohneLand, /<image|BKG/);               // ältere Antwort ohne Ecken: Radar ohne Landkarte
  assert.match(ohneLand, /<svg class="rk" viewBox="0 0 52 52"/);
  assert.ok(k.info.some(x => /^Radar: Deutscher Wetterdienst/.test(x)) && k.info.some(x => /GeoBasis-DE \/ BKG \(20\d\d\), basemap\.de/.test(x)));
  assert.match(k.kopf, /wh-badge wd-radar[^>]*>☂ in 20 Min\. \(leicht\)</);   // Radar-Meldung als Abzeichen im Kopf
  assert.deepEqual(kachel(wetter, null).kleinReiter.map(r => r.id), ['jetzt', 'mehr']);   // ohne Radar
});

test('Mehrere Orte: Auswahlbox, hinzufügen, wechseln, entfernen', async () => {
  const st = await esm('src/js/core/store.js');
  const { auswahl, alsEinstellung } = await esm('src/js/ui/ort.js');
  assert.deepEqual(auswahl([], -1).map(e => e.text), ['Ort wählen …']);
  const orte = (await rufe('ort', { q: 'Neustadt' })).body.daten.orte.map(alsEinstellung);
  st.settings.orte = []; st.settings.place = st.DEFAULTS.place;
  st.ortHinzufuegen(orte[0]); st.ortHinzufuegen(orte[1]); st.ortHinzufuegen(orte[0]);   // doppelt → nur gewählt
  assert.equal(st.settings.orte.length, 2);
  assert.equal(st.settings.place.name, orte[0].name);
  const a = auswahl(st.settings.orte, st.aktiverOrt());
  assert.deepEqual(a.map(e => e.wert), ['0', '1', 'neu', 'verwalten']);
  assert.equal(a.find(e => e.gewaehlt).text, orte[0].name);
  st.ortWaehlen(1); assert.equal(st.settings.place.name, orte[1].name);
  st.ortEntfernen(1);                                          // aktiver Ort entfernt → erster verbleibender
  assert.deepEqual([st.settings.orte.length, st.settings.place.name], [1, orte[0].name]);
  st.ortEntfernen(0);                                          // keiner mehr → Beispielort
  assert.equal(st.settings.place.name, 'Dresden');
  for (let i = 0; i < 12; i++) st.ortHinzufuegen({ ...orte[0], name: 'Ort ' + i, lat: 50 + i * 0.1 });
  assert.equal(st.settings.orte.length, st.MAX_ORTE);
});

test('Client: Einzelabfragen mit nur den Koordinaten, sofort anzeigen aus dem Speicher, Rückfall auf letzten Stand, Messung; kein Paket mehr', async () => {
  const lager = {};
  global.localStorage = { getItem: k => lager[k] ?? null, setItem: (k, v) => { lager[k] = String(v); }, removeItem: k => { delete lager[k]; } };
  const echt = global.fetch; let stoerung = false;
  global.fetch = async (url, o) => {
    if (!String(url).startsWith('/api/v1/')) return echt(url, o);   // Abrufe der Dienste bei ihren Quellen: Beispieldaten (fetch-stub)
    if (stoerung) throw new Error('offline');
    const u = new URL(url, 'http://x'); const q = Object.fromEntries(u.searchParams);
    const r = await rufe(u.pathname.split('/').pop(), q);
    return { ok: r.code < 400, status: r.code, json: async () => r.body };
  };
  try {
    const neu = z => import(pathToFileURL(path.join(__dirname, '..', 'src/js/dienste/client.js')).href + '?t=' + z);   // frisches Modul = Browser-Neustart
    const c = await neu(1);
    const zeiten = []; c.aufMessung((n, ms, q) => zeiten.push([n, q]));
    const p = c.ortParams({ lat: 52.5201, lon: 13.4049, name: 'Berlin', admin: 'Berlin', land: 'DE', zeitzone: 'Europe/Berlin' });
    assert.deepEqual(p, { lat: 52.52, lon: 13.4 });                             // nur gerundete Koordinaten – kein Name, Bundesland, Land, Zeitzone
    assert.equal(c.gespeichert('wetter', p), null);
    const [w1, r1] = await Promise.all([c.dienst('wetter', p), c.dienst('regen', p)]);
    assert.equal(w1.dienst, 'wetter'); assert.equal(r1.dienst, 'regen');
    assert.deepEqual(zeiten.at(-1)[1], 'netz');
    assert.ok(Object.keys(lager).some(k => k.endsWith('/api/v1/wetter?lat=52.52&lon=13.4')));   // eine Adresse je Dienst und Zelle, für das nächste Öffnen gespeichert
    assert.equal(c.paket, undefined);
    assert.equal((await rufe('paket', { dienste: 'wetter' })).body.fehler.code, 'dienst_unbekannt');   // Paket gibt es nicht mehr
    // Speicher im Browser wie nach einem Neustart: nur localStorage bleibt
    const c2 = await neu(2);
    assert.equal(c2.gespeichert('wetter', p).dienst, 'wetter');                // sofort anzeigen
    stoerung = true;
    const [w2, r2] = await Promise.all([c2.dienst('wetter', p), c2.dienst('regen', p)]);   // Netz weg → letzter Stand, als veraltet markiert
    assert.equal(w2.veraltet, true);
    assert.equal(r2.veraltet, true);
    await assert.rejects(c2.dienst('ort', { q: 'Berlin' }), e => e.code === 'nicht_erreichbar');   // nichts gespeichert → Fehler
  } finally { global.fetch = echt; delete global.localStorage; }
});

test('Wetterhinweise: DWD-Warnungen über Bright Sky – ohne Testmeldungen, höchste Stufe zuerst, mit Tipp', async () => {
  const r = await rufe('wetterhinweise', { lat: '51.05', lon: '13.74' });
  assert.equal(r.code, 200);
  gueltig(r.body, dienste.byId.wetterhinweise.schema);
  const d = r.body.daten;
  assert.equal(d.gebiet, 'Dresden');
  assert.equal(d.hoechsteStufe, 2);
  assert.deepEqual(d.hinweise.map(h => [h.art, h.stufe, h.stufeName, h.aktiv]), [['wind', 2, 'markant', false], ['wind', 1, 'wetterwarnung', false]]);
  assert.equal(d.hinweise[0].empfehlung, 'Achten Sie auf herabstürzende Äste.');   // amtlicher Text unverändert
  assert.match(d.hinweise[0].tipp, /Balkonmöbel/);
  assert.equal(new Date(r.body.gueltigBis).getUTCMinutes() % 5, 0);
  const { umwandeln, art } = dienste.byId.wetterhinweise;
  assert.deepEqual(umwandeln(fx.alerts(false)).hinweise, []);
  assert.equal(umwandeln(fx.alerts(false)).hoechsteStufe, 0);
  const jetzt = Date.now(), vorbei = { alerts: [{ severity: 'minor', event_de: 'FROST', expires: new Date(jetzt - 1000).toISOString() }] };
  assert.equal(umwandeln(vorbei, jetzt).hinweise.length, 0);                          // abgelaufene fallen weg
  assert.deepEqual(['GLATTEIS', 'STARKES GEWITTER', 'ORKANBÖEN', 'DICHTER NEBEL', 'STRENGER FROST', 'STARKE HITZE', 'HEFTIGER STARKREGEN', 'LEICHTER SCHNEEFALL', 'XYZ'].map(art),
    ['glaette', 'gewitter', 'wind', 'nebel', 'frost', 'hitze', 'regen', 'schnee', 'sonstiges']);
  const unwetter = umwandeln({ alerts: [{ severity: 'extreme', event_de: 'ORKANBÖEN', onset: new Date(jetzt - 6e5).toISOString(), expires: new Date(jetzt + 36e5).toISOString() }] }, jetzt);
  assert.deepEqual([unwetter.hinweise[0].stufe, unwetter.hinweise[0].aktiv], [4, true]);
  assert.match(unwetter.hinweise[0].tipp, /Aufenthalt im Freien vermeiden/);          // ab Stufe 3 ernster Tipp
});

test('Adapter Wetterhinweise: Abzeichen und Untertab im Bereich Wetter, Unwetter zuerst', async () => {
  const h = await esm('src/js/adapter/hinweise.js');
  const { kachel } = await esm('src/js/adapter/wetter.js');
  const env = (await rufe('wetterhinweise', { lat: '51.05', lon: '13.74' })).body;
  const wetter = await mitName((await rufe('wetter', BERLIN)).body);
  assert.match(h.abzeichen(env), /class="wh-badge wh-s2"[^>]*>Sturmböen \+1</);
  for (const weg of ['kurz', 'reiter', 'antwort']) assert.equal(h[weg], undefined, 'noch da: ' + weg);   // kleine Kachel, Aufklappen, Frag DAILY entfernt
  // im Bereich: Abzeichen in der Kopfzeile, Untertab vor „Mehr“
  const k = kachel(wetter, null, env);
  assert.match(k.kopf, /wh-badge/);
  assert.deepEqual(k.kleinReiter.map(r => r.id), ['jetzt', 'hinweise', 'mehr']);              // Mini-Reiter „Hinweise“ nur bei Warnung
  const hr = k.kleinReiter[1];
  assert.match(hr.kopf, /wh-badge wh-s2/);
  assert.deepEqual(hr.liste.map(z => z.t), ['Sturmböen', 'Starke böen']);
  assert.match(hr.liste[0].d, /^ab /);
  assert.match(hr.liste[0].ico, /wh-punkt wh-s2/);
  assert.match(hr.liste[0].tip, /^Markantes Wetter: Amtliche WARNUNG vor STURMBÖEN \(.*\)\nEs treten Sturmböen um 70 km\/h auf\.\nEmpfehlung: Achten Sie.*\nTipp \(DAILY\): /);
  // ohne Hinweis: kein Abzeichen, kein Untertab
  const leer = kachel(wetter, null, { erstellt: new Date().toISOString(), daten: { gebiet: 'Berlin', hoechsteStufe: 0, hinweise: [] } });
  assert.doesNotMatch(leer.kopf, /wh-badge/);
  assert.deepEqual(leer.kleinReiter.map(r => r.id), ['jetzt', 'mehr']);                        // ohne Warnung kein Reiter
  assert.deepEqual(kachel(wetter, null, null).kleinReiter.map(r => r.id), ['jetzt', 'mehr']);
  // Unwetter (Stufe 3–4): deutlich, zuerst, nicht verharmlost
  const u = { daten: { gebiet: 'Dresden', hoechsteStufe: 4, hinweise: [{ art: 'wind', stufe: 4, stufeName: 'extrem', ereignis: 'ORKANBÖEN', titel: 'Amtliche WARNUNG vor ORKANBÖEN',
    beginn: new Date().toISOString(), ende: new Date(Date.now() + 36e5).toISOString(), aktiv: true, beschreibung: 'Orkanböen bis 130 km/h.', empfehlung: 'Aufenthalt im Freien vermeiden!', tipp: 'x' }] } };
  const ku = kachel(wetter, null, u);
  assert.match(ku.kopf, /wh-s4[^>]*>! Unwetter: Orkanböen</);
  assert.equal(ku.unwetter, 'ORKANBÖEN|' + u.daten.hinweise[0].beginn);                       // Kennung: einmal automatisch auf „Hinweise“
  const ur = ku.kleinReiter.find(r => r.id === 'hinweise');
  assert.equal(ur.liste[0].t, 'Extreme Unwetterwarnung: Orkanböen');
  assert.match(ur.liste[0].tip, /Aufenthalt im Freien vermeiden!/);
});

test('Feiertage: je Bundesland (nicht je Ort), Feiertage, Brückentage, Ferien, Zeitumstellung, KW, Aktionstage', async () => {
  const fe = dienste.byId.feiertage;
  const r = await rufe('feiertage', { bundesland: 'SN' });                                // seit 2.0.0: nur das Bundesland (16 Fächer statt je Ort)
  assert.equal(r.code, 200);
  gueltig(r.body, fe.schema);
  assert.equal(r.body.ort, null);                                                          // der Dienst kennt keinen Ort
  const d = r.body.daten;
  assert.deepEqual([d.bundesland, d.kuerzel], ['Sachsen', 'SN']);
  assert.deepEqual(d.ferien.map(f => f.name), ['Herbstferien', 'Weihnachtsferien']);
  assert.equal((await rufe('feiertage', { bundesland: 'BY' })).body.daten.bundesland, 'Bayern');
  assert.equal((await rufe('feiertage', { bundesland: 'by' })).body.fehler.code, 'eingabe_ungueltig');   // nur eine Schreibweise
  assert.equal((await rufe('feiertage', {})).body.fehler.code, 'eingabe_fehlt');
  assert.equal((await rufe('feiertage', { bundesland: 'XX' })).body.fehler.code, 'eingabe_ungueltig');
  // Browser: Bundesland des gewählten Orts → Kürzel (gleiche Liste wie im Dienst); Ausland → kein Abruf
  const bl = await esm('src/js/lib/bundesland.js');
  assert.deepEqual(bl.BUNDESLAENDER, fe.LAENDER);
  assert.deepEqual([bl.bundeslandVon({ admin: 'Sachsen', land: 'DE' }), bl.bundeslandVon({ region: 'Bayern' }), bl.bundeslandVon({ admin: 'Lazio', land: 'IT' }), bl.bundeslandVon(null)], ['SN', 'BY', null, null]);
  // Rechnung (rein)
  assert.equal(fe.ostern(2026).toISOString().slice(0, 10), '2026-04-05');
  assert.equal(fe.ostern(2027).toISOString().slice(0, 10), '2027-03-28');
  const sn = fe.berechne('SN', '2026-01-01');
  const namen = sn.feiertage.map(f => f.datum + ' ' + f.name);
  assert.ok(namen.includes('2026-11-18 Buß- und Bettag') && namen.includes('2026-10-31 Reformationstag'));
  assert.ok(!namen.some(x => x.includes('Fronleichnam')));
  assert.equal(fe.berechne('BY', '2026-01-01').feiertage.find(f => f.name === 'Fronleichnam').datum, '2026-06-04');
  assert.equal(sn.feiertage.filter(f => f.datum < '2027-01-01').length, 11);
  assert.equal(sn.feiertage[0].brueckentag, '2026-01-02');                            // Neujahr am Donnerstag
  assert.deepEqual(sn.zeitumstellung.slice(0, 2).map(z => z.datum + ' ' + z.art), ['2026-03-29 sommerzeit', '2026-10-25 winterzeit']);
  const akt = Object.fromEntries(sn.aktionstage.filter(a => a.datum < '2027-01-01').map(a => [a.name, a.datum]));
  assert.equal(akt.Muttertag, '2026-05-10');
  assert.equal(akt['1. Advent'], '2026-11-29');
  assert.equal(akt.Totensonntag, '2026-11-22');
  assert.equal(akt.Rosenmontag, '2026-02-16');
  assert.equal(akt.Erntedankfest, '2026-10-04');
  assert.ok(!fe.berechne('BE', '2026-01-01').aktionstage.some(a => a.name === 'Internationaler Frauentag'));   // in Berlin Feiertag
  assert.deepEqual(['2026-01-01', '2026-09-27', '2026-12-31', '2027-01-03', '2027-01-04'].map(fe.kalenderwoche), [1, 39, 53, 53, 1]);
});

test('Himmel: Mond, Mondphasen, Sternschnuppen, Finsternisse am Ort, Jahreszeiten', async () => {
  const hi = dienste.byId.himmel;
  const r = await rufe('himmel', { lat: '51.05', lon: '13.74' });
  assert.equal(r.code, 200);
  gueltig(r.body, hi.schema);
  const d = hi.berechne(51.05, 13.74, Date.parse('2026-09-27T10:00:00Z'));
  assert.equal(d.mond.name, 'vollmond');                                              // Vollmond am 26.09.2026
  assert.ok(d.mond.beleuchtung >= 98);
  assert.equal(d.mondphasen[0].phase, 'letztes_viertel');
  assert.equal(d.mondphasen[3].zeit.slice(0, 10), '2026-10-26');                      // nächster Vollmond
  assert.equal(d.sternschnuppen[0].name, 'Draconiden');
  // Sonnenfinsternis 02.08.2027 (in Spanien total) ist in Dresden teilweise zu sehen
  const sofi = d.finsternisse.find(f => f.art === 'sonne');
  assert.deepEqual([sofi.maximum.slice(0, 10), sofi.typ, sofi.sichtbar], ['2027-08-02', 'partiell', 'ganz']);
  assert.ok(sofi.bedeckung > 25 && sofi.bedeckung < 55, String(sofi.bedeckung));
  assert.ok(d.finsternisse.every(f => f.typ !== 'halbschatten'));
  assert.deepEqual(d.jahreszeiten.map(j => j.art), ['winter', 'fruehling', 'sommer', 'herbst']);
  assert.equal(d.jahreszeiten[0].zeit.slice(0, 10), '2026-12-21');
  assert.deepEqual([0, 45, 90, 135, 180, 225, 270, 315].map(hi.phasenName),
    ['neumond', 'zunehmende_sichel', 'erstes_viertel', 'zunehmender_mond', 'vollmond', 'abnehmender_mond', 'letztes_viertel', 'abnehmende_sichel']);
});

test('Adapter Kalender: Bereich aus Feiertagen und Himmel, Untertabs', async () => {
  const kal = await esm('src/js/adapter/kalender.js'), { kachel, termine } = kal;
  const jetzt = Date.parse('2026-09-27T10:00:00Z');
  const fe = { daten: { ...dienste.byId.feiertage.berechne('SN', '2026-09-27'), bundesland: 'Sachsen', kuerzel: 'SN',
    ferien: [{ name: 'Herbstferien', von: '2026-10-12', bis: '2026-10-24' }] } };
  const hi = { daten: dienste.byId.himmel.berechne(51.05, 13.74, jetzt) };
  const k = kachel(fe, hi, jetzt);
  assert.equal(k.title, 'Kalender · KW 39');
  assert.equal(k.m, 'Tag der Deutschen Einheit');
  assert.equal(k.ms, '6 Tage');
  assert.match(k.x, /^In 6 Tagen \(Sa\., 3\.10\.\) · Herbstferien ab Mo\., 12\.10\./);
  // Rubriken (seit 0.49.0): Nächste · Feiertage · Ferien · Himmel (erscheint unter Wetter)
  const R = (kk, id) => kk.kleinReiter.find(x => x.id === id);
  assert.deepEqual(k.kleinReiter.map(t => t.id), ['naechste', 'feiertage', 'ferien', 'himmel']);
  assert.ok(k.kleinReiter.every(x => /^<svg class="ico"/.test(x.icon)));
  assert.equal(k.tabs, undefined); assert.deepEqual(k.liste, []); assert.equal(k.startReiter, 'naechste');
  assert.equal(R(k, 'naechste').kopf, '<small class="kl-kw">KW 39</small> <b>Tag der Deutschen Einheit</b> <small>in 6 Tagen</small>');
  assert.deepEqual(R(k, 'naechste').liste.map(z => z.t).slice(0, 2), ['Herbstferien', 'Winterzeit: Uhr zurück (3 → 2 Uhr)']);   // die große Zeile steht im Kopf
  assert.match(R(k, 'feiertage').kopf, /Feiertage<\/b> <small>Sachsen/);
  const fr = R(k, 'feiertage').liste;
  assert.deepEqual([fr[0].d, fr[0].t], ['Sa., 3.10.', 'Tag der Deutschen Einheit (am Wochenende)']);
  assert.ok(!fr.some(z => z.t === 'Herbstferien'));
  assert.deepEqual(R(k, 'ferien').liste.map(z => [z.d, z.t]), [['ab Mo., 12.10.', 'Herbstferien']]);
  assert.match(R(kachel({ daten: { ...fe.daten, ferien: null } }, hi, jetzt), 'ferien').html, /Schulferien sind gerade nicht erreichbar/);
  assert.match(fr[0].tip, /^Feiertag · Sa\., 3\.10\. \(in 6 Tagen\)/);
  assert.match(R(k, 'himmel').kopf, /^<b>Vollmond<\/b> <small>\d+ % beleuchtet/);
  assert.ok(R(k, 'himmel').liste.some(z => /Partielle Sonnenfinsternis/.test(z.t)));
  assert.ok(k.info.some(z => /OpenHolidays/.test(z)) && k.info.some(z => /Astronomy Engine/.test(z)));
  // laufende Ferien gehen vor
  const k2 = kachel({ daten: { ...fe.daten, feiertage: [], ferien: [{ name: 'Herbstferien', von: '2026-09-20', bis: '2026-10-02' }] } }, hi, jetzt);
  assert.deepEqual([k2.m, k2.ms, k2.x.split(' · ')[0]], ['Herbstferien', 'Ferien', 'bis Fr., 2.10.']);
  // Ausland: nur Himmel
  const k3 = kachel(null, hi, jetzt);
  assert.deepEqual(k3.kleinReiter.map(t => t.id), ['naechste', 'himmel']);
  assert.equal(k3.title, 'Kalender');
  assert.ok(termine(fe, hi, '2026-09-27').every((t, i, a) => !i || a[i - 1].datum <= t.datum));
  for (const weg of ['antwort', 'namenAntwort', 'termineAntwort']) assert.equal(kal[weg], undefined, 'noch da: ' + weg);   // Frag DAILY und Termine entfernt (0.47.3)
});

test('Namenstage: feste Liste plausibel, Dienst und Bereich Kalender', async () => {
  const liste = require('../services/daten/namenstage.json');
  assert.equal(liste.format, 2);
  const alle = Object.entries(liste.tage);
  assert.ok(alle.length >= 360, String(alle.length));
  for (const [t, namen] of alle) {
    assert.match(t, /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
    namen.forEach(n => assert.match(n, /^\p{Lu}[\p{Ll}]+$/u, `${t} ${n}`));
  }
  const anker = { '03-19': 'Josef', '06-24': 'Johannes', '11-11': 'Martin', '12-06': 'Nikolaus', '04-23': 'Georg', '11-19': 'Elisabeth', '12-04': 'Barbara', '10-04': 'Franz', '06-29': 'Peter', '07-26': 'Anna' };
  for (const [t, n] of Object.entries(anker)) assert.ok(liste.tage[t].includes(n), `${n} am ${t}`);
  const tage = { '03-19': ['Josef'], '09-28': ['Wenzel', 'Lioba'] };
  // Dienst (rein)
  const na = dienste.byId.namenstage;
  const d = na.auswerten({ stand: '2026-09-01', tage }, '2026-09-27', 'josef');
  assert.deepEqual(d.woche[1], { datum: '2026-09-28', namen: ['Wenzel', 'Lioba'] });
  assert.equal(d.heute.namen.length, 0);
  assert.deepEqual(d.gesucht, { name: 'Josef', tage: ['03-19'], naechster: '2027-03-19' });
  assert.equal(na.auswerten({ tage }, '2026-09-27', 'Hänsel').gesucht.naechster, null);
  // Router: echte Liste
  const r = await rufe('namenstage', { name: 'josef' });
  assert.equal(r.code, 200);
  gueltig(r.body, na.schema);
  assert.deepEqual(r.body.hinweise, []);
  assert.ok(r.body.daten.gesucht.tage.includes('03-19') && r.body.daten.gesucht.tage.includes('05-01'));
  // Bereich Kalender
  const { kachel } = await esm('src/js/adapter/kalender.js');
  const jetzt = Date.parse('2026-09-28T10:00:00Z');
  const nEnv = { daten: na.auswerten({ stand: '2026-09-01', tage }, '2026-09-28') };
  const k = kachel(null, { daten: dienste.byId.himmel.berechne(51.05, 13.74, jetzt) }, jetzt, 'Europe/Berlin', nEnv);
  assert.match(k.x, /Namenstag: Wenzel, Lioba$/);
  assert.deepEqual(k.kleinReiter[0].liste.at(-1), { d: 'Namenstag', t: 'Wenzel, Lioba', tip: 'Namenstag heute: Wenzel, Lioba', gruppe: 2 });
  assert.equal(k.kleinReiter.at(-1).id, 'namen');
  assert.equal(k.kleinReiter.at(-1).kopf, '<b>Namenstage</b> <small>heute Wenzel, Lioba</small>');
  assert.deepEqual(k.kleinReiter.at(-1).liste.slice(0, 2).map(z => z.d), ['heute', 'morgen']);
});


test('Termine (privat): nur privat, Links nur per POST, Serien, ganztägig, abgesagt, Fehler je Kalender', async () => {
  const post = async (koerper, privat = true, kopf = { 'content-type': 'application/json', ...KENNWORT }) => {
    if (privat) process.env.DAILY_PRIVATE = '1'; else delete process.env.DAILY_PRIVATE;
    const r = { headers: {}, setHeader(k, v) { r.headers[k.toLowerCase()] = v; }, status(c) { r.code = c; return r; }, json(o) { r.body = o; } };
    await router({ method: 'POST', query: { dienst: 'termine' }, body: koerper, headers: kopf }, r);
    delete process.env.DAILY_PRIVATE;
    return r;
  };
  // öffentlich gesperrt; Links nie per GET
  assert.equal((await post({ urls: ['https://calendar.test/a.ics'] }, false)).body.fehler.code, 'nur_privat');
  process.env.DAILY_PRIVATE = '1';
  assert.equal((await rufe('termine', { urls: 'https://calendar.test/a.ics' }, 'GET', KENNWORT)).body.fehler.code, 'eingabe_ungueltig');
  delete process.env.DAILY_PRIVATE;
  // Kennwort (Review M2): ohne oder falsch → 401; Körper nur als JSON
  for (const kopf of [{ 'content-type': 'application/json' }, { 'content-type': 'application/json', 'x-daily-kennwort': 'falsch' }]) {
    const r = await post({}, true, kopf);
    assert.deepEqual([r.code, r.body.fehler.code], [401, 'nicht_berechtigt']);
  }
  assert.deepEqual((await post({}, true, { 'content-type': 'text/plain', ...KENNWORT })).code, 400);
  const ohneVariable = process.env.DAILY_PRIVAT_KENNWORT; delete process.env.DAILY_PRIVAT_KENNWORT;   // Variable fehlt → privat bleibt zu
  assert.equal((await post({})).code, 401);
  process.env.DAILY_PRIVAT_KENNWORT = ohneVariable;
  // sicher abrufen: interne Ziele (auch nach Auflösung) und zu viele Weiterleitungen werden abgelehnt
  const tm = dienste.byId.termine;
  assert.deepEqual(['10.1.2.3', '127.0.0.1', '169.254.169.254', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:192.168.1.1', '93.184.216.34', '2a00:1450::1'].map(tm.internAdresse),
    [true, true, true, true, true, true, true, true, false, false]);
  const aufl = tm.aufloesen;
  tm.aufloesen = async () => [{ address: '10.0.0.5', family: 4 }];
  const intern = await post({ urls: ['https://calendar.test/a.ics'] });
  assert.match(intern.body.daten.fehler[0].meldung, /internes Netz/);
  tm.aufloesen = aufl;
  const echt = global.fetch; let n = 0;
  global.fetch = async (url, o) => (String(url).includes('weiter.test') ? (n++, new Response('', { status: 302, headers: { location: 'https://weiter.test/' + n } })) : echt(url, o));
  try { assert.match((await post({ urls: ['https://weiter.test/0'] })).body.daten.fehler[0].meldung, /zu viele Weiterleitungen/); assert.equal(n, 4); }
  finally { global.fetch = echt; }
  // ohne Links: nicht verbunden
  const leer = await post({});
  assert.equal(leer.code, 200);
  assert.equal(leer.body.daten.verbunden, false);
  assert.equal(leer.headers['cache-control'], 'private, no-store');
  // mit Link (Beispielkalender) und einem ungültigen/abgelehnten
  const r = await post({ urls: ['https://calendar.test/a.ics', 'http://unsicher.test/x.ics', 'https://10.0.0.1/intern.ics'] });
  assert.equal(r.code, 200);
  gueltig(r.body, dienste.byId.termine.schema);
  const t = r.body.daten.termine.map(x => x.titel);
  assert.ok(t.includes('Geburtstag Anna') && t.includes('Wochenplanung'));
  assert.equal(t.filter(x => x === 'Wochenplanung').length, 2);                   // Serie wöchentlich, 14 Tage → 2 Termine
  assert.ok(r.body.daten.termine.find(x => x.titel === 'Geburtstag Anna').ganztag);
  assert.deepEqual(dienste.byId.termine.links(['webcal://x.test/a.ics', 'http://x.test', 'https://localhost/a', 'x']), ['https://x.test/a.ics']);
  // abgesagt und keine Kalenderdatei
  const heute = new Date().toISOString().slice(0, 10), rahmen = { von: Date.now() - 864e5, bis: Date.now() + 3 * 864e5, heute };
  const ics = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:x', 'STATUS:CANCELLED', `DTSTART:${heute.replace(/-/g, '')}T230000Z`, 'SUMMARY:Abgesagt', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  assert.deepEqual(dienste.byId.termine.auswerten(ics, rahmen), []);
  assert.throws(() => dienste.byId.termine.auswerten('<html>', rahmen), /keine Kalenderdatei/);
});

test('Einstellungen: Formular, Wetter-Optionen', async () => {
  // Formular je Bereich (rein)
  const ke = await esm('src/js/core/einstellungen.js');
  ke.kachelEinstellungen('probe', { felder: () => [{ typ: 'titel', label: 'Anzeigen' }, { typ: 'check', key: 'a', label: 'A <b>', wert: true },
    { typ: 'select', key: 's', label: 'S', wert: '7', optionen: [['16', '16 Tage'], ['7', '7 Tage']] }, { typ: 'text', key: 't', label: 'T', wert: 'x"y' }], speichern() {} });
  const html = ke.formular('probe');
  assert.equal(ke.formular('gibtsnicht'), '');
  assert.match(html, /<form class="ke" data-ke="probe">.*type="checkbox" name="a" checked> A &lt;b&gt;.*<option value="7" selected>.*value="x&quot;y"/s);
  assert.doesNotMatch(html, /Speichern|type="submit"/);                              // kein Knopf – Änderungen gelten sofort
  // Wetter: Reiter aus, Start-Reiter, Mini-Diagramm 7 Tage; Unwetter bleibt vorn
  const { kachel, mitOptionen } = await esm('src/js/adapter/wetter.js');
  const w = await mitName((await rufe('wetter', BERLIN)).body), r = (await rufe('regen', BERLIN)).body;
  // Jetzt hat die Themen Heute · 3 Tage · 7 Tage · 15 Tage (Ebene 3); C = Diagramm des Start-Themas (zuletzt gewählter Zeitraum)
  const J = k => k.kleinReiter.find(x => x.id === 'jetzt'), C = k => J(k).teile.find(t => t.id === J(k).startTeil).unten;
  const k = mitOptionen(kachel(w, r, null), w, { radar: false, mini: 7 });
  assert.deepEqual(k.kleinReiter.map(x => x.id), ['jetzt', 'mehr']);
  assert.equal(k.startReiter, 'jetzt');
  assert.match(C(k), /7 Tage: /);
  assert.equal(k.chart, '');                                                             // nicht mehr im Kopf der Kachel
  assert.deepEqual(mitOptionen(kachel(w, r, null), w, { mehr: false }).kleinReiter.map(x => x.id), ['jetzt', 'radar']);
  assert.deepEqual(J(k).teile.map(t => [t.id, t.name]), [['m1', 'Heute'], ['m3', '3 Tage'], ['m7', '7 Tage'], ['m15', '15 Tage']]);
  assert.equal(J(k).startTeil, 'm7');
  assert.ok(J(k).teile.every(t => t.html === J(k).html && /wd-minibox/.test(t.unten)));             // je Zeitraum Zeitpunkt-Block und Diagramm
  // Standard: Mini-Diagramm Heute (0–24 Uhr; Temperatur + Regen mm, Deckkraft nach Wahrscheinlichkeit)
  const k24 = mitOptionen(kachel(w, r, null), w, {});
  assert.equal(J(k24).startTeil, 'm1');
  assert.match(C(k24), /<b class="wd-t-regen"[^>]*>Regen mm<\/b> · <b class="wd-t-max" title="Temperatur je Stunde, heute 0 bis 24 Uhr">Temperatur<\/b>/);
  assert.equal((C(k24).match(/class="wd-spalte"/g) || []).length, w.daten.heute.length);
  assert.match(C(k24), /wd-marken"><span[^>]*>3<\/span><span[^>]*>6<\/span>.*>21<\/span><\/div>/);   // 0–24 Uhr, alle 3 Std.
  assert.equal(C(mitOptionen(kachel(w, r, null), w, { mini: 24 })), C(k24));          // früher „24 Std.“ → Heute
  // Kopfzeile klein: Wind heute (Höchstwert und Böen)
  assert.match(k24.kopf, /<span class="wd-wind" title="Wind heute: bis 18 km\/h aus W, Böen bis 38 km\/h">· Wind 18\/38 km\/h<\/span>/);
  const z24 = JSON.parse(C(k24).match(/data-zp="([^"]*)"/)[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  assert.deepEqual(Object.keys(z24), ['z', 't', 'g', 'i', 'l', 'mm', 'p', 'w', 's']);   // gleiche Felder wie beim Tag
  assert.match(z24.z, /^(Mo|Di|Mi|Do|Fr|Sa|So) \d{1,2} Uhr$/);
  assert.match(z24.w, /^Wind \d+ km\/h$/);
  // Kopfzeile klein: ohne aktuelle Temperatur, „heute“ vor Tiefst/Höchst; Zeitpunkt-Block „Jetzt“ mit denselben Feldern
  const kk = mitOptionen(kachel(w, r, null), w, {});
  assert.match(kk.kopf, /^Berlin · heute <span class="wd-tm"/);
  assert.match(kk.kleinReiter[0].html, /data-jetzt="\{&quot;z&quot;:&quot;Jetzt&quot;/);   // Zeitpunkt-Block „Jetzt“ unter „Jetzt“
  assert.match(kk.kopf, /class="wh-badge wd-radar" title="Regenradar: Regen in 20 Min\. \(leicht\)\.">☂ in 20 Min\. \(leicht\)<\/span>/);
  assert.doesNotMatch(C(k24), /wd-sonnen/);                                        // Sonne nur bei Tagen
  // 3 Tage: 12 Tageszeiten, Wochentag mittig je Tag, jeder zweite Tag hinterlegt, Sonne je Tageszeit; früher „48 Std.“ → 3 Tage
  const k48 = mitOptionen(kachel(w, r, null), w, { mini: 48 });
  assert.equal(J(k48).startTeil, 'm3');
  assert.equal((C(k48).match(/class="wd-spalte"/g) || []).length, 12);
  assert.equal((C(k48).match(/wd-streifen/g) || []).length, 1);
  assert.match(C(k48), /wd-marken">(<span style="left:(16\.7|50\.0|83\.3)%">(Mo|Di|Mi|Do|Fr|Sa|So)<\/span>){3}<\/div>/);
  assert.match(C(k48), /<div class="wd-sonnen wd-t-sonne">(<span class="(wd-s2)?" style="left:[\d.]+%">\d+<\/span>){12}<\/div>/);
  const z3 = JSON.parse(C(k48).match(/data-zp="([^"]*)"/)[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  assert.deepEqual(Object.keys(z3), ['z', 't', 'g', 'i', 'l', 'mm', 'p', 'w', 's']);
  assert.match(z3.z, /^(Mo|Di|Mi|Do|Fr|Sa|So) Morgen$/);
  // Zeitpunkt-Block: Schirm vor Regenmenge und -wahrscheinlichkeit, auch bei 0 (nicht durchgestrichen)
  globalThis.document ||= { addEventListener() {} };
  const { zpHtml } = await esm('src/js/ansichten/wetter.js');
  const zr = (mm, p) => zpHtml({ z: 'Jetzt', t: '1°', g: '', i: 'rain', l: 'Regen', mm, p, w: '', s: '' }).match(/<span class="zp-r">.*<\/span>/)[0];
  assert.match(zr('0 mm', '0 %'), /<span class="zp-mm"><i class="zp-schirm"[^>]*>☂<\/i> 0 mm<\/span><span class="zp-p"><i class="zp-schirm"[^>]*>☂<\/i> 0 %<\/span>/);
  assert.doesNotMatch(zr('0 mm', '0 %'), /zp-kein/);
  assert.match(zr('0,4 mm', ''), /<span class="zp-p"><\/span>/);                    // ohne Wahrscheinlichkeit kein Schirm
  // Ältere Antwort ohne heute/tageszeiten → 15 Tage wie bisher
  const alt = { ...w, daten: { ...w.daten, heute: undefined, tageszeiten: undefined } };
  assert.equal(C(mitOptionen(kachel(alt, r, null), alt, { mini: 3 })), kachel(alt, r, null).chart);
  assert.doesNotMatch(C(k24), />jetzt</);
  const { miniHeute } = await esm('src/js/adapter/diagramm.js');
  const probe = Array.from({ length: 24 }, (_, i) => ({ zeit: new Date(Date.UTC(2026, 8, 28, i)).toISOString(), tempC: 10 + i % 5, regenProzent: i === 3 ? 80 : i === 4 ? 40 : 0, niederschlagMm: i === 3 ? 2 : 0.2 }));
  const m = miniHeute(probe, iso => new Date(iso).getUTCHours());
  const balken = m.match(/<rect class="wd-regen"[^>]*>/g) || [];
  assert.equal(balken.length, 24);                                                   // jede Stunde ab 0,1 mm – egal wie wahrscheinlich
  assert.match(balken[3], /height="32" rx="1" fill-opacity="0.84"/);                 // 2 mm = oberste Linie (Skala 5–15°, 1 mm je Linie), 80 % → kräftig
  assert.match(balken[0], /fill-opacity="0.2"/);                                     // 0 % → ganz blass
  assert.equal((m.match(/wd-streifen/g) || []).length, 12);                          // jede zweite Stunde getönt
  assert.match(m, />3<\/span>.*>6<\/span>.*>9<\/span>.*>12<\/span>/s);              // Stunden alle 3 Std.
  assert.doesNotMatch(m, />jetzt</);
  assert.match(m, />5°<\/span><span class="wd-gi"[^>]*>10°<\/span><span class="wd-g5"[^>]*>15°</);   // 10–14° → Skala 5–15°
  assert.equal((m.match(/<line class="wd-gitter/g) || []).length, 3);                // 5°, 10°, 15° – gemeinsam für Temperatur und Regen
  assert.match(m, /wd-t-regen"><div class="wd-sk"><span[^>]*>0<\/span><span[^>]*>1<\/span><span[^>]*>2 mm<\/span>/);
  const { mmStufe, deckkraft } = await esm('src/js/adapter/diagramm.js');
  assert.deepEqual([mmStufe(0.3, 2, 4), mmStufe(3, 2, 4), mmStufe(12, 10, 6), mmStufe(34, 10, 4), mmStufe(0, 2, 2)], [0.5, 1, 2, 10, 1]);
  assert.deepEqual([deckkraft(0), deckkraft(100), deckkraft(null)], [0.2, 1, 0.6]);
  assert.equal(C(mitOptionen(kachel(w, r, null), w, { mini: 16 })), kachel(w, r, null).chart);
  const u = { daten: { gebiet: 'X', hoechsteStufe: 3, hinweise: [{ art: 'wind', stufe: 3, stufeName: 'unwetter', ereignis: 'ORKANBÖEN', titel: 'T', beginn: null, ende: null, aktiv: true, beschreibung: '', empfehlung: '', tipp: 't' }] } };
  const ku = mitOptionen(kachel(w, r, u), w, { hinweise: false, mehr: false });
  assert.deepEqual(ku.kleinReiter.map(x => x.id), ['jetzt', 'radar', 'hinweise']);        // Hinweise bei Warnung nicht abwählbar
  assert.equal(ku.unwetter, 'ORKANBÖEN|');
});

test('Finanzen: EZB-Kurse, Leitzinsen, Inflation; Kurse (Yahoo) nur privat; runde Diagrammlinie', async () => {
  const f = require('../services/finanzen');
  // Kursdatei: neuester Tag zuerst → aufsteigend, fehlende Kurse null
  const roh = f.kurseAus('<Cube><Cube time="2026-09-28"><Cube currency="USD" rate="1.14"/><Cube currency="XYZ" rate="2"/></Cube><Cube time="2026-09-25"><Cube currency="USD" rate="1.12"/></Cube></Cube>');
  assert.deepEqual(roh.tage, ['2026-09-25', '2026-09-28']);
  assert.deepEqual(roh.kurse.XYZ, [null, 2]);
  const usd = f.waehrungenAus(roh)[0];
  assert.deepEqual([usd.code, usd.name, usd.zeichen, usd.kurs, usd.vortag, usd.aenderungProzent, usd.tief90, usd.hoch90], ['USD', 'US-Dollar', '$', 1.14, 1.12, 1.79, 1.12, 1.14]);
  assert.equal(f.waehrungenAus(roh)[1].zeichen, 'XYZ');                            // unbekannte Währung behält ihren Code
  // SDMX-CSV mit Anführungszeichen; Leitzins mit Änderungsdatum, ohne (Tagesreihe) nur Satz
  assert.deepEqual(f.csvAus('KEY,TIME_PERIOD,OBS_VALUE,T\nA,2026-01,1.5,"x, y"')[0], { KEY: 'A', TIME_PERIOD: '2026-01', OBS_VALUE: '1.5', T: 'x, y' });
  const z = f.zinsenAus(require('../tools/fixtures').ezbZinsen());
  assert.deepEqual(z[0], { art: 'einlagen', name: 'Einlagesatz', satzProzent: 2, seit: '2025-06-11', vorherProzent: 2.5 });
  assert.equal(f.zinsenAus(require('../tools/fixtures').ezbZinsen(), false)[0].seit, null);
  assert.throws(() => f.csvAus('<html>Fehler</html>'), /Format/);
  // Router: öffentlich, gültiger Vertrag, für alle gleich (keine Eingabe)
  const r = await rufe('finanzen');
  assert.equal(r.code || 200, 200);
  gueltig(r.body, f.schema);
  const d = r.body.daten;
  assert.equal(d.basis, 'EUR');
  assert.equal(d.waehrungen[0].code, 'USD');
  assert.equal(d.waehrungen[0].verlauf.length, d.tage.length);
  assert.deepEqual(d.inflation.map(i => [i.gebiet, i.monat, i.rateProzent]), [['DE', '2026-08', 2.1], ['U2', '2026-08', 2.2]]);
  assert.match(r.headers['cache-control'], /s-maxage=\d+/);
  // Kurse: öffentlich gesperrt, privat da
  delete process.env.DAILY_PRIVATE;
  assert.equal((await rufe('kurse', {}, 'GET', KENNWORT)).body.fehler.code, 'nur_privat');
  process.env.DAILY_PRIVATE = '1';
  assert.equal((await rufe('kurse')).body.fehler.code, 'nicht_berechtigt');           // privat, aber ohne Kennwort
  const k = await rufe('kurse', {}, 'GET', KENNWORT);
  delete process.env.DAILY_PRIVATE;
  gueltig(k.body, require('../services/kurse').schema);
  assert.deepEqual(k.body.daten.werte.map(x => x.id), ['dax', 'sp500', 'world', 'btc', 'eth', 'gold']);
  assert.equal(k.body.daten.werte[0].aenderungProzent, 0.42);
  const { pfadRund } = await esm('src/js/adapter/diagramm.js');
  // runde Linie: Kurvensegmente, Endpunkte exakt, kein Überschwingen über den Höchstwert
  const rund = pfadRund([[0, 10], [10, 0], [20, 10], [30, 5]]);
  assert.match(rund, /^M0\.0,10\.0C.*20\.0,10\.0C.*30\.0,5\.0$/);
  assert.ok(rund.match(/-?[\d.]+/g).map(Number).filter((v, i) => i % 2 === 1).every(v => v >= 0 && v <= 10));
});

test('Tanken: Vertrag, alle Sorten mit einem Abruf, Günstigste/Durchschnitt, Schlüssel und Land', async () => {
  const w = dienste.byId.tanken;
  const d = w.umwandeln(fx.tanken(), 5);
  assert.deepEqual(pruefeStreng(d, w.schema), []);
  assert.deepEqual([d.anzahl, d.anzahlOffen], [5, 4]);
  assert.deepEqual(d.stationen.map(s => s.id), ['s2', 's4', 's3', 's1', 's5']);                  // nach Entfernung
  assert.deepEqual(d.guenstigste.e10, { id: 's2', preis: 1.689, entfernungKm: 0.9 });            // Gleichstand mit s5 → die nähere
  assert.equal(d.guenstigste.diesel.id, 's5');                                                   // JET (1,49⁹) ist geschlossen
  assert.deepEqual([d.stationen[1].preise.e5, d.stationen[1].preise.diesel, d.stationen[0].marke, d.stationen[0].plz], [null, null, null, '01069']);   // false/null → null, ohne Marke → null
  assert.equal(d.durchschnitt.e10, 1.714);
  // Router: ohne Schlüssel schluessel_fehlt; mit Schlüssel gültiger Rahmen, Takt 5 Minuten; Ausland nicht unterstützt
  const alt = process.env.TANKERKOENIG_API_KEY;
  delete process.env.TANKERKOENIG_API_KEY;
  const ohne = await rufe('tanken', { lat: '51.05', lon: '13.74' });
  assert.deepEqual([ohne.code, ohne.body.fehler.code], [503, 'schluessel_fehlt']);
  process.env.TANKERKOENIG_API_KEY = 'test';
  const r = await rufe('tanken', { lat: '51.05', lon: '13.74', umkreis: '10' });
  assert.equal(r.code, 200);
  gueltig(r.body, w.schema);
  assert.equal(r.body.daten.umkreisKm, 10);
  assert.equal(Date.parse(r.body.gueltigBis) % 300e3, 0);
  assert.equal((await rufe('tanken', { lat: '51.05', lon: '13.74', umkreis: '7' })).body.fehler.code, 'eingabe_ungueltig');   // nur 2, 5, 10
  assert.equal((await rufe('tanken', { lat: '51.05', lon: '13.74' })).body.daten.umkreisKm, 5);
  assert.equal((await rufe('tanken', { lat: '48.2', lon: '16.37' })).body.fehler.code, 'nicht_unterstuetzt');   // Wien: außerhalb Deutschlands
  if (alt === undefined) delete process.env.TANKERKOENIG_API_KEY; else process.env.TANKERKOENIG_API_KEY = alt;
});

test('Autobahn: Vertrag, Arten, Zeiten aus dem Text, Eingaben, fehlende Autobahn', async () => {
  const w = dienste.byId.autobahn;
  // Eingabe: Schreibweise egal, sortiert, ohne Doppelte; Bundesstraßen ungültig
  assert.deepEqual(w.strassenAus('a13, A 4;a4'), ['A4', 'A13']);
  assert.deepEqual(w.strassenAus('A04 A7'), ['A4', 'A7']);
  assert.equal(w.strassenAus('B96'), null);
  // Ortszeit → UTC, Sommer- und Winterzeit
  assert.equal(w.berlin('25', '08', '26', '09', '00'), '2026-08-25T07:00:00Z');
  assert.equal(w.berlin('01', '12', '26', '15', '00'), '2026-12-01T14:00:00Z');
  const t = w.ausText(['Die Baustelle ist zu folgenden Zeiträumen gültig:', '12.10.26 21:00 bis zum 13.10.26 05:00 Uhr.', '26.10.26 21:00 bis zum 27.10.26 05:00 Uhr.', 'Länge: 3.85 km | Max. 80 km/h']);
  assert.deepEqual(t.zeitraeume, [{ beginn: '2026-10-12T19:00:00Z', ende: '2026-10-13T03:00:00Z' }, { beginn: '2026-10-26T20:00:00Z', ende: '2026-10-27T04:00:00Z' }]);
  assert.deepEqual([t.laengeKm, t.tempoKmh, t.beginn, t.ende], [3.9, 80, null, null]);
  // Umwandlung einer Autobahn
  const q = { warning: fx.autobahn('x/autobahn/A4/services/warning'), closure: fx.autobahn('x/autobahn/A4/services/closure'), roadworks: fx.autobahn('x/autobahn/A4/services/roadworks') };
  const ms = w.umwandeln(q, 'A4');
  assert.deepEqual(pruefeStreng({ strassen: ['A4'], fehlend: [], meldungen: ms }, w.schema), []);
  assert.deepEqual(ms.map(m => m.typ), ['stau', 'stau', 'meldung', 'anschlusssperrung', 'sperrung', 'tagesbaustelle', 'baustelle', 'baustelle']);
  const stau = ms[0];
  assert.deepEqual([stau.von, stau.bis, stau.richtung.nach, stau.lage, stau.verzoegerungMin, stau.tempoKmh, stau.anbieter], ['Wilsdruff', 'Nossen', 'Chemnitz', 'stockend', 14, 25, 'inrix']);
  const aachen = ms.find(m => m.von === 'Aachen-Laurensberg');
  assert.deepEqual([aachen.beginn, aachen.ende, aachen.laengeKm, aachen.tempoKmh, aachen.lat2], ['2026-08-25T07:00:00Z', '2026-12-01T14:00:00Z', 3.9, 80, 50.8037]);
  const nacht = ms.find(m => m.typ === 'sperrung');
  assert.deepEqual([nacht.kuenftig, nacht.zeitraeume.length, nacht.beginn === nacht.zeitraeume[0].beginn, nacht.ende === nacht.zeitraeume[1].ende], [true, 2, true, true]);
  const as = ms.find(m => m.typ === 'anschlusssperrung');
  assert.deepEqual([as.von, as.bis, as.gesperrt], ['Dresden-Altstadt', null, true]);
  assert.ok(ms.every(m => !m.text.includes('')));                                                       // ohne Leerzeilen
  // Router: sortiert, Takt 5 Minuten, Fehler
  w.JE_STRASSE.clear();
  assert.equal((await rufe('autobahn', { strassen: 'A13,A4' })).body.fehler.code, 'eingabe_ungueltig');   // nur aufsteigend
  assert.equal((await rufe('autobahn', { strassen: 'a4,A13' })).body.fehler.code, 'eingabe_ungueltig');
  const r = await rufe('autobahn', { strassen: 'A4,A13' });
  assert.equal(r.code, 200);
  gueltig(r.body, w.schema);
  assert.deepEqual([r.body.daten.strassen, r.body.ort, r.body.daten.meldungen.at(-1).strasse], [['A4', 'A13'], null, 'A13']);
  assert.equal(Date.parse(r.body.gueltigBis) % 300e3, 0);
  assert.deepEqual((await rufe('autobahn', { strassen: 'A4,A999' })).body.daten.fehlend, ['A999']);
  assert.deepEqual([(await rufe('autobahn', {})).body.fehler.code, (await rufe('autobahn', { strassen: 'B96' })).body.fehler.code,
    (await rufe('autobahn', { strassen: 'A1,A2,A3,A4,A5,A6' })).body.fehler.code, (await rufe('autobahn', { strassen: 'A999' })).code],
    ['eingabe_fehlt', 'eingabe_ungueltig', 'eingabe_ungueltig', 502]);
});

test('Radarraster: Umrechnung wie Bright Sky und DWD, Kacheln der Karte nur über Deutschland', async () => {
  const { zuRaster, zuGrad } = require('../services/_lib/radolan');
  const nah = (a, b, tol = 0.02) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
  // Positionen, die Bright Sky meldet (bbox-Ecke + latlon_position, abgefragt 29.09.2026)
  const dd = zuRaster(51.05, 13.74), nord = zuRaster(54, 8);
  assert.ok(nah([dd.x, dd.y], [815 + 3.26, 582 + 3.323]), JSON.stringify(dd));
  assert.ok(nah([nord.x, nord.y], [405 + 2.948, 247 + 3.427]), JSON.stringify(nord));
  // Eckpunkte des DWD-Rasters DE1200 (WGS84): äußere Kanten bei −0,5 und 1099,5 / 1199,5
  const ecke = (lat, lon) => { const g = zuRaster(lat, lon); return [g.x, g.y]; };
  assert.ok(nah(ecke(55.86208711, 1.463301510), [-0.5, -0.5]));
  assert.ok(nah(ecke(45.68460578, 16.58086935), [1099.5, 1199.5]));
  // hin und zurück
  const g = zuGrad(dd.x, dd.y);
  assert.ok(Math.abs(g.lat - 51.05) < 1e-6 && Math.abs(g.lon - 13.74) < 1e-6);
  // Kacheln: nur Zoom 8–11 und über Deutschland; Antwort als Bild mit 30 Tagen Cache
  const karte = require('../api/karte.js');
  const x = karte.kachelX(13.74, 9), y = karte.kachelY(51.05, 9);
  assert.deepEqual([x, y], [275, 171]);
  assert.deepEqual([karte.erlaubt(9, x, y), karte.erlaubt(12, x, y), karte.erlaubt(9, 1, 1), karte.erlaubt(9, x + 0.5, y)], [true, false, false, false]);
  const rufeKarte = q => new Promise(ok => { const res = { h: {}, setHeader(k, v) { this.h[k.toLowerCase()] = v; }, end(b) { ok({ code: this.statusCode, h: this.h, b }); } }; karte({ method: 'GET', query: q }, res); });
  const r = await rufeKarte({ z: '9', x: String(x), y: String(y) });
  assert.deepEqual([r.code, r.h['content-type'], r.b.slice(1, 4).toString()], [200, 'image/png', 'PNG']);
  assert.match(r.h['cache-control'], /s-maxage=2592000/);
  const falsch = await rufeKarte({ z: '9', x: '1', y: 'abc' });
  assert.deepEqual([falsch.code, falsch.h['cache-control']], [400, 'no-store']);
  // Adapter: Radar liegt passend auf der Karte – Ort (Mitte) und Ecken im selben Maßstab
  const { merc } = await esm('src/js/adapter/regen.js');
  const m = merc(51.05, 13.74);
  assert.deepEqual([Math.floor(m.x / 256), Math.floor(m.y / 256)], [x, y]);
});

test('Meine Seiten: feste Seiten-Auswahl, Mini-Reiter mit Symbolraster, Einstellungen, Seitensymbole nur für die Auswahl', async () => {
  const katalog = require('../src/content/seiten.json');
  const ids = katalog.kategorien.flatMap(k => k.seiten.map(s => s.id));
  assert.equal(new Set(ids).size, ids.length);                                               // Kennungen eindeutig
  assert.ok(katalog.kategorien.flatMap(k => k.seiten).every(s => /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|$)/.test(s.url)), 'nur https');
  assert.deepEqual(katalog.standard, ['news', 'social', 'mail']);
  const a = await esm('src/js/adapter/seiten.js');
  const links = [{ id: 'l1', name: 'Tagesschau', url: 'https://www.tagesschau.de' }, { id: 'l2', name: 'Gmail', url: 'https://mail.google.com' }, { id: 'l9', name: 'Sächsische', url: 'https://www.saechsische.de/' }];
  const k = a.kachel(links, katalog, {});
  assert.deepEqual(k.kleinReiter.map(r => r.id), ['meine', 'news', 'social', 'mail']);         // Standard
  assert.ok(k.kleinReiter.every(r => /^<svg class="ico"/.test(r.icon)));
  const meine = k.kleinReiter[0].html;
  assert.equal((meine.match(/class="ms-z kr-z"/g) || []).length, 3);
  assert.match(meine, /href="https:\/\/www\.tagesschau\.de" target="_blank" rel="noopener noreferrer" title="Tagesschau · tagesschau\.de"><span class="ms-sym" style="--ms-h:\d+"><b>T<\/b><img class="ms-bild" src="\/api\/icon\?s=tagesschau"/);
  assert.match(meine, /title="Sächsische · saechsische\.de"><span class="ms-sym" style="--ms-h:\d+"><b>S<\/b><\/span>/);   // eigene Seite: nur Buchstabe
  assert.equal((k.kleinReiter[1].html.match(/ms-bild/g) || []).length, 10);                  // News: 10 Seiten mit Symbol
  assert.deepEqual(a.kachel(links, katalog, { kategorien: ['video', 'news', 'reisen', 'wissen', 'shopping'] }).kleinReiter.map(r => r.id), ['meine', 'news', 'video', 'shopping', 'wissen']);   // höchstens 4, Reihenfolge der Datei
  assert.match(a.kachel([], katalog, {}).kleinReiter[0].html, /Noch keine eigenen Seiten/);
  assert.equal(a.kachel(links, null, {}).kleinReiter.length, 1);                              // Auswahl noch nicht geladen
  // Einstellungsfenster
  const f = a.felder(links, katalog, {});
  assert.deepEqual(f.filter(x => x.key && x.key.startsWith('r_') && x.wert).map(x => x.key), ['r_news', 'r_social', 'r_mail']);
  assert.deepEqual(f.filter(x => x.key && x.key.startsWith('m_') && x.wert).map(x => x.key), ['m_tagesschau', 'm_gmail']);
  assert.equal(f.find(x => x.key === 'eigene').wert, 'Sächsische | https://www.saechsische.de/');
  // Speichern: Spiegel dazu, Gmail weg, eigene Seite geändert und eine neue; Reihenfolge der Auswahl bleibt
  const w = { r_news: true, r_video: true, m_tagesschau: true, m_spiegel: true, eigene: 'Sächsische Zeitung | saechsische.de\nDresden | dresden.de\nkaputt | ::\nzdf.de' };
  const r = a.ausEinstellung(w, links, katalog);
  assert.deepEqual(r.links.map(l => l.name), ['Tagesschau', 'Sächsische Zeitung', 'Spiegel', 'ZDF', 'Dresden']);   // ZDF als eigene Zeile → Seite aus der Auswahl
  assert.deepEqual(r.kategorien, ['news', 'video']);
  assert.equal(r.zuviel, false);
  assert.equal(a.ausEinstellung({ r_news: 1, r_social: 1, r_mail: 1, r_video: 1, r_shopping: 1 }, links, katalog).zuviel, true);
  assert.deepEqual(a.eigeneAus('a | javascript:alert(1)\nb | http://x.de'), [{ name: 'b', url: 'http://x.de/' }]);   // nur http(s)
  // Seitensymbole: nur Kennungen aus der Auswahl, Bild mit 30 Tagen Cache; Symbol-Angaben aus dem HTML
  const icon = require('../api/icon.js');
  const ruf = q => new Promise(ok => { const res = { h: {}, setHeader(k2, v) { this.h[k2.toLowerCase()] = v; }, end(b) { ok({ code: this.statusCode, h: this.h, b }); } }; icon({ method: 'GET', query: q }, res); });
  const ok = await ruf({ s: 'spiegel' });
  assert.deepEqual([ok.code, ok.h['content-type'], ok.b.slice(1, 4).toString()], [200, 'image/png', 'PNG']);
  assert.match(ok.h['cache-control'], /s-maxage=2592000/);
  assert.equal((await ruf({ s: 'https://evil.example' })).code, 400);                        // keine beliebigen Adressen
  // Sicherheit (Review M1): eigene strenge Sicherheitsregel; Typ am Inhalt erkannt – SVG/HTML nie als Bild
  assert.equal(ok.h['content-security-policy'], "default-src 'none'; sandbox");
  assert.deepEqual([Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), Buffer.from('<!doctype html><html>…</html>'),
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]), Buffer.from('GIF89a......'), Buffer.from([0, 0, 1, 0, 1, 0, 16, 16, 0, 0, 0, 0]), Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')])].map(icon.bildTyp),
    [null, null, 'image/jpeg', 'image/gif', 'image/x-icon', 'image/webp']);
  const echt = global.fetch;
  global.fetch = async (url, o) => (/apple-touch-icon|favicon/.test(String(url)) ? new Response('<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>', { status: 200, headers: { 'content-type': 'image/svg+xml' } })
    : /zeit\.de\/?$/.test(String(url)) ? new Response('<html><head></head></html>', { status: 200, headers: { 'content-type': 'text/html' } }) : echt(url, o));
  try { const svg = await ruf({ s: 'zeit' }); assert.equal(svg.code, 404); }                  // nur SVG → kein Symbol (Buchstabe)
  finally { global.fetch = echt; }
  assert.deepEqual(icon.symboleAusHtml('<link rel="icon" href="/f.ico"><link rel="apple-touch-icon" sizes="152x152" href="/a152.png"><link rel="apple-touch-icon" href="https://cdn.x.de/a.png">', 'https://www.x.de/').map(x => x.url),
    ['https://cdn.x.de/a.png', 'https://www.x.de/a152.png', 'https://www.x.de/f.ico']);
});

test('Tagesinhalte: Dienst je Tag (Verlauf, nie Zukunft), Bereich „Heute“ mit Blättern, Lösung, Merken', async () => {
  const d = dienste.byId.tagesinhalt;
  for (const tag of d.VORRAT.tage) assert.deepEqual(pruefeStreng(d.umwandeln(tag, tag.datum, { heute: tag.datum, erster: d.VORRAT.von, wiederholt: false }), d.schema), [], tag.datum);   // ganzer Vorrat erfüllt den Vertrag
  // Rätsel zum Mitmachen (Dienst 1.2.0): jede Antwort eindeutig – genau 3 falsche, keine doppelt, keine gleich der richtigen; höchstens 2 Tipps,
  // kein Tipp nennt die Antwort; die kurze Antwort passt zur ausführlichen Lösung
  const ohneArtikel = x => x.toLowerCase().replace(/^(der|die|das|ein|eine|einen|dein|deine) /, '').replace(/^(buchstabe|zahl) /, '');
  for (const { datum, raetsel: r } of d.VORRAT.tage) {
    assert.ok(r.antwort && r.antwort.length <= 24, datum + ' Antwort kurz');
    assert.equal(r.falsch.length, 3, datum);
    const alle = [r.antwort, ...r.falsch].map(x => x.toLowerCase());
    assert.equal(new Set(alle).size, 4, datum + ' Antworten verschieden');
    assert.ok(r.tipps.length <= 2, datum);
    const wort = new RegExp(`(^|[^\\p{L}\\d])${ohneArtikel(r.antwort).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\d])`, 'u');   // ganzes Wort
    for (const t of r.tipps) assert.ok(!wort.test(t.toLowerCase()), `${datum} Tipp verrät „${r.antwort}“: ${t}`);
    assert.ok(r.loesung.toLowerCase().includes(ohneArtikel(r.antwort)) || r.antwort === 'Beide gleich schwer', `${datum} Antwort passt zur Lösung`);
  }
  const jetzt = Date.parse('2026-10-01T10:00:00Z');
  const heute = await dienste.ausfuehren('tagesinhalt', {}, { jetzt });
  gueltig(heute, d.schema);
  assert.deepEqual([heute.daten.datum, heute.daten.heute, heute.daten.erster, heute.daten.wiederholt], ['2026-10-01', '2026-10-01', '2026-09-26', false]);
  assert.equal(heute.daten.inhalt.raetsel.frage, d.VORRAT.tage.find(t => t.datum === '2026-10-01').raetsel.frage);
  assert.equal((await dienste.ausfuehren('tagesinhalt', { datum: '2026-09-27' }, { jetzt })).daten.datum, '2026-09-27');   // vergangener Tag
  for (const [x, code] of [['2026-10-02', 'eingabe_ungueltig'], ['2026-09-25', 'eingabe_ungueltig'], ['gestern', 'eingabe_ungueltig']])
    await assert.rejects(dienste.ausfuehren('tagesinhalt', { datum: x }, { jetzt }), e => e.code === code, x);
  const spaet = await dienste.ausfuehren('tagesinhalt', { datum: '2026-11-15' }, { jetzt: Date.parse('2026-11-15T10:00:00Z') });
  assert.equal(spaet.daten.wiederholt, true);                                                 // nach dem Vorrat im Kreis
  const r = await rufe('tagesinhalt', { datum: '2026-09-28' });
  assert.equal(r.code, 200);
  // Adapter: Bereich „Heute“
  const a = await esm('src/js/adapter/tagesinhalt.js');
  assert.deepEqual([a.datumText('2026-10-01'), a.datumText('2026-10-01', true), a.tagPlus('2026-10-01', -1), a.tagPlus('2026-09-30', 1)], ['Do 1.10.', '1.10.', '2026-09-30', '2026-10-01']);
  const h = a.heuteBereich(heute, {});
  assert.match(h.bereichKopf, /data-ti="zurueck"[^>]*>‹<\/button><button type="button" data-ti="vor"[^>]* disabled>›/);   // heute: nicht weiter vor
  const rae = h.kleinReiter[0].html;
  assert.match(rae, /data-ti="fav" data-art="raetsel" aria-pressed="false">☆ Merken</);
  assert.equal((rae.match(/data-ti="antwort"/g) || []).length, 4);                                    // Rätsel zum Mitmachen (Details: daily.test.js)
  assert.doesNotMatch(rae, /ab-loesung|data-ti="loesung"/);
  const erster = await dienste.ausfuehren('tagesinhalt', { datum: '2026-09-26' }, { jetzt });
  assert.match(a.heuteBereich(erster, {}).bereichKopf, /data-ti="zurueck"[^>]* disabled>‹/);   // erster Tag: nicht weiter zurück
  // Gemerkt: Kopie, neueste zuerst, Zeile öffnet den Tag; Knopf zeigt „★ Gemerkt“
  const fav = [a.favEintrag('witz', erster), a.favEintrag('film', heute), { art: 'rezept', datum: '2026-09-30', kurz: 'x', text: 'x' }];
  assert.deepEqual(Object.keys(fav[0]), ['art', 'datum', 'kurz', 'text']);
  const fl = a.gemerktReiter(fav).liste;
  assert.deepEqual(fl.map(z => z.aktion), ['fav:film|2026-10-01', 'fav:rezept|2026-09-30', 'fav:witz|2026-09-26']);
  assert.match(fl[0].t, /^Film: /);
  assert.match(a.entdeckenBereich(heute, { favoriten: fav }).kleinReiter.find(x => x.id === 'kultur').html, /aria-pressed="true">★ Gemerkt</);
  assert.match(a.gemerktReiter([]).html, /Noch nichts gemerkt/);
  for (const weg of ['kachel', 'navZeile', 'THEMEN']) assert.equal(a[weg], undefined, 'noch da: ' + weg);   // alte Themen-Kachel entfernt (0.47.3)
});

test('An diesem Tag: Dienst je Datum (Wikipedia, neueste zuerst), unter Entdecken → Zeitreise', async () => {
  const d = dienste.byId.andiesemtag;
  const ev = d.umwandeln(require('../tools/fixtures').onthisday().selected);
  assert.deepEqual(ev.map(e => e.jahr), [1990, 1950, 1871]);
  assert.equal(ev[2].link, null);
  assert.deepEqual(d.umwandeln(null), []);
  const jetzt = Date.parse('2026-10-01T10:00:00Z');
  const heute = await dienste.ausfuehren('andiesemtag', {}, { jetzt });
  gueltig(heute, d.schema);
  assert.deepEqual([heute.daten.datum, heute.daten.tag, heute.daten.ereignisse.length], ['2026-10-01', '10-01', 3]);
  assert.equal((await dienste.ausfuehren('andiesemtag', { datum: '2026-09-27' }, { jetzt })).daten.tag, '09-27');
  for (const x of ['2026-10-02', '1999-12-31', 'heute'])
    await assert.rejects(dienste.ausfuehren('andiesemtag', { datum: x }, { jetzt }), e => e.code === 'eingabe_ungueltig', x);
  assert.equal((await rufe('andiesemtag', { datum: '2026-09-28' })).code, 200);
  // „Heute“ → Wissen: Wort · Land · An diesem Tag
  const a = await esm('src/js/adapter/tagesinhalt.js');
  const t = await dienste.ausfuehren('tagesinhalt', {}, { jetzt });
  const env = a.mitZusatz(t, 'geschichte', heute);
  const g = a.entdeckenBereich(env, {}).kleinReiter.find(x => x.id === 'zeitreise').html;
  assert.match(g, /<a class="ab-ev kr-z" href="https:\/\/de\.wikipedia\.org\/wiki\/Beispiel_A" target="_blank" rel="noopener noreferrer" title="vor 36 Jahren · [^"]+"><b>1990<\/b> /);
  assert.match(g, /<p class="ab-ev kr-z"[^>]*><b>1871<\/b>/);            // ohne Link: keine Verlinkung
  assert.match(g, /aus Wikipedia/);
  assert.ok(a.entdeckenBereich(env, {}).info.some(x => /CC BY-SA/.test(x)));
  const f = a.favEintrag('geschichte', env);
  assert.deepEqual([f.art, f.datum, f.kurz], ['geschichte', '2026-10-01', '1990: Beispielereignis A für die Testansicht.']);
  // Wikipedia nicht erreichbar: übrige Teile bleiben, Hinweis im Teil
  const ohne = a.entdeckenBereich(a.mitZusatz(t, 'geschichte', null), {});
  assert.equal(ohne.state, 'content');
  assert.match(ohne.kleinReiter.find(x => x.id === 'zeitreise').html, /Wikipedia ist gerade nicht erreichbar/);
  assert.match(ohne.kleinReiter.find(x => x.id === 'welt').html, /class="ab-inhalt"/);
  assert.equal(a.jahrText(-44), '44 v. Chr.');
});

test('Mehr → Alltag: Rezept, Gesundheit, Tech, Beziehung, Spartipp', async () => {
  const a = await esm('src/js/adapter/tagesinhalt.js');
  const t = await dienste.ausfuehren('tagesinhalt', {}, { jetzt: Date.parse('2026-10-01T10:00:00Z') });
  const al = a.alltagRubrik(t, {});
  assert.deepEqual(al.teile.map(x => x.id), ['rezept', 'gesundheit', 'tech', 'beziehung', 'spartipp']);
  assert.match(al.teile[0].html, /<p class="ab-titel">[^<]+<\/p><p class="ab-meta">\d+ Minuten · für 2/);
  assert.match(al.teile[1].html, /keine medizinische Beratung/);
  assert.match(al.teile[4].html, /keine Anlageempfehlung/);
  const sp = a.favEintrag('spartipp', t);
  assert.deepEqual([sp.art, sp.datum], ['spartipp', '2026-10-01']);
  assert.deepEqual(Object.keys(a.artInhalt('spartipp', t.daten.inhalt)), ['kurz', 'text']);
  assert.ok(a.gemerktReiter([sp]).liste.some(z => /^Spartipp: /.test(z.t)));
});

test('Eingaben: die Adresse ist der Cache-Schlüssel – nur erlaubte Angaben in einer Schreibweise, sonst 400', async () => {
  const { kurzeZahl } = require('../services/_lib/parameter');
  assert.deepEqual(['51.05', '13.7', '9', '-0.5', '51.050', '51.051', '051.05', '+51', '1e1', '', '91'].map(v => kurzeZahl(v, 90)),
    [true, true, true, true, false, false, false, false, false, false, false]);
  for (const d of dienste.DIENSTE) {                                          // jeder Dienst nennt seine Angaben, Dienstblatt passt dazu
    assert.ok(d.parameter && typeof d.parameter === 'object', d.id + ': parameter fehlt');
    assert.deepEqual(Object.keys(d.parameter), Object.keys(d.eingaben), d.id + ': eingaben ≠ parameter');
  }
  const fall = async (id, q) => { const r = await rufe(id, q); return [r.code, r.body.fehler && r.body.fehler.code]; };
  assert.deepEqual(await fall('finanzen', { x: '1' }), [400, 'eingabe_ungueltig']);          // Dienst ohne Eingaben: jede Angabe abgelehnt
  assert.deepEqual(await fall('dienste', { x: '1' }), [400, 'eingabe_ungueltig']);
  assert.deepEqual(await fall('tagesinhalt', { datum: '1.10.2026' }), [400, 'eingabe_ungueltig']);
  assert.deepEqual(await fall('regen', { lat: '52.52', lon: '13.410' }), [400, 'eingabe_ungueltig']);
  assert.deepEqual(await fall('himmel', { lat: '52.52', lon: '13.41', zeitzone: 'Europe/Berlin' }), [400, 'eingabe_ungueltig']);
  assert.deepEqual(await fall('ort', { q: 'Berlin', land: 'AT' }), [400, 'eingabe_ungueltig']);
  assert.deepEqual(await fall('namenstage', { name: 'Josef<script>' }), [400, 'eingabe_ungueltig']);
  assert.equal((await rufe('finanzen')).code, 200);
  // Instanz-Zwischenspeicher: Schlüssel nur aus den geprüften Angaben
  dienste.INSTANZ.clear();
  await rufe('wetter', BERLIN);
  assert.deepEqual([...dienste.INSTANZ.keys()], ['wetter?lat=52.52&lon=13.41']);
  // privater Dienst per POST: Körper (Liste) bleibt erlaubt; GET mit Links weiter abgelehnt
  process.env.DAILY_PRIVATE = '1';
  try {
    const fallK = async (id, q) => { const r = await rufe(id, q, 'GET', KENNWORT); return [r.code, r.body.fehler && r.body.fehler.code]; };
    assert.deepEqual(await fallK('termine', { urls: 'https://calendar.test/a.ics' }), [400, 'eingabe_ungueltig']);
    assert.deepEqual(await fallK('termine', { zeitzone: 'Europe/Berlin', x: '1' }), [400, 'eingabe_ungueltig']);
  } finally { delete process.env.DAILY_PRIVATE; }
});

test('Schutz der Quellen (H2): letzte gute Antwort bei Ausfall, Quellenfehler 60 s gemerkt, Tankerkönig-Bremse', async () => {
  // CDN: Erfolg mit stale-if-error=3600, Fehler ohne Zwischenspeicher
  const ok = await rufe('finanzen');
  assert.match(ok.headers['cache-control'], /^s-maxage=\d+, stale-while-revalidate=\d+, stale-if-error=3600$/);
  assert.equal((await rufe('finanzen', { x: '1' })).headers['cache-control'], 'private, no-store');
  // Quelle fällt aus: innerhalb von 60 s nur EIN Abruf, danach wieder
  const echt = global.fetch; let abrufe = 0;
  global.fetch = async (url, o) => { if (String(url).includes('api.brightsky.dev/alerts')) { abrufe++; throw new Error('Quelle weg'); } return echt(url, o); };
  dienste.INSTANZ.clear(); dienste.FEHLER.clear();
  try {
    const q = { lat: '50.11', lon: '8.68' };
    const a = await rufe('wetterhinweise', q), b = await rufe('wetterhinweise', q);
    assert.deepEqual([a.code, a.body.fehler.code, b.body.fehler.code, abrufe], [502, 'quelle_fehler', 'quelle_fehler', 1]);
    assert.equal(a.headers['cache-control'], 'private, no-store');
    const k = 'wetterhinweise?lat=50.11&lon=8.68';
    dienste.FEHLER.get(k).bis = Date.now() - 1;                                      // 60 s vorbei
    await rufe('wetterhinweise', q);
    assert.equal(abrufe, 2);
    global.fetch = echt;
    dienste.FEHLER.get(k).bis = Date.now() - 1;
    assert.equal((await rufe('wetterhinweise', q)).code, 200);                       // Quelle wieder da → Fehler vergessen
    assert.equal(dienste.FEHLER.has(k), false);
  } finally { global.fetch = echt; }
  // Bremse: gleitendes Fenster
  const { drossel } = require('../services/_lib/drossel');
  const d = drossel(3, 60e3);
  assert.deepEqual([d(0), d(1000), d(2000), d(3000), d(60001), d(60500)], [true, true, true, false, true, false]);
  // Tankerkönig: 31. Abruf in einer Minute wird abgewiesen
  const t = dienste.byId.tanken, alt = process.env.TANKERKOENIG_API_KEY;
  process.env.TANKERKOENIG_API_KEY = 'test';
  try {
    t.BREMSE.zuruecksetzen(); for (let i = 0; i < 30; i++) assert.equal(t.BREMSE(), true);
    const r = await rufe('tanken', { lat: '50.94', lon: '6.96' });
    assert.deepEqual([r.code, r.body.fehler.code], [502, 'quelle_fehler']);
    assert.match(r.body.fehler.meldung, /ausgelastet/);
  } finally { t.BREMSE.zuruecksetzen(); dienste.FEHLER.clear(); if (alt === undefined) delete process.env.TANKERKOENIG_API_KEY; else process.env.TANKERKOENIG_API_KEY = alt; }
});

test('Fußball: Dienst je Liga (Tabelle, drei Spieltage), nur liga=bl1|bl2|bl3', async () => {
  const d = dienste.byId.fussball;
  assert.equal(d.saison(Date.parse('2026-06-30T12:00:00Z')), 2025);
  assert.equal(d.saison(Date.parse('2026-07-01T12:00:00Z')), 2026);
  const env = await dienste.ausfuehren('fussball', { liga: 'bl2' });
  gueltig(env, d.schema);
  const x = env.daten;
  assert.deepEqual([x.liga.id, x.aktuell, x.tabelle.length, x.spieltage.map(t => t.nr)], ['bl2', 9, 18, [8, 9, 10]]);
  assert.deepEqual(x.tabelle[3].kurz, 'Dynamo Dresden');
  assert.equal(x.spieltage[1].spiele[0].tore, null);                    // noch nicht gespielt: keine Tore
  gueltig(await dienste.ausfuehren('fussball', { liga: 'bl3' }), d.schema);   // leere Liga ist gültig
  for (const q of [{}, { liga: 'bl4' }, { liga: 'bl1', team: 'Dynamo' }])
    assert.equal((await rufe('fussball', q)).code, 400, JSON.stringify(q));
  assert.equal((await rufe('fussball', { liga: 'bl1' })).code, 200);
});

test('Schlagzeilen: Dienst nur privat mit Kennwort, RSS und Atom, je Quelle erreichbar', async () => {
  const d = dienste.byId.schlagzeilen;
  // Lesen (rein): RSS und Atom, nur Einträge mit Titel und http(s)-Link, Text ohne HTML
  const r = d.lesen(fx.rss('Tagesschau'), 'tagesschau');
  assert.equal(r.length, 3);
  assert.match(r[0].link, /^https:\/\//);
  assert.match(r[0].zeit, /Z$/);
  assert.ok(d.lesen(fx.atom('heise'), 'heise').length >= 1);
  assert.deepEqual(d.lesen('<rss><item><title>A &amp; <b>B</b></title><link>https://x.test/1</link></item><item><title>ohne Link</title></item>'
    + '<item><title>böser Link</title><link>javascript:alert(1)</link></item></rss>', 'q'), [{ quelle: 'q', titel: 'A & B', link: 'https://x.test/1', zeit: null }]);
  // Router: öffentlich gesperrt, privat ohne Kennwort 401, mit Kennwort gültig
  delete process.env.DAILY_PRIVATE;
  assert.equal((await rufe('schlagzeilen', {}, 'GET', KENNWORT)).code, 404);
  process.env.DAILY_PRIVATE = '1';
  assert.equal((await rufe('schlagzeilen')).code, 401);
  assert.equal((await rufe('schlagzeilen', { x: '1' }, 'GET', KENNWORT)).code, 400);
  const res = await rufe('schlagzeilen', {}, 'GET', KENNWORT);
  delete process.env.DAILY_PRIVATE;
  assert.equal(res.code, 200);
  assert.match(res.headers['cache-control'], /no-store/);                              // privat: nie im CDN
  gueltig(res.body, d.schema);
  const env = res.body, x = env.daten;
  assert.deepEqual(x.quellen.map(q => [q.id, q.erreichbar]), [['tagesschau', true], ['mdr', true], ['heise', true]]);
  assert.ok(x.meldungen.every((m, i) => !i || (x.meldungen[i - 1].zeit || '') >= (m.zeit || '')), 'neueste zuerst');
  // eine Quelle gestört: die anderen kommen, alle gestört: quelle_fehler
  const teil = d.umwandeln([{ id: 'a', name: 'A', seite: null, erreichbar: true, fehler: null, meldungen: [{ quelle: 'a', titel: 'T', link: 'https://a.test', zeit: null }] },
    { id: 'b', name: 'B', seite: null, erreichbar: false, fehler: 'HTTP 503', meldungen: [] }]);
  assert.deepEqual(teil.quellen.map(q => q.anzahl), [1, 0]);
  const echt = global.fetch;
  global.fetch = async () => new Response('kaputt', { status: 503 });
  try { await assert.rejects(d.run(), e => e.code === 'quelle_fehler'); } finally { global.fetch = echt; }
});

test('Vertragsversion (Review M6): Oberfläche kennt jeden Dienst in seiner Version, prüft jede Antwort, nutzt nur passende gespeicherte Stände', async () => {
  const v = await esm('src/js/dienste/vertraege.js');
  assert.deepEqual(Object.keys(v.VERTRAG).sort(), dienste.DIENSTE.map(d => d.id).sort(), 'vertraege.js: Liste der Dienste');
  for (const d of dienste.DIENSTE) assert.equal(v.VERTRAG[d.id], d.version, `${d.id}: Vertrag ${d.version} auf dem Server – Oberfläche anpassen und vertraege.js erhöhen`);
  const env = { format: 'daily/1', dienst: 'wetter', version: 1 };
  assert.equal(v.vertragFehler('wetter', env), null);
  assert.equal(v.vertragFehler('wetter', { ...env, version: 2 }), 'Vertrag 2, Oberfläche kennt 1');
  assert.equal(v.vertragFehler('regen', env), 'Antwort von „wetter“ statt „regen“');
  assert.equal(v.vertragFehler('gibtsnicht', { ...env, dienst: 'gibtsnicht' }), 'Dienst „gibtsnicht“ ist der Oberfläche unbekannt');
  // Client: Antwort mit neuer Vertragsversion → antwort_ungueltig; vorhandener passender Stand wird weiter gezeigt (als veraltet)
  const echt = global.fetch, lager = {};
  global.localStorage = { getItem: k => (k in lager ? lager[k] : null), setItem: (k, x) => { lager[k] = String(x); }, removeItem: k => { delete lager[k]; }, key: i => Object.keys(lager)[i], get length() { return Object.keys(lager).length; } };
  Object.defineProperty(global.localStorage, 'keys', { value: () => Object.keys(lager) });
  let version = 1;
  global.fetch = async (url, o) => {
    if (!String(url).startsWith('/api/v1/')) return echt(url, o);   // Abrufe der Dienste bei ihren Quellen: Beispieldaten (fetch-stub)
    const u = new URL(url, 'http://x'), r = await rufe(u.pathname.split('/').pop(), Object.fromEntries(u.searchParams));
    return { ok: r.code < 400, status: r.code, json: async () => ({ ...r.body, version }) };
  };
  try {
    const c = await import(pathToFileURL(path.join(__dirname, '..', 'src/js/dienste/client.js')).href + '?t=vertrag');
    const p = { lat: 52.52, lon: 13.41 };
    assert.equal((await c.dienst('wetter', p)).version, 1);
    version = 2;
    await assert.rejects(c.dienst('regen', p), e => e.code === 'antwort_ungueltig' && /Vertrag 2, Oberfläche kennt 1/.test(e.message));   // nichts gespeichert → Fehler
    const w = await c.dienst('wetter', p, { frisch: true });
    assert.deepEqual([w.version, w.veraltet], [1, true]);                       // letzter passender Stand
    // gespeicherte Antwort in einem fremden Vertrag wird nicht angezeigt
    const k = Object.keys(lager).find(x => x.includes('/api/v1/wetter'));
    lager[k] = JSON.stringify({ ...JSON.parse(lager[k]), version: 2 });
    const c2 = await import(pathToFileURL(path.join(__dirname, '..', 'src/js/dienste/client.js')).href + '?t=vertrag2');
    assert.equal(c2.gespeichert('wetter', p), null);
  } finally { global.fetch = echt; delete global.localStorage; }
});

test('Dienste erst beim ersten Aufruf laden: Kaltstart lädt keinen Dienst, ein Aufruf nur seinen; jede Dienst-Datei steht in der Ladeliste', async () => {
  const fs = require('node:fs');
  const dateien = fs.readdirSync(path.join(__dirname, '../services')).filter(f => f.endsWith('.js') && f !== 'index.js').map(f => f.slice(0, -3)).sort();
  assert.deepEqual([...dienste.IDS].sort(), dateien, 'services/index.js → LADER: jede Dienst-Datei eintragen');
  assert.ok('wetter' in dienste.byId && !('gibtsnicht' in dienste.byId));
  assert.equal(dienste.byId.gibtsnicht, undefined);
  // frischer Prozess wie ein Kaltstart der Funktion
  const { execFileSync } = require('node:child_process');
  const skript = `
    global.fetch = require('./tools/fetch-stub');
    const geladen = () => Object.keys(require.cache).map(f => require('path').relative(process.cwd(), f).replace(/\\\\/g, '/'))
      .filter(f => /^services\\/[a-z]+\\.js$/.test(f) && f !== 'services/index.js').map(f => f.slice(9, -3)).sort();
    const router = require('./api/v1/[dienst].js');
    const vorher = geladen();
    const res = { headers: {}, setHeader() {}, status(c) { this.code = c; return this; }, json(o) { this.body = o; } };
    router({ method: 'GET', query: { dienst: 'wetter', lat: '52.52', lon: '13.41' }, headers: {} }, res).then(() =>
      router({ method: 'GET', query: { dienst: 'gibtsnicht' }, headers: {} }, res)).then(() =>
      console.log(JSON.stringify({ vorher, nachher: geladen() })));`;
  const aus = JSON.parse(execFileSync(process.execPath, ['-e', skript], { cwd: path.join(__dirname, '..'), env: { ...process.env, NODE_OPTIONS: '' } }).toString().trim().split('\n').pop());
  assert.deepEqual(aus.vorher, [], 'beim Start geladen: ' + aus.vorher.join(', '));
  assert.ok(aus.nachher.includes('wetter'), 'wetter fehlt');
  assert.ok(!aus.nachher.includes('termine') && !aus.nachher.includes('himmel'), 'zu viel geladen: ' + aus.nachher.join(', '));
});

test('Tagesgrenze: Tagestakt endet um Mitternacht deutscher Zeit (Sommer, Winter, Zeitumstellung), kürzere Takte unverändert', async () => {
  const { gueltigBisVon, mitternachtNach, antwort } = require('../services/_lib/rahmen');
  const iso = t => new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const tag = { takt: 86400, ttl: 86400 }, P = Date.parse;
  assert.equal(iso(gueltigBisVon(tag, P('2026-10-03T21:30:00Z'))), '2026-10-03T22:00:00Z');   // 23:30 Sommerzeit → 0 Uhr = 22 Uhr UTC
  assert.equal(iso(gueltigBisVon(tag, P('2026-10-03T22:30:00Z'))), '2026-10-04T22:00:00Z');   // 0:30 deutscher Zeit: schon der neue Tag
  assert.equal(iso(gueltigBisVon(tag, P('2026-12-01T22:59:00Z'))), '2026-12-01T23:00:00Z');   // Winterzeit: 0 Uhr = 23 Uhr UTC
  assert.equal(iso(gueltigBisVon(tag, P('2026-10-25T10:00:00Z'))), '2026-10-25T23:00:00Z');   // Tag der Umstellung auf Winterzeit (25 Std.)
  assert.equal(iso(gueltigBisVon(tag, P('2026-10-24T22:00:00Z'))), '2026-10-25T23:00:00Z');   // genau Mitternacht → nächste
  assert.equal(iso(gueltigBisVon(tag, P('2027-03-28T10:00:00Z'))), '2027-03-28T22:00:00Z');   // Tag der Umstellung auf Sommerzeit (23 Std.)
  assert.equal(iso(mitternachtNach(P('2026-10-03T12:00:00Z'), 'UTC')), '2026-10-04T00:00:00Z');
  // kürzere Takte und ttl wie bisher
  assert.equal(iso(gueltigBisVon({ takt: 1800 }, P('2026-10-03T21:31:00Z'))), '2026-10-03T22:00:00Z');
  assert.equal(iso(gueltigBisVon({ takt: 300 }, P('2026-10-03T21:31:00Z'))), '2026-10-03T21:35:00Z');
  assert.equal(iso(gueltigBisVon({ ttl: 60 }, P('2026-10-03T21:31:00Z'))), '2026-10-03T21:32:00Z');
  // alle Dienste mit Tagestakt: Antwort kurz vor Mitternacht deutscher Zeit gilt nur bis dahin
  const tagesdienste = dienste.DIENSTE.filter(d => d.takt === 86400).map(d => d.id).sort();
  assert.deepEqual(tagesdienste, ['andiesemtag', 'feiertage', 'namenstage', 'tagesinhalt']);
  for (const id of tagesdienste) assert.equal(antwort(dienste.byId[id], { daten: {}, jetzt: P('2026-10-03T21:59:00Z') }).gueltigBis, '2026-10-03T22:00:00Z', id);
});
