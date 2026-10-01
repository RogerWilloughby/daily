// Dienst „tanken“ (öffentlich): Spritpreise (Super E5, Super E10, Diesel) der Tankstellen im Umkreis eines Orts.
// Quelle: Tankerkönig (Daten der Markttransparenzstelle für Kraftstoffe, MTS-K). Ein Abruf liefert alle drei Sorten –
// so teilen sich alle Nutzer einer 1-km-Zelle eine Antwort, egal welche Sorte sie gewählt haben.
// Braucht einen kostenlosen Schlüssel als Vercel-Variable TANKERKOENIG_API_KEY (https://onboarding.tankerkoenig.de).
const { P } = require('./_lib/parameter');
const { getJson } = require('./_lib/http');
const { DienstFehler, runde, text } = require('./_lib/rahmen');
const { ortAus, inDeutschland } = require('./_lib/ort');
const { S } = require('./_lib/schema');

const QUELLEN = [{ name: 'Tankerkönig (Daten der Markttransparenzstelle für Kraftstoffe)', lizenz: 'CC BY 4.0', url: 'https://creativecommons.tankerkoenig.de' }];
const SORTEN = ['e5', 'e10', 'diesel'];
const UMKREISE = [2, 5, 10];
const MAX_STATIONEN = 25;   // die nächsten 25 reichen für Kachel und Liste, hält die Antwort klein

const preis = v => (typeof v === 'number' && v > 0 ? runde(v, 3) : null);

// Antwort der Quelle (list.php, type=all) → daten (rein, testbar)
function umwandeln(q, umkreisKm) {
  if (!q || q.ok === false) throw new Error((q && q.message) || 'Antwort nicht ok');
  const alle = (q.stations || []).map(s => ({
    id: String(s.id || ''), marke: text(s.brand) || null, name: text(s.name) || 'Tankstelle',
    strasse: [s.street, s.houseNumber].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || null,
    plz: s.postCode != null ? String(s.postCode).padStart(5, '0') : null, ort: text(s.place) || null,
    lat: typeof s.lat === 'number' ? runde(s.lat, 5) : null, lon: typeof s.lng === 'number' ? runde(s.lng, 5) : null,
    entfernungKm: typeof s.dist === 'number' ? runde(s.dist, 1) : null, offen: s.isOpen === true,
    preise: { e5: preis(s.e5), e10: preis(s.e10), diesel: preis(s.diesel) }
  })).filter(s => s.id);
  alle.sort((a, b) => (a.entfernungKm ?? 99) - (b.entfernungKm ?? 99));
  const offen = alle.filter(s => s.offen);
  // Günstigste und Durchschnitt je Sorte: nur geöffnete Tankstellen mit Preis; bei Gleichstand die nähere
  const guenstigste = {}, durchschnitt = {};
  for (const sorte of SORTEN) {
    const mit = offen.filter(s => s.preise[sorte] != null);
    const best = mit.slice().sort((a, b) => a.preise[sorte] - b.preise[sorte] || (a.entfernungKm ?? 99) - (b.entfernungKm ?? 99))[0];
    guenstigste[sorte] = best ? { id: best.id, preis: best.preise[sorte], entfernungKm: best.entfernungKm } : null;
    durchschnitt[sorte] = mit.length ? runde(mit.reduce((x, s) => x + s.preise[sorte], 0) / mit.length, 3) : null;
  }
  return { umkreisKm, anzahl: alle.length, anzahlOffen: offen.length, guenstigste, durchschnitt, stationen: alle.slice(0, MAX_STATIONEN) };
}

const PREISE = S.obj({ e5: S.zahl({ minimum: 0 }), e10: S.zahl({ minimum: 0 }), diesel: S.zahl({ minimum: 0 }) });
const BEST = S.obj({ id: { type: 'string' }, preis: S.zahl(), entfernungKm: S.zahl() }, ['id', 'preis', 'entfernungKm'], true);
const SCHEMA = S.obj({
  umkreisKm: { type: 'integer', enum: UMKREISE },
  anzahl: S.ganz({ minimum: 0 }), anzahlOffen: S.ganz({ minimum: 0 }),
  guenstigste: S.obj({ e5: BEST, e10: BEST, diesel: BEST }),
  durchschnitt: PREISE,
  stationen: S.liste(S.obj({ id: { type: 'string' }, marke: S.text(), name: S.text(), strasse: S.text(), plz: S.text(), ort: S.text(),
    lat: S.zahl(), lon: S.zahl(), entfernungKm: S.zahl(), offen: S.ja(), preise: PREISE }))
});

module.exports = {
  id: 'tanken',
  version: 1,
  programmversion: '2.0.0',
  aenderungen: [
    { version: '2.0.0', datum: '2026-10-02', text: 'Eingaben nur noch lat/lon mit höchstens 2 Nachkommastellen; Ortssuche per Name (ort=) sowie name, region, land, zeitzone entfallen – die Antwort enthält keinen Ortsnamen mehr (den kennt die Oberfläche). Umkreis nur 2, 5 oder 10 (sonst Fehler statt still 5). Ausland an den Koordinaten erkannt (Rahmen um Deutschland). Unbekannte Angaben werden abgelehnt (Adresse = Cache-Schlüssel, Entscheidung 02.10.2026).' },
    { version: '1.0.0', datum: '2026-09-29', text: 'Erste Fassung im Format daily/1 (ersetzt /api/fuel): alle drei Sorten mit einem Abruf, Umkreis 2/5/10 km, günstigste und Durchschnitt je Sorte' }
  ],
  titel: 'Tanken',
  beschreibung: 'Spritpreise (Super E5, Super E10, Diesel) der Tankstellen im Umkreis eines Orts in Deutschland, mit der günstigsten geöffneten Tankstelle und dem Durchschnittspreis je Sorte.',
  eingaben: { lat: 'Breitengrad, höchstens 2 Nachkommastellen (z. B. 51.05)', lon: 'Längengrad, höchstens 2 Nachkommastellen (z. B. 13.74)', umkreis: 'Umkreis in km: 2, 5 (Standard) oder 10' },
  parameter: { lat: P.lat, lon: P.lon, umkreis: P.wahl(['2', '5', '10']) },   // erlaubte Angaben = Cache-Schlüssel (_lib/parameter.js)
  laender: ['DE'],
  klasse: 'oeffentlich',
  ttl: 300,
  takt: 300,   // Antworten gelten bis zur nächsten 5-Minuten-Marke – alle Nutzer einer 1-km-Zelle teilen sich einen Abruf
  quellen: QUELLEN,
  schema: SCHEMA,
  blatt: {
    zweck: 'Beantwortet „Wo tanke ich gerade am günstigsten?“: Preise der Tankstellen im Umkreis, die günstigste geöffnete je Sorte und der Durchschnittspreis – für die Kachel „Verkehr“ (Ansicht Tanken) und Frag DAILY.',
    herkunft: [
      'Markttransparenzstelle für Kraftstoffe (MTS-K) beim Bundeskartellamt: Tankstellen in Deutschland müssen jede Preisänderung für Super E5, Super E10 und Diesel innerhalb von 5 Minuten melden.',
      'Abgerufen über die Tankerkönig-API (list.php, alle Sorten): kostenlos mit Schlüssel, Daten unter CC BY 4.0, Abfragegrenze je Schlüssel (nicht veröffentlicht), ohne Gewähr. Die Weitergabe der Datensätze als solche ist laut Nutzungsbedingungen nicht gestattet – DAILY zeigt sie nur in der eigenen Oberfläche an.'
    ],
    verarbeitung: [
      'Ort nur als lat/lon mit höchstens 2 Nachkommastellen (≈ 1 km); Umkreis 2, 5 (Standard) oder 10 km, andere Werte und Angaben werden abgelehnt. Außerhalb Deutschlands (grober Rahmen um Deutschland): nicht_unterstuetzt.',
      'Ein Abruf mit allen drei Sorten; Preise ≤ 0 oder fehlend → null. Tankstellen nach Entfernung sortiert, höchstens die nächsten 25.',
      'Günstigste je Sorte: nur geöffnete Tankstellen mit Preis, bei gleichem Preis die nähere. Durchschnitt: Mittel der geöffneten mit Preis.',
      'Takt: Antworten gelten bis zur nächsten 5-Minuten-Marke (die Meldepflicht der Tankstellen liegt bei 5 Minuten).',
      'Ohne Schlüssel (Vercel-Variable TANKERKOENIG_API_KEY) antwortet der Dienst mit dem Fehler schluessel_fehlt.'
    ],
    ausgabe: {
      umkreisKm: 'Umkreis der Suche in km',
      anzahl: 'Tankstellen im Umkreis',
      anzahlOffen: 'davon gerade geöffnet',
      guenstigste: 'günstigste geöffnete Tankstelle je Sorte (null: keine mit Preis)',
      'guenstigste.e5': 'Super E5',
      'guenstigste.e5.id': 'Kennung der Tankstelle (siehe stationen)',
      'guenstigste.e5.preis': 'Preis in € je Liter',
      'guenstigste.e5.entfernungKm': 'Entfernung in km',
      'guenstigste.e10': 'Super E10 (Felder wie e5)',
      'guenstigste.e10.id': 'Kennung der Tankstelle',
      'guenstigste.e10.preis': 'Preis in € je Liter',
      'guenstigste.e10.entfernungKm': 'Entfernung in km',
      'guenstigste.diesel': 'Diesel (Felder wie e5)',
      'guenstigste.diesel.id': 'Kennung der Tankstelle',
      'guenstigste.diesel.preis': 'Preis in € je Liter',
      'guenstigste.diesel.entfernungKm': 'Entfernung in km',
      durchschnitt: 'Durchschnittspreis der geöffneten Tankstellen je Sorte in € je Liter (null: keine)',
      'durchschnitt.e5': 'Super E5',
      'durchschnitt.e10': 'Super E10',
      'durchschnitt.diesel': 'Diesel',
      stationen: 'Tankstellen im Umkreis, nach Entfernung sortiert (höchstens 25)',
      'stationen[].id': 'Kennung der Tankstelle (MTS-K)',
      'stationen[].marke': 'Marke (z. B. ARAL), null bei freien Tankstellen ohne Marke',
      'stationen[].name': 'Name der Tankstelle',
      'stationen[].strasse': 'Straße und Hausnummer',
      'stationen[].plz': 'Postleitzahl',
      'stationen[].ort': 'Ort',
      'stationen[].lat': 'Breitengrad',
      'stationen[].lon': 'Längengrad',
      'stationen[].entfernungKm': 'Entfernung vom Ort in km',
      'stationen[].offen': 'true, wenn gerade geöffnet',
      'stationen[].preise': 'Preise in € je Liter (null: Sorte nicht im Angebot oder kein Preis)',
      'stationen[].preise.e5': 'Super E5',
      'stationen[].preise.e10': 'Super E10',
      'stationen[].preise.diesel': 'Diesel'
    },
    skalierung: {
      klasse: 'C',
      quelle: 'Tankerkönig: kostenlos mit Schlüssel, Abfragegrenze je Schlüssel (nicht veröffentlicht), ohne Verfügbarkeitszusage.',
      kosten: 'Je Aktualisierung 1 Abruf (alle Sorten), Auswertung < 1 ms.',
      cache: 'Nur auf Anfrage; CDN und Browser halten die Antwort bis zur nächsten 5-Minuten-Marke. Je belegter 1-km-Zelle und Umkreis höchstens 288 Abrufe/Tag.',
      bei10Mio: 'Nicht mit einem Tankerkönig-Schlüssel: bei z. B. 20.000 belegten Zellen wären es bis zu 5,8 Mio. Abrufe/Tag. Weg: DAILY als Verbraucher-Informationsdienst bei der MTS-K zulassen und die Preisdaten zentral beziehen (Abrufe unabhängig von der Nutzerzahl), dann Umkreissuche im eigenen Speicher.'
    }
  },
  async run(eingabe) {
    const key = process.env.TANKERKOENIG_API_KEY;
    if (!key) throw new DienstFehler('schluessel_fehlt', 'Tankerkönig-Schlüssel ist nicht eingerichtet (Vercel-Variable TANKERKOENIG_API_KEY)');
    const ort = await ortAus(eingabe);
    if (!inDeutschland(ort.lat, ort.lon)) throw new DienstFehler('nicht_unterstuetzt', 'Spritpreise gibt es für Orte in Deutschland');
    const umkreisKm = eingabe.umkreis == null ? 5 : +eingabe.umkreis;   // 2, 5 oder 10 (geprüft in _lib/parameter.js)
    let q;
    try {
      q = await getJson(`https://creativecommons.tankerkoenig.de/json/list.php?lat=${ort.lat}&lng=${ort.lon}&rad=${umkreisKm}&sort=dist&type=all&apikey=${encodeURIComponent(key)}`, { timeout: 8000 });
    } catch (e) { throw new DienstFehler('quelle_fehler', 'Tankerkönig: ' + e.message); }
    let daten;
    try { daten = umwandeln(q, umkreisKm); } catch (e) { throw new DienstFehler('quelle_fehler', 'Tankerkönig: ' + e.message); }
    return { ort, daten };
  },
  umwandeln, SORTEN, UMKREISE
};
