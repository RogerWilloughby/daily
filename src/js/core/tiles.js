// Kachel-Katalog und Layouts (docs/konzept/entscheidungen.md, Abschnitt 3).
// Strategie: öffentlich nur Kacheln ohne Nutzerdaten (außer Ort) und ohne Nachrichten.
// scope 'private' = nur im privaten Betrieb (Vercel-Variable DAILY_PRIVATE=1), z. B. Kalender und Schlagzeilen.
// state: loading | live | content | local | off
// fertig: true = überarbeitet (Dienst daily/1 oder rein lokal). Nicht fertige Kacheln sind ausgeblendet,
// bis sie umgezogen sind – sichtbar nur mit „Alle Kacheln zeigen (Vorschau)“ in den Einstellungen.

const T = (id, title, short, icon, extra = {}) => ({ id, title, name: title, short, icon, scope: 'public', state: 'loading', m: '…', ms: '…', x: 'Wird geladen …', rows: [], ...extra });

export const CATALOG = [
  T('weather', 'Wetter', 'Wetter', null, { fertig: true }),   // kein festes Symbol: das Wettersymbol neben dem Wert zeigt das aktuelle Wetter
  T('kalender', 'Kalender', 'Kalender', 'cal', { fertig: true, hover: 'Kalender / Termine' }),   // Feiertage, Ferien, Aktionstage, Mond, Finsternisse (ersetzt „Feiertage & Ferien“ und „Himmel“)
  T('links', 'Meine Seiten', 'Seiten', 'link', { state: 'local', fertig: true }),
  T('tasks', 'Mein Daily', 'Aufgaben', 'list', { state: 'local', fertig: true }),
  T('verkehr', 'Verkehr', 'Verkehr', 'tram', { fertig: true, hover: 'Verkehr' }),   // Abfahrten, Tanken (später Arbeitsweg); ersetzt „Abfahrten“ und „Tanken“
  T('sport', 'Sport', 'Sport', 'ball'),
  T('money', 'Finanzen', 'Finanzen', 'money', { fertig: true, hover: 'Finanzen' }),   // Mini-Reiter: Kurse, Zinsen & Inflation (EZB), privat Märkte, Spartipp (ersetzt „Sparen“)
  T('unterhaltung', 'Unterhaltung', 'Spaß', 'lachen', { state: 'content', fertig: true, hover: 'Unterhaltung' }),   // Rätsel, Witz, Film mit Verlauf und Favoriten (ersetzt „Rätsel & Witz“ und „Filmtipp“)
  T('food', 'Essen', 'Essen', 'food', { state: 'content' }),
  T('knowledge', 'Wissen', 'Wissen', 'book'),
  T('travel', 'Land des Tages', 'Reisen', 'globe', { state: 'content' }),
  T('health', 'Gesundheit', 'Fitness', 'heart', { state: 'content' }),
  T('tech', 'Tech', 'Tech', 'chip', { state: 'content' }),
  T('relation', 'Beziehung', 'Paar', 'pair', { state: 'content' }),
  T('tools', 'Tools', 'Tools', 'tool', { state: 'local', fertig: true, hover: 'Tools' }),   // eigenständige Werkzeuge (src/tools/), öffnen im neuen Tab
  T('usage', 'Deine Nutzung', 'Nutzung', 'bars', { state: 'local', fertig: true }),
  // nur privat
  T('news', 'Schlagzeilen', 'News', 'news', { scope: 'private' })
];

// Höchstens 20 Kacheln; ohne eigene Auswahl 12 (Testeinstellung: fertige zuerst, dann Vorschau-Kacheln).
export const SLOTS = 20, STANDARD_ANZAHL = 12;

// Standard-Belegung, Zeile für Zeile (Priorität nach Nutzung)
export const LAYOUTS = {
  public: [
    'weather', 'kalender', 'links', 'tasks', 'verkehr',
    'sport', 'money', 'unterhaltung', 'food', 'knowledge',
    'travel',
    'health', 'tech', 'relation', 'tools', 'usage'
  ],
  private: [
    'weather', 'kalender', 'news', 'tasks', 'verkehr',
    'sport', 'money', 'unterhaltung', 'food', 'knowledge',
    'relation', 'links', 'tech',
    'travel', 'tools', 'usage'
  ]
};

export const byId = Object.fromEntries(CATALOG.map(t => [t.id, t]));

// Aktive Belegung (wird beim Start einmal gesetzt) – nur echte Kacheln, das Raster richtet sich nach ihrer Zahl (raster()).
// custom (Liste von Kachel-IDs aus Einstellungen → Kacheln): genau diese Kacheln in dieser Reihenfolge – auch „Vorschau“-Kacheln
// (noch nicht überarbeitet); unbekannte, doppelte oder im öffentlichen Betrieb private werden übergangen.
// Ohne eigene Belegung: 12 Kacheln der Standardbelegung – überarbeitete (fertig: true) zuerst, dann Vorschau-Kacheln.
export const TILES = [];
export const erlaubt = (id, isPrivate) => !!byId[id] && (isPrivate || byId[id].scope === 'public');
// Frühere Kacheln, die in einer anderen aufgegangen sind: gespeicherte eigene Belegungen zeigen die neue Kachel
export const ERSETZT = { transit: 'verkehr', fuel: 'verkehr', saving: 'money', play: 'unterhaltung', film: 'unterhaltung' };   // „Sparen“ seit 0.31.0 als Reiter „Spartipp“ in „Finanzen“
export function chooseLayout(isPrivate, custom) {
  const eigene = Array.isArray(custom);
  const std = LAYOUTS[isPrivate ? 'private' : 'public'];
  const quelle = eigene ? custom.map(id => ERSETZT[id] || id) : [...std.filter(id => byId[id] && byId[id].fertig), ...std.filter(id => byId[id] && !byId[id].fertig)];
  const max = eigene ? SLOTS : STANDARD_ANZAHL, ids = [];
  for (const id of quelle) {
    if (ids.length >= max) break;
    if (erlaubt(id, isPrivate) && !ids.includes(id)) ids.push(id);
  }
  TILES.splice(0, TILES.length, ...ids.map(id => byId[id]));
  return TILES;
}

// Raster aus Kachelzahl und Fläche (rein, testbar): alle Spaltenzahlen durchprobieren; gewinnt die Aufteilung, in deren
// Kacheln das größte Rechteck im Wunsch-Seitenverhältnis passt (Rechner 1,4 = leicht quer wie bisher, Handy 1 = quadratisch);
// bei Gleichstand (±2 %) weniger freie Plätze.
export function raster(n, breite, hoehe, abstand = 10, verhaeltnis = 1.4) {
  if (n < 1 || !(breite > 0) || !(hoehe > 0)) return { cols: 1, rows: 1 };
  let best = null;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    if ((cols - 1) * rows >= n) continue;                       // eine Spalte wäre überflüssig
    const w = (breite - (cols - 1) * abstand) / cols, h = (hoehe - (rows - 1) * abstand) / rows;
    const k = { cols, rows, seite: Math.min(w / verhaeltnis, h), frei: cols * rows - n };
    if (!best || k.seite > best.seite * 1.02 || (k.seite >= best.seite * 0.98 && k.frei < best.frei)) best = k;
  }
  return { cols: best.cols, rows: best.rows };
}
