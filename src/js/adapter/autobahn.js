// Adapter „autobahn“: macht aus dem Vertrag autobahn v1 die Ansicht „Arbeitsweg“ der Kachel „Verkehr“ und Antworten für Frag DAILY.
// Start und Ziel bleiben im Browser: hier wird ausgewählt, welche Meldungen am Weg liegen (Korridor um die Luftlinie). Rein, ohne DOM – testbar.
import { esc } from '../core/util.js';

const TZ = 'Europe/Berlin';
export const KORRIDOR_KM = 10;        // mindestens so breit beidseits der Luftlinie Start–Ziel …
export const KORRIDOR_ANTEIL = 0.25;  // … bei langen Wegen ein Viertel der Luftlinie (Autobahnen laufen selten gerade)
const TAG = 864e5, VORSCHAU = TAG;    // Kommendes zeigt die kleine Kachel bis 24 Std. vorher
export const TYP_NAME = { stau: 'Stau', meldung: 'Meldung', sperrung: 'Sperrung', anschlusssperrung: 'Anschlussstelle gesperrt', tagesbaustelle: 'Tagesbaustelle', baustelle: 'Baustelle' };
const LAGE_NAME = { langsam: 'langsamer Verkehr', stockend: 'stockender Verkehr', stau: 'Stau' };

// „a4, A 13;a4“ → ['A4', 'A13'] (wie der Dienst); ungültig → null
export function strassenVon(v) {
  const teile = String(v || '').toUpperCase().split(/[,;\s]+(?=A)|[,;]/).map(s => s.replace(/\s+/g, '')).filter(Boolean);
  if (teile.some(s => !/^A\d{1,3}$/.test(s))) return null;
  return [...new Set(teile.map(s => 'A' + Number(s.slice(1))))].sort((a, b) => a.slice(1) - b.slice(1));
}

// ---- Weg: Abstand eines Punkts zur Strecke Start–Ziel (flach gerechnet, reicht für einige 100 km) ----
function xy(p, lat0) { return [p.lon * 111.32 * Math.cos(lat0 * Math.PI / 180), p.lat * 110.57]; }
export function abstandKm(p, a, b) {
  const lat0 = (a.lat + b.lat) / 2, [px, py] = xy(p, lat0), [ax, ay] = xy(a, lat0), [bx, by] = xy(b, lat0);
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
export const luftlinieKm = (a, b) => abstandKm(a, b, b);
export const korridorKm = (start, ziel) => Math.max(KORRIDOR_KM, KORRIDOR_ANTEIL * luftlinieKm(start, ziel));
const hatOrt = o => !!(o && Number.isFinite(o.lat) && Number.isFinite(o.lon));
// Liegt die Meldung am Weg? Anfang, Ende oder Mitte im Korridor. Ohne Start und Ziel: alle.
export function amWeg(m, start, ziel) {
  if (!hatOrt(start) || !hatOrt(ziel)) return true;
  const k = korridorKm(start, ziel), pkt = [{ lat: m.lat, lon: m.lon }];
  if (m.lat2 != null && m.lon2 != null) pkt.push({ lat: m.lat2, lon: m.lon2 }, { lat: (m.lat + m.lat2) / 2, lon: (m.lon + m.lon2) / 2 });
  return pkt.some(p => abstandKm(p, start, ziel) <= k);
}

// ---- Zeit ----
const ms = v => (v ? Date.parse(v) : NaN);
// läuft gerade? Bei Zeiträumen (z. B. nächtliche Sperrung) zählt nur ein laufender Zeitraum
export function aktiv(m, jetzt = Date.now()) {
  if (m.zeitraeume && m.zeitraeume.length) return m.zeitraeume.some(z => ms(z.beginn) <= jetzt && jetzt < ms(z.ende));
  if (ms(m.ende) <= jetzt) return false;
  if (m.kuenftig) return ms(m.beginn) <= jetzt;
  return !(ms(m.beginn) > jetzt);
}
// nächster Beginn in der Zukunft (null: läuft oder unbekannt)
export function naechsterBeginn(m, jetzt = Date.now()) {
  const z = (m.zeitraeume || []).map(x => ms(x.beginn)).filter(t => t > jetzt).sort((a, b) => a - b)[0];
  if (z) return z;
  return ms(m.beginn) > jetzt ? ms(m.beginn) : null;
}
// Ende des laufenden Zeitraums bzw. der Maßnahme
function laufendBis(m, jetzt) {
  const z = (m.zeitraeume || []).find(x => ms(x.beginn) <= jetzt && jetzt < ms(x.ende));
  return z ? ms(z.ende) : ms(m.ende);
}
const teile = t => Object.fromEntries(new Intl.DateTimeFormat('de-DE', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'numeric', hour: 'numeric', minute: '2-digit', hourCycle: 'h23' })
  .formatToParts(new Date(t)).map(x => [x.type, x.value]));
const tagNr = t => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(t));
// „21 Uhr“, „morgen 5 Uhr“, „Di 21 Uhr“, „12.10.“
export function wann(t, jetzt = Date.now()) {
  if (!Number.isFinite(t)) return '';
  const p = teile(t), uhr = `${+p.hour}${p.minute !== '00' ? ':' + p.minute : ''} Uhr`;
  const tage = Math.round((Date.parse(tagNr(t)) - Date.parse(tagNr(jetzt))) / TAG);
  if (tage === 0) return uhr;
  if (tage === 1) return 'morgen ' + uhr;
  if (tage > 1 && tage < 7) return `${p.weekday.replace('.', '')} ${uhr}`;
  return `${p.day}.${p.month}.`;
}

// ---- eine Meldung ----
const abschnitt = m => (m.bis ? `${m.von} – ${m.bis}` : m.von || '');
const richtung = m => (m.richtung && m.richtung.nach ? `Richtung ${m.richtung.nach}` : '');
// erste Zeile des amtlichen Texts, die etwas über die Lage sagt (ohne Beginn/Ende/Länge/Zeitraum)
export function kurztext(m) {
  return (m.text || []).find(z => !/^(Beginn|Ende|Zeitraum|Länge|Die Baustelle ist|\(Ende|Verzögerung|\d{2}\.\d{2}\.\d{2})/.test(z) && !/^A\d+:/.test(z)) || '';
}
// Kurzstatus für die linke Spalte: „+14 min“, „gesperrt“, „ab 21 Uhr“, „bis 17 Uhr“
export function status(m, jetzt = Date.now()) {
  if (!aktiv(m, jetzt)) { const b = naechsterBeginn(m, jetzt); return b ? 'ab ' + wann(b, jetzt) : 'geplant'; }
  if (m.typ === 'stau') return m.verzoegerungMin ? `+${m.verzoegerungMin} min` : 'Stau';
  if (m.typ === 'meldung') return 'Achtung';
  if (m.typ === 'sperrung' || m.typ === 'anschlusssperrung') { const e = laufendBis(m, jetzt); return Number.isFinite(e) && e - jetzt < TAG ? 'bis ' + wann(e, jetzt) : 'gesperrt'; }
  const e = laufendBis(m, jetzt);
  return Number.isFinite(e) ? 'bis ' + wann(e, jetzt) : 'Baustelle';
}
// Zeilen des amtlichen Texts, die aufgeklappt nichts Neues sagen (stehen schon in Status und Zeile)
const WEG_TEXT = /^(Beginn:|Ende:|Zeitraum dieser Bauphase|Die Baustelle ist zu folgenden|Länge:|Verzögerung:)/;
// Beschreibung in einer Zeile: „A4 Wilsdruff – Nossen · Richtung Chemnitz“ (+ Art, wo nötig)
function zeile(m) {
  const art = m.typ === 'stau' ? (LAGE_NAME[m.lage] || 'Stau') : m.typ === 'meldung' ? kurztext(m) || 'Meldung' : TYP_NAME[m.typ];
  return { ort: `${m.strasse} ${abschnitt(m)}`.trim(), art, richtung: richtung(m) };
}
function tipp(m, jetzt) {
  const z = zeile(m);
  const mehr = [m.tempoKmh ? `${m.tempoKmh} km/h` : '', m.laengeKm ? `${String(m.laengeKm).replace('.', ',')} km` : '',
    aktiv(m, jetzt) && ms(m.beginn) <= jetzt ? 'seit ' + wann(ms(m.beginn), jetzt) : ''].filter(Boolean);
  return [`${z.ort} · ${z.richtung}`, [z.art, ...mehr].join(' · '), m.typ !== 'meldung' ? kurztext(m) : ''].filter(Boolean).join('\n');
}

// ---- Auswahl ----
// Meldungen am Weg, eingeteilt: jetzt wichtig (Staus, Meldungen, Sperrungen, Tagesbaustellen – laufend oder in 24 Std.),
// Sperrungen später, Dauerbaustellen (laufend)
export function auswahl(env, { start, ziel, jetzt = Date.now() } = {}) {
  const alle = ((env && env.daten && env.daten.meldungen) || []).filter(m => amWeg(m, start, ziel));
  const bald = m => aktiv(m, jetzt) || (naechsterBeginn(m, jetzt) || Infinity) - jetzt <= VORSCHAU;
  const wichtig = alle.filter(m => m.typ !== 'baustelle' && bald(m));
  return {
    alle, wichtig,
    staus: wichtig.filter(m => m.typ === 'stau' || m.typ === 'meldung'),
    sperrungen: alle.filter(m => (m.typ === 'sperrung' || m.typ === 'anschlusssperrung') && (aktiv(m, jetzt) || naechsterBeginn(m, jetzt))),
    tagesbaustellen: alle.filter(m => m.typ === 'tagesbaustelle' && bald(m)),
    baustellen: alle.filter(m => m.typ === 'baustelle' && (aktiv(m, jetzt) || naechsterBeginn(m, jetzt)))
  };
}
const mehrzahl = (n, eins, viele) => `${n} ${n === 1 ? eins : viele}`;
export function zusammenfassung(a, jetzt = Date.now()) {
  const staus = a.wichtig.filter(m => m.typ === 'stau'), gesperrt = a.wichtig.filter(m => (m.typ === 'sperrung' || m.typ === 'anschlusssperrung') && aktiv(m, jetzt));
  const max = Math.max(0, ...staus.map(m => m.verzoegerungMin || 0));
  const teileT = [staus.length ? mehrzahl(staus.length, 'Stau', 'Staus') + (max ? ` (bis +${max} min)` : '') : '',
    gesperrt.length ? mehrzahl(gesperrt.length, 'Sperrung', 'Sperrungen') : '',
    a.baustellen.length ? mehrzahl(a.baustellen.length, 'Baustelle', 'Baustellen') : ''].filter(Boolean);
  if (!staus.length && !gesperrt.length) return 'Keine Staus oder Sperrungen' + (a.baustellen.length ? ` · ${mehrzahl(a.baustellen.length, 'Baustelle', 'Baustellen')}` : '') + '.';
  return teileT.join(', ') + '.';
}

const wegName = (start, ziel) => (start && ziel && start.name && ziel.name ? `${start.name} → ${ziel.name}` : '');

// Ansicht „Arbeitsweg“ (Felder wie core/board.js erwartet; die Kachel „Verkehr“ setzt Umschalter und Reiter zusammen)
export function ansicht(env, { start, ziel, jetzt = Date.now() } = {}) {
  const d = env && env.daten;
  if (!d) return { kopf: 'Arbeitsweg', m: '', ms: '–', x: 'Die Autobahn-Meldungen sind gerade nicht erreichbar.', liste: [], html: '<p>Die Autobahn-Meldungen sind gerade nicht erreichbar.</p>' };
  const a = auswahl(env, { start, ziel, jetzt }), weg = wegName(start, ziel), bahnen = d.strassen.join(' · ');
  const x = zusammenfassung(a, jetzt);
  const liste = a.wichtig.slice(0, 3).map(m => { const z = zeile(m); return { d: status(m, jetzt), t: `${z.ort} · ${z.art}`, tip: tipp(m, jetzt), gruppe: 1 }; });
  if (!liste.length) liste.push({ d: '✓', t: 'Keine Staus oder Sperrungen', tip: `${bahnen}${weg ? ' · ' + weg : ''}`, gruppe: 1 });
  if (a.baustellen.length && liste.length < 3) liste.push({ d: String(a.baustellen.length), t: a.baustellen.length === 1 ? 'Baustelle' : 'Baustellen', tip: a.baustellen.map(m => zeile(m).ort).join('\n'), gruppe: 2 });
  // Aufgeklappt: Gruppen mit amtlichem Text
  const reihe = m => { const z = zeile(m), txt = (m.text || []).filter(t => !WEG_TEXT.test(t) && t !== z.art).slice(0, 6);
    return `<div class="row${aktiv(m, jetzt) ? '' : ' vk-spaeter'}"><dt><b>${esc(status(m, jetzt))}</b></dt>` +
      `<dd><b>${esc(z.ort)}</b>${z.richtung ? ' · ' + esc(z.richtung) : ''} · ${esc(z.art)}` +
      `${m.tempoKmh ? ` · ${m.tempoKmh} km/h` : ''}${m.laengeKm ? ` · ${esc(String(m.laengeKm).replace('.', ','))} km` : ''}` +
      `${txt.length ? `<br><small>${txt.map(esc).join(' · ')}</small>` : ''}</dd></div>`; };
  const gruppe = (titel, l, max = 30) => (l.length ? `<h4 class="vk-gruppe">${esc(titel)}</h4><dl class="kompakt">${l.slice(0, max).map(reihe).join('')}</dl>` +
    (l.length > max ? `<p class="vk-hinweis">… und ${l.length - max} weitere</p>` : '') : '');
  const bereich = weg ? `${weg} · ${bahnen} · Meldungen bis ${Math.round(korridorKm(start, ziel))} km neben der Luftlinie, beide Richtungen` : `${bahnen} · alle Meldungen (Start und Ziel im Zahnrad eintragen, um auf den Weg zu beschränken)`;
  const html = `<p class="vk-hinweis">${esc(bereich)}</p>` +
    (a.staus.length || a.sperrungen.length || a.tagesbaustellen.length ? '' : '<p><b>✓ Keine Staus oder Sperrungen.</b></p>') +
    gruppe('Staus und Meldungen', a.staus) + gruppe('Sperrungen', a.sperrungen) + gruppe('Baustellen heute', a.tagesbaustellen) + gruppe('Baustellen', a.baustellen) +
    (d.fehlend.length ? `<p class="vk-hinweis">Keine Daten für ${esc(d.fehlend.join(', '))}.</p>` : '') +
    '<p class="vk-quelle">Quelle: Die Autobahn GmbH des Bundes (verkehr.autobahn.de), Verkehrsmeldungen teils INRIX · Angaben ohne Gewähr</p>';
  return {
    kopf: `<b>${esc(weg || bahnen)}</b>${weg ? ` <small>${esc(bahnen)}</small>` : ''}`,
    m: '', ms: a.wichtig.some(m => aktiv(m, jetzt) && m.typ !== 'tagesbaustelle') ? `${a.wichtig.filter(m => aktiv(m, jetzt) && m.typ !== 'tagesbaustelle').length} ⚠` : 'frei',
    x, liste, html
  };
}

// Frag DAILY: „Stau auf der A4?“, „Wie ist mein Arbeitsweg?“ (null = nicht zuständig)
export const FRAGE = /\bstaus?\b|autobahn|\ba\s?\d{1,3}\b|arbeitsweg|sperrung|gesperrt|baustelle/i;
export function antwort(q, env, { start, ziel, strassen = [], jetzt = Date.now() } = {}) {
  const t = String(q);
  if (!FRAGE.test(t)) return null;
  const gefragt = (t.match(/\bA\s?\d{1,3}\b/gi) || []).map(s => 'A' + Number(s.replace(/\D/g, '')));
  const fremd = gefragt.filter(s => !strassen.includes(s));
  if (!strassen.length) return 'Für Autobahn-Meldungen im Zahnrad der Kachel „Verkehr“ unter „Arbeitsweg“ deine Autobahnen eintragen (z. B. A4, A13).';
  if (fremd.length) return `${fremd.join(', ')} ${fremd.length === 1 ? 'ist' : 'sind'} nicht in deinem Arbeitsweg eingetragen – im Zahnrad der Kachel „Verkehr“ ergänzen.`;
  if (!env || !env.daten) return 'Die Autobahn-Meldungen sind gerade nicht erreichbar.';
  // Frage nach einer bestimmten Autobahn: alle ihre Meldungen; sonst nur am Weg
  const nur = gefragt.length ? { ...env, daten: { ...env.daten, meldungen: env.daten.meldungen.filter(m => gefragt.includes(m.strasse)) } } : env;
  const a = auswahl(nur, gefragt.length ? { jetzt } : { start, ziel, jetzt });
  const wo = gefragt.length ? gefragt.join(', ') : `${env.daten.strassen.join(', ')}${wegName(start, ziel) ? ` (${wegName(start, ziel)})` : ''}`;
  if (!a.wichtig.length) return `${wo}: gerade keine Staus oder Sperrungen${a.baustellen.length ? `, ${mehrzahl(a.baustellen.length, 'Baustelle', 'Baustellen')}` : ''}. Angaben ohne Gewähr.`;
  const satz = m => { const z = zeile(m), s = status(m, jetzt);
    return `${z.art} ${m.strasse} ${abschnitt(m)}${z.richtung ? ' ' + z.richtung : ''}${m.typ === 'meldung' ? '' : ` (${s})`}`; };
  return `${wo}: ${a.wichtig.slice(0, 4).map(satz).join('; ')}${a.wichtig.length > 4 ? ` und ${a.wichtig.length - 4} weitere` : ''}` +
    `${a.baustellen.length ? `. Dazu ${mehrzahl(a.baustellen.length, 'Baustelle', 'Baustellen')}` : ''}. Angaben ohne Gewähr.`;
}
