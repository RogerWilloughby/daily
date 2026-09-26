// Kachel-Katalog: Reihenfolge = Priorität nach Nutzung (docs/konzept/entscheidungen.md, Abschnitt 3).
// state: loading | live | content | local | off
// Die Werte hier sind der Anfangszustand; Anbieter (providers/*) überschreiben sie mit echten Daten.

const T = (id, title, short, icon, extra = {}) => ({ id, title, short, icon, state: 'loading', m: '…', ms: '…', x: 'Wird geladen …', rows: [], ...extra });

export const TILES = [
  // Reihe 1 – täglicher Kern
  T('weather', 'Wetter', 'Wetter', 'sun'),
  T('calendar', 'Kalender', 'Termine', 'cal'),
  T('mail', 'Mail', 'Mail', 'mail', { state: 'off', m: 'Später', ms: '–', x: 'Noch nicht verbunden. Die Mail-Anbindung folgt in einer späteren Stufe.',
    rows: [['Status', 'bewusst zurückgestellt'], ['Geplant', 'Anzahl ungelesener und wichtiger Mails']] }),
  T('news', 'Schlagzeilen', 'News', 'news'),
  T('tasks', 'Mein Daily', 'Aufgaben', 'list', { state: 'local' }),
  // Reihe 2
  T('sport', 'Sport', 'Sport', 'ball'),
  T('money', 'Geld', 'Geld', 'money'),
  T('play', 'Rätsel & Witz', 'Rätsel', 'dice', { state: 'content' }),
  T('food', 'Essen', 'Essen', 'food', { state: 'content' }),
  T('knowledge', 'Wissen', 'Wissen', 'book'),
  // Reihe 3
  T('transit', 'Abfahrten', 'ÖPNV', 'tram'),
  T('health', 'Gesundheit', 'Fitness', 'heart', { state: 'content' }),
  T('travel', 'Land des Tages', 'Reisen', 'globe', { state: 'content' }),
  T('film', 'Filmtipp', 'Film', 'film', { state: 'content' }),
  T('tech', 'Tech', 'Tech', 'chip', { state: 'content' }),
  // Reihe 4
  T('saving', 'Sparen', 'Sparen', 'piggy', { state: 'content' }),
  T('relation', 'Beziehung', 'Paar', 'pair', { state: 'content' }),
  T('parcels', 'Pakete', 'Pakete', 'box', { state: 'off', m: 'Später', ms: '–', x: 'Noch nicht verbunden. Sendungen kommen später aus der Mail-Anbindung.',
    rows: [['Status', 'folgt mit der Mail-Anbindung'], ['Geplant', 'Sendungsstatus von DHL, Hermes, DPD & Co.']] }),
  null, // freier Platz
  T('usage', 'Deine Nutzung', 'Nutzung', 'bars', { state: 'local' })
];

export const byId = Object.fromEntries(TILES.filter(Boolean).map(t => [t.id, t]));
export const COLS = 5, ROWS = 4;
