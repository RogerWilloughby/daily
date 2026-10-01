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
  assert.match(k.title, /^Berlin 15° · 9° \(\d{1,2} Uhr\) \/ 16° \(\d{1,2} Uhr\)$/);   // Ort, jetzt, Tiefst/Höchst mit Uhrzeit in einer Zeile
  assert.ok(env.daten.tage[0].minZeit && env.daten.tage[0].maxZeit);
  assert.equal(k.m, '');                                        // keine große Zeile mehr
  assert.equal(k.ms, '15°');                                    // Handy: Kurzform
  assert.equal(k.lglyphTip, 'Teilweise bewölkt');               // Symbol in der Kopfzeile mit Erklärung
  assert.match(k.lglyph, /^<svg/);
  // Mini-Diagramm: Temperaturskala in 5er-Schritten, Regenskala rechts in mm, Legende
  assert.match(k.chart, /wd-miniskala wd-t-max"><div class="wd-sk"><span class="wd-g5"[^>]*>-5°<\/span>.*>25°<\/span><\/div>/);   // Temperatur orange
  // gemeinsame graue Linien: 7 Linien (-5 … 25), jede mit Temperatur links und Regen rechts (Mock bis 12 mm → 2 mm je Linie)
  assert.equal((k.chart.match(/°<\/span>/g) || []).length, 7);
  assert.equal((k.chart.match(/<line class="wd-gitter/g) || []).length, 7);
  assert.match(k.chart, /wd-miniskala-r wd-t-regen"><div class="wd-sk"><span class="wd-g5"[^>]*>0<\/span><span[^>]*>2<\/span>.*<span class="wd-g5"[^>]*>12 mm<\/span><\/div>/);   // Regen grün
  assert.match(k.chart, /<b class="wd-t-regen" title="Balkenhöhe = Regenmenge in mm · kräftigere Farbe = Regen wahrscheinlicher">Regen mm<\/b> · <b class="wd-t-max" title="Höchst = wärmster Wert des Tages">Höchst<\/b> · <b class="wd-t-min" title="Tiefst = [^"]+">Tiefst<\/b>/);
  assert.doesNotMatch(k.chart, /kräftiger = wahrscheinlicher/);                     // Erklärung nur noch als Mouseover
  assert.match(k.chart, /data-mini-wahl="1" aria-pressed="false">Heute<.*data-mini-wahl="3"[^>]*>3 Tage<.*data-mini-wahl="7"[^>]*>7 Tage<.*data-mini-wahl="15" aria-pressed="true">15 Tage</);
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
  assert.ok(!k.rows.some(([l, v]) => /Trend|unsicher/.test(l + v)));
  // Kopfzeile mit farbigen Zahlen
  assert.match(k.titleHtml, /^Berlin 15° · <span class="wd-tm" title="Tiefstwert heute: 9° um \d{1,2} Uhr"><b class="wd-t-min">9°<\/b> <small class="wd-um">\d{1,2} Uhr<\/small><\/span> \/ <span class="wd-tm" title="Höchstwert heute: 16° um \d{1,2} Uhr"><b class="wd-t-max">16°<\/b> <small class="wd-um">\d{1,2} Uhr<\/small><\/span>$/);
  assert.equal(k.zeileIcon, true);
  assert.match(k.kopf, /9°<\/b> <small class="wd-um">\(\d{1,2} Uhr\)<\/small><\/span> \/ <span class="wd-tm" title="Höchstwert[^"]*"><b class="wd-t-max">16°<\/b> <small class="wd-um">\(\d{1,2} Uhr\)<\/small>/);   // kleine Kachel: Uhrzeit in Klammern
  // Mini-Reiter (kein Aufklappen): Jetzt · Mehr – Radar nur mit Radar-Antwort, Hinweise nur bei Warnung
  assert.equal(k.tabs, undefined);
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
  const { tageDiagramm } = await esm('src/js/adapter/diagramm.js');
  const ohneSonne = env.daten.tage.map((t, i) => (i === 2 ? { ...t, sonnenstunden: null } : t));
  assert.match(tageDiagramm(ohneSonne, d => d), /Sonne: keine Angabe/);
  assert.equal(k.x, 'Teilweise bewölkt, gefühlt 14°.');                    // Regen steht in einer eigenen Zeile
  assert.match(k.zeile2.text, /^(Regen möglich (morgen )?gegen \d{1,2} Uhr\.|Kein Regen in den nächsten 24 Std\.)$/);
  assert.match(k.zeile2.glyph, /^<svg/);
  // Regenzeile: nächste 24 Stunden, „morgen“ nach Mitternacht, Stunde ohne führende Null
  const { regen24 } = await esm('src/js/adapter/wetter.js');
  const std = (start, werte) => werte.map((p, i) => ({ zeit: new Date(Date.parse(start) + i * 3600e3).toISOString(), regenProzent: p }));
  const r = (werte, start = '2026-09-28T18:00:00Z') => regen24({ ort: { zeitzone: 'Europe/Berlin' }, daten: { tage: [{ datum: '2026-09-28' }], stunden: std(start, werte) } }).text;
  assert.equal(r(Array(30).fill(10)), 'Kein Regen in den nächsten 24 Std.');
  assert.equal(r([0, 30, 60, 10]), 'Regen möglich gegen 22 Uhr.');                        // 20 Uhr UTC = 22 Uhr
  assert.equal(r([...Array(11).fill(0), 70]), 'Regen möglich morgen gegen 7 Uhr.');      // 5 Uhr UTC = 7 Uhr
  assert.equal(r([...Array(24).fill(0), 90]), 'Kein Regen in den nächsten 24 Std.');     // Stunde 25 zählt nicht
  assert.ok(k.rows.some(([l]) => l === 'Luftqualität'));
  assert.ok(k.rows.some(([l]) => l === 'Morgen'));
  const zeile = l => (k.rows.find(([x]) => x.startsWith(l)) || [])[1];
  assert.equal(zeile('Wind'), '11 km/h aus W, Böen 25 km/h');
  assert.match(zeile('Sonne'), /4 Std\. Sonne · UV bis 3$/);
  assert.equal(zeile('Luftdruck'), '1016 hPa, fallend');
  assert.match(zeile('Bis '), /° bis .*° · (eher wechselhaft|eher trocken|teils Regen)$/);
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
  for (const d of dienste.DIENSTE.filter(x => x.klasse !== 'privat')) assert.ok(html.includes(`<h3>${d.titel} <small class="dversion">${d.id} ${d.programmversion}</small></h3>`), d.id);
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

test('Adapter Regen: Hinweis in der Wetterkachel und Reiter „Radar“', async () => {
  const { hinweis, radarReiter } = await esm('src/js/adapter/regen.js');
  const { kachel, antwort: text } = await esm('src/js/adapter/wetter.js');
  const regen = (await rufe('regen', { lat: '52.52', lon: '13.41' })).body;
  assert.equal(hinweis(regen), 'Regen in 20 Min. (leicht).');
  assert.equal(hinweis(null), null);
  const html = radarReiter(regen, iso => iso.slice(11, 16));
  assert.match(html, /<svg class="rk rk-mit-land" viewBox="0 0 (\S+) \1"/);   // quadratische Karte mit Landkarte
  const kacheln = html.match(/<image href="\/api\/karte\?z=9&amp;x=\d+&amp;y=\d+"/g) || [];
  assert.ok(kacheln.length >= 4 && kacheln.length <= 16, 'Kacheln: ' + kacheln.length);
  assert.match(html, /<g class="rk-radar" transform="matrix\(/);
  assert.equal((html.match(/class="rk-bild/g) || []).length, 13);
  assert.match(html, /<g class="rk-bild rk-an" data-i="4">/);  // „jetzt“ ist sichtbar, auch ohne Skript
  assert.equal((html.match(/data-rk-bild="/g) || []).length, 13);
  assert.match(html, /aria-pressed="true" title="[\d:]+ Uhr · gemessen"><i><\/i><span>jetzt<\/span>/);
  assert.match(html, /<span>−1 Std\.<\/span>.*<span>\+1 Std\.<\/span>.*<span>\+2 Std\.<\/span>/s);
  assert.match(html, /© GeoBasis-DE \/ BKG \(20\d\d\), basemap\.de/);
  assert.match(html, /<dl class="rk-werte">.*<div class="rk-karte">.*<div class="rk-rechts">/s);   // Werte · Karte · Verlauf
  const ohneLand = radarReiter({ ...regen, daten: { ...regen.daten, karte: { ...regen.daten.karte, ecken: undefined } } }, iso => iso.slice(11, 16));
  assert.doesNotMatch(ohneLand, /<image|BKG/);               // ältere Antwort ohne Ecken: Radar ohne Landkarte
  assert.match(ohneLand, /<svg class="rk" viewBox="0 0 52 52"/);
  assert.match(html, /4 km westlich/);
  assert.match(html, /0,4 mm, aufgehört vor 30 Min\./);
  const wetter = (await rufe('wetter', { ort: 'Berlin' })).body;
  const k = kachel(wetter, regen);
  assert.deepEqual(k.kleinReiter.map(r => r.id), ['jetzt', 'radar', 'mehr']);
  const rk = k.kleinReiter[1];
  assert.equal(rk.kopf, 'Regen in 20 Min. (leicht).');
  assert.match(rk.html, /^<div class="rk-klein"><div class="rk-karte"><svg class="rk rk-mit-land".*<div class="rk-leiste".*<dl class="rk-werte">.*4 km westlich/s);
  assert.ok(k.info.some(x => /^Radar: Deutscher Wetterdienst/.test(x)) && k.info.some(x => /GeoBasis-DE/.test(x)));
  assert.equal(k.zeile2.text, "Regen in 20 Min. (leicht)."); assert.doesNotMatch(k.x, /Regen in/);   // Radar geht vor, eigene Zeile
  assert.deepEqual(kachel(wetter, null).kleinReiter.map(r => r.id), ['jetzt', 'mehr']);   // ohne Radar
  assert.match(text(wetter, regen), /Radar: Regen in 20 Min\./);
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

test('Paket: mehrere Dienste in einer Anfrage, Fehler nur im eigenen Teil, gültig bis zum frühesten Takt', async () => {
  const r = await rufe('paket', { dienste: 'wetter,regen,wetterhinweise,gibtsnicht', lat: '52.52', lon: '13.41', name: 'Berlin' });
  assert.equal(r.code, 200);
  gueltig(r.body);
  const a = r.body.daten.antworten;
  assert.equal(a.wetter.dienst, 'wetter'); assert.equal(a.regen.dienst, 'regen'); assert.equal(a.wetterhinweise.dienst, 'wetterhinweise');
  assert.equal(a.gibtsnicht.fehler.code, 'dienst_unbekannt');
  assert.equal(r.body.gueltigBis, a.regen.gueltigBis);                 // Radar (5 min) bestimmt die Gültigkeit
  assert.equal((await rufe('paket', {})).body.fehler.code, 'eingabe_fehlt');
});

test('Client: Paket, sofort anzeigen aus dem Speicher, Rückfall auf letzten Stand bei Störung, Messung', async () => {
  const lager = {};
  global.localStorage = { getItem: k => lager[k] ?? null, setItem: (k, v) => { lager[k] = String(v); }, removeItem: k => { delete lager[k]; } };
  const echt = global.fetch; let stoerung = false;
  global.fetch = async url => {
    if (stoerung) throw new Error('offline');
    const u = new URL(url, 'http://x'); const q = Object.fromEntries(u.searchParams);
    const r = await rufe(u.pathname.split('/').pop(), q);
    return { ok: r.code < 400, status: r.code, json: async () => r.body };
  };
  try {
    const neu = z => import(pathToFileURL(path.join(__dirname, '..', 'src/js/dienste/client.js')).href + '?t=' + z);   // frisches Modul = Browser-Neustart
    const c = await neu(1);
    const zeiten = []; c.aufMessung((n, ms, q) => zeiten.push([n, q]));
    const p = { lat: 52.52, lon: 13.41, name: 'Berlin' };
    assert.equal(c.gespeichert('wetter', p), null);
    const r1 = await c.paket(['wetter', 'regen'], p);
    assert.equal(r1.wetter.dienst, 'wetter'); assert.equal(r1.regen.dienst, 'regen');
    assert.deepEqual(zeiten.at(-1), ['paket', 'netz']);
    assert.ok(Object.keys(lager).some(k => k.includes('/api/v1/wetter?')));   // für das nächste Öffnen gespeichert
    // Speicher im Browser wie nach einem Neustart: nur localStorage bleibt
    const c2 = await neu(2);
    assert.equal(c2.gespeichert('wetter', p).dienst, 'wetter');                // sofort anzeigen
    stoerung = true;
    const r2 = await c2.paket(['wetter', 'regen'], p);                         // Netz weg → letzter Stand, als veraltet markiert
    assert.equal(r2.wetter.veraltet, true);
    assert.equal(r2.regen.veraltet, true);
    await assert.rejects(c2.dienst('ort', { q: 'Berlin' }), e => e.code === 'nicht_erreichbar');   // nichts gespeichert → Fehler
  } finally { global.fetch = echt; delete global.localStorage; }
});

test('Wetterhinweise: DWD-Warnungen über Bright Sky – ohne Testmeldungen, höchste Stufe zuerst, mit Tipp', async () => {
  const r = await rufe('wetterhinweise', { lat: '51.05', lon: '13.74', name: 'Dresden' });
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

test('Adapter Wetterhinweise: Abzeichen, kurzer Hinweis und Reiter in der Wetterkachel, Unwetter zuerst', async () => {
  const h = await esm('src/js/adapter/hinweise.js');
  const { kachel } = await esm('src/js/adapter/wetter.js');
  const env = (await rufe('wetterhinweise', { lat: '51.05', lon: '13.74' })).body;
  const wetter = (await rufe('wetter', { ort: 'Berlin' })).body;
  assert.match(h.abzeichen(env), /class="wh-badge wh-s2"[^>]*>Sturmböen \+1</);
  assert.match(h.kurz(env), /^Sturmböen ab (morgen )?\d{1,2}(:\d\d)? Uhr\.$/);
  const html = h.reiter(env);
  assert.match(html, /Markantes Wetter.*Amtliche WARNUNG vor STURMBÖEN.*Uhr.*Empfehlung:<\/b> Achten Sie.*Tipp:/s);
  assert.equal((html.match(/Tipp:/g) || []).length, 1);                              // gleicher Tipp nur einmal
  assert.match(html, /Deutscher Wetterdienst · Dresden/);
  assert.match(h.antwort(env), /^Sturmböen \(Markantes Wetter\).*Quelle: Deutscher Wetterdienst\.$/);
  assert.match(h.antwort({ daten: { gebiet: 'Dresden', hoechsteStufe: 0, hinweise: [] } }), /kein amtlicher Wetterhinweis/);
  // in der Kachel: Abzeichen in der Kopfzeile, Hinweis in der Zeile, Reiter vor „Mehr“
  const k = kachel(wetter, null, env);
  assert.match(k.titleHtml, /wh-badge/);
  assert.match(k.x, /gefühlt .*°\. Sturmböen ab/);
  assert.deepEqual(k.kleinReiter.map(r => r.id), ['jetzt', 'hinweise', 'mehr']);              // Mini-Reiter „Hinweise“ nur bei Warnung
  const hr = k.kleinReiter[1];
  assert.match(hr.kopf, /wh-badge wh-s2/);
  assert.deepEqual(hr.liste.map(z => z.t), ['Sturmböen', 'Starke böen']);
  assert.match(hr.liste[0].d, /^ab /);
  assert.match(hr.liste[0].ico, /wh-punkt wh-s2/);
  assert.match(hr.liste[0].tip, /^Markantes Wetter: Amtliche WARNUNG vor STURMBÖEN \(.*\)\nEs treten Sturmböen um 70 km\/h auf\.\nEmpfehlung: Achten Sie.*\nTipp \(DAILY\): /);
  // ohne Hinweis: kein Abzeichen, kein Hinweis im Text – der Reiter sagt ruhig „keine“
  const leer = kachel(wetter, null, { erstellt: new Date().toISOString(), daten: { gebiet: 'Berlin', hoechsteStufe: 0, hinweise: [] } });
  assert.doesNotMatch(leer.titleHtml, /wh-badge/);
  assert.doesNotMatch(leer.x, /Sturm/);
  assert.deepEqual(leer.kleinReiter.map(r => r.id), ['jetzt', 'mehr']);                        // ohne Warnung kein Reiter
  assert.deepEqual(kachel(wetter, null, null).kleinReiter.map(r => r.id), ['jetzt', 'mehr']);
  assert.match(h.reiter(null, 'Europe/Rome', Date.now(), { name: 'Rom', land: 'IT' }), /nur für Orte in Deutschland/);
  // Unwetter (Stufe 3–4): deutlich, zuerst, nicht verharmlost
  const u = { daten: { gebiet: 'Dresden', hoechsteStufe: 4, hinweise: [{ art: 'wind', stufe: 4, stufeName: 'extrem', ereignis: 'ORKANBÖEN', titel: 'Amtliche WARNUNG vor ORKANBÖEN',
    beginn: new Date().toISOString(), ende: new Date(Date.now() + 36e5).toISOString(), aktiv: true, beschreibung: 'Orkanböen bis 130 km/h.', empfehlung: 'Aufenthalt im Freien vermeiden!', tipp: 'x' }] } };
  const ku = kachel(wetter, null, u);
  assert.match(ku.titleHtml, /wh-s4[^>]*>! Unwetter: Orkanböen</);
  assert.match(ku.x, /^Extreme Unwetterwarnung: Orkanböen bis/);
  assert.equal(ku.unwetter, 'ORKANBÖEN|' + u.daten.hinweise[0].beginn);                       // Kennung: einmal automatisch auf „Hinweise“
  const ur = ku.kleinReiter.find(r => r.id === 'hinweise');
  assert.equal(ur.liste[0].t, 'Extreme Unwetterwarnung: Orkanböen');
  assert.match(ur.liste[0].tip, /Aufenthalt im Freien vermeiden!/);
});

test('Feiertage: Bundesland aus dem Ort, Feiertage, Brückentage, Ferien, Zeitumstellung, KW, Aktionstage', async () => {
  const fe = dienste.byId.feiertage;
  const r = await rufe('feiertage', { lat: '51.05', lon: '13.74', name: 'Dresden' });     // ohne region → Bundesland aus dem Ortsbestand
  assert.equal(r.code, 200);
  gueltig(r.body, fe.schema);
  const d = r.body.daten;
  assert.deepEqual([d.bundesland, d.kuerzel], ['Sachsen', 'SN']);
  assert.deepEqual(d.ferien.map(f => f.name), ['Herbstferien', 'Weihnachtsferien']);
  assert.equal((await rufe('feiertage', { lat: '48.14', lon: '11.58', region: 'Bayern' })).body.daten.kuerzel, 'BY');
  assert.equal((await rufe('feiertage', { lat: '41.9', lon: '12.5', land: 'IT' })).body.fehler.code, 'nicht_unterstuetzt');
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
  const r = await rufe('himmel', { lat: '51.05', lon: '13.74', name: 'Dresden' });
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

test('Adapter Kalender: Kachel aus Feiertagen und Himmel, Reiter, Antworten', async () => {
  const { kachel, antwort, termine } = await esm('src/js/adapter/kalender.js');
  const jetzt = Date.parse('2026-09-27T10:00:00Z');
  const fe = { daten: { ...dienste.byId.feiertage.berechne('SN', '2026-09-27'), bundesland: 'Sachsen', kuerzel: 'SN',
    ferien: [{ name: 'Herbstferien', von: '2026-10-12', bis: '2026-10-24' }] } };
  const hi = { daten: dienste.byId.himmel.berechne(51.05, 13.74, jetzt) };
  const k = kachel(fe, hi, jetzt);
  assert.equal(k.title, 'Kalender · KW 39');
  assert.equal(k.m, 'Tag der Deutschen Einheit');
  assert.equal(k.ms, '6 Tage');
  assert.match(k.x, /^In 6 Tagen \(Sa\., 3\.10\.\) · Herbstferien ab Mo\., 12\.10\./);
  assert.deepEqual(k.tabs.map(t => t.id), ['naechste', 'feiertage', 'ferien', 'himmel']);
  assert.match(k.tabs[0].html, /Tag der Deutschen Einheit.*am Wochenende/);
  assert.match(k.tabs[3].html, /Vollmond<\/b>, \d+ % beleuchtet/);
  assert.match(k.tabs[3].html, /Partielle Sonnenfinsternis/);
  // laufende Ferien gehen vor
  const k2 = kachel({ daten: { ...fe.daten, feiertage: [], ferien: [{ name: 'Herbstferien', von: '2026-09-20', bis: '2026-10-02' }] } }, hi, jetzt);
  assert.deepEqual([k2.m, k2.ms, k2.x.split(' · ')[0]], ['Herbstferien', 'Ferien', 'bis Fr., 2.10.']);
  // Ausland: nur Himmel
  const k3 = kachel(null, hi, jetzt);
  assert.deepEqual(k3.tabs.map(t => t.id), ['naechste', 'himmel']);
  assert.equal(k3.title, 'Kalender');
  assert.ok(termine(fe, hi, '2026-09-27').every((t, i, a) => !i || a[i - 1].datum <= t.datum));
  // Frag DAILY
  assert.match(antwort('Wann sind Ferien?', fe, hi, 'Dresden', jetzt), /Nächste Ferien in Sachsen: Herbstferien vom Mo\., 12\.10\./);
  assert.match(antwort('Wann ist Muttertag?', fe, hi, 'Dresden', jetzt), /^Muttertag: So\., 9\.5\./);
  assert.match(antwort('Wann ist der 1. Advent?', fe, hi, 'Dresden', jetzt), /^1\. Advent: So\., 29\.11\./);
  assert.match(antwort('Welche KW haben wir?', fe, hi, 'Dresden', jetzt), /Kalenderwoche 39/);
  assert.match(antwort('Wann ist die nächste Sonnenfinsternis?', fe, hi, 'Dresden', jetzt), /^Partielle Sonnenfinsternis am Mo\., 2\.8\./);
  assert.match(antwort('Mond heute?', fe, hi, 'Dresden', jetzt), /^Vollmond, \d+ % beleuchtet/);
  assert.match(antwort('Zeitumstellung?', fe, hi, 'Dresden', jetzt), /Winterzeit: Uhr zurück .* am So\., 25\.10\./);
  assert.equal(antwort('Ferien?', null, hi, 'Rom', jetzt), 'Feiertage und Ferien gibt es für Orte in Deutschland.');
});

test('Namenstage: feste Liste plausibel, Dienst, Kachel und Antwort', async () => {
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
  // Kachel und Antwort
  const { kachel, namenAntwort } = await esm('src/js/adapter/kalender.js');
  const jetzt = Date.parse('2026-09-28T10:00:00Z');
  const nEnv = { daten: na.auswerten({ stand: '2026-09-01', tage }, '2026-09-28') };
  const k = kachel(null, { daten: dienste.byId.himmel.berechne(51.05, 13.74, jetzt) }, jetzt, 'Europe/Berlin', nEnv);
  assert.match(k.x, /Namenstag: Wenzel, Lioba$/);
  assert.match(k.tabs[0].html, /Namenstag heute: <b>Wenzel, Lioba<\/b>/);
  assert.equal(k.tabs.at(-1).id, 'namen');
  assert.equal(namenAntwort(nEnv, jetzt), 'Heute haben Namenstag: Wenzel, Lioba.');
  assert.equal(namenAntwort({ daten: d }, jetzt), 'Josef hat Namenstag am Fr., 19.3. (in 172 Tagen).');
  assert.equal(namenAntwort({ daten: { ...d, stand: null } }, jetzt), 'Die Namenstage werden gerade erst aufgebaut.');
});


test('Termine (privat): nur privat, Links nur per POST, Serien, ganztägig, abgesagt, Fehler je Kalender', async () => {
  const post = async (koerper, privat = true) => {
    if (privat) process.env.DAILY_PRIVATE = '1'; else delete process.env.DAILY_PRIVATE;
    const r = { headers: {}, setHeader(k, v) { r.headers[k.toLowerCase()] = v; }, status(c) { r.code = c; return r; }, json(o) { r.body = o; } };
    await router({ method: 'POST', query: { dienst: 'termine' }, body: koerper }, r);
    delete process.env.DAILY_PRIVATE;
    return r;
  };
  // öffentlich gesperrt; Links nie per GET
  assert.equal((await post({ urls: ['https://calendar.test/a.ics'] }, false)).body.fehler.code, 'nur_privat');
  process.env.DAILY_PRIVATE = '1';
  assert.equal((await rufe('termine', { urls: 'https://calendar.test/a.ics' })).body.fehler.code, 'eingabe_ungueltig');
  delete process.env.DAILY_PRIVATE;
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

test('Adapter Kalender: eigene Termine – Kennzahl, Reiter, Antwort', async () => {
  const { kachel, termineAntwort } = await esm('src/js/adapter/kalender.js');
  const jetzt = Date.parse('2026-09-28T08:00:00Z');   // 10:00 in Berlin
  const tEnv = { daten: { verbunden: true, heute: '2026-09-28', fehler: [{ kalender: 2, meldung: 'Server nicht erreichbar' }], termine: [
    { titel: 'Geburtstag Anna', tag: '2026-09-28', beginn: '2026-09-27T22:00:00Z', ende: '2026-09-28T22:00:00Z', ganztag: true, kalender: 1 },
    { titel: 'Frühstück', tag: '2026-09-28', beginn: '2026-09-28T06:00:00Z', ende: '2026-09-28T07:00:00Z', ganztag: false, kalender: 1 },
    { titel: 'Zahnarzt', tag: '2026-09-28', beginn: '2026-09-28T12:00:00Z', ende: '2026-09-28T13:00:00Z', ganztag: false, kalender: 1 },
    { titel: 'Sport', tag: '2026-09-28', beginn: '2026-09-28T16:00:00Z', ende: '2026-09-28T17:00:00Z', ganztag: false, kalender: 1 },
    { titel: 'Elternabend', tag: '2026-09-30', beginn: '2026-09-30T17:00:00Z', ende: null, ganztag: false, kalender: 1 }
  ] } };
  const fe = { daten: { ...dienste.byId.feiertage.berechne('SN', '2026-09-28'), bundesland: 'Sachsen', kuerzel: 'SN', ferien: [] } };
  const k = kachel(fe, null, jetzt, 'Europe/Berlin', null, tEnv);
  assert.deepEqual([k.m, k.ms], ['14:00 Zahnarzt', '14:00']);                      // Frühstück ist vorbei
  assert.match(k.x, /^Danach 18:00 Sport · Tag der Deutschen Einheit Sa\., 3\.10\./);
  assert.deepEqual(k.tabs.map(t => t.id).slice(0, 2), ['naechste', 'termine']);
  assert.match(k.tabs[1].html, /Geburtstag Anna.*ganztägig.*Zahnarzt.*Elternabend.*Kalender 2: Server nicht erreichbar/s);
  // Nächste: Termine heute vor dem Rest, ganztägig zuerst
  assert.match(k.tabs[0].html, /Geburtstag Anna.*Frühstück.*Zahnarzt/s);
  // kleine Kachel: KW im Kopf, Liste untereinander – erst Termine (mit großer Zeile höchstens 3), dann Freies
  assert.equal(k.kopf, undefined);
  assert.match(k.chart, /KW 40/);                                                    // KW unten in der kleinen Kachel
  assert.deepEqual(k.liste.map(z => [z.d, z.t, z.gruppe]).slice(0, 3), [['heute', 'Geburtstag Anna', 1], ['18:00', 'Sport', 1], ['Sa., 3.10.', 'Tag der Deutschen Einheit', 2]]);
  assert.ok(!k.liste.some(z => z.t === 'Frühstück' || z.t === 'Zahnarzt'));        // vorbei bzw. schon in der großen Zeile
  // keine Termine heute → der nächste Termin steht trotzdem vorn
  const k2 = kachel(fe, null, jetzt, 'Europe/Berlin', null, { daten: { ...tEnv.daten, termine: tEnv.daten.termine.slice(4) } });
  assert.deepEqual([k2.m, k2.ms], ['Mi., 30.9. 19:00 Elternabend', 'Mi., 30.9.']);
  assert.equal(k2.liste[0].t, 'Tag der Deutschen Einheit');
  // öffentlich (ohne Termine): große Zeile = Feiertag, Liste ohne ihn
  const k3 = kachel(fe, null, jetzt);
  assert.equal(k3.m, 'Tag der Deutschen Einheit');
  assert.ok(!k3.liste.some(z => z.t === 'Tag der Deutschen Einheit'));
  // nicht verbunden / öffentlich
  assert.match(kachel(fe, null, jetzt, 'Europe/Berlin', null, { daten: { verbunden: false, heute: '2026-09-28', termine: [], fehler: [] } }).tabs[1].html, /Noch kein Kalender verbunden/);
  assert.ok(!kachel(fe, null, jetzt).tabs.some(t => t.id === 'termine'));
  // Frag DAILY
  assert.equal(termineAntwort('Was steht heute an?', tEnv, jetzt), 'Heute: Geburtstag Anna, 08:00 Frühstück, 14:00 Zahnarzt, 18:00 Sport.');
  assert.equal(termineAntwort('Was habe ich morgen?', tEnv, jetzt), 'Morgen stehen keine Termine an.');
  assert.equal(termineAntwort('Termine?', null, jetzt), null);
});

test('Einstellungen: Kachel-Formular, Wetter-Optionen, Kachel-Listen', async () => {
  // Formular je Kachel (rein)
  const ke = await esm('src/js/core/einstellungen.js');
  ke.kachelEinstellungen('probe', { felder: () => [{ typ: 'titel', label: 'Anzeigen' }, { typ: 'check', key: 'a', label: 'A <b>', wert: true },
    { typ: 'select', key: 's', label: 'S', wert: '7', optionen: [['16', '16 Tage'], ['7', '7 Tage']] }, { typ: 'text', key: 't', label: 'T', wert: 'x"y' }], speichern() {} });
  const html = ke.formular('probe');
  assert.ok(ke.hatEinstellungen('probe') && !ke.hatEinstellungen('gibtsnicht'));
  assert.match(html, /<form class="ke" data-ke="probe">.*type="checkbox" name="a" checked> A &lt;b&gt;.*<option value="7" selected>.*value="x&quot;y"/s);
  assert.doesNotMatch(html, /Speichern|type="submit"/);                              // kein Knopf – Änderungen gelten sofort
  // Wetter: Reiter aus, Start-Reiter, Mini-Diagramm 7 Tage; Unwetter bleibt vorn
  const { kachel, mitOptionen } = await esm('src/js/adapter/wetter.js');
  const w = (await rufe('wetter', { ort: 'Berlin' })).body, r = (await rufe('regen', { lat: '52.52', lon: '13.41' })).body;
  const C = k => k.kleinReiter.find(x => x.id === 'jetzt').unten;                      // Diagramm unter dem Zeitpunkt-Block im Reiter „Jetzt“
  const k = mitOptionen(kachel(w, r, null), w, { radar: false, mini: 7 });
  assert.deepEqual(k.kleinReiter.map(x => x.id), ['jetzt', 'mehr']);
  assert.equal(k.startReiter, 'jetzt');
  assert.match(C(k), /7 Tage: /);
  assert.equal(k.chart, '');                                                             // nicht mehr im Kopf der Kachel
  assert.deepEqual(mitOptionen(kachel(w, r, null), w, { mehr: false }).kleinReiter.map(x => x.id), ['jetzt', 'radar']);
  // Standard: Mini-Diagramm Heute (0–24 Uhr; Temperatur + Regen mm, Deckkraft nach Wahrscheinlichkeit)
  const k24 = mitOptionen(kachel(w, r, null), w, {});
  assert.match(C(k24), /data-mini-wahl="1" aria-pressed="true">Heute<.*<b class="wd-t-regen"[^>]*>Regen mm<\/b> · <b class="wd-t-max" title="Temperatur je Stunde, heute 0 bis 24 Uhr">Temperatur<\/b>/);
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
  assert.deepEqual(Object.keys(kk.zp), ['z', 't', 'g', 'i', 'l', 'mm', 'p', 'w', 's']);
  assert.equal(kk.zp.z, 'Jetzt');
  assert.match(kk.kopf, /class="wh-badge wd-radar" title="Regenradar: Regen in 20 Min\. \(leicht\)\.">☂ in 20 Min\. \(leicht\)<\/span>/);
  assert.doesNotMatch(C(k24), /wd-sonnen/);                                        // Sonne nur bei Tagen
  // 3 Tage: 12 Tageszeiten, Wochentag mittig je Tag, jeder zweite Tag hinterlegt, Sonne je Tageszeit; früher „48 Std.“ → 3 Tage
  const k48 = mitOptionen(kachel(w, r, null), w, { mini: 48 });
  assert.match(C(k48), /data-mini-wahl="3" aria-pressed="true">3 Tage</);
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
  // Kachel-Listen (rein)
  const kl = await esm('src/js/ui/kacheln.js');
  assert.deepEqual(kl.verschieben(['weather'], 'kalender').aktiv, ['weather', 'kalender']);
  assert.deepEqual(kl.verschieben(['weather', 'kalender'], 'weather').aktiv, ['kalender']);
  assert.match(kl.verschieben(['a', 'b'], 'c', 2).meldung, /Höchstens 2/);
  assert.deepEqual(kl.umsortieren(['a', 'b', 'c'], 'c', 0), ['c', 'a', 'b']);
  assert.deepEqual(kl.umsortieren(['a', 'b', 'c'], 'a', 5), ['b', 'c', 'a']);
  const frei = kl.verfuegbar(['weather'], false);
  assert.ok(!frei.includes('weather') && !frei.includes('news'));                   // aktive und private fehlen
  assert.equal(frei[0], 'kalender');                                                 // fertige zuerst
});

test('Finanzen: EZB-Kurse, Leitzinsen, Inflation; Kurse (Yahoo) nur privat; Kachel und Frag DAILY', async () => {
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
  assert.equal((await rufe('kurse')).body.fehler.code, 'nur_privat');
  process.env.DAILY_PRIVATE = '1';
  const k = await rufe('kurse');
  delete process.env.DAILY_PRIVATE;
  gueltig(k.body, require('../services/kurse').schema);
  assert.deepEqual(k.body.daten.werte.map(x => x.id), ['dax', 'sp500', 'world', 'btc', 'eth', 'gold']);
  assert.equal(k.body.daten.werte[0].aenderungProzent, 0.42);
  // Kachel
  const a = await esm('src/js/adapter/finanzen.js');
  // Mini-Reiter: Kurse · Zinsen & Inflation · (privat) Märkte · Spartipp
  const tipp = { kurz: 'Deckel auf den Topf', text: 'Deckel auf den Topf: spart Energie beim Kochen.' };
  const kk = a.kachel(r.body, null, {}, tipp), R = id => kk.kleinReiter.find(x => x.id === id);
  assert.deepEqual(kk.kleinReiter.map(x => x.id), ['kurse', 'zinsen', 'tipp']);                    // öffentlich ohne „Märkte“
  assert.ok(kk.kleinReiter.every(x => /^<svg class="ico"/.test(x.icon)));
  assert.match(R('kurse').kopf, /^<span class="fi-kopf">1 € = <b>1,\d{4} \$<\/b> <small class="fi-aend fi-(plus|minus)">[▲▼] 0,\d\d %<\/small><\/span>$/);
  assert.deepEqual(R('kurse').liste.map(l => l.d), ['£', 'CHF', 'zł', 'Kč']);
  assert.match(R('kurse').liste[0].tip, /^Brit\. Pfund|^Pfund|: 1 € = 0,\d{4} £ · Vortag/);
  assert.match(R('kurse').unten, /data-mini-wahl="30" aria-pressed="true">30 Tage<.*data-mini-wahl="90"/);
  assert.match(R('kurse').unten, /class="wd-kurs"/);
  assert.match(kk.x, /^1 € = 1,\d{4} \$ \([▲▼] 0,\d\d %\)\. Leitzins 2,00 %, Inflation 2,1 % \(August\)\. Stand /);
  assert.equal(R('zinsen').kopf, 'Leitzins <b>2,00 %</b> · Inflation <b>2,1 %</b>');
  assert.equal(R('zinsen').liste[0].d + ' ' + R('zinsen').liste[0].t, '2,00 % Einlagesatz · seit 11.6.2025');
  assert.match(R('zinsen').liste[0].tip, /\(vorher 2,50 %\) – derzeit der maßgebliche Leitzins/);
  assert.deepEqual(R('zinsen').liste.map(l => l.gruppe), [1, 1, 1, 2, 2]);                          // 3 Leitzinsen, dann Inflation DE und Euroraum
  assert.match(R('tipp').html, /spart Energie beim Kochen\.<\/p><p class="fi-text">Allgemeiner Tipp, keine Anlageempfehlung/);
  assert.equal(kk.tabs, undefined); assert.deepEqual(kk.liste, []);                                // kein Aufklappen mehr
  const opt = a.kachel(r.body, k.body, { haupt: 'CHF', weitere: ['USD'], zinsen: false, tage: 90, tipp: false }, tipp);
  assert.match(opt.kleinReiter[0].kopf, /1 € = <b>0,\d{4} CHF<\/b>/);
  assert.deepEqual(opt.kleinReiter.map(x => x.id), ['kurse', 'maerkte']);                         // Zinsen und Tipp abgewählt
  assert.match(opt.kleinReiter[0].unten, /data-mini-wahl="90" aria-pressed="true"/);
  assert.equal(opt.kleinReiter[1].liste[0].d + ' ' + opt.kleinReiter[1].liste[0].t.split('  ')[0], 'DAX 24.312 Pkt');
  assert.deepEqual(a.kachel(r.body, null, { zinsen: false, inflation: true }).kleinReiter.map(x => x.id), ['kurse', 'zinsen']);   // alte Einstellung: Inflation an
  assert.deepEqual(a.kachel(r.body, null, {}, null).kleinReiter.map(x => x.id), ['kurse', 'zinsen']);   // ohne Tagesinhalt kein Tipp
  assert.equal(a.kachel(null).state, 'error');
  // Frag DAILY
  assert.match(a.antwort('Wie steht der Dollar?', r.body), /^1 € = 1,\d{4} \$ \(US-Dollar\)/);
  assert.match(a.antwort('Was kosten 100 Franken?', r.body), /^100,00 CHF sind 10\d,\d\d € \(Referenzkurs der EZB/);
  assert.match(a.antwort('50 Euro in Pfund', r.body), /^50,00 € sind 4\d,\d\d £/);
  assert.match(a.antwort('Wie hoch ist der Leitzins?', r.body), /Einlagesatz\) liegt bei 2,00 %, seit 11\.6\.2025/);
  assert.match(a.antwort('Wie hoch ist die Inflation?', r.body), /^Deutschland: 2,1 % im August 2026, Euroraum: 2,2 %/);
  assert.match(a.antwort('Wie steht der DAX?', r.body, k.body), /^DAX: 24\.312 Pkt \(▲ 0,42 % zum Vortag\)/);
  assert.match(a.antwort('Wie steht der DAX?', r.body, null), /nur im privaten Betrieb/);
  assert.equal(a.antwort('Wie wird das Wetter?', r.body), null);
  const { pfadRund } = await esm('src/js/adapter/diagramm.js');
  const { kursSkala } = await esm('src/js/adapter/kursdiagramm.js');
  // runde Linie: Kurvensegmente, Endpunkte exakt, kein Überschwingen über den Höchstwert
  const rund = pfadRund([[0, 10], [10, 0], [20, 10], [30, 5]]);
  assert.match(rund, /^M0\.0,10\.0C.*20\.0,10\.0C.*30\.0,5\.0$/);
  assert.ok(rund.match(/-?[\d.]+/g).map(Number).filter((v, i) => i % 2 === 1).every(v => v >= 0 && v <= 10));
  assert.deepEqual(kursSkala(1.117, 1.163), { lo: 1.1, hi: 1.18, stufe: 0.02, stellen: 2 });
  assert.deepEqual(kursSkala(170, 181), { lo: 170, hi: 185, stufe: 5, stellen: 0 });
});

test('Tanken: Vertrag, alle Sorten mit einem Abruf, Günstigste/Durchschnitt, Schlüssel und Land; Ansicht und Frag DAILY', async () => {
  const w = dienste.byId.tanken;
  const d = w.umwandeln(fx.tanken(), 5);
  assert.deepEqual(pruefe(d, w.schema), []);
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
  assert.equal((await rufe('tanken', { lat: '51.05', lon: '13.74', umkreis: '7' })).body.daten.umkreisKm, 5);
  assert.equal((await rufe('tanken', { lat: '48.2', lon: '16.37', land: 'AT' })).body.fehler.code, 'nicht_unterstuetzt');
  if (alt === undefined) delete process.env.TANKERKOENIG_API_KEY; else process.env.TANKERKOENIG_API_KEY = alt;
  // Ansicht „Tanken“ der Kachel „Verkehr“ und Frag DAILY
  const a = await esm('src/js/adapter/tanken.js');
  assert.deepEqual([a.preis(1.749), a.preis(1.7), a.preis(null)], ['1,74⁹ €', '1,70⁰ €', '–']);
  const env = { ...r.body, daten: d };
  const v = a.ansicht(env, 'e10');
  assert.equal(v.kopf, 'E10 ab <b>1,68⁹ €</b><small class="vk-schnitt">Ø 1,71⁴</small>');         // Mini-Reiter: Kopf mit Durchschnitt
  assert.deepEqual(v.liste.map(z => z.d + ' ' + z.t), ['1,68⁹ Freie Tankstelle · 0,9 km', '1,68⁹ STAR · 3,8 km', '1,72⁹ Shell · 1,1 km', '1,74⁹ ARAL · 2,4 km']);   // alle geöffneten, günstigste zuerst
  assert.match(v.liste[0].tip, /Budapester Str\. 1, Dresden · E10 1,68⁹ · E5 1,74⁹ · Diesel 1,59⁹$/);
  assert.equal(v.html, undefined);                                                                 // kein Aufklappen mehr
  assert.doesNotMatch(v.liste.map(z => z.t).join(), /JET/);                                         // geschlossene fehlen
  assert.equal(a.ansicht(env, 'unsinn').kopf, v.kopf);                                            // unbekannte Sorte → E10
  const leer = a.ansicht({ ...env, daten: { ...d, guenstigste: { e5: null, e10: null, diesel: null } } }, 'diesel');
  assert.match(leer.x, /keine Tankstelle mit Diesel geöffnet/);
  assert.match(a.antwort('Wo ist Diesel gerade günstig?', env), /^Am günstigsten für Diesel: STAR, Karlsruher Str\. 85, Dresden \(3,8 km\) mit 1,58⁹ €/);
  assert.equal(a.antwort('Wie wird das Wetter?', env), null);
  assert.equal(a.antwort('Was kostet Sprit?', null), 'Die Spritpreise sind gerade nicht erreichbar.');
});

test('Autobahn: Vertrag, Arten, Zeiten aus dem Text, Eingaben, fehlende Autobahn; Arbeitsweg-Ansicht und Frag DAILY', async () => {
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
  assert.deepEqual(pruefe({ strassen: ['A4'], fehlend: [], meldungen: ms }, w.schema), []);
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
  const r = await rufe('autobahn', { strassen: 'A13,a4' });
  assert.equal(r.code, 200);
  gueltig(r.body, w.schema);
  assert.deepEqual([r.body.daten.strassen, r.body.ort, r.body.daten.meldungen.at(-1).strasse], [['A4', 'A13'], null, 'A13']);
  assert.equal(Date.parse(r.body.gueltigBis) % 300e3, 0);
  assert.deepEqual((await rufe('autobahn', { strassen: 'A4,A999' })).body.daten.fehlend, ['A999']);
  assert.deepEqual([(await rufe('autobahn', {})).body.fehler.code, (await rufe('autobahn', { strassen: 'B96' })).body.fehler.code,
    (await rufe('autobahn', { strassen: 'A1,A2,A3,A4,A5,A6' })).body.fehler.code, (await rufe('autobahn', { strassen: 'A999' })).code],
    ['eingabe_fehlt', 'eingabe_ungueltig', 'eingabe_ungueltig', 502]);
  // Ansicht „Arbeitsweg“: nur Meldungen nahe der Strecke Dresden → Chemnitz (Köln und Aachen fallen weg)
  const a = await esm('src/js/adapter/autobahn.js');
  const start = { name: 'Dresden', lat: 51.05, lon: 13.74 }, ziel = { name: 'Chemnitz', lat: 50.83, lon: 12.92 };
  assert.ok(Math.abs(a.luftlinieKm(start, ziel) - 62.6) < 1);
  assert.equal(Math.round(a.korridorKm(start, ziel)), 16);                                             // ¼ der Luftlinie > 10 km
  assert.equal(a.korridorKm(start, { lat: 51.0, lon: 13.7 }), 10);
  const env = r.body, v = a.ansicht(env, { start, ziel });
  assert.equal(v.kopf, '<b>Dresden → Chemnitz</b> <small>A4 · A13</small>');
  assert.deepEqual(v.liste.map(z => z.d + ' ' + z.t), ['+14 min A4 Wilsdruff – Nossen · stockender Verkehr',
    'Achtung A4 Hainichen – Chemnitz-Ost · Gegenstände auf der Fahrbahn', 'ab 21 Uhr A4 Siebenlehn – Nossen · Sperrung',
    'gesperrt A4 Dresden-Altstadt · Anschlussstelle gesperrt', 'bis ' + v.liste[4].d.slice(4) + ' A4 Wilsdruff – Dresden-Altstadt · Tagesbaustelle', '1 Baustelle']);   // alle am Weg, Baustellen als eine Zeile
  assert.match(v.liste[5].tip, /^A4 Hainichen – Siebenlehn · bis [\d.]+ · 80 km\/h$/);
  assert.match(v.liste[0].tip, /Richtung Chemnitz\nstockender Verkehr · 25 km\/h · seit /);
  assert.equal(v.x, '1 Stau (bis +14 min), 1 Sperrung, 1 Baustelle.');
  assert.doesNotMatch(JSON.stringify(v.liste), /Köln|Aachen|Ruhland/);
  assert.equal(v.html, undefined);                                                                 // kein Aufklappen mehr
  assert.equal(v.bereich, 'Meldungen bis 16 km neben der Luftlinie Dresden → Chemnitz, beide Richtungen');
  // Ohne Start/Ziel alle Meldungen; ohne Meldungen „frei“; ohne Daten
  const alle = a.ansicht(env, {});
  assert.equal(alle.liste[0].t, 'A4 Frechen-Nord – Köln-Eifeltor · stockender Verkehr');
  const ruhig = a.ansicht({ ...env, daten: { ...env.daten, meldungen: env.daten.meldungen.filter(m => m.typ === 'baustelle') } }, { start, ziel });
  assert.deepEqual([ruhig.ms, ruhig.x, ruhig.liste.map(z => z.d + ' ' + z.t)], ['frei', 'Keine Staus oder Sperrungen · 1 Baustelle.', ['✓ Keine Staus oder Sperrungen', '1 Baustelle']]);
  assert.match(a.ansicht(null).x, /nicht erreichbar/);
  // Zeiten: nächtliche Sperrung läuft nur in ihrem Zeitraum
  const z = { typ: 'sperrung', kuenftig: true, beginn: '2026-10-12T19:00:00Z', ende: '2026-10-27T04:00:00Z', zeitraeume: t.zeitraeume };
  assert.deepEqual([a.aktiv(z, Date.parse('2026-10-12T20:00:00Z')), a.aktiv(z, Date.parse('2026-10-13T12:00:00Z'))], [true, false]);
  assert.equal(a.status(z, Date.parse('2026-10-13T12:00:00Z')), 'ab 26.10.');
  assert.equal(a.status(z, Date.parse('2026-10-12T20:00:00Z')), 'bis morgen 5 Uhr');
  assert.equal(a.wann(Date.parse('2026-10-15T19:00:00Z'), Date.parse('2026-10-13T12:00:00Z')), 'Do 21 Uhr');
  // Frag DAILY
  const o = { start, ziel, strassen: ['A4', 'A13'] };
  assert.match(a.antwort('Wie ist mein Arbeitsweg?', env, o), /^A4, A13 \(Dresden → Chemnitz\): stockender Verkehr A4 Wilsdruff – Nossen Richtung Chemnitz \(\+14 min\)/);
  assert.match(a.antwort('Stau auf der A4?', env, o), /Frechen-Nord/);                                  // gezielte Frage: ganze Autobahn
  assert.match(a.antwort('Was ist auf der A7 los?', env, o), /^A7 ist nicht in deinem Arbeitsweg/);
  assert.match(a.antwort('Stau?', env, { start, ziel, strassen: [] }), /Autobahnen eintragen/);
  assert.equal(a.antwort('Wann fährt die Bahn?', env, o), null);
  assert.deepEqual([a.strassenVon('a4, A 13'), a.strassenVon('B96')], [['A4', 'A13'], null]);
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
