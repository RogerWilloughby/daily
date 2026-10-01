// Dienst „andiesemtag“ (öffentlich, ortlos): „An diesem Tag“ aus der deutschen Wikipedia (Wikimedia-Feed, CC BY-SA 4.0) –
// ausgewählte Ereignisse eines Kalendertags, neueste zuerst, mit Link zum Artikel. Auch vergangene Tage (Verlauf der Kachel „Wissen“).
// Ersetzt seit App 0.35.0 die Einzelfunktion api/onthisday.js (die nur „heute“ kannte).
const { getJson } = require('./_lib/http');
const { DienstFehler, tagIn } = require('./_lib/rahmen');
const { S } = require('./_lib/schema');

const ZONE = 'Europe/Berlin', MAX = 8, FRUEHESTENS = '2000-01-01';
const QUELLEN = [{ name: 'Wikipedia – „An diesem Tag“ (Wikimedia-Feed)', lizenz: 'CC BY-SA 4.0', url: 'https://de.wikipedia.org' }];

// Wikimedia-Ereignisse → [{ jahr, text, link }], neueste zuerst (rein, testbar)
function umwandeln(liste) {
  return (liste || []).filter(e => e && e.text && Number.isInteger(e.year)).map(e => {
    const seite = (e.pages || [])[0];
    const link = seite && seite.content_urls && seite.content_urls.desktop ? seite.content_urls.desktop.page : null;
    return { jahr: e.year, text: String(e.text).replace(/\s+/g, ' ').trim(), link: link && /^https:\/\//.test(link) ? link : null };
  }).sort((a, b) => b.jahr - a.jahr);
}

// zwei gleichwertige Adressen desselben Wikimedia-Dienstes; die zweite dient als Ausweich
async function feed(art, mm, dd) {
  try { return await getJson(`https://api.wikimedia.org/feed/v1/wikipedia/de/onthisday/${art}/${mm}/${dd}`); }
  catch (e) { return getJson(`https://de.wikipedia.org/api/rest_v1/feed/onthisday/${art}/${mm}/${dd}`); }
}

const SCHEMA = S.obj({
  datum: S.datum(), tag: { type: 'string', pattern: '^\\d{2}-\\d{2}$' },
  ereignisse: S.liste(S.obj({ jahr: { type: 'integer' }, text: { type: 'string' }, link: S.text() }))
});

module.exports = {
  id: 'andiesemtag',
  version: 1,
  programmversion: '1.0.0',
  aenderungen: [{ version: '1.0.0', datum: '2026-10-01', text: 'Erste Fassung: ersetzt api/onthisday.js, jetzt mit Datum (Verlauf), nie in die Zukunft' }],
  titel: 'An diesem Tag',
  beschreibung: 'Ausgewählte geschichtliche Ereignisse eines Kalendertags aus der deutschen Wikipedia, neueste zuerst, mit Link zum Artikel.',
  eingaben: { datum: `Kalendertag JJJJ-MM-TT (Standard: heute in Deutschland); nicht in der Zukunft, nicht vor ${FRUEHESTENS}` },
  laender: 'alle',
  klasse: 'oeffentlich',
  ttl: 86400,
  takt: 86400,   // gültig bis Mitternacht (UTC); die Ereignisse eines Kalendertags ändern sich selten
  quellen: QUELLEN,
  schema: SCHEMA,
  blatt: {
    zweck: 'Liefert den Reiter „An diesem Tag“ der Kachel „Wissen“ – für heute und, beim Zurückblättern, für vergangene Tage.',
    herkunft: [
      'Wikimedia-Feed „onthisday“ der deutschen Wikipedia (api.wikimedia.org, Ausweich: de.wikipedia.org/api/rest_v1). Frei, ohne Schlüssel.',
      'Texte stehen unter CC BY-SA 4.0: Die Kachel nennt die Quelle und verlinkt jede Zeile auf den Wikipedia-Artikel.'
    ],
    verarbeitung: [
      'Datum: Standard heute in Deutschland (Europe/Berlin). Tage in der Zukunft und vor 2000 werden abgelehnt (eingabe_ungueltig).',
      'Abgefragt wird nur Monat und Tag: zuerst die von Wikipedia ausgewählten Ereignisse („selected“); sind es weniger als 3, kommen weitere Ereignisse („events“) dazu.',
      `Neueste zuerst, höchstens ${MAX}. Leerzeichen bereinigt, Link nur bei https. Ist Wikipedia nicht erreichbar: quelle_fehler.`
    ],
    ausgabe: {
      datum: 'gezeigter Tag (JJJJ-MM-TT) – daraus rechnet die Oberfläche „vor … Jahren“',
      tag: 'Monat und Tag (MM-TT), für den Wikipedia gefragt wurde',
      ereignisse: 'Ereignisse, neueste zuerst',
      'ereignisse[].jahr': 'Jahr des Ereignisses (negativ: vor Christus)',
      'ereignisse[].text': 'kurze Beschreibung aus Wikipedia',
      'ereignisse[].link': 'Wikipedia-Artikel zum Ereignis (null: keiner)'
    },
    skalierung: {
      klasse: 'B',
      quelle: 'Wikimedia-Feed: frei, ohne Schlüssel; Wikimedia bittet um eine eindeutige Kennung (User-Agent mit Kontakt) und maßvolle Abrufe.',
      kosten: 'Je Tag und Datum ein bis zwei Abrufe bei Wikimedia, Antwort klein (< 5 KB).',
      cache: 'Für alle gleich je Datum: CDN und Instanz halten jede Antwort bis Mitternacht (UTC).',
      bei10Mio: 'Unkritisch: an einem Tag fast nur das heutige Datum (dazu wenige vergangene) – also eine Handvoll Abrufe bei Wikimedia, der Rest sind Cache-Treffer.'
    }
  },
  async run(eingabe, ctx = {}) {
    const heute = tagIn(ctx.jetzt || Date.now(), ZONE);
    const datum = eingabe.datum == null || eingabe.datum === '' ? heute : String(eingabe.datum);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || Number.isNaN(Date.parse(datum))) throw new DienstFehler('eingabe_ungueltig', 'Datum als JJJJ-MM-TT angeben');
    if (datum > heute) throw new DienstFehler('eingabe_ungueltig', '„An diesem Tag“ gibt es nicht im Voraus');
    if (datum < FRUEHESTENS) throw new DienstFehler('eingabe_ungueltig', `Daten gibt es ab ${FRUEHESTENS}`);
    const [, mm, dd] = datum.split('-');
    let ereignisse;
    try {
      ereignisse = umwandeln((await feed('selected', mm, dd)).selected);
      if (ereignisse.length < 3) {
        const alle = await feed('events', mm, dd).catch(() => null);
        if (alle) ereignisse = ereignisse.concat(umwandeln(alle.events).filter(e => !ereignisse.some(x => x.jahr === e.jahr && x.text === e.text))).sort((a, b) => b.jahr - a.jahr);
      }
    } catch (e) { throw new DienstFehler('quelle_fehler', 'Wikipedia nicht erreichbar: ' + e.message); }
    return { daten: { datum, tag: `${mm}-${dd}`, ereignisse: ereignisse.slice(0, MAX) } };
  },
  umwandeln
};
