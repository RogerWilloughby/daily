// Ansicht „Wetter“: Zeitpunkt-Block mit festen Feldern unter „Jetzt“
// (Zeitpunkt · Temperatur · gefühlt · Symbol+Wetterlage / Regen mm · Regen % · Wind · Sonne des Tages).
// Beim Überfahren des Diagramms wechseln nur die Werte (Stunde/Tag aus data-zp der Spalte), beim Verlassen zurück auf „Jetzt“.
import { ansicht } from '../core/ansichten.js';
import { zpHtml } from '../adapter/wetter.js';

export { zpHtml };

ansicht('weather', {
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
