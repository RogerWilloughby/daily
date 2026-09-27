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

// Radarkarte: Zellen je Stufe, Bilder alle 15 Minuten als Animation (ohne Skript), Ort in der Mitte, Ring 10 km
function karte(k, zeitText) {
  if (!k || !k.bilder || !k.bilder.length) return '';
  const n = k.bilder.length, id = 'rk' + Math.random().toString(36).slice(2, 7), pro = 100 / n;
  const bilder = k.bilder.map((b, i) => {
    let zellen = '';
    for (let j = 0; j < b.stufen.length; j++) {
      const s = b.stufen.charCodeAt(j) - 48;
      if (s > 0) zellen += `<rect class="rs${s}" x="${j % k.breite}" y="${Math.floor(j / k.breite)}" width="1.02" height="1.02"/>`;
    }
    return `<g class="${id}${i ? ' rk-weiter' : ''}" style="animation-delay:${i - n}s">${zellen}` +
      `<text class="rk-zeit" x="${k.breite - 0.6}" y="1.6" text-anchor="end">${esc(zeitText(b))}</text></g>`;
  }).join('');
  const r = 10 / k.zelleKm;
  return `<svg class="rk" viewBox="0 0 ${k.breite} ${k.hoehe}" role="img" aria-label="Radarkarte, ${n} Bilder bis in 2 Stunden">` +
    `<style>@keyframes ${id}{0%,${(pro - 0.01).toFixed(2)}%{opacity:1}${pro.toFixed(2)}%,100%{opacity:0}}` +
    `.${id}{animation:${id} ${n}s infinite}@media (prefers-reduced-motion:reduce){.${id}{animation:none}.rk-weiter{display:none}}</style>` +
    `<rect class="rk-grund" width="${k.breite}" height="${k.hoehe}"/>${bilder}` +
    `<circle class="rk-ring" cx="${k.ortX}" cy="${k.ortY}" r="${r}"/><circle class="rk-ort" cx="${k.ortX}" cy="${k.ortY}" r="0.7"/>` +
    `<text class="rk-n" x="0.8" y="1.8">N ↑</text><text class="rk-n" x="0.8" y="${k.hoehe - 0.8}">Ring 10 km</text></svg>`;
}

// Verlauf der nächsten 2 Stunden als Balken (mm/h), Hinweis je 5 Minuten
function verlauf(v, uhr, stand = '') {
  if (!v || v.length < 2) return '';
  const W = 300, H = 92, L = 22, B = 74, n = v.length, sp = (W - L - 4) / n;
  const max = Math.max(2.5, ...v.map(x => x.mmH || 0));
  const out = [`<text class="wd-achse" x="${L}" y="9">Regen am Ort, mm/h${stand ? ' · DWD-Radar ' + esc(stand) : ''}</text>`, `<line class="wd-gitter" x1="${L}" x2="${W - 4}" y1="${B}" y2="${B}"/>`,
    `<text class="wd-achse" x="${L - 3}" y="${B - (B - 14) + 3}" text-anchor="end">${komma(Math.round(max * 10) / 10)}</text>`];
  v.forEach((x, i) => {
    const h = ((x.mmH || 0) / max) * (B - 14), s = ['kein', 'leicht', 'maessig', 'stark', 'sehr_stark'].indexOf(x.stufe);
    if (h > 0) out.push(`<rect class="rs${Math.max(1, s)}${x.gemessen ? '' : ' wd-blass'}" x="${(L + sp * i + 0.5).toFixed(1)}" y="${(B - h).toFixed(1)}" width="${Math.max(1, sp - 1).toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" rx="1"/>`);
    const m = i * 5;
    if (m % 30 === 0) out.push(`<text class="wd-achse" x="${(L + sp * (i + 0.5)).toFixed(1)}" y="${B + 12}" text-anchor="middle">${m ? '+' + m : 'jetzt'}</text>`);
    const tip = esc(`${uhr(x.zeit)} Uhr${x.gemessen ? '' : ' (Vorhersage)'}: ${x.stufe === 'kein' ? 'kein Regen' : komma(x.mmH) + ' mm/h, ' + STUFE_TEXT[x.stufe]}`);
    out.push(`<rect class="wd-spalte" x="${(L + sp * i).toFixed(1)}" y="12" width="${sp.toFixed(1)}" height="${B - 12 + 14}" data-tip="${tip}"><title>${tip}</title></rect>`);
  });
  return `<figure class="wd-figur rk-verlauf"><svg class="wd wd-gross" viewBox="0 0 ${W} ${H}" role="img" aria-label="Regen am Ort in den nächsten 2 Stunden">${out.join('')}</svg><div class="wd-tip" hidden></div></figure>`;
}

// Reiter „Radar“: Karte links, rechts Verlauf und Kennzahlen
export function radarReiter(env, uhr) {
  if (!env || !env.daten) return '';
  const d = env.daten;
  const zeilen = [];
  zeilen.push(['Jetzt', d.regnet ? `${STUFE_TEXT[d.jetzt.stufe]}, ${komma(d.jetzt.mmH)} mm/h` : 'trocken']);
  const lage = d.beginnt ? `Regen ab ${uhr(d.beginnt.zeit)} (in ${min(d.beginnt.inMinuten)})` : d.endet ? `endet ${uhr(d.endet.zeit)} (in ${min(d.endet.inMinuten)})` : d.regnet ? 'Regen hält an' : 'trocken';
  zeilen.push(['Nächste 2 Std.', lage + (d.maxMmH ? ` · bis ${komma(d.maxMmH)} mm/h` : '')]);
  zeilen.push(['In der Nähe', d.naehe ? (d.naehe.entfernungKm === 0 ? `am Ort (${STUFE_TEXT[d.naehe.stufe]})` : `${d.naehe.entfernungKm} km ${RICHTUNG_TEXT[d.naehe.richtung]} (${STUFE_TEXT[d.naehe.stufe]})`) : 'kein Regen im Umkreis von 25 km']);
  const ls = d.letzteStunde || {};
  zeilen.push(['Letzte Stunde', `${komma(ls.summeMm ?? 0)} mm${ls.aufgehoertVorMinuten != null ? `, aufgehört vor ${min(ls.aufgehoertVorMinuten)}` : ''}`]);
  const dl = '<dl class="rk-werte">' + zeilen.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('') + '</dl>';
  const legende = '<div class="wd-legende rk-legende"><span><i class="rs1"></i>leicht</span><span><i class="rs2"></i>mäßig</span><span><i class="rs3"></i>stark</span><span><i class="rs4"></i>sehr stark</span></div>';
  return `<div class="rk-feld"><div class="rk-karte">${karte(d.karte, b => uhr(b.zeit) + (b.gemessen ? '' : ' ▸'))}</div>` +
    `<div class="rk-rechts">${verlauf(d.verlauf, uhr, uhr(d.jetzt.zeit))}${legende}</div>${dl}</div>`;
}
