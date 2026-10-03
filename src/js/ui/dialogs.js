// Dialoge: Datenquellen, Impressum, Datenschutz (Knöpfe unter Mehr → „Über DAILY“) und das eine Einstellungsfenster hinter dem Zahnrad
// (seit 0.47.0): Ort (ui/ort.js) · Wetter · Kalender · Meine Seiten · privat Tools (Formulare aus core/einstellungen.js) · Kennwort (ui/privat.js).
import { dienst } from '../dienste/client.js';
import { seite as quellenSeite } from '../adapter/katalog.js';
import { versionText } from '../core/version.js';
import { formular, binden, offeneSpeichern } from '../core/einstellungen.js';
import { betrieb } from '../core/betrieb.js';

// Abschnitte im Einstellungsfenster: ID des Anbieters → Überschrift
export const ABSCHNITTE = [['weather', 'Wetter'], ['kalender', 'Kalender'], ['links', 'Meine Seiten'], ['tools', 'Tools', true]];

export function initDialogs() {
  // Knöpfe mit data-doc entstehen auch später (Mehr → „Über DAILY“) – deshalb ein Hörer für die ganze Seite
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-doc]'); if (!b) return;
    const d = document.getElementById('doc-' + b.dataset.doc);
    if (d && typeof d.showModal === 'function' && !d.open) d.showModal();
    if (b.dataset.doc === 'quellen') {           // Katalog der Dienste: Herkunft und Verarbeitung je Dienst
      const box = document.getElementById('quellen-body');
      dienst('dienste').then(env => { box.innerHTML = quellenSeite(env, versionText()); })
        .catch(() => { box.textContent = 'Die Angaben sind gerade nicht abrufbar. Die Quellen stehen auch im Impressum.'; });
    }
  });
  document.querySelectorAll('dialog.doc').forEach(d => {
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-doc-close]')) d.close(); });
  });

  // Version unten im Einstellungsfenster
  document.querySelectorAll('[data-version]').forEach(e => { e.textContent = e.dataset.version === 'kurz' ? 'v' + versionText().split(' ')[1] : versionText(); });

  document.getElementById('open-settings').addEventListener('click', () => oeffneEinstellungen());
  const dlg = document.getElementById('settings');
  dlg.addEventListener('close', offeneSpeichern);   // Texteingabe ohne Tipp-Pause nicht verlieren

  // Beim Öffnen: Formulare der Bereiche frisch aufbauen (jede Änderung speichert sofort, core/einstellungen.js)
  document.addEventListener('daily:einstellungen-offen', () => {
    const box = document.getElementById('set-bereiche'); if (!box) return;
    const teile = ABSCHNITTE.filter(([, , privat]) => !privat || betrieb.privat).map(([id, name]) => [id, name, formular(id)]).filter(x => x[2]);
    box.innerHTML = teile.map(([id, name, html]) => `<section class="set-bereich" data-set="${id}"><h3>${name}</h3>${html}</section>`).join('');
    teile.forEach(([id]) => binden(id, box.querySelector(`[data-set="${id}"]`)));
  });
  // Nach dem Speichern kurz bestätigen
  document.addEventListener('daily:einstellungen', e => {
    const ok = document.querySelector(`#set-bereiche [data-set="${e.detail}"] .ke-ok`);
    if (ok) { ok.textContent = 'Gespeichert ✓'; clearTimeout(ok._t); ok._t = setTimeout(() => { ok.textContent = ''; }, 2000); }
  });
}

export function oeffneEinstellungen(ziel = null) {
  const dlg = document.getElementById('settings');
  document.dispatchEvent(new CustomEvent('daily:einstellungen-offen'));
  if (typeof dlg.showModal === 'function' && !dlg.open) dlg.showModal();
  if (ziel) setTimeout(() => { const e = document.getElementById(ziel); if (e) { e.scrollIntoView({ block: 'start' }); if (e.focus) e.focus(); } }, 50);
}
