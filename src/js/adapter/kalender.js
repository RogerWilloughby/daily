// Adapter „kalender“: macht aus den Diensten „feiertage“, „himmel“ und „namenstage“ den Bereich „Kalender“
// (Rubriken Nächste · Feiertage · Ferien · Namenstage) und die Rubrik „Himmel“ unter Wetter. Seit 0.47.3 ohne Termine und Frag DAILY.
// Ohne DOM, testbar. Zeiten in der Zeitzone des Orts (Standard Europe/Berlin).
import { esc, icon } from '../core/util.js';

export const MOND_TEXT = { neumond: 'Neumond', zunehmende_sichel: 'Zunehmende Sichel', erstes_viertel: 'Erstes Viertel', zunehmender_mond: 'Zunehmender Mond',
  vollmond: 'Vollmond', abnehmender_mond: 'Abnehmender Mond', letztes_viertel: 'Letztes Viertel', abnehmende_sichel: 'Abnehmende Sichel' };
const PHASE_TEXT = { neumond: 'Neumond', erstes_viertel: 'Erstes Viertel', vollmond: 'Vollmond', letztes_viertel: 'Letztes Viertel' };
const JAHRESZEIT = { fruehling: 'Frühlingsanfang', sommer: 'Sommeranfang', herbst: 'Herbstanfang', winter: 'Winteranfang' };
const FINSTERNIS_TYP = { partiell: 'Partielle', total: 'Totale', ringfoermig: 'Ringförmige' };
const ART_TEXT = { feiertag: 'Feiertag', brueckentag: 'Brückentag', ferien: 'Ferien', zeit: 'Zeitumstellung', aktion: 'Aktionstag',
  mond: 'Mond', sterne: 'Sternschnuppen', finsternis: 'Finsternis', jahreszeit: 'Jahreszeit' };
// Reihenfolge an einem Tag: Feiertage/Ferien, dann der Rest
const RANG = { feiertag: 0, ferien: 0, brueckentag: 0, zeit: 0 };

// Datums-Helfer
const tagImOrt = (iso, zone) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
export const tageBis = (von, bis) => Math.round((Date.parse(bis) - Date.parse(von)) / 864e5);
export const wtag = datum => new Date(datum + 'T12:00:00Z').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' });
const uhr = (iso, zone) => new Date(iso).toLocaleTimeString('de-DE', { timeZone: zone, hour: '2-digit', minute: '2-digit' });
export const wann = n => n === 0 ? 'heute' : n === 1 ? 'morgen' : n === -1 ? 'gestern' : n > 0 ? `in ${n} Tagen` : `vor ${-n} Tagen`;
const gross = s => s.charAt(0).toUpperCase() + s.slice(1);

// Alle Ereignisse als eine zeitlich sortierte Liste: { datum, bis?, text, art, zusatz?, wichtig }
export function termine(fEnv, hEnv, heute, zone = 'Europe/Berlin') {
  const out = [], f = fEnv && fEnv.daten, h = hEnv && hEnv.daten;
  if (f) {
    f.feiertage.forEach(x => {
      out.push({ datum: x.datum, text: x.name, art: 'feiertag', zusatz: x.wochentag === 0 || x.wochentag === 6 ? 'am Wochenende' : '', wichtig: true });
      if (x.brueckentag && x.brueckentag >= heute) out.push({ datum: x.brueckentag, text: `Brückentag (${x.name})`, art: 'brueckentag', wichtig: true });
    });
    (f.ferien || []).forEach(x => out.push({ datum: x.von < heute ? heute : x.von, bis: x.bis, text: x.name, art: 'ferien', laeuft: x.von <= heute, wichtig: true }));
    f.zeitumstellung.forEach(x => out.push({ datum: x.datum, text: x.art === 'sommerzeit' ? 'Sommerzeit: Uhr vor (2 → 3 Uhr)' : 'Winterzeit: Uhr zurück (3 → 2 Uhr)', art: 'zeit', wichtig: true }));
    f.aktionstage.forEach(x => out.push({ datum: x.datum, text: x.name, art: 'aktion', wichtig: false }));
  }
  if (h) {
    h.mondphasen.filter(m => m.phase === 'vollmond' || m.phase === 'neumond').forEach(m => out.push({ datum: tagImOrt(m.zeit, zone),
      text: (m.supermond ? 'Supermond' : PHASE_TEXT[m.phase]), zusatz: `${uhr(m.zeit, zone)} Uhr`, art: 'mond', wichtig: m.supermond }));
    h.sternschnuppen.forEach(s => out.push({ datum: s.maximum, text: s.name, zusatz: `bis ${s.proStunde}/Std.${s.mondBeleuchtung >= 60 ? ', viel Mondlicht' : ''}`, art: 'sterne', wichtig: false }));
    h.finsternisse.forEach(x => out.push({ datum: tagImOrt(x.maximum, zone), text: `${FINSTERNIS_TYP[x.typ]} ${x.art === 'sonne' ? 'Sonnenfinsternis' : 'Mondfinsternis'}`,
      zusatz: `${uhr(x.maximum, zone)} Uhr, ${x.bedeckung} %${x.sichtbar === 'teilweise' ? ', nur teilweise zu sehen' : ''}`, art: 'finsternis', wichtig: true }));
    h.jahreszeiten.forEach(j => out.push({ datum: tagImOrt(j.zeit, zone), text: JAHRESZEIT[j.art], art: 'jahreszeit', wichtig: false }));
  }
  const rang = x => x.art in RANG ? RANG[x.art] : x.wichtig ? 2 : 3;
  return out.filter(x => (x.bis || x.datum) >= heute).sort((a, b) => a.datum.localeCompare(b.datum) || rang(a) - rang(b));
}

// Namen als kurzer Text: „Wenzel, Lioba …“
export const namenText = (l, max = 3) => !l || !l.length ? '' : l.length <= max ? l.join(', ') : `${l.slice(0, max).join(', ')} …`;

// Symbole der Mini-Reiter (eigener Code, util.js)
const SYM = { naechste: 'cal', frei: 'flag', himmel: 'moon', namen: 'etikett' };
// Zeile beim Überfahren: „Feiertag · Sa., 3.10. (in 6 Tagen) · am Wochenende“
const tipp = (t, heute) => [ART_TEXT[t.art], t.laeuft ? `läuft bis ${wtag(t.bis)}` : `${t.bis ? `${wtag(t.datum)} – ${wtag(t.bis)}` : wtag(t.datum)} (${wann(tageBis(heute, t.datum))})`, t.zusatz].filter(Boolean).join(' · ');

// Der Bereich. fEnv (feiertage) kann fehlen (Ausland, Störung), hEnv (himmel) und nEnv (namenstage) ebenso.
// Rubriken: Nächste · Feiertage · Ferien · Himmel (erscheint unter Wetter) · Namenstage
export function kachel(fEnv, hEnv, jetzt = Date.now(), zone = 'Europe/Berlin', nEnv = null) {
  const heute = tagImOrt(new Date(jetzt).toISOString(), zone);
  const f = fEnv && fEnv.daten, h = hEnv && hEnv.daten;
  const alle = termine(fEnv, hEnv, heute, zone);
  const kurzTag = t => { const n = tageBis(heute, t.datum); return n === 0 ? 'heute' : n === 1 ? 'morgen' : wtag(t.datum); };   // „heute“, „morgen“, „Mi., 30.9.“
  const kw = f ? f.kalenderwoche : null;

  // Kennzahl: heute Feiertag > laufende Ferien > nächstes wichtiges Ereignis (Feiertag, Ferien, Brückentag, Zeitumstellung)
  const frei = alle.filter(t => ['feiertag', 'ferien', 'brueckentag', 'zeit'].includes(t.art));
  const heuteFrei = frei.find(t => t.datum === heute && t.art === 'feiertag');
  const laufend = frei.find(t => t.laeuft);
  const naechst = heuteFrei || laufend || frei[0] || alle.find(t => t.wichtig) || alle[0];
  let m = naechst ? naechst.text : (h ? MOND_TEXT[h.mond.name] : 'Kalender'), ms = '–', lead = '', kopfZusatz = '';
  if (naechst) {
    const n = tageBis(heute, naechst.datum);
    if (naechst === laufend) { ms = 'Ferien'; lead = `bis ${wtag(naechst.bis)}`; kopfZusatz = lead; }
    else { ms = n === 0 ? 'heute' : n === 1 ? 'morgen' : `${n} Tage`; lead = `${gross(wann(n))} (${wtag(naechst.datum)})`; kopfZusatz = wann(n); }   // Datum beim Überfahren (Text x), damit der Kopf einzeilig bleibt
  }
  // Text (Vorlesen, Handy): danach das nächste Freie und höchstens ein weiterer Termin der nächsten 7 Tage (Welttage nicht)
  const weitere = [
    ...frei.filter(t => t !== naechst).slice(0, 1).map(t => t.art === 'ferien' ? `${t.text} ab ${wtag(t.datum)}` : `${t.text} ${wtag(t.datum)}`),
    ...alle.filter(t => t !== naechst && !frei.includes(t) && tageBis(heute, t.datum) <= 7 && !/Welt|Tag der Erde/.test(t.text)).slice(0, 1)
      .map(t => `${t.text} ${tageBis(heute, t.datum) === 0 ? 'heute' : wtag(t.datum)}`)
  ];
  const heuteNamen = nEnv && nEnv.daten ? nEnv.daten.heute.namen : [];
  const x = [lead, ...weitere, heuteNamen.length ? `Namenstag: ${namenText(heuteNamen, 2)}` : ''].filter(Boolean).join(' · ');
  const kwText = kw ? `<small class="kl-kw">KW ${kw}</small> ` : '';

  // Untertab „Nächste“: Kopf = die wichtigste Zeile; darunter Freies, ein Aktionstag der nächsten 7 Tage und der Namenstag –
  // Zeilen, die nicht passen, blendet die Oberfläche aus
  const freiWeiter = frei.filter(t => t !== naechst).slice(0, 4)
    .map(t => ({ d: t.laeuft ? `bis ${wtag(t.bis)}` : kurzTag(t), t: t.text, tip: tipp(t, heute), gruppe: 2 }));
  const aktion = alle.find(t => t.art === 'aktion' && tageBis(heute, t.datum) <= 7 && !/Welt|Tag der Erde/.test(t.text));
  const naechsteListe = [...freiWeiter, ...(aktion ? [{ d: kurzTag(aktion), t: aktion.text, tip: tipp(aktion, heute), gruppe: 2 }] : []),
    ...(heuteNamen.length ? [{ d: 'Namenstag', t: namenText(heuteNamen, 3), tip: `Namenstag heute: ${heuteNamen.join(', ')}`, gruppe: 2 }] : [])];
  const reiter = [{ id: 'naechste', name: 'Nächste', icon: icon(SYM.naechste),
    kopf: `${kwText}<b>${esc(m)}</b>${kopfZusatz ? ` <small>${esc(kopfZusatz)}</small>` : ''}`,
    liste: naechsteListe, html: '<p class="kl-leer">Nichts Besonderes in Sicht.</p>' }];

  // Feiertage (Feiertage, Brückentage, Zeitumstellung) und Ferien – je eine Rubrik (seit 0.49.0), nur Deutschland
  const zeileFrei = t => ({ d: t.laeuft ? `bis ${wtag(t.bis)}` : t.bis ? `ab ${wtag(t.datum)}` : wtag(t.datum), t: t.text + (t.zusatz ? ` (${t.zusatz})` : ''), tip: tipp(t, heute), gruppe: 1 });
  if (f) reiter.push({ id: 'feiertage', name: 'Feiertage', icon: icon(SYM.frei), kopf: `<b>Feiertage</b> <small>${esc(f.bundesland)}</small>`,
    liste: frei.filter(t => t.art !== 'ferien').map(zeileFrei), html: '<p class="kl-leer">Keine Feiertage gefunden.</p>' });
  if (f) reiter.push({ id: 'ferien', name: 'Ferien', icon: icon(SYM.frei), kopf: `<b>Schulferien</b> <small>${esc(f.bundesland)}</small>`,
    liste: frei.filter(t => t.art === 'ferien').map(zeileFrei),
    html: `<p class="kl-leer">${f.ferien ? 'Keine Ferientermine gefunden.' : 'Die Schulferien sind gerade nicht erreichbar.'}</p>` });
  // Himmel: Mond jetzt, dann je Art nur die nächsten (2 Mondtermine, 1 Sternschnuppen-Nacht, 2 Finsternisse, 1 Jahreszeit)
  if (h) {
    const md = h.mond, je = { mond: 2, sterne: 1, finsternis: 2, jahreszeit: 1 }, n = {};
    const auf = [md.aufgang ? `Aufgang ${uhr(md.aufgang, zone)}` : '', md.untergang ? `Untergang ${uhr(md.untergang, zone)}` : ''].filter(Boolean).join(' · ');
    reiter.push({ id: 'himmel', name: 'Himmel', icon: icon(SYM.himmel), kopf: `<b>${esc(MOND_TEXT[md.name])}</b> <small>${md.beleuchtung} % beleuchtet</small>`,
      liste: [...(auf ? [{ d: 'Mond', t: auf, tip: `Mond heute: ${auf}`, gruppe: 0 }] : []),
        ...termine(null, { daten: h }, heute, zone).filter(t => (n[t.art] = (n[t.art] || 0) + 1) <= je[t.art])
          .map(t => ({ d: wtag(t.datum), t: t.text + (t.zusatz ? ` (${t.zusatz})` : ''), tip: tipp(t, heute), gruppe: 1 }))] });
  }
  // Namenstage: heute und die nächsten 6 Tage
  if (nEnv && nEnv.daten && nEnv.daten.woche.some(w => w.namen.length)) reiter.push({ id: 'namen', name: 'Namenstage', icon: icon(SYM.namen),
    kopf: `<b>Namenstage</b>${heuteNamen.length ? ` <small>heute ${esc(namenText(heuteNamen, 2))}</small>` : ''}`,
    liste: nEnv.daten.woche.map(w => ({ d: w.datum === heute ? 'heute' : tageBis(heute, w.datum) === 1 ? 'morgen' : wtag(w.datum), t: w.namen.join(', ') || '–', tip: `${wtag(w.datum)}: ${w.namen.join(', ') || 'kein Namenstag eingetragen'}`, gruppe: 1 })) });

  return {
    state: 'live', title: kw ? `Kalender · KW ${kw}` : 'Kalender', m, ms, x, liste: [], kleinReiter: reiter, startReiter: 'naechste',
    info: [kw ? `Kalenderwoche ${kw}` : null, f ? `Feiertage berechnet (${f.bundesland}, landesweit)${f.ferien ? ', Schulferien: OpenHolidays API' : ', Schulferien gerade nicht erreichbar'}` : 'Feiertage und Ferien nur für Orte in Deutschland',
      h ? 'Himmel berechnet (Astronomy Engine); Finsternisse nur, wenn am Ort zu sehen – Sonne nur mit Schutzbrille ansehen' : null,
      nEnv && nEnv.daten ? 'Namenstage: Auswahl nach den Gedenktagen der Heiligen' : null].filter(Boolean)
  };
}
