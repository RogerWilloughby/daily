// Einstellungen → „Kacheln“: zwei Listen „Aktiv“ und „Verfügbar“.
// Doppelklick (oder Enter) verschiebt eine Kachel in die andere Liste. In „Aktiv“ ist die Reihenfolge = Platz im Raster:
// ziehen (Maus) oder ▲/▼ (Handy, Tastatur). Gespeichert wird sofort (settings.layout); beim Schließen baut sich das Raster neu auf.
import { settings, saveSettings } from '../core/store.js';
import { CATALOG, TILES, SLOTS, erlaubt, ERSETZT } from '../core/tiles.js';
import { esc, icon } from '../core/util.js';

// Rein, testbar: Kachel verschieben bzw. umsortieren. Liefert { aktiv, meldung }.
export function verschieben(aktiv, id, maxPlaetze = SLOTS) {
  if (aktiv.includes(id)) return { aktiv: aktiv.filter(x => x !== id), meldung: '' };
  if (aktiv.length >= maxPlaetze) return { aktiv, meldung: `Höchstens ${maxPlaetze} Kacheln – erst eine aus „Aktiv“ herausnehmen.` };
  return { aktiv: [...aktiv, id], meldung: '' };
}
export function umsortieren(aktiv, id, ziel) {   // ziel = Index, an den die Kachel soll
  const ohne = aktiv.filter(x => x !== id), i = Math.max(0, Math.min(ziel, ohne.length));
  return [...ohne.slice(0, i), id, ...ohne.slice(i)];
}
// verfügbare Kacheln: erlaubt (öffentlich/privat), nicht aktiv; fertige zuerst, dann Vorschau
export const verfuegbar = (aktiv, isPrivate) => CATALOG.filter(t => erlaubt(t.id, isPrivate) && !aktiv.includes(t.id))
  .sort((a, b) => (b.fertig ? 1 : 0) - (a.fertig ? 1 : 0)).map(t => t.id);

export function initKacheln(isPrivate) {
  const $ = id => document.getElementById(id);
  const ulA = $('k-aktiv'), ulF = $('k-frei'), meldung = $('k-meldung'), dlg = $('settings');
  const byId = Object.fromEntries(CATALOG.map(t => [t.id, t]));
  let aktiv = [], geaendert = false, gezogen = null;

  const eintrag = (id, inAktiv, i) => {
    const t = byId[id];
    return `<li data-id="${esc(id)}" tabindex="0"${inAktiv ? ' draggable="true"' : ''} title="Doppelklick: ${inAktiv ? 'herausnehmen' : 'aktivieren'}">` +
      `<span class="k-name">${icon(t.icon)}${esc(t.name)}</span>${t.fertig ? '' : '<small class="k-vorschau">Vorschau</small>'}` +
      (inAktiv ? `<span class="k-pfeile"><button type="button" data-hoch aria-label="${esc(t.name)} nach oben"${i === 0 ? ' disabled' : ''}>▲</button>` +
        `<button type="button" data-runter aria-label="${esc(t.name)} nach unten"${i === aktiv.length - 1 ? ' disabled' : ''}>▼</button></span>` : '') + '</li>';
  };
  function zeige(fokus) {
    ulA.innerHTML = aktiv.map((id, i) => eintrag(id, true, i)).join('') || '<li class="k-leer">Keine Kachel aktiv</li>';
    ulF.innerHTML = verfuegbar(aktiv, isPrivate).map(id => eintrag(id, false)).join('') || '<li class="k-leer">Alle Kacheln sind aktiv</li>';
    $('k-anzahl').textContent = `${aktiv.length} von ${SLOTS}`;
    if (fokus) { const e = dlg.querySelector(`li[data-id="${fokus}"]`); if (e) e.focus(); }
  }
  function speichern(neu, fokus) {
    aktiv = neu; geaendert = true;
    saveSettings({ layout: aktiv });
    zeige(fokus);
  }
  const wechsel = id => { const r = verschieben(aktiv, id); meldung.textContent = r.meldung; if (r.aktiv !== aktiv) speichern(r.aktiv, id); };

  // Beim Öffnen der Einstellungen: aktueller Stand des Rasters
  document.addEventListener('daily:einstellungen-offen', () => {
    aktiv = Array.isArray(settings.layout) ? [...new Set(settings.layout.map(id => ERSETZT[id] || id))].filter(id => erlaubt(id, isPrivate)) : TILES.filter(Boolean).map(t => t.id);
    meldung.textContent = ''; zeige();
  });
  // Schließen: Raster neu aufbauen, wenn sich etwas geändert hat
  dlg.addEventListener('close', () => { if (geaendert) location.reload(); });

  for (const ul of [ulA, ulF]) {
    ul.addEventListener('dblclick', e => { const li = e.target.closest('li[data-id]'); if (li && !e.target.closest('button')) wechsel(li.dataset.id); });
    ul.addEventListener('keydown', e => { const li = e.target.closest('li[data-id]'); if (li && e.key === 'Enter' && e.target === li) { e.preventDefault(); wechsel(li.dataset.id); } });
  }
  // Pfeile (Handy, Tastatur)
  ulA.addEventListener('click', e => {
    const b = e.target.closest('[data-hoch],[data-runter]'); if (!b) return;
    const id = b.closest('li').dataset.id, i = aktiv.indexOf(id);
    speichern(umsortieren(aktiv, id, b.hasAttribute('data-hoch') ? i - 1 : i + 1), id);
  });
  // Ziehen (Maus)
  ulA.addEventListener('dragstart', e => { const li = e.target.closest('li[data-id]'); if (!li) return; gezogen = li.dataset.id; li.classList.add('k-zieht'); e.dataTransfer.effectAllowed = 'move'; });
  ulA.addEventListener('dragend', () => { gezogen = null; ulA.querySelectorAll('.k-ueber,.k-zieht').forEach(x => x.classList.remove('k-ueber', 'k-zieht')); });
  ulA.addEventListener('dragover', e => {
    if (!gezogen) return; e.preventDefault();
    ulA.querySelectorAll('.k-ueber').forEach(x => x.classList.remove('k-ueber'));
    const li = e.target.closest('li[data-id]'); if (li) li.classList.add('k-ueber');
  });
  ulA.addEventListener('drop', e => {
    if (!gezogen) return; e.preventDefault();
    const li = e.target.closest('li[data-id]');
    const ziel = li ? aktiv.filter(x => x !== gezogen).indexOf(li.dataset.id) : aktiv.length;
    speichern(umsortieren(aktiv, gezogen, ziel < 0 ? aktiv.length : ziel), gezogen);
  });
}
