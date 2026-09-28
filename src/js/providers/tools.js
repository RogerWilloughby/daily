// Kachel „Tools“: eigenständige Werkzeuge (src/tools/*.html), die im neuen Tab öffnen. Rein lokal – kein Abruf.
// Klein: Liste der Tools, ein Klick öffnet direkt. Aufgeklappt: Beschreibung und „Öffnen ↗“. Zahnrad: welche Tools erscheinen.
import { set } from '../core/board.js';
import { kachelOpt, kachelOptSpeichern } from '../core/store.js';
import { kachelEinstellungen } from '../core/einstellungen.js';
import { addAnswer } from '../core/ask.js';
import { TOOLS, kachel } from '../tools/verzeichnis.js';

const opt = () => kachelOpt('tools', { aus: [] });
const sichtbar = () => TOOLS.filter(t => !opt().aus.includes(t.id));

export function load() { set('tools', kachel(sichtbar())); }

addAnswer(/\btools?\b|arbeitszeit|gleitzeit|setzkasten|editor/i, () => {
  const t = sichtbar();
  return t.length ? `Tools in DAILY: ${t.map(x => `${x.name} – ${x.text}`).join('; ')}. Öffnen über die Kachel „Tools“.` : null;
});

kachelEinstellungen('tools', {
  felder: () => [
    { typ: 'titel', label: 'In der Kachel zeigen' },
    ...TOOLS.map(t => ({ typ: 'check', key: 't_' + t.id, label: `${t.name} – ${t.text}`, wert: !opt().aus.includes(t.id) }))
  ],
  speichern: w => { kachelOptSpeichern('tools', { aus: TOOLS.filter(t => !w['t_' + t.id]).map(t => t.id) }); load(); }
});

export default { id: 'tools', name: 'Tools', every: 24 * 3600e3, local: true, load };
