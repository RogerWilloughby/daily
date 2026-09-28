// Fußball über /api/sport (OpenLigaDB): Tabellenplatz, letztes und nächstes Spiel des eigenen Vereins.
import { set } from '../core/board.js';
import { settings, saveSettings } from '../core/store.js';
import { kachelEinstellungen } from '../core/einstellungen.js';
import { addAnswer } from '../core/ask.js';
import { getJson } from '../core/util.js';

let data = null;
const when = iso => new Date(iso).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
const RES = { S: 'Sieg', U: 'Unentschieden', N: 'Niederlage' };

export async function load() {
  const j = await getJson('/api/sport?team=' + encodeURIComponent(settings.team || 'Dynamo Dresden'));
  if (!j.found) {
    data = null;
    set('sport', { state: 'off', title: 'Sport', m: 'Verein wählen', ms: '–', x: `„${settings.team}“ wurde in der 1. bis 3. Liga nicht gefunden. Verein in den Einstellungen der Kachel (Zahnrad) anpassen.`,
      rows: [['Gesucht', settings.team], ['Ligen', '1., 2. und 3. Bundesliga (OpenLigaDB)']] });
    return;
  }
  data = j;
  const me = j.table.find(r => r.isTeam);
  const around = j.table.filter(r => Math.abs(r.pos - me.pos) <= 2);
  const rows = [
    ['Liga', `${j.league.name} ${j.season}/${String(j.season + 1).slice(2)}`],
    ['Platz', `${me.pos}. mit ${me.points} Punkten · ${me.games} Spiele · Tore ${me.goals}:${me.against}`]
  ];
  if (j.last) rows.push(['Letztes Spiel', `${j.last.home} – ${j.last.away} ${j.last.score} (${RES[j.last.result] || ''})`]);
  if (j.next) rows.push(['Nächstes Spiel', `${when(j.next.date)}: ${j.next.home} – ${j.next.away}`]);
  around.forEach(r => rows.push([`${r.pos}.`, `${r.team} · ${r.points} Pkt${r.isTeam ? ' ◀' : ''}`]));
  if (j.matchday && j.matchday.matches.length) {
    rows.push([j.matchday.name, j.matchday.matches.map(m => `${m.home} ${m.score || '–:–'} ${m.away}`).join(' · ')]);
  }
  rows.push(['Quelle', 'OpenLigaDB']);
  const shortName = j.team.short || j.team.name;
  set('sport', {
    state: 'live', title: shortName,
    m: `Platz ${me.pos}`, ms: `Platz ${me.pos}`,
    x: [j.last ? `Zuletzt ${j.last.score} gegen ${j.last.opponent}` : null, j.next ? `Nächstes: ${when(j.next.date)} gegen ${j.next.opponent}` : null].filter(Boolean).join(' · ') || j.league.name,
    rows
  });
}

addAnswer(/sport|fußball|fussball|bundesliga|dynamo|spiel|tabelle|verein/i, () => {
  if (!data) return 'Die Fußballdaten sind gerade nicht verfügbar – oder der Verein ist in den Einstellungen noch nicht gefunden.';
  const me = data.table.find(r => r.isTeam);
  return `${data.team.name}: Platz ${me.pos} in der ${data.league.name} mit ${me.points} Punkten.` +
    (data.last ? ` Zuletzt ${data.last.home} – ${data.last.away} ${data.last.score}.` : '') +
    (data.next ? ` Nächstes Spiel: ${when(data.next.date)}, ${data.next.home} – ${data.next.away}.` : '');
});

// Einstellungen der Kachel (Zahnrad-Reiter)
kachelEinstellungen('sport', {
  felder: () => [{ typ: 'text', key: 'team', label: 'Verein', wert: settings.team || '', platzhalter: 'z. B. Dynamo Dresden', hilfe: '1., 2. oder 3. Fußball-Bundesliga der Männer.' }],
  speichern: w => saveSettings({ team: w.team.trim() || 'Dynamo Dresden' })
});

export default { id: 'sport', name: 'Fußball', every: 15 * 60e3, load };
