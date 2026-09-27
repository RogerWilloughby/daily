// Dialoge: Impressum, Datenschutz und Einstellungen.
import { settings, saveSettings } from '../core/store.js';
import { esc, getJson } from '../core/util.js';

export function initDialogs(onSaved, isPrivate = false) {
  document.querySelectorAll('[data-doc]').forEach(b => b.addEventListener('click', () => {
    const d = document.getElementById('doc-' + b.dataset.doc);
    if (d && typeof d.showModal === 'function') d.showModal();
  }));
  document.querySelectorAll('dialog.doc').forEach(d => {
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-doc-close]')) d.close(); });
  });

  const dlg = document.getElementById('settings');
  const $ = id => document.getElementById(id);
  let placeChoice = null;

  $('open-settings').addEventListener('click', () => {
    placeChoice = null;
    $('set-place').value = '';
    $('set-place-results').innerHTML = '';
    $('set-place-current').textContent = settings.place.name + (settings.place.admin ? ', ' + settings.place.admin : '');
    $('set-ics').value = (settings.icsUrls || []).join('\n');
    $('set-stop').value = settings.stop || '';
    $('set-team').value = settings.team || '';
    $('set-fuel').value = settings.fuel || 'e10';
    $('set-private').hidden = !isPrivate;
    if (typeof dlg.showModal === 'function') dlg.showModal();
  });

  async function searchPlace() {
    const q = $('set-place').value.trim(), box = $('set-place-results');
    if (!q) return;
    box.textContent = 'Suche …';
    try {
      const res = (await getJson('https://geocoding-api.open-meteo.com/v1/search?count=6&language=de&format=json&name=' + encodeURIComponent(q))).results || [];
      if (!res.length) { box.textContent = 'Kein Ort gefunden. Anders schreiben?'; return; }
      box.innerHTML = res.map((p, k) => `<label><input type="radio" name="place" value="${k}"${k === 0 ? ' checked' : ''}> ${esc(p.name)}${p.admin1 ? ', ' + esc(p.admin1) : ''}${p.country ? ' (' + esc(p.country) + ')' : ''}</label>`).join('');
      const pick = k => { const p = res[k]; placeChoice = { name: p.name, admin: p.admin1 || '', lat: p.latitude, lon: p.longitude }; };
      pick(0);
      box.querySelectorAll('input').forEach(i => i.addEventListener('change', () => pick(+i.value)));
    } catch (e) { box.textContent = 'Die Ortssuche ist gerade nicht erreichbar.'; }
  }
  $('set-place-search').addEventListener('click', searchPlace);
  $('set-place').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); searchPlace(); } });

  $('settings-form').addEventListener('submit', e => {
    e.preventDefault();
    const patch = {
      icsUrls: $('set-ics').value.split(/\s+/).map(u => u.trim()).filter(u => /^(https|webcal):\/\//i.test(u)),
      stop: $('set-stop').value.trim() || 'Postplatz',
      team: $('set-team').value.trim() || 'Dynamo Dresden',
      fuel: $('set-fuel').value
    };
    if (placeChoice) patch.place = placeChoice;
    saveSettings(patch);
    dlg.close();
    onSaved();
  });
}
