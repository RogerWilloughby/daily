// Einstellungen einer Kachel im eigenen Fenster – geöffnet über das Zahnrad in der Reiterspalte (core/mini-reiter.js).
// Das Formular kommt aus core/einstellungen.js; jede Änderung speichert sofort, das Fenster bestätigt kurz „Gespeichert ✓“.
import { byId } from './tiles.js';
import { formular, binden, offeneSpeichern } from './einstellungen.js';

let fenster = null, offenFuer = null;

export function einstellungenOeffnen(id) {
  const t = byId[id]; if (!t) return;
  if (!fenster) {
    fenster = document.createElement('dialog');
    fenster.className = 'doc kachel-einst';
    fenster.innerHTML = '<div class="doc-in"><div class="doc-head"><h2></h2><button class="x" type="button" data-ke-zu>Fertig</button></div><div class="doc-body"></div></div>';
    document.body.append(fenster);
    fenster.addEventListener('click', e => { if (e.target === fenster || e.target.closest('[data-ke-zu]')) fenster.close(); });
    fenster.addEventListener('close', () => { offeneSpeichern(); offenFuer = null; });   // Texteingabe ohne Tipp-Pause nicht verlieren
  }
  offenFuer = id;
  fenster.querySelector('h2').textContent = `Einstellungen · ${t.name || t.title}`;
  const body = fenster.querySelector('.doc-body');
  body.innerHTML = formular(id);
  binden(id, body);
  if (typeof fenster.showModal === 'function' && !fenster.open) fenster.showModal();
}

// Nach dem Speichern: nur kurz bestätigen – das Formular bleibt stehen (sonst spränge beim Tippen der Cursor aus dem Feld)
document.addEventListener('daily:einstellungen', e => {
  if (!fenster || offenFuer !== e.detail) return;
  const ok = fenster.querySelector('.ke-ok');
  if (ok) { ok.textContent = 'Gespeichert ✓'; clearTimeout(ok._t); ok._t = setTimeout(() => { ok.textContent = ''; }, 2000); }
});
