// Kachel „Wetter“: holt den Dienst „wetter“ (daily/1) und stellt ihn über den Adapter dar.
// Alle Daten und Rechenwege liegen im Dienst (services/wetter.js), hier passiert nur die Anbindung.
import { set } from '../core/board.js';
import { settings } from '../core/store.js';
import { addAnswer } from '../core/ask.js';
import { dienst, ortParams } from '../dienste/client.js';
import { kachel, antwort } from '../adapter/wetter.js';

let env = null;

export async function load() {
  set('weather', { title: settings.place.name });
  env = await dienst('wetter', ortParams(settings.place));
  set('weather', kachel(env));
}

addAnswer(/schirm|regen|wetter|warm|kalt|grad|pollen|luft|jacke/i, () =>
  env ? antwort(env) : 'Die Wetterdaten sind gerade nicht erreichbar.');

export default { id: 'weather', name: 'Wetter', every: 15 * 60e3, load };
