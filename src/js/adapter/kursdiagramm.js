// Mini-Kursdiagramm der Finanzen-Kachel (HTML/SVG-Text, ohne DOM, testbar). Styles: css/finanzen.css (fi-*, wd-kurs)
// und die allgemeinen Diagramm-Styles css/diagramm.css. Nutzt die allgemeinen Bausteine aus adapter/diagramm.js.
import { skala, pfad, esc, umschalter } from './diagramm.js';

// ── Mini-Kursdiagramm der Finanzen-Kachel: Kurslinie mit runder Skala (graue Linien, jede mit Zahl), Umschalter 30/90 Tage ──
export const KURS_WAHL = [[30, '30 Tage'], [90, '90 Tage']];
const KURS_STUFEN = [0.0001, 0.0002, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
// Skala mit 2–5 Abständen in runden Stufen (rein, testbar)
export function kursSkala(min, max) {
  const stufe = KURS_STUFEN.find(s => Math.ceil(max / s - 1e-9) - Math.floor(min / s + 1e-9) <= 5) || 1000;
  let lo = Math.floor(min / stufe + 1e-9) * stufe, hi = Math.ceil(max / stufe - 1e-9) * stufe;
  if (hi - lo < stufe * 2 - 1e-9) { lo -= stufe; if (hi - lo < stufe * 2 - 1e-9) hi += stufe; }
  const stellen = Math.max(0, -Math.floor(Math.log10(stufe) + 1e-9));
  return { lo: +lo.toFixed(stellen + 2), hi: +hi.toFixed(stellen + 2), stufe, stellen };
}
const MONAT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
// tage: aufsteigende Kalendertage, werte: Kurse passend dazu (null = kein Kurs), wahl: 30 oder 90 Tage
export function miniKurs({ tage, werte, zeichen = '', wahl = 30, titel = '' }) {
  if (!tage || tage.length < 2) return '';
  const ab = new Date(Date.parse(tage[tage.length - 1]) - (wahl - 1) * 864e5).toISOString().slice(0, 10);
  const idx = tage.map((t, i) => i).filter(i => tage[i] >= ab && werte[i] != null);
  if (idx.length < 2) return '';
  const T = idx.map(i => tage[i]), V = idx.map(i => werte[i]), n = T.length;
  const { lo, hi, stufe, stellen } = kursSkala(Math.min(...V), Math.max(...V));
  const W = 160, H = 34, T0 = 1, T1 = H - 1, y = skala(lo, hi, T0, T1), x = i => (i + 0.5) * W / n, pz = v => (v / H * 100).toFixed(1);
  const zahl = v => v.toLocaleString('de-DE', { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
  const linienWerte = []; for (let k = 0; lo + k * stufe <= hi + 1e-9; k++) linienWerte.push(+(lo + k * stufe).toFixed(stellen + 2));
  // wenig Platz (ansichten/mini-diagramm.js → miniDichte): jede zweite Linie (wd-g5) bzw. nur oberste/unterste (wd-gi) ausblenden
  const kl = (v, k) => (k % 2 ? ' wd-g5' : '') + (k && k < linienWerte.length - 1 ? ' wd-gi' : '');
  const out = linienWerte.map((v, k) => `<line class="wd-gitter${kl(v, k)}" x1="0" x2="${W}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`);
  out.push(`<path class="wd-kurs" d="${pfad(V.map((v, i) => [x(i), y(v)]))}"/>`);
  const svg = `<svg class="wd wd-mini" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${out.join('')}</svg>`;
  // Zeitachse: 30 Tage → jeder Montag („7.9.“), 90 Tage → Monatsanfang („Aug“)
  const d = t => new Date(t + 'T12:00:00Z');
  const marken = T.map((t, i) => ({ i, t })).filter(({ t, i }) => wahl <= 30 ? d(t).getUTCDay() === 1 : i > 0 && t.slice(5, 7) !== T[i - 1].slice(5, 7))
    .filter(m => x(m.i) / W > 0.04 && x(m.i) / W < 0.96)
    .map(({ i, t }) => `<span style="left:${(x(i) / W * 100).toFixed(1)}%">${wahl <= 30 ? `${d(t).getUTCDate()}.${d(t).getUTCMonth() + 1}.` : MONAT[d(t).getUTCMonth()]}</span>`).join('');
  const links = linienWerte.map((v, k) => `<span class="${kl(v, k).trim()}" style="top:${pz(y(v))}%">${zahl(v)}</span>`).join('');
  return `<div class="wd-minibox" role="img" aria-label="${esc(titel)}: ${wahl} Tage, ${zahl(Math.min(...V))} bis ${zahl(Math.max(...V))} ${esc(zeichen)}">` +
    `<div class="wd-miniskala fi-skala"><div class="wd-sk">${links}</div></div>` +
    `<div class="wd-mini24">${svg}<div class="wd-marken">${marken}</div></div></div>` +
    `<div class="wd-minilegende">${umschalter(wahl, KURS_WAHL)}<span class="wd-leg"><b title="Euro-Referenzkurs der EZB – nur zur Information, keine Anlageempfehlung">${esc(titel)}</b> · Quelle: EZB</span></div>`;
}
