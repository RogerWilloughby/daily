// Dienst „fussball“ (öffentlich, ortlos): Tabelle und drei Spieltage (voriger, aktueller, nächster) einer Liga – 1., 2. und 3. Bundesliga
// der Männer. Quelle: OpenLigaDB (frei, ohne Schlüssel). Eine Antwort je Liga (Adresse = Cache-Schlüssel, Entscheidung 02.10.2026):
// den eigenen Verein sucht die Oberfläche in der Antwort heraus. Ersetzt seit App 0.43.0 die Einzelfunktion api/sport.js.
const { getJson } = require('./_lib/http');
const { DienstFehler, iso } = require('./_lib/rahmen');
const { S } = require('./_lib/schema');
const { P } = require('./_lib/parameter');

const LIGEN = { bl1: '1. Bundesliga', bl2: '2. Bundesliga', bl3: '3. Liga' };
const BASIS = 'https://api.openligadb.de';
const QUELLEN = [{ name: 'OpenLigaDB (Community-Datenbank für Sportergebnisse)', lizenz: null, url: 'https://www.openligadb.de' }];

// Saison beginnt im Juli: September 2026 → Saison 2026 (= 2026/27)
const saison = (jetzt = Date.now()) => { const d = new Date(jetzt); return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1; };
const zahl = v => (Number.isFinite(+v) ? +v : null);
const verein = t => ({ id: t && t.teamInfoId != null ? +t.teamInfoId : null, name: (t && t.teamName) || '', kurz: (t && (t.shortName || t.teamName)) || '' });
// Endstand (resultTypeID 2), sonst der letzte gemeldete Stand
function tore(m) {
  const rs = m.matchResults || [];
  const e = rs.find(r => r.resultTypeID === 2) || rs[rs.length - 1];
  return e ? [zahl(e.pointsTeam1), zahl(e.pointsTeam2)] : null;
}

// OpenLigaDB → Vertrag (rein, testbar). Aktueller Spieltag: der des frühesten offenen Spiels (sonst der letzte)
function umwandeln(liga, jahr, tabelle, spiele) {
  const tab = (Array.isArray(tabelle) ? tabelle : []).map((r, i) => ({
    platz: i + 1, ...verein(r), spiele: zahl(r.matches), siege: zahl(r.won), unentschieden: zahl(r.draw), niederlagen: zahl(r.lost),
    tore: zahl(r.goals), gegentore: zahl(r.opponentGoals), differenz: zahl(r.goalDiff), punkte: zahl(r.points)
  }));
  const alle = (Array.isArray(spiele) ? spiele : []).filter(m => m && m.group && m.team1 && m.team2)
    .map(m => ({ nr: m.group.groupOrderID, name: m.group.groupName || `${m.group.groupOrderID}. Spieltag`,
      spiel: { heim: verein(m.team1), gast: verein(m.team2), beginn: m.matchDateTimeUTC ? iso(Date.parse(m.matchDateTimeUTC)) : null,
        beendet: !!m.matchIsFinished, tore: m.matchIsFinished ? tore(m) : null } }))
    .sort((a, b) => String(a.spiel.beginn).localeCompare(String(b.spiel.beginn)));
  const offen = alle.find(x => !x.spiel.beendet);
  const aktuell = offen ? offen.nr : (alle.length ? alle[alle.length - 1].nr : null);
  const spieltage = aktuell == null ? [] : [aktuell - 1, aktuell, aktuell + 1].map(nr => {
    const s = alle.filter(x => x.nr === nr);
    return s.length ? { nr, name: s[0].name, spiele: s.map(x => x.spiel) } : null;
  }).filter(Boolean);
  return { liga: { id: liga, name: LIGEN[liga] }, saison: jahr, aktuell, tabelle: tab, spieltage };
}

const VEREIN = () => S.obj({ id: S.ganz(), name: S.text(), kurz: S.text() });
const SCHEMA = S.obj({
  liga: S.obj({ id: S.text(), name: S.text() }), saison: S.ganz(), aktuell: S.ganz({ minimum: 1 }),
  tabelle: S.liste(S.obj({ platz: S.ganz({ minimum: 1 }), id: S.ganz(), name: S.text(), kurz: S.text(), spiele: S.ganz(), siege: S.ganz(), unentschieden: S.ganz(),
    niederlagen: S.ganz(), tore: S.ganz(), gegentore: S.ganz(), differenz: S.ganz(), punkte: S.ganz() })),
  spieltage: S.liste(S.obj({ nr: S.ganz({ minimum: 1 }), name: S.text(),
    spiele: S.liste(S.obj({ heim: VEREIN(), gast: VEREIN(), beginn: S.zeit(), beendet: S.ja(), tore: { type: ['array', 'null'], items: S.ganz() } })) }))
});

module.exports = {
  id: 'fussball',
  version: 1,
  programmversion: '1.0.0',
  aenderungen: [{ version: '1.0.0', datum: '2026-10-02', text: 'Erste Fassung: Tabelle und drei Spieltage je Liga (1.–3. Bundesliga) – eine Antwort je Liga statt je Verein; ersetzt api/sport.js' }],
  titel: 'Fußball',
  beschreibung: 'Tabelle sowie voriger, aktueller und nächster Spieltag der 1., 2. oder 3. Bundesliga (Männer) – mit Ergebnissen und Anstoßzeiten.',
  eingaben: { liga: 'Liga (Pflicht): bl1 = 1. Bundesliga, bl2 = 2. Bundesliga, bl3 = 3. Liga' },
  parameter: { liga: P.wahl(Object.keys(LIGEN)) },   // erlaubte Angaben = Cache-Schlüssel (_lib/parameter.js)
  laender: 'alle',
  klasse: 'oeffentlich',
  ttl: 600,
  takt: 600,   // alle 10 Minuten neu – an Spieltagen kommen Ergebnisse so zeitnah
  quellen: QUELLEN,
  schema: SCHEMA,
  blatt: {
    zweck: 'Liefert die Kachel „Sport“: Platz, letztes und nächstes Spiel des eigenen Vereins, Tabelle und Spieltag. Den Verein sucht die Oberfläche in der Antwort der Liga.',
    herkunft: [
      'OpenLigaDB: Tabelle (getbltable) und alle Spiele der Saison (getmatchdata) je Liga – frei, ohne Schlüssel, von einer Community gepflegt.',
      'Nur Daten (Tabelle, Ergebnisse, Anstoßzeiten), keine Berichte oder Texte.'
    ],
    verarbeitung: [
      'Eingabe nur die Liga (bl1, bl2, bl3) – eine Antwort je Liga für alle Nutzer; andere Angaben werden abgelehnt.',
      'Saison: ab Juli die neue (September 2026 → 2026/27).',
      'Aktueller Spieltag: der des frühesten noch nicht beendeten Spiels, sonst der letzte; dazu voriger und nächster Spieltag.',
      'Tore nur bei beendeten Spielen (Endstand, sonst letzter gemeldeter Stand). Ist OpenLigaDB nicht erreichbar: quelle_fehler.'
    ],
    ausgabe: {
      liga: 'Liga', 'liga.id': 'bl1, bl2 oder bl3', 'liga.name': 'Name der Liga', saison: 'Jahr des Saisonbeginns (2026 = 2026/27)', aktuell: 'Nummer des aktuellen Spieltags',
      tabelle: 'Tabelle, Platz 1 zuerst', 'tabelle[].platz': 'Platz', 'tabelle[].id': 'Vereins-Nummer bei OpenLigaDB', 'tabelle[].name': 'Vereinsname', 'tabelle[].kurz': 'Kurzname',
      'tabelle[].spiele': 'Spiele', 'tabelle[].siege': 'Siege', 'tabelle[].unentschieden': 'Unentschieden', 'tabelle[].niederlagen': 'Niederlagen',
      'tabelle[].tore': 'erzielte Tore', 'tabelle[].gegentore': 'Gegentore', 'tabelle[].differenz': 'Tordifferenz', 'tabelle[].punkte': 'Punkte',
      spieltage: 'voriger, aktueller und nächster Spieltag (soweit vorhanden)', 'spieltage[].nr': 'Nummer', 'spieltage[].name': 'Name (z. B. 9. Spieltag)',
      'spieltage[].spiele': 'Spiele, nach Anstoß sortiert', 'spieltage[].spiele[].heim': 'Heimverein', 'spieltage[].spiele[].heim.id': 'Vereins-Nummer',
      'spieltage[].spiele[].heim.name': 'Vereinsname', 'spieltage[].spiele[].heim.kurz': 'Kurzname', 'spieltage[].spiele[].gast': 'Gastverein',
      'spieltage[].spiele[].gast.id': 'Vereins-Nummer', 'spieltage[].spiele[].gast.name': 'Vereinsname', 'spieltage[].spiele[].gast.kurz': 'Kurzname',
      'spieltage[].spiele[].beginn': 'Anstoß (UTC)', 'spieltage[].spiele[].beendet': 'true = Spiel beendet', 'spieltage[].spiele[].tore': '[Heim, Gast] bei beendeten Spielen, sonst null'
    },
    skalierung: {
      klasse: 'B',
      quelle: 'OpenLigaDB: frei, ohne Schlüssel, ohne veröffentlichte Grenze und ohne Verfügbarkeitszusage.',
      kosten: 'Je Liga und 10 Minuten 2 Abrufe (Tabelle, Spiele der Saison ≈ 300 Spiele); Umwandeln < 5 ms.',
      cache: 'Für alle gleich je Liga: CDN und Instanz halten die Antwort 10 Minuten – höchstens 3 Fächer.',
      bei10Mio: 'Unkritisch: höchstens 3 Ligen × 2 Abrufe alle 10 Minuten (≈ 860 am Tag), unabhängig von der Nutzerzahl – der Rest sind Cache-Treffer.'
    }
  },
  async run(eingabe, ctx = {}) {
    const liga = String(eingabe.liga || '');
    if (!LIGEN[liga]) throw new DienstFehler('eingabe_fehlt', 'Liga fehlt: liga=bl1, bl2 oder bl3');
    const jahr = saison(ctx.jetzt || Date.now());
    let tabelle, spiele;
    try {
      [tabelle, spiele] = await Promise.all([getJson(`${BASIS}/getbltable/${liga}/${jahr}`, { timeout: 8000 }), getJson(`${BASIS}/getmatchdata/${liga}/${jahr}`, { timeout: 10000 })]);
    } catch (e) { throw new DienstFehler('quelle_fehler', 'OpenLigaDB: ' + e.message); }
    return { daten: umwandeln(liga, jahr, tabelle, spiele) };
  },
  umwandeln, saison, LIGEN
};
