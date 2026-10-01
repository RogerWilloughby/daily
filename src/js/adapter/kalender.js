// Adapter „kalender“: macht aus den Diensten „feiertage“, „himmel“, „namenstage“ und (privat) „termine“ die Kachel „Kalender“
// und die Antworten für „Frag DAILY“.
// Ohne DOM, testbar. Zeiten in der Zeitzone des Orts (Standard Europe/Berlin).
import { esc, icon } from '../core/util.js';

export const MOND_TEXT = { neumond: 'Neumond', zunehmende_sichel: 'Zunehmende Sichel', erstes_viertel: 'Erstes Viertel', zunehmender_mond: 'Zunehmender Mond',
  vollmond: 'Vollmond', abnehmender_mond: 'Abnehmender Mond', letztes_viertel: 'Letztes Viertel', abnehmende_sichel: 'Abnehmende Sichel' };
const PHASE_TEXT = { neumond: 'Neumond', erstes_viertel: 'Erstes Viertel', vollmond: 'Vollmond', letztes_viertel: 'Letztes Viertel' };
const JAHRESZEIT = { fruehling: 'Frühlingsanfang', sommer: 'Sommeranfang', herbst: 'Herbstanfang', winter: 'Winteranfang' };
const FINSTERNIS_TYP = { partiell: 'Partielle', total: 'Totale', ringfoermig: 'Ringförmige' };
const ART_TEXT = { feiertag: 'Feiertag', brueckentag: 'Brückentag', ferien: 'Ferien', zeit: 'Zeitumstellung', aktion: 'Aktionstag',
  mond: 'Mond', sterne: 'Sternschnuppen', finsternis: 'Finsternis', jahreszeit: 'Jahreszeit', termin: 'Termin' };
// Reihenfolge an einem Tag: Feiertage/Ferien, dann eigene Termine (nach Uhrzeit), dann der Rest
const RANG = { feiertag: 0, ferien: 0, brueckentag: 0, zeit: 0, termin: 1 };

// Datums-Helfer
const tagImOrt = (iso, zone) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
export const tageBis = (von, bis) => Math.round((Date.parse(bis) - Date.parse(von)) / 864e5);
export const wtag = datum => new Date(datum + 'T12:00:00Z').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' });
const uhr = (iso, zone) => new Date(iso).toLocaleTimeString('de-DE', { timeZone: zone, hour: '2-digit', minute: '2-digit' });
export const wann = n => n === 0 ? 'heute' : n === 1 ? 'morgen' : n === -1 ? 'gestern' : n > 0 ? `in ${n} Tagen` : `vor ${-n} Tagen`;
const gross = s => s.charAt(0).toUpperCase() + s.slice(1);

// Alle Ereignisse als eine zeitlich sortierte Liste: { datum, bis?, text, art, zusatz?, wichtig }
// tEnv (privat): eigene Termine aus dem Dienst „termine“
export function termine(fEnv, hEnv, heute, zone = 'Europe/Berlin', tEnv = null) {
  const out = [], f = fEnv && fEnv.daten, h = hEnv && hEnv.daten, t = tEnv && tEnv.daten;
  if (t) t.termine.forEach(x => out.push({ datum: x.tag, text: x.titel, art: 'termin', wichtig: true, ganztag: x.ganztag, beginn: x.beginn, ende: x.ende,
    zusatz: x.ganztag ? 'ganztägig' : `${uhr(x.beginn, zone)} Uhr` }));
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
  return out.filter(x => (x.bis || x.datum) >= heute).sort((a, b) => a.datum.localeCompare(b.datum) || rang(a) - rang(b)
    || (a.art === 'termin' && b.art === 'termin' ? (b.ganztag - a.ganztag) || String(a.beginn).localeCompare(String(b.beginn)) : 0));
}

// Namen als kurzer Text: „Wenzel, Lioba …“
export const namenText = (l, max = 3) => !l || !l.length ? '' : l.length <= max ? l.join(', ') : `${l.slice(0, max).join(', ')} …`;

// Symbole der Mini-Reiter (eigener Code, util.js)
const SYM = { naechste: 'cal', termine: 'clock', frei: 'flag', himmel: 'moon', namen: 'etikett' };
// Zeile beim Überfahren: „Feiertag · Sa., 3.10. (in 6 Tagen) · am Wochenende“
const tipp = (t, heute) => [ART_TEXT[t.art], t.laeuft ? `läuft bis ${wtag(t.bis)}` : `${t.bis ? `${wtag(t.datum)} – ${wtag(t.bis)}` : wtag(t.datum)} (${wann(tageBis(heute, t.datum))})`, t.zusatz].filter(Boolean).join(' · ');

// Die Kachel. fEnv (feiertage) kann fehlen (Ausland, Störung), hEnv (himmel) und nEnv (namenstage) ebenso.
// tEnv: nur im privaten Betrieb – { daten } vom Dienst „termine“ oder { daten: null } bei Störung; null = öffentlich (kein Reiter)
// Mini-Reiter (seit 0.37.0, kein Aufklappen): Nächste · Termine (privat) · Feiertage & Ferien · Himmel · Namenstage
export function kachel(fEnv, hEnv, jetzt = Date.now(), zone = 'Europe/Berlin', nEnv = null, tEnv = null) {
  const heute = tagImOrt(new Date(jetzt).toISOString(), zone);
  const f = fEnv && fEnv.daten, h = hEnv && hEnv.daten;
  const alle = termine(fEnv, hEnv, heute, zone, tEnv);
  // eigene Termine heute, die noch nicht vorbei sind (mit Uhrzeit zuerst, sonst ganztägige)
  const jetztIso = new Date(jetzt).toISOString();
  const offen = alle.filter(x => x.art === 'termin' && x.datum === heute && (x.ganztag || (x.ende || x.beginn) > jetztIso));
  const terminHeute = offen.find(x => !x.ganztag) || offen[0];
  // kein Termin mehr heute → der nächste eigene Termin der nächsten 14 Tage steht trotzdem vorn
  const terminSpaeter = !terminHeute && alle.find(x => x.art === 'termin' && x.datum > heute);
  const kurzTag = (t, mitUhr = true) => {           // „14:00“, „morgen 9:00“, „Mi., 30.9. 19:00“
    const n = tageBis(heute, t.datum), zeit = mitUhr && t.art === 'termin' && !t.ganztag ? uhr(t.beginn, zone) : '';
    return [n === 0 ? (zeit ? '' : 'heute') : n === 1 ? 'morgen' : wtag(t.datum), zeit].filter(Boolean).join(' ');
  };
  const kw = f ? f.kalenderwoche : null;

  // Kennzahl: heute Feiertag > laufende Ferien > nächstes wichtiges Ereignis (Feiertag, Ferien, Brückentag, Zeitumstellung)
  const frei = alle.filter(t => ['feiertag', 'ferien', 'brueckentag', 'zeit'].includes(t.art));
  const heuteFrei = frei.find(t => t.datum === heute && t.art === 'feiertag');
  const laufend = frei.find(t => t.laeuft);
  const naechst = heuteFrei || laufend || frei[0] || alle.find(t => t.wichtig) || alle[0];
  let m = naechst ? naechst.text : (h ? MOND_TEXT[h.mond.name] : 'Kalender'), ms = '–', lead = '', kopfZusatz = '';
  if (terminHeute) {   // eigener Termin heute geht vor: „14:00 Zahnarzt“
    m = terminHeute.ganztag ? terminHeute.text : `${uhr(terminHeute.beginn, zone)} ${terminHeute.text}`;
    ms = terminHeute.ganztag ? 'heute' : uhr(terminHeute.beginn, zone);
    const danach = offen.filter(x => x !== terminHeute && !x.ganztag)[0];
    lead = danach ? `Danach ${uhr(danach.beginn, zone)} ${danach.text}` : offen.length > 1 ? `Heute ${offen.length} Termine` : '';
    kopfZusatz = terminHeute.ganztag ? 'heute' : '';
  } else if (terminSpaeter) {
    m = `${kurzTag(terminSpaeter)} ${terminSpaeter.text}`;
    ms = tageBis(heute, terminSpaeter.datum) === 1 ? 'morgen' : wtag(terminSpaeter.datum);
  } else if (naechst) {
    const n = tageBis(heute, naechst.datum);
    if (naechst === laufend) { ms = 'Ferien'; lead = `bis ${wtag(naechst.bis)}`; kopfZusatz = lead; }
    else { ms = n === 0 ? 'heute' : n === 1 ? 'morgen' : `${n} Tage`; lead = `${gross(wann(n))} (${wtag(naechst.datum)})`; kopfZusatz = wann(n); }   // Datum beim Überfahren (Text x), damit der Kopf einzeilig bleibt
  }
  // Text (Vorlesen, Handy): danach das nächste Freie und höchstens ein weiterer Termin der nächsten 7 Tage (Welttage nicht)
  const kuenftig = !terminHeute && !terminSpaeter && alle.find(x => x.art === 'termin' && x.datum > heute && tageBis(heute, x.datum) <= 7);
  const weitere = [
    ...(kuenftig ? [`Nächster Termin: ${tageBis(heute, kuenftig.datum) === 1 ? 'morgen' : wtag(kuenftig.datum)}${kuenftig.ganztag ? '' : ' ' + uhr(kuenftig.beginn, zone)} ${kuenftig.text}`] : []),
    ...frei.filter(t => t !== naechst || terminHeute || terminSpaeter).slice(0, 1).map(t => t.art === 'ferien' ? `${t.text} ab ${wtag(t.datum)}` : `${t.text} ${wtag(t.datum)}`),
    ...alle.filter(t => t !== naechst && !frei.includes(t) && t.art !== 'termin' && tageBis(heute, t.datum) <= 7 && !/Welt|Tag der Erde/.test(t.text)).slice(0, kuenftig ? 0 : 1)
      .map(t => `${t.text} ${tageBis(heute, t.datum) === 0 ? 'heute' : wtag(t.datum)}`)
  ];
  const heuteNamen = nEnv && nEnv.daten ? nEnv.daten.heute.namen : [];
  const x = [lead, ...weitere, heuteNamen.length ? `Namenstag: ${namenText(heuteNamen, 2)}` : ''].filter(Boolean).join(' · ');
  const kwText = kw ? `<small class="kl-kw">KW ${kw}</small> ` : '';

  // Reiter „Nächste“: Kopf = die große Zeile; darunter erst eigene Termine, kleiner Abstand, dann Freies,
  // ein Aktionstag der nächsten 7 Tage und der Namenstag – Zeilen, die nicht passen, blendet die Kachel aus
  const gross1 = terminHeute || terminSpaeter;
  const termineWeiter = alle.filter(t => t.art === 'termin' && t !== gross1 && !(t.datum === heute && !t.ganztag && (t.ende || t.beginn) <= jetztIso))
    .slice(0, 4).map(t => ({ d: kurzTag(t), t: t.text, tip: tipp(t, heute), gruppe: 1 }));
  const freiWeiter = frei.filter(t => t !== (gross1 ? null : naechst)).slice(0, 4)
    .map(t => ({ d: t.laeuft ? `bis ${wtag(t.bis)}` : kurzTag(t, false), t: t.text, tip: tipp(t, heute), gruppe: 2 }));
  const aktion = alle.find(t => t.art === 'aktion' && tageBis(heute, t.datum) <= 7 && !/Welt|Tag der Erde/.test(t.text));
  const naechsteListe = [...termineWeiter, ...freiWeiter, ...(aktion ? [{ d: kurzTag(aktion, false), t: aktion.text, tip: tipp(aktion, heute), gruppe: 2 }] : []),
    ...(heuteNamen.length ? [{ d: 'Namenstag', t: namenText(heuteNamen, 3), tip: `Namenstag heute: ${heuteNamen.join(', ')}`, gruppe: 2 }] : [])];
  const reiter = [{ id: 'naechste', name: 'Nächste', icon: icon(SYM.naechste),
    kopf: `${kwText}<b>${esc(m)}</b>${kopfZusatz ? ` <small>${esc(kopfZusatz)}</small>` : ''}`,
    liste: naechsteListe, html: '<p class="kl-leer">Nichts Besonderes in Sicht.</p>' }];

  // Termine (nur privat): je Tag eine Gruppe, Fehler je Kalender darunter
  if (tEnv) {
    const t = tEnv.daten, eigene = alle.filter(z => z.art === 'termin');
    reiter.push({ id: 'termine', name: 'Termine', icon: icon(SYM.termine), kopf: `<b>Termine</b> <small>${t && t.verbunden ? `${eigene.length} in 14 Tagen` : ''}</small>`,
      liste: t && t.verbunden ? [...eigene.map(z => ({ d: kurzTag(z, false), t: z.ganztag ? z.text : `${uhr(z.beginn, zone)} ${z.text}`, tip: tipp(z, heute), gruppe: z.datum })),
        ...t.fehler.map(e => ({ d: `Kalender ${e.kalender}`, t: e.meldung, tip: `Kalender ${e.kalender}: ${e.meldung}`, gruppe: 'fehler' }))] : [],
      html: !t ? '<p class="kl-leer">Deine Kalender sind gerade nicht erreichbar.</p>'
        : !t.verbunden ? '<p class="kl-leer">Noch kein Kalender verbunden – im Zahnrad den iCal-Link eintragen (Google: Kalender-Einstellungen → dein Kalender → „Privatadresse im iCal-Format“).</p>'
          : '<p class="kl-leer">Keine Termine in den nächsten 14 Tagen.</p>' });
  }
  // Feiertage & Ferien (nur Deutschland): Feiertage, Brückentage, Ferien, Zeitumstellung nach Datum
  if (f) reiter.push({ id: 'frei', name: 'Feiertage & Ferien', icon: icon(SYM.frei), kopf: `<b>Feiertage &amp; Ferien</b> <small>${esc(f.bundesland)}</small>`,
    liste: frei.map(t => ({ d: t.laeuft ? `bis ${wtag(t.bis)}` : t.bis ? `ab ${wtag(t.datum)}` : wtag(t.datum), t: t.text + (t.zusatz ? ` (${t.zusatz})` : ''), tip: tipp(t, heute), gruppe: 1 })),
    html: '<p class="kl-leer">Keine Feiertage oder Ferien gefunden.</p>' });
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
      nEnv && nEnv.daten ? 'Namenstage: Auswahl nach den Gedenktagen der Heiligen' : null, tEnv ? 'Termine: nur privat, nie zwischengespeichert' : null].filter(Boolean)
  };
}

// Antwort auf „Wann hat Josef Namenstag?“ aus der Dienstantwort mit name=… (nEnv) bzw. „Wer hat heute Namenstag?“
export function namenAntwort(nEnv, jetzt = Date.now(), zone = 'Europe/Berlin') {
  if (!nEnv || !nEnv.daten) return 'Die Namenstage sind gerade nicht erreichbar.';
  const d = nEnv.daten, heute = tagImOrt(new Date(jetzt).toISOString(), zone);
  if (!d.stand) return 'Die Namenstage werden gerade erst aufgebaut.';
  if (!d.gesucht) return d.heute.namen.length ? `Heute haben Namenstag: ${namenText(d.heute.namen, 6)}.` : 'Heute steht kein Namenstag im Kalender.';
  const g = d.gesucht;
  if (!g.naechster) return `Für ${g.name} ist kein Namenstag eingetragen.`;
  const alle = g.tage.length > 1 ? ` (weitere: ${g.tage.filter(t => t !== g.naechster.slice(5)).map(t => `${+t.slice(3)}.${+t.slice(0, 2)}.`).join(', ')})` : '';
  return `${g.name} hat Namenstag am ${wtag(g.naechster)} (${wann(tageBis(heute, g.naechster))})${alle}.`;
}

// „Was steht heute an?“ / „Was habe ich morgen?“ aus dem Dienst „termine“
export function termineAntwort(q, tEnv, jetzt = Date.now(), zone = 'Europe/Berlin') {
  if (!tEnv) return null;
  if (!tEnv.daten) return 'Deine Kalender sind gerade nicht erreichbar.';
  if (!tEnv.daten.verbunden) return 'Es ist noch kein Kalender verbunden. Trag unten unter „Einstellungen“ deinen iCal-Link ein.';
  const heute = tagImOrt(new Date(jetzt).toISOString(), zone), morgen = tagImOrt(new Date(jetzt + 864e5).toISOString(), zone);
  const l = termine(null, null, heute, zone, tEnv), fmt = x => (x.ganztag ? '' : uhr(x.beginn, zone) + ' ') + x.text;
  const am = d => l.filter(x => x.datum === d);
  if (/morgen/i.test(q)) return am(morgen).length ? `Morgen: ${am(morgen).map(fmt).join(', ')}.` : 'Morgen stehen keine Termine an.';
  let a = am(heute).length ? `Heute: ${am(heute).map(fmt).join(', ')}.` : 'Heute stehen keine Termine an.';
  if (am(morgen).length) a += ` Morgen: ${am(morgen).map(fmt).join(', ')}.`;
  return a;
}

// Antworten für „Frag DAILY“
export function antwort(q, fEnv, hEnv, ortName = '', jetzt = Date.now(), zone = 'Europe/Berlin') {
  const heute = tagImOrt(new Date(jetzt).toISOString(), zone), f = fEnv && fEnv.daten, h = hEnv && hEnv.daten;
  const erstes = art => termine(fEnv, hEnv, heute, zone).find(t => t.art === art);
  const bei = t => `${wtag(t.datum)} (${wann(tageBis(heute, t.datum))})`;
  if (/finsternis/i.test(q)) {
    if (!h) return null;
    const t = erstes('finsternis');
    return t ? `${t.text} am ${bei(t)}, ${t.zusatz}. Nur mit Schutzbrille in die Sonne schauen.` : `In den nächsten 5 Jahren ist von ${ortName || 'hier'} keine Finsternis zu sehen.`;
  }
  if (/mond/i.test(q)) {
    if (!h) return null;
    return `${MOND_TEXT[h.mond.name]}, ${h.mond.beleuchtung} % beleuchtet. Nächster Vollmond ${wtag(tagImOrt(h.mond.naechsterVollmond, zone))}, Neumond ${wtag(tagImOrt(h.mond.naechsterNeumond, zone))}.`;
  }
  if (/stern/i.test(q)) {
    const t = erstes('sterne');
    return t ? `Nächste Sternschnuppen: ${t.text}, Maximum in der Nacht ${bei(t)}, ${t.zusatz}.` : null;
  }
  if (/frühling|sommer(?!zeit)|herbst(?!ferien)|winter(?!zeit)|jahreszeit/i.test(q)) {
    const t = erstes('jahreszeit');
    return t ? `${t.text}: ${bei(t)}.` : null;
  }
  if (!f) return /ferien|feiertag|brücke|bruecke/i.test(q) ? 'Feiertage und Ferien gibt es für Orte in Deutschland.' : null;
  if (/kalenderwoche|\bkw\b/i.test(q)) return `Heute ist Kalenderwoche ${f.kalenderwoche}.`;
  if (/zeitumstellung|uhr umstellen|sommerzeit|winterzeit/i.test(q)) { const t = erstes('zeit'); return t ? `${t.text} am ${bei(t)}.` : null; }
  if (/ferien/i.test(q)) {
    if (!f.ferien) return 'Die Schulferien sind gerade nicht erreichbar.';
    const t = erstes('ferien');
    return t ? (t.laeuft ? `Gerade sind ${t.text} in ${f.bundesland}, bis ${wtag(t.bis)}.` : `Nächste Ferien in ${f.bundesland}: ${t.text} vom ${wtag(t.datum)} bis ${wtag(t.bis)}.`) : 'Keine Ferientermine gefunden.';
  }
  if (/brücke|bruecke/i.test(q)) { const t = erstes('brueckentag'); return t ? `Nächster Brückentag: ${bei(t)}, ${t.text.replace(/^Brückentag /, '')}.` : 'Kein Brückentag im nächsten Jahr.'; }
  // „Wann ist Muttertag?“ – ein genannter Tag; sonst der nächste Feiertag
  const ft = termine(fEnv, null, heute, zone), frage = q.toLowerCase();
  const genau = ft.find(x => frage.includes(x.text.toLowerCase().replace(/^\d\. /, '')));
  if (genau) return `${genau.text}: ${bei(genau)}.`;
  const t = ft.find(x => x.art === 'feiertag');
  return t ? `Nächster Feiertag in ${f.bundesland}: ${t.text}, ${bei(t)}.` : null;
}
