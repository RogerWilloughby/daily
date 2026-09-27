// Adapter „wetter“: macht aus dem Vertrag wetter v1 (reine Daten) die Darstellung für eine Oberfläche.
// Heute: kachel() für das Kachelraster und antwort() für „Frag DAILY“. Später z. B. liste(), dashboard().
// Ohne DOM – daher auch in Node testbar.
import { glyph } from '../core/util.js';
import { miniDiagramm, tageDiagramm } from './diagramm.js';

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
  wtag: datum => new Date(datum + 'T12:00:00Z').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' })
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

// „Dresden 15° · 9°/16°“
export function kopfzeile(env) {
  const a = env.daten.aktuell, h = env.daten.tage[0] || {};
  return `${env.ort.name || 'Wetter'} ${r0(a.tempC)}° · ${r0(h.minC)}°/${r0(h.maxC)}°`;
}

// Frost und Glätte heute oder morgen
function warnung(tage, z) {
  const t = tage.slice(0, 2).find(x => x.glaette || x.frost);
  if (!t) return null;
  const wann = t === tage[0] ? 'heute' : 'morgen';
  return t.glaette ? `Glätte möglich ${wann} (bis ${r0(t.minC)}°)` : `Frost ${wann} (bis ${r0(t.minC)}°)`;
}

// Trend-Tage zusammengefasst: Temperaturspanne und Tendenz
function trendText(tage) {
  const min = Math.min(...tage.map(t => t.minC ?? Infinity)), max = Math.max(...tage.map(t => t.maxC ?? -Infinity));
  const nass = tage.filter(t => (t.regenProzent ?? 0) >= 50).length;
  const art = nass >= tage.length / 2 ? 'eher wechselhaft' : nass === 0 ? 'eher trocken' : 'teils Regen';
  return `${r0(min)}° bis ${r0(max)}° · ${art} (unsicher)`;
}

// Darstellung als Kachel (Felder wie in core/board.js erwartet)
export function kachel(env) {
  const d = env.daten, a = d.aktuell, { z, heute, regenMax, regenUm, pollen } = auswerten(env);
  const regenText = regenMax >= 25 ? `Regen möglich gegen ${regenUm} Uhr.` : 'Kein Regen zu erwarten.';
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
  d.tage.slice(1, 7).filter(t => !t.trend).forEach((t, i) => rows.push([i === 0 ? 'Morgen' : z.wtag(t.datum),
    `${r0(t.minC)}° bis ${r0(t.maxC)}° · ${zustandText(t.zustand, t.code)} · Regen bis ${t.regenProzent ?? 0} %`]));
  const trend = d.tage.filter(t => t.trend);
  if (trend.length) rows.push([`Trend bis ${z.wtag(trend[trend.length - 1].datum)}`, trendText(trend)]);
  rows.push(['Stand', `${z.hm(a.zeit)} Uhr · ${env.quellen.map(q => q.name).join(', ')}`]);
  // Kopfzeile: Ort, jetzt, Tiefst/Höchst von heute – alles in einer Zeile
  return {
    state: 'live', title: kopfzeile(env),
    glyph: glyph(bild(a.zustand, a.tag)),
    m: KURZ[a.zustand] || zustandText(a.zustand, a.code), ms: r0(a.tempC) + '°',
    x: `Gefühlt ${r0(a.gefuehltC)}°. ${regenText}`,   // Zustand steht schon groß daneben
    chart: miniDiagramm(d.tage),
    big: tageDiagramm(d.tage, z.wtag),
    rows
  };
}

// Antwort für „Frag DAILY“
export function antwort(env) {
  const a = env.daten.aktuell, { heute, regenMax: p, regenUm } = auswerten(env);
  const wann = regenUm ? ` (am ehesten gegen ${regenUm} Uhr)` : '';
  const schirm = p >= 50 ? `Ja, nimm einen Schirm mit: Regenrisiko bis ${p} %${wann}.`
    : p >= 25 ? `Vielleicht. Das Regenrisiko liegt bei bis zu ${p} %${wann}.`
    : `Nein, eher nicht. Das Regenrisiko bleibt heute bei höchstens ${p} %.`;
  return `${env.ort.name || 'Hier'}: jetzt ${r0(a.tempC)}°, ${zustandText(a.zustand, a.code)}. Heute ${r0(heute.minC)}° bis ${r0(heute.maxC)}°. ${schirm}`;
}
