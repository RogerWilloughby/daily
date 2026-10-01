// Dienst „finanzen“ (öffentlich): Euro-Wechselkurse, Leitzinsen und Inflation – alles von der Europäischen Zentralbank (EZB).
// Für alle Nutzer gleich (keine Eingabe) → ein Abruf je Stunde reicht für alle. Reine Kursangaben, keine Anlageempfehlung.
// Weiterverwendung laut EZB: kostenlos, auch kommerziell, Quelle nennen, Werte nicht verändern.
const { P } = require('./_lib/parameter');
const { getText } = require('./_lib/http');
const { DienstFehler, runde } = require('./_lib/rahmen');
const { S } = require('./_lib/schema');

const QUELLEN = [{ name: 'Europäische Zentralbank (EZB) – Referenzkurse, Leitzinsen, HVPI', lizenz: 'frei, Quelle: EZB', url: 'https://www.ecb.europa.eu/stats/' }];
const KURSE_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml';
const API = 'https://data-api.ecb.europa.eu/service/data/';
// Leitzinsen: Reihen „Tag der Änderung“ (D); falls nicht erreichbar, Tagesreihe (B) ohne Änderungsdatum
const ZINS_URLS = [API + 'FM/D.U2.EUR.4F.KR.DFR+MRR_FR+MLFR.LEV?lastNObservations=2&format=csvdata',
  API + 'FM/B.U2.EUR.4F.KR.DFR+MRR_FR+MLFR.LEV?lastNObservations=1&format=csvdata'];
const INFLATION_URL = API + 'ICP/M.U2+DE.N.000000.4.ANR?lastNObservations=2&format=csvdata';

// Währungen: deutscher Name und Zeichen (unbekannte Codes behalten ihren Code)
const WAEHRUNGEN = {
  USD: ['US-Dollar', '$'], GBP: ['Britisches Pfund', '£'], CHF: ['Schweizer Franken', 'CHF'], PLN: ['Polnischer Złoty', 'zł'],
  CZK: ['Tschechische Krone', 'Kč'], JPY: ['Japanischer Yen', '¥'], CNY: ['Chinesischer Yuan', 'CN¥'], SEK: ['Schwedische Krone', 'skr'],
  NOK: ['Norwegische Krone', 'nkr'], DKK: ['Dänische Krone', 'dkr'], HUF: ['Ungarischer Forint', 'Ft'], TRY: ['Türkische Lira', '₺'],
  RON: ['Rumänischer Leu', 'lei'], BGN: ['Bulgarischer Lew', 'лв'], ISK: ['Isländische Krone', 'ikr'], AUD: ['Australischer Dollar', 'A$'],
  CAD: ['Kanadischer Dollar', 'C$'], NZD: ['Neuseeland-Dollar', 'NZ$'], HKD: ['Hongkong-Dollar', 'HK$'], SGD: ['Singapur-Dollar', 'S$'],
  KRW: ['Südkoreanischer Won', '₩'], INR: ['Indische Rupie', '₹'], IDR: ['Indonesische Rupiah', 'Rp'], MYR: ['Malaysischer Ringgit', 'RM'],
  PHP: ['Philippinischer Peso', '₱'], THB: ['Thailändischer Baht', '฿'], MXN: ['Mexikanischer Peso', 'MX$'], BRL: ['Brasilianischer Real', 'R$'],
  ZAR: ['Südafrikanischer Rand', 'R'], ILS: ['Israelischer Schekel', '₪']
};
const ZINSEN = { DFR: ['einlagen', 'Einlagesatz'], MRR_FR: ['haupt', 'Hauptrefinanzierungssatz'], MLFR: ['spitzen', 'Spitzenrefinanzierungssatz'] };
const GEBIETE = { DE: 'Deutschland', U2: 'Euroraum' };

// EZB-Kursdatei (90 Tage) → { tage: [aufsteigend], kurse: { USD: [..] } } (rein, testbar)
function kurseAus(xml) {
  const tage = [], kurse = {};
  const bloecke = String(xml).split(/<Cube\s+time="/).slice(1);
  if (!bloecke.length) throw new Error('keine Kurse in der EZB-Datei');
  bloecke.reverse().forEach((b, i) => {
    tage.push(b.slice(0, 10));
    for (const m of b.matchAll(/currency="([A-Z]{3})"\s+rate="([\d.]+)"/g)) {
      (kurse[m[1]] = kurse[m[1]] || Array(bloecke.length).fill(null))[i] = +m[2];
    }
  });
  return { tage, kurse };
}

// SDMX-CSV der EZB-Schnittstelle → [{ KEY, TIME_PERIOD, OBS_VALUE, … }] (Anführungszeichen erlaubt; rein, testbar)
function csvAus(text) {
  const zeilen = [];
  let feld = '', zeile = [], inQ = false;
  const s = String(text).replace(/\r/g, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) { if (c === '"' && s[i + 1] === '"') { feld += '"'; i++; } else if (c === '"') inQ = false; else feld += c; }
    else if (c === '"') inQ = true;
    else if (c === ',') { zeile.push(feld); feld = ''; }
    else if (c === '\n') { zeile.push(feld); zeilen.push(zeile); zeile = []; feld = ''; }
    else feld += c;
  }
  if (feld || zeile.length) { zeile.push(feld); zeilen.push(zeile); }
  const [kopf, ...rest] = zeilen.filter(z => z.some(Boolean));
  if (!kopf || !kopf.includes('OBS_VALUE')) throw new Error('unerwartetes Format');
  return rest.map(z => Object.fromEntries(kopf.map((k, i) => [k, z[i]])));
}

// Beobachtungen je Reihe (Schlüssel-Teil) aufsteigend nach Zeit
function reihen(zeilen, teil) {
  const out = {};
  for (const z of zeilen) {
    const k = String(z.KEY || '').split('.')[teil], v = parseFloat(z.OBS_VALUE);
    if (!k || !Number.isFinite(v) || !z.TIME_PERIOD) continue;
    (out[k] = out[k] || []).push({ zeit: z.TIME_PERIOD, wert: v });
  }
  for (const k in out) out[k].sort((a, b) => a.zeit.localeCompare(b.zeit));
  return out;
}

// Leitzinsen aus der CSV (mitDatum: Reihe „Tag der Änderung“ → seit/vorher bekannt)
function zinsenAus(text, mitDatum = true) {
  const r = reihen(csvAus(text), 6);
  const out = Object.entries(ZINSEN).filter(([k]) => r[k] && r[k].length).map(([k, [art, name]]) => {
    const l = r[k], jetzt = l[l.length - 1], vor = l.length > 1 ? l[l.length - 2] : null;
    return { art, name, satzProzent: runde(jetzt.wert, 2), seit: mitDatum ? jetzt.zeit.slice(0, 10) : null, vorherProzent: mitDatum && vor ? runde(vor.wert, 2) : null };
  });
  if (!out.length) throw new Error('keine Leitzinsen');
  return out;
}

// Inflation (HVPI, Veränderung zum Vorjahresmonat) aus der CSV
function inflationAus(text) {
  const r = reihen(csvAus(text), 2);
  const out = ['DE', 'U2'].filter(g => r[g] && r[g].length).map(g => {
    const l = r[g], jetzt = l[l.length - 1], vor = l.length > 1 ? l[l.length - 2] : null;
    return { gebiet: g, name: GEBIETE[g], monat: jetzt.zeit.slice(0, 7), rateProzent: runde(jetzt.wert, 1), vormonatProzent: vor ? runde(vor.wert, 1) : null };
  });
  if (!out.length) throw new Error('keine Inflationsdaten');
  return out;
}

// Kurse → Ausgabe je Währung (rein, testbar)
function waehrungenAus({ tage, kurse }) {
  return Object.keys(kurse).map(code => {
    const v = kurse[code], da = v.map((x, i) => [x, i]).filter(([x]) => x != null);
    if (!da.length) return null;
    const [kurs] = da[da.length - 1], vortag = da.length > 1 ? da[da.length - 2][0] : null, werte = da.map(([x]) => x);
    return {
      code, name: (WAEHRUNGEN[code] || [code])[0], zeichen: (WAEHRUNGEN[code] || [null, code])[1],
      kurs, vortag, aenderungProzent: vortag ? runde((kurs - vortag) / vortag * 100, 2) : null,
      tief90: Math.min(...werte), hoch90: Math.max(...werte), verlauf: v
    };
  }).filter(Boolean).sort((a, b) => (WAEHRUNGEN[a.code] ? 0 : 1) - (WAEHRUNGEN[b.code] ? 0 : 1) || Object.keys(WAEHRUNGEN).indexOf(a.code) - Object.keys(WAEHRUNGEN).indexOf(b.code));
}

const SCHEMA = S.obj({
  stand: S.datum(),
  basis: S.text(),
  tage: S.liste(S.datum()),
  waehrungen: S.liste(S.obj({ code: S.text(), name: S.text(), zeichen: S.text(), kurs: S.zahl(), vortag: S.zahl(), aenderungProzent: S.zahl(),
    tief90: S.zahl(), hoch90: S.zahl(), verlauf: S.liste(S.zahl()) })),
  leitzinsen: { type: ['array', 'null'], items: S.obj({ art: { type: 'string', enum: ['einlagen', 'haupt', 'spitzen'] }, name: S.text(), satzProzent: S.zahl(),
    seit: { type: ['string', 'null'], format: 'datum' }, vorherProzent: S.zahl() }) },
  inflation: { type: ['array', 'null'], items: S.obj({ gebiet: { type: 'string', enum: ['DE', 'U2'] }, name: S.text(), monat: S.text(), rateProzent: S.zahl(), vormonatProzent: S.zahl() }) }
});

module.exports = {
  id: 'finanzen',
  version: 1,
  programmversion: '1.1.0',
  aenderungen: [
    { version: '1.1.0', datum: '2026-10-02', text: 'Unbekannte Angaben werden abgelehnt (Adresse = Cache-Schlüssel, Entscheidung 02.10.2026).' },
    { version: '1.0.0', datum: '2026-09-28', text: 'Erste Fassung: Euro-Referenzkurse (90 Tage), Leitzinsen und Inflation (HVPI) von der EZB' }
  ],
  titel: 'Finanzen',
  beschreibung: 'Euro-Wechselkurse der letzten 90 Tage, die Leitzinsen der EZB und die Inflation in Deutschland und im Euroraum – reine Angaben der Europäischen Zentralbank, keine Anlageempfehlung.',
  eingaben: {},
  parameter: {},   // erlaubte Angaben = Cache-Schlüssel (_lib/parameter.js)
  laender: 'alle',
  klasse: 'oeffentlich',
  ttl: 3600,
  takt: 3600,
  quellen: QUELLEN,
  schema: SCHEMA,
  blatt: {
    zweck: 'Zeigt in der Kachel „Finanzen“, was der Euro wert ist (z. B. 1 € = 1,14 $), wie sich der Kurs entwickelt hat, wie hoch die Leitzinsen sind und wie stark die Preise steigen.',
    herkunft: [
      'Euro-Referenzkurse der EZB (rund 30 Währungen, werktags gegen 16 Uhr MEZ), Datei der letzten 90 Tage.',
      'Leitzinsen (Einlagesatz, Hauptrefinanzierungssatz, Spitzenrefinanzierungssatz) aus dem EZB-Datenportal.',
      'Inflation: Harmonisierter Verbraucherpreisindex (HVPI), Veränderung zum Vorjahresmonat, Deutschland und Euroraum, aus dem EZB-Datenportal.',
      'Weiterverwendung laut EZB kostenlos, auch kommerziell, mit Quellenangabe und ohne Veränderung der Werte. Die Referenzkurse dienen nur zur Information, nicht für Geschäfte.'
    ],
    verarbeitung: [
      'Keine Eingabe: die Antwort ist für alle Nutzer gleich und wird stündlich erneuert.',
      'Kurse: je Währung letzter Kurs, Vortag, Veränderung in Prozent (auf 2 Stellen gerundet), 90-Tage-Tief und -Hoch und der Verlauf passend zur Liste „tage“ (null = an diesem Tag kein Kurs). Die Kurse selbst bleiben unverändert.',
      'Leitzinsen: aktueller Satz mit Datum der letzten Änderung und vorherigem Satz; ist die Reihe der Änderungen nicht erreichbar, nur der aktuelle Satz.',
      'Ist ein Teil (Leitzinsen oder Inflation) nicht erreichbar, ist er null und ein Hinweis gesetzt; die Kurse kommen trotzdem. Ohne Kurse gibt es einen Fehler.'
    ],
    ausgabe: {
      stand: 'Tag der neuesten Referenzkurse',
      basis: 'Basiswährung (immer EUR: 1 € = kurs)',
      tage: 'Handelstage der letzten 90 Tage, aufsteigend',
      waehrungen: 'Währungen (bekannte zuerst)',
      'waehrungen[].code': 'ISO-Code (z. B. USD)',
      'waehrungen[].name': 'deutscher Name',
      'waehrungen[].zeichen': 'Zeichen (z. B. $)',
      'waehrungen[].kurs': 'neuester Kurs: 1 € = kurs',
      'waehrungen[].vortag': 'Kurs des Handelstags davor',
      'waehrungen[].aenderungProzent': 'Veränderung zum Vortag in % (positiv = Euro stärker)',
      'waehrungen[].tief90': 'tiefster Kurs der 90 Tage',
      'waehrungen[].hoch90': 'höchster Kurs der 90 Tage',
      'waehrungen[].verlauf': 'Kurse passend zu „tage“ (null = kein Kurs)',
      leitzinsen: 'Leitzinsen der EZB (null = nicht erreichbar)',
      'leitzinsen[].art': 'einlagen, haupt oder spitzen',
      'leitzinsen[].name': 'Name des Satzes',
      'leitzinsen[].satzProzent': 'Satz in % pro Jahr',
      'leitzinsen[].seit': 'gilt seit (null = unbekannt)',
      'leitzinsen[].vorherProzent': 'Satz vor der letzten Änderung',
      inflation: 'Inflationsrate (null = nicht erreichbar)',
      'inflation[].gebiet': 'DE (Deutschland) oder U2 (Euroraum)',
      'inflation[].name': 'Name des Gebiets',
      'inflation[].monat': 'Monat (JJJJ-MM)',
      'inflation[].rateProzent': 'Veränderung der Verbraucherpreise zum Vorjahresmonat in %',
      'inflation[].vormonatProzent': 'Rate des Monats davor'
    },
    skalierung: {
      klasse: 'B',
      quelle: 'EZB: frei, ohne Schlüssel, keine veröffentlichte Grenze.',
      kosten: 'Je Stunde 3 Abrufe (Kursdatei ca. 60 KB, zwei kleine CSV) und Auswertung < 5 ms.',
      cache: 'Gültig bis zur nächsten vollen Stunde (Takt 1 Stunde), für alle Nutzer dieselbe Antwort → fast nur Cache-Treffer.',
      bei10Mio: 'Unproblematisch: höchstens 72 Abrufe bei der EZB am Tag, unabhängig von der Nutzerzahl.'
    }
  },
  async run() {
    const hinweise = [];
    let roh;
    try { roh = kurseAus(await getText(KURSE_URL, { timeout: 8000 })); }
    catch (e) { throw new DienstFehler('quelle_fehler', 'EZB-Referenzkurse nicht erreichbar'); }
    let leitzinsen = null, inflation = null;
    await Promise.all([
      (async () => {
        for (const [i, url] of ZINS_URLS.entries()) {
          try { leitzinsen = zinsenAus(await getText(url, { timeout: 8000, accept: 'text/csv' }), i === 0); return; } catch (e) { /* nächste Reihe */ }
        }
        hinweise.push('leitzinsen_nicht_erreichbar');
      })(),
      (async () => {
        try { inflation = inflationAus(await getText(INFLATION_URL, { timeout: 8000, accept: 'text/csv' })); }
        catch (e) { hinweise.push('inflation_nicht_erreichbar'); }
      })()
    ]);
    return { hinweise, daten: { stand: roh.tage[roh.tage.length - 1], basis: 'EUR', tage: roh.tage, waehrungen: waehrungenAus(roh), leitzinsen, inflation } };
  },
  kurseAus, csvAus, zinsenAus, inflationAus, waehrungenAus, WAEHRUNGEN
};
