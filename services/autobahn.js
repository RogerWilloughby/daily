// Dienst „autobahn“ (öffentlich): Staus, Sperrungen und Baustellen auf den gewählten Autobahnen – für den Arbeitsweg mit dem Auto.
// Quelle: Autobahn-API der Autobahn GmbH des Bundes (verkehr.autobahn.de), ohne Schlüssel.
// Start und Ziel des Arbeitswegs kommen nie hierher: der Dienst liefert alle Meldungen der Autobahnen, den Weg filtert der Browser.
// So ist die Antwort für alle gleich, die dieselben Autobahnen gewählt haben (gemeinsamer Cache).
const { getJson } = require('./_lib/http');
const { DienstFehler, iso, runde } = require('./_lib/rahmen');
const { S } = require('./_lib/schema');

const QUELLEN = [{ name: 'Die Autobahn GmbH des Bundes (Autobahn-API)', lizenz: null, url: 'https://verkehr.autobahn.de' }];
const BASIS = 'https://verkehr.autobahn.de/o/autobahn';
const ARTEN = ['warning', 'closure', 'roadworks'];
const MAX_STRASSEN = 5, MAX_ZEILEN = 10, MAX_ZEITRAEUME = 10, TAKT = 300;
const TYPEN = ['stau', 'meldung', 'sperrung', 'anschlusssperrung', 'tagesbaustelle', 'baustelle'];
const LAGE = { SLOW_TRAFFIC: 'langsam', QUEUING_TRAFFIC: 'stockend', STATIONARY_TRAFFIC: 'stau' };
const ANZEIGE = { CLOSURE: 'sperrung', CLOSURE_ENTRY_EXIT: 'anschlusssperrung', ROADWORKS: 'baustelle', SHORT_TERM_ROADWORKS: 'tagesbaustelle' };

// „a4, A 13;a4“ → ['A13', 'A4'] (ohne Doppelte, sortiert: gleiche Auswahl = gleicher Cache); ungültige Angaben → null
function strassenAus(v) {
  const teile = String(v || '').toUpperCase().split(/[,;\s]+(?=A)|[,;]/).map(s => s.replace(/\s+/g, '')).filter(Boolean);
  if (!teile.length) return [];
  if (teile.some(s => !/^A\d{1,3}$/.test(s))) return null;
  return [...new Set(teile.map(s => 'A' + Number(s.slice(1))))].sort((a, b) => a.slice(1) - b.slice(1));
}

// Ortszeit Deutschland → UTC (Sommer-/Winterzeit über Intl, zwei Durchgänge für den Umstellungstag)
const TEILE = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
function versatz(t) {
  const p = Object.fromEntries(TEILE.formatToParts(new Date(t)).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(t / 60000) * 60000;
}
function berlin(tt, mm, jj, h, mi) {
  const lokal = Date.UTC(2000 + +jj, +mm - 1, +tt, +h, +mi);
  let t = lokal - versatz(lokal);
  t = lokal - versatz(t);
  return iso(t);
}
const zeitVon = s => { const t = Date.parse(s); return Number.isFinite(t) ? iso(t) : null; };
const zahl = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const DT = '(\\d{2})\\.(\\d{2})\\.(\\d{2})';

// Angaben, die die Quelle nur im Text hat: Beginn, Ende, Zeiträume, Länge, Höchstgeschwindigkeit
function ausText(zeilen) {
  const t = zeilen.join('\n'), m = re => t.match(new RegExp(re));
  const b = m(`Beginn:\\s*${DT}\\s*um\\s*(\\d{2}):(\\d{2})`), e = m(`Ende:\\s*${DT}\\s*um\\s*(\\d{2}):(\\d{2})`);
  const zeitraeume = [...t.matchAll(new RegExp(`${DT},?\\s*(\\d{2}):(\\d{2})\\s*(?:Uhr\\s*)?bis\\s*(?:zum\\s*)?${DT},?\\s*(\\d{2}):(\\d{2})`, 'g'))]
    .map(x => ({ beginn: berlin(x[1], x[2], x[3], x[4], x[5]), ende: berlin(x[6], x[7], x[8], x[9], x[10]) })).slice(0, MAX_ZEITRAEUME);
  const l = m('Länge:\\s*([\\d.,]+)\\s*km'), v = m('Max\\.\\s*(\\d+)\\s*km/h');
  return {
    beginn: b ? berlin(b[1], b[2], b[3], b[4], b[5]) : null, ende: e ? berlin(e[1], e[2], e[3], e[4], e[5]) : null, zeitraeume,
    laengeKm: l ? runde(zahl(l[1]), 1) : null, tempoKmh: v ? +v[1] : null
  };
}

// „A4 | Wilsdruff - Nossen“ → Abschnitt; „ Dresden -> Chemnitz“ → Richtung
function abschnitt(titel) {
  const rest = String(titel || '').split('|').slice(1).join('|').trim() || String(titel || '').trim();
  const teile = rest.split(/\s+-\s+/);
  return teile.length === 2 ? { von: teile[0].trim() || null, bis: teile[1].trim() || null } : { von: rest || null, bis: null };
}
function richtung(untertitel) {
  const teile = String(untertitel || '').split('->').map(s => s.trim());
  return teile.length === 2 ? { von: teile[0] || null, nach: teile[1] || null } : { von: null, nach: teile[0] || null };
}
// zweiter Endpunkt aus „extent“ (lat1,lon1,lat2,lon2): der Punkt, der nicht der Anfang ist
function zweiterPunkt(extent, lat, lon) {
  const z = String(extent || '').split(',').map(Number);
  if (z.length !== 4 || z.some(n => !Number.isFinite(n))) return [null, null];
  const [a, b] = Math.abs(z[0] - lat) + Math.abs(z[1] - lon) < 1e-6 ? [z[2], z[3]] : [z[0], z[1]];
  return [runde(a, 4), runde(b, 4)];
}

function typVon(e, art) {
  if (ANZEIGE[e.display_type]) return ANZEIGE[e.display_type];
  if (art === 'closure') return 'sperrung';
  if (art === 'roadworks') return 'baustelle';
  return LAGE[e.abnormalTrafficType] || zahl(e.delayTimeValue) ? 'stau' : 'meldung';
}

// Antworten der Quelle für eine Autobahn ({ warning: {warning:[…]}, closure: {closure:[…]}, roadworks: {roadworks:[…]} }) → Meldungen (rein, testbar)
function umwandeln(antworten, strasse) {
  const out = [];
  for (const art of ARTEN) {
    const liste = (antworten[art] && antworten[art][art]) || [];
    for (const e of liste) {
      if (!e || !e.identifier) continue;
      const lat = e.coordinate ? zahl(e.coordinate.lat) : null, lon = e.coordinate ? zahl(e.coordinate.long) : null;
      if (lat == null || lon == null) continue;
      const zeilen = (Array.isArray(e.description) ? e.description : []).map(s => String(s).replace(/\s+/g, ' ').trim()).filter(Boolean);
      const t = ausText(zeilen), [lat2, lon2] = zweiterPunkt(e.extent, lat, lon);
      const verz = zahl(e.delayTimeValue), tempo = zahl(e.averageSpeed);
      out.push({
        id: String(e.identifier), strasse, typ: typVon(e, art), lage: LAGE[e.abnormalTrafficType] || null,
        ...abschnitt(e.title), richtung: richtung(e.subtitle),
        lat: runde(lat, 4), lon: runde(lon, 4), lat2, lon2,
        verzoegerungMin: verz != null && verz > 0 ? Math.round(verz) : null,
        tempoKmh: tempo != null && tempo > 0 ? Math.round(tempo) : t.tempoKmh,
        laengeKm: t.laengeKm,
        gesperrt: e.isBlocked === true || e.isBlocked === 'true',
        kuenftig: e.future === true || e.future === 'true',
        beginn: zeitVon(e.startTimestamp) || (t.zeitraeume[0] && t.zeitraeume[0].beginn) || t.beginn,
        ende: t.ende || (t.zeitraeume.length ? t.zeitraeume[t.zeitraeume.length - 1].ende : null),
        zeitraeume: t.zeitraeume,
        text: zeilen.slice(0, MAX_ZEILEN),
        anbieter: e.source ? String(e.source).slice(0, 40) : null
      });
    }
  }
  return out;
}

// Reihenfolge: Autobahn wie gewählt, dann Bedeutung (Stau vor Meldung, Sperrung, Anschlusssperrung, Tagesbaustelle, Baustelle),
// innerhalb: größere Verzögerung zuerst, dann früherer Beginn
function sortiere(liste, strassen) {
  return liste.sort((a, b) => strassen.indexOf(a.strasse) - strassen.indexOf(b.strasse) || TYPEN.indexOf(a.typ) - TYPEN.indexOf(b.typ) ||
    (b.verzoegerungMin || 0) - (a.verzoegerungMin || 0) || String(a.beginn || '').localeCompare(String(b.beginn || '')));
}

// Zwischenspeicher je Autobahn in der laufenden Funktion: verschiedene Auswahlen (A4 / A4,A13) teilen sich die Abrufe
const JE_STRASSE = new Map();
async function holeStrasse(strasse, jetzt) {
  const alt = JE_STRASSE.get(strasse);
  if (alt && alt.bis > jetzt) return alt.wert;
  const antworten = {}, fehler = [];
  await Promise.all(ARTEN.map(art => getJson(`${BASIS}/${strasse}/services/${art}`, { timeout: 8000 })
    .then(r => { antworten[art] = r; }).catch(e => { fehler.push(art + ': ' + e.message); })));
  const wert = { meldungen: fehler.length === ARTEN.length ? null : umwandeln(antworten, strasse), unvollstaendig: fehler.length > 0, fehler };
  if (!fehler.length) JE_STRASSE.set(strasse, { bis: Math.ceil((jetzt + 1) / (TAKT * 1000)) * TAKT * 1000, wert });
  if (JE_STRASSE.size > 200) JE_STRASSE.delete(JE_STRASSE.keys().next().value);
  return wert;
}

const ZEITRAUM = S.obj({ beginn: S.zeit(), ende: S.zeit() });
const SCHEMA = S.obj({
  strassen: S.liste({ type: 'string' }),
  fehlend: S.liste({ type: 'string' }),
  meldungen: S.liste(S.obj({
    id: { type: 'string' }, strasse: { type: 'string' }, typ: { type: 'string', enum: TYPEN },
    lage: { type: ['string', 'null'], enum: ['langsam', 'stockend', 'stau', null] },
    von: S.text(), bis: S.text(), richtung: S.obj({ von: S.text(), nach: S.text() }),
    lat: { type: 'number' }, lon: { type: 'number' }, lat2: S.zahl(), lon2: S.zahl(),
    verzoegerungMin: S.ganz({ minimum: 0 }), tempoKmh: S.ganz({ minimum: 0 }), laengeKm: S.zahl({ minimum: 0 }),
    gesperrt: { type: 'boolean' }, kuenftig: { type: 'boolean' },
    beginn: S.zeit(), ende: S.zeit(), zeitraeume: S.liste(ZEITRAUM),
    text: S.liste({ type: 'string' }), anbieter: S.text()
  }))
});

module.exports = {
  id: 'autobahn',
  version: 1,
  programmversion: '1.0.0',
  aenderungen: [
    { version: '1.0.0', datum: '2026-09-29', text: 'Erste Fassung: Staus, Verkehrsmeldungen, Sperrungen und Baustellen der gewählten Autobahnen (bis 5), Beginn/Ende/Länge/Tempo aus dem amtlichen Text' }
  ],
  titel: 'Autobahn',
  beschreibung: 'Aktuelle Staus, Verkehrsmeldungen, Sperrungen und Baustellen auf den gewählten Autobahnen in Deutschland – für den Arbeitsweg mit dem Auto.',
  eingaben: { strassen: 'Autobahnen, durch Komma getrennt (z. B. A4,A13), höchstens 5' },
  laender: ['DE'],
  klasse: 'oeffentlich',
  ttl: TAKT,
  takt: TAKT,   // gültig bis zur nächsten 5-Minuten-Marke
  quellen: QUELLEN,
  schema: SCHEMA,
  blatt: {
    zweck: 'Beantwortet „Komme ich heute gut zur Arbeit?“ für Autofahrer: was auf den gewählten Autobahnen los ist – Staus mit Verzögerung, Sperrungen (auch geplante), Tages- und Dauerbaustellen. Für die Kachel „Verkehr“ (Ansicht Arbeitsweg) und Frag DAILY. Start und Ziel des Arbeitswegs bleiben im Browser: der Dienst kennt nur die Autobahnen, den Abschnitt zwischen Start und Ziel wählt die Oberfläche aus.',
    herkunft: [
      'Autobahn-API der Autobahn GmbH des Bundes (verkehr.autobahn.de, beschrieben auf autobahn.api.bund.dev): je Autobahn Verkehrsmeldungen (warning), Sperrungen (closure) und Baustellen (roadworks). Frei abrufbar ohne Schlüssel; eine Lizenz oder Abfragegrenze ist nicht veröffentlicht.',
      'Verkehrsmeldungen stammen laut Feld „source“ teils vom kommerziellen Anbieter INRIX. Vor dem öffentlichen Start klären, ob die Anzeige erlaubt ist (docs/recht/checkliste.md).',
      'Angaben ohne Gewähr; Fahrzeiten mit Live-Verkehr liefert die Quelle nicht.'
    ],
    verarbeitung: [
      'Eingabe: bis zu 5 Autobahnen (A1 … A999), Schreibweise egal („a4, A 13“), sortiert und ohne Doppelte – gleiche Auswahl, gleiche Antwort.',
      'Je Autobahn 3 Abrufe (Meldungen, Sperrungen, Baustellen) parallel; Autobahnen ohne Antwort stehen in „fehlend“, fehlt nur ein Teil, kommt der Hinweis meldungen_unvollstaendig.',
      'Art aus der Anzeige-Art der Quelle: Stau (Verkehrslage oder Verzögerung), sonstige Meldung, Sperrung, Anschlusssperrung, Tagesbaustelle, Baustelle. Abschnitt aus dem Titel, Richtung aus dem Untertitel.',
      'Beginn, Ende, Zeiträume (Ortszeit → UTC), Länge und Höchstgeschwindigkeit stehen bei der Quelle nur im Text und werden daraus gelesen; was nicht passt, bleibt null. Der amtliche Text bleibt unverändert (höchstens 10 Zeilen, ohne Leerzeilen).',
      'Koordinaten auf 4 Nachkommastellen, Linienverlauf (Geometrie) weggelassen – hält die Antwort klein.',
      'Reihenfolge: Autobahn, dann Bedeutung (Stau, Meldung, Sperrung, Anschlusssperrung, Tagesbaustelle, Baustelle), dann größere Verzögerung, dann früherer Beginn.',
      'Takt: Antworten gelten bis zur nächsten 5-Minuten-Marke; zusätzlich merkt sich die laufende Funktion jede Autobahn bis dahin (verschiedene Auswahlen teilen sich die Abrufe).'
    ],
    ausgabe: {
      strassen: 'abgefragte Autobahnen (sortiert)',
      fehlend: 'Autobahnen, zu denen die Quelle nichts geliefert hat',
      meldungen: 'Meldungen aller abgefragten Autobahnen, sortiert nach Autobahn und Bedeutung',
      'meldungen[].id': 'Kennung der Meldung (Quelle)',
      'meldungen[].strasse': 'Autobahn, z. B. A4',
      'meldungen[].typ': 'stau, meldung, sperrung, anschlusssperrung, tagesbaustelle oder baustelle',
      'meldungen[].lage': 'Verkehrslage bei Staus: langsam, stockend oder stau (null: keine Angabe)',
      'meldungen[].von': 'Abschnitt von (Anschlussstelle, Dreieck, Kreuz)',
      'meldungen[].bis': 'Abschnitt bis (null, wenn der Titel keinen Abschnitt nennt)',
      'meldungen[].richtung': 'Fahrtrichtung',
      'meldungen[].richtung.von': 'Richtung von (z. B. Dresden)',
      'meldungen[].richtung.nach': 'Richtung nach (z. B. Chemnitz)',
      'meldungen[].lat': 'Breitengrad des Anfangs',
      'meldungen[].lon': 'Längengrad des Anfangs',
      'meldungen[].lat2': 'Breitengrad des anderen Endes (null: unbekannt)',
      'meldungen[].lon2': 'Längengrad des anderen Endes',
      'meldungen[].verzoegerungMin': 'Verzögerung in Minuten (nur Staus, null: keine Angabe)',
      'meldungen[].tempoKmh': 'Durchschnittsgeschwindigkeit im Stau bzw. Höchstgeschwindigkeit an der Baustelle in km/h',
      'meldungen[].laengeKm': 'Länge in km (aus dem Text)',
      'meldungen[].gesperrt': 'true, wenn die Fahrbahn laut Quelle gesperrt ist',
      'meldungen[].kuenftig': 'true, wenn die Maßnahme noch nicht begonnen hat',
      'meldungen[].beginn': 'Beginn (UTC)',
      'meldungen[].ende': 'Ende (UTC, null: unbekannt)',
      'meldungen[].zeitraeume': 'einzelne Zeiträume bei wiederkehrenden Sperrungen (z. B. nachts), höchstens 10',
      'meldungen[].zeitraeume[].beginn': 'Beginn des Zeitraums (UTC)',
      'meldungen[].zeitraeume[].ende': 'Ende des Zeitraums (UTC)',
      'meldungen[].text': 'amtlicher Text der Quelle, Zeile für Zeile',
      'meldungen[].anbieter': 'Datenlieferant laut Quelle (z. B. inrix), null: Autobahn GmbH'
    },
    skalierung: {
      klasse: 'B',
      quelle: 'Autobahn-API: ohne Schlüssel, keine veröffentlichte Abfragegrenze, keine Verfügbarkeitszusage.',
      kosten: 'Je Autobahn 3 Abrufe je 5 Minuten, Auswertung < 5 ms.',
      cache: 'CDN und Browser halten die Antwort bis zur nächsten 5-Minuten-Marke (je Auswahl); die Funktion merkt sich jede Autobahn bis dahin. Höchstens ≈ 110 Autobahnen × 3 Abrufe × 288 = ≈ 95.000 Abrufe/Tag je Funktions-Instanz – unabhängig von der Zahl der Nutzer.',
      bei10Mio: 'Tragbar: die Abrufe hängen an den Autobahnen, nicht an den Nutzern; die Last trägt das CDN. Viele verschiedene Auswahlen verteilen sich auf viele Cache-Schlüssel – Ausweg bei Bedarf: je Autobahn eine eigene Anfrage (/api/v1/autobahn?strassen=A4), die der Browser zusammenführt. Offen bleibt die Nutzungserlaubnis für den öffentlichen Betrieb (INRIX).'
    }
  },
  async run(eingabe, ctx = {}) {
    if (eingabe.strassen == null || String(eingabe.strassen).trim() === '') throw new DienstFehler('eingabe_fehlt', 'Parameter strassen fehlt (z. B. strassen=A4,A13)');
    const strassen = strassenAus(eingabe.strassen);
    if (!strassen || !strassen.length) throw new DienstFehler('eingabe_ungueltig', 'Autobahnen als A1 … A999 angeben, durch Komma getrennt');
    if (strassen.length > MAX_STRASSEN) throw new DienstFehler('eingabe_ungueltig', `Höchstens ${MAX_STRASSEN} Autobahnen`);
    const jetzt = ctx.jetzt || Date.now();
    const je = await Promise.all(strassen.map(s => holeStrasse(s, jetzt)));
    const fehlend = strassen.filter((s, i) => !je[i].meldungen);
    if (fehlend.length === strassen.length) throw new DienstFehler('quelle_fehler', 'Autobahn-API: ' + je.flatMap(x => x.fehler).slice(0, 3).join('; '));
    const gesehen = new Set(), meldungen = [];
    for (const m of je.flatMap(x => x.meldungen || [])) {
      const k = m.strasse + '|' + m.id;
      if (!gesehen.has(k)) { gesehen.add(k); meldungen.push(m); }
    }
    const hinweise = je.some(x => x.meldungen && x.unvollstaendig) ? ['meldungen_unvollstaendig'] : [];
    return { daten: { strassen, fehlend, meldungen: sortiere(meldungen, strassen) }, hinweise };
  },
  umwandeln, strassenAus, berlin, ausText, JE_STRASSE, MAX_STRASSEN
};
