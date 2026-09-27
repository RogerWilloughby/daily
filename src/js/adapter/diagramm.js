// Wetter-Diagramme als HTML/SVG-Text (ohne DOM, testbar). Farben über CSS-Klassen (app.css, .wd-*), damit Hell/Dunkel/aktive Kachel passen.
// Einheitliche Farben: Höchstwert orange, Tiefstwert blau, Niederschlag grün, Sonne gelb – für Linien, Balken UND die zugehörigen Zahlen.
// Keine zweite Y-Achse: Temperatur, Niederschlag und Sonne stehen in getrennten Feldern übereinander, mit gemeinsamer Zeitachse.
const r0 = v => (v == null ? '–' : Math.round(v));
const komma = v => String(v).replace('.', ',');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Werte → y-Koordinaten eines Feldes (oben = max)
function skala(min, max, oben, unten) {
  const spanne = max - min || 1;
  return v => unten - ((v - min) / spanne) * (unten - oben);
}
const pfad = pts => pts.filter(p => p[1] != null && Number.isFinite(p[1])).map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');

// Linie in zwei Teilen: belastbare Punkte durchgezogen (bis Index „bis“), danach gestrichelt
function linie(xs, ys, bis, klasse) {
  const a = xs.map((x, i) => [x, ys[i]]);
  const fest = a.slice(0, bis + 1), trend = a.slice(bis);
  return `<path class="${klasse}" d="${pfad(fest)}"/>` + (trend.length > 1 ? `<path class="${klasse} wd-trend" d="${pfad(trend)}"/>` : '');
}
const bisVorTrend = tage => { const ab = tage.findIndex(t => t.trend); return ab < 0 ? tage.length : ab - 1; };

// Mini-Diagramm für die kleine Kachel: beschriftet mit höchstem/tiefstem Wert (in Linienfarbe) und einer Legende
export function miniDiagramm(tage) {
  if (!tage || tage.length < 2) return '';
  const W = 160, H = 34, n = tage.length;
  const tmin = Math.min(...tage.map(t => t.minC ?? Infinity)), tmax = Math.max(...tage.map(t => t.maxC ?? -Infinity));
  const y = skala(tmin, tmax, 2, 24), x = i => 2 + i * (W - 4) / (n - 1);
  const xs = tage.map((_, i) => x(i));
  const regenMax = Math.max(4, ...tage.map(t => t.niederschlagMm || 0));
  const bw = Math.max(2, (W - 4) / n - 2);
  const balken = tage.map((t, i) => {
    const h = Math.round(((t.niederschlagMm || 0) / regenMax) * 6 * 10) / 10;
    return h > 0 ? `<rect class="wd-regen${t.trend ? ' wd-blass' : ''}" x="${Math.min(W - bw, Math.max(0, x(i) - bw / 2)).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h}" rx="1"/>` : '';
  }).join('');
  const bis = bisVorTrend(tage);
  const svg = `<svg class="wd wd-mini" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">` +
    linie(xs, tage.map(t => t.maxC == null ? null : y(t.maxC)), bis, 'wd-max') +
    linie(xs, tage.map(t => t.minC == null ? null : y(t.minC)), bis, 'wd-min') + balken + '</svg>';
  return `<div class="wd-minibox" role="img" aria-label="${n} Tage: Höchstwerte bis ${r0(tmax)}°, Tiefstwerte bis ${r0(tmin)}°, Balken: Regen">` +
    `<div class="wd-miniskala"><b class="wd-t-max">${r0(tmax)}°</b><b class="wd-t-min">${r0(tmin)}°</b></div>${svg}</div>` +
    `<div class="wd-minilegende">${n} Tage: <b class="wd-t-max">Höchst</b> · <b class="wd-t-min">Tiefst</b> · <b class="wd-t-regen">Regen</b></div>`;
}

// Hover-Hinweis für ein Diagramm (Text je Spalte steht in data-tip)
const hinweisFeld = '<div class="wd-tip" hidden></div>';

// 16-Tage-Diagramm: drei Felder (Temperatur, Niederschlag, Sonne), Trendbereich hinterlegt; beschreibe(t) liefert den Zustandstext.
export function tageDiagramm(tage, wtag, beschreibe = () => '') {
  if (!tage || tage.length < 2) return '';
  const n = tage.length, W = 420, L = 26, R = 4, spalte = (W - L - R) / n;
  const T0 = 18, T1 = 108, N0 = 126, N1 = 152, S0 = 170, S1 = 194, A = 208, H = 219;
  const cx = i => L + spalte * (i + 0.5);
  const trendAb = tage.findIndex(t => t.trend);
  const tmin = Math.floor(Math.min(...tage.map(t => t.minC ?? Infinity)) / 5) * 5;
  const tmax = Math.ceil(Math.max(...tage.map(t => t.maxC ?? -Infinity)) / 5) * 5;
  const yT = skala(tmin, tmax, T0, T1);
  const nMax = Math.max(5, Math.ceil(Math.max(...tage.map(t => t.niederschlagMm || 0))));
  const sMax = Math.max(12, Math.ceil(Math.max(...tage.map(t => t.sonnenstunden || 0))));
  const bw = Math.max(3, spalte - 4);
  const out = [];
  if (trendAb > 0) out.push(`<rect class="wd-trendfeld" x="${L + spalte * trendAb}" y="${T0 - 12}" width="${spalte * (n - trendAb)}" height="${S1 - T0 + 12}"/>`,
    `<text class="wd-achse" x="${L + spalte * trendAb + 4}" y="${T0 - 3}">Trend</text>`);
  out.push(`<text class="wd-achse" x="${L}" y="${T0 - 3}">Temperatur °C</text>`,
    `<text class="wd-achse" x="${L}" y="${N0 - 4}">Niederschlag, mm (Skala bis ${nMax})</text>`,
    `<text class="wd-achse" x="${L}" y="${S0 - 4}">Sonne, Std. (Skala bis ${sMax})</text>`);
  for (let v = tmin; v <= tmax; v += 5) {
    out.push(`<line class="wd-gitter" x1="${L}" x2="${W - R}" y1="${yT(v).toFixed(1)}" y2="${yT(v).toFixed(1)}"/>`,
      `<text class="wd-achse" x="${L - 4}" y="${(yT(v) + 3).toFixed(1)}" text-anchor="end">${v}°</text>`);
  }
  out.push(`<line class="wd-gitter" x1="${L}" x2="${W - R}" y1="${N1}" y2="${N1}"/>`, `<line class="wd-gitter" x1="${L}" x2="${W - R}" y1="${S1}" y2="${S1}"/>`);
  const xs = tage.map((_, i) => cx(i)), bis = bisVorTrend(tage);
  out.push(linie(xs, tage.map(t => t.maxC == null ? null : yT(t.maxC)), bis, 'wd-max'),
    linie(xs, tage.map(t => t.minC == null ? null : yT(t.minC)), bis, 'wd-min'));
  // Zahlen am ersten Tag in derselben Farbe wie die Linie
  if (tage[0].maxC != null) out.push(`<text class="wd-wert wd-t-max" x="${cx(0)}" y="${(yT(tage[0].maxC) - 6).toFixed(1)}" text-anchor="middle">${r0(tage[0].maxC)}°</text>`);
  if (tage[0].minC != null) out.push(`<text class="wd-wert wd-t-min" x="${cx(0)}" y="${(yT(tage[0].minC) + 13).toFixed(1)}" text-anchor="middle">${r0(tage[0].minC)}°</text>`);
  tage.forEach((t, i) => {
    const x = cx(i) - bw / 2, blass = t.trend ? ' wd-blass' : '';
    const hn = ((t.niederschlagMm || 0) / nMax) * (N1 - N0), hs = ((t.sonnenstunden || 0) / sMax) * (S1 - S0);
    if (hn > 0) out.push(`<rect class="wd-regen${blass}" x="${x.toFixed(1)}" y="${(N1 - hn).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, hn).toFixed(1)}" rx="2"/>`);
    if (hs > 0) out.push(`<rect class="wd-sonne${blass}" x="${x.toFixed(1)}" y="${(S1 - hs).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, hs).toFixed(1)}" rx="2"/>`);
    // Sonne unbekannt (Quelle liefert nichts): „?“ statt Balken, damit es nicht wie „0 Stunden“ aussieht
    if (t.sonnenstunden == null) out.push(`<text class="wd-achse" x="${cx(i)}" y="${S1 - 2}" text-anchor="middle">?</text>`);
    const [wt, dt] = wtag(t.datum).split(/,?\s+/);
    out.push(`<text class="wd-achse" x="${cx(i)}" y="${A}" text-anchor="middle">${wt}</text>`,
      `<text class="wd-achse" x="${cx(i)}" y="${H}" text-anchor="middle">${dt || ''}</text>`);
    const sonne = t.sonnenstunden == null ? 'Sonne: keine Angabe' : `${komma(t.sonnenstunden)} Std. Sonne`;
    const was = beschreibe(t);
    const tip = esc(`${wtag(t.datum)}${t.trend ? ' (Trend)' : ''}: ${was ? was + ', ' : ''}${r0(t.minC)}° bis ${r0(t.maxC)}°, ${komma(t.niederschlagMm ?? 0)} mm, ${sonne}`);
    out.push(`<rect class="wd-spalte" x="${(L + spalte * i).toFixed(1)}" y="${T0 - 12}" width="${spalte.toFixed(1)}" height="${H - T0 + 12}" data-tip="${tip}"><title>${tip}</title></rect>`);
  });
  const legende = '<div class="wd-legende"><span><i class="wd-l-max"></i><b class="wd-t-max">Höchstwert</b></span><span><i class="wd-l-min"></i><b class="wd-t-min">Tiefstwert</b></span>' +
    '<span><i class="wd-l-regen"></i><b class="wd-t-regen">Niederschlag</b></span><span><i class="wd-l-sonne"></i><b class="wd-t-sonne">Sonne</b></span><span><i class="wd-l-trend"></i>ab Tag 8 Trend</span></div>';
  return `<figure class="wd-figur"><svg class="wd wd-gross" viewBox="0 0 ${W} ${H + 4}" role="img" aria-label="Wetter der nächsten ${n} Tage">${out.join('')}</svg>${legende}${hinweisFeld}</figure>`;
}

// 48-Stunden-Diagramm: Temperatur (eine Linie) und Regenwahrscheinlichkeit (Balken); zeit(iso) → { h: '14', tag: 'Mo.' }
export function stundenDiagramm(stunden, zeit) {
  if (!stunden || stunden.length < 2) return '';
  const n = stunden.length, W = 420, L = 26, R = 4, spalte = (W - L - R) / n;
  const T0 = 18, T1 = 118, P0 = 138, P1 = 176, A = 190, H = 201;
  const cx = i => L + spalte * (i + 0.5);
  const tmin = Math.floor(Math.min(...stunden.map(s => s.tempC ?? Infinity)) / 5) * 5;
  const tmax = Math.max(tmin + 5, Math.ceil(Math.max(...stunden.map(s => s.tempC ?? -Infinity)) / 5) * 5);
  const yT = skala(tmin, tmax, T0, T1);
  const out = [`<text class="wd-achse" x="${L}" y="${T0 - 5}">Temperatur °C</text>`, `<text class="wd-achse" x="${L}" y="${P0 - 5}">Regenwahrscheinlichkeit %</text>`];
  for (let v = tmin; v <= tmax; v += 5) {
    out.push(`<line class="wd-gitter" x1="${L}" x2="${W - R}" y1="${yT(v).toFixed(1)}" y2="${yT(v).toFixed(1)}"/>`,
      `<text class="wd-achse" x="${L - 4}" y="${(yT(v) + 3).toFixed(1)}" text-anchor="end">${v}°</text>`);
  }
  out.push(`<line class="wd-gitter" x1="${L}" x2="${W - R}" y1="${P1}" y2="${P1}"/>`, `<text class="wd-achse" x="${L - 4}" y="${P0 + 3}" text-anchor="end">100</text>`);
  out.push(`<path class="wd-temp" d="${pfad(stunden.map((s, i) => [cx(i), s.tempC == null ? null : yT(s.tempC)]))}"/>`);
  let vorTag = null;
  stunden.forEach((s, i) => {
    const p = s.regenProzent || 0, hp = (p / 100) * (P1 - P0), bw = Math.max(2, spalte - 2);
    if (hp > 0) out.push(`<rect class="wd-regen" x="${(cx(i) - bw / 2).toFixed(1)}" y="${(P1 - hp).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, hp).toFixed(1)}" rx="1.5"/>`);
    const z = zeit(s.zeit);
    if (z.tag !== vorTag) { // Tageswechsel markieren
      if (vorTag !== null) out.push(`<line class="wd-gitter" x1="${L + spalte * i}" x2="${L + spalte * i}" y1="${T0 - 10}" y2="${P1}"/>`);
      out.push(`<text class="wd-achse wd-fett" x="${L + spalte * i + 3}" y="${H}">${z.tag}</text>`); vorTag = z.tag;
    }
    if (+z.h % 6 === 0) out.push(`<text class="wd-achse" x="${cx(i)}" y="${A}" text-anchor="middle">${z.h}</text>`);
    const tip = esc(`${z.tag} ${z.h} Uhr: ${r0(s.tempC)}°, Regen ${p} %${s.niederschlagMm ? `, ${komma(s.niederschlagMm)} mm` : ''}`);
    out.push(`<rect class="wd-spalte" x="${(L + spalte * i).toFixed(1)}" y="${T0 - 10}" width="${spalte.toFixed(1)}" height="${H - T0 + 10}" data-tip="${tip}"><title>${tip}</title></rect>`);
  });
  const legende = '<div class="wd-legende"><span><i class="wd-l-temp"></i>Temperatur</span><span><i class="wd-l-regen"></i><b class="wd-t-regen">Regenwahrscheinlichkeit</b></span></div>';
  return `<figure class="wd-figur"><svg class="wd wd-gross" viewBox="0 0 ${W} ${H + 4}" role="img" aria-label="Die nächsten ${n} Stunden">${out.join('')}</svg>${legende}${hinweisFeld}</figure>`;
}
