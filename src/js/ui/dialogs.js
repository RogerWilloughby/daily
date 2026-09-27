// Dialoge: Impressum, Datenschutz und Einstellungen.
import { settings, saveSettings } from '../core/store.js';
import { esc } from '../core/util.js';
import { dienst } from '../dienste/client.js';

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

  // Treffer des Dienstes „ort“ als Auswahl anzeigen: „Name, Landkreis (PLZ) · Bundesland“
  const beschrift = p => {
    const kreis = p.kreis && p.kreis !== p.name ? ', ' + p.kreis.replace(/^Landkreis /, 'Lkr. ') : '';
    const plz = p.plz && p.plz.length ? ` (${p.plz[0]}${p.plz.length > 1 ? ' …' : ''})` : '';
    const wo = [p.region, p.land && p.land !== 'DE' ? p.land : null].filter(Boolean).join(', ');
    return `${esc(p.name)}${esc(kreis)}${esc(plz)}${p.typ === 'stadtteil' ? ' <small>Stadtteil</small>' : ''}${wo ? ` <small>· ${esc(wo)}</small>` : ''}`;
  };
  function zeige(res, box) {
    if (!res.length) { box.textContent = 'Kein Ort gefunden. Anders schreiben oder Postleitzahl versuchen?'; return; }
    box.innerHTML = res.map((p, k) => `<label><input type="radio" name="place" value="${k}"${k === 0 ? ' checked' : ''}> <span>${beschrift(p)}</span></label>`).join('');
    const pick = k => { const p = res[k]; placeChoice = { name: p.name, admin: p.region || '', land: p.land, kreis: p.kreis, plz: p.plz, lat: p.lat, lon: p.lon, zeitzone: p.zeitzone }; };
    pick(0);
    box.querySelectorAll('input').forEach(i => i.addEventListener('change', () => pick(+i.value)));
  }

  async function searchPlace() {
    const q = $('set-place').value.trim(), box = $('set-place-results');
    if (!q) return;
    box.textContent = 'Suche …';
    try { zeige((await dienst('ort', { q })).daten.orte, box); } // Dienst „ort“ (daily/1): Name oder Postleitzahl
    catch (e) { box.textContent = 'Die Ortssuche ist gerade nicht erreichbar.'; }
  }

  // Gerätestandort → auf ~1 km runden → Dienst „ort“ sucht den Ortsnamen (nur auf Knopfdruck)
  $('set-place-here').addEventListener('click', () => {
    const box = $('set-place-results');
    if (!navigator.geolocation) { box.textContent = 'Dieser Browser kann den Standort nicht ermitteln.'; return; }
    box.textContent = 'Standort wird ermittelt …';
    navigator.geolocation.getCurrentPosition(async pos => {
      const r = v => Math.round(v * 100) / 100;
      try { zeige((await dienst('ort', { lat: r(pos.coords.latitude), lon: r(pos.coords.longitude) })).daten.orte, box); }
      catch (e) { box.textContent = 'Zu diesem Standort wurde kein Ort gefunden.'; }
    }, () => { box.textContent = 'Standort nicht freigegeben. Du kannst den Ort auch eintippen.'; }, { timeout: 15000, maximumAge: 600000 });
  });
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
