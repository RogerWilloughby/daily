// Dienst „wetterhinweise“: amtliche Wetterwarnungen des Deutschen Wetterdienstes für einen Ort – freundlich aufbereitet:
// Art (Glätte, Sturm …), Stufe 1–4, Zeitraum, amtlicher Text unverändert, dazu ein kurzer Alltagstipp von DAILY.
// Quelle: DWD (CAP-Warnungen) über Bright Sky. Bei Unwettern (Stufe 3–4) bleibt die amtliche Warnung im Vordergrund.
const { getJson } = require('./_lib/http');
const { DienstFehler, iso, text } = require('./_lib/rahmen');
const { ortAus } = require('./_lib/ort');
const { S } = require('./_lib/schema');

const QUELLEN = [
  { name: 'Deutscher Wetterdienst (amtliche Warnungen)', lizenz: 'GeoNutzV (Quellenvermerk)', url: 'https://www.dwd.de/warnungen' },
  { name: 'Bright Sky', lizenz: 'MIT (Software); Daten DWD', url: 'https://brightsky.dev' }
];
const STUFE = { minor: 1, moderate: 2, severe: 3, extreme: 4 };
const STUFEN = ['wetterwarnung', 'markant', 'unwetter', 'extrem'];
const ARTEN = ['gewitter', 'wind', 'regen', 'schnee', 'glaette', 'frost', 'nebel', 'hitze', 'uv', 'tauwetter', 'sonstiges'];

// Art aus dem amtlichen Ereignis (z. B. „STURMBÖEN“, „GLATTEIS“, „STARKES GEWITTER“)
function art(ereignis) {
  const e = String(ereignis || '').toUpperCase();
  if (/GEWITTER|HAGEL/.test(e)) return 'gewitter';
  if (/GLATTEIS|GLÄTTE|GLAETTE|REIFGLÄTTE|GLATT/.test(e)) return 'glaette';
  if (/SCHNEE|VERWEHUNG/.test(e)) return 'schnee';
  if (/STURM|ORKAN|WIND|BÖEN|BOEEN/.test(e)) return 'wind';
  if (/REGEN/.test(e)) return 'regen';
  if (/FROST/.test(e)) return 'frost';
  if (/NEBEL/.test(e)) return 'nebel';
  if (/HITZE/.test(e)) return 'hitze';
  if (/UV/.test(e)) return 'uv';
  if (/TAUWETTER/.test(e)) return 'tauwetter';
  return 'sonstiges';
}

// Kurzer, praktischer Tipp je Art (ab Stufe 3 bewusst ernster)
const TIPP = {
  gewitter: ['Draußen-Pläne lieber vorher erledigen, bei Gewitter drinnen bleiben.', 'Bei Gewitter Gebäude aufsuchen, Bäume und offenes Gelände meiden.'],
  wind: ['Balkonmöbel und Lose sichern, im Wald auf Äste achten.', 'Aufenthalt im Freien vermeiden, Abstand zu Bäumen und Gerüsten halten.'],
  regen: ['Schirm oder Regenjacke einpacken.', 'Keller und Unterführungen meiden, Abflüsse freihalten.'],
  schnee: ['Etwas mehr Zeit für den Weg einplanen, Winterausrüstung prüfen.', 'Unnötige Fahrten vermeiden.'],
  glaette: ['Morgens mehr Zeit einplanen, Scheiben freikratzen, vorsichtig gehen.', 'Wenn möglich zu Hause bleiben, sonst sehr vorsichtig unterwegs sein.'],
  frost: ['Scheiben freikratzen einplanen, empfindliche Pflanzen reinholen.', 'Wasserleitungen im Freien schützen.'],
  nebel: ['Mit Licht und Abstand fahren, etwas mehr Zeit einplanen.', 'Langsam fahren, möglichst auf Fahrten verzichten.'],
  hitze: ['Viel trinken, mittags Schatten suchen, Räume morgens lüften.', 'Anstrengung vermeiden, auf ältere Menschen und Kinder achten.'],
  uv: ['Sonnencreme und Kopfbedeckung nicht vergessen.', 'Mittagssonne meiden.'],
  tauwetter: ['Auf Dachlawinen und Hochwasser an Bächen achten.', 'Überflutete Wege meiden.'],
  sonstiges: ['Hinweis beachten.', 'Amtliche Hinweise beachten.']
};
const tipp = (a, stufe) => TIPP[a][stufe >= 3 ? 1 : 0];

// Antwort der Quelle → Vertrag „wetterhinweise“ v1 (reine Funktion, testbar)
function umwandeln(j, jetzt = Date.now()) {
  const loc = (j && j.location) || {};
  const hinweise = ((j && j.alerts) || [])
    .filter(a => a.status !== 'test' && (!a.expires || Date.parse(a.expires) > jetzt))
    .map(a => {
      const stufe = STUFE[a.severity] || 1, ereignis = text(a.event_de || a.event_en, 80), was = art(ereignis);
      return {
        art: was, stufe, stufeName: STUFEN[stufe - 1],
        ereignis, titel: text(a.headline_de || a.headline_en, 200),
        beginn: a.onset || a.effective ? iso(Date.parse(a.onset || a.effective)) : null,
        ende: a.expires ? iso(Date.parse(a.expires)) : null,
        aktiv: !(a.onset && Date.parse(a.onset) > jetzt),
        beschreibung: text(a.description_de || a.description_en, 1200),
        empfehlung: text(a.instruction_de || a.instruction_en, 600),
        tipp: tipp(was, stufe)
      };
    })
    .sort((a, b) => b.stufe - a.stufe || String(a.beginn).localeCompare(String(b.beginn)));
  return { gebiet: text(loc.name_short || loc.name, 120), hoechsteStufe: hinweise.length ? hinweise[0].stufe : 0, hinweise };
}

const SCHEMA = S.obj({
  gebiet: S.text(),
  hoechsteStufe: S.ganz({ minimum: 0, maximum: 4 }),
  hinweise: S.liste(S.obj({
    art: { type: 'string', enum: ARTEN }, stufe: S.ganz({ minimum: 1, maximum: 4 }), stufeName: { type: 'string', enum: STUFEN },
    ereignis: S.text(), titel: S.text(), beginn: S.zeit(), ende: S.zeit(), aktiv: S.ja(),
    beschreibung: S.text(), empfehlung: S.text(), tipp: S.text()
  }))
});

module.exports = {
  id: 'wetterhinweise',
  version: 1,
  programmversion: '1.0.0',
  aenderungen: [
    { version: '1.0.0', datum: '2026-09-27', text: 'Erste Fassung: amtliche DWD-Warnungen über Bright Sky, Art, Stufe, Zeitraum und Alltagstipp; ersetzt die Kachel „Warnungen“' }
  ],
  titel: 'Wetterhinweise',
  beschreibung: 'Amtliche Wetterwarnungen des Deutschen Wetterdienstes für einen Ort – mit Art, Stufe, Zeitraum, amtlichem Text und einem kurzen Alltagstipp.',
  eingaben: { ort: 'Ortsname (z. B. Berlin) – oder –', lat: 'Breitengrad', lon: 'Längengrad', name: 'Anzeigename (optional)', region: 'Bundesland (optional)', land: 'Ländercode (optional)' },
  laender: ['DE'],
  klasse: 'oeffentlich',
  ttl: 300,
  takt: 300,
  quellen: QUELLEN,
  schema: SCHEMA,
  blatt: {
    zweck: 'Sagt rechtzeitig, worauf man sich einstellen sollte (Glätte, Sturm, Gewitter, Hitze …) – mit einem praktischen Tipp. Erscheint in der Wetterkachel nur, wenn es etwas gibt.',
    herkunft: [
      'Deutscher Wetterdienst: amtliche Warnungen im CAP-Format für die Warnzelle (Gemeinde) des Orts, Stufen 1 (Wetterwarnung) bis 4 (extremes Unwetter). Open Data nach GeoNutzV mit Quellenvermerk.',
      'Abgerufen über Bright Sky (freie JSON-Schnittstelle zu DWD-Daten).'
    ],
    verarbeitung: [
      'Testmeldungen und abgelaufene Warnungen werden entfernt; Sortierung: höchste Stufe zuerst, dann nach Beginn.',
      'Art aus dem amtlichen Ereignis abgeleitet (z. B. „STURMBÖEN“ → wind, „GLATTEIS“ → glaette).',
      'Amtliche Überschrift, Beschreibung und Handlungsempfehlung bleiben unverändert erhalten.',
      'Tipp: kurzer Alltagstipp von DAILY je Art; ab Stufe 3 (Unwetter) ein ernster Schutzhinweis. Der Tipp ergänzt die amtliche Warnung, er ersetzt sie nicht.',
      'Takt 5 Minuten, gemeinsam mit Wetter und Regen im Paket abgerufen.'
    ],
    ausgabe: {
      gebiet: 'Name der Warnzelle (Gemeinde) laut DWD',
      hoechsteStufe: 'höchste Stufe aller Hinweise (0 = keine)',
      hinweise: 'Hinweise, höchste Stufe zuerst',
      'hinweise[].art': 'gewitter, wind, regen, schnee, glaette, frost, nebel, hitze, uv, tauwetter, sonstiges',
      'hinweise[].stufe': '1 Wetterwarnung, 2 markant, 3 Unwetter, 4 extremes Unwetter',
      'hinweise[].stufeName': 'wetterwarnung, markant, unwetter, extrem',
      'hinweise[].ereignis': 'amtliches Ereignis (z. B. „STURMBÖEN“)',
      'hinweise[].titel': 'amtliche Überschrift',
      'hinweise[].beginn': 'Beginn (UTC)',
      'hinweise[].ende': 'Ende (UTC)',
      'hinweise[].aktiv': 'true = gilt schon, false = kommt noch',
      'hinweise[].beschreibung': 'amtliche Beschreibung',
      'hinweise[].empfehlung': 'amtliche Handlungsempfehlung (kann leer sein)',
      'hinweise[].tipp': 'kurzer Alltagstipp von DAILY'
    },
    skalierung: {
      klasse: 'C',
      quelle: 'Bright Sky: kostenlos, ohne Schlüssel, keine veröffentlichte Grenze. DWD-Rohdaten (CAP-Dateien) frei.',
      kosten: 'Je Aktualisierung 1 kleiner Abruf; Funktion rechnet wenige Millisekunden.',
      cache: 'Nur auf Anfrage, gemeinsam im Paket mit Wetter und Regen; CDN und Browser halten die Antwort bis zur nächsten 5-Minuten-Marke.',
      bei10Mio: 'Warnungen gelten je Warnzelle (≈ 11.000 Gemeinden): zentral alle 5 Minuten die DWD-Warnliste laden und je Zelle vorhalten – Abrufe dann unabhängig von der Nutzerzahl.'
    }
  },
  async run(eingabe, { jetzt = Date.now() } = {}) {
    const ort = await ortAus(eingabe);
    let j;
    try { j = await getJson(`https://api.brightsky.dev/alerts?lat=${ort.lat}&lon=${ort.lon}`, { timeout: 8000 }); }
    catch (e) {
      if (/HTTP 404/.test(e.message)) throw new DienstFehler('nicht_unterstuetzt', 'Für diesen Ort gibt es keine DWD-Warnungen');
      throw new DienstFehler('quelle_fehler', 'Wetterhinweise: ' + e.message);
    }
    return { ort, daten: umwandeln(j, jetzt) };
  },
  umwandeln, art
};
