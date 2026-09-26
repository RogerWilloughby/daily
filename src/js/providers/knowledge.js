// Wissen: Wort und Sprichwort des Tages (eigene Inhalte) plus „An diesem Tag“ aus Wikipedia über /api/onthisday.
import { set } from '../core/board.js';
import { addAnswer } from '../core/ask.js';
import { getJson } from '../core/util.js';
import { getToday } from './content.js';

let day = null, events = [];

export async function load() {
  day = await getToday();
  let wikiOk = true;
  try { events = (await getJson('/api/onthisday')).events || []; } catch (e) { events = []; wikiOk = false; }
  const w = day.wort;
  const rows = [
    ['Wort des Tages', w.wort], ['Bedeutung', w.bedeutung], ['Herkunft', w.herkunft], ['Sprichwort', day.sprichwort]
  ];
  events.slice(0, 4).forEach(e => rows.push([`Heute vor ${new Date().getFullYear() - e.year} J. (${e.year})`, e.link ? { text: e.text, href: e.link } : e.text]));
  if (events.length) rows.push(['Quelle', 'Wikipedia, „An diesem Tag“ (CC BY-SA 4.0)']);
  set('knowledge', { state: wikiOk ? 'live' : 'content', m: w.wort, ms: w.wort, x: w.bedeutung, rows });
  if (!wikiOk) throw new Error('Wikipedia nicht erreichbar');
}

addAnswer(/wort des tages|bedeutet|was heißt|was heisst|sprichwort|wissen|an diesem tag|geschichte/i, () => {
  if (!day) return null;
  let a = `Wort des Tages: ${day.wort.wort} – ${day.wort.bedeutung}.`;
  if (events[0]) a += ` Heute vor ${new Date().getFullYear() - events[0].year} Jahren (${events[0].year}): ${events[0].text}`;
  return a;
});

export default { id: 'knowledge', name: 'Wikipedia', every: 60 * 60e3, load };
