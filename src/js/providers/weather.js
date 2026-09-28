// Kachel „Wetter“: holt den Dienst „wetter“ (daily/1) und stellt ihn über den Adapter dar.
// Alle Daten und Rechenwege liegen im Dienst (services/wetter.js), hier passiert nur die Anbindung.
import { set } from '../core/board.js';
import { settings, kachelOpt, kachelOptSpeichern } from '../core/store.js';
import { addAnswer } from '../core/ask.js';
import { paket, gespeichert, ortParams } from '../dienste/client.js';
import { kachel, antwort, mitOptionen, WETTER_STANDARD } from '../adapter/wetter.js';
import { kachelEinstellungen } from '../core/einstellungen.js';
import { antwort as hinweisAntwort } from '../adapter/hinweise.js';
import { hm } from '../core/util.js';

let env = null, regen = null, hinweise = null;

// „Stand 10:30“ an der Kachel, wenn ein älterer Stand gezeigt wird (beim Öffnen oder weil die Quelle gerade nicht antwortet)
const stand = e => (e && (e.veraltet || Date.parse(e.gueltigBis) < Date.now()) ? `Stand ${hm(e.erstellt)}` : '');

// Wetter (Takt 30 min), Regenradar und Wetterhinweise (Takt 5 min) mit EINER Anfrage (Paket); der Client holt nur, was abgelaufen ist.
// Beim Öffnen erscheint sofort der zuletzt gespeicherte Stand, die neuen Daten kommen im Hintergrund.
// Radar und Hinweise sind optional: außerhalb Deutschlands oder bei Störung zeigt die Kachel das Wetter ohne sie.
const oder = x => (x instanceof Error ? null : x);
const opt = () => kachelOpt('weather', WETTER_STANDARD);
const zeige = (w, r, h) => mitOptionen(kachel(w, r, h), w, opt());
export async function load() {
  const p = ortParams(settings.place);
  const altW = gespeichert('wetter', p), altR = gespeichert('regen', p), altH = gespeichert('wetterhinweise', p);
  if (altW && !env) set('weather', { ...zeige(altW, altR, altH), tag: stand(altW) });
  else if (!altW) set('weather', { title: settings.place.name });
  const r = await paket(['wetter', 'regen', 'wetterhinweise'], p);
  if (r.wetter instanceof Error) throw r.wetter;
  env = r.wetter; regen = oder(r.regen); hinweise = oder(r.wetterhinweise);
  set('weather', { ...zeige(env, regen, hinweise), tag: stand(env) });
}

// Warnfragen zuerst (vor der allgemeinen Wetterantwort)
addAnswer(/warnung|hinweis|unwetter|sturm|gewitter|glätte|glaette|glatteis|frost|hitze|orkan/i, () =>
  hinweise ? hinweisAntwort(hinweise, settings.place.name, (env && env.ort.zeitzone) || 'Europe/Berlin')
    : env ? `Für ${settings.place.name} sind gerade keine amtlichen Wetterhinweise verfügbar.` : 'Die Wetterdaten sind gerade nicht erreichbar.');

addAnswer(/schirm|regen|wetter|warm|kalt|grad|pollen|luft|jacke|radar/i, () =>
  env ? antwort(env, regen) : 'Die Wetterdaten sind gerade nicht erreichbar.');

// Umschalter im Mini-Diagramm (24 Std. · 48 Std. · 7 Tage · 16 Tage): dieselbe Einstellung wie im Zahnrad-Reiter, sofort ohne Abruf
document.addEventListener('click', e => {
  const b = e.target.closest('#tile-weather [data-mini-wahl]'); if (!b) return;
  kachelOptSpeichern('weather', { ...opt(), mini: +b.dataset.miniWahl });
  if (env) set('weather', { ...zeige(env, regen, hinweise), tag: stand(env) });
});

// Einstellungen der Kachel (Zahnrad-Reiter)
const REITER = [['radar', 'Radar'], ['tage', '16 Tage'], ['stunden', '48 Std.'], ['hinweise', 'Hinweise'], ['mehr', 'Mehr']];
kachelEinstellungen('weather', {
  felder: () => {
    const o = opt();
    return [
      { typ: 'titel', label: 'Reiter anzeigen' },
      { typ: 'hinweis', label: '„Heute“ ist immer da. Bei einer Unwetterwarnung erscheint „Hinweise“ trotzdem.' },
      ...REITER.map(([k, n]) => ({ typ: 'check', key: k, label: n, wert: o[k] !== false })),
      { typ: 'select', key: 'start', label: 'Beim Aufklappen zuerst', wert: o.start, optionen: [['heute', 'Heute'], ...REITER] },
      { typ: 'select', key: 'mini', label: 'Diagramm in der kleinen Kachel', wert: o.mini, optionen: [['24', '24 Stunden'], ['48', '48 Stunden'], ['7', '7 Tage'], ['16', '16 Tage']] }
    ];
  },
  speichern: w => {
    kachelOptSpeichern('weather', { ...Object.fromEntries(REITER.map(([k]) => [k, !!w[k]])), start: w.start, mini: +w.mini });
    if (env) set('weather', { ...zeige(env, regen, hinweise), tag: stand(env) });   // sofort, ohne neuen Abruf
  }
});

export default { id: 'weather', name: 'Wetter', every: 5 * 60e3, load };
