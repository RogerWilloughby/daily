// Wetter-Diagramme als SVG-Text (ohne DOM, testbar). Farben über CSS-Klassen (app.css, .wd-*), damit Hell/Dunkel/aktive Kachel passen.
// Keine zweite Y-Achse: Temperatur, Niederschlag und Sonne stehen in getrennten Feldern übereinander, mit gemeinsamer Tagesachse.
const r0 = v => (v == null ? '–' : Math.round(v));
const komma = v => String(v).replace('.', ',');

// Werte → y-Koordinaten eines Feldes (oben = max)
function skala(min, max, oben, unten) {
  const spanne = max - min || 1;
  return v => unten - ((v - min) / spanne) * (unten - oben);
}
const pfad = pts => pts.filter(p => p[1] != null && Number.isFinite(p[1])).map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');

// Linie in zwei Teilen: belastbare Tage durchgezogen, Trendtage gestrichelt
function linie(xs, ys, trendAb, klasse) {
  const a = xs.map((x, i) => [x, ys[i]]);
  const fest = a.slice(0, trendAb + 1), trend = a.slice(trendAb);
  return `<path class="${klasse}" d="${pfad(fest)}"/>` + (trend.length > 1 ? `<path class="${klasse} wd-trend" d="${pfad(trend)}"/>` : '');
}

// Mini-Diagramm für die kleine Kachel: Höchst-/Tiefstwert als Linien, darunter Regenbalken; 16 Tage
export function miniDiagramm(tage) {
  if (!tage || tage.length < 2) return '';
  const W = 160, H = 34, n = tage.length, ab = tage.findIndex(t => t.trend), trendAb = ab < 0 ? n : ab - 1;
  const tmin = Math.min(...tage.map(t => t.minC ?? Infinity)), tmax = Math.max(...tage.map(t => t.maxC ?? -Infinity));
  const y = skala(tmin, tmax, 2, 24), x = i => 2 + i * (W - 4) / (n - 1);
  const xs = tage.map((_, i) => x(i));
  const regenMax = Math.max(4, ...tage.map(t => t.niederschlagMm || 0));
  const bw = Math.max(2, (W - 4) / n - 2);
  const balken = tage.map((t, i) => {
    const h = Math.round(((t.niederschlagMm || 0) / regenMax) * 6 * 10) / 10;
    return h > 0 ? `<rect class="wd-regen${t.trend ? ' wd-blass' : ''}" x="${(x(i) - bw / 2).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h}" rx="1"/>` : '';
  }).join('');
  const titel = `16 Tage: ${r0(tmin)}° bis ${r0(tmax)}°`;
  return `<svg class="wd wd-mini" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${titel}">` +
    linie(xs, tage.map(t => t.maxC == null ? null : y(t.maxC)), trendAb, 'wd-max') +
    linie(xs, tage.map(t => t.minC == null ? null : y(t.minC)), trendAb, 'wd-min') + balken + '</svg>';
}

// Großes Diagramm für die aufgeklappte Kachel: drei Felder (Temperatur, Niederschlag, Sonne), Trendbereich hinterlegt.
// Jede Tagesspalte trägt data-tip (Text für den Hover-Hinweis).
export function tageDiagramm(tage, wtag) {
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
  // Trendbereich und Feldtitel
  if (trendAb > 0) out.push(`<rect class="wd-trendfeld" x="${L + spalte * trendAb}" y="${T0 - 12}" width="${spalte * (n - trendAb)}" height="${S1 - T0 + 12}"/>`,
    `<text class="wd-achse" x="${L + spalte * trendAb + 4}" y="${T0 - 3}">Trend</text>`);
  out.push(`<text class="wd-achse" x="${L}" y="${T0 - 3}">Temperatur °C</text>`,
    `<text class="wd-achse" x="${L}" y="${N0 - 4}">Niederschlag, mm (Skala bis ${nMax})</text>`,
    `<text class="wd-achse" x="${L}" y="${S0 - 4}">Sonne, Std. (Skala bis ${sMax})</text>`);
  // Gitter Temperatur (alle 5 °C)
  for (let v = tmin; v <= tmax; v += 5) {
    out.push(`<line class="wd-gitter" x1="${L}" x2="${W - R}" y1="${yT(v).toFixed(1)}" y2="${yT(v).toFixed(1)}"/>`,
      `<text class="wd-achse" x="${L - 4}" y="${(yT(v) + 3).toFixed(1)}" text-anchor="end">${v}°</text>`);
  }
  out.push(`<line class="wd-gitter" x1="${L}" x2="${W - R}" y1="${N1}" y2="${N1}"/>`, `<line class="wd-gitter" x1="${L}" x2="${W - R}" y1="${S1}" y2="${S1}"/>`);
  // Linien Höchst/Tiefst
  const xs = tage.map((_, i) => cx(i));
  out.push(linie(xs, tage.map(t => t.maxC == null ? null : yT(t.maxC)), trendAb < 0 ? n : trendAb - 1, 'wd-max'),
    linie(xs, tage.map(t => t.minC == null ? null : yT(t.minC)), trendAb < 0 ? n : trendAb - 1, 'wd-min'));
  // Direkte Beschriftung am ersten Tag
  if (tage[0].maxC != null) out.push(`<text class="wd-wert" x="${cx(0)}" y="${(yT(tage[0].maxC) - 6).toFixed(1)}" text-anchor="middle">${r0(tage[0].maxC)}°</text>`);
  if (tage[0].minC != null) out.push(`<text class="wd-wert" x="${cx(0)}" y="${(yT(tage[0].minC) + 13).toFixed(1)}" text-anchor="middle">${r0(tage[0].minC)}°</text>`);
  // Balken Niederschlag und Sonne, Tagesachse, Hover-Spalten
  tage.forEach((t, i) => {
    const x = cx(i) - bw / 2, blass = t.trend ? ' wd-blass' : '';
    const hn = ((t.niederschlagMm || 0) / nMax) * (N1 - N0), hs = ((t.sonnenstunden || 0) / sMax) * (S1 - S0);
    if (hn > 0) out.push(`<rect class="wd-regen${blass}" x="${x.toFixed(1)}" y="${(N1 - hn).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, hn).toFixed(1)}" rx="2"/>`);
    if (hs > 0) out.push(`<rect class="wd-sonne${blass}" x="${x.toFixed(1)}" y="${(S1 - hs).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, hs).toFixed(1)}" rx="2"/>`);
    const [wt, dt] = wtag(t.datum).split(/,?\s+/);
    out.push(`<text class="wd-achse" x="${cx(i)}" y="${A}" text-anchor="middle">${wt}</text>`,
      `<text class="wd-achse" x="${cx(i)}" y="${H}" text-anchor="middle">${dt || ''}</text>`);
    const tip = `${wtag(t.datum)}${t.trend ? ' (Trend)' : ''}: ${r0(t.minC)}° bis ${r0(t.maxC)}°, ${komma(t.niederschlagMm ?? 0)} mm, ${komma(t.sonnenstunden ?? 0)} Std. Sonne`;
    out.push(`<rect class="wd-spalte" x="${(L + spalte * i).toFixed(1)}" y="${T0 - 12}" width="${spalte.toFixed(1)}" height="${H - T0 + 12}" data-tip="${tip}"><title>${tip}</title></rect>`);
  });
  const legende = '<div class="wd-legende"><span><i class="wd-l-max"></i>Höchstwert</span><span><i class="wd-l-min"></i>Tiefstwert</span>' +
    '<span><i class="wd-l-regen"></i>Niederschlag</span><span><i class="wd-l-sonne"></i>Sonne</span><span><i class="wd-l-trend"></i>ab Tag 8 Trend</span></div>';
  return `<figure class="wd-figur"><svg class="wd wd-gross" viewBox="0 0 ${W} ${H + 4}" role="img" aria-label="Wetter der nächsten ${n} Tage">${out.join('')}</svg>${legende}<div class="wd-tip" hidden></div></figure>`;
}
