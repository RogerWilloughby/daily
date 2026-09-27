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
  assert.equal(r.daten.tage.length, 7);
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
  assert.deepEqual(r.body.ort, { name: 'Berlin', region: 'Berlin', land: 'DE', lat: 52.52, lon: 13.41, zeitzone: 'Europe/Berlin' });
  assert.match(r.headers['cache-control'], /s-maxage=900/);
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

test('Ortssuche und Katalog', async () => {
  const o = await rufe('ort', { q: 'Dresden' });
  assert.equal(o.code, 200);
  gueltig(o.body, dienste.byId.ort.schema);
  assert.equal(o.body.daten.orte[0].region, 'Sachsen');
  const k = await rufe('dienste');
  gueltig(k.body);
  const ids = k.body.daten.dienste.map(d => d.id);
  assert.ok(ids.includes('wetter') && ids.includes('ort'));
  for (const d of k.body.daten.dienste) {
    for (const f of ['id', 'version', 'titel', 'beschreibung', 'eingaben', 'klasse', 'ttl', 'quellen', 'schema']) assert.ok(d[f] != null, `${d.id}.${f} fehlt`);
  }
});

test('Adapter Wetter: Kachel und Antwort aus dem Vertrag', async () => {
  const { kachel, antwort: text } = await esm('src/js/adapter/wetter.js');
  const env = (await rufe('wetter', { ort: 'Berlin' })).body;
  const k = kachel(env);
  assert.equal(k.title, 'Wetter Berlin');
  assert.equal(k.m, '15°');
  assert.match(k.x, /Teilweise bewölkt, gefühlt 14°/);
  assert.ok(k.rows.some(([l]) => l === 'Luftqualität'));
  assert.ok(k.rows.some(([l]) => l === 'Morgen'));
  assert.match(text(env), /^Berlin: jetzt 15°/);
});
