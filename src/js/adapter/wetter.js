// Adapter „wetter“: macht aus dem Vertrag wetter v1 (reine Daten) den Bereich „Wetter“ (Kopfzeile, Untertabs Jetzt · Radar · Hinweise · Mehr).
// Ohne DOM – daher auch in Node testbar.
import { glyph, esc, icon } from '../core/util.js';
import { miniDiagramm, miniHeute, miniTageszeiten, miniWahl, MINI_WAHL } from './diagramm.js';
import { hinweis as regenHinweis, radarKlein, radarKopf, radarInfo } from './regen.js';
import { abzeichen, zeilen as hinweisZeilen } from './hinweise.js';

export const TEXT = {
  klar: 'Klar', ueberwiegend_klar: 'Überwiegend klar', teilweise_bewoelkt: 'Teilweise bewölkt', bedeckt: 'Bedeckt',
  nebel: 'Nebel', niesel: 'Nieselregen', gefrierender_niesel: 'Gefrierender Nieselregen', regen: 'Regen',
  gefrierender_regen: 'Gefrierender Regen', schnee: 'Schneefall', schneegriesel: 'Schneegriesel', regenschauer: 'Regenschauer',
  schneeschauer: 'Schneeschauer', gewitter: 'Gewitter', gewitter_hagel: 'Gewitter mit Hagel', unbekannt: '–'
};
// Stärke aus dem WMO-Code (leicht/stark) für genauere Texte
const STAERKE = { 51: 'Leichter ', 55: 'Starker ', 61: 'Leichter ', 65: 'Starker ', 71: 'Leichter ', 75: 'Starker ', 80: 'Leichte ', 82: 'Heftige ', 86: 'Starke ' };
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

// Zahlen in den Farben der Diagrammlinien (Tiefst blau, Höchst orange)
const tmin = v => `<b class="wd-t-min">${r0(v)}°</b>`, tmax = v => `<b class="wd-t-max">${r0(v)}°</b>`;

// Uhrzeit des Tiefst-/Höchstwerts: „6 Uhr“ (leer, wenn unbekannt)
const uhrVon = (iso, zone) => iso ? `${+new Date(iso).toLocaleTimeString('de-DE', { timeZone: zone, hour: '2-digit' }).slice(0, 2)} Uhr` : '';
// klammern: „9° (2 Uhr)“ statt „9° 2 Uhr“; mitJetzt: aktuelle Temperatur nach dem Ort (ohne: „heute“ und Wind)
export function kopfzeileHtml(env, klammern = false, mitJetzt = true) {
  const a = env.daten.aktuell, h = env.daten.tage[0] || {}, zone = env.ort.zeitzone || 'Europe/Berlin';
  const um = iso => (uhrVon(iso, zone) ? ` <small class="wd-um">${klammern ? '(' : ''}${uhrVon(iso, zone)}${klammern ? ')' : ''}</small>` : '');
  // Mouseover: „Tiefstwert heute: 9° um 2 Uhr“
  const tip = (art, v, iso) => `${art} heute: ${r0(v)}°${uhrVon(iso, zone) ? ' um ' + uhrVon(iso, zone) : ''}`;
  const wert = (html, art, v, iso) => `<span class="wd-tm" title="${esc(tip(art, v, iso))}">${html}${um(iso)}</span>`;
  return `${esc(env.ort.name || 'Wetter')}${mitJetzt ? ` ${r0(a.tempC)}°` : ''} · ${mitJetzt ? '' : 'heute '}${wert(tmin(h.minC), 'Tiefstwert', h.minC, h.minZeit)} / ${wert(tmax(h.maxC), 'Höchstwert', h.maxC, h.maxZeit)}` +
    (mitJetzt ? '' : windHeute(h));
}
// Wind heute in der Kopfzeile: „ · Wind 25/50 km/h“ (Höchstwert/stärkste Böe des Tages, kurz, damit die Zeile passt; ausführlich im Mouseover)
export function windHeute(h) {
  if (!h || h.windMaxKmh == null) return '';
  const tip = `Wind heute: bis ${r0(h.windMaxKmh)} km/h${h.windRichtung ? ' aus ' + h.windRichtung : ''}${h.boeenMaxKmh != null ? `, Böen bis ${r0(h.boeenMaxKmh)} km/h` : ''}`;
  return ` <span class="wd-wind" title="${esc(tip)}">· Wind ${r0(h.windMaxKmh)}${h.boeenMaxKmh != null ? `/${r0(h.boeenMaxKmh)}` : ''} km/h</span>`;
}

// Frost und Glätte heute oder morgen
function warnung(tage, z) {
  const t = tage.slice(0, 2).find(x => x.glaette || x.frost);
  if (!t) return null;
  const wann = t === tage[0] ? 'heute' : 'morgen';
  return t.glaette ? `Glätte möglich ${wann} (bis ${r0(t.minC)}°)` : `Frost ${wann} (bis ${r0(t.minC)}°)`;
}

// Bereich „Wetter“ (Felder wie core/oberflaeche.js erwartet): Kopfzeile, Untertabs, Infozeile
// regenEnv (optional): Antwort des Dienstes „regen“ – Abzeichen „☂ in 20 Min.“ und Untertab „Radar“
// hinweisEnv (optional): Antwort des Dienstes „wetterhinweise“ – Abzeichen und Untertab „Hinweise“ nur, wenn es etwas gibt
// chart: 15-Tage-Diagramm für den Untertab „Jetzt“ – mitOptionen() setzt das Diagramm des gewählten Zeitraums ein
export function kachel(env, regenEnv = null, hinweisEnv = null) {
  const d = env.daten, a = d.aktuell, { z, heute, regenMax, regenUm, pollen } = auswerten(env);
  const zone = env.ort.zeitzone || 'Europe/Berlin', hTop = (hinweisEnv && hinweisEnv.daten && hinweisEnv.daten.hinweise[0]) || null;
  const hz = hinweisZeilen(hinweisEnv, zone);
  const kleinReiter = [
    { id: 'jetzt', name: 'Jetzt', icon: icon('sun'), html: jetztHtml(zpJetzt(env)) },
    ...(regenEnv && regenEnv.daten && regenEnv.daten.karte ? [{ id: 'radar', name: 'Radar', icon: icon('schirm'), kopf: esc(radarKopf(regenEnv)), html: radarKlein(regenEnv, z.hm) }] : []),
    ...(hz.length ? [{ id: 'hinweise', name: 'Hinweise', icon: icon('warn'), kopf: abzeichen(hinweisEnv) + ' <small class="wh-dwd">Deutscher Wetterdienst</small>', liste: hz }] : []),
    { id: 'mehr', name: 'Details', icon: icon('list'), liste: mehrListe(env, { z, heute, regenMax, regenUm, pollen }) }
  ];
  return {
    state: 'live', kopf: kopfzeileHtml(env, true, false) + abzeichen(hinweisEnv) + radarAbzeichen(regenEnv),
    kleinReiter, unwetter: hTop && hTop.stufe >= 3 ? `${hTop.ereignis}|${hTop.beginn || ''}` : null,
    info: [`Stand ${z.hm(a.zeit)} Uhr`, 'Wetter: ' + [...new Set(env.quellen.map(q => q.name.split(' ')[0]))].join(', ') + ' – Vorhersagen ohne Gewähr', ...radarInfo(regenEnv),
      ...(hz.length ? ['Amtliche Warnungen: Deutscher Wetterdienst · Tipps: DAILY'] : [])],
    chart: miniDiagramm(d.tage, zpTag)
  };
}

// Zeitpunkt-Block als HTML (rein): Zeitpunkt · Temperatur · gefühlt · Symbol+Wetterlage / Regen mm · Regen % · Wind · Sonne des Tages
export function zpHtml(z) {
  const f = (k, v) => `<span class="zp-${k}">${esc(v || '')}</span>`;
  const schirm = (k, v) => `<span class="zp-${k}">${v ? `<i class="zp-schirm" aria-hidden="true">☂</i> ${esc(v)}` : ''}</span>`;
  return f('z', z.z) + f('t', z.t) + f('g', z.g) + `<span class="zp-l">${glyph(z.i)}<span>${esc(z.l)}</span></span>` +
    `<span class="zp-r">${schirm('mm', z.mm)}${schirm('p', z.p)}${f('w', z.w)}${f('s', z.s)}</span>`;
}
// Inhalt des Untertabs „Jetzt“: Zeitpunkt-Block (wechselt beim Überfahren des Diagramms, ansichten/wetter.js)
export const jetztHtml = zp => `<div class="wz-jetzt"><span class="t-zp" data-jetzt="${esc(JSON.stringify(zp))}">${zpHtml(zp)}</span></div>`;

// Untertab „Details“ (id 'mehr'): Details von heute und Zusatzwerte als Zeilen (wichtigste zuerst, die Oberfläche zeigt so viele, wie ganz passen)
export function mehrListe(env, { z, heute, regenMax, regenUm, pollen }) {
  const a = env.daten.aktuell, d = env.daten, m = d.tage[1], l = [];
  const zeile = (dd, t, tip) => l.push({ d: dd, t, tip: tip || `${dd}: ${t}`, gruppe: 1 });
  if (m) zeile('Morgen', `${r0(m.minC)}–${r0(m.maxC)}° · ${zustandText(m.zustand, m.code)} · Regen bis ${m.regenProzent ?? 0} %`);
  zeile('Regen', `heute bis ${regenMax} %${regenUm ? `, am ehesten ${regenUm} Uhr` : ''}${heute.niederschlagMm ? ` · ${String(heute.niederschlagMm).replace('.', ',')} mm` : ''}`);
  const warn = warnung(d.tage, z);
  if (warn) zeile('Achtung', warn);
  zeile('Wind', `${r0(a.windKmh)} km/h${a.windRichtung ? ' aus ' + a.windRichtung : ''}${a.boeenKmh ? `, Böen ${r0(a.boeenKmh)}` : ''}`);
  zeile('Sonne', [`${z.hm(heute.sonnenaufgang)}–${z.hm(heute.sonnenuntergang)}`, heute.sonnenstunden != null ? `${String(heute.sonnenstunden).replace('.', ',')} Std.` : null,
    heute.uvMax != null ? `UV bis ${Math.round(heute.uvMax)}` : null].filter(Boolean).join(' · '));
  if (d.luft) zeile('Luft', `${LUFT[d.luft.stufe] || '–'} (EAQI ${r0(d.luft.aqi)})`);
  if (pollen) {
    const werte = d.luft && d.luft.pollen ? Object.entries(d.luft.pollen).filter(([, v]) => v != null && v >= 1).map(([k, v]) => `${POLLEN[k]} ${r0(v)}`) : [];
    zeile('Pollen', pollen, `Pollen: ${pollen}${werte.length ? ` (je m³: ${werte.join(', ')})` : ''}`);
  }
  if (a.luftdruckHpa != null) zeile('Druck', `${r0(a.luftdruckHpa)} hPa${a.druckTendenz ? ', ' + a.druckTendenz : ''}`);
  if (a.feuchteProzent != null) zeile('Feuchte', `${r0(a.feuchteProzent)} %${a.taupunktC != null ? ` · Taupunkt ${r0(a.taupunktC)}°${a.taupunktC >= 16 ? ' (schwül)' : ''}` : ''}`);
  const sicht = a.sichtweiteM == null ? null : a.sichtweiteM >= 10000 ? 'Sicht über 10 km' : `Sicht ${String(Math.round(a.sichtweiteM / 100) / 10).replace('.', ',')} km${a.sichtweiteM < 1000 ? ' (Nebel)' : ''}`;
  const wolken = [a.wolkenProzent != null ? `${r0(a.wolkenProzent)} % bewölkt` : null, sicht].filter(Boolean).join(' · ');
  if (wolken) zeile('Wolken', wolken);
  if (heute.nullgradgrenzeM != null) zeile('0°-Grenze', `${r0(heute.nullgradgrenzeM)} m`);
  if (a.schneehoeheCm) zeile('Schnee', `${r0(a.schneehoeheCm)} cm`);
  return l;
}

// Mouseover-Texte der Mini-Diagramme (rein, testbar)
const fest = t => t.replace(/ /g, '\u00a0');   // Teile nicht mitten drin umbrechen
const mmText = v => `${String(Math.round((v || 0) * 10) / 10).replace('.', ',')} mm`;
// Zeitpunkt-Block unter „Jetzt“ (rein, testbar): immer dieselben Felder in derselben Reihenfolge – für „Jetzt“, eine Stunde
// oder einen Tag. Beim Überfahren des Diagramms wechseln nur die Werte (ansichten/wetter.js), nicht Anordnung oder Zeilenzahl.
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
// Radar-Meldung als Abzeichen in der Kopfzeile („☂ in 20 Min. (leicht)“) – bleibt beim Überfahren stehen
export function radarAbzeichen(regenEnv) {
  const t = regenHinweis(regenEnv); if (!t) return '';
  const kurz = t.replace(/\.$/, '').replace(/^Regen (in|hört)/, '$1');
  return ` <span class="wh-badge wd-radar" title="${esc('Regenradar: ' + t)}">☂ ${esc(kurz)}</span>`;
}

// Einstellungen anwenden (rein, testbar): Untertabs Radar/Details aus- oder einblenden; „Jetzt“ bekommt die Zeiträume
// Heute · 3 Tage · 7 Tage · 15 Tage als Themen (Ebene 3, seit 0.49.0) – Start ist der zuletzt gewählte (mini; früher gespeicherte
// Werte 24 Std. → Heute, 48 Std. → 3 Tage, 16 → 15 Tage, siehe miniWahl). „Jetzt“ ist immer da; „Hinweise“ nur bei Warnung (nicht abwählbar).
export const WETTER_STANDARD = { radar: true, mehr: true, mini: 1 };
export function mitOptionen(k, env, opt = {}) {
  const o = { ...WETTER_STANDARD, ...opt };
  const zone = (env && env.ort && env.ort.zeitzone) || 'Europe/Berlin';
  const stunde = iso => +new Date(iso).toLocaleTimeString('de-DE', { timeZone: zone, hour: '2-digit', hourCycle: 'h23' }).slice(0, 2);
  const d = env && env.daten;
  // Ältere Antworten (vor wetter 1.5.0) ohne „heute“/„tageszeiten“: 15 Tage
  const diagramm = w => !d ? k.chart : w === 7 ? miniDiagramm(d.tage.slice(0, 7), zpTag)
    : w === 3 && d.tageszeiten && d.tageszeiten.length ? miniTageszeiten(d.tageszeiten, zpTageszeit)
    : w === 1 && d.heute && d.heute.length ? miniHeute(d.heute, stunde, s => zpStunde(s, d.tage, zone)) : k.chart;
  const kleinReiter = (k.kleinReiter || []).filter(r => r.id === 'jetzt' || r.id === 'hinweise' || o[r.id] !== false)
    .map(r => (r.id === 'jetzt' ? { ...r, startTeil: 'm' + miniWahl(o.mini),
      teile: MINI_WAHL.map(([w, name]) => ({ id: 'm' + w, name, html: r.html, unten: diagramm(w) })) } : r));
  return { ...k, kleinReiter, startReiter: 'jetzt', chart: '' };
}
