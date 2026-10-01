// Kachel „Wetter“: holt den Dienst „wetter“ (daily/1) und stellt ihn über den Adapter dar.
// Alle Daten und Rechenwege liegen im Dienst (services/wetter.js), hier passiert nur die Anbindung.
// Mini-Reiter in der kleinen Kachel (Jetzt · Radar · Hinweise · Mehr, Zahnrad → Einstellungsfenster), kein Aufklappen.
import { set } from '../core/board.js';
import { settings, kachelOpt, kachelOptSpeichern } from '../core/store.js';
import { addAnswer } from '../core/ask.js';
import { dienst, gespeichert, ortParams, mitOrt } from '../dienste/client.js';
import { kachel, antwort, mitOptionen, WETTER_STANDARD } from '../adapter/wetter.js';
import { kachelEinstellungen } from '../core/einstellungen.js';
import { antwort as hinweisAntwort } from '../adapter/hinweise.js';
import { hm } from '../core/util.js';
import { MINI_WAHL, miniWahl } from '../adapter/diagramm.js';
import '../ansichten/wetter.js'; // Zeitpunkt-Block im Reiter „Jetzt“ (wechselt beim Überfahren des Diagramms)
import '../ansichten/radar.js'; // Radarkarte: Bilder laufen lassen, Zeitleiste

let env = null, regen = null, hinweise = null;

// „Stand 10:30“ an der Kachel, wenn ein älterer Stand gezeigt wird (beim Öffnen oder weil die Quelle gerade nicht antwortet)
const stand = e => (e && (e.veraltet || Date.parse(e.gueltigBis) < Date.now()) ? `Stand ${hm(e.erstellt)}` : '');

// Wetter (Takt 30 min), Regenradar und Wetterhinweise (Takt 5 min) einzeln und gleichzeitig (kein Paket mehr, seit 0.39.0): jeder Dienst hat
// seine eigene Gültigkeit – der Client holt nur, was abgelaufen ist; das Wetter erscheint, sobald es da ist, Radar und Hinweise kommen dazu.
// Beim Öffnen erscheint sofort der zuletzt gespeicherte Stand, die neuen Daten kommen im Hintergrund.
// Radar und Hinweise sind optional: außerhalb Deutschlands oder bei Störung zeigt die Kachel das Wetter ohne sie.
const oder = x => (x instanceof Error ? null : x);
const opt = () => kachelOpt('weather', WETTER_STANDARD);
// Unwetter (Stufe 3–4): einmal je Warnung von selbst auf den Reiter „Hinweise“ – danach gilt wieder die eigene Wahl
function zeige(w, r, h) {
  const k = mitOptionen(kachel(w, r, h), w, opt());
  if (k.unwetter && opt().unwetterGesehen !== k.unwetter) kachelOptSpeichern('weather', { reiter: 'hinweise', unwetterGesehen: k.unwetter });
  return k;
}
export async function load() {
  const p = ortParams(settings.place);
  const o = x => mitOrt(x, settings.place);   // Name und Land des gewählten Orts (die Dienste liefern nur Koordinaten)
  const altW = o(gespeichert('wetter', p)), altR = o(gespeichert('regen', p)), altH = o(gespeichert('wetterhinweise', p));
  if (altW && !env) set('weather', { ...zeige(altW, altR, altH), tag: stand(altW) });
  else if (!altW) set('weather', { title: settings.place.name });
  const zusatz = Promise.all([dienst('regen', p).catch(e => e), dienst('wetterhinweise', p).catch(e => e)]);
  env = o(await dienst('wetter', p));                       // Fehler: Anbieter meldet „nicht erreichbar“, der gespeicherte Stand bleibt
  set('weather', { ...zeige(env, regen, hinweise), tag: stand(env) });
  const [r, h] = await zusatz;
  regen = o(oder(r)); hinweise = o(oder(h));
  set('weather', { ...zeige(env, regen, hinweise), tag: stand(env) });
}

// Warnfragen zuerst (vor der allgemeinen Wetterantwort)
addAnswer(/warnung|hinweis|unwetter|sturm|gewitter|glätte|glaette|glatteis|frost|hitze|orkan/i, () =>
  hinweise ? hinweisAntwort(hinweise, settings.place.name, (env && env.ort.zeitzone) || 'Europe/Berlin')
    : env ? `Für ${settings.place.name} sind gerade keine amtlichen Wetterhinweise verfügbar.` : 'Die Wetterdaten sind gerade nicht erreichbar.');

addAnswer(/schirm|regen|wetter|warm|kalt|grad|pollen|luft|jacke|radar/i, () =>
  env ? antwort(env, regen) : 'Die Wetterdaten sind gerade nicht erreichbar.');

// Umschalter im Diagramm des Reiters „Jetzt“ (Heute · 3 Tage · 7 Tage · 15 Tage): dieselbe Einstellung wie im Einstellungsfenster, sofort ohne Abruf
document.addEventListener('click', e => {
  const b = e.target.closest('#tile-weather [data-mini-wahl]'); if (!b) return;
  kachelOptSpeichern('weather', { ...opt(), mini: +b.dataset.miniWahl });
  if (env) set('weather', { ...zeige(env, regen, hinweise), tag: stand(env) });
});

// Einstellungen der Kachel (Zahnrad in der Reiterspalte → Einstellungsfenster)
const REITER = [['radar', 'Radar'], ['mehr', 'Mehr']];
kachelEinstellungen('weather', {
  felder: () => {
    const o = opt();
    return [
      { typ: 'titel', label: 'Reiter anzeigen' },
      { typ: 'hinweis', label: '„Jetzt“ ist immer da. „Hinweise“ erscheint, sobald eine amtliche Warnung vorliegt.' },
      ...REITER.map(([k, n]) => ({ typ: 'check', key: k, label: n, wert: o[k] !== false })),
      { typ: 'select', key: 'mini', label: 'Diagramm im Reiter „Jetzt“', wert: String(miniWahl(o.mini)), optionen: MINI_WAHL.map(([w, t]) => [String(w), t]) }
    ];
  },
  speichern: w => {
    kachelOptSpeichern('weather', { ...Object.fromEntries(REITER.map(([k]) => [k, !!w[k]])), mini: +w.mini });
    if (env) set('weather', { ...zeige(env, regen, hinweise), tag: stand(env) });   // sofort, ohne neuen Abruf
  }
});

export default { id: 'weather', name: 'Wetter', every: 5 * 60e3, load };
