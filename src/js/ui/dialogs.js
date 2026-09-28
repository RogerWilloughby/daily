// Dialoge: Datenquellen, Impressum, Datenschutz und die globalen Einstellungen (Orte: ui/ort.js, Kacheln: ui/kacheln.js).
import { dienst } from '../dienste/client.js';
import { seite as quellenSeite } from '../adapter/katalog.js';
import { versionText } from '../core/version.js';

export function initDialogs() {
  document.querySelectorAll('[data-doc]').forEach(b => b.addEventListener('click', () => {
    const d = document.getElementById('doc-' + b.dataset.doc);
    if (d && typeof d.showModal === 'function') d.showModal();
    if (b.dataset.doc === 'quellen') {           // Katalog der Dienste: Herkunft und Verarbeitung je Dienst
      const box = document.getElementById('quellen-body');
      dienst('dienste').then(env => { box.innerHTML = quellenSeite(env, versionText()); })
        .catch(() => { box.textContent = 'Die Angaben sind gerade nicht abrufbar. Die Quellen stehen auch im Impressum.'; });
    }
  }));
  document.querySelectorAll('dialog.doc').forEach(d => {
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-doc-close]')) d.close(); });
  });

  const $ = id => document.getElementById(id);

  // Version sichtbar: klein in der Fußzeile (öffnet „Datenquellen“) und unten in den Einstellungen
  document.querySelectorAll('[data-version]').forEach(e => { e.textContent = e.dataset.version === 'kurz' ? 'v' + versionText().split(' ')[1] : versionText(); });

  // Globale Einstellungen: Orte (ui/ort.js) und Kacheln (ui/kacheln.js) hören auf „daily:einstellungen-offen“
  $('open-settings').addEventListener('click', () => oeffneEinstellungen());
}

export function oeffneEinstellungen(ziel = null) {
  const dlg = document.getElementById('settings');
  document.dispatchEvent(new CustomEvent('daily:einstellungen-offen'));
  if (typeof dlg.showModal === 'function' && !dlg.open) dlg.showModal();
  if (ziel) setTimeout(() => { const e = document.getElementById(ziel); if (e) { e.scrollIntoView({ block: 'start' }); if (e.focus) e.focus(); } }, 50);
}
