// Adapter „wetter“: macht aus dem Vertrag wetter v1 (reine Daten) die Darstellung für eine Oberfläche.
// Heute: kachel() für das Kachelraster und antwort() für „Frag DAILY“. Später z. B. liste(), dashboard().
// Ohne DOM – daher auch in Node testbar.
import { glyph, esc } from '../core/util.js';
import { miniDiagramm, miniHeute, miniTageszeiten, miniWahl, tageDiagramm, stundenDiagramm } from './diagramm.js';
import { hinweis as regenHinweis, radarReiter } from './regen.js';
import { abzeichen, kurz as hinweisKurz, reiter as hinweisReiter } from './hinweise.js';

export const TEXT = {
  klar: 'Klar', ueberwiegend_klar: 'Überwiegend klar', teilweise_bewoelkt: 'Teilweise bewölkt', bedeckt: 'Bedeckt',
  nebel: 'Nebel', niesel: 'Nieselregen', gefrierender_niesel: 'Gefrierender Nieselregen', regen: 'Regen',
  gefrierender_regen: 'Gefrierender Regen', schnee: 'Schneefall', schneegriesel: 'Schneegriesel', regenschauer: 'Regenschauer',
  schneeschauer: 'Schneeschauer', gewitter: 'Gewitter', gewitter_hagel: 'Gewitter mit Hagel', unbekannt: '–'
};
// Stärke aus dem WMO-Code (leicht/stark) für genauere Texte
const STAERKE = { 51: 'Leichter ', 55: 'Starker ', 61: 'Leichter ', 65: 'Starker ', 71: 'Leichter ', 75: 'Starker ', 80: 'Leichte ', 82: 'Heftige ', 86: 'Starke ' };
// Kurzform für die große Zeile der Kachel
export const KURZ = {
  klar: 'Klar', ueberwiegend_klar: 'Heiter', teilweise_bewoelkt: 'Wolkig', bedeckt: 'Bedeckt', nebel: 'Nebel', niesel: 'Niesel',
  gefrierender_niesel: 'Glatteis', regen: 'Regen', gefrierender_regen: 'Glatteis', schnee: 'Schnee', schneegriesel: 'Schnee',
  regenschauer: 'Schauer', schneeschauer: 'Schnee', gewitter: 'Gewitter', gewitter_hagel: 'Gewitter', unbekannt: '–'
};
export const zustandText = (zustand, code) => {
  const t = TEXT[zustand] || '–';
  return STAERKE[code] ? STAERKE[code] + t : t;
};
const LUFT = { gut: 'gut', ausreichend: 'ausreichend', maessig: 'mäßig', schlecht: 'schlecht', sehr_schlecht: 'sehr schlecht', extrem_schlecht: 'extrem schlecht' };
const POLLEN = { erle: 'Erle', birke: 'Birke', graeser: 'Gräser', beifuss: 'Beifuß', ambrosia: 'Ambrosia' };

const bild = (zustand, tag) => {
  const k = ['klar', 'ueberwiegend_klar'].includes(zustand) ? 'clear' : zustand === 'teilweise_bewoelkt' ? 'partly' : zustand === 'bedeckt' ? 'cloud'
    : zustand === 'nebel' ? 'fog' : zustand.startsWith('gewitter') ? 'storm' : ['schnee', 'schneegriesel', 'schneeschauer'].includes(zustand) ? 'snow' : 'rain';
  return tag === false && k === 'clear' ? 'cloud' : k; // nachts kein Sonnensymbol
};
const r0 = v => v == null ? '–' : Math.round(v);

// Hilfen für Zeiten in der Zeitzone des Orts
const zeitFmt = zone => ({
  hm: iso => iso ? new Date(iso).toLocaleTimeString('de-DE', { timeZone: zone, hour: '2-digit', minute: '2-digit' }) : '–',
  h: iso => new Date(iso).toLocaleTimeString('de-DE', { timeZone: zone, hour: '2-digit' }).slice(0, 2),
  tag: iso => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)),
  wtag: datum => new Date(datum + 'T12:00:00Z').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' }),
  wtagKurz: iso => new Date(iso).toLocaleDateString('de-DE', { timeZone: zone, weekday: 'short' })
});

// Kennzahlen, die mehrere Darstellungen brauchen
export function auswerten(env) {
  const d = env.daten, z = zeitFmt(env.ort.zeitzone || 'Europe/Berlin');
  const heute = d.tage[0], morgen = d.tage[1];
  let regenMax = 0, regenUm = null;
  for (const s of d.stunden) {
    if (z.tag(s.zeit) !== heute.datum) break;
    if (s.regenProzent != null && s.regenProzent > regenMax) { regenMax = s.regenProzent; regenUm = z.h(s.zeit); }
  }
  let pollen = null;
  if (d.luft && d.luft.pollen) {
    const [art, wert] = Object.entries(d.luft.pollen).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1])[0] || [];
    pollen = !art || wert < 1 ? 'keine' : `${wert < 20 ? 'gering' : wert < 50 ? 'mittel' : 'hoch'} (${POLLEN[art]})`;
  }
  return { z, heute, morgen, regenMax, regenUm: regenMax >= 25 ? regenUm : null, pollen };
}

// Regen in den nächsten 24 Stunden (wie das kleine Diagramm) – für die Regenzeile der kleinen Kachel (rein, testbar)
// „Regen möglich gegen 17 Uhr.“ / „Regen möglich morgen gegen 7 Uhr.“ / „Kein Regen in den nächsten 24 Std.“
export function regen24(env) {
  const z = zeitFmt(env.ort.zeitzone || 'Europe/Berlin'), heute = (env.daten.tage[0] || {}).datum;
  let max = 0, bei = null;
  for (const s of env.daten.stunden.slice(0, 24)) if (s.regenProzent != null && s.regenProzent > max) { max = s.regenProzent; bei = s; }
  if (max < 25 || !bei) return { max, text: 'Kein Regen in den nächsten 24 Std.' };
  const morgen = heute && z.tag(bei.zeit) !== heute ? 'morgen ' : '';
  return { max, text: `Regen möglich ${morgen}gegen ${+z.h(bei.zeit)} Uhr.` };
}

// Zahlen in den Farben der Diagrammlinien (Tiefst blau, Höchst orange)
const tmin = v => `<b class="wd-t-min">${r0(v)}°</b>`, tmax = v => `<b class="wd-t-max">${r0(v)}°</b>`;
// Zeilen mit fertigem HTML als Wert (Schlüssel wird maskiert)
const zeilen = liste => '<dl class="kompakt">' + liste.map(([k, v]) => `<div class="row"><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('') + '</dl>';

function heuteZeilen(env, z, heute, regenMax, regenUm, wind, sonne) {
  const a = env.daten.aktuell, d = env.daten;
  const liste = [
    ['Heute', `${tmin(heute.minC)} bis ${tmax(heute.maxC)} · ${esc(zustandText(heute.zustand, heute.code))}`],
    ['Regen', `<b class="wd-t-regen">bis ${regenMax} %</b>${regenUm ? `, am ehesten gegen ${regenUm} Uhr` : ''}${heute.niederschlagMm ? ` · ${String(heute.niederschlagMm).replace('.', ',')} mm` : ''}`],
    ['Wind', esc(wind)],
    ['Sonne', esc(sonne)]
  ];
  if (a.luftdruckHpa != null) liste.push(['Luftdruck', `${r0(a.luftdruckHpa)} hPa${a.druckTendenz ? ', ' + a.druckTendenz : ''}`]);
  const warn = warnung(d.tage, z);
  if (warn) liste.push(['Achtung', esc(warn)]);
  const m = d.tage[1];
  if (m) liste.push(['Morgen', `${tmin(m.minC)} bis ${tmax(m.maxC)} · ${esc(zustandText(m.zustand, m.code))}`]);
  return liste;
}

function mehrZeilen(env, pollen) {
  const a = env.daten.aktuell, d = env.daten, h = d.tage[0] || {};
  const liste = [];
  if (d.luft) liste.push(['Luftqualität', `${LUFT[d.luft.stufe] || '–'} (EAQI ${r0(d.luft.aqi)})`]);
  if (pollen) {
    const werte = d.luft && d.luft.pollen ? Object.entries(d.luft.pollen).filter(([, v]) => v != null && v >= 1).map(([k, v]) => `${POLLEN[k]} ${r0(v)}`) : [];
    liste.push(['Pollen', esc(pollen) + (werte.length ? ` <small>(je m³: ${esc(werte.join(', '))})</small>` : '')]);
  }
  if (a.uvIndex != null || h.uvMax != null) liste.push(['UV', `jetzt ${r0(a.uvIndex)}, heute bis ${r0(h.uvMax)}`]);
  if (a.feuchteProzent != null) liste.push(['Feuchte', `${r0(a.feuchteProzent)} %${a.taupunktC != null ? `, Taupunkt ${r0(a.taupunktC)}°${a.taupunktC >= 16 ? ' (schwül)' : ''}` : ''}`]);
  const sicht = a.sichtweiteM == null ? null : a.sichtweiteM >= 10000 ? 'Sicht über 10 km' : `Sicht ${String(Math.round(a.sichtweiteM / 100) / 10).replace('.', ',')} km${a.sichtweiteM < 1000 ? ' (Nebel)' : ''}`;
  const wolken = [a.wolkenProzent != null ? `${r0(a.wolkenProzent)} % bewölkt` : null, sicht].filter(Boolean).join(' · ');
  if (wolken) liste.push(['Wolken', wolken]);
  if (h.nullgradgrenzeM != null) liste.push(['Nullgradgrenze', `${r0(h.nullgradgrenzeM)} m`]);
  if (a.schneehoeheCm) liste.push(['Schnee', `${r0(a.schneehoeheCm)} cm`]);
  const z = zeitFmt(env.ort.zeitzone || 'Europe/Berlin');
  const quellen = [...new Set(env.quellen.map(q => q.name.split(' ')[0]))].join(', ');   // „Open-Meteo“ statt aller Teilnamen
  liste.push(['Stand', `${z.hm(a.zeit)} Uhr · ${esc(quellen)}`]);
  return liste;
}

// Uhrzeit des Tiefst-/Höchstwerts: „6 Uhr“ (leer, wenn unbekannt)
const uhrVon = (iso, zone) => iso ? `${+new Date(iso).toLocaleTimeString('de-DE', { timeZone: zone, hour: '2-digit' }).slice(0, 2)} Uhr` : '';
// klammern: kleine Kachel „9° (2 Uhr)“, aufgeklappt „9° 2 Uhr“
export function kopfzeileHtml(env, klammern = false, mitJetzt = true) {
  const a = env.daten.aktuell, h = env.daten.tage[0] || {}, zone = env.ort.zeitzone || 'Europe/Berlin';
  const um = iso => (uhrVon(iso, zone) ? ` <small class="wd-um">${klammern ? '(' : ''}${uhrVon(iso, zone)}${klammern ? ')' : ''}</small>` : '');
  // Mouseover: „Tiefstwert heute: 9° um 2 Uhr“
  const tip = (art, v, iso) => `${art} heute: ${r0(v)}°${uhrVon(iso, zone) ? ' um ' + uhrVon(iso, zone) : ''}`;
  const wert = (html, art, v, iso) => `<span class="wd-tm" title="${esc(tip(art, v, iso))}">${html}${um(iso)}</span>`;
  return `${esc(env.ort.name || 'Wetter')}${mitJetzt ? ` ${r0(a.tempC)}°` : ''} · ${mitJetzt ? '' : 'heute '}${wert(tmin(h.minC), 'Tiefstwert', h.minC, h.minZeit)} / ${wert(tmax(h.maxC), 'Höchstwert', h.maxC, h.maxZeit)}` +
    (mitJetzt ? '' : windHeute(h));
}
// Wind heute in der Kopfzeile der kleinen Kachel: „ · Wind 25/50 km/h“ (Höchstwert/stärkste Böe des Tages, kurz, damit die Zeile passt; ausführlich im Mouseover)
export function windHeute(h) {
  if (!h || h.windMaxKmh == null) return '';
  const tip = `Wind heute: bis ${r0(h.windMaxKmh)} km/h${h.windRichtung ? ' aus ' + h.windRichtung : ''}${h.boeenMaxKmh != null ? `, Böen bis ${r0(h.boeenMaxKmh)} km/h` : ''}`;
  return ` <span class="wd-wind" title="${esc(tip)}">· Wind ${r0(h.windMaxKmh)}${h.boeenMaxKmh != null ? `/${r0(h.boeenMaxKmh)}` : ''} km/h</span>`;
}

// „Dresden 15° · 9°/16°“
export function kopfzeile(env) {
  const a = env.daten.aktuell, h = env.daten.tage[0] || {}, zone = env.ort.zeitzone || 'Europe/Berlin';
  const um = iso => (uhrVon(iso, zone) ? ` (${uhrVon(iso, zone)})` : '');
  return `${env.ort.name || 'Wetter'} ${r0(a.tempC)}° · ${r0(h.minC)}°${um(h.minZeit)} / ${r0(h.maxC)}°${um(h.maxZeit)}`;
}

// Frost und Glätte heute oder morgen
function warnung(tage, z) {
  const t = tage.slice(0, 2).find(x => x.glaette || x.frost);
  if (!t) return null;
  const wann = t === tage[0] ? 'heute' : 'morgen';
  return t.glaette ? `Glätte möglich ${wann} (bis ${r0(t.minC)}°)` : `Frost ${wann} (bis ${r0(t.minC)}°)`;
}

// Spätere Tage zusammengefasst: Temperaturspanne und Tendenz (ohne „Trend“/„unsicher“ – das steht im Dienstblatt)
function spaeterText(tage) {
  const min = Math.min(...tage.map(t => t.minC ?? Infinity)), max = Math.max(...tage.map(t => t.maxC ?? -Infinity));
  const nass = tage.filter(t => (t.regenProzent ?? 0) >= 50).length;
  const art = nass >= tage.length / 2 ? 'eher wechselhaft' : nass === 0 ? 'eher trocken' : 'teils Regen';
  return `${r0(min)}° bis ${r0(max)}° · ${art}`;
}

// Darstellung als Kachel (Felder wie in core/board.js erwartet)
// regenEnv (optional): Antwort des Dienstes „regen“ – liefert „Regen in 20 Min.“ und den Reiter „Radar“
// hinweisEnv (optional): Antwort des Dienstes „wetterhinweise“ – Abzeichen und kurzer Hinweis nur, wenn es etwas gibt; Reiter „Hinweise“ immer
export function kachel(env, regenEnv = null, hinweisEnv = null) {
  const d = env.daten, a = d.aktuell, { z, heute, regenMax, regenUm, pollen } = auswerten(env);
  const wind = `${r0(a.windKmh)} km/h${a.windRichtung ? ' aus ' + a.windRichtung : ''}${a.boeenKmh ? `, Böen ${r0(a.boeenKmh)} km/h` : ''}`;
  const sonne = [`${z.hm(heute.sonnenaufgang)} bis ${z.hm(heute.sonnenuntergang)}`,
    heute.sonnenstunden != null ? `${String(heute.sonnenstunden).replace('.', ',')} Std. Sonne` : null,
    heute.uvMax != null ? `UV bis ${Math.round(heute.uvMax)}` : null].filter(Boolean).join(' · ');
  const rows = [
    ['Heute', `${r0(heute.minC)}° bis ${r0(heute.maxC)}° · ${zustandText(heute.zustand, heute.code)}`],
    ['Regenrisiko', `bis ${regenMax} % (restlicher Tag)`],
    ['Wind', wind],
    ['Sonne', sonne]
  ];
  if (a.luftdruckHpa != null) rows.push(['Luftdruck', `${r0(a.luftdruckHpa)} hPa${a.druckTendenz ? ', ' + a.druckTendenz : ''}`]);
  if (a.sichtweiteM != null && a.sichtweiteM < 1000) rows.push(['Sicht', `nur ${r0(a.sichtweiteM)} m (Nebel)`]);
  const warn = warnung(d.tage, z);
  if (warn) rows.push(['Achtung', warn]);
  if (d.luft) rows.push(['Luftqualität', `${LUFT[d.luft.stufe] || '–'} (EAQI ${r0(d.luft.aqi)})`]);
  if (pollen) rows.push(['Pollen', pollen]);
  d.tage.slice(1, 7).forEach((t, i) => rows.push([i === 0 ? 'Morgen' : z.wtag(t.datum),
    `${r0(t.minC)}° bis ${r0(t.maxC)}° · ${zustandText(t.zustand, t.code)} · Regen bis ${t.regenProzent ?? 0} %`]));
  const spaeter = d.tage.slice(7);
  if (spaeter.length) rows.push([`Bis ${z.wtag(spaeter[spaeter.length - 1].datum)}`, spaeterText(spaeter)]);
  rows.push(['Stand', `${z.hm(a.zeit)} Uhr · ${env.quellen.map(q => q.name).join(', ')}`]);
  // Aufgeklappt: Reiter statt langer Liste – alles ohne Scrollen sichtbar
  const zone = env.ort.zeitzone || 'Europe/Berlin', hTop = (hinweisEnv && hinweisEnv.daten && hinweisEnv.daten.hinweise[0]) || null;
  const hKurz = hinweisKurz(hinweisEnv, zone);
  if (hKurz) rows.unshift(['Hinweis', hKurz]);
  const hReiter = { id: 'hinweise', name: 'Hinweise', html: hinweisReiter(hinweisEnv, zone, Date.now(), env.ort) };
  const tabs = [
    ...(hTop && hTop.stufe >= 3 ? [hReiter] : []),   // Unwetter: zuerst
    { id: 'heute', name: 'Heute', html: zeilen(heuteZeilen(env, z, heute, regenMax, regenUm, wind, sonne)) },
    ...(regenEnv && regenEnv.daten ? [{ id: 'radar', name: 'Radar', html: radarReiter(regenEnv, z.hm) }] : []),
    { id: 'tage', name: `${d.tage.length} Tage`, html: tageDiagramm(d.tage, z.wtag, t => zustandText(t.zustand, t.code)) },
    { id: 'stunden', name: `${d.stunden.length} Std.`, html: stundenDiagramm(d.stunden, iso => ({ h: z.h(iso), tag: z.wtagKurz(iso) })) },
    ...(hTop && hTop.stufe >= 3 ? [] : [hReiter]),
    { id: 'mehr', name: 'Mehr', html: zeilen(mehrZeilen(env, pollen)) }
  ];
  const wetterText = `${zustandText(a.zustand, a.code)}, gefühlt ${r0(a.gefuehltC)}°.`;
  // Regen: eigene Zeile in der kleinen Kachel (Radar geht vor der 24-Stunden-Vorhersage)
  const regenZeile = regenHinweis(regenEnv) || regen24(env).text;
  // Kopfzeile: Ort, jetzt, Tiefst/Höchst von heute – alles in einer Zeile
  return {
    state: 'live', title: kopfzeile(env) + (hTop ? ` · ${hKurz}` : ''), titleHtml: kopfzeileHtml(env) + abzeichen(hinweisEnv), kopf: kopfzeileHtml(env, true, false) + abzeichen(hinweisEnv) + radarAbzeichen(regenEnv), zeileIcon: true, tabs,
    zp: zpJetzt(env),   // Zeitpunkt-Block der kleinen Kachel (Jetzt; beim Überfahren des Diagramms Stunde/Tag)
    lglyph: glyph(bild(a.zustand, a.tag)), lglyphTip: zustandText(a.zustand, a.code),   // Symbol in der Kopfzeile, Erklärung beim Überfahren
    glyph: '', m: '', ms: r0(a.tempC) + '°',                                               // keine große Zeile – Platz fürs Diagramm
    // Unwetter zuerst, sonst Wetter · Hinweis; der Regen steht darunter in einer eigenen Zeile (Schirm-Symbol)
    x: (hTop && hTop.stufe >= 3 ? [hKurz, wetterText] : [wetterText, hKurz]).filter(Boolean).join(' '),
    zeile2: { glyph: glyph('schirm'), text: regenZeile },
    chart: miniDiagramm(d.tage, zpTag),
    rows
  };
}

// Mouseover-Texte der Mini-Diagramme (rein, testbar)
const fest = t => t.replace(/ /g, '\u00a0');   // Teile nicht mitten drin umbrechen
const mmText = v => `${String(Math.round((v || 0) * 10) / 10).replace('.', ',')} mm`;
// Zeitpunkt-Block der kleinen Kachel (rein, testbar): immer dieselben Felder in derselben Reihenfolge – für „Jetzt“, eine Stunde
// oder einen Tag. Beim Überfahren des Diagramms wechseln nur die Werte (core/board.js), nicht Anordnung oder Zeilenzahl.
// { z: Zeitpunkt, t: Temperatur, g: gefühlt, i: Symbol, l: Wetterlage, mm: Regenmenge, p: Regenwahrscheinlichkeit, w: Wind, s: Sonnenstunden des Tages }
const komma1 = v => String(Math.round(v * 10) / 10).replace('.', ',');
const sonneText = t => (t && t.sonnenstunden != null ? `☀ ${Math.round(t.sonnenstunden)} h` : '☀ –');
const gef = (g, t) => (g != null && r0(g) !== r0(t) ? `gef. ${r0(g)}°` : '');
export function zpJetzt(env) {
  const a = env.daten.aktuell, s0 = env.daten.stunden[0] || {}, heute = env.daten.tage[0];
  return { z: 'Jetzt', t: `${r0(a.tempC)}°`, g: gef(a.gefuehltC, a.tempC), i: bild(a.zustand, a.tag), l: zustandText(a.zustand, a.code),
    mm: mmText(s0.niederschlagMm), p: s0.regenProzent != null ? `${s0.regenProzent} %` : '', w: a.windKmh != null ? `Wind ${r0(a.windKmh)} km/h` : '', s: sonneText(heute) };
}
export function zpStunde(s, tage, zone = 'Europe/Berlin') {
  const d = new Date(s.zeit), h = +d.toLocaleTimeString('de-DE', { timeZone: zone, hour: '2-digit', hourCycle: 'h23' }).slice(0, 2);
  const wt = d.toLocaleDateString('de-DE', { timeZone: zone, weekday: 'short' }).replace('.', '');
  const datum = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const tag = (tage || []).find(t => t.datum === datum);
  const hell = tag && tag.sonnenaufgang && tag.sonnenuntergang ? d >= new Date(tag.sonnenaufgang) && d < new Date(tag.sonnenuntergang) : h >= 7 && h < 19;
  return { z: `${wt} ${h} Uhr`, t: `${r0(s.tempC)}°`, g: gef(s.gefuehltC, s.tempC), i: bild(s.zustand, hell), l: zustandText(s.zustand, s.code),
    mm: mmText(s.niederschlagMm), p: s.regenProzent != null ? `${s.regenProzent} %` : '', w: s.windKmh != null ? `Wind ${r0(s.windKmh)} km/h` : '', s: sonneText(tag) };
}
export function zpTag(t) {
  const d = new Date(t.datum + 'T12:00:00Z');
  return { z: `${d.toLocaleDateString('de-DE', { weekday: 'short', timeZone: 'UTC' }).replace('.', '')} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`,
    t: `${r0(t.minC)}–${r0(t.maxC)}°`, g: '', i: bild(t.zustand, true), l: zustandText(t.zustand, t.code),
    mm: mmText(t.niederschlagMm), p: t.regenProzent != null ? `${t.regenProzent} %` : '', w: t.windMaxKmh != null ? `Wind ${r0(t.windMaxKmh)} km/h` : '', s: sonneText(t) };
}
// Tageszeit (3-Tage-Diagramm): „Di Mittag“, mittlere Temperatur, Wind und Sonne der Tageszeit
const TAGESZEIT = { morgen: 'Morgen', mittag: 'Mittag', abend: 'Abend', nacht: 'Nacht' };
export function zpTageszeit(t) {
  const d = new Date(t.datum + 'T12:00:00Z');
  return { z: `${d.toLocaleDateString('de-DE', { weekday: 'short', timeZone: 'UTC' }).replace('.', '')} ${TAGESZEIT[t.abschnitt] || ''}`,
    t: `${r0(t.tempC)}°`, g: gef(t.gefuehltC, t.tempC), i: bild(t.zustand, t.abschnitt === 'morgen' || t.abschnitt === 'mittag'), l: zustandText(t.zustand, t.code),
    mm: mmText(t.niederschlagMm), p: t.regenProzent != null ? `${t.regenProzent} %` : '', w: t.windMaxKmh != null ? `Wind ${r0(t.windMaxKmh)} km/h` : '', s: sonneText(t) };
}
// Text-Fassung (Frag DAILY, Tests): „So 11.10. · 5–17° · Klar · 0 mm (0 %) · ☀ 10 h“
export const zpText = z => [z.z, z.t, z.g, z.l, `${z.mm}${z.p ? ` (${z.p})` : ''}`, z.w, z.s].filter(Boolean).join(' · ');
export const tagTip = t => zpText(zpTag(t));
export const stundeTip = (s, zone) => zpText(zpStunde(s, [], zone));
// Radar-Meldung als Abzeichen in der Kopfzeile („☂ in 20 Min. (leicht)“) – bleibt beim Überfahren stehen
export function radarAbzeichen(regenEnv) {
  const t = regenHinweis(regenEnv); if (!t) return '';
  const kurz = t.replace(/\.$/, '').replace(/^Regen (in|hört)/, '$1');
  return ` <span class="wh-badge wd-radar" title="${esc('Regenradar: ' + t)}">☂ ${esc(kurz)}</span>`;
}

// Antwort für „Frag DAILY“
export function antwort(env, regenEnv = null) {
  const a = env.daten.aktuell, { heute, regenMax: p, regenUm } = auswerten(env);
  const radar = regenHinweis(regenEnv);
  const wann = regenUm ? ` (am ehesten gegen ${regenUm} Uhr)` : '';
  const schirm = p >= 50 ? `Ja, nimm einen Schirm mit: Regenrisiko bis ${p} %${wann}.`
    : p >= 25 ? `Vielleicht. Das Regenrisiko liegt bei bis zu ${p} %${wann}.`
    : `Nein, eher nicht. Das Regenrisiko bleibt heute bei höchstens ${p} %.`;
  return `${env.ort.name || 'Hier'}: jetzt ${r0(a.tempC)}°, ${zustandText(a.zustand, a.code)}. Heute ${r0(heute.minC)}° bis ${r0(heute.maxC)}°. ${schirm}${radar ? ' Radar: ' + radar : ''}`;
}

// Einstellungen der Kachel anwenden (rein, testbar): Reiter aus-/einblenden, Start-Reiter, Mini-Diagramm Heute (1, Standard), 3, 7 oder 15 Tage
// (gespeichert von früher: 24 Std. → Heute, 48 Std. → 3 Tage, 16 → 15 Tage; siehe miniWahl).
// „Heute“ bleibt immer; bei Unwetter (Reiter „Hinweise“ steht vorn) bleibt der Hinweis-Reiter sichtbar und zuerst offen.
export const WETTER_STANDARD = { radar: true, tage: true, stunden: true, hinweise: true, mehr: true, start: 'heute', mini: 1 };
export function mitOptionen(k, env, opt = {}) {
  const o = { ...WETTER_STANDARD, ...opt };
  const unwetter = k.tabs && k.tabs[0] && k.tabs[0].id === 'hinweise';
  const tabs = (k.tabs || []).filter(t => t.id === 'heute' || (t.id === 'hinweise' && unwetter) || o[t.id] !== false);
  const startReiter = unwetter ? 'hinweise' : tabs.some(t => t.id === o.start) ? o.start : 'heute';
  const zone = (env && env.ort && env.ort.zeitzone) || 'Europe/Berlin';
  const stunde = iso => +new Date(iso).toLocaleTimeString('de-DE', { timeZone: zone, hour: '2-digit', hourCycle: 'h23' }).slice(0, 2);
  const w = miniWahl(o.mini), d = env && env.daten;
  // Ältere Antworten (vor wetter 1.5.0) ohne „heute“/„tageszeiten“: 15 Tage wie bisher
  const chart = !d ? k.chart : w === 7 ? miniDiagramm(d.tage.slice(0, 7), zpTag)
    : w === 3 && d.tageszeiten && d.tageszeiten.length ? miniTageszeiten(d.tageszeiten, zpTageszeit)
    : w === 1 && d.heute && d.heute.length ? miniHeute(d.heute, stunde, s => zpStunde(s, d.tage, zone)) : k.chart;
  return { ...k, tabs, startReiter, chart };
}

