// Kachel „Sport“: Fußball über den Dienst „fussball“ (eine Antwort je Liga, seit 0.43.0 statt api/sport.js).
// Den eigenen Verein sucht der Browser in der Liga-Antwort – zuerst in der gemerkten Liga, sonst 1., 2., 3. Liga nacheinander.
// Die gefundene Liga bleibt je Verein gespeichert (Kachel-Einstellung { liga, ligaFuer }). Mini-Reiter: Verein · Tabelle · Spieltag.
import { set } from '../core/board.js';
import { settings, saveSettings, kachelOpt, kachelOptSpeichern } from '../core/store.js';
import { kachelEinstellungen } from '../core/einstellungen.js';
import { addAnswer } from '../core/ask.js';
import { gespeichert, dienst } from '../dienste/client.js';
import { LIGEN, findeVerein, kachel, antwort } from '../adapter/fussball.js';

const STANDARD = 'Dynamo Dresden';
let env = null;
const suche = () => (settings.team || STANDARD).trim() || STANDARD;

export async function load() {
  const q = suche(), o = kachelOpt('sport');
  const gemerkt = o.ligaFuer === q && LIGEN.includes(o.liga) ? o.liga : null;
  // beim Öffnen sofort der gespeicherte Stand der gemerkten Liga
  if (!env && gemerkt) {
    const alt = gespeichert('fussball', { liga: gemerkt });
    if (findeVerein(alt, q)) set('sport', kachel(alt, q));
  }
  let fehler = null, erreicht = 0, gefunden = null;
  for (const liga of gemerkt ? [gemerkt, ...LIGEN.filter(l => l !== gemerkt)] : LIGEN) {
    let e;
    try { e = await dienst('fussball', { liga }); erreicht++; } catch (err) { fehler = err; continue; }
    if (findeVerein(e, q)) {
      gefunden = e;
      if (liga !== gemerkt) kachelOptSpeichern('sport', { liga, ligaFuer: q });
      break;
    }
  }
  if (!gefunden && !erreicht) throw fehler || new Error('Fußball nicht erreichbar');
  env = gefunden;
  set('sport', kachel(env, q));
}

addAnswer(/sport|fußball|fussball|bundesliga|dynamo|spiel|tabelle|verein/i, () => antwort(env, suche()));

// Einstellungen der Kachel (Zahnrad)
kachelEinstellungen('sport', {
  felder: () => [{ typ: 'text', key: 'team', label: 'Verein', wert: settings.team || '', platzhalter: 'z. B. Dynamo Dresden', hilfe: '1., 2. oder 3. Fußball-Bundesliga der Männer.' }],
  speichern: w => { env = null; saveSettings({ team: w.team.trim() || STANDARD }); }
});

export default { id: 'sport', name: 'Fußball', every: 15 * 60e3, load };
