// Kachel „Wetter“: holt den Dienst „wetter“ (daily/1) und stellt ihn über den Adapter dar.
// Alle Daten und Rechenwege liegen im Dienst (services/wetter.js), hier passiert nur die Anbindung.
import { set } from '../core/board.js';
import { settings } from '../core/store.js';
import { addAnswer } from '../core/ask.js';
import { dienst, ortParams } from '../dienste/client.js';
import { kachel, antwort } from '../adapter/wetter.js';

let env = null, regen = null;

// Wetter (Takt 30 min) und Regenradar (Takt 5 min) zusammen; der Client holt nur, was abgelaufen ist.
// Radar ist optional: außerhalb Deutschlands oder bei Störung zeigt die Kachel das Wetter ohne Radar.
export async function load() {
  set('weather', { title: settings.place.name });
  const p = ortParams(settings.place);
  const [w, r] = await Promise.allSettled([dienst('wetter', p), dienst('regen', p)]);
  if (w.status === 'rejected') throw w.reason;
  env = w.value; regen = r.status === 'fulfilled' ? r.value : null;
  set('weather', kachel(env, regen));
}

addAnswer(/schirm|regen|wetter|warm|kalt|grad|pollen|luft|jacke|radar/i, () =>
  env ? antwort(env, regen) : 'Die Wetterdaten sind gerade nicht erreichbar.');

export default { id: 'weather', name: 'Wetter', every: 5 * 60e3, load };
