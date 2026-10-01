// Dienst „kurse“ (nur privat): Börsenindizes, ETF, Krypto und Gold als reine Kursangaben – keine Anlageempfehlung.
// Quelle: inoffizielle Chart-Schnittstelle von Yahoo Finance. Deren Bedingungen erlauben nur die private Nutzung,
// daher nur im privaten Betrieb (Vercel-Variable DAILY_PRIVATE=1). Siehe docs/recherche/finanzdaten.md.
const { P } = require('./_lib/parameter');
const { getJson } = require('./_lib/http');
const { DienstFehler, iso, runde } = require('./_lib/rahmen');
const { S } = require('./_lib/schema');

const QUELLEN = [{ name: 'Yahoo Finance (nur private Nutzung)', lizenz: null, url: 'https://finance.yahoo.com' }];
// Werte hier anpassen (Symbol wie bei Yahoo)
const WERTE = [
  { id: 'dax', name: 'DAX', symbol: '^GDAXI', einheit: 'Pkt' },
  { id: 'sp500', name: 'S&P 500', symbol: '^GSPC', einheit: 'Pkt' },
  { id: 'world', name: 'MSCI World (ETF)', symbol: 'IWDA.AS', einheit: 'EUR' },
  { id: 'btc', name: 'Bitcoin', symbol: 'BTC-EUR', einheit: 'EUR' },
  { id: 'eth', name: 'Ethereum', symbol: 'ETH-EUR', einheit: 'EUR' },
  { id: 'gold', name: 'Gold (Unze)', symbol: 'GC=F', einheit: 'USD' }
];

// Yahoo-Chartdaten → Kurs (rein, testbar)
function kursAus(j) {
  const m = j && j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
  if (!m || typeof m.regularMarketPrice !== 'number') throw new Error('keine Kursdaten');
  const vor = typeof m.chartPreviousClose === 'number' ? m.chartPreviousClose : m.previousClose;
  return {
    kurs: m.regularMarketPrice,
    aenderungProzent: typeof vor === 'number' && vor ? runde((m.regularMarketPrice - vor) / vor * 100, 2) : null,
    zeit: m.regularMarketTime ? iso(m.regularMarketTime * 1000) : null
  };
}

const SCHEMA = S.obj({
  werte: S.liste(S.obj({ id: S.text(), name: S.text(), einheit: S.text(), kurs: S.zahl(), aenderungProzent: S.zahl(), zeit: S.zeit(), fehler: S.text() }))
});

module.exports = {
  id: 'kurse',
  version: 1,
  programmversion: '1.1.0',
  aenderungen: [
    { version: '1.1.0', datum: '2026-10-02', text: 'Unbekannte Angaben werden abgelehnt (Adresse = Cache-Schlüssel, Entscheidung 02.10.2026).' },
    { version: '1.0.0', datum: '2026-09-28', text: 'Umzug aus api/markets.js in das Format daily/1; nur noch privat' }
  ],
  titel: 'Kurse (privat)',
  beschreibung: 'DAX, S&P 500, MSCI World, Bitcoin, Ethereum und Gold als reine Kursangaben mit Veränderung zum Vortag – nur im privaten Betrieb.',
  eingaben: {},
  parameter: {},   // erlaubte Angaben = Cache-Schlüssel (_lib/parameter.js)
  laender: 'alle',
  klasse: 'privat',
  ttl: 300,
  quellen: QUELLEN,
  schema: SCHEMA,
  blatt: {
    zweck: 'Zeigt im privaten Betrieb in der Kachel „Finanzen“ (Reiter „Märkte“) die wichtigsten Börsen- und Kryptokurse.',
    herkunft: [
      'Inoffizielle Chart-Schnittstelle von Yahoo Finance (keine offizielle API). Die Nutzungsbedingungen erlauben nur die persönliche Nutzung; die Kurse stammen von Börsen und Datenanbietern.',
      'Deshalb nur im privaten Betrieb (DAILY_PRIVATE=1) – öffentlich ist der Dienst gesperrt. Alternativen: docs/recherche/finanzdaten.md.'
    ],
    verarbeitung: [
      'Je Wert ein Abruf der Tagesdaten der letzten 5 Tage; Kurs = letzter Kurs, Veränderung zum Schlusskurs des Vortags in % (2 Stellen).',
      'Fehler je Wert: kurs null und „fehler“ gesetzt; die übrigen Werte kommen trotzdem. Ohne jeden Kurs gibt es einen Fehler.',
      'Keine Speicherung im CDN (privat); die Antwort gilt 5 Minuten.'
    ],
    ausgabe: {
      werte: 'Kurse in fester Reihenfolge',
      'werte[].id': 'Kennung (z. B. dax)',
      'werte[].name': 'Name (z. B. DAX)',
      'werte[].einheit': 'Pkt (Punkte), EUR oder USD',
      'werte[].kurs': 'letzter Kurs (null = nicht verfügbar)',
      'werte[].aenderungProzent': 'Veränderung zum Vortag in %',
      'werte[].zeit': 'Zeitpunkt des Kurses (UTC)',
      'werte[].fehler': 'was nicht geklappt hat (sonst null)'
    },
    skalierung: {
      klasse: 'B',
      quelle: 'Yahoo Finance, inoffiziell, ohne Zusage; nur privat.',
      kosten: 'Je Abruf 6 kleine Anfragen, zusammen typisch 300–800 ms.',
      cache: 'Keiner im CDN (privat); der Browser fragt alle 15 Minuten.',
      bei10Mio: 'Nicht öffentlich – nur Rogers privater Betrieb. Öffentlich bräuchte es eine lizenzierte Quelle (siehe Recherche).'
    }
  },
  async run() {
    const werte = await Promise.all(WERTE.map(async w => {
      const basis = { id: w.id, name: w.name, einheit: w.einheit };
      try {
        const j = await getJson('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(w.symbol) + '?range=5d&interval=1d',
          { timeout: 8000, headers: { 'user-agent': 'Mozilla/5.0 (DAILY privat)' } });
        return { ...basis, ...kursAus(j), fehler: null };
      } catch (e) { return { ...basis, kurs: null, aenderungProzent: null, zeit: null, fehler: String((e && e.message) || e).slice(0, 120) }; }
    }));
    if (!werte.some(w => w.kurs != null)) throw new DienstFehler('quelle_fehler', 'Keine Kurse erreichbar');
    return { daten: { werte } };
  },
  kursAus, WERTE
};
