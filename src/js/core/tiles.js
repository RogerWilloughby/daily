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
  T('transit', 'Abfahrten', 'ÖPNV', 'tram'),
  T('sport', 'Sport', 'Sport', 'ball'),
  T('money', 'Geld', 'Geld', 'money'),
  T('play', 'Rätsel & Witz', 'Rätsel', 'dice', { state: 'content' }),
  T('food', 'Essen', 'Essen', 'food', { state: 'content' }),
  T('knowledge', 'Wissen', 'Wissen', 'book'),
  T('fuel', 'Tanken', 'Tanken', 'fuel'),
  T('travel', 'Land des Tages', 'Reisen', 'globe', { state: 'content' }),
  T('film', 'Filmtipp', 'Film', 'film', { state: 'content' }),
  T('health', 'Gesundheit', 'Fitness', 'heart', { state: 'content' }),
  T('tech', 'Tech', 'Tech', 'chip', { state: 'content' }),
  T('saving', 'Sparen', 'Sparen', 'piggy', { state: 'content' }),
  T('relation', 'Beziehung', 'Paar', 'pair', { state: 'content' }),
  T('usage', 'Deine Nutzung', 'Nutzung', 'bars', { state: 'local', fertig: true }),
  // nur privat
  T('news', 'Schlagzeilen', 'News', 'news', { scope: 'private' })
];

export const COLS = 5, ROWS = 4, SLOTS = COLS * ROWS;

// Standard-Belegung, Zeile für Zeile (Priorität nach Nutzung)
export const LAYOUTS = {
  public: [
    'weather', 'kalender', 'links', 'tasks', 'transit',
    'sport', 'money', 'play', 'food', 'knowledge',
    'fuel', 'travel', 'film',
    'health', 'tech', 'saving', 'relation', 'usage'
  ],
  private: [
    'weather', 'kalender', 'news', 'tasks', 'transit',
    'sport', 'money', 'play', 'food', 'knowledge',
    'fuel', 'film', 'relation', 'links', 'tech',
    'saving', 'travel', 'usage'
  ]
};

export const byId = Object.fromEntries(CATALOG.map(t => [t.id, t]));

// Aktive Belegung (wird beim Start einmal gesetzt).
// custom (Liste von Kachel-IDs aus Einstellungen → Kacheln): genau diese Kacheln in dieser Reihenfolge – auch „Vorschau“-Kacheln
// (noch nicht überarbeitet); unbekannte, doppelte oder im öffentlichen Betrieb private werden übergangen.
// Ohne eigene Belegung: die Standardbelegung, davon nur überarbeitete Kacheln (fertig: true).
// Übrige Plätze bleiben frei (null → „Freier Platz“).
export const TILES = [];
export const erlaubt = (id, isPrivate) => !!byId[id] && (isPrivate || byId[id].scope === 'public');
export function chooseLayout(isPrivate, custom) {
  const eigene = Array.isArray(custom);
  const quelle = eigene ? custom : LAYOUTS[isPrivate ? 'private' : 'public'].filter(id => byId[id] && byId[id].fertig);
  const ids = [];
  for (const id of quelle) {
    if (ids.length >= SLOTS) break;
    if (erlaubt(id, isPrivate) && !ids.includes(id)) ids.push(id);
  }
  TILES.splice(0, TILES.length, ...ids.map(id => byId[id]), ...Array(SLOTS - ids.length).fill(null));
  return TILES;
}
