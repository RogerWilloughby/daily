// Tankpreise in der Nähe des gewählten Orts über /api/fuel (Tankerkönig, Daten der MTS-K).
import { set } from '../core/board.js';
import { settings, saveSettings } from '../core/store.js';
import { kachelEinstellungen } from '../core/einstellungen.js';
import { addAnswer } from '../core/ask.js';
import { getJson, num } from '../core/util.js';

let data = null;
const NAME = { e5: 'Super E5', e10: 'Super E10', diesel: 'Diesel' };
const SHORT = { e5: 'E5', e10: 'E10', diesel: 'Diesel' };
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
// Tankstellen-Schreibweise: 1.749 → „1,74⁹ €“ (nicht runden)
export const price = p => { const c = Math.round(p * 1000); return `${Math.floor(c / 1000)},${String(Math.floor((c % 1000) / 10)).padStart(2, '0')}${SUP[c % 10]} €`; };

export async function load() {
  const p = settings.place, type = settings.fuel || 'e10';
  data = await getJson(`/api/fuel?lat=${p.lat}&lon=${p.lon}&type=${type}`);
  if (!data.configured) {
    set('fuel', { state: 'off', m: 'Einrichten', ms: '–', x: 'Für Tankpreise braucht DAILY einen kostenlosen Tankerkönig-Schlüssel (Betreiber, einmalig).',
      rows: [['Status', 'Schlüssel fehlt (Vercel-Variable TANKERKOENIG_API_KEY)'], ['Anmeldung', 'onboarding.tankerkoenig.de'], ['Danach', 'Günstigste Tankstellen im Umkreis von 5 km']] });
    return;
  }
  if (data.error && !data.stations.length) throw new Error(data.error);
  const st = data.stations;
  if (!st.length) {
    set('fuel', { state: 'live', m: 'Keine offene', ms: '–', x: `Im Umkreis von 5 km um ${p.name} ist gerade keine Tankstelle mit ${NAME[type]} geöffnet.`, rows: [['Sorte', NAME[type]]] });
    return;
  }
  const best = st[0];
  const rows = st.map(s => [price(s.price), `${s.name} · ${s.street}${s.place ? ', ' + s.place : ''} · ${num(s.dist, 1)} km`]);
  rows.unshift(['Sorte', `${NAME[type]} · Umkreis 5 km um ${p.name} · Sorte in den Einstellungen`]);
  rows.push(['Quelle', 'Tankerkönig (CC BY 4.0), Markttransparenzstelle für Kraftstoffe']);
  set('fuel', {
    state: 'live', m: `${SHORT[type]} ${price(best.price)}`, ms: price(best.price),
    x: `${best.name}, ${best.street} · ${num(best.dist, 1)} km${st[1] ? ` · danach ${price(st[1].price)}` : ''}`, rows
  });
}

addAnswer(/tank|benzin|diesel|sprit|e10|e5/i, () => {
  if (!data || !data.configured) return 'Tankpreise sind noch nicht eingerichtet.';
  const s = data.stations[0];
  return s ? `Am günstigsten: ${s.name}, ${s.street} (${num(s.dist, 1)} km) mit ${price(s.price)} für ${NAME[data.type]}.` : 'Gerade keine geöffnete Tankstelle in der Nähe gefunden.';
});

// Einstellungen der Kachel (Zahnrad-Reiter)
kachelEinstellungen('fuel', {
  felder: () => [{ typ: 'select', key: 'fuel', label: 'Kraftstoff', wert: settings.fuel || 'e10', optionen: [['e10', 'Super E10'], ['e5', 'Super E5'], ['diesel', 'Diesel']] }],
  speichern: w => saveSettings({ fuel: w.fuel })
});

export default { id: 'fuel', name: 'Tanken', every: 10 * 60e3, load };
