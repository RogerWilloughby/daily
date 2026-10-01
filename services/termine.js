// Dienst „termine“ (nur privat): eigene Termine aus iCal-Kalendern (Google, Outlook, iCloud …) für heute und die nächsten 14 Tage.
// Die iCal-Links kommen aus den DAILY-Einstellungen im Browser – nur per POST, werden nie gespeichert, nie zwischengespeichert
// und stehen nie in einer Adresse. Ersatzweise aus der Vercel-Variable CALENDAR_ICS_URL. Links nie in den Code!
const { P } = require('./_lib/parameter');
const ical = require('node-ical');
const { DienstFehler, iso, tagIn, text } = require('./_lib/rahmen');
const { S } = require('./_lib/schema');

const QUELLEN = [{ name: 'Deine Kalender (iCal)', lizenz: null, url: null }];
const TAGE = 14, MAX_KALENDER = 5, MAX_TERMINE = 80;
const PRIVATER_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|0\.)/i;
// Ganztägige Termine legt node-ical in der Zeitzone des Servers an → deren lokales Datum nehmen
const lokalTag = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Links prüfen: nur https (webcal → https), keine internen Adressen, höchstens 5
function links(liste) {
  return [].concat(liste || []).map(u => String(u).trim().replace(/^webcal:/i, 'https:'))
    .filter(u => { try { const h = new URL(u); return h.protocol === 'https:' && !PRIVATER_HOST.test(h.hostname); } catch (e) { return false; } })
    .slice(0, MAX_KALENDER);
}

// Eine iCal-Datei → Termine im Zeitraum (rein, testbar)
function auswerten(icsText, { von, bis, heute, zone = 'Europe/Berlin' }) {
  if (!/BEGIN:VCALENDAR/i.test(icsText)) throw new Error('Der Link liefert keine Kalenderdatei, sondern eine Webseite – bitte den iCal-Link (endet meist auf .ics) nehmen');
  let daten;
  try { daten = ical.sync.parseICS(icsText); } catch (e) { throw new Error('Kalenderdatei konnte nicht gelesen werden'); }
  const out = [];
  for (const ev of Object.values(daten)) {
    if (!ev || ev.type !== 'VEVENT' || ev.recurrenceid || ev.status === 'CANCELLED') continue;
    let einzeln = [];
    try { einzeln = ical.expandRecurringEvent(ev, { from: new Date(von), to: new Date(bis), expandOngoing: true }); } catch (e) { continue; }
    for (const i of einzeln) {
      const ganztag = !!i.isFullDay, tag = ganztag ? lokalTag(i.start) : tagIn(i.start, zone);
      if (tag < heute) continue;
      const titel = i.summary && typeof i.summary === 'object' ? i.summary.val : (i.summary || (ev.summary && ev.summary.val) || ev.summary);
      out.push({ titel: text(titel || 'Termin', 120), tag, beginn: iso(i.start), ende: i.end ? iso(i.end) : null, ganztag });
    }
  }
  return out;
}

async function lade(url, idx, rahmen) {
  let r;
  try { r = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { 'user-agent': 'DAILY (privater Kalender-Abruf)' } }); }
  catch (e) { throw new Error(e && e.name === 'TimeoutError' ? 'keine Antwort innerhalb von 10 Sekunden' : 'Server nicht erreichbar'); }
  if (r.status === 404) throw new Error('Link nicht gefunden (404) – ist es die „Privatadresse im iCal-Format“?');
  if (r.status === 401 || r.status === 403) throw new Error(`Zugriff verweigert (${r.status}) – Link evtl. zurückgesetzt oder nicht öffentlich`);
  if (!r.ok) throw new Error(`Fehler vom Kalender-Server (HTTP ${r.status})`);
  return auswerten(await r.text(), rahmen).map(t => ({ ...t, kalender: idx + 1 }));
}

const SCHEMA = S.obj({
  verbunden: S.ja(),
  heute: S.datum(),
  termine: S.liste(S.obj({ titel: S.text(), tag: S.datum(), beginn: S.zeit(), ende: S.zeit(), ganztag: S.ja(), kalender: S.ganz({ minimum: 1 }) })),
  fehler: S.liste(S.obj({ kalender: S.ganz({ minimum: 1 }), meldung: S.text() }))
});

module.exports = {
  id: 'termine',
  version: 1,
  programmversion: '1.1.0',
  aenderungen: [
    { version: '1.1.0', datum: '2026-10-02', text: 'Unbekannte Angaben werden abgelehnt (Adresse = Cache-Schlüssel, Entscheidung 02.10.2026).' },
    { version: '1.0.0', datum: '2026-09-28', text: 'Erste Fassung als Dienst (vorher api/calendar.js): 14 Tage, Serientermine, ganztägige Termine, verständliche Fehler je Kalender; Links nur per POST' }
  ],
  titel: 'Termine',
  beschreibung: 'Deine eigenen Termine aus iCal-Kalendern für heute und die nächsten 14 Tage – nur im privaten Betrieb.',
  eingaben: { urls: 'iCal-Links (Liste, höchstens 5) – nur per POST im JSON-Körper, nie in der Adresse', zeitzone: 'Zeitzone (optional, Standard Europe/Berlin)' },
  parameter: { urls: P.koerper, zeitzone: P.text(60, /^[A-Za-z_]+(\/[A-Za-z_+-]+)*$/, 'Europe/Berlin') },   // erlaubte Angaben = Cache-Schlüssel (_lib/parameter.js)
  laender: 'alle',
  klasse: 'privat',
  ttl: 60,
  quellen: QUELLEN,
  schema: SCHEMA,
  blatt: {
    zweck: 'Zeigt in der Kachel „Kalender“, was heute und in den nächsten zwei Wochen ansteht – zusammen mit Feiertagen, Ferien und Namenstagen.',
    herkunft: [
      'Deine eigenen Kalender über ihre iCal-Adresse (z. B. Google: „Privatadresse im iCal-Format“). Die Links stehen nur in deinem Browser (Einstellungen) und werden bei jedem Abruf mitgeschickt.',
      'Ersatzweise aus der Vercel-Umgebungsvariable CALENDAR_ICS_URL.'
    ],
    verarbeitung: [
      'Nur im privaten Betrieb (Vercel-Variable DAILY_PRIVATE=1); öffentlich ist der Dienst gesperrt.',
      'Links nur per POST im JSON-Körper – nie in der Adresse, damit sie in keinem Protokoll landen. Nur https (webcal wird zu https), keine internen Adressen, höchstens 5 Kalender.',
      'Keine Zwischenspeicherung: weder auf dem Server noch im CDN noch im Browser-Speicher von DAILY.',
      'Serientermine werden aufgelöst, abgesagte Termine weggelassen; ganztägige Termine behalten ihr Datum.',
      'Zeitraum heute bis 14 Tage voraus, höchstens 80 Termine; Fehler je Kalender in verständlichen Worten (ohne den Link).'
    ],
    ausgabe: {
      verbunden: 'true = mindestens ein Kalender eingetragen',
      heute: 'heutiger Tag in der Zeitzone',
      termine: 'Termine, zeitlich sortiert (ganztägige zuerst)',
      'termine[].titel': 'Titel des Termins',
      'termine[].tag': 'Tag',
      'termine[].beginn': 'Beginn (UTC)',
      'termine[].ende': 'Ende (UTC, oder null)',
      'termine[].ganztag': 'true = ganztägig',
      'termine[].kalender': 'Nummer des Kalenders (1–5)',
      fehler: 'Kalender, die nicht gelesen werden konnten',
      'fehler[].kalender': 'Nummer des Kalenders',
      'fehler[].meldung': 'was nicht geklappt hat'
    },
    skalierung: {
      klasse: 'D',
      quelle: 'Die Kalender-Server der Nutzer (Google, Microsoft, Apple …); je Abruf 1 Anfrage je Kalender.',
      kosten: 'Je Abruf 1–5 Downloads und Auswertung, typisch 200–800 ms.',
      cache: 'Keiner – private Daten; der Browser fragt alle 10 Minuten.',
      bei10Mio: 'Nicht öffentlich – nur Rogers privater Betrieb. Für eine öffentliche Fassung bräuchte es Anmeldung und eine andere Lösung.'
    }
  },
  async run(eingabe) {
    if (eingabe.urls && !eingabe._post) throw new DienstFehler('eingabe_ungueltig', 'Kalender-Links nur per POST, nie in der Adresse');
    const zone = text(eingabe.zeitzone, 60) || 'Europe/Berlin';
    let urls = links(eingabe.urls);
    if (!urls.length) urls = links((process.env.CALENDAR_ICS_URL || '').split(/[\s,]+/));
    const jetzt = Date.now(), heute = tagIn(jetzt, zone);
    if (!urls.length) return { daten: { verbunden: false, heute, termine: [], fehler: [] } };
    const rahmen = { von: jetzt - 36 * 3600e3, bis: jetzt + (TAGE + 1) * 864e5, heute, zone };
    const termine = [], fehler = [];
    await Promise.all(urls.map((u, i) => lade(u, i, rahmen).then(l => termine.push(...l), e => fehler.push({ kalender: i + 1, meldung: text(e.message, 200) }))));
    termine.sort((a, b) => a.tag.localeCompare(b.tag) || (a.ganztag === b.ganztag ? a.beginn.localeCompare(b.beginn) : a.ganztag ? -1 : 1));
    fehler.sort((a, b) => a.kalender - b.kalender);
    const bisTag = tagIn(jetzt + TAGE * 864e5, zone);
    return { daten: { verbunden: true, heute, termine: termine.filter(t => t.tag <= bisTag).slice(0, MAX_TERMINE), fehler } };
  },
  auswerten, links
};
