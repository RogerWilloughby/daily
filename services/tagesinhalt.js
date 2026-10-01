// Dienst „tagesinhalt“ (öffentlich, ortlos): die Tagesinhalte eines Tags – Rätsel, Witz, Wort, Sprichwort, Rezept, Land, Film,
// Gesundheit, Tech, Beziehung, Spartipp. Quelle: feste Datei src/content/daily.json (von DAILY vorbereitet, Abschnitt 2 der Entscheidungen).
// Auch vergangene Tage (Verlauf, Favoriten) – nie in die Zukunft. Nach dem letzten Tag des Vorrats wiederholt er sich im Kreis.
const { DienstFehler, tagIn } = require('./_lib/rahmen');
const { S } = require('./_lib/schema');

const VORRAT = require('../src/content/daily.json');
const ZONE = 'Europe/Berlin';
const QUELLEN = [{ name: 'DAILY (eigene Tagesinhalte, mit KI vorbereitet)', lizenz: null, url: null }];
const ARTEN = ['raetsel', 'witz', 'wort', 'sprichwort', 'rezept', 'land', 'film', 'gesundheit', 'tech', 'beziehung', 'spartipp'];

// Eintrag für einen Kalendertag: genau dieser Tag, sonst (nach dem Vorrat) Tag im Jahr → Eintrag im Kreis (wie bisher im Browser)
function eintrag(datum, vorrat = VORRAT) {
  const genau = vorrat.tage.find(t => t.datum === datum);
  if (genau) return { tag: genau, wiederholt: false };
  const doy = Math.floor((Date.parse(datum) - Date.parse(datum.slice(0, 4) + '-01-01')) / 864e5);
  return { tag: vorrat.tage[doy % vorrat.tage.length], wiederholt: true };
}

// Vorrat-Eintrag → Vertrag (rein, testbar): nur bekannte Arten, fehlende als null
function umwandeln(tag, datum, { heute, erster, wiederholt }) {
  const inhalt = Object.fromEntries(ARTEN.map(a => [a, tag[a] == null ? null : tag[a]]));
  return { datum, heute, erster, wiederholt, inhalt };
}

const KURZTEXT = () => S.obj({ kurz: S.text(), text: S.text() }, ['kurz', 'text'], true);
const SCHEMA = S.obj({
  datum: S.datum(), heute: S.datum(), erster: S.datum(), wiederholt: { type: 'boolean' },
  inhalt: S.obj({
    raetsel: S.obj({ frage: S.text(), loesung: S.text() }, ['frage', 'loesung'], true),
    witz: S.text(),
    wort: S.obj({ wort: S.text(), bedeutung: S.text(), herkunft: S.text() }, ['wort', 'bedeutung'], true),
    sprichwort: S.text(),
    rezept: S.obj({ name: S.text(), minuten: S.ganz({ minimum: 0 }), vegetarisch: S.ja(), zutaten: S.liste({ type: 'string' }), zubereitung: S.text() }, ['name', 'zutaten', 'zubereitung'], true),
    land: S.obj({ name: S.text(), hauptstadt: S.text(), sprache: S.text(), waehrung: S.text(), gericht: S.text(), fakt: S.text() }, ['name'], true),
    film: S.obj({ titel: S.text(), jahr: S.ganz(), genre: S.text(), text: S.text() }, ['titel'], true),
    gesundheit: KURZTEXT(), tech: S.obj({ kategorie: S.text(), text: S.text() }, ['text'], true), beziehung: KURZTEXT(), spartipp: KURZTEXT()
  })
});

module.exports = {
  id: 'tagesinhalt',
  version: 1,
  programmversion: '1.0.0',
  aenderungen: [{ version: '1.0.0', datum: '2026-10-01', text: 'Erste Fassung: alle Tagesinhalte eines Tags aus der festen Datei, auch vergangene Tage (Verlauf), nie in die Zukunft' }],
  titel: 'Tagesinhalte',
  beschreibung: 'Rätsel, Witz, Wort und Sprichwort des Tages, Rezept, Land, Film, Gesundheits-, Tech-, Beziehungs- und Spartipp – für heute oder einen vergangenen Tag.',
  eingaben: { datum: 'Kalendertag JJJJ-MM-TT (Standard: heute in Deutschland); nicht in der Zukunft, nicht vor dem ersten Tag' },
  laender: 'alle',
  klasse: 'oeffentlich',
  ttl: 86400,
  takt: 86400,   // gültig bis Mitternacht (UTC); die Oberfläche fragt immer mit Datum, jeder Tag hat seine eigene Antwort
  quellen: QUELLEN,
  schema: SCHEMA,
  blatt: {
    zweck: 'Liefert die Tagesinhalte für die Themen-Kacheln (Unterhaltung, Wissen, Alltag) und den Spartipp der Finanzen – mit Verlauf: Pfeile blättern zu vergangenen Tagen, Favoriten verweisen auf einen Tag.',
    herkunft: [
      'Eigene Inhalte von DAILY, mit KI vorbereitet und als feste Datei im Repo (src/content/daily.json, erzeugt mit tools/content_2026_10.py). Keine Nachrichten, keine Inhalte Dritter.',
      'Rezepte, Tipps und Fakten sind allgemeine Anregungen – keine medizinische, finanzielle oder rechtliche Beratung.'
    ],
    verarbeitung: [
      'Datum: Standard heute in Deutschland (Europe/Berlin). Tage in der Zukunft und vor dem ersten Tag des Vorrats werden abgelehnt (eingabe_ungueltig).',
      'Gibt es den Tag im Vorrat, kommt genau dieser Eintrag; nach dem letzten Tag wiederholt sich der Vorrat im Kreis (Tag im Jahr), gekennzeichnet mit wiederholt: true.',
      'Inhalte unverändert aus der Datei; fehlende Arten als null.'
    ],
    ausgabe: {
      datum: 'gezeigter Tag (JJJJ-MM-TT)',
      heute: 'heutiger Tag in Deutschland – weiter vor geht es nicht',
      erster: 'erster Tag des Vorrats – weiter zurück geht es nicht',
      wiederholt: 'true, wenn der Tag nach dem Vorrat liegt und ein Eintrag im Kreis wiederholt wird',
      inhalt: 'Inhalte des Tags je Art (null: fehlt)',
      'inhalt.raetsel': 'Rätsel', 'inhalt.raetsel.frage': 'Frage', 'inhalt.raetsel.loesung': 'Lösung',
      'inhalt.witz': 'Witz des Tages',
      'inhalt.wort': 'Wort des Tages', 'inhalt.wort.wort': 'das Wort', 'inhalt.wort.bedeutung': 'Bedeutung', 'inhalt.wort.herkunft': 'Herkunft (null: unbekannt)',
      'inhalt.sprichwort': 'Sprichwort des Tages',
      'inhalt.rezept': 'Rezept', 'inhalt.rezept.name': 'Name', 'inhalt.rezept.minuten': 'Zubereitungszeit in Minuten', 'inhalt.rezept.vegetarisch': 'vegetarisch',
      'inhalt.rezept.zutaten': 'Zutaten (für 2 Personen)', 'inhalt.rezept.zubereitung': 'Zubereitung',
      'inhalt.land': 'Land des Tages', 'inhalt.land.name': 'Name', 'inhalt.land.hauptstadt': 'Hauptstadt', 'inhalt.land.sprache': 'Sprache', 'inhalt.land.waehrung': 'Währung',
      'inhalt.land.gericht': 'typisches Gericht', 'inhalt.land.fakt': 'Wissenswertes',
      'inhalt.film': 'Filmtipp', 'inhalt.film.titel': 'Titel', 'inhalt.film.jahr': 'Jahr', 'inhalt.film.genre': 'Genre', 'inhalt.film.text': 'Worum es geht',
      'inhalt.gesundheit': 'Gesundheitstipp', 'inhalt.gesundheit.kurz': 'Überschrift', 'inhalt.gesundheit.text': 'Tipp',
      'inhalt.tech': 'Tech-Tipp', 'inhalt.tech.kategorie': 'Bereich (z. B. Tastenkürzel)', 'inhalt.tech.text': 'Tipp',
      'inhalt.beziehung': 'Idee für zwei', 'inhalt.beziehung.kurz': 'Überschrift', 'inhalt.beziehung.text': 'Idee',
      'inhalt.spartipp': 'Spartipp', 'inhalt.spartipp.kurz': 'Überschrift', 'inhalt.spartipp.text': 'Tipp'
    },
    skalierung: {
      klasse: 'B',
      quelle: 'Feste Datei im Repo – keine externe Quelle, keine Grenzen.',
      kosten: 'Datei liegt im Speicher der Funktion; Antwort < 1 ms.',
      cache: 'Für alle gleich je Tag: CDN und Browser halten jede Antwort bis Mitternacht (UTC); vergangene Tage ändern sich nicht.',
      bei10Mio: 'Unkritisch: höchstens ein paar hundert verschiedene Antworten (je Tag eine), fast nur Cache-Treffer.'
    }
  },
  async run(eingabe, ctx = {}) {
    const jetzt = ctx.jetzt || Date.now(), heute = tagIn(jetzt, ZONE), erster = VORRAT.von;
    const datum = eingabe.datum == null || eingabe.datum === '' ? heute : String(eingabe.datum);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || Number.isNaN(Date.parse(datum))) throw new DienstFehler('eingabe_ungueltig', 'Datum als JJJJ-MM-TT angeben');
    if (datum > heute) throw new DienstFehler('eingabe_ungueltig', 'Tagesinhalte gibt es nicht im Voraus');
    if (datum < erster) throw new DienstFehler('eingabe_ungueltig', `Tagesinhalte gibt es ab ${erster}`);
    const { tag, wiederholt } = eintrag(datum);
    return { daten: umwandeln(tag, datum, { heute, erster, wiederholt }) };
  },
  umwandeln, eintrag, ARTEN, VORRAT
};
