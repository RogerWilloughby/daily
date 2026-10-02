// Dienst „schlagzeilen“ (nur privat): Originalüberschriften großer Nachrichtenquellen mit Link, neueste zuerst.
// Keine eigene Auswahl, Gewichtung oder Zusammenfassung (entscheidungen.md, Punkt 7). Öffentlich gesperrt (Strategie: keine Nachrichten).
// Ersetzt seit App 0.44.0 die Einzelfunktion api/headlines.js (Review M4 Schritt 2).
const { getText } = require('./_lib/http');
const { DienstFehler, iso } = require('./_lib/rahmen');
const { S } = require('./_lib/schema');

// Quellen hier anpassen (RSS oder Atom)
const FEEDS = [
  { id: 'tagesschau', name: 'Tagesschau', url: 'https://www.tagesschau.de/index~rss2.xml', seite: 'https://www.tagesschau.de' },
  { id: 'mdr', name: 'MDR Sachsen', url: 'https://www.mdr.de/nachrichten/sachsen/index-rss.xml', seite: 'https://www.mdr.de/nachrichten/sachsen' },
  { id: 'heise', name: 'heise', url: 'https://www.heise.de/rss/heise-atom.xml', seite: 'https://www.heise.de' }
];
const JE_QUELLE = 15, GESAMT = 30;

// Text aus XML: CDATA, Tags und Zeichen-Entitäten auflösen
const entschluesseln = s => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, '')
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();
const feld = (block, name) => {
  const m = block.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i'));
  return m ? entschluesseln(m[1]) : '';
};
const zeitVon = s => { const t = Date.parse(s || ''); return Number.isFinite(t) ? iso(t) : null; };

// RSS/Atom → [{ quelle, titel, link, zeit }] (rein, testbar); nur Einträge mit Titel und http(s)-Link
function lesen(xml, quelle) {
  const out = [], re = /<(item|entry)[\s>][\s\S]*?<\/\1>/gi;
  let m;
  while ((m = re.exec(String(xml || ''))) && out.length < JE_QUELLE) {
    const b = m[0];
    let link = feld(b, 'link');
    if (!/^https?:\/\//.test(link)) {
      const l = b.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i) || b.match(/<link[^>]*href="([^"]+)"/i);
      link = l ? l[1].replace(/&amp;/g, '&') : '';
    }
    const titel = feld(b, 'title');
    if (titel && /^https?:\/\//.test(link))
      out.push({ quelle, titel, link, zeit: zeitVon(feld(b, 'pubDate') || feld(b, 'updated') || feld(b, 'published') || feld(b, 'dc:date')) });
  }
  return out;
}

// Ergebnisse je Quelle → Vertrag: Quellen mit Status, Meldungen gemischt, neueste zuerst (ohne Zeit ans Ende)
function umwandeln(ergebnisse) {
  const meldungen = ergebnisse.flatMap(e => e.meldungen)
    .sort((a, b) => (b.zeit || '').localeCompare(a.zeit || '')).slice(0, GESAMT);
  return {
    quellen: ergebnisse.map(e => ({ id: e.id, name: e.name, seite: e.seite, erreichbar: e.erreichbar, anzahl: e.meldungen.length, fehler: e.fehler })),
    meldungen
  };
}

const SCHEMA = S.obj({
  quellen: S.liste(S.obj({ id: S.text(), name: S.text(), seite: S.text(), erreichbar: S.ja(), anzahl: S.ganz({ minimum: 0 }), fehler: S.text() })),
  meldungen: S.liste(S.obj({ quelle: S.text(), titel: S.text(), link: S.text({ pattern: '^https?://' }), zeit: S.zeit() }))
});

module.exports = {
  id: 'schlagzeilen',
  version: 1,
  programmversion: '1.0.0',
  aenderungen: [{ version: '1.0.0', datum: '2026-10-02', text: 'Umzug aus api/headlines.js in das Format daily/1; je Quelle erreichbar ja/nein; nur privat mit Kennwort' }],
  titel: 'Schlagzeilen (privat)',
  beschreibung: 'Originalüberschriften von Tagesschau, MDR Sachsen und heise mit Link, neueste zuerst – nur im privaten Betrieb.',
  eingaben: {},
  parameter: {},   // erlaubte Angaben = Cache-Schlüssel (_lib/parameter.js)
  laender: 'alle',
  klasse: 'privat',
  ttl: 600,
  quellen: FEEDS.map(f => ({ name: `${f.name} (RSS/Atom, Originalüberschriften)`, lizenz: null, url: f.seite })),
  schema: SCHEMA,
  blatt: {
    zweck: 'Zeigt im privaten Betrieb in der Kachel „Schlagzeilen“ die neuesten Überschriften – gemischt und je Quelle; ein Klick öffnet den Artikel beim Anbieter.',
    herkunft: [
      'Öffentliche RSS- bzw. Atom-Feeds von Tagesschau, MDR Sachsen und heise – nur Überschrift, Link und Zeit.',
      'Nur im privaten Betrieb (DAILY_PRIVATE=1) und mit Kennwort: die öffentliche Seite zeigt keine Nachrichten (Strategie 26.09.2026).'
    ],
    verarbeitung: [
      'Keine Eingaben – eine Antwort für alle (Rogers privater Betrieb).',
      'Alle Quellen parallel (je 8 s Zeitlimit); je Quelle höchstens 15 Einträge mit Titel und http(s)-Link, Text ohne HTML.',
      'Gemischt nach Zeit, neueste zuerst, höchstens 30; keine eigene Auswahl, Gewichtung oder Zusammenfassung.',
      'Fällt eine Quelle aus, kommen die übrigen mit „erreichbar: false“ für diese; ohne jede erreichbare Quelle: quelle_fehler.'
    ],
    ausgabe: {
      quellen: 'die Quellen in fester Reihenfolge', 'quellen[].id': 'Kennung (tagesschau, mdr, heise)', 'quellen[].name': 'Name',
      'quellen[].seite': 'Startseite der Quelle', 'quellen[].erreichbar': 'false = Feed gerade nicht erreichbar', 'quellen[].anzahl': 'gelesene Einträge',
      'quellen[].fehler': 'was nicht geklappt hat (sonst null)',
      meldungen: 'Überschriften aller Quellen, neueste zuerst (höchstens 30)', 'meldungen[].quelle': 'Kennung der Quelle',
      'meldungen[].titel': 'Originalüberschrift', 'meldungen[].link': 'Artikel beim Anbieter', 'meldungen[].zeit': 'Veröffentlichung (UTC), null = unbekannt'
    },
    skalierung: {
      klasse: 'B',
      quelle: 'Öffentliche Feeds der Anbieter, ohne Schlüssel und ohne Zusage.',
      kosten: 'Je Abruf 3 Feeds parallel (zusammen typisch 200–800 ms), Lesen < 5 ms.',
      cache: 'Keiner im CDN (privat); die Antwort gilt 10 Minuten, der Browser fragt alle 15 Minuten.',
      bei10Mio: 'Nicht öffentlich – nur Rogers privater Betrieb. Öffentlich wären Nachrichten eine neue Strategie-Entscheidung (und bräuchten Nutzungsrechte der Anbieter).'
    }
  },
  async run() {
    const ergebnisse = await Promise.all(FEEDS.map(async f => {
      const basis = { id: f.id, name: f.name, seite: f.seite };
      try {
        const xml = await getText(f.url, { timeout: 8000, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' });
        return { ...basis, erreichbar: true, fehler: null, meldungen: lesen(xml, f.id) };
      } catch (e) { return { ...basis, erreichbar: false, fehler: String((e && e.message) || e).slice(0, 120), meldungen: [] }; }
    }));
    if (!ergebnisse.some(e => e.erreichbar)) throw new DienstFehler('quelle_fehler', 'Keine Nachrichtenquelle erreichbar');
    return { daten: umwandeln(ergebnisse) };
  },
  lesen, umwandeln, FEEDS
};
