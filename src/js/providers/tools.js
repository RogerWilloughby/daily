// „Tools“ (nur privat, unter Mehr): eigenständige Werkzeuge (src/tools/*.html), die im neuen Tab öffnen. Rein lokal – kein Abruf.
// Umschalter im Feld: „Alle Tools“ (ein Klick öffnet direkt) und je Tool Beschreibung mit „Öffnen ↗“. Einstellungsfenster: welche Tools erscheinen.
import { set } from '../core/oberflaeche.js';
import { kachelOpt, kachelOptSpeichern } from '../core/store.js';
import { kachelEinstellungen } from '../core/einstellungen.js';
import { TOOLS, kachel } from '../tools/verzeichnis.js';

const opt = () => kachelOpt('tools', { aus: [] });
const sichtbar = () => TOOLS.filter(t => !opt().aus.includes(t.id));

export function load() { set('tools', kachel(sichtbar())); }

kachelEinstellungen('tools', {
  felder: () => [
    { typ: 'titel', label: 'Unter „Tools“ zeigen' },
    ...TOOLS.map(t => ({ typ: 'check', key: 't_' + t.id, label: `${t.name} – ${t.text}`, wert: !opt().aus.includes(t.id) }))
  ],
  speichern: w => { kachelOptSpeichern('tools', { aus: TOOLS.filter(t => !w['t_' + t.id]).map(t => t.id) }); load(); }
});

export default { id: 'tools', name: 'Tools', bereich: 'mehr', every: 24 * 3600e3, local: true, load };
