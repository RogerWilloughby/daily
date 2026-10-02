// Allgemeines aller Diagramme (Wetter, Finanzen): Dichte der Skalen je nach Höhe und Hervorheben der überfahrenen Spalte
// in Mini-Diagrammen (Werte gibt die Ansicht der Kachel aus, z. B. ansichten/wetter.js).
import { erweiterung, ansichtVon } from '../core/ansichten.js';

// Wenig Höhe: Striche und Zahlen nur alle 10° bzw. nur oberste/unterste (jede Zahl behält ihren Strich); Sonnenzahlen zu eng → jede zweite
export function miniDichte(wurzel) {
  wurzel.querySelectorAll('.wd-minibox').forEach(b => {
    const svg = b.querySelector('.wd-mini'), n = b.querySelectorAll('.wd-miniskala:not(.wd-miniskala-r) .wd-sk span').length;
    if (!svg || n < 2) return;
    const h = svg.getBoundingClientRect().height, n10 = b.querySelectorAll('.wd-miniskala:not(.wd-miniskala-r) .wd-sk span:not(.wd-g5)').length;
    const stufe = h / (n - 1) >= 13 ? 0 : n10 > 1 && h / (n10 - 1) >= 13 ? 1 : 2;
    b.classList.toggle('wd-eng', stufe === 1);
    b.classList.toggle('wd-eng2', stufe === 2);
    const sn = b.querySelectorAll('.wd-sonnen span').length;
    if (sn) b.classList.toggle('wd-seng', svg.getBoundingClientRect().width / sn < 16);
  });
}

// Mini-Diagramm überfahren: Spalte hervorheben, Ansicht der Kachel zeigt die Werte; andere Kacheln zurück auf ihren Grundzustand
const kachelId = el => el.id.replace(/^tile-/, '');
function zeiger(e, raster) {
  const sp = e.target.closest && e.target.closest('.wd-mini .wd-spalte');
  const kachel = sp && sp.closest('.tile');
  raster.querySelectorAll('.wd-spalte.an').forEach(x => { if (x !== sp) x.classList.remove('an'); });
  raster.querySelectorAll('.tile.ansicht-an').forEach(k => {
    if (k === kachel) return;
    k.classList.remove('ansicht-an');
    const a = ansichtVon(kachelId(k)); if (a && a.zurueck) a.zurueck(k);
  });
  if (!sp || !kachel) return;
  sp.classList.add('an');
  const a = ansichtVon(kachelId(kachel));
  if (a && a.spalte) { a.spalte(sp, kachel); kachel.classList.add('ansicht-an'); }
}

erweiterung({
  nachZeichnen: el => requestAnimationFrame(() => miniDichte(el)),
  groesse: raster => requestAnimationFrame(() => miniDichte(raster)),
  zeiger
});
