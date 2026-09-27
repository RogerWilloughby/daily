// Kachel-Katalog und Layouts (docs/konzept/entscheidungen.md, Abschnitt 3).
// Strategie: öffentlich nur Kacheln ohne Nutzerdaten (außer Ort) und ohne Nachrichten.
// scope 'private' = nur im privaten Betrieb (Vercel-Variable DAILY_PRIVATE=1), z. B. Kalender und Schlagzeilen.
// state: loading | live | content | local | off
// fertig: true = überarbeitet (Dienst daily/1 oder rein lokal). Nicht fertige Kacheln sind ausgeblendet,
// bis sie umgezogen sind – sichtbar nur mit „Alle Kacheln zeigen (Vorschau)“ in den Einstellungen.

const T = (id, title, short, icon, extra = {}) => ({ id, title, short, icon, scope: 'public', state: 'loading', m: '…', ms: '…', x: 'Wird geladen …', rows: [], ...extra });

export const CATALOG = [
  T('weather', 'Wetter', 'Wetter', null, { fertig: true }),   // kein festes Symbol: das Wettersymbol neben dem Wert zeigt das aktuelle Wetter
  T('holidays', 'Feiertage & Ferien', 'Ferien', 'flag'),
  T('links', 'Meine Seiten', 'Seiten', 'link', { state: 'local', fertig: true }),
  T('tasks', 'Mein Daily', 'Aufgaben', 'list', { state: 'local', fertig: true }),
  T('transit', 'Abfahrten', 'ÖPNV', 'tram'),
  T('sport', 'Sport', 'Sport', 'ball'),
  T('money', 'Geld', 'Geld', 'money'),
  T('play', 'Rätsel & Witz', 'Rätsel', 'dice', { state: 'content' }),
  T('food', 'Essen', 'Essen', 'food', { state: 'content' }),
  T('knowledge', 'Wissen', 'Wissen', 'book'),
  T('fuel', 'Tanken', 'Tanken', 'fuel'),
  T('sky', 'Himmel', 'Himmel', 'moon', { state: 'local' }),
  T('travel', 'Land des Tages', 'Reisen', 'globe', { state: 'content' }),
  T('film', 'Filmtipp', 'Film', 'film', { state: 'content' }),
  T('health', 'Gesundheit', 'Fitness', 'heart', { state: 'content' }),
  T('tech', 'Tech', 'Tech', 'chip', { state: 'content' }),
  T('saving', 'Sparen', 'Sparen', 'piggy', { state: 'content' }),
  T('relation', 'Beziehung', 'Paar', 'pair', { state: 'content' }),
  T('usage', 'Deine Nutzung', 'Nutzung', 'bars', { state: 'local', fertig: true }),
  // nur privat
  T('calendar', 'Kalender', 'Termine', 'cal', { scope: 'private' }),
  T('news', 'Schlagzeilen', 'News', 'news', { scope: 'private' })
];

export const COLS = 5, ROWS = 4, SLOTS = COLS * ROWS;

// Standard-Belegung, Zeile für Zeile (Priorität nach Nutzung)
export const LAYOUTS = {
  public: [
    'weather', 'holidays', 'links', 'tasks', 'transit',
    'sport', 'money', 'play', 'food', 'knowledge',
    'fuel', 'sky', 'travel', 'film',
    'health', 'tech', 'saving', 'relation', 'usage'
  ],
  private: [
    'weather', 'calendar', 'news', 'tasks', 'transit',
    'sport', 'money', 'play', 'food', 'knowledge',
    'fuel', 'sky', 'holidays', 'film', 'relation',
    'links', 'tech', 'saving', 'travel', 'usage'
  ]
};

export const byId = Object.fromEntries(CATALOG.map(t => [t.id, t]));

// Aktive Belegung (wird beim Start einmal gesetzt). Ein eigenes Layout (später aus den Einstellungen)
// wird geprüft: nur bekannte, erlaubte Kacheln, keine doppelten, auf 20 Plätze aufgefüllt (sonst freier Platz).
export const TILES = [];
// alle = true: auch noch nicht überarbeitete Kacheln (Vorschau)
export function chooseLayout(isPrivate, custom, alle = false) {
  const allowed = id => byId[id] && (isPrivate || byId[id].scope === 'public') && (alle || byId[id].fertig);
  const base = LAYOUTS[isPrivate ? 'private' : 'public'];
  const ids = [];
  for (const id of [...(Array.isArray(custom) ? custom : []), ...base]) {
    if (ids.length >= SLOTS) break;
    if (allowed(id) && !ids.includes(id)) ids.push(id);
  }
  // Fehlende Plätze bleiben frei (null → „Freier Platz“): ausgeblendete Kacheln, Warnungen stecken in der Wetterkachel
  TILES.splice(0, TILES.length, ...ids.map(id => byId[id]), ...Array(SLOTS - ids.length).fill(null));
  return TILES;
}
