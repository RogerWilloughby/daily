// Kurse über /api/markets – reine Kursangaben, keine Empfehlungen.
import { set } from '../core/board.js';
import { addAnswer } from '../core/ask.js';
import { hm, getJson } from '../core/util.js';

let items = [];
const fmtNum = (v, unit) => {
  const d = unit === 'USD' && v < 10 ? 4 : (v >= 1000 ? 0 : 2);
  return v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
};
const pct = c => (c > 0 ? '+' : c < 0 ? '−' : '±') + Math.abs(c).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
const arrow = c => c > 0 ? '▲ ' : c < 0 ? '▼ ' : '';
const unitSign = u => u === 'Pkt' ? 'Pkt' : u === 'USD' ? '$' : '€';
const fmtItem = i => `${fmtNum(i.price, i.unit)} ${unitSign(i.unit)}${i.change == null ? '' : ' · ' + arrow(i.change) + pct(i.change)}`;

export async function load() {
  const j = await getJson('/api/markets');
  items = j.items || [];
  const ok = items.filter(i => i.ok);
  if (!ok.length) throw new Error('keine Kurse');
  const lead = ok.find(i => i.id === 'dax') || ok[0];
  const rows = items.map(i => [i.name, i.ok ? fmtItem(i) : 'gerade nicht verfügbar']);
  const t = ok.map(i => i.time).filter(Boolean).sort().pop();
  rows.push(['Hinweis', 'Veränderung zum Vortag · reine Kursangaben, keine Anlageempfehlung' + (t ? ' · Stand ' + hm(t) : '')]);
  set('money', {
    state: 'live',
    m: `${lead.name} ${fmtNum(lead.price, lead.unit)}`,
    ms: lead.change == null ? lead.name : pct(lead.change),
    trend: lead.change > 0 ? 'up' : lead.change < 0 ? 'down' : null,
    x: ok.filter(i => i.change != null).slice(0, 4).map(i => `${i.name} ${arrow(i.change)}${pct(i.change)}`).join(' · '),
    rows
  });
}

addAnswer(/dax|börse|boerse|aktie|index|bitcoin|krypto|ethereum|kurs|gold|dollar|markt/i, () =>
  items.some(i => i.ok) ? items.filter(i => i.ok).map(i => `${i.name} ${fmtItem(i)}`).join(' · ') + ' (reine Kursangaben, keine Anlageempfehlung).'
    : 'Die Kurse sind gerade nicht erreichbar.');

export default { id: 'money', name: 'Kurse', every: 5 * 60e3, load };
