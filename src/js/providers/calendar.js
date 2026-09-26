// Kalender über /api/calendar; iCal-Links kommen aus den Einstellungen (nur lokal gespeichert).
import { set } from '../core/board.js';
import { settings } from '../core/store.js';
import { addAnswer } from '../core/ask.js';
import { hm, berlinDay, dayLabel, getJson } from '../core/util.js';

let events = [], live = false;
const evTime = e => e.allDay ? 'ganztägig' : hm(e.start);

export async function load() {
  const urls = settings.icsUrls || [];
  const j = urls.length
    ? await getJson('/api/calendar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ urls }) })
    : await getJson('/api/calendar');
  if (!j.configured) {
    live = false;
    set('calendar', { state: 'off', m: 'Einrichten', ms: '–', x: 'Noch kein Kalender verbunden. Unten auf „Einstellungen“ den iCal-Link eintragen.',
      rows: [['Einrichtung', 'Einstellungen (unten in der Leiste) → Kalender'], ['Google', 'Kalender-Einstellungen → dein Kalender → „Privatadresse im iCal-Format“']] });
    return;
  }
  live = true; events = j.events || [];
  const t = berlinDay();
  const todays = events.filter(e => e.day === t);
  const nowIso = new Date().toISOString();
  const next = events.find(e => !e.allDay && (e.end || e.start) > nowIso);
  const rows = events.slice(0, 14).map(e => [`${dayLabel(e.day)} · ${evTime(e)}`, e.title]);
  if (!rows.length) rows.push(['Nächste 7 Tage', 'keine Termine']);
  (j.errors || []).forEach(er => rows.push([`Problem Kalender ${er.kalender}`, er.fehler]));
  set('calendar', {
    state: 'live',
    m: todays.length + (todays.length === 1 ? ' Termin' : ' Termine'), ms: todays.length + ' heute',
    x: next ? `Als Nächstes: ${next.day === t ? '' : dayLabel(next.day) + ', '}${hm(next.start)} ${next.title}`
            : (todays.length ? 'Heute: ' + todays.map(e => e.title).join(', ') : 'Heute keine Termine.'),
    rows
  });
  if (j.failed && j.failed === urls.length) throw new Error('Kalender nicht erreichbar');
}

addAnswer(/termin|kalender|heute an|morgen|geburtstag|was steht/i, () => {
  if (!live) return 'Es ist noch kein Kalender verbunden. Trag unten unter „Einstellungen“ deinen iCal-Link ein.';
  const t = berlinDay(), m = berlinDay(new Date(Date.now() + 864e5));
  const fmt = e => (e.allDay ? '' : hm(e.start) + ' ') + e.title;
  const today = events.filter(e => e.day === t), tomorrow = events.filter(e => e.day === m);
  let a = today.length ? 'Heute: ' + today.map(fmt).join(', ') + '.' : 'Heute stehen keine Termine an.';
  if (tomorrow.length) a += ' Morgen: ' + tomorrow.map(fmt).join(', ') + '.';
  return a;
});

export default { id: 'calendar', name: 'Kalender', every: 10 * 60e3, load };
