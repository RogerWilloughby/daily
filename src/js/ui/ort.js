// Ort: Knopf in der Leiste (zeigt, für welchen Ort die Kacheln gelten) und eigener Ort-Dialog.
// Gerätestandort auf Knopfdruck, Suche mit Vorschlägen beim Tippen (Dienst „ort“). Ein Klick auf einen Treffer übernimmt ihn sofort.
import { settings, saveSettings } from '../core/store.js';
import { esc } from '../core/util.js';
import { dienst } from '../dienste/client.js';

// Treffer des Dienstes „ort“ als Zeile: „Name, Landkreis (PLZ) · Bundesland“
export function beschrift(p) {
  const k = (p.kreis || '').replace(/^Landkreis /, 'Lkr. ').replace(/^(Kreisfreie Stadt|Stadtkreis) /, '');
  const kreis = k && k !== p.name && !p.name.startsWith(k + ' ') ? ', ' + k : '';
  const plz = p.plz && p.plz.length ? ` (${p.plz[0]}${p.plz.length > 1 ? ' …' : ''})` : '';
  const wo = [p.region, p.land && p.land !== 'DE' ? p.land : null].filter(Boolean).join(', ');
  return `${esc(p.name)}${esc(kreis)}${esc(plz)}${p.typ === 'stadtteil' ? ' <small>Stadtteil</small>' : ''}${wo ? ` <small>· ${esc(wo)}</small>` : ''}`;
}

// Ort-Objekt des Dienstes → gespeicherter Ort
export const alsEinstellung = p => ({ name: p.name, admin: p.region || '', land: p.land, kreis: p.kreis || null,
  kreisSchluessel: p.kreisSchluessel || null, plz: p.plz || [], lat: p.lat, lon: p.lon, zeitzone: p.zeitzone, gewaehlt: true });

// Text auf dem Knopf: eigener Ort oder Aufforderung (solange nur der Beispielort Dresden gilt)
export const knopfText = place => (place && place.gewaehlt ? place.name : 'Ort wählen');

export function initOrt(onChange) {
  const $ = id => document.getElementById(id);
  const dlg = $('ort-dlg'), knopf = $('open-ort'), box = $('ort-results'), eingabe = $('ort-q');
  let tippTimer = null, tippNr = 0, treffer = [];

  const zeigeKnopf = () => {
    $('ort-name').textContent = knopfText(settings.place);
    knopf.title = settings.place.gewaehlt ? `Ort: ${settings.place.name} – ändern` : `Beispielort ${settings.place.name} – eigenen Ort wählen`;
  };
  zeigeKnopf();

  knopf.addEventListener('click', () => {
    eingabe.value = '';
    box.innerHTML = '';
    $('ort-aktuell').textContent = settings.place.gewaehlt
      ? settings.place.name + (settings.place.admin ? ', ' + settings.place.admin : '')
      : `${settings.place.name} (Beispiel)`;
    if (typeof dlg.showModal === 'function') dlg.showModal();
    setTimeout(() => eingabe.focus(), 50);
  });

  function waehle(p) {
    saveSettings({ place: alsEinstellung(p) });
    zeigeKnopf();
    dlg.close();
    onChange();
  }

  function zeige(liste, leerText) {
    treffer = liste;
    if (!liste.length) { box.textContent = leerText || 'Kein Ort gefunden. Anders schreiben oder Postleitzahl versuchen?'; return; }
    box.innerHTML = liste.map((p, k) => `<button type="button" class="ort-treffer" data-k="${k}">${beschrift(p)}</button>`).join('');
  }
  box.addEventListener('click', e => {
    const b = e.target.closest('.ort-treffer');
    if (b) waehle(treffer[+b.dataset.k]);
  });

  // Vorschläge beim Tippen: nur Deutschland, ohne Auslandsabruf
  eingabe.addEventListener('input', () => {
    clearTimeout(tippTimer);
    const q = eingabe.value.trim(), nr = ++tippNr;
    if (q.length < 2) { box.innerHTML = ''; treffer = []; return; }
    tippTimer = setTimeout(async () => {
      try {
        const orte = (await dienst('ort', { q, land: 'DE' })).daten.orte;
        if (nr === tippNr) zeige(orte, 'Kein Ort in Deutschland – Enter sucht auch im Ausland.');
      } catch (e) { /* beim Tippen still bleiben */ }
    }, 250);
  });

  // Enter oder „Suchen“: vollständige Suche, auch im Ausland
  async function suche() {
    const q = eingabe.value.trim();
    if (!q) return;
    clearTimeout(tippTimer); const nr = ++tippNr;
    box.textContent = 'Suche …';
    try { const orte = (await dienst('ort', { q })).daten.orte; if (nr === tippNr) zeige(orte); }
    catch (e) { box.textContent = 'Die Ortssuche ist gerade nicht erreichbar.'; }
  }
  $('ort-suchen').addEventListener('click', suche);
  eingabe.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    suche();                                          // neu suchen – so kommen auch Orte im Ausland dazu
  });

  // Gerätestandort → auf ~1 km runden → nächster Ort im eigenen Bestand (nur auf Knopfdruck)
  $('ort-hier').addEventListener('click', () => {
    if (!navigator.geolocation) { box.textContent = 'Dieser Browser kann den Standort nicht ermitteln.'; return; }
    box.textContent = 'Standort wird ermittelt …'; tippNr++;
    navigator.geolocation.getCurrentPosition(async pos => {
      const r = v => Math.round(v * 100) / 100;
      try {
        const env = await dienst('ort', { lat: r(pos.coords.latitude), lon: r(pos.coords.longitude) });
        if (!env.daten.orte.length) box.textContent = (env.hinweise || []).includes('ausserhalb')
          ? 'Dein Standort liegt außerhalb Deutschlands. Bitte tippe den Ort ein.' : 'Zu diesem Standort wurde kein Ort gefunden.';
        else waehle(env.daten.orte[0]);            // eindeutig: sofort übernehmen, der Knopf zeigt den Namen
      } catch (e) { box.textContent = 'Die Ortssuche ist gerade nicht erreichbar.'; }
    }, () => { box.textContent = 'Standort nicht freigegeben. Du kannst den Ort auch eintippen.'; }, { timeout: 15000, maximumAge: 600000 });
  });
}
