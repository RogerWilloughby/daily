// Kachel „Wissen“: Wort & Sprichwort, Land, An diesem Tag – mit Verlauf, Favoriten und „+ Aufgabe“ (providers/thema.js).
// Tagesinhalte vom Dienst „tagesinhalt“, „An diesem Tag“ vom Dienst „andiesemtag“ (Wikipedia, CC BY-SA 4.0). Ersetzt „Wissen“ und „Land des Tages“.
import { addAnswer } from '../core/ask.js';
import { themenAnbieter } from './thema.js';
import { jahrText } from '../adapter/tagesinhalt.js';

const t = themenAnbieter('wissen', { zusatz: { dienst: 'andiesemtag', art: 'geschichte' } });
const i = () => (t.heute() ? t.heute().daten.inhalt : null);
addAnswer(/wort des tages|bedeutet|was heißt|was heisst|sprichwort|wissen|an diesem tag|geschichte/i, q => {
  const x = i(); if (!x) return null;
  const ev = x.geschichte && x.geschichte.ereignisse && x.geschichte.ereignisse[0];
  if (/an diesem tag|geschichte/i.test(q) && ev) return `Heute vor ${new Date().getFullYear() - ev.jahr} Jahren (${jahrText(ev.jahr)}): ${ev.text}`;
  return x.wort ? `Wort des Tages: ${x.wort.wort} – ${x.wort.bedeutung}.${x.sprichwort ? ` Sprichwort: „${x.sprichwort}“` : ''}` : null;
});
addAnswer(/land|reise|urlaub/i, () => { const x = i(); return x && x.land ? `Land des Tages: ${x.land.name}, Hauptstadt ${x.land.hauptstadt}. ${x.land.fakt}` : null; });

export default t.provider;
