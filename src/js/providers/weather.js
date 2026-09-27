// Kachel „Wetter“: holt den Dienst „wetter“ (daily/1) und stellt ihn über den Adapter dar.
// Alle Daten und Rechenwege liegen im Dienst (services/wetter.js), hier passiert nur die Anbindung.
import { set } from '../core/board.js';
import { settings } from '../core/store.js';
import { addAnswer } from '../core/ask.js';
import { paket, gespeichert, ortParams } from '../dienste/client.js';
import { kachel, antwort } from '../adapter/wetter.js';
import { antwort as hinweisAntwort } from '../adapter/hinweise.js';
import { hm } from '../core/util.js';

let env = null, regen = null, hinweise = null;

// „Stand 10:30“ an der Kachel, wenn ein älterer Stand gezeigt wird (beim Öffnen oder weil die Quelle gerade nicht antwortet)
const stand = e => (e && (e.veraltet || Date.parse(e.gueltigBis) < Date.now()) ? `Stand ${hm(e.erstellt)}` : '');

// Wetter (Takt 30 min), Regenradar und Wetterhinweise (Takt 5 min) mit EINER Anfrage (Paket); der Client holt nur, was abgelaufen ist.
// Beim Öffnen erscheint sofort der zuletzt gespeicherte Stand, die neuen Daten kommen im Hintergrund.
// Radar und Hinweise sind optional: außerhalb Deutschlands oder bei Störung zeigt die Kachel das Wetter ohne sie.
const oder = x => (x instanceof Error ? null : x);
export async function load() {
  const p = ortParams(settings.place);
  const altW = gespeichert('wetter', p), altR = gespeichert('regen', p), altH = gespeichert('wetterhinweise', p);
  if (altW && !env) set('weather', { ...kachel(altW, altR, altH), tag: stand(altW) });
  else if (!altW) set('weather', { title: settings.place.name });
  const r = await paket(['wetter', 'regen', 'wetterhinweise'], p);
  if (r.wetter instanceof Error) throw r.wetter;
  env = r.wetter; regen = oder(r.regen); hinweise = oder(r.wetterhinweise);
  set('weather', { ...kachel(env, regen, hinweise), tag: stand(env) });
}

// Warnfragen zuerst (vor der allgemeinen Wetterantwort)
addAnswer(/warnung|hinweis|unwetter|sturm|gewitter|glätte|glaette|glatteis|frost|hitze|orkan/i, () =>
  hinweise ? hinweisAntwort(hinweise, settings.place.name, (env && env.ort.zeitzone) || 'Europe/Berlin')
    : env ? `Für ${settings.place.name} sind gerade keine amtlichen Wetterhinweise verfügbar.` : 'Die Wetterdaten sind gerade nicht erreichbar.');

addAnswer(/schirm|regen|wetter|warm|kalt|grad|pollen|luft|jacke|radar/i, () =>
  env ? antwort(env, regen) : 'Die Wetterdaten sind gerade nicht erreichbar.');

export default { id: 'weather', name: 'Wetter', every: 5 * 60e3, load };
