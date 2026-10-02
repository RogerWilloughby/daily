// Adapter „regen“: macht aus dem Vertrag regen v1 den Hinweis für die Wetterkachel und den Reiter „Radar“ (ohne DOM, testbar).
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const komma = v => String(v).replace('.', ',');
export const STUFE_TEXT = { kein: 'kein Regen', leicht: 'leicht', maessig: 'mäßig', stark: 'stark', sehr_stark: 'sehr stark' };
const RICHTUNG_TEXT = { N: 'nördlich', NO: 'nordöstlich', O: 'östlich', SO: 'südöstlich', S: 'südlich', SW: 'südwestlich', W: 'westlich', NW: 'nordwestlich' };
const min = m => (m >= 60 ? `${Math.floor(m / 60)} Std. ${m % 60 ? (m % 60) + ' Min.' : ''}`.trim() : `${m} Min.`);

// Kurzer Hinweis für die Kachel – nur wenn er etwas sagt (sonst null)
export function hinweis(env) {
  if (!env || !env.daten) return null;
  const d = env.daten;
  if (d.regnet) return d.endet ? `Regen hört in ${min(d.endet.inMinuten)} auf.` : `Regen (${STUFE_TEXT[d.jetzt.stufe]}), hält an.`;
  if (d.beginnt) return `Regen in ${min(d.beginnt.inMinuten)} (${STUFE_TEXT[d.verlauf.find(v => v.stufe !== 'kein')?.stufe] || 'leicht'}).`;
  if (d.naehe && d.naehe.entfernungKm <= 15) return `Regen ${d.naehe.entfernungKm} km ${RICHTUNG_TEXT[d.naehe.richtung]}.`;
  return null;
}

// Radarkarte auf der Landkarte: Kacheln von basemap.de (über /api/karte, Web Mercator, Zoom 9) im Quadrat ±48 km um den Ort,
// darüber das Radarraster, per Matrix aus den Ecken (karte.ecken) auf die Karte gelegt. Ein Bild je 15 Minuten (−60 min bis +2 Std.);
// sichtbar ist das Bild mit „rk-an“ – ansichten/radar.js lässt die Bilder laufen und bedient die Zeitleiste. Ohne Ecken: Raster ohne Landkarte.
export const KARTE_ZOOM = 9, KARTE_HALB_KM = 48;   // Ausschnitt ±48 km: das Radar (±51 Pixel, je nach Breite 0,95–1 km) deckt ihn ganz ab
const KACHEL = 256, ERDE_M = 40075016.686;
export function merc(lat, lon, z = KARTE_ZOOM) {
  const n = KACHEL * 2 ** z;
  return { x: (lon + 180) / 360 * n, y: (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n };
}
const mProPx = (lat, z = KARTE_ZOOM) => ERDE_M * Math.cos(lat * Math.PI / 180) / (KACHEL * 2 ** z);
const f1 = v => (Math.round(v * 10) / 10).toString();
const f4 = v => (Math.round(v * 1e4) / 1e4).toString();

// Zellen einer Zeile mit gleicher Stufe zu einem Rechteck zusammenfassen (weniger Elemente)
function zellen(stufen, breite) {
  let out = '';
  for (let j = 0; j < stufen.length;) {
    const s = stufen.charCodeAt(j) - 48, x = j % breite;
    let n = 1;
    while (x + n < breite && stufen.charCodeAt(j + n) - 48 === s) n++;
    if (s > 0) out += `<rect class="rs${s}" x="${x}" y="${Math.floor(j / breite)}" width="${n + 0.02}" height="1.02"/>`;
    j += n;
  }
  return out;
}

// Index des Bilds „jetzt“ (jüngste Messung)
export const jetztIndex = (k, jetztZeit) => {
  const i = k.bilder.findIndex(b => b.zeit === jetztZeit);
  if (i >= 0) return i;
  const g = k.bilder.map(b => b.gemessen).lastIndexOf(true);
  return g >= 0 ? g : 0;
};

export function karte(k, ort, jetztZeit) {
  if (!k || !k.bilder || !k.bilder.length) return '';
  const j = jetztIndex(k, jetztZeit), land = !!(k.ecken && ort && Number.isFinite(ort.lat) && Number.isFinite(ort.lon));
  let seite, grund, matrix, ox, oy, ring;
  if (land) {
    const o = merc(ort.lat, ort.lon), halb = KARTE_HALB_KM * 1000 / mProPx(ort.lat), x0 = o.x - halb, y0 = o.y - halb;
    seite = 2 * halb; ox = halb; oy = halb; ring = 10000 / mProPx(ort.lat);
    const kacheln = [];
    for (let ty = Math.floor(y0 / KACHEL); ty <= Math.floor((y0 + seite) / KACHEL); ty++)
      for (let tx = Math.floor(x0 / KACHEL); tx <= Math.floor((x0 + seite) / KACHEL); tx++)
        kacheln.push(`<image href="/api/karte?z=${KARTE_ZOOM}&amp;x=${tx}&amp;y=${ty}" x="${f1(tx * KACHEL - x0)}" y="${f1(ty * KACHEL - y0)}" width="${KACHEL + 0.5}" height="${KACHEL + 0.5}"/>`);
    grund = `<rect class="rk-grund" width="${f1(seite)}" height="${f1(seite)}"/><g class="rk-land">${kacheln.join('')}</g>`;
    const P = e => { const m = merc(e.lat, e.lon); return [m.x - x0, m.y - y0]; };
    const [nw, ne, sw] = [P(k.ecken.nw), P(k.ecken.ne), P(k.ecken.sw)];
    matrix = [(ne[0] - nw[0]) / k.breite, (ne[1] - nw[1]) / k.breite, (sw[0] - nw[0]) / k.hoehe, (sw[1] - nw[1]) / k.hoehe, nw[0], nw[1]];
  } else {
    seite = Math.max(k.breite, k.hoehe); ox = k.ortX; oy = k.ortY; ring = 10 / k.zelleKm;
    grund = `<rect class="rk-grund" width="${k.breite}" height="${k.hoehe}"/>`;
    matrix = [1, 0, 0, 1, 0, 0];
  }
  const s = seite / 100;   // Schrift und Striche relativ zur Kartengröße
  const bilder = k.bilder.map((b, i) => `<g class="rk-bild${i === j ? ' rk-an' : ''}" data-i="${i}">${zellen(b.stufen, k.breite)}</g>`).join('');
  return `<svg class="rk${land ? ' rk-mit-land' : ''}" viewBox="0 0 ${f1(seite)} ${f1(seite)}" role="img" aria-label="Radarkarte, etwa 100 × 100 km, ${k.bilder.length} Bilder von einer Stunde zurück bis 2 Stunden voraus">` +
    grund + `<g class="rk-radar" transform="matrix(${matrix.map(f4).join(' ')})">${bilder}</g>` +
    `<circle class="rk-ring" cx="${f1(ox)}" cy="${f1(oy)}" r="${f1(ring)}" style="stroke-width:${f1(s * 0.35)};stroke-dasharray:${f1(s)} ${f1(s)}"/>` +
    `<circle class="rk-ort" cx="${f1(ox)}" cy="${f1(oy)}" r="${f1(s * 1.1)}" style="stroke-width:${f1(s * 0.5)}"/>` +
    `<text class="rk-n" x="${f1(s * 2)}" y="${f1(s * 4.5)}" style="font-size:${f1(s * 3.2)}px">N ↑</text>` +
    `<text class="rk-n" x="${f1(s * 2)}" y="${f1(seite - s * 2)}" style="font-size:${f1(s * 3.2)}px">Ring 10 km</text></svg>`;
}

// Zeitleiste unter der Karte: Start/Pause, ein Feld je Bild (Beschriftung bei −60, jetzt, +1 Std., +2 Std.), Uhrzeit des gezeigten Bilds
function leiste(k, uhr, j) {
  const minuten = b => Math.round((Date.parse(b.zeit) - Date.parse(k.bilder[j].zeit)) / 60e3);
  const titel = b => `${uhr(b.zeit)} Uhr · ${b.gemessen ? 'gemessen' : 'Vorhersage'}`;
  const marke = m => (m === 0 ? 'jetzt' : m === -60 ? '−1 Std.' : m === 60 ? '+1 Std.' : m === 120 ? '+2 Std.' : '');
  return `<div class="rk-leiste" data-jetzt="${j}"><button type="button" class="rk-start" aria-label="Anhalten" title="Anhalten">❚❚</button>` +
    `<div class="rk-felder" role="group" aria-label="Zeitpunkt der Radarkarte">${k.bilder.map((b, i) => `<button type="button" data-rk-bild="${i}" class="${b.gemessen ? '' : 'rk-vh'}" aria-pressed="${i === j}" title="${esc(titel(b))}"><i></i><span>${esc(marke(minuten(b)))}</span></button>`).join('')}</div>` +
    `<span class="rk-uhr" aria-live="off">${esc(titel(k.bilder[j]))}</span></div>`;
}

// Mini-Reiter „Radar“ (kleine Kachel): links die Karte mit Zeitleiste, so hoch wie das Feld; rechts die Werte (was nicht passt, wird abgeschnitten).
// Legende und Quellen stehen im (i)-Feld der Kachel (radarInfo).
export function radarKlein(env, uhr) {
  if (!env || !env.daten || !env.daten.karte) return '';
  const d = env.daten, k = d.karte;
  const lage = d.beginnt ? `Regen ab ${uhr(d.beginnt.zeit)}` : d.endet ? `endet ${uhr(d.endet.zeit)}` : d.regnet ? 'Regen hält an' : 'trocken';
  const werte = [
    ['Jetzt', d.regnet ? `${STUFE_TEXT[d.jetzt.stufe]}, ${komma(d.jetzt.mmH)} mm/h` : 'trocken'],
    ['2 Std.', lage + (d.maxMmH ? ` · bis ${komma(d.maxMmH)} mm/h` : '')],
    ['Nähe', d.naehe ? (d.naehe.entfernungKm === 0 ? `am Ort (${STUFE_TEXT[d.naehe.stufe]})` : `${d.naehe.entfernungKm} km ${RICHTUNG_TEXT[d.naehe.richtung]}`) : 'nichts bis 25 km'],
    ['Letzte Std.', `${komma((d.letzteStunde || {}).summeMm ?? 0)} mm`]
  ];
  return `<div class="rk-klein"><div class="rk-karte">${karte(k, env.ort, d.jetzt.zeit)}${leiste(k, uhr, jetztIndex(k, d.jetzt.zeit))}</div>` +
    `<dl class="rk-werte">${werte.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl></div>`;
}
// Kopf des Reiters „Radar“ und Angaben fürs (i)-Feld
export const radarKopf = env => hinweis(env) || (env && env.daten && env.daten.regnet ? 'Regen am Ort' : 'Kein Regen in der Nähe');
export const radarInfo = env => (env && env.daten ? ['Radar: Deutscher Wetterdienst (über Bright Sky), Bild alle 15 Min. von −1 bis +2 Std.',
  ...(env.daten.karte && env.daten.karte.ecken ? [`Karte: © GeoBasis-DE / BKG (${String(env.erstellt || '').slice(0, 4)}), basemap.de`] : []),
  'Stufen: leicht · mäßig · stark · sehr stark (je dunkler, desto stärker)'] : []);

