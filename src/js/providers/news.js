// Kachel „Schlagzeilen“ (nur privat): Dienst „schlagzeilen“ mit Kennwort (seit 0.44.0 statt api/headlines.js).
// Originalüberschriften, neueste zuerst, ohne eigene Auswahl. Mini-Reiter: Neueste · Tagesschau · MDR Sachsen · heise.
import { set } from '../core/board.js';
import { addAnswer } from '../core/ask.js';
import { dienst } from '../dienste/client.js';
import { kachel, antwort } from '../adapter/schlagzeilen.js';

let env = null, kennwort = false;

export async function load() {
  try {
    env = await dienst('schlagzeilen', {}, { privat: true });
    kennwort = false;
  } catch (e) {
    if (e.code !== 'nicht_berechtigt') throw e;            // Störung: die Kachel zeigt den Fehler (und behält ggf. den letzten Stand)
    env = null; kennwort = true;                            // Kennwort fehlt oder falsch: Hinweis statt Fehler
  }
  set('news', kachel(env, Date.now(), 'Europe/Berlin', kennwort));
}

addAnswer(/news|schlagzeil|nachrichten|neuigkeit|was gibt.s neues/i, () => antwort(env, kennwort));

export default { id: 'news', private: true, name: 'Schlagzeilen', every: 15 * 60e3, load };
