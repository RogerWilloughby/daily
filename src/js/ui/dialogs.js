// Dialoge: Datenquellen, Impressum, Datenschutz und Einstellungen. Der Ort hat einen eigenen Dialog (ui/ort.js).
import { settings, saveSettings } from '../core/store.js';
import { dienst } from '../dienste/client.js';
import { seite as quellenSeite } from '../adapter/katalog.js';
import { versionText } from '../core/version.js';

export function initDialogs(onSaved, isPrivate = false) {
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

  const dlg = document.getElementById('settings');
  const $ = id => document.getElementById(id);

  // Version sichtbar: klein in der Fußzeile (öffnet „Datenquellen“) und unten in den Einstellungen
  document.querySelectorAll('[data-version]').forEach(e => { e.textContent = e.dataset.version === 'kurz' ? 'v' + versionText().split(' ')[1] : versionText(); });

  $('open-settings').addEventListener('click', () => {
    $('set-ics').value = (settings.icsUrls || []).join('\n');
    $('set-stop').value = settings.stop || '';
    $('set-team').value = settings.team || '';
    $('set-fuel').value = settings.fuel || 'e10';
    $('set-alle').checked = !!settings.alleKacheln;
    $('set-vorschau').hidden = !settings.alleKacheln;           // Einstellungen nur für sichtbare Kacheln
    $('set-private').hidden = !isPrivate;                      // Kalender-Links: im privaten Betrieb immer (Termine stehen in der Kachel „Kalender“)
    if (typeof dlg.showModal === 'function') dlg.showModal();
  });

  $('set-alle').addEventListener('change', () => { $('set-vorschau').hidden = !$('set-alle').checked; });

  $('settings-form').addEventListener('submit', e => {
    e.preventDefault();
    const patch = {
      icsUrls: $('set-ics').value.split(/\s+/).map(u => u.trim()).filter(u => /^(https|webcal):\/\//i.test(u)),
      stop: $('set-stop').value.trim() || 'Postplatz',
      team: $('set-team').value.trim() || 'Dynamo Dresden',
      fuel: $('set-fuel').value,
      alleKacheln: $('set-alle').checked
    };
    const neuesRaster = patch.alleKacheln !== !!settings.alleKacheln;
    saveSettings(patch);
    if (neuesRaster) { location.reload(); return; }             // andere Kacheln → Raster neu aufbauen
    dlg.close();
    onSaved();
  });
}
