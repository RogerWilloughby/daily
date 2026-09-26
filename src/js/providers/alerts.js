// Amtliche Wetterwarnungen (Deutscher Wetterdienst) für den gewählten Ort über /api/alerts.
import { set } from '../core/board.js';
import { settings } from '../core/store.js';
import { addAnswer } from '../core/ask.js';
import { getJson } from '../core/util.js';

let data = null;
const LEVEL = ['', 'Wetterwarnung', 'Markante Warnung', 'Unwetterwarnung', 'Extreme Unwetterwarnung'];
const when = iso => iso ? new Date(iso).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '';

export async function load() {
  const p = settings.place;
  data = await getJson(`/api/alerts?lat=${p.lat}&lon=${p.lon}`);
  if (data.error && !data.alerts.length) throw new Error(data.error);
  const list = data.alerts;
  const area = data.area || p.name;
  if (!list.length) {
    set('alerts', { state: 'live', m: 'Keine Warnung', ms: 'keine', x: `Für ${area} liegt keine amtliche Warnung vor.`, trend: null,
      rows: [['Gebiet', area], ['Stand', 'keine Warnungen'], ['Quelle', 'Deutscher Wetterdienst (über Bright Sky)']] });
    return;
  }
  const top = list[0];
  const rows = [['Gebiet', area]];
  list.slice(0, 4).forEach(a => {
    rows.push([a.event, `${LEVEL[a.level] || 'Warnung'} · ${when(a.onset)} bis ${when(a.expires)}`]);
    if (a.description) rows.push(['Details', a.description]);
    if (a.instruction) rows.push(['Hinweis', a.instruction]);
  });
  rows.push(['Quelle', 'Deutscher Wetterdienst (über Bright Sky)']);
  set('alerts', {
    state: 'live', m: top.event, ms: list.length === 1 ? '1 aktiv' : list.length + ' aktiv',
    x: `${LEVEL[top.level] || 'Warnung'} bis ${when(top.expires)}${list.length > 1 ? ` · ${list.length - 1} weitere` : ''}`,
    trend: top.level >= 2 ? 'down' : null, rows
  });
}

addAnswer(/warnung|unwetter|sturm|gewitter|glätte|glaette|frost|hitze/i, () => {
  if (!data) return 'Die Warnungen sind gerade nicht verfügbar.';
  if (!data.alerts.length) return `Für ${data.area || settings.place.name} liegt keine amtliche Warnung vor.`;
  return data.alerts.slice(0, 3).map(a => `${a.event} (${LEVEL[a.level] || 'Warnung'}) bis ${when(a.expires)}`).join('; ') + '. Quelle: Deutscher Wetterdienst.';
});

export default { id: 'alerts', name: 'Warnungen', every: 10 * 60e3, load };
