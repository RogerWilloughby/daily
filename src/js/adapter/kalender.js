// Adapter „kalender“: macht aus den Diensten „feiertage“ und „himmel“ die Kachel „Kalender“ und die Antworten für „Frag DAILY“.
// Ohne DOM, testbar. Zeiten in der Zeitzone des Orts (Standard Europe/Berlin).
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const MOND_TEXT = { neumond: 'Neumond', zunehmende_sichel: 'Zunehmende Sichel', erstes_viertel: 'Erstes Viertel', zunehmender_mond: 'Zunehmender Mond',
  vollmond: 'Vollmond', abnehmender_mond: 'Abnehmender Mond', letztes_viertel: 'Letztes Viertel', abnehmende_sichel: 'Abnehmende Sichel' };
const PHASE_TEXT = { neumond: 'Neumond', erstes_viertel: 'Erstes Viertel', vollmond: 'Vollmond', letztes_viertel: 'Letztes Viertel' };
const JAHRESZEIT = { fruehling: 'Frühlingsanfang', sommer: 'Sommeranfang', herbst: 'Herbstanfang', winter: 'Winteranfang' };
const FINSTERNIS_TYP = { partiell: 'Partielle', total: 'Totale', ringfoermig: 'Ringförmige' };
const ART_TEXT = { feiertag: 'Feiertag', brueckentag: 'Brückentag', ferien: 'Ferien', zeit: 'Zeitumstellung', aktion: 'Aktionstag',
  mond: 'Mond', sterne: 'Sternschnuppen', finsternis: 'Finsternis', jahreszeit: 'Jahreszeit' };

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
  return out.filter(t => (t.bis || t.datum) >= heute).sort((a, b) => a.datum.localeCompare(b.datum) || (b.wichtig - a.wichtig));
}

// Zeile einer Liste: „Sa., 3.10. · in 6 Tagen   Tag der Deutschen Einheit“
function zeile(t, heute) {
  const n = tageBis(heute, t.datum);
  const datum = t.laeuft ? `bis ${wtag(t.bis)}` : t.bis ? `${wtag(t.datum)} – ${wtag(t.bis)}` : wtag(t.datum);
  const abstand = t.laeuft ? 'läuft' : wann(n);
  return `<li class="kl-z kl-${t.art}${t.wichtig ? ' kl-wichtig' : ''}"><span class="kl-d">${esc(datum)}<small>${esc(abstand)}</small></span>` +
    `<span class="kl-t"><i class="kl-punkt" title="${esc(ART_TEXT[t.art])}"></i>${esc(t.text)}${t.zusatz ? ` <small>${esc(t.zusatz)}</small>` : ''}</span></li>`;
}
const liste = (l, heute, leer) => l.length ? `<ul class="kl-liste">${l.map(t => zeile(t, heute)).join('')}</ul>` : `<p class="kl-leer">${esc(leer)}</p>`;

// Reiter „Himmel“: Mond jetzt, dann die Liste der Himmelsereignisse
function himmelReiter(h, heute, zone) {
  if (!h) return '<p class="kl-leer">Die Himmelsdaten sind gerade nicht erreichbar.</p>';
  const m = h.mond;
  const mondZeile = `<p class="kl-jetzt"><b>${esc(MOND_TEXT[m.name])}</b>, ${m.beleuchtung} % beleuchtet` +
    (m.aufgang ? ` · Aufgang ${uhr(m.aufgang, zone)}` : '') + (m.untergang ? ` · Untergang ${uhr(m.untergang, zone)}` : '') + '</p>';
  // je Art nur die nächsten: 2 Mondtermine, 1 Sternschnuppen-Nacht, 2 Finsternisse, 1 Jahreszeit – passt ohne Scrollen
  const alle = termine(null, { daten: h }, heute, zone), je = { mond: 2, sterne: 1, finsternis: 2, jahreszeit: 1 }, n = {};
  const l = alle.filter(t => (n[t.art] = (n[t.art] || 0) + 1) <= je[t.art]);
  return mondZeile + liste(l, heute, 'Keine Ereignisse.') +
    '<p class="kl-quelle">Berechnet (Astronomy Engine), Finsternisse nur, wenn am Ort zu sehen. Sonne nur mit Schutzbrille ansehen.</p>';
}

// Namen als kurzer Text: „Wenzel, Lioba …“
export const namenText = (l, max = 3) => !l || !l.length ? '' : l.length <= max ? l.join(', ') : `${l.slice(0, max).join(', ')} …`;

// Reiter „Namenstage“: heute und die nächsten 6 Tage
function namenReiter(n, heute) {
  const z = n.woche.map(w => `<li class="kl-z kl-namen${w.datum === heute ? ' kl-wichtig' : ''}"><span class="kl-d">${esc(wtag(w.datum))}<small>${esc(wann(tageBis(heute, w.datum)))}</small></span>` +
    `<span class="kl-t">${esc(w.namen.join(', ') || '–')}</span></li>`).join('');
  return `<ul class="kl-liste">${z}</ul><p class="kl-quelle">Namenstage nach den Gedenktagen der Heiligen – eine Auswahl, Kalender unterscheiden sich je Region und Konfession.</p>`;
}

// Die Kachel. fEnv (feiertage) kann fehlen (Ausland, Störung), hEnv (himmel) und nEnv (namenstage) ebenso.
export function kachel(fEnv, hEnv, jetzt = Date.now(), zone = 'Europe/Berlin', nEnv = null) {
  const heute = tagImOrt(new Date(jetzt).toISOString(), zone);
  const f = fEnv && fEnv.daten, h = hEnv && hEnv.daten;
  const alle = termine(fEnv, hEnv, heute, zone);
  const kw = f ? f.kalenderwoche : null;

  // Kennzahl: heute Feiertag > laufende Ferien > nächstes wichtiges Ereignis (Feiertag, Ferien, Brückentag, Zeitumstellung)
  const frei = alle.filter(t => ['feiertag', 'ferien', 'brueckentag', 'zeit'].includes(t.art));
  const heuteFrei = frei.find(t => t.datum === heute && t.art === 'feiertag');
  const laufend = frei.find(t => t.laeuft);
  const naechst = heuteFrei || laufend || frei[0] || alle.find(t => t.wichtig) || alle[0];
  let m = naechst ? naechst.text : (h ? MOND_TEXT[h.mond.name] : 'Kalender'), ms = '–', lead = '';
  if (naechst) {
    const n = tageBis(heute, naechst.datum);
    if (naechst === laufend) { ms = 'Ferien'; lead = `bis ${wtag(naechst.bis)}`; }
    else { ms = n === 0 ? 'heute' : n === 1 ? 'morgen' : `${n} Tage`; lead = `${gross(wann(n))} (${wtag(naechst.datum)})`; }
  }
  // Zeile darunter: danach das nächste Freie und höchstens ein weiterer Termin der nächsten 7 Tage (Welttage nicht)
  const weitere = [
    ...frei.filter(t => t !== naechst).slice(0, 1).map(t => t.art === 'ferien' ? `${t.text} ab ${wtag(t.datum)}` : `${t.text} ${wtag(t.datum)}`),
    ...alle.filter(t => t !== naechst && !frei.includes(t) && tageBis(heute, t.datum) <= 7 && !/Welt|Tag der Erde/.test(t.text)).slice(0, 1)
      .map(t => `${t.text} ${tageBis(heute, t.datum) === 0 ? 'heute' : wtag(t.datum)}`)
  ];
  const heuteNamen = nEnv && nEnv.daten ? nEnv.daten.heute.namen : [];
  const x = [lead, ...weitere, heuteNamen.length ? `Namenstag: ${namenText(heuteNamen, 2)}` : ''].filter(Boolean).join(' · ');

  const tabs = [
    { id: 'naechste', name: 'Nächste', html: (heuteNamen.length ? `<p class="kl-jetzt">Namenstag heute: <b>${esc(namenText(heuteNamen, 5))}</b></p>` : '') +
      liste(alle.slice(0, heuteNamen.length ? 8 : 9), heute, 'Keine Termine.') },
    ...(f ? [
      { id: 'feiertage', name: 'Feiertage', html: `<p class="kl-kopf">${esc(f.bundesland)} · landesweite Feiertage</p>` +
        liste(alle.filter(t => t.art === 'feiertag' || t.art === 'brueckentag').slice(0, 8), heute, 'Keine Feiertage.') },
      { id: 'ferien', name: 'Ferien', html: f.ferien ? `<p class="kl-kopf">Schulferien ${esc(f.bundesland)}</p>` +
        liste(alle.filter(t => t.art === 'ferien').slice(0, 8), heute, 'Keine Ferientermine gefunden.') + '<p class="kl-quelle">Quelle: OpenHolidays API</p>'
        : '<p class="kl-leer">Die Schulferien sind gerade nicht erreichbar.</p>' }
    ] : []),
    { id: 'himmel', name: 'Himmel', html: himmelReiter(h, heute, zone) },
    ...(nEnv && nEnv.daten && nEnv.daten.woche.some(w => w.namen.length) ? [{ id: 'namen', name: 'Namenstage', html: namenReiter(nEnv.daten, heute) }] : [])
  ];
  const titel = kw ? `Kalender · KW ${kw}` : 'Kalender';
  const rows = alle.slice(0, 12).map(t => [wtag(t.datum), t.text + (t.zusatz ? ` (${t.zusatz})` : '')]);
  return { state: 'live', title: titel, m, ms, x, tabs, rows };
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
