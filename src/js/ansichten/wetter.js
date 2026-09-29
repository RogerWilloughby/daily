// Ansicht der Wetterkachel (klein): Regenzeile und Zeitpunkt-Block mit festen Feldern
// (Zeitpunkt · Temperatur · gefühlt · Symbol+Wetterlage / Regen mm · Regen % · Wind · Sonne des Tages).
// Beim Überfahren des Mini-Diagramms wechseln nur die Werte (Stunde/Tag aus data-zp der Spalte), beim Verlassen zurück auf „Jetzt“.
import { ansicht } from '../core/ansichten.js';
import { esc, glyph } from '../core/util.js';

export function zpHtml(z) {
  const f = (k, v) => `<span class="zp-${k}">${esc(v || '')}</span>`;
  // Regenmenge und -wahrscheinlichkeit mit Schirm (blau)
  const schirm = (k, v) => `<span class="zp-${k}">${v ? `<i class="zp-schirm" aria-hidden="true">☂</i> ${esc(v)}` : ''}</span>`;
  return f('z', z.z) + f('t', z.t) + f('g', z.g) + `<span class="zp-l">${glyph(z.i)}<span>${esc(z.l)}</span></span>` +
    `<span class="zp-r">${schirm('mm', z.mm)}${schirm('p', z.p)}${f('w', z.w)}${f('s', z.s)}</span>`;
}

ansicht('weather', {
  teaser(t) {
    const zeile2 = t.zeile2 && t.zeile2.text
      ? `<span class="t-zeile2">${t.zeile2.glyph ? `<span class="t-icon">${t.zeile2.glyph}</span>` : ''}${esc(t.zeile2.text)}</span>` : '';
    const zp = t.zp ? `<span class="t-zp" data-jetzt="${esc(JSON.stringify(t.zp))}">${zpHtml(t.zp)}</span>` : '';
    return { html: zeile2 + zp, klassen: [zeile2 && 'mit-zeile2', zp && 'mit-zp'].filter(Boolean) };
  },
  spalte(sp, kachel) {
    const block = kachel.querySelector('.t-zp'); if (!block || !sp.dataset.zp) return;
    if (block.dataset.zeigt !== sp.dataset.zp) { block.innerHTML = zpHtml(JSON.parse(sp.dataset.zp)); block.dataset.zeigt = sp.dataset.zp; }
    block.classList.add('zp-an');
  },
  zurueck(kachel) {
    const block = kachel.querySelector('.t-zp'); if (!block) return;
    block.classList.remove('zp-an'); delete block.dataset.zeigt;
    try { block.innerHTML = zpHtml(JSON.parse(block.dataset.jetzt)); } catch (e) { /* bleibt */ }
  }
});
