// DAILY – Fußball über OpenLigaDB (frei, ohne Schlüssel): sucht den Verein in 1., 2. und 3. Liga
// und liefert Tabellenplatz, letztes/nächstes Spiel und den aktuellen Spieltag. Nur Daten, keine Berichte.
const { getJson, send, norm } = require('./_lib/http');

const LEAGUES = [
  { id: 'bl1', name: '1. Bundesliga' },
  { id: 'bl2', name: '2. Bundesliga' },
  { id: 'bl3', name: '3. Liga' }
];
const BASE = 'https://api.openligadb.de';

// Saison beginnt im Juli: September 2026 → Saison 2026 (= 2026/27)
function season(d = new Date()) { return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1; }

function matchesTeam(name, q) {
  const n = norm(name), words = norm(q).split(' ').filter(w => w.length > 2);
  return words.length > 0 && words.every(w => n.includes(w));
}

function finalScore(m) {
  const rs = m.matchResults || m.MatchResults || [];
  const end = rs.find(r => (r.resultTypeID ?? r.ResultTypeID) === 2) || rs[rs.length - 1];
  if (!end) return null;
  return [end.pointsTeam1 ?? end.PointsTeam1, end.pointsTeam2 ?? end.PointsTeam2];
}

const nameOf = t => (t && (t.shortName || t.teamName)) || '';
const fullOf = t => (t && t.teamName) || '';
const dateOf = m => m.matchDateTimeUTC || m.matchDateTime;

function summarize(league, yr, table, matches, q) {
  const rowIdx = table.findIndex(r => matchesTeam(r.teamName, q) || matchesTeam(r.shortName, q));
  if (rowIdx < 0) return null;
  const me = table[rowIdx];
  const tbl = table.map((r, i) => ({
    pos: i + 1, team: r.teamName, short: r.shortName || r.teamName, games: r.matches, points: r.points,
    goals: r.goals, against: r.opponentGoals, diff: r.goalDiff, isTeam: i === rowIdx
  }));
  const mine = matches.filter(m => [m.team1, m.team2].some(t => t && (t.teamInfoId === me.teamInfoId || matchesTeam(t.teamName, q))))
    .sort((a, b) => String(dateOf(a)).localeCompare(String(dateOf(b))));
  const done = mine.filter(m => m.matchIsFinished);
  const lastM = done[done.length - 1];
  const nextM = mine.find(m => !m.matchIsFinished);
  const isHome = m => m.team1 && (m.team1.teamInfoId === me.teamInfoId || matchesTeam(m.team1.teamName, q));
  let last = null;
  if (lastM) {
    const s = finalScore(lastM) || [0, 0];
    const own = isHome(lastM) ? s[0] : s[1], opp = isHome(lastM) ? s[1] : s[0];
    last = { date: dateOf(lastM), home: nameOf(lastM.team1), away: nameOf(lastM.team2), score: `${s[0]}:${s[1]}`,
      opponent: nameOf(isHome(lastM) ? lastM.team2 : lastM.team1), result: own > opp ? 'S' : own < opp ? 'N' : 'U' };
  }
  const next = nextM ? { date: dateOf(nextM), home: nameOf(nextM.team1), away: nameOf(nextM.team2), opponent: nameOf(isHome(nextM) ? nextM.team2 : nextM.team1) } : null;
  // Spieltag: der des nächsten Spiels, sonst der des letzten
  const ref = nextM || lastM;
  let matchday = null;
  if (ref && ref.group) {
    const g = ref.group.groupOrderID;
    matchday = {
      name: ref.group.groupName || `${g}. Spieltag`,
      matches: matches.filter(m => m.group && m.group.groupOrderID === g)
        .map(m => { const s = m.matchIsFinished ? finalScore(m) : null; return { home: nameOf(m.team1), away: nameOf(m.team2), score: s ? `${s[0]}:${s[1]}` : null, date: dateOf(m) }; })
    };
  }
  return { found: true, league, season: yr, team: { name: fullOf(me) || me.teamName, short: me.shortName || me.teamName }, table: tbl, last, next, matchday };
}

async function handler(req, res) {
  const q = String((req.query && req.query.team) || 'Dynamo Dresden').slice(0, 60);
  const yr = season();
  for (const league of LEAGUES) {
    let table;
    try { table = await getJson(`${BASE}/getbltable/${league.id}/${yr}`); } catch (e) { continue; }
    if (!Array.isArray(table) || !table.some(r => matchesTeam(r.teamName, q) || matchesTeam(r.shortName, q))) continue;
    let matches = [];
    try { matches = await getJson(`${BASE}/getmatchdata/${league.id}/${yr}`, { timeout: 10000 }); } catch (e) { matches = []; }
    const out = summarize(league, yr, table, Array.isArray(matches) ? matches : [], q);
    if (out) return send(res, out, 600);
  }
  send(res, { found: false, team: q, season: yr }, 600);
}

module.exports = handler;
module.exports.summarize = summarize;
module.exports.season = season;
