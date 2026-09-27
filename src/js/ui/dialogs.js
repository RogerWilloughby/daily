// Dialoge: Datenquellen, Impressum, Datenschutz und Einstellungen. Der Ort hat einen eigenen Dialog (ui/ort.js).
import { settings, saveSettings } from '../core/store.js';
import { dienst } from '../dienste/client.js';
import { seite as quellenSeite } from '../adapter/katalog.js';

export function initDialogs(onSaved, isPrivate = false) {
  document.querySelectorAll('[data-doc]').forEach(b => b.addEventListener('click', () => {
    const d = document.getElementById('doc-' + b.dataset.doc);
    if (d && typeof d.showModal === 'function') d.showModal();
    if (b.dataset.doc === 'quellen') {           // Katalog der Dienste: Herkunft und Verarbeitung je Dienst
      const box = document.getElementById('quellen-body');
      dienst('dienste').then(env => { box.innerHTML = quellenSeite(env); })
        .catch(() => { box.textContent = 'Die Angaben sind gerade nicht abrufbar. Die Quellen stehen auch im Impressum.'; });
    }
  }));
  document.querySelectorAll('dialog.doc').forEach(d => {
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-doc-close]')) d.close(); });
  });

  const dlg = document.getElementById('settings');
  const $ = id => document.getElementById(id);

  $('open-settings').addEventListener('click', () => {
    $('set-ics').value = (settings.icsUrls || []).join('\n');
    $('set-stop').value = settings.stop || '';
    $('set-team').value = settings.team || '';
    $('set-fuel').value = settings.fuel || 'e10';
    $('set-private').hidden = !isPrivate;
    if (typeof dlg.showModal === 'function') dlg.showModal();
  });

  $('settings-form').addEventListener('submit', e => {
    e.preventDefault();
    const patch = {
      icsUrls: $('set-ics').value.split(/\s+/).map(u => u.trim()).filter(u => /^(https|webcal):\/\//i.test(u)),
      stop: $('set-stop').value.trim() || 'Postplatz',
      team: $('set-team').value.trim() || 'Dynamo Dresden',
      fuel: $('set-fuel').value
    };
    saveSettings(patch);
    dlg.close();
    onSaved();
  });
}
