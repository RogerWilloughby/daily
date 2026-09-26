// Feiertage & Ferien für das Bundesland des gewählten Orts.
// Feiertage, Brückentage und Zeitumstellung rechnet DAILY selbst; Schulferien kommen über /api/holidays (OpenHolidays).
import { set } from '../core/board.js';
import { settings } from '../core/store.js';
import { addAnswer } from '../core/ask.js';
import { berlinDay, getJson } from '../core/util.js';
import { STATES, holidays, bridgeDay, daysBetween, clockChanges } from '../lib/feiertage.js';

let info = null;
const fmt = k => new Date(k + 'T12:00:00Z').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' });
const inDays = n => n === 0 ? 'heute' : n === 1 ? 'morgen' : `in ${n} Tagen`;

export async function load() {
  const st = STATES[settings.place.admin];
  if (!st) {
    info = null;
    set('holidays', { state: 'off', m: 'Nur Deutschland', ms: '–', x: 'Feiertage und Ferien gibt es für Orte in Deutschland. Ort in den Einstellungen wählen.',
      rows: [['Ort', settings.place.name + (settings.place.admin ? ', ' + settings.place.admin : '')]] });
    return;
  }
  const today = berlinDay(), y = +today.slice(0, 4);
  const hol = [...holidays(y, st), ...holidays(y + 1, st)].filter(h => h.date >= today);
  const bridges = hol.map(h => ({ h, date: bridgeDay(h) })).filter(b => b.date && b.date >= today);
  const clock = [...clockChanges(y), ...clockChanges(y + 1)].find(c => c.date >= today);
  let school = [], schoolOk = true;
  try { school = (await getJson('/api/holidays?state=' + st)).school || []; } catch (e) { schoolOk = false; }
  school = school.filter(s => s.end >= today);
  info = { st, hol, school, bridges, clock, today };

  const cur = school.find(s => s.start <= today);
  const nextSchool = school.find(s => s.start > today);
  const nextHol = hol[0];
  // Kennzahl: was als Nächstes kommt (laufende Ferien zuerst)
  let m, ms, lead = '';
  if (nextHol && nextHol.date === today) { m = 'Heute ' + nextHol.name; ms = 'Feiertag'; }
  else if (cur) { m = `${cur.name} bis ${fmt(cur.end)}`; ms = 'Ferien'; }
  else {
    const cands = [nextHol && { name: nextHol.name, date: nextHol.date, d: daysBetween(today, nextHol.date) }, nextSchool && { name: nextSchool.name, date: nextSchool.start, d: daysBetween(today, nextSchool.start) }].filter(Boolean).sort((a, b) => a.d - b.d);
    m = cands.length ? cands[0].name : 'Keine Termine';
    lead = cands.length ? `${inDays(cands[0].d)[0].toUpperCase()}${inDays(cands[0].d).slice(1)} (${fmt(cands[0].date)})` : '';
    ms = cands.length ? `${cands[0].d} Tage` : '–';
  }
  const tease = [
    lead,
    nextHol && (m.startsWith(nextHol.name) ? null : `${nextHol.name} ${fmt(nextHol.date)}`),
    nextSchool && (m.startsWith(nextSchool.name) ? `bis ${fmt(nextSchool.end)}` : `${nextSchool.name} ab ${fmt(nextSchool.start)}`),
    clock && daysBetween(today, clock.date) <= 40 && `Zeitumstellung ${fmt(clock.date)}`
  ].filter(Boolean).join(' · ');

  const rows = [['Bundesland', settings.place.admin]];
  hol.slice(0, 5).forEach(h => rows.push([fmt(h.date), h.name + (h.weekday === 0 || h.weekday === 6 ? ' (Wochenende)' : '')]));
  if (bridges[0]) rows.push(['Brückentag', `${fmt(bridges[0].date)} (vor/nach ${bridges[0].h.name})`]);
  school.slice(0, 3).forEach(s => rows.push([s.name, `${fmt(s.start)} – ${fmt(s.end)}`]));
  if (!schoolOk) rows.push(['Schulferien', 'gerade nicht abrufbar']);
  if (clock) rows.push(['Zeitumstellung', `${fmt(clock.date)}: ${clock.name}`]);
  rows.push(['Quelle', 'Feiertage berechnet (landesweit) · Schulferien: OpenHolidays']);

  set('holidays', { state: schoolOk ? 'live' : 'content', m, ms, x: tease, rows });
}

addAnswer(/ferien|feiertag|brückentag|brueckentag|frei|zeitumstellung|uhr umstellen/i, q => {
  if (!info) return 'Feiertage und Ferien gibt es nur für Orte in Deutschland.';
  if (/zeit|uhr/i.test(q) && info.clock) return `${info.clock.name} am ${fmt(info.clock.date)}.`;
  if (/ferien/i.test(q)) {
    const s = info.school[0];
    return s ? (s.start <= info.today ? `Gerade sind ${s.name}, bis ${fmt(s.end)}.` : `Nächste Ferien: ${s.name} vom ${fmt(s.start)} bis ${fmt(s.end)}.`) : 'Keine Ferientermine gefunden.';
  }
  const h = info.hol[0];
  return h ? `Nächster Feiertag in ${settings.place.admin}: ${h.name}, ${fmt(h.date)} (${inDays(daysBetween(info.today, h.date))}).` : null;
});

export default { id: 'holidays', name: 'Feiertage', every: 6 * 3600e3, load };
