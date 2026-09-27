// Dienst „namenstage“: wer heute und in den nächsten Tagen Namenstag hat – und wann ein bestimmter Name Namenstag hat.
// Daten: eigener Bestand services/daten/namenstage.json, monatlich per GitHub Action aus Wikidata (CC0) erzeugt
// (Gedenktage der Heiligen und ausdrückliche Namenstage für Deutschland/Österreich, tools/namenstage-daten.js).
const { DienstFehler, tagIn, text } = require('./_lib/rahmen');
const { S } = require('./_lib/schema');

const QUELLEN = [
  { name: 'Wikidata (Gedenktage der Heiligen, Namenstage)', lizenz: 'CC0 1.0 (gemeinfrei)', url: 'https://www.wikidata.org' }
];
const TAGE_VORAUS = 7;

let BESTAND = null;
const bestand = () => BESTAND || (BESTAND = require('./daten/namenstage.json'));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').trim();
const mmtt = datum => datum.slice(5);
const plus = (datum, n) => new Date(Date.parse(datum + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

// rein, testbar: aus dem Bestand die Namen von heute, der nächsten Tage und die Tage eines gesuchten Namens
function auswerten(daten, heute, name = null) {
  const tage = (daten && daten.tage) || {};
  const namen = datum => tage[mmtt(datum)] || [];
  const woche = Array.from({ length: TAGE_VORAUS }, (_, i) => plus(heute, i)).map(d => ({ datum: d, namen: namen(d) }));
  let gesucht = null;
  if (name) {
    const n = norm(name);
    const treffer = Object.entries(tage).filter(([, l]) => l.some(x => norm(x) === n)).map(([t]) => t).sort();
    // nächster Termin ab heute (auch im nächsten Jahr)
    const jahr = +heute.slice(0, 4), heuteT = mmtt(heute);
    const naechst = treffer.length ? (treffer.find(t => t >= heuteT) ? `${jahr}-${treffer.find(t => t >= heuteT)}` : `${jahr + 1}-${treffer[0]}`) : null;
    const schreibweise = treffer.length ? tage[treffer[0]].find(x => norm(x) === n) : text(name, 40);   // „josef“ → „Josef“
    gesucht = { name: schreibweise, tage: treffer, naechster: naechst };
  }
  return { heute: { datum: heute, namen: namen(heute) }, woche, gesucht, stand: (daten && daten.stand) || null };
}

const TAG = S.obj({ datum: S.datum(), namen: S.liste({ type: 'string' }) });
const SCHEMA = S.obj({
  heute: TAG,
  woche: S.liste(TAG),
  gesucht: S.obj({ name: S.text(), tage: S.liste({ type: 'string' }), naechster: { type: ['string', 'null'], format: 'datum' } }, ['name', 'tage', 'naechster'], true),
  stand: { type: ['string', 'null'], format: 'datum' }
});

module.exports = {
  id: 'namenstage',
  version: 1,
  programmversion: '1.0.1',
  aenderungen: [
    { version: '1.0.1', datum: '2026-09-27', text: 'Wikidata-Abruf in kleinen Schritten (die große Abfrage lief in den 60-s-Abbruch); erzeugt über die gemeinsame Action „Daten erneuern“' },
    { version: '1.0.0', datum: '2026-09-27', text: 'Erste Fassung: Namenstage heute und die nächsten 7 Tage, Suche nach einem Namen; Bestand aus Wikidata (CC0), monatlich erneuert' }
  ],
  titel: 'Namenstage',
  beschreibung: 'Wer heute und in den nächsten Tagen Namenstag hat – und wann ein bestimmter Vorname Namenstag hat.',
  eingaben: { name: 'Vorname (optional, z. B. Josef) – liefert dessen Namenstage' },
  laender: 'alle',
  klasse: 'oeffentlich',
  ttl: 86400,
  takt: 86400,
  quellen: QUELLEN,
  schema: SCHEMA,
  blatt: {
    zweck: 'Kleiner Anlass zum Gratulieren: zeigt im Kalender, wer heute Namenstag hat, und beantwortet „Wann hat Josef Namenstag?“.',
    herkunft: [
      'Wikidata (freie Wissensdatenbank, CC0): Gedenktage der Heiligen (Eigenschaft „Gedenktag“) mit ihrem Vornamen und ausdrücklich eingetragene Namenstage für Deutschland und Österreich.',
      'Eigener Bestand services/daten/namenstage.json, erzeugt monatlich per GitHub Action „Daten erneuern“ (Erzeuger tools/daten/namenstage.js → tools/namenstage-daten.js).'
    ],
    verarbeitung: [
      'Je Tag höchstens 6 Vornamen; Reihenfolge: ausdrücklicher Namenstag vor Heiligen-Gedenktag, dann Bekanntheit des Namens (Zahl der Wikipedia-Sprachversionen).',
      'Nur echte Vornamen (ein Wort, auch mit Bindestrich); deutsche Schreibweise aus Wikidata.',
      'Namenstage folgen der kirchlichen Tradition und unterscheiden sich je Kalender (katholisch, evangelisch, regional) – DAILY zeigt eine Auswahl, keinen amtlichen Kalender.',
      'Eine Erzeugung mit weniger als 330 Tagen oder 500 Namen wird verworfen; dann bleibt der alte Stand.',
      '„Heute“ in der Zeitzone Europe/Berlin.'
    ],
    ausgabe: {
      heute: 'Namenstage heute',
      'heute.datum': 'Tag',
      'heute.namen': 'Vornamen',
      woche: 'heute und die nächsten 6 Tage',
      'woche[].datum': 'Tag',
      'woche[].namen': 'Vornamen',
      gesucht: 'nur mit Eingabe „name“ (sonst null)',
      'gesucht.name': 'gesuchter Name',
      'gesucht.tage': 'Namenstage als MM-TT',
      'gesucht.naechster': 'nächster Namenstag ab heute (oder null)',
      stand: 'Tag der letzten Erneuerung aus Wikidata (null = noch nicht erzeugt)'
    },
    skalierung: {
      klasse: 'A',
      quelle: 'keine zur Laufzeit – eigener Bestand (≈ 20 KB), Wikidata nur einmal im Monat per Action.',
      kosten: 'Nachschlagen < 1 ms.',
      cache: 'Takt 1 Tag; ohne Namen für alle Nutzer dieselbe Antwort.',
      bei10Mio: 'Unproblematisch: eine Antwort je Tag für alle (CDN), Suchen nach Namen ebenfalls je Tag zwischengespeichert.'
    }
  },
  async run(eingabe, { jetzt = Date.now() } = {}) {
    const name = text(eingabe.name, 40);
    if (eingabe.name != null && !name) throw new DienstFehler('eingabe_ungueltig', 'name ist leer');
    const daten = bestand();
    const hinweise = Object.keys(daten.tage || {}).length ? [] : ['daten_fehlen'];
    return { hinweise, daten: auswerten(daten, tagIn(jetzt, 'Europe/Berlin'), name) };
  },
  auswerten, norm
};
