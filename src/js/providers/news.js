// Schlagzeilen über /api/headlines – Originalüberschriften, neueste zuerst, ohne eigene Auswahl.
import { set } from '../core/board.js';
import { addAnswer } from '../core/ask.js';
import { hm, getJson } from '../core/util.js';

let items = [];

export async function load() {
  const j = await getJson('/api/headlines');
  items = j.items || [];
  const since = Date.now() - 12 * 3600e3;
  const fresh = items.filter(i => i.date && Date.parse(i.date) > since).length;
  const rows = items.slice(0, 10).map(i => [`${i.date ? hm(i.date) : '–'} · ${i.source}`, { text: i.title, href: i.link }]);
  rows.push(['Quellen', (j.sources || []).map(s => s.name + (s.ok ? '' : ' (nicht erreichbar)')).join(', ')]);
  rows.push(['Hinweis', 'Originalüberschriften der Anbieter, neueste zuerst']);
  set('news', {
    state: 'live', m: fresh + ' neu', ms: fresh + ' neu',
    x: items[0] ? `${items[0].source}: ${items[0].title}` : 'Gerade keine Schlagzeilen.',
    rows
  });
  if (!(j.sources || []).some(s => s.ok)) throw new Error('keine Quelle erreichbar');
}

addAnswer(/news|schlagzeil|nachrichten|neuigkeit|was gibt.s neues/i, () =>
  items.length ? 'Neueste Schlagzeilen: ' + items.slice(0, 3).map(i => `${i.source}: ${i.title}`).join(' · ') : 'Die Schlagzeilen sind gerade nicht erreichbar.');

export default { id: 'news', name: 'Schlagzeilen', every: 15 * 60e3, load };
