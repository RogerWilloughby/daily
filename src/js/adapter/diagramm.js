// Wetter-Diagramme als HTML/SVG-Text (ohne DOM, testbar). Farben über CSS-Klassen (css/diagramm.css, .wd-*), damit Hell/Dunkel/aktive Kachel passen.
// Einheitliche Farben: Höchstwert orange, Tiefstwert dunkelblau, Niederschlag hellblau, Sonne gelb – für Linien, Balken UND die zugehörigen Zahlen.
// Keine zweite Y-Achse: Temperatur, Niederschlag und Sonne stehen in getrennten Feldern übereinander, mit gemeinsamer Zeitachse.
const r0 = v => (v == null ? '–' : Math.round(v));
const komma = v => String(v).replace('.', ',');
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Werte → y-Koordinaten eines Feldes (oben = max)
export function skala(min, max, oben, unten) {
  const spanne = max - min || 1;
  return v => unten - ((v - min) / spanne) * (unten - oben);
}
export const pfad = pts => pts.filter(p => p[1] != null && Number.isFinite(p[1])).map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');

// Runde Linie (monotone kubische Interpolation nach Fritsch-Carlson): weich, schießt aber nie über die echten Werte hinaus (rein, testbar)
export function pfadRund(pts) {
  const p = pts.filter(q => q[1] != null && Number.isFinite(q[1]));
  if (p.length < 3) return pfad(p);
  const n = p.length, d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((p[i + 1][1] - p[i][1]) / (p[i + 1][0] - p[i][0]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], t = a * a + b * b;
    if (t > 9) { const k = 3 / Math.sqrt(t); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  const f = v => v.toFixed(1);
  let out = `M${f(p[0][0])},${f(p[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = (p[i + 1][0] - p[i][0]) / 3;
    out += `C${f(p[i][0] + h)},${f(p[i][1] + m[i] * h)} ${f(p[i + 1][0] - h)},${f(p[i + 1][1] - m[i + 1] * h)} ${f(p[i + 1][0])},${f(p[i + 1][1])}`;
  }
  return out;
}

// Linie durchgehend (keine Trend-Strichelung mehr – die Unsicherheit steht im Dienstblatt); rund = weich gezeichnet
function linie(xs, ys, klasse, rund = false) {
  const a = xs.map((x, i) => [x, ys[i]]);
  return `<path class="${klasse}" d="${(rund ? pfadRund : pfad)(a)}"/>`;
}

// ── Diagramme unter „Jetzt“ (Heute, 3 Tage, 7 Tage, 15 Tage) – gemeinsamer Aufbau ──
// Links Temperaturskala in 5er-Schritten mit dünnen Strichen alle 5°, rechts Regenskala in mm (untere Hälfte).
// Regenbalken: Höhe = Menge (mm), Füllstärke = Wahrscheinlichkeit (stufenlos). Jede zweite Stunde/jeder zweite Tag leicht getönt.
// Zeitachse: Stunden alle 3 Std. bzw. Wochentage (15 Tage: jeder zweite).
// Regen je Linie in runden Stufen: die kleinste, bei der der stärkste Regen (mind. „mindestens“) unter die oberste Linie passt
const MM_STUFEN = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
export const mmStufe = (max, mindestens, abstaende) => MM_STUFEN.find(v => v * abstaende >= Math.max(max, mindestens) - 1e-9) || Math.ceil(Math.max(max, mindestens) / abstaende / 100) * 100;
export const deckkraft = p => (p == null ? 0.6 : Math.round((0.2 + 0.8 * Math.min(100, Math.max(0, p)) / 100) * 100) / 100);
const mm = v => komma(Math.round(v * 10) / 10);
function tempSkala(min, max) {
  let lo = Math.floor(min / 5) * 5, hi = Math.ceil(max / 5) * 5;
  if (hi - lo < 10) { if (max - lo > hi - min) hi = lo + 10; else lo = hi - 10; }   // mind. 10° Spanne → mind. ein Strich
  return { lo, hi };
}
// d = { n, linien: [{ werte, klasse }], regen: [{ mm, p }], mmMin, marken: [{ i, text }], legende, aria }
function mini(d) {
  const W = 160, H = 34, T0 = 1, T1 = H - 1, n = d.n, sp = W / n, x = i => (i + 0.5) * sp;
  const alle = d.linien.flatMap(l => l.werte).filter(v => v != null && Number.isFinite(v));
  const { lo, hi } = tempSkala(Math.min(...alle), Math.max(...alle));
  const y = skala(lo, hi, T0, T1), pz = v => (v / H * 100).toFixed(1);
  const out = [];
  // Streifen: jede zweite Spalte bzw. (gruppe) jede zweite Gruppe von Spalten, z. B. jeder zweite Tag bei den Tageszeiten
  const g = d.gruppe || 1;
  for (let i = g; i < n; i += 2 * g) out.push(`<rect class="wd-streifen" x="${(i * sp).toFixed(1)}" y="0" width="${(Math.min(g, n - i) * sp).toFixed(1)}" height="${H}"/>`);
  // Ein gemeinsamer Satz grauer Linien alle 5°: links Temperatur (orange), rechts Regen (grün) – jede Zahl hat ihre Linie.
  // Bei wenig Platz nur alle 10° (Klasse wd-g5) bzw. nur oberste/unterste Linie (wd-gi wird ausgeblendet).
  const werte = []; for (let v = lo; v <= hi; v += 5) werte.push(v);
  const g5 = v => (Math.abs(v) % 10 === 0 ? '' : ' wd-g5') + (v !== lo && v !== hi ? ' wd-gi' : '');
  werte.forEach(v => out.push(`<line class="wd-gitter${g5(v)}" x1="0" x2="${W}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`));
  // Regen auf denselben Linien: unterste Linie = 0 mm, je Linie eine runde Stufe; Balken über die ganze Höhe
  const abst = werte.length - 1, mmMax = Math.max(0, ...d.regen.map(r => r.mm || 0));
  const stufe = mmStufe(mmMax, d.mmMin, abst), mmTop = stufe * abst, bw = Math.max(1.5, sp - 1.5);
  const yR = skala(0, mmTop, T0, T1);
  d.regen.forEach((r, i) => {
    if (!(r.mm >= 0.1)) return;
    const h = Math.max(1, Math.round((T1 - yR(Math.min(r.mm, mmTop))) * 10) / 10);
    out.push(`<rect class="wd-regen" x="${(x(i) - bw / 2).toFixed(1)}" y="${(T1 - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h}" rx="1" fill-opacity="${deckkraft(r.p)}"/>`);
  });
  const xs = Array.from({ length: n }, (_, i) => x(i));
  for (const l of d.linien) out.push(linie(xs, l.werte.map(v => (v == null ? null : y(v))), l.klasse, true));
  // Spalten für das Mouseover (ansichten/mini-diagramm.js zeigt data-tip über dem Diagramm)
  // Werte je Spalte: Objekt → data-zp (Zeitpunkt-Block der Kachel, ansichten/wetter.js), Text → data-tip
  if (d.tips) d.tips.forEach((t, i) => { if (t) out.push(`<rect class="wd-spalte" x="${(i * sp).toFixed(1)}" y="0" width="${sp.toFixed(1)}" height="${H}" ${typeof t === 'object' ? `data-zp="${esc(JSON.stringify(t))}"` : `data-tip="${esc(t)}"`}/>`); });
  const svg = `<svg class="wd wd-mini" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${out.join('')}</svg>`;
  const marken = d.marken.filter(m => x(m.i) / W > 0.03 && x(m.i) / W < 0.97)
    .map(m => `<span style="left:${(x(m.i) / W * 100).toFixed(1)}%">${esc(m.text)}</span>`).join('');
  const links = werte.map(v => `<span class="${g5(v).trim()}" style="top:${pz(y(v))}%">${v}°</span>`).join('');
  const rechts = werte.map((v, k) => `<span class="${g5(v).trim()}" style="top:${pz(y(v))}%">${mm(k * stufe)}${v === hi ? ' mm' : ''}</span>`).join('');
  // Sonnenstunden (nur Tage): volle Stunden als Zahl über jeder Spalte; wenig Platz → jede zweite (wd-s2, ansichten/mini-diagramm.js)
  const sonnen = d.sonne ? `<div class="wd-sonnen wd-t-sonne">${d.sonne.map((v, i) => v == null ? '' :
    `<span class="${i % 2 ? 'wd-s2' : ''}" style="left:${(x(i) / W * 100).toFixed(1)}%">${Math.round(v)}</span>`).join('')}</div>` : '';
  return `<div class="wd-minibox" role="img" aria-label="${esc(d.aria)}, Temperaturskala ${lo}° bis ${hi}°, Regen bis ${mm(mmMax)} mm">` +
    `<div class="wd-miniskala wd-t-max"><div class="wd-sk">${links}</div></div>` +
    `<div class="wd-mini24">${svg}${sonnen}<div class="wd-marken">${marken}</div></div>` +
    `<div class="wd-miniskala wd-miniskala-r wd-t-regen"><div class="wd-sk">${rechts}</div></div></div>` +
    // „Regen mm“ zuerst: bleibt auch in schmalen Kacheln sichtbar (Mouseover mit Erklärung), der Rest wird notfalls gekürzt
    `<div class="wd-minilegende"><span class="wd-leg">` +
    `<b class="wd-t-regen" title="Balkenhöhe = Regenmenge in mm · kräftigere Farbe = Regen wahrscheinlicher">Regen mm</b> · ${d.legende}${d.sonne ? ` · <b class="wd-t-sonne" title="Zahlen oben im Diagramm = Sonnenstunden ${d.gruppe ? 'der Tageszeit' : 'des Tages'} (gerundet)">Sonne</b>` : ''}</span></div>`;
}
// Zeiträume unter Wetter → Jetzt (seit 0.49.0 Themen auf Ebene 3, kein Umschalter mehr im Diagramm): Heute (1) · 3 Tage · 7 Tage · 15 Tage
export const MINI_WAHL = [[1, 'Heute'], [3, '3 Tage'], [7, '7 Tage'], [15, '15 Tage']];
// Gespeicherte Werte von früher: 24 Std. → Heute, 48 Std. → 3 Tage, 16 Tage → 15 Tage
export const miniWahl = v => ({ 1: 1, 24: 1, 3: 3, 48: 3, 7: 7, 15: 15, 16: 15 })[+v] || 1;
const wtagKurz = datum => new Date(datum + 'T12:00:00Z').toLocaleDateString('de-DE', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');

// 7 oder 15 Tage: Höchst- und Tiefstlinie, Regen mm/Tag, Wochentage (15 Tage: jeder zweite)
export function miniDiagramm(tage, tip = null) {
  if (!tage || tage.length < 2) return '';
  const n = tage.length;
  const tmin = Math.min(...tage.map(t => t.minC ?? Infinity)), tmax = Math.max(...tage.map(t => t.maxC ?? -Infinity));
  return mini({
    n,
    linien: [{ werte: tage.map(t => t.maxC), klasse: 'wd-max' }, { werte: tage.map(t => t.minC), klasse: 'wd-min' }],
    regen: tage.map(t => ({ mm: t.niederschlagMm || 0, p: t.regenProzent })), mmMin: 10,
    sonne: tage.map(t => t.sonnenstunden), tips: tip ? tage.map(tip) : null,
    marken: tage.map((t, i) => ({ i, text: wtagKurz(t.datum) })).filter(m => n <= 8 || m.i % 2 === 0),
    legende: '<b class="wd-t-max" title="Höchst = wärmster Wert des Tages">Höchst</b> · <b class="wd-t-min" title="Tiefst = kältester Wert des Tages (meist nachts oder früh)">Tiefst</b>',
    aria: `${n} Tage: Höchstwerte bis ${r0(tmax)}°, Tiefstwerte bis ${r0(tmin)}°`
  });
}

// Heute (0–24 Uhr, auch die vergangenen Stunden): Temperaturlinie (Farbe Höchst), Regen mm/Std.; Zeitachse alle 3 Std.
// stunde(iso) → Stunde als Zahl (Ortszeit).
export function miniHeute(stunden, stunde, tip = null) {
  const l = stunden || [];
  if (l.length < 2) return '';
  const temps = l.map(s => s.tempC).filter(v => v != null);
  return mini({
    n: l.length,
    linien: [{ werte: l.map(s => s.tempC), klasse: 'wd-max' }],
    regen: l.map(s => ({ mm: s.niederschlagMm || 0, p: s.regenProzent })), mmMin: 2, tips: tip ? l.map(tip) : null,
    marken: l.map((s, i) => ({ i, h: stunde(s.zeit) })).filter(m => m.h % 3 === 0).map(m => ({ i: m.i, text: String(m.h) })),
    legende: '<b class="wd-t-max" title="Temperatur je Stunde, heute 0 bis 24 Uhr">Temperatur</b>',
    aria: `Heute: Temperatur ${r0(Math.min(...temps))}° bis ${r0(Math.max(...temps))}°`
  });
}

// 3 Tage (heute, morgen, übermorgen) je Morgen, Mittag, Abend, Nacht: mittlere Temperatur, Regen mm, Sonnenstunden;
// Wochentag mittig über den vier Spalten seines Tages, jeder zweite Tag leicht hinterlegt.
export function miniTageszeiten(tz, tip = null) {
  const l = tz || [];
  if (l.length < 2) return '';
  const temps = l.map(t => t.tempC).filter(v => v != null);
  const tage = [...new Set(l.map(t => t.datum))];
  const marken = tage.map(datum => { const ix = l.map((t, i) => (t.datum === datum ? i : -1)).filter(i => i >= 0);
    return { i: (ix[0] + ix[ix.length - 1]) / 2, text: wtagKurz(datum) }; });
  return mini({
    n: l.length, gruppe: 4,
    linien: [{ werte: l.map(t => t.tempC), klasse: 'wd-max' }],
    regen: l.map(t => ({ mm: t.niederschlagMm || 0, p: t.regenProzent })), mmMin: 5,
    sonne: l.map(t => t.sonnenstunden), tips: tip ? l.map(tip) : null, marken,
    legende: '<b class="wd-t-max" title="Mittlere Temperatur je Tageszeit: Morgen 6–12, Mittag 12–18, Abend 18–24, Nacht 0–6 Uhr">Temperatur</b>',
    aria: `3 Tage je Morgen, Mittag, Abend, Nacht: Temperatur ${r0(Math.min(...temps))}° bis ${r0(Math.max(...temps))}°`
  });
}

